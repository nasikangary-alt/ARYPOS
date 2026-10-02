import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { AyamLogo } from './AyamLogo';
import { CloseCashierModal } from '../cash/CloseCashierModal';
import { PWAInstallButton } from './PWAInstallButton';
import {
  UserCheck,
  LogOut,
  X,
  User,
  Shield,
  Clock,
  ChevronRight,
  Smartphone,
  Monitor,
  AlertTriangle,
} from 'lucide-react';

interface MobileHeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  deviceMode?: 'desktop' | 'mobile';
  setDeviceMode?: (mode: 'desktop' | 'mobile') => void;
}

const TAB_TITLES: Record<string, string> = {
  beranda: 'Beranda',
  kasir: 'Kasir POS',
  pesanan: 'Riwayat Pesanan',
  produksi: 'Produksi & Resep',
  stok: 'Stok Bahan',
  menu: 'Katalog Menu',
  perakitan: 'Komposisi Menu',
  resep: 'Produksi & Resep',
  pembelian: 'Pembelian',
  vendor: 'Vendor',
  kas_saldo: 'Kas & Rekening',
  pengeluaran: 'Pengeluaran',
  karyawan: 'Karyawan & Absensi',
  laporan_lengkap: 'Laporan',
  audit: 'Audit Log',
  lainnya: 'Menu Lainnya',
};

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  activeTab,
  setActiveTab,
  deviceMode = 'mobile',
  setDeviceMode,
}) => {
  const { currentEmployee, currentRole, todayAttendance, logout } = useAuth();
  const { shifts, sales, cartCount, closeShift } = useApp();

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCloseKasirModal, setShowCloseKasirModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const activeShift = React.useMemo(() => {
    if (!currentEmployee) return undefined;
    return shifts.find(
      (s) =>
        s.status === 'OPEN' &&
        Boolean(s.staffId) &&
        ((Boolean(currentEmployee.id) && s.staffId === currentEmployee.id) ||
          (Boolean(currentEmployee.uid) && s.staffId === currentEmployee.uid) ||
          (Boolean(currentEmployee.username) && s.staffId === currentEmployee.username))
    );
  }, [shifts, currentEmployee]);

  const checkInTimeStr = todayAttendance?.checkInAt
    ? new Date(todayAttendance.checkInAt).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const title = TAB_TITLES[activeTab] || 'Ayam Geprek ARY';

  // Regular logout for OWNER / ADMIN / KARYAWAN
  const handleLogoutWithConfirm = async () => {
    if (isLoggingOut) return;
    const confirmed = confirm('Yakin ingin keluar dari sesi?');
    if (!confirmed) return;

    setIsLoggingOut(true);
    try {
      await logout();
      setShowProfileModal(false);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Execution when Tutup Kasir is confirmed for KASIR
  const handleExecuteCloseShiftAndLogout = async (
    actualCash?: number,
    notes?: string,
    closingDetails?: {
      expectedCash: number;
      cashDifference: number;
      closingDenominations: Record<string, number>;
    }
  ) => {
    sessionStorage.setItem('ary_closing_shift', '1');
    try {
      if (activeShift) {
        if (typeof actualCash !== 'number' || Number.isNaN(actualCash)) {
          sessionStorage.removeItem('ary_closing_shift');
          throw new Error('Jumlah uang fisik belum dihitung.');
        }
        await closeShift(
          activeShift.id,
          actualCash,
          notes || 'Tutup kasir dari header mobile',
          closingDetails
        );
      }
      await logout();
      setShowCloseKasirModal(false);
      setShowProfileModal(false);
    } catch (err) {
      sessionStorage.removeItem('ary_closing_shift');
      throw err;
    }
  };

  const handleHeaderAction = () => {
    if (currentRole === 'KASIR') {
      setShowCloseKasirModal(true);
    } else {
      handleLogoutWithConfirm();
    }
  };

  if (activeTab === 'kasir') {
    return null;
  }

  return (
    <>
      {currentRole === 'KASIR' ? (
        <header className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] px-4 py-2.5 shadow-[0_1px_2px_rgba(23,32,51,0.03)] flex items-center justify-between gap-2">
          {/* Left: Brand + Cashier Name & Role */}
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
          >
            <AyamLogo size="sm" />
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-[#FF641F] tracking-wide uppercase leading-none">
                AYAM GEPREK ARY
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-[14px] font-extrabold text-[#172033] truncate leading-tight">
                  {currentEmployee?.name || 'Kasir'}
                </span>
                <span className="text-[11px] font-medium text-[#667085] leading-tight">
                  Kasir
                </span>
              </div>
            </div>
          </button>

          {/* Right: [ 🟢 Shift Aktif ]  [ Tutup Kasir ] */}
          <div className="flex items-center gap-1.5 shrink-0">
            <PWAInstallButton variant="header" />
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#ECFDF3] border border-[#A6F4C5] text-[#027A48] text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-[#12B76A]" />
              <span>Shift Aktif</span>
            </div>

            <button
              type="button"
              disabled={isLoggingOut}
              onClick={handleHeaderAction}
              className="px-2.5 py-1.5 rounded-xl text-[#172033] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E5E7EB] active:scale-95 transition flex items-center gap-1 text-[11px] font-bold cursor-pointer disabled:opacity-50"
              title="Tutup Kasir"
            >
              <span>Tutup Kasir</span>
            </button>
          </div>
        </header>
      ) : (
        <header className="sticky top-0 z-30 bg-white border-b border-[#E8ECF2] px-3 sm:px-4 py-2 sm:py-2.5 shadow-[0_1px_3px_rgba(23,32,51,0.03)] flex items-center justify-between gap-2">
          {/* Left: Logo & Current Page Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <AyamLogo size="sm" />
            <div className="min-w-0">
              <h1 className="text-xs font-extrabold text-[#172033] tracking-tight truncate leading-tight">
                {title}
              </h1>
              <p className="text-[10px] text-[#667085] truncate leading-tight font-medium">
                Ayam Geprek ARY
              </p>
            </div>
          </div>

          {/* Right: PWA Install + Logged in Employee Pill & Logout/Tutup Kasir Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            <PWAInstallButton variant="header" />
            {currentEmployee && (
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#F1F5F9] active:scale-95 transition cursor-pointer"
                title="Lihat Profil & Absen Karyawan"
              >
                <div className="relative shrink-0">
                  <div className="w-6 h-6 rounded-lg bg-[#FF641F]/10 border border-[#FF641F]/30 text-[#FF641F] flex items-center justify-center font-black text-[11px]">
                    {currentEmployee.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#12B76A] ring-1 ring-white" />
                </div>

                <div className="text-left hidden sm:block max-w-[70px]">
                  <span className="text-[10px] font-bold text-[#172033] block truncate leading-tight">
                    {currentEmployee.name}
                  </span>
                  <span className="text-[8px] font-bold text-[#FF641F] block uppercase leading-none">
                    {currentRole}
                  </span>
                </div>
              </button>
            )}

            {/* Action Button: "Tutup Kasir" for KASIR role, "Keluar Sesi" for others */}
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={handleHeaderAction}
              className="px-2.5 py-1.5 rounded-xl text-[#F04438] bg-[#FEF3F2] hover:bg-[#FEE4E2] border border-[#FECDCA] active:scale-95 transition flex items-center gap-1 text-[11px] font-extrabold cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              title="Keluar Sesi"
            >
              <LogOut className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden min-[380px]:inline">Keluar Sesi</span>
              <span className="inline min-[380px]:hidden">Keluar</span>
            </button>
          </div>
        </header>
      )}

      {/* User Profile & Session Sheet/Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-[#E8ECF2] space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E8ECF2]">
              <div className="flex items-center gap-2 text-[#172033]">
                <UserCheck className="w-5 h-5 text-[#12B76A]" />
                <h3 className="font-bold text-sm">Akun & Sesi Login Mobile</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="p-1 rounded-full text-[#98A2B3] hover:text-[#172033]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Employee Card Info */}
            <div className="p-4 bg-gradient-to-br from-[#FFF6F0] to-[#F7F8FA] rounded-2xl border border-[#FF641F]/20 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#FF641F] text-white flex items-center justify-center font-black text-lg shadow-md shadow-[#FF641F]/20 shrink-0">
                  {currentEmployee?.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-extrabold text-sm text-[#172033] truncate">
                      {currentEmployee?.name}
                    </h4>
                    <span className="px-2 py-0.5 rounded-lg bg-[#FF641F] text-white text-[10px] font-black uppercase">
                      {currentRole}
                    </span>
                  </div>
                  <p className="text-xs text-[#667085] font-medium truncate mt-0.5">
                    {currentEmployee?.position || 'Staf Operasional'} &bull; @{currentEmployee?.username || 'user'}
                  </p>
                </div>
              </div>

              {/* Attendance Pill Status (Only for non-OWNER) */}
              {currentRole !== 'OWNER' ? (
                <div className="pt-2 border-t border-[#FF641F]/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[#12B76A] font-bold">
                    <span className="w-2 h-2 rounded-full bg-[#12B76A] animate-pulse" />
                    <span>Status: HADIR (Aktif)</span>
                  </div>
                  {checkInTimeStr && (
                    <div className="flex items-center gap-1 text-[#667085] text-[11px] font-medium">
                      <Clock className="w-3 h-3 text-[#FF641F]" />
                      <span>Masuk {checkInTimeStr}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="pt-2 border-t border-[#FF641F]/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[#12B76A] font-bold">
                    <span className="w-2 h-2 rounded-full bg-[#12B76A]" />
                    <span>Akses Pemilik Toko (Tanpa Absen)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={handleHeaderAction}
                className="w-full py-3 rounded-2xl bg-[#F04438] hover:bg-[#D92D20] text-white font-bold text-xs shadow-md shadow-[#F04438]/20 transition flex items-center justify-center gap-2 active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut className="w-4 h-4" />
                <span>{currentRole === 'KASIR' ? 'Tutup Kasir' : 'Keluar Sesi'}</span>
              </button>

              {currentRole !== 'KASIR' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileModal(false);
                    setActiveTab('karyawan');
                  }}
                  className="w-full py-2.5 rounded-2xl bg-[#F1F4F8] hover:bg-[#E8ECF2] text-[#172033] font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Shield className="w-4 h-4 text-[#FF641F]" />
                  <span>Lihat Data &amp; Rekap Absensi</span>
                </button>
              )}
            </div>

            {/* Close */}
            <button
              type="button"
              onClick={() => setShowProfileModal(false)}
              className="w-full py-2 text-center text-xs font-semibold text-[#667085] hover:text-[#172033]"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Tutup Kasir Confirmation Modal */}
      <CloseCashierModal
        isOpen={showCloseKasirModal}
        onClose={() => setShowCloseKasirModal(false)}
        cartCount={cartCount}
        activeShift={activeShift}
        sales={sales}
        onExecuteCloseShiftAndLogout={handleExecuteCloseShiftAndLogout}
      />
    </>
  );
};
