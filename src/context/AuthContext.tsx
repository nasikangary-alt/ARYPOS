import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  signInAnonymously,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { Employee, Attendance, UserRole, UserProfile } from '../types';
import { sanitizeFirestore } from '../utils/sanitizeFirestore';

export interface ActiveCashierLock {
  isActive: boolean;
  employeeId: string | null;
  employeeName: string | null;
  username: string | null;
  deviceId?: string | null;
  loginAt?: string;
  logoutAt?: string;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  currentEmployee: Employee | null;
  userProfile: UserProfile | null;
  currentRole: UserRole;
  todayAttendance: Attendance | null;
  activeCashierLock: ActiveCashierLock | null;
  loading: boolean;
  loginWithCredentials: (identifier: string, pinOrPass: string) => Promise<Employee>;
  loginWithGoogle: () => Promise<Employee>;
  logout: () => Promise<void>;
  refreshAttendance: () => Promise<void>;
  forceReleaseCashierLock: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initial bootstrap owner employee (Owner does not have attendance and can always log in)
const DEFAULT_OWNER_EMPLOYEE: Employee = {
  id: 'emp_owner_1',
  name: 'Owner ARY',
  username: 'owner',
  pin: '200413',
  email: 'nasikangary@gmail.com',
  role: 'OWNER',
  position: 'Owner / Pengelola',
  dailyWage: 0,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function getBrowserDeviceId(): string {
  try {
    let devId = localStorage.getItem('ary_device_id');
    if (!devId) {
      devId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem('ary_device_id', devId);
    }
    return devId;
  } catch {
    return 'dev_default';
  }
}

function normalizeEmployeeRecord(emp: Employee): Employee {
  const isMainOwner =
    emp.id === 'emp_owner_1' ||
    emp.username?.toLowerCase() === 'owner' ||
    emp.email?.toLowerCase() === 'nasikangary@gmail.com';

  if (isMainOwner) {
    return { ...emp, role: 'OWNER' };
  }

  const rawRole = String(emp.role || '').toUpperCase();
  const posLower = String(emp.position || '').toLowerCase();

  if (rawRole === 'KASIR' || posLower.includes('kasir')) {
    return { ...emp, role: 'KASIR' };
  }
  if (rawRole === 'ADMIN' || posLower.includes('admin')) {
    return { ...emp, role: 'ADMIN' };
  }
  if (rawRole === 'KARYAWAN' || posLower.includes('dapur') || posLower.includes('produksi') || posLower.includes('koki')) {
    return { ...emp, role: 'KARYAWAN' };
  }
  if (rawRole === 'OWNER') {
    return { ...emp, role: 'OWNER' };
  }

  return { ...emp, role: 'KASIR' };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [activeCashierLock, setActiveCashierLock] = useState<ActiveCashierLock | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to active_cashier lock in real-time
  useEffect(() => {
    const lockRef = doc(db, 'system_locks', 'active_cashier');
    const unsub = onSnapshot(
      lockRef,
      (snap) => {
        if (snap.exists()) {
          setActiveCashierLock(snap.data() as ActiveCashierLock);
        } else {
          setActiveCashierLock(null);
        }
      },
      () => {
        // ignore permission/offline errors on lock listener
      }
    );
    return () => unsub();
  }, []);

  // Verify that no OTHER cashier (KASIR) is currently logged in right now.
  // OWNER is NEVER restricted and can always log in even when a cashier is logged in.
  const verifySingleCashierLock = async (employee: Employee): Promise<void> => {
    if (employee.role !== 'KASIR') {
      return;
    }

    try {
      const lockRef = doc(db, 'system_locks', 'active_cashier');
      const lockSnap = await getDoc(lockRef);
      if (lockSnap.exists()) {
        const lockData = lockSnap.data() as ActiveCashierLock;

        // If lock is not active or has no employeeId, allow login immediately
        if (!lockData.isActive || !lockData.employeeId) {
          return;
        }

        const isSameCashier =
          (Boolean(employee.id) && lockData.employeeId === employee.id) ||
          (typeof employee.username === 'string' &&
            typeof lockData.username === 'string' &&
            lockData.username.toLowerCase() === employee.username.toLowerCase());

        if (isSameCashier) {
          return;
        }

        // If the lock came from this exact browser/device and nobody is currently logged in on this browser,
        // the previous cashier session on this device has already ended -> allow login and overwrite lock.
        const currentDeviceId = getBrowserDeviceId();
        const hasLocalSession = Boolean(localStorage.getItem('ary_employee_session'));
        if (lockData.deviceId && lockData.deviceId === currentDeviceId && !hasLocalSession) {
          return;
        }

        // Verify that the locked cashier employee still exists and is active
        const otherEmpDoc = await getDoc(doc(db, 'employees', lockData.employeeId));
        if (!otherEmpDoc.exists() || (otherEmpDoc.data() as Employee).active === false) {
          return;
        }

        // Also check if the locked cashier has already logged out today (checkOutAt is recorded)
        const todayDate = new Date().toISOString().split('T')[0];
        const attQuery = query(
          collection(db, 'attendance'),
          where('employeeId', '==', lockData.employeeId),
          where('date', '==', todayDate),
          limit(1)
        );
        const attSnap = await getDocs(attQuery);
        if (!attSnap.empty) {
          const attData = attSnap.docs[0].data() as Attendance;
          if (attData.checkOutAt) {
            // If checkOutAt is after or equal to loginAt, that cashier already logged out
            if (!lockData.loginAt || attData.checkOutAt >= lockData.loginAt) {
              return;
            }
          }
        }

        throw new Error(
          `Tidak dapat login: Kasir "${lockData.employeeName || 'Lain'}" sedang aktif login saat ini. Hanya 1 kasir yang dapat login di waktu yang sama.`
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Tidak dapat login:')) {
        throw err;
      }
      console.warn('Could not check active_cashier lock:', err);
    }
  };

  // Acquire active cashier lock when a KASIR logs in (never called for OWNER)
  const acquireCashierLockIfNeeded = async (employee: Employee): Promise<void> => {
    if (employee.role !== 'KASIR') return;
    try {
      const lockPayload: ActiveCashierLock = {
        isActive: true,
        employeeId: employee.id,
        employeeName: employee.name,
        username: employee.username || '',
        deviceId: getBrowserDeviceId(),
        loginAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'system_locks', 'active_cashier'), sanitizeFirestore(lockPayload));
      setActiveCashierLock(lockPayload);
    } catch (err) {
      console.warn('Failed to acquire active_cashier lock:', err);
    }
  };

  // Release active cashier lock when a KASIR logs out
  const releaseCashierLockIfNeeded = async (employee: Employee | null): Promise<void> => {
    if (employee && employee.role !== 'KASIR') return;
    try {
      const lockRef = doc(db, 'system_locks', 'active_cashier');
      const releasedPayload: ActiveCashierLock = {
        isActive: false,
        employeeId: null,
        employeeName: null,
        username: null,
        deviceId: null,
        logoutAt: new Date().toISOString(),
      };
      await setDoc(lockRef, sanitizeFirestore(releasedPayload));
      setActiveCashierLock(releasedPayload);
    } catch (err) {
      console.warn('Failed to release active_cashier lock:', err);
    }
  };

  // Force release cashier lock (for OWNER / ADMIN emergency unlock)
  const forceReleaseCashierLock = async (): Promise<void> => {
    try {
      const lockRef = doc(db, 'system_locks', 'active_cashier');
      const releasedPayload: ActiveCashierLock = {
        isActive: false,
        employeeId: null,
        employeeName: null,
        username: null,
        deviceId: null,
        logoutAt: new Date().toISOString(),
      };
      await setDoc(lockRef, sanitizeFirestore(releasedPayload));
      setActiveCashierLock(releasedPayload);
    } catch (err) {
      console.warn('Failed to force release active_cashier lock:', err);
    }
  };

  // Remove any legacy attendance records for OWNER so Owner never has attendance
  const cleanupOwnerAttendanceIfAny = async (ownerEmployee: Employee) => {
    try {
      const q = query(
        collection(db, 'attendance'),
        where('employeeId', '==', ownerEmployee.id)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
        }
      }
    } catch {
      // ignore
    }
  };

  // Helper to record / get attendance on login (OWNER NEVER has attendance)
  const syncAttendanceCheckIn = async (employee: Employee): Promise<Attendance | null> => {
    if (employee.role === 'OWNER') {
      setTodayAttendance(null);
      await cleanupOwnerAttendanceIfAny(employee);
      return null;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    try {
      const q = query(
        collection(db, 'attendance'),
        where('employeeId', '==', employee.id),
        where('date', '==', todayDate),
        limit(1)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const existingDoc = snap.docs[0];
        const existingData = {
          ...(existingDoc.data() as Attendance),
          id: existingDoc.id,
        };
        // If employee is logging back in on the same day after previously logging out,
        // clear checkOutAt so their active attendance reflects they are currently logged in
        if (existingData.checkOutAt) {
          await updateDoc(
            existingDoc.ref,
            sanitizeFirestore({
              checkOutAt: null,
              updatedAt: nowIso,
            })
          );
          existingData.checkOutAt = undefined;
        }
        setTodayAttendance(existingData);
        return existingData;
      }

      // If no attendance record exists today, create check-in
      const attRef = doc(collection(db, 'attendance'));
      const newAttendance: Attendance = {
        id: attRef.id,
        employeeId: employee.id,
        employeeName: employee.name,
        userUid: employee.uid || employee.id,
        date: todayDate,
        checkInAt: nowIso,
        status: 'HADIR',
        wagePaid: false,
        wageAmount: employee.dailyWage || 80000,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await setDoc(attRef, sanitizeFirestore(newAttendance));
      setTodayAttendance(newAttendance);

      // Audit Log for check-in
      try {
        const auditRef = doc(collection(db, 'audit_logs'));
        await setDoc(
          auditRef,
          sanitizeFirestore({
            id: auditRef.id,
            action: 'LOGIN_ABSEN_MASUK',
            details: `${employee.name} (${employee.role}) login dan tercatat Absen Masuk pada ${new Date(nowIso).toLocaleTimeString('id-ID')}`,
            userUid: employee.uid || employee.id,
            userName: employee.name,
            createdAt: nowIso,
          })
        );
      } catch (logErr) {
        console.warn('Audit log write error:', logErr);
      }

      return newAttendance;
    } catch (err) {
      console.error('Failed to sync check-in attendance:', err);
      const fallbackAtt: Attendance = {
        id: `att_${employee.id}_${todayDate}`,
        employeeId: employee.id,
        employeeName: employee.name,
        date: todayDate,
        checkInAt: nowIso,
        status: 'HADIR',
        createdAt: nowIso,
      };
      setTodayAttendance(fallbackAtt);
      return fallbackAtt;
    }
  };

  // Helper to record attendance on logout (OWNER NEVER has attendance)
  const syncAttendanceCheckOut = async (employee: Employee | null) => {
    if (!employee || employee.role === 'OWNER') return;
    const todayDate = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    try {
      const q = query(
        collection(db, 'attendance'),
        where('employeeId', '==', employee.id),
        where('date', '==', todayDate),
        limit(1)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const docRef = snap.docs[0].ref;
        await updateDoc(
          docRef,
          sanitizeFirestore({
            checkOutAt: nowIso,
            updatedAt: nowIso,
          })
        );
      }

      // Audit Log for check-out
      try {
        const auditRef = doc(collection(db, 'audit_logs'));
        await setDoc(
          auditRef,
          sanitizeFirestore({
            id: auditRef.id,
            action: 'LOGOUT_ABSEN_PULANG',
            details: `${employee.name} logout dan tercatat Absen Pulang pada ${new Date(nowIso).toLocaleTimeString('id-ID')}`,
            userUid: employee.uid || employee.id,
            userName: employee.name,
            createdAt: nowIso,
          })
        );
      } catch (logErr) {
        console.warn('Audit log write error:', logErr);
      }
    } catch (err) {
      console.warn('Failed to sync check-out attendance:', err);
    }
  };

  // Bootstrap seed employees if empty
  const ensureDefaultEmployees = async () => {
    try {
      const snap = await getDocs(collection(db, 'employees'));
      if (snap.empty) {
        await setDoc(
          doc(db, 'employees', DEFAULT_OWNER_EMPLOYEE.id),
          sanitizeFirestore(DEFAULT_OWNER_EMPLOYEE)
        );
      } else {
        const hasOwner = snap.docs.some((d) => {
          const emp = d.data() as Employee;
          return emp.username?.toLowerCase() === 'owner' || emp.role === 'OWNER';
        });
        if (!hasOwner) {
          await setDoc(
            doc(db, 'employees', DEFAULT_OWNER_EMPLOYEE.id),
            sanitizeFirestore(DEFAULT_OWNER_EMPLOYEE)
          );
        }
      }
    } catch (err) {
      console.warn('Could not bootstrap default employees in Firestore:', err);
    }
  };

  // Restore session on initial mount
  useEffect(() => {
    let isSubscribed = true;

    const restoreSession = async () => {
      await ensureDefaultEmployees();

      const savedSession = localStorage.getItem('ary_employee_session');
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession) as Employee;
          if (parsed && parsed.id) {
            const empDoc = await getDoc(doc(db, 'employees', parsed.id));
            if (empDoc.exists()) {
              const liveEmp = normalizeEmployeeRecord({ ...(empDoc.data() as Employee), id: empDoc.id });
              if (liveEmp.active) {
                try {
                  await verifySingleCashierLock(liveEmp);
                  if (isSubscribed) {
                    setCurrentEmployee(liveEmp);
                    localStorage.setItem('ary_employee_session', JSON.stringify(liveEmp));
                    await acquireCashierLockIfNeeded(liveEmp);
                    await syncAttendanceCheckIn(liveEmp);
                  }
                } catch {
                  // Another cashier is active; clear stale session
                  localStorage.removeItem('ary_employee_session');
                  if (isSubscribed) {
                    setCurrentEmployee(null);
                  }
                }
              } else {
                localStorage.removeItem('ary_employee_session');
              }
            } else if (parsed.username === 'owner' || parsed.role === 'OWNER') {
              if (isSubscribed) {
                setCurrentEmployee(DEFAULT_OWNER_EMPLOYEE);
                setTodayAttendance(null);
                await cleanupOwnerAttendanceIfAny(DEFAULT_OWNER_EMPLOYEE);
              }
            }
          }
        } catch (e) {
          console.error('Failed to parse employee session from localStorage:', e);
          localStorage.removeItem('ary_employee_session');
        }
      } else {
        // If no saved session exists on this browser, and the lock in Firestore belongs to this browser's deviceId,
        // release the stale lock automatically so other cashiers can log in.
        try {
          const lockRef = doc(db, 'system_locks', 'active_cashier');
          const lockSnap = await getDoc(lockRef);
          if (lockSnap.exists()) {
            const lockData = lockSnap.data() as ActiveCashierLock;
            if (lockData.isActive && lockData.deviceId === getBrowserDeviceId()) {
              await forceReleaseCashierLock();
            }
          }
        } catch {
          // ignore
        }
      }

      if (isSubscribed) {
        setLoading(false);
      }
    };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!isSubscribed) return;
      setCurrentUser(user);
    });

    restoreSession();

    return () => {
      isSubscribed = false;
      unsubAuth();
    };
  }, []);

  // Login with Username/Email & PIN/Password
  const loginWithCredentials = async (
    identifier: string,
    pinOrPass: string
  ): Promise<Employee> => {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPin = pinOrPass.trim();

    if (!cleanId || !cleanPin) {
      throw new Error('Username atau PIN salah.');
    }

    let employee: Employee | null = null;

    try {
      const snap = await getDocs(collection(db, 'employees'));
      if (!snap.empty) {
        const list = snap.docs.map((d) => normalizeEmployeeRecord({ ...(d.data() as Employee), id: d.id }));
        employee =
          list.find(
            (e) =>
              (e.username && e.username.toLowerCase() === cleanId) ||
              (e.email && e.email.toLowerCase() === cleanId) ||
              (e.id && e.id.toLowerCase() === cleanId) ||
              (e.name && e.name.toLowerCase() === cleanId)
          ) || null;
      }
    } catch (e) {
      console.warn('Error fetching employees from firestore:', e);
    }

    // Fallback for default owner account
    if (!employee && (cleanId === 'owner' || cleanId === 'nasikangary@gmail.com')) {
      if (cleanPin === '200413') {
        employee = DEFAULT_OWNER_EMPLOYEE;
        try {
          await setDoc(
            doc(db, 'employees', DEFAULT_OWNER_EMPLOYEE.id),
            sanitizeFirestore(DEFAULT_OWNER_EMPLOYEE)
          );
        } catch {
          // ignore
        }
      }
    }

    if (!employee) {
      throw new Error('Username atau PIN salah.');
    }

    if (employee.pin && employee.pin !== cleanPin) {
      throw new Error('Username atau PIN salah.');
    }

    if (!employee.active) {
      throw new Error('Akun tidak aktif. Hubungi pengelola.');
    }

    // Enforce single active cashier login rule (OWNER is never blocked)
    await verifySingleCashierLock(employee);

    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
    } catch {
      // ignore
    }

    await acquireCashierLockIfNeeded(employee);
    localStorage.setItem('ary_employee_session', JSON.stringify(employee));
    setCurrentEmployee(employee);
    await syncAttendanceCheckIn(employee);

    return employee;
  };

  // Login with Google (Owner / Linked email)
  const loginWithGoogle = async (): Promise<Employee> => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const snap = await getDocs(
      query(
        collection(db, 'employees'),
        where('email', '==', (user.email || '').toLowerCase()),
        limit(1)
      )
    );

    let employee: Employee | null = null;
    if (!snap.empty) {
      employee = normalizeEmployeeRecord({ ...(snap.docs[0].data() as Employee), id: snap.docs[0].id });
    } else if (user.email?.toLowerCase() === 'nasikangary@gmail.com') {
      employee = {
        ...DEFAULT_OWNER_EMPLOYEE,
        uid: user.uid,
        email: user.email,
      };
      await setDoc(doc(db, 'employees', employee.id), sanitizeFirestore(employee));
    }

    if (!employee) {
      await signOut(auth);
      throw new Error(
        `Email ${user.email} belum terdaftar sebagai karyawan. Hubungi Owner untuk mendaftarkan akun.`
      );
    }

    if (!employee.active) {
      await signOut(auth);
      throw new Error('Akun karyawan ini sedang dinonaktifkan.');
    }

    // Enforce single active cashier login rule (OWNER is never blocked)
    await verifySingleCashierLock(employee);

    await acquireCashierLockIfNeeded(employee);
    localStorage.setItem('ary_employee_session', JSON.stringify(employee));
    setCurrentEmployee(employee);
    await syncAttendanceCheckIn(employee);

    return employee;
  };

  // Logout (Release Cashier Lock for Kasir first, Absen Pulang for non-Owner, & Clear Session)
  const logout = async (): Promise<void> => {
    let employeeToLogout = currentEmployee;
    if (!employeeToLogout) {
      try {
        const saved = localStorage.getItem('ary_employee_session');
        if (saved) {
          employeeToLogout = JSON.parse(saved) as Employee;
        }
      } catch {
        // ignore
      }
    }

    let attendanceErrorMsg: string | null = null;

    // 1. Release cashier lock FIRST while Firebase Auth is still active!
    // If a KASIR (or unknown session on this browser) logs out, release the lock immediately so other cashiers can log in.
    if (!employeeToLogout || employeeToLogout.role === 'KASIR') {
      await releaseCashierLockIfNeeded(employeeToLogout);
    }

    // 2. Perform attendance check-out for non-OWNER employees while still authenticated
    if (employeeToLogout && employeeToLogout.role !== 'OWNER') {
      try {
        await syncAttendanceCheckOut(employeeToLogout);
      } catch (err) {
        console.error('Absen pulang sync error during logout:', err);
        attendanceErrorMsg =
          err instanceof Error
            ? err.message
            : 'Gagal menyinkronkan data Absen Pulang ke server.';
      }
    }

    // 3. Clear session storage and local storage
    try {
      localStorage.removeItem('ary_employee_session');
      localStorage.removeItem('ary_active_staff_id');
      localStorage.removeItem('ary_active_staff_name');
      localStorage.removeItem('ary_active_shift_id');
      sessionStorage.clear();
    } catch (storageErr) {
      console.warn('Storage clear error:', storageErr);
    }

    // 4. Reset React state so UI renders LoginView
    setCurrentEmployee(null);
    setCurrentUser(null);
    setTodayAttendance(null);

    // 5. Perform Firebase Auth signOut
    try {
      await signOut(auth);
    } catch (signOutErr) {
      console.warn('Firebase Auth signOut error:', signOutErr);
    }

    // 6. Notify if attendance check-out failed
    if (attendanceErrorMsg) {
      alert(
        `Catatan: Sesi telah keluar. Terdapat kendala saat sinkronisasi Absen Pulang (${attendanceErrorMsg}).`
      );
    }
  };

  const refreshAttendance = useCallback(async () => {
    if (currentEmployee && currentEmployee.role !== 'OWNER') {
      await syncAttendanceCheckIn(currentEmployee);
    } else {
      setTodayAttendance(null);
    }
  }, [currentEmployee]);

  const normalizedCurrentEmployee = currentEmployee ? normalizeEmployeeRecord(currentEmployee) : null;
  const currentRole: UserRole = normalizedCurrentEmployee ? normalizedCurrentEmployee.role : 'KARYAWAN';

  const userProfile: UserProfile | null = normalizedCurrentEmployee
    ? {
        uid: normalizedCurrentEmployee.uid || normalizedCurrentEmployee.id,
        email: normalizedCurrentEmployee.email || '',
        displayName: normalizedCurrentEmployee.name,
        role: normalizedCurrentEmployee.role,
        active: normalizedCurrentEmployee.active,
        createdAt: normalizedCurrentEmployee.createdAt,
      }
    : null;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentEmployee,
        userProfile,
        currentRole,
        todayAttendance,
        activeCashierLock,
        loading,
        loginWithCredentials,
        loginWithGoogle,
        logout,
        refreshAttendance,
        forceReleaseCashierLock,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
