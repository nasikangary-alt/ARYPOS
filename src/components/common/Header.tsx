import React from 'react';
import {
  Monitor,
  Smartphone,
  ChevronRight,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  deviceMode?: 'desktop' | 'mobile';
  setDeviceMode?: (mode: 'desktop' | 'mobile') => void;
}

const TAB_TITLES: Record<string, { group: string; title: string }> = {
  beranda: { group: 'Penjualan', title: 'Beranda Dashboard' },
  laporan: { group: 'Penjualan', title: 'Beranda Dashboard' },
  kasir: { group: 'Penjualan', title: 'Kasir POS' },
  pesanan: { group: 'Penjualan', title: 'Riwayat Penjualan' },
  menu: { group: 'Penjualan', title: 'Daftar Menu POS' },
  diskon_promo: { group: 'Penjualan', title: 'Diskon & Harga Promo' },
  biaya_platform: { group: 'Penjualan', title: 'Biaya Admin Platform' },
  perakitan: { group: 'Penjualan', title: 'Komposisi Menu' },
  produksi: { group: 'Produksi & Resep', title: 'Produksi & Resep' },
  resep: { group: 'Produksi & Resep', title: 'Produksi & Resep' },
  produksi_ayam: { group: 'Produksi & Resep', title: 'Produksi Ayam' },
  stok: { group: 'Persediaan', title: 'Stok Bahan & Produk' },
  pembelian: { group: 'Persediaan', title: 'Pembelian Bahan' },
  vendor: { group: 'Persediaan', title: 'Vendor & Supplier' },
  kas_saldo: { group: 'Keuangan', title: 'Kas & Rekening' },
  pengeluaran: { group: 'Keuangan', title: 'Biaya Operasional' },
  laporan_lengkap: { group: 'Keuangan', title: 'Laporan' },
  karyawan: { group: 'Manajemen', title: 'Karyawan' },
  audit: { group: 'Manajemen', title: 'Audit' },
  lainnya: { group: 'Manajemen', title: 'Pengaturan & Menu Lainnya' },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  deviceMode = 'desktop',
  setDeviceMode,
}) => {
  const currentTabInfo = TAB_TITLES[activeTab] || {
    group: 'Operasional',
    title: 'Ayam Geprek ARY',
  };

  return (
    <>
      <header className="hidden lg:flex sticky top-0 z-30 h-14 bg-white border-b border-[#E8ECF2] px-6 items-center justify-between gap-4 shrink-0">
        {/* Left: Compact Breadcrumb [Group] > [Page] */}
        <div className="flex items-center gap-2 min-w-0 text-xs">
          <span className="font-medium text-[#667085] truncate">
            {currentTabInfo.group}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-[#98A2B3] shrink-0" />
          <span className="font-bold text-[#172033] truncate">
            {currentTabInfo.title}
          </span>
        </div>

        {/* Right: [PWA Install] + [Desktop | HP Device Switcher] */}
        <div className="flex items-center gap-2.5 shrink-0">
          <PWAInstallButton variant="header" />
          {setDeviceMode && (
            <div className="bg-[#F7F8FA] p-0.5 rounded-lg flex items-center border border-[#E8ECF2] h-8">
              <button
                type="button"
                onClick={() => setDeviceMode('desktop')}
                className={`h-7 px-2.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  deviceMode === 'desktop'
                    ? 'bg-white text-[#172033] shadow-2xs'
                    : 'text-[#667085] hover:text-[#172033]'
                }`}
                title="Tampilan Desktop"
              >
                <Monitor className="w-3.5 h-3.5 text-[#FF641F]" />
                <span>Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => setDeviceMode('mobile')}
                className={`h-7 px-2.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  deviceMode === 'mobile'
                    ? 'bg-white text-[#172033] shadow-2xs'
                    : 'text-[#667085] hover:text-[#172033]'
                }`}
                title="Tampilan Mobile (HP)"
              >
                <Smartphone className="w-3.5 h-3.5 text-[#667085]" />
                <span>HP</span>
              </button>
            </div>
          )}
        </div>
      </header>
    </>
  );
};
