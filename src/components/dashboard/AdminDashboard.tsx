import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatRupiah, formatNumber } from '../../utils/formatters';
import { normalizeSaleFinancials, getOrderTypeMeta } from '../../utils/saleChannel';
import {
  GreetingHeader,
  StatCard,
  SectionCard,
  QuickAction,
  RecentActivityFeed,
  StockAlertsCard,
  FloatingPOSButton,
} from './DashboardComponents';
import {
  TrendingUp,
  ShoppingBag,
  Factory,
  Boxes,
  PackagePlus,
  AlertTriangle,
  PackageCheck,
  CheckCircle2,
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigateTab: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateTab }) => {
  const { sales, ingredients, products, productions, purchases } = useApp();
  const { userProfile, currentEmployee } = useAuth();
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');

  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat pagi';
    if (hour < 15) return 'Selamat siang';
    if (hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  }, []);

  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date());
  }, []);

  const todayStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }, []);

  // Today's Sales
  const todaySales = useMemo(() => {
    return sales.filter(
      (s) => s.status === 'COMPLETED' && new Date(s.createdAt).getTime() >= todayStart
    );
  }, [sales, todayStart]);

  const todayOmzet = useMemo(
    () => todaySales.reduce((sum, s) => sum + normalizeSaleFinancials(s).foodTotal, 0),
    [todaySales]
  );

  const todayTransactionCount = useMemo(() => todaySales.length, [todaySales]);

  // Today's Productions
  const todayProductions = useMemo(() => {
    return productions.filter(
      (p) => new Date(p.createdAt || Date.now()).getTime() >= todayStart
    );
  }, [productions, todayStart]);

  const totalProducedItems = useMemo(
    () => todayProductions.reduce((sum, p) => sum + p.totalProduced, 0),
    [todayProductions]
  );

  // Critical Stock Count
  const lowStockItems = useMemo(() => {
    const alerts: Array<{
      id: string;
      name: string;
      currentStock: number;
      unit: string;
      minStock: number;
      isCritical: boolean;
    }> = [];

    ingredients.forEach((ing) => {
      const min = ing.minimumStock || 5;
      if (ing.stock <= min) {
        alerts.push({
          id: `ing-${ing.id}`,
          name: ing.name,
          currentStock: ing.stock,
          unit: ing.unit || 'pcs',
          minStock: min,
          isCritical: ing.stock <= (ing.criticalStock || min / 2),
        });
      }
    });

    products.forEach((prod) => {
      const stock = prod.stock || 0;
      if (stock <= 5) {
        alerts.push({
          id: `prod-${prod.id}`,
          name: `${prod.name} (Produk)`,
          currentStock: stock,
          unit: 'porsi',
          minStock: 5,
          isCritical: stock <= 2,
        });
      }
    });

    return alerts;
  }, [ingredients, products]);

  // Recent Activity Feed
  const recentActivities = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      subtitle: string;
      timeAgo: string;
      type: 'sale' | 'production' | 'purchase';
      amount?: number;
      timestamp: number;
    }> = [];

    todaySales.slice(0, 4).forEach((s) => {
      const fin = normalizeSaleFinancials(s);
      const orderMeta = getOrderTypeMeta(fin.orderType);
      list.push({
        id: `sale-${s.id}`,
        title: `Penjualan ${orderMeta.shortLabel} #${s.transactionNo || s.id.slice(-6)}`,
        subtitle: `${s.items.length} item • ${orderMeta.shortLabel} • ${s.paymentMethod}`,
        timeAgo: new Date(s.createdAt).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        type: 'sale',
        amount: fin.foodTotal,
        timestamp: new Date(s.createdAt).getTime(),
      });
    });

    todayProductions.slice(0, 3).forEach((p) => {
      list.push({
        id: `prod-${p.id}`,
        title: `Produksi ${p.productName}`,
        subtitle: `+${p.totalProduced} porsi siap jual`,
        timeAgo: new Date(p.createdAt || Date.now()).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        type: 'production',
        timestamp: new Date(p.createdAt || 0).getTime(),
      });
    });

    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  }, [todaySales, todayProductions]);

  const adminName = userProfile?.displayName || currentEmployee?.name || 'Admin Toko';

  return (
    <div className="pb-24 lg:pb-12 bg-[#F7F8FA] min-h-screen w-full max-w-none">
      {/* Header */}
      <GreetingHeader
        dateText={todayFormatted}
        greetingText={greetingText}
        userName={adminName}
        roleBadge="ADMIN OPERASIONAL"
        showTimeRange={false}
      />

      <div className="w-full max-w-none px-4 lg:px-6 space-y-5">
        {/* KPI Cards (4 Items) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Omzet POS Hari Ini"
            value={formatRupiah(todayOmzet)}
            subtext={`${todayTransactionCount} Transaksi`}
            icon={TrendingUp}
            iconBgColor="bg-emerald-50"
            iconColor="text-emerald-600"
            accentColor="bg-emerald-500"
          />
          <StatCard
            label="Transaksi Terlayani"
            value={`${formatNumber(todayTransactionCount)}`}
            subtext="Struk Selesai"
            icon={ShoppingBag}
            iconBgColor="bg-blue-50"
            iconColor="text-blue-600"
            accentColor="bg-blue-500"
          />
          <StatCard
            label="Hasil Produksi Dapur"
            value={`${formatNumber(totalProducedItems)} porsi`}
            subtext={`${todayProductions.length} Sesi Produksi`}
            icon={Factory}
            iconBgColor="bg-amber-50"
            iconColor="text-amber-600"
            accentColor="bg-amber-500"
          />
          <StatCard
            label="Bahan & Produk Menipis"
            value={`${lowStockItems.length} Item`}
            subtext="Memerlukan Restock"
            icon={AlertTriangle}
            iconBgColor={lowStockItems.length > 0 ? 'bg-rose-50' : 'bg-slate-50'}
            iconColor={lowStockItems.length > 0 ? 'text-rose-600' : 'text-slate-500'}
            accentColor={lowStockItems.length > 0 ? 'bg-rose-500' : 'bg-slate-300'}
          />
        </div>

        {/* Quick Actions Grid */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#FF641F]" />
            <span>Akses Cepat Operasional Admin</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickAction
              title="Buka Kasir POS"
              description="Melayani transaksi POS"
              icon={ShoppingBag}
              onClick={() => onNavigateTab('kasir')}
              badge="POS"
            />
            <QuickAction
              title="Catat Produksi Dapur"
              description="Tambah hasil potong & olahan"
              icon={Factory}
              onClick={() => onNavigateTab('produksi')}
            />
            <QuickAction
              title="Pembelian Bahan"
              description="Input nota belanja vendor"
              icon={PackagePlus}
              onClick={() => onNavigateTab('pembelian')}
            />
            <QuickAction
              title="Kelola & Opname Stok"
              description="Atur stok & resep"
              icon={Boxes}
              onClick={() => onNavigateTab('stok')}
            />
          </div>
        </div>

        {/* Operational Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Recent Kitchen Production */}
          <SectionCard
            title="PRODUKSI DAPUR HARI INI"
            subtitle="Ringkasan porsi produk olahan"
            actionText="Kelola Produksi →"
            onActionClick={() => onNavigateTab('produksi')}
            icon={Factory}
          >
            {todayProductions.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-center text-xs text-slate-500">
                Belum ada catatan produksi dapur untuk hari ini.
              </div>
            ) : (
              <div className="space-y-2">
                {todayProductions.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block">
                        {p.productName}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Diproduksi oleh: {p.createdByName || 'Staf Dapur'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-amber-600 text-sm block">
                        +{formatNumber(p.totalProduced)} {p.yieldUnit || 'porsi'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(p.createdAt || Date.now()).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Stock Alerts */}
          <StockAlertsCard
            alerts={lowStockItems.slice(0, 5)}
            onManageStock={() => onNavigateTab('stok')}
          />
        </div>

        {/* Recent Activities */}
        <RecentActivityFeed
          activities={recentActivities}
          onViewAll={() => onNavigateTab('pesanan')}
        />
      </div>

      {/* Floating Action Button */}
      <FloatingPOSButton
        onClick={() => onNavigateTab('kasir')}
        label="Buka Kasir"
      />
    </div>
  );
};
