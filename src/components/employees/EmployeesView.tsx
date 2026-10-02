import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Employee, UserRole, AttendanceStatus } from '../../types';
import {
  formatRupiah,
  formatNumber,
  formatNumberInput,
  parseNumberInput,
  formatDateTimeIndonesian,
} from '../../utils/formatters';
import { PageContainer } from '../common/PageContainer';
import { PageHeader } from '../common/PageHeader';
import {
  Users,
  Plus,
  Key,
  X,
  Lock,
  ClipboardList,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Shield,
  ToggleLeft,
  ToggleRight,
  Edit2,
  UserCheck,
  UserX,
  Smartphone,
  Check,
  Briefcase,
  Calendar,
} from 'lucide-react';

export const EmployeesView: React.FC = () => {
  const {
    employees,
    attendance,
    shifts,
    addEmployee,
    updateEmployee,
    toggleEmployeeStatus,
    deleteEmployee,
    recordAttendance,
  } = useApp();
  const { currentEmployee, currentRole, activeCashierLock, forceReleaseCashierLock } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'employees' | 'attendance' | 'shifts'>('employees');

  // Form Modal States
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('KASIR');
  const [formPosition, setFormPosition] = useState('Kasir');
  const [formWage, setFormWage] = useState(80000);
  const [formPhone, setFormPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');

  const isOwnerOrAdmin = currentRole === 'OWNER' || currentRole === 'ADMIN';

  const handleOpenAddModal = () => {
    if (!isOwnerOrAdmin) {
      alert('Hanya OWNER atau ADMIN yang berwenang menambah data karyawan.');
      return;
    }
    setEditingEmployee(null);
    setFormName('');
    setFormUsername('');
    setFormPin('');
    setFormRole('KASIR');
    setFormPosition('Kasir');
    setFormWage(80000);
    setFormPhone('');
    setFormError(null);
    setShowEmployeeModal(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    if (!isOwnerOrAdmin) {
      alert('Hanya OWNER atau ADMIN yang berwenang mengubah data karyawan.');
      return;
    }
    setEditingEmployee(emp);
    setFormName(emp.name);
    setFormUsername(emp.username || '');
    setFormPin(emp.pin || '');
    setFormRole(emp.role || 'KARYAWAN');
    setFormPosition(emp.position || 'Kasir');
    setFormWage(emp.dailyWage || 80000);
    setFormPhone(emp.phone || '');
    setFormError(null);
    setShowEmployeeModal(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Nama lengkap karyawan wajib diisi.');
      return;
    }

    const cleanUsername = formUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername) {
      const duplicate = employees.find(
        e => e.id !== editingEmployee?.id && e.username?.toLowerCase() === cleanUsername
      );
      if (duplicate) {
        setFormError(`Username '@${cleanUsername}' sudah digunakan oleh karyawan lain.`);
        return;
      }
    }

    if (formPin.trim() && formPin.trim().length < 4) {
      setFormError('PIN keamanan harus minimal 4 digit angka.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, {
          name: formName.trim(),
          username: cleanUsername || undefined,
          pin: formPin.trim() || undefined,
          role: formRole,
          position: formPosition.trim(),
          dailyWage: formWage,
          phone: formPhone.trim() || undefined,
        });
        alert('Data karyawan berhasil diperbarui!');
      } else {
        await addEmployee({
          name: formName.trim(),
          username: cleanUsername || undefined,
          pin: formPin.trim() || undefined,
          role: formRole,
          position: formPosition.trim(),
          dailyWage: formWage,
          phone: formPhone.trim() || undefined,
          active: true,
        });
        alert('Karyawan baru berhasil didaftarkan!');
      }
      setShowEmployeeModal(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan data karyawan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (emp: Employee) => {
    if (!isOwnerOrAdmin) {
      alert('Hanya OWNER atau ADMIN yang berwenang mengubah status karyawan.');
      return;
    }
    if (emp.role === 'OWNER' || emp.username === 'owner') {
      alert('Akun Owner utama tidak dapat dinonaktifkan.');
      return;
    }
    const newStatus = !emp.active;
    const msg = newStatus
      ? `Aktifkan akun ${emp.name}? Karyawan akan bisa login kembali.`
      : `Nonaktifkan akun ${emp.name}? Karyawan tidak akan bisa login ke sistem.`;
    if (confirm(msg)) {
      await toggleEmployeeStatus(emp.id, newStatus);
    }
  };

  const handleRecordManualAttendance = async (
    emp: Employee,
    status: AttendanceStatus,
    overtimeHours = 0
  ) => {
    try {
      await recordAttendance(emp.id, emp.name, status, overtimeHours);
    } catch (err) {
      console.warn('Attendance sync error:', err);
    }
  };

  // Today's attendance list
  const todayDate = new Date().toISOString().split('T')[0];
  const todayAttendanceList = attendance.filter(a => a.date === todayDate);

  // Map employee ID to today's attendance record
  const employeeAttendanceMap = new Map<string, typeof attendance[0]>();
  todayAttendanceList.forEach(a => {
    employeeAttendanceMap.set(a.employeeId, a);
  });

  // Employees eligible for attendance (OWNER does NOT have attendance)
  const attendanceEligibleEmployees = employees.filter(
    e => e.active !== false && e.role !== 'OWNER'
  );

  // Calculate estimated daily payroll (excluding OWNER)
  const totalPayrollToday = attendanceEligibleEmployees.reduce((acc, emp) => {
    const att = employeeAttendanceMap.get(emp.id);
    if (!att) return acc;
    if (att.status === 'HADIR' || att.status === 'PRESENT') {
      return acc + (emp.dailyWage || 80000);
    }
    if (att.status === 'OVERTIME' || att.status === 'LEMBUR') {
      const overtimePay = (att.overtimeHours || 0) * (((emp.dailyWage || 80000) / 8) * 1.5);
      return acc + (emp.dailyWage || 80000) + Math.round(overtimePay);
    }
    return acc;
  }, 0);

  const activeEmployeesCount = attendanceEligibleEmployees.length;
  const attendedCount = attendanceEligibleEmployees.filter(emp => {
    const a = employeeAttendanceMap.get(emp.id);
    return (
      a &&
      (a.status === 'HADIR' ||
        a.status === 'PRESENT' ||
        a.status === 'LEMBUR' ||
        a.status === 'OVERTIME')
    );
  }).length;

  const filteredEmployees = employees.filter(e => {
    const q = searchTerm.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      (e.username && e.username.toLowerCase().includes(q)) ||
      (e.position && e.position.toLowerCase().includes(q)) ||
      e.role.toLowerCase().includes(q)
    );
  });

  return (
    <PageContainer className="pb-28 lg:pb-8">
      {/* PageHeader & Sub-tab navigation */}
      <PageHeader
        title="Karyawan & Absensi"
        description="1 Karyawan = 1 Akun Login = 1 Data Absensi (Login = Absen Masuk, Logout = Absen Pulang)."
        actions={
          <div className="flex items-center gap-1.5 bg-[#F1F4F8] p-1 rounded-xl border border-[#E5E7EB]">
            <button
              onClick={() => setActiveSubTab('employees')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'employees'
                  ? 'bg-white text-[#FF5A1F] shadow-2xs'
                  : 'text-[#667085] hover:text-[#172033]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Data Karyawan &amp; Akun</span>
            </button>
            <button
              onClick={() => setActiveSubTab('attendance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'attendance'
                  ? 'bg-white text-[#FF5A1F] shadow-2xs'
                  : 'text-[#667085] hover:text-[#172033]'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Presensi Hari Ini ({attendedCount}/{activeEmployeesCount})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('shifts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'shifts'
                  ? 'bg-white text-[#FF5A1F] shadow-2xs'
                  : 'text-[#667085] hover:text-[#172033]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Riwayat Shift Kasir</span>
            </button>
          </div>
        }
      />

      {/* ========================================== */}
      {/* SUB-TAB 1: DATA KARYAWAN & AKUN LOGIN      */}
      {/* ========================================== */}
      {activeSubTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Cari karyawan, username, atau posisi..."
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:border-orange-600 outline-none shadow-2xs"
              />
            </div>

            {isOwnerOrAdmin && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Karyawan &amp; Akun</span>
              </button>
            )}
          </div>

          {/* Info Banner */}
          <div className="p-3.5 rounded-2xl bg-orange-50/80 border border-orange-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Shield className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
              <div className="text-xs text-orange-900 space-y-1">
                <span className="font-bold">Aturan Login Kasir &amp; Owner:</span>
                <p className="leading-relaxed">
                  <strong>Kasir hanya 1 orang</strong> yang dapat login di waktu yang sama (kasir lain tidak dapat login selama kasir aktif belum tutup kasir). <strong>Owner tidak memiliki absensi</strong> dan dapat login kapan saja meski kasir sedang login.
                </p>
              </div>
            </div>

            {isOwnerOrAdmin && activeCashierLock?.isActive && (
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-orange-200 shrink-0">
                <div className="text-[11px]">
                  <span className="text-slate-400 font-semibold block">Kasir Sedang Login:</span>
                  <span className="font-extrabold text-emerald-700">
                    {activeCashierLock.employeeName || 'Kasir Aktif'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      confirm(
                        `Lepas kunci sesi login untuk kasir "${activeCashierLock.employeeName}"? Gunakan ini jika perangkat kasir tertutup paksa agar kasir lain bisa login.`
                      )
                    ) {
                      await forceReleaseCashierLock();
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold transition cursor-pointer"
                >
                  Reset Kunci Kasir
                </button>
              </div>
            )}
          </div>

          {/* Employees List Grid */}
          {filteredEmployees.length === 0 ? (
            <div className="bg-white border border-[#E8ECF2] rounded-3xl p-12 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30 text-orange-600" />
              <p className="text-xs font-bold text-slate-700">Tidak ada data karyawan yang cocok.</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {searchTerm ? 'Coba ubah kata kunci pencarian.' : 'Mulai dengan menambahkan karyawan pertama.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEmployees.map(emp => {
                const isCurrentlyActive = emp.active !== false;
                const attToday = employeeAttendanceMap.get(emp.id);

                return (
                  <div
                    key={emp.id}
                    className={`bg-white rounded-3xl border p-4 shadow-2xs space-y-3.5 transition flex flex-col justify-between ${
                      isCurrentlyActive
                        ? 'border-slate-200 hover:border-orange-500/40'
                        : 'border-slate-200/70 bg-slate-50/60 opacity-60'
                    }`}
                  >
                    <div>
                      {/* Top Row: Avatar, Name, Role Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-2xl font-black text-sm flex items-center justify-center shrink-0 ${
                              emp.role === 'OWNER'
                                ? 'bg-rose-100 text-rose-700'
                                : emp.role === 'ADMIN'
                                ? 'bg-blue-100 text-blue-700'
                                : emp.role === 'KASIR'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}
                          >
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-extrabold text-sm text-slate-900 truncate">
                              {emp.name}
                            </h3>
                            <span className="text-[11px] text-slate-500 font-semibold block truncate">
                              @{emp.username || 'tanpa-username'} &bull; {emp.position || 'Karyawan'}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase shrink-0 ${
                            emp.role === 'OWNER'
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : emp.role === 'ADMIN'
                              ? 'bg-blue-100 text-blue-700 border border-blue-200'
                              : emp.role === 'KASIR'
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-purple-100 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {emp.role}
                        </span>
                      </div>

                      {/* Detail Metrics */}
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold block">
                            {emp.role === 'OWNER' ? 'Tipe Akun' : 'Upah Harian'}
                          </span>
                          <span className="font-extrabold text-slate-800">
                            {emp.role === 'OWNER'
                              ? 'Pemilik Toko'
                              : formatRupiah(emp.dailyWage || 80000)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold block">
                            PIN Login
                          </span>
                          <span className="font-extrabold text-slate-800 tracking-wider">
                            {emp.pin ? '••••' : 'Belum diset'}
                          </span>
                        </div>
                      </div>

                      {/* Phone & Status indicator */}
                      {emp.phone && (
                        <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                          <Smartphone className="w-3 h-3 text-slate-400" />
                          <span>{emp.phone}</span>
                        </div>
                      )}

                      {/* Today's live attendance indicator (Excluded for OWNER) */}
                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 font-bold">
                          {emp.role === 'OWNER' ? 'Status Akses:' : 'Status Absen Hari Ini:'}
                        </span>
                        {emp.role === 'OWNER' ? (
                          <span className="font-bold text-rose-600 flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            <span>Tanpa Absen &bull; Bebas Login</span>
                          </span>
                        ) : attToday ? (
                          <span className="font-bold text-emerald-600 flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            <span>
                              {attToday.status} (
                              {new Date(attToday.checkInAt).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              )
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold flex items-center gap-1">
                            <UserX className="w-3 h-3" />
                            <span>Belum Absen Masuk</span>
                          </span>
                        )}
                      </div>

                      {/* Active Cashier Lock Indicator */}
                      {emp.role === 'KASIR' &&
                        activeCashierLock?.isActive &&
                        activeCashierLock.employeeId === emp.id && (
                          <div className="mt-2 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700 flex items-center justify-between">
                            <span>● Sedang Aktif Login Kasir</span>
                            <span>1 Kasir Aktif</span>
                          </div>
                        )}
                    </div>

                    {/* Action Buttons: Edit, Toggle Active */}
                    {isOwnerOrAdmin && (
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(emp)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit Akun</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400">
                            {isCurrentlyActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(emp)}
                            className="transition"
                            title={isCurrentlyActive ? 'Nonaktifkan Karyawan' : 'Aktifkan Karyawan'}
                          >
                            {isCurrentlyActive ? (
                              <ToggleRight className="w-6 h-6 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="w-6 h-6 text-slate-400" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* SUB-TAB 2: PRESENSI & ABSENSI HARI INI     */}
      {/* ========================================== */}
      {activeSubTab === 'attendance' && (
        <div className="space-y-4">
          {/* Daily Payroll Estimation Banner */}
          <div className="p-4 rounded-3xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                Estimasi Beban Gaji Karyawan Hari Ini ({new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })})
              </span>
              <span className="text-xl font-black text-white mt-0.5 block">
                {formatRupiah(totalPayrollToday)}
              </span>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-xs text-emerald-400 font-bold block">
                {attendedCount} dari {activeEmployeesCount} Karyawan Masuk Kerja
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">
                Absensi tercatat otomatis khusus Karyawan &amp; Kasir (Owner tanpa absen)
              </span>
            </div>
          </div>

          {/* Attendance Cards List (Excludes OWNER) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attendanceEligibleEmployees.map(emp => {
              const att = employeeAttendanceMap.get(emp.id);
              const isPresent = Boolean(att);
              const checkInTime = att?.checkInAt
                ? new Date(att.checkInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                : null;
              const checkOutTime = att?.checkOutAt
                ? new Date(att.checkOutAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                : null;

              return (
                <div
                  key={emp.id}
                  className="bg-white rounded-3xl border border-slate-200 p-4 shadow-2xs space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 font-black text-sm flex items-center justify-center shrink-0">
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm text-slate-900">
                          {emp.name}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          {emp.position || emp.role}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-semibold">Upah Harian</span>
                      <span className="font-extrabold text-xs text-slate-800">
                        {formatRupiah(emp.dailyWage || 80000)}
                      </span>
                    </div>
                  </div>

                  {/* Check In / Check Out Status Bar */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-semibold text-[11px]">Absen Masuk:</span>
                      <span className={`font-bold ${checkInTime ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {checkInTime ? `✓ ${checkInTime} WIB` : 'Belum Login'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-semibold text-[11px]">Absen Pulang:</span>
                      <span className={`font-bold ${checkOutTime ? 'text-blue-700' : 'text-slate-400'}`}>
                        {checkOutTime ? `✓ ${checkOutTime} WIB` : isPresent ? 'Sedang Bertugas' : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Manual Status Buttons (Owner/Admin only) */}
                  {isOwnerOrAdmin && (
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 block">
                        Sesuaikan Status Presensi:
                      </span>
                      <div className="grid grid-cols-4 gap-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() => handleRecordManualAttendance(emp, 'HADIR')}
                          className={`py-1.5 rounded-xl font-bold transition cursor-pointer ${
                            att?.status === 'HADIR' || att?.status === 'PRESENT'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Hadir
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRecordManualAttendance(emp, 'LEMBUR', 2)}
                          className={`py-1.5 rounded-xl font-bold transition cursor-pointer ${
                            att?.status === 'LEMBUR' || att?.status === 'OVERTIME'
                              ? 'bg-purple-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          +Lembur
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRecordManualAttendance(emp, 'IZIN')}
                          className={`py-1.5 rounded-xl font-bold transition cursor-pointer ${
                            att?.status === 'IZIN'
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Izin
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRecordManualAttendance(emp, 'SAKIT')}
                          className={`py-1.5 rounded-xl font-bold transition cursor-pointer ${
                            att?.status === 'SAKIT'
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Sakit
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* SUB-TAB 3: RIWAYAT SHIFT KASIR             */}
      {/* ========================================== */}
      {activeSubTab === 'shifts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#667085] uppercase tracking-wider">
              RIWAYAT TUTUP SHIFT KASIR (REKONSILIASI UANG LACI)
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-800 space-y-1">
              <span className="font-bold">Verifikasi Uang Fisik vs Sistem:</span>
              <p className="leading-relaxed">
                Saat kasir menutup shift, sistem menghitung total penjualan kasir ditambah modal awal laci. Kasir wajib menghitung uang fisik secara manual. Selisih (Surplus / Minus) tercatat secara transparan di bawah.
              </p>
            </div>
          </div>

          {/* Shifts table/list */}
          {shifts.length === 0 ? (
            <div className="bg-white border border-[#E8ECF2] rounded-3xl p-12 text-center text-slate-400">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30 text-orange-600" />
              <p className="text-xs font-bold">Belum ada riwayat shift yang tercatat.</p>
              <p className="text-[10px] mt-0.5">Buka dan tutup shift dari halaman Kasir POS untuk mulai merekam.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {shifts.map(sh => {
                const diff = sh.cashDifference ?? 0;
                const isClosed = sh.status === 'CLOSED';

                return (
                  <div
                    key={sh.id}
                    className="bg-white rounded-3xl border border-slate-200 p-4 shadow-2xs space-y-3.5"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs text-slate-900">
                            {sh.staffName}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                              isClosed
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-emerald-100 text-emerald-700 animate-pulse'
                            }`}
                          >
                            Shift {sh.status}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Buka: {formatDateTimeIndonesian(sh.openedAt)}
                          {sh.closedAt && ` • Tutup: ${formatDateTimeIndonesian(sh.closedAt)}`}
                        </span>
                      </div>

                      {isClosed ? (
                        <div className="flex items-center gap-1.5 self-start sm:self-auto">
                          <span className="text-[10px] font-bold text-slate-400">Selisih Uang:</span>
                          <span
                            className={`px-2.5 py-1 rounded-xl text-xs font-extrabold ${
                              diff === 0
                                ? 'bg-slate-100 text-slate-700'
                                : diff > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {diff === 0
                              ? '✓ Sesuai (Balance)'
                              : diff > 0
                              ? `+${formatRupiah(diff)} (Kelebihan)`
                              : `${formatRupiah(diff)} (Kekurangan)`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 animate-pulse">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Shift Sedang Berjalan di POS</span>
                        </span>
                      )}
                    </div>

                    {/* Breakdown Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-semibold block">Modal Awal</span>
                        <span className="font-extrabold text-slate-900">{formatRupiah(sh.openingCash)}</span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-semibold block">Penjualan Cash</span>
                        <span className="font-extrabold text-slate-900">{formatRupiah(sh.totalSalesCash ?? 0)}</span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-semibold block">Kas Seharusnya</span>
                        <span className="font-extrabold text-slate-900">
                          {isClosed ? formatRupiah(sh.expectedCash ?? 0) : 'Dihitung saat tutup'}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-semibold block">Kas Fisik (Dihitung)</span>
                        <span className="font-extrabold text-orange-600">
                          {isClosed ? formatRupiah(sh.actualCash ?? 0) : 'Dihitung saat tutup'}
                        </span>
                      </div>
                    </div>

                    {/* Digital / QRIS breakdown */}
                    {isClosed && ((sh.totalSalesQris ?? 0) > 0 || (sh.totalSalesTransfer ?? 0) > 0) && (
                      <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100/50 text-xs flex gap-4">
                        {sh.totalSalesQris && sh.totalSalesQris > 0 ? (
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block">QRIS</span>
                            <span className="font-extrabold text-slate-800">{formatRupiah(sh.totalSalesQris)}</span>
                          </div>
                        ) : null}
                        {sh.totalSalesTransfer && sh.totalSalesTransfer > 0 ? (
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block">Transfer Bank</span>
                            <span className="font-extrabold text-slate-800">{formatRupiah(sh.totalSalesTransfer)}</span>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Closing notes */}
                    {sh.notes && (
                      <div className="p-2.5 rounded-2xl bg-amber-50/50 border border-amber-100 text-[11px] text-amber-800 leading-relaxed">
                        <span className="font-bold">Catatan Penutupan:</span> {sh.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: ADD / EDIT EMPLOYEE & LOGIN ACCOUNT */}
      {/* ========================================== */}
      {showEmployeeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  {editingEmployee ? 'Edit Data Karyawan & Akun' : 'Daftarkan Karyawan & Akun Baru'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Satu akun karyawan untuk login kasir, admin, dan presensi otomatis
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEmployeeModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEmployee} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nama Lengkap Karyawan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold focus:border-orange-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Username Login <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={e => setFormUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="budikasir"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold focus:border-orange-600 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    PIN Keamanan (4-6 digit) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={formPin}
                    onChange={e => setFormPin(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="1234"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold tracking-widest focus:border-orange-600 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Hak Akses Peran (Role)
                  </label>
                  <select
                    value={formRole}
                    onChange={e => {
                      const newRole = e.target.value as UserRole;
                      setFormRole(newRole);
                      if (newRole === 'KASIR') setFormPosition('Kasir');
                      else if (newRole === 'ADMIN') setFormPosition('Admin Outlet');
                      else if (newRole === 'OWNER') setFormPosition('Owner / Pengelola');
                      else setFormPosition('Karyawan Dapur');
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:border-orange-600 outline-none"
                  >
                    <option value="KASIR">KASIR (Kasir POS)</option>
                    <option value="KARYAWAN">KARYAWAN (Dapur &amp; Produksi)</option>
                    <option value="ADMIN">ADMIN (Operasional Lengkap)</option>
                    <option value="OWNER">OWNER (Akses Pemilik Toko)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Posisi / Jabatan
                  </label>
                  <input
                    type="text"
                    value={formPosition}
                    onChange={e => setFormPosition(e.target.value)}
                    placeholder="Contoh: Kasir, Koki"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:border-orange-600 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {formRole !== 'OWNER' ? (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Upah Harian (Rp)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={formatNumberInput(formWage)}
                      onChange={e => setFormWage(parseNumberInput(e.target.value))}
                      placeholder="80.000"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold focus:border-orange-600 outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Absensi &amp; Upah
                    </label>
                    <div className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500">
                      Tanpa Absen (Owner)
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    No. WhatsApp / HP
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="08123456789"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:border-orange-600 outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEmployeeModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-500/20 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : editingEmployee ? 'Perbarui Karyawan' : 'Simpan Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
