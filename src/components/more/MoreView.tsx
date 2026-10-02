import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { AyamLogo } from '../common/AyamLogo';
import { CloseCashierModal } from '../cash/CloseCashierModal';
import { PageContainer } from '../common/PageContainer';
import { PageHeader } from '../common/PageHeader';
import { UserRole } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import {
  UtensilsCrossed,
  FileSpreadsheet,
  ShoppingBag,
  Wallet,
  Users,
  Settings,
  RefreshCw,
  Info,
  ChevronRight,
  LogOut,
  X,
  Moon,
  Sun,
  LayoutGrid,
  List,
  Factory,
  Wallet2,
  Trash2,
  AlertTriangle,
  Loader2,
  Building2,
  Layers,
  ChefHat,
  Tag,
  Percent,
} from 'lucide-react';

interface MoreViewProps {
  onNavigateTab: (tab: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  badge?: string;
  isDanger?: boolean;
  action: () => void;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const MoreView: React.FC<MoreViewProps> = ({ onNavigateTab }) => {
  const { currentEmployee, currentRole, logout } = useAuth();
  const {
    resetAllData,
    seedInitialData,
    isSeeding,
    darkMode,
    toggleDarkMode,
    cashBalanceSummary,
    posLayoutMode,
    setPosLayoutMode,
  } = useApp();

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const canManagePromos = currentRole === 'OWNER' || currentRole === 'ADMIN';

  const menuSections: MenuSection[] = [
    {
      title: 'OPERASIONAL & KEUANGAN',
      items: [
        {
          id: 'kas_saldo',
          label: 'Kas & Rekening',
          subtitle: 'Kelola saldo kas, QRIS, wallet platform & rekening bank',
          icon: Wallet2,
          badge: formatRupiah(cashBalanceSummary.totalSaldoDanPlatform),
          action: () => onNavigateTab('kas_saldo'),
        },
        {
          id: 'pengeluaran',
          label: 'Pengeluaran',
          subtitle: 'Catat biaya operasional',
          icon: Wallet,
          action: () => onNavigateTab('pengeluaran'),
        },
        {
          id: 'laporan_lengkap',
          label: 'Laporan',
          subtitle: 'Pantau penjualan, pembelian, persediaan & keuangan',
          icon: FileSpreadsheet,
          action: () => onNavigateTab('laporan_lengkap'),
        },
      ],
    },
    {
      title: 'DAPUR, MENU & RESEP',
      items: [
        {
          id: 'produksi',
          label: 'Produksi & Resep',
          subtitle: 'Kelola resep & HPP produk olahan serta catat produksi dapur',
          icon: Factory,
          action: () => onNavigateTab('produksi'),
        },
        {
          id: 'perakitan',
          label: 'Komposisi Menu',
          subtitle: 'Atur komponen produk stok & kemasan untuk menu POS',
          icon: Layers,
          action: () => onNavigateTab('perakitan'),
        },
        {
          id: 'menu',
          label: 'Produk & Menu',
          subtitle: 'Kelola menu, harga dan kategori',
          icon: UtensilsCrossed,
          action: () => onNavigateTab('menu'),
        },
        ...(canManagePromos
          ? [
              {
                id: 'diskon_promo',
                label: 'Diskon & Harga Promo',
                subtitle: 'Atur harga promo & harga coret per aplikasi (Offline/GoFood/GrabFood/ShopeeFood)',
                icon: Tag,
                action: () => onNavigateTab('diskon_promo'),
              },
              {
                id: 'biaya_platform',
                label: 'Biaya Admin Platform',
                subtitle: 'Atur persentase komisi, biaya tetap & ongkir GoFood, GrabFood, ShopeeFood',
                icon: Percent,
                action: () => onNavigateTab('biaya_platform'),
              },
            ]
          : []),
        {
          id: 'pembelian',
          label: 'Pembelian',
          subtitle: 'Transaksi pembelian & hutang',
          icon: ShoppingBag,
          action: () => onNavigateTab('pembelian'),
        },
        {
          id: 'vendor',
          label: 'Vendor / Supplier',
          subtitle: 'Kelola data mitra supplier',
          icon: Building2,
          action: () => onNavigateTab('vendor'),
        },
      ],
    },
    {
      title: 'MANAJEMEN & SISTEM',
      items: [
        {
          id: 'karyawan',
          label: 'Karyawan',
          subtitle: 'Kelola data karyawan',
          icon: Users,
          action: () => onNavigateTab('karyawan'),
        },
        {
          id: 'backup',
          label: 'Backup & Sinkronisasi',
          subtitle: 'Sinkronisasi data ke cloud',
          icon: RefreshCw,
          action: () => setShowSyncModal(true),
        },
        {
          id: 'pengaturan',
          label: 'Pengaturan',
          subtitle: 'Preferensi aplikasi',
          icon: Settings,
          action: () => setShowSettingsModal(true),
        },
        {
          id: 'reset_data',
          label: 'Riset & Hapus Semua Data',
          subtitle: 'Hapus total semua data & dummy',
          icon: Trash2,
          isDanger: true,
          action: () => setShowResetModal(true),
        },
        {
          id: 'tentang',
          label: 'Tentang Aplikasi',
          subtitle: 'Versi aplikasi',
          icon: Info,
          action: () => setShowAboutModal(true),
        },
      ],
    },
  ];

  const { shifts, sales, cartCount, closeShift } = useApp();
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

  const handleLogout = async () => {
    if (currentRole === 'KASIR') {
      setShowCloseKasirModal(true);
    } else {
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
        notes || 'Tutup kasir dari menu lainnya',
        closingDetails
      );
    }

    await logout();
    setShowCloseKasirModal(false);
  };

  return (
    <PageContainer className="pb-32">
      {/* 1. Header */}
      <PageHeader
        title="Pengaturan & Menu Lainnya"
        description="Menu pengaturan, resep, dan manajemen outlet."
      />

      {/* 2. Main Content */}
      <div className="space-y-4">
        {/* Profile Card */}
        <div
          onClick={() => setShowSettingsModal(true)}
          className="bg-white rounded-2xl border border-[#E8ECF2] p-4 flex items-center justify-between shadow-[0_1px_3px_rgba(23,32,51,0.02)] cursor-pointer hover:border-[#FF641F]/30 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF641F] text-white flex items-center justify-center font-black text-base shadow-xs">
              {currentEmployee?.name ? currentEmployee.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-[#172033]">
                  {currentEmployee?.name || 'Ayam Geprek ARY'}
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-[#FF641F]/10 text-[#FF641F] text-[10px] font-black uppercase">
                  {currentRole}
                </span>
              </div>
              <p className="text-xs font-medium text-[#12B76A] flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A]" />
                <span>
                  {currentRole === 'OWNER'
                    ? 'Akses Pemilik Toko (Tanpa Absen)'
                    : 'Terautentikasi • HADIR'}
                </span>
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#98A2B3]" />
        </div>

        {/* Grouped Menus */}
        {menuSections.map((sec, idx) => (
          <div key={idx} className="space-y-1.5">
            <h3 className="text-[11px] font-bold text-[#667085] uppercase tracking-wider px-1">
              {sec.title}
            </h3>

            <div className="bg-white rounded-2xl border border-[#E8ECF2] divide-y divide-[#E8ECF2] shadow-[0_1px_3px_rgba(23,32,51,0.02)] overflow-hidden">
              {sec.items.map(item => {
                const Icon = item.icon;
                const isDanger = (item as { isDanger?: boolean }).isDanger;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.action}
                    className={`w-full px-4 py-3 flex items-center justify-between text-left transition active:bg-[#F1F4F8] ${
                      isDanger
                        ? 'hover:bg-[#FEF3F2]/60'
                        : 'hover:bg-[#F7F8FA]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                          isDanger
                            ? 'bg-[#FEF3F2] text-[#D92D20] border-[#FECDCA]'
                            : 'bg-[#FFF6F0] text-[#FF641F] border-[#FF641F]/20'
                        }`}
                      >
                        <Icon className="w-4 h-4 stroke-[2.2]" />
                      </div>
                      <div className="min-w-0">
                        <span
                          className={`text-xs font-semibold block truncate ${
                            isDanger ? 'text-[#D92D20]' : 'text-[#172033]'
                          }`}
                        >
                          {item.label}
                        </span>
                        <span
                          className={`text-[11px] block truncate mt-0.5 ${
                            isDanger ? 'text-[#F04438]/80' : 'text-[#667085]'
                          }`}
                        >
                          {item.subtitle}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {item.badge && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF3] text-[#12B76A] border border-[#A6F4C5]/60">
                          {item.badge}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-[#CCD4DF]" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Logout Button */}
        <div className="pt-2">
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={handleLogout}
            className="w-full py-3 text-center text-xs font-semibold text-[#F04438] hover:bg-[#FEF3F2] border border-[#E8ECF2] hover:border-[#FECDCA] rounded-2xl transition active:scale-[0.99] flex items-center justify-center gap-1.5 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoggingOut ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#F04438]" />
                <span>Proses Keluar Sesi...</span>
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4" />
                <span>{currentRole === 'KASIR' ? 'Tutup Kasir' : 'Keluar Sesi'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Settings Modal (Role Switcher & Appearance) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-[#E8ECF2] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8ECF2] pb-2.5">
              <h3 className="font-bold text-sm text-[#172033] flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#FF641F]" />
                <span>Pengaturan Sistem</span>
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-full text-[#98A2B3] hover:text-[#172033]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Employee Profile & Role Badge (Role determined by Owner/Admin, not client switcher) */}
            <div className="p-3 bg-[#F7F8FA] rounded-2xl border border-[#E8ECF2] space-y-1.5">
              <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
                Akun Terautentikasi:
              </span>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-extrabold text-xs text-[#172033] block">
                    {currentEmployee?.name || 'Pengguna'}
                  </span>
                  <span className="text-[10px] text-[#667085] font-medium">
                    @{currentEmployee?.username || 'user'}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-[#FF641F] text-white">
                  {currentRole}
                </span>
              </div>
              <p className="text-[10px] text-[#98A2B3] pt-1 border-t border-[#E8ECF2]">
                Hak akses peran ditentukan oleh Owner/Admin di modul Manajemen Karyawan.
              </p>
            </div>

            {/* POS Menu Display Preferences */}
            <div className="pt-2.5 border-t border-[#E8ECF2] space-y-2">
              <label className="text-[11px] font-bold text-[#172033] block">
                Tata Letak Kasir
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPosLayoutMode('grid')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    posLayoutMode === 'grid'
                      ? 'bg-[#FF641F] text-white shadow-xs'
                      : 'bg-[#F1F4F8] text-[#667085]'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Grid (2 Kolom)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPosLayoutMode('list')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    posLayoutMode === 'list'
                      ? 'bg-[#FF641F] text-white shadow-xs'
                      : 'bg-[#F1F4F8] text-[#667085]'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Baris</span>
                </button>
              </div>
            </div>

            {/* Biaya Admin Platform Settings Shortcut */}
            {canManagePromos && (
              <div className="pt-2.5 border-t border-[#E8ECF2] space-y-1.5">
                <label className="text-[11px] font-bold text-[#172033] block">
                  Komisi &amp; Biaya Platform Online
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsModal(false);
                    onNavigateTab('biaya_platform');
                  }}
                  className="w-full py-2.5 px-3 rounded-xl border border-[#FF641F]/30 bg-[#FFF6F0] text-xs font-bold text-[#FF641F] hover:bg-[#FFEFE6] transition flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-[#FF641F]" />
                    <span>Biaya Admin Platform (GoFood / Grab / Shopee)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#FF641F]" />
                </button>
              </div>
            )}

            {/* Riset & Hapus Semua Data */}
            <div className="pt-2 border-t border-[#E8ECF2] space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setShowSettingsModal(false);
                  setShowResetModal(true);
                }}
                className="w-full py-2.5 rounded-xl border border-[#FECDCA] bg-[#FEF3F2] text-xs font-bold text-[#D92D20] hover:bg-[#FEE4E2] transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer active:scale-98"
              >
                <Trash2 className="w-4 h-4 text-[#D92D20]" />
                <span>Riset & Hapus Semua Data (Tanpa Dummy)</span>
              </button>
              <p className="text-[10px] text-[#98A2B3] text-center">
                Menghapus total seluruh transaksi, stok, menu & membersihkan data dummy.
              </p>
            </div>

            <button
              onClick={() => setShowSettingsModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#FF641F] hover:bg-[#F45116] text-white font-semibold text-xs transition"
            >
              Simpan & Tutup
            </button>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-[#FECDCA] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F4F8]">
              <div className="flex items-center gap-2.5 text-[#D92D20]">
                <div className="w-9 h-9 rounded-2xl bg-[#FEF3F2] border border-[#FECDCA] flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-[#D92D20]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#172033]">
                    Riset Semua Data
                  </h3>
                  <p className="text-[10px] text-[#F04438] font-semibold">
                    Tindakan ini tidak dapat dibatalkan
                  </p>
                </div>
              </div>
              <button
                disabled={isResetting}
                onClick={() => setShowResetModal(false)}
                className="p-1 rounded-full text-[#98A2B3] hover:text-[#172033]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-[#475467]">
              <p className="font-medium leading-relaxed">
                Seluruh data yang ada di database akan <strong className="text-[#D92D20]">dihapus permanen</strong> dan tidak akan ada lagi data dummy:
              </p>

              <div className="p-3 bg-[#FEF3F2] rounded-2xl border border-[#FECDCA]/70 space-y-1.5 text-[11px] text-[#B42318]">
                <div className="flex items-start gap-1.5">
                  <span className="font-bold">✓</span>
                  <span>Seluruh penjualan & riwayat transaksi POS</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold">✓</span>
                  <span>Seluruh stok bahan baku, resep & menu jual</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold">✓</span>
                  <span>Seluruh riwayat mutasi kas & saldo QRIS</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold">✓</span>
                  <span>Seluruh data pengeluaran, kulakan & absensi</span>
                </div>
                <div className="flex items-start gap-1.5 font-bold pt-1 border-t border-[#FECDCA]/70 text-[#912018]">
                  <span>★</span>
                  <span>Aplikasi 100% BERSIH tanpa data dummy bawaan</span>
                </div>
              </div>

              <p className="text-[11px] text-[#667085] leading-relaxed">
                Setelah riset selesai, sistem siap langsung digunakan dari awal untuk pencatatan bisnis riil Ayam Geprek ARY.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={isResetting}
                onClick={async () => {
                  setIsResetting(true);
                  try {
                    await resetAllData();
                    setShowResetModal(false);
                    alert('Sukses! Semua data berhasil dihapus dan dibersihkan. Tidak ada lagi data dummy.');
                  } catch (err) {
                    alert('Gagal melakukan riset data: ' + (err instanceof Error ? err.message : 'Terjadi kesalahan sistem'));
                  } finally {
                    setIsResetting(false);
                  }
                }}
                className="w-full py-3 rounded-2xl bg-[#D92D20] hover:bg-[#B42318] text-white font-bold text-xs shadow-md shadow-[#D92D20]/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menghapus Semua Data...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Ya, Hapus Semua Data Sekarang</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isResetting}
                onClick={() => setShowResetModal(false)}
                className="w-full py-2.5 rounded-2xl bg-[#F1F4F8] hover:bg-[#E8ECF2] text-[#667085] font-semibold text-xs transition"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-[#E8ECF2] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8ECF2] pb-2.5">
              <h3 className="font-bold text-sm text-[#172033] flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-[#FF641F]" />
                <span>Backup & Sinkronisasi</span>
              </h3>
              <button
                onClick={() => setShowSyncModal(false)}
                className="p-1 rounded-full text-[#98A2B3] hover:text-[#172033]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-[#F7F8FA] rounded-2xl flex items-center justify-between border border-[#E8ECF2]">
                <span className="text-[#667085]">Status Jaringan:</span>
                <span className="font-semibold text-[#12B76A]">● Terhubung (Online)</span>
              </div>
              <div className="p-3 bg-[#F7F8FA] rounded-2xl flex items-center justify-between border border-[#E8ECF2]">
                <span className="text-[#667085]">Cloud Storage:</span>
                <span className="font-semibold text-[#172033]">Firebase Firestore</span>
              </div>
              <p className="text-[11px] text-[#667085] leading-relaxed pt-1">
                Data penjualan dan mutasi stok secara otomatis tersinkronisasi ke cloud saat online. Jika offline, transaksi tetap tersimpan aman di perangkat lokal.
              </p>
            </div>

            <button
              onClick={() => setShowSyncModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#FF641F] hover:bg-[#F45116] text-white font-semibold text-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-[#E8ECF2] space-y-3 text-center">
            <img
              src="/ary-logo-full.svg"
              alt="Ayam Geprek ARY"
              className="h-28 w-auto mx-auto object-contain drop-shadow-sm select-none"
              referrerPolicy="no-referrer"
            />
            <div>
              <p className="text-[11px] text-[#667085] mt-1 leading-relaxed">
                Versi 2.4 (2026 Modern Edition) &bull; Sistem POS, Inventory, HPP &amp; Manajemen Dapur Restoran.
              </p>
            </div>
            <button
              onClick={() => setShowAboutModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#FF641F] hover:bg-[#F45116] text-white font-semibold text-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Close Cashier Modal */}
      <CloseCashierModal
        isOpen={showCloseKasirModal}
        onClose={() => setShowCloseKasirModal(false)}
        cartCount={cartCount}
        activeShift={activeShift}
        sales={sales}
        onExecuteCloseShiftAndLogout={handleExecuteCloseShiftAndLogout}
      />
    </PageContainer>
  );
};
