import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { AyamLogo } from './AyamLogo';
import { CloseCashierModal } from '../cash/CloseCashierModal';
import { PWAInstallButton } from './PWAInstallButton';
import {
  Home,
  ShoppingBag,
  Receipt,
  Factory,
  Boxes,
  UtensilsCrossed,
  Wallet2,
  TrendingDown,
  BarChart3,
  Users,
  ShieldCheck,
  Settings,
  Smartphone,
  Monitor,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
  Building2,
  Layers,
  ChefHat,
  UserCheck,
  Tag,
  Percent,
} from 'lucide-react';
import { isTabAllowedForRole } from '../../utils/permissions';

interface DesktopSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  deviceMode: 'desktop' | 'mobile';
  setDeviceMode: (mode: 'desktop' | 'mobile') => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  setActiveTab,
  deviceMode,
  setDeviceMode,
}) => {
  const { currentEmployee, currentRole, todayAttendance, logout } = useAuth();
  const { ingredients, cartCount, darkMode, toggleDarkMode, shifts, sales, closeShift } = useApp();

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

  const criticalStockCount = ingredients.filter(
    (i) => i.stock <= i.criticalStock
  ).length;

  const rawNavGroups = [
    {
      group: 'PENJUALAN',
      items: [
        {
          id: 'beranda',
          label: 'Beranda Dashboard',
          icon: Home,
          badge: null,
        },
        {
          id: 'kasir',
          label: 'Kasir POS',
          icon: ShoppingBag,
          badge: cartCount > 0 ? `${cartCount}` : null,
          badgeColor: 'bg-[#FF641F] text-white',
        },
        {
          id: 'pesanan',
          label: 'Riwayat Penjualan',
          icon: Receipt,
          badge: null,
        },
        {
          id: 'menu',
          label: 'Menu & Harga',
          icon: UtensilsCrossed,
          badge: null,
        },
        {
          id: 'diskon_promo',
          label: 'Promo & Diskon',
          icon: Tag,
          badge: null,
        },
      ],
    },
    {
      group: 'OPERASIONAL',
      items: [
        {
          id: 'stok',
          label: 'Stok Bahan & Produk',
          icon: Boxes,
          badge: criticalStockCount > 0 ? `${criticalStockCount} kritis` : null,
          badgeColor: 'bg-[#FEF3F2] text-[#D92D20] border border-[#FECDCA]',
        },
        {
          id: 'pembelian',
          label: 'Pembelian Bahan',
          icon: ShoppingBag,
          badge: null,
        },
        {
          id: 'vendor',
          label: 'Supplier',
          icon: Building2,
          badge: null,
        },
        {
          id: 'produksi',
          label: 'Resep & Komposisi',
          icon: ChefHat,
          badge: null,
        },
      ],
    },
    {
      group: 'KEUANGAN',
      items: [
        {
          id: 'kas_saldo',
          label: 'Kas & Rekening',
          icon: Wallet2,
          badge: null,
        },
        {
          id: 'pengeluaran',
          label: 'Pengeluaran',
          icon: TrendingDown,
          badge: null,
        },
        {
          id: 'laporan_lengkap',
          label: 'Laporan',
          icon: BarChart3,
          badge: null,
        },
      ],
    },
    {
      group: 'PENGATURAN',
      items: [
        {
          id: 'lainnya',
          label: 'Pengaturan',
          icon: Settings,
          badge: null,
        },
        {
          id: 'karyawan',
          label: 'Karyawan',
          icon: Users,
          badge: null,
        },
      ],
    },
  ];

  // Filter groups and items by employee role permissions
  const filteredNavGroups = rawNavGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => isTabAllowedForRole(it.id, currentRole)),
    }))
    .filter((g) => g.items.length > 0);

  const checkInTimeStr = todayAttendance?.checkInAt
    ? new Date(todayAttendance.checkInAt).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const handleLogoutAction = () => {
    if (currentRole === 'KASIR') {
      setShowCloseKasirModal(true);
    } else {
      handleLogoutWithConfirm();
    }
  };

  const handleLogoutWithConfirm = async () => {
    if (isLoggingOut) return;
    const confirmed = confirm('Yakin ingin keluar dari sesi?');
    if (!confirmed) return;

    setIsLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleExecuteCloseShiftAndLogout = async (
    actualCash?: number,
    notes?: string,
    closingDetails?: {
      expectedCash: number;
      cashDifference: number;
      closingDenominations: Record<string, number>;
    }
  ) => {
    if (activeShift) {
      if (typeof actualCash !== 'number' || Number.isNaN(actualCash)) {
        throw new Error('Jumlah uang fisik belum dihitung.');
      }
      await closeShift(
        activeShift.id,
        actualCash,
        notes || 'Tutup kasir dari sidebar desktop',
        closingDetails
      );
    }
    await logout();
    setShowCloseKasirModal(false);
  };

  return (
    <>
      <aside className="w-[250px] h-screen sticky top-0 shrink-0 bg-[#0B132B] border-r border-[#1E293B] flex flex-col justify-between select-none z-20 text-white shadow-xl">
        {/* Top Brand & Mode Switcher */}
        <div className="p-4 border-b border-[#1E293B] space-y-3">
          {/* Brand Lockup */}
          <div className="flex items-center gap-3">
            <AyamLogo size="md" />
            <div className="min-w-0">
              <h1 className="font-black text-white text-sm tracking-tight leading-none truncate flex items-center gap-1.5">
                <span>AYAM GEPREK ARY</span>
              </h1>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="w-2 h-2 rounded-full bg-[#12B76A] inline-block animate-pulse shrink-0" />
                <span className="text-[10px] font-semibold text-[#94A3B8]">
                  Kasir &amp; POS Resto
                </span>
              </div>
            </div>
          </div>

          {/* View Mode Toggle: Desktop vs Mobile */}
          <div className="bg-[#131F37] p-1 rounded-xl flex items-center justify-between border border-[#1E293B]">
            <button
              type="button"
              onClick={() => setDeviceMode('desktop')}
              className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                deviceMode === 'desktop'
                  ? 'bg-[#FF641F] text-white shadow-xs'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
              title="Tampilan Desktop Penuh"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode('mobile')}
              className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                deviceMode === 'mobile'
                  ? 'bg-[#FF641F] text-white shadow-xs'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
              title="Tampilan Simulasi Mobile (HP)"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mode HP</span>
            </button>
          </div>
        </div>

        {/* Nav Items Scrollable */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
          {filteredNavGroups.map((group) => (
            <div key={group.group} className="space-y-1">
              <span className="px-2 text-[10px] font-black uppercase tracking-wider text-[#64748B] block">
                {group.group}
              </span>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    activeTab === item.id ||
                    (item.id === 'produksi' && (activeTab === 'resep' || activeTab === 'produksi_ayam'));
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition group cursor-pointer ${
                        isActive
                          ? 'bg-[#FF641F] text-white shadow-xs'
                          : 'text-[#94A3B8] hover:bg-[#131F37] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive
                              ? 'text-white'
                              : 'text-[#64748B] group-hover:text-white'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold shrink-0 ${
                            item.badgeColor || 'bg-[#1E293B] text-slate-300'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Profile & Role Bar */}
        <div className="p-3 border-t border-[#1E293B] bg-[#0B132B] space-y-2">
          {/* PWA Install Button */}
          <PWAInstallButton variant="sidebar" />

          {/* Employee Card & Attendance Status */}
          <div className="p-2.5 bg-[#131F37] rounded-2xl border border-[#1E293B] space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-orange-500/20 text-[#FF641F] font-black text-xs flex items-center justify-center shrink-0 border border-orange-500/30">
                  {currentEmployee?.name?.charAt(0) || 'K'}
                </div>
                <div className="min-w-0">
                  <span className="font-extrabold text-xs text-white block truncate">
                    {currentEmployee?.name || 'Karyawan'}
                  </span>
                  <span className="text-[10px] text-[#94A3B8] font-semibold block truncate">
                    @{currentEmployee?.username || 'user'} &bull; {currentRole}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleDarkMode}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-[#1E293B] hover:text-white transition cursor-pointer"
                title="Ganti Tema"
              >
                {darkMode ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {currentRole !== 'OWNER' && (
              <div className="flex items-center justify-between pt-1 border-t border-[#1E293B] text-[10px]">
                <span className="text-[#12B76A] font-bold flex items-center gap-1">
                  <UserCheck className="w-3 h-3" />
                  <span>HADIR</span>
                </span>
                <span className="text-[#94A3B8] font-medium">
                  Masuk: {checkInTimeStr || '-'}
                </span>
              </div>
            )}
          </div>

          {/* Logout / Tutup Kasir Button */}
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={handleLogoutAction}
            className="w-full py-2 px-3 rounded-xl text-left text-xs font-bold text-[#F87171] bg-[#2A1515] hover:bg-[#381B1B] border border-[#522222] transition flex items-center justify-between disabled:opacity-50 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <LogOut className="w-3.5 h-3.5" />
              <span>{currentRole === 'KASIR' ? 'Tutup Kasir & Serah Terima' : 'Keluar Sesi'}</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-[#F87171]/60" />
          </button>
        </div>
      </aside>

      {/* Tutup Kasir & Serah Terima Modal */}
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
