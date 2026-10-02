import React from 'react';
import {
  Home,
  Factory,
  Boxes,
  MoreHorizontal,
  ShoppingBag,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const { cartCount } = useApp();
  const { currentRole } = useAuth();

  // Role-customized bottom navigation items
  const navItems = (() => {
    if (currentRole === 'KASIR') {
      return [
        { id: 'beranda', label: 'Beranda', icon: Home },
        { id: 'kasir', label: 'Kasir', icon: ShoppingBag, badge: cartCount > 0 ? cartCount : null },
        { id: 'produksi', label: 'Produksi', icon: Factory },
        { id: 'stok', label: 'Stok', icon: Boxes },
      ];
    }
    if (currentRole === 'KARYAWAN') {
      return [
        { id: 'beranda', label: 'Beranda', icon: Home },
        { id: 'kasir', label: 'Kasir', icon: ShoppingBag, badge: cartCount > 0 ? cartCount : null },
        { id: 'produksi', label: 'Produksi', icon: Factory },
        { id: 'stok', label: 'Stok', icon: Boxes },
        { id: 'karyawan', label: 'Absensi', icon: UserCheck },
      ];
    }
    // OWNER / ADMIN default
    return [
      { id: 'beranda', label: 'Beranda', icon: Home, badge: cartCount > 0 ? cartCount : null },
      { id: 'kasir', label: 'Kasir', icon: ShoppingBag },
      { id: 'produksi', label: 'Produksi', icon: Factory },
      { id: 'stok', label: 'Stok', icon: Boxes },
      { id: 'lainnya', label: 'Lainnya', icon: MoreHorizontal },
    ];
  })();

  const isLainnyaActive =
    activeTab === 'lainnya' ||
    ['menu', 'pengeluaran', 'pembelian', 'vendor', 'kas_saldo', 'audit', 'laporan_lengkap', 'perakitan'].includes(
      activeTab
    );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2E6EC] shadow-[0_-4px_20px_rgba(23,32,51,0.04)]">
      <div
        className="max-w-[430px] mx-auto grid items-center px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))]"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
      >
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive =
            item.id === 'lainnya'
              ? isLainnyaActive
              : item.id === 'produksi'
              ? activeTab === 'produksi' || activeTab === 'resep' || activeTab === 'produksi_ayam'
              : activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="relative flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-colors group cursor-pointer"
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive
                      ? 'text-[#FF6B22] stroke-[2.4]'
                      : 'text-[#667085] stroke-[1.8] group-hover:text-[#172033]'
                  }`}
                />
                {item.badge && (
                  <span className="absolute -top-1 -right-2 bg-[#FF6B22] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] mt-1 font-medium tracking-tight leading-none text-center truncate w-full ${
                  isActive ? 'text-[#FF6B22] font-bold' : 'text-[#667085]'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
