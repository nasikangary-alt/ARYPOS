import React, { useMemo } from 'react';
import { Sale, Production, Purchase, Expense } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { normalizeSaleFinancials, getOrderTypeMeta } from '../../utils/saleChannel';
import { ShoppingCart, Package, Factory, Receipt, ChevronRight, Clock } from 'lucide-react';

interface OwnerRecentActivityProps {
  sales: Sale[];
  productions: Production[];
  purchases: Purchase[];
  expenses: Expense[];
  onNavigateTab: (tab: string) => void;
}

export const OwnerRecentActivity: React.FC<OwnerRecentActivityProps> = ({
  sales,
  productions,
  purchases,
  expenses,
  onNavigateTab,
}) => {
  const activities = useMemo(() => {
    const list: Array<{
      id: string;
      category: 'Penjualan' | 'Pembelian' | 'Produksi' | 'Pengeluaran';
      title: string;
      timeAgo: string;
      valueText: string;
      timestamp: number;
      type: 'sale' | 'purchase' | 'production' | 'expense';
    }> = [];

    // Sales
    const completedSales = sales.filter((s) => s.status === 'COMPLETED');
    completedSales.slice(0, 5).forEach((s) => {
      const fin = normalizeSaleFinancials(s);
      const itemName = (s.items && s.items[0]?.productName) || 'Menu POS';
      const extraItems = (s.items || []).length > 1 ? ` +${s.items.length - 1}` : '';

      list.push({
        id: `sale-${s.id}`,
        category: 'Penjualan',
        title: `${itemName}${extraItems}`,
        timeAgo: new Date(s.createdAt).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        valueText: formatRupiah(fin.foodTotal),
        timestamp: new Date(s.createdAt).getTime(),
        type: 'sale',
      });
    });

    // Purchases
    const activePurchases = purchases.filter((p) => p.status !== 'VOID');
    activePurchases.slice(0, 3).forEach((p) => {
      const itemName =
        (p.items && p.items[0]?.targetName) ||
        p.targetName ||
        p.ingredientName ||
        'Bahan Baku';

      list.push({
        id: `purchase-${p.id}`,
        category: 'Pembelian',
        title: itemName,
        timeAgo: new Date(p.createdAt || p.date).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        valueText: formatRupiah(p.totalAmount || 0),
        timestamp: new Date(p.createdAt || p.date).getTime(),
        type: 'purchase',
      });
    });

    // Productions
    productions.slice(0, 3).forEach((p) => {
      list.push({
        id: `prod-${p.id}`,
        category: 'Produksi',
        title: p.productName,
        timeAgo: new Date(p.createdAt || Date.now()).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        valueText: `${p.totalProduced} ${p.yieldUnit || 'porsi'}`,
        timestamp: new Date(p.createdAt || 0).getTime(),
        type: 'production',
      });
    });

    // Expenses
    expenses.slice(0, 3).forEach((e) => {
      list.push({
        id: `exp-${e.id}`,
        category: 'Pengeluaran',
        title: e.note || e.category || 'Operasional',
        timeAgo: new Date(e.createdAt || e.date).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        valueText: formatRupiah(e.amount || 0),
        timestamp: new Date(e.createdAt || e.date).getTime(),
        type: 'expense',
      });
    });

    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  }, [sales, productions, purchases, expenses]);

  return (
    <div className="bg-white rounded-2xl border border-[#E8ECF2] shadow-2xs p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-slate-100 text-[#172033]">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-[#172033] tracking-tight">
              Aktivitas Terbaru
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('pesanan')}
          className="text-xs font-bold text-[#FF641F] hover:underline flex items-center gap-0.5 cursor-pointer"
        >
          <span>Lihat Semua</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 5 Horizontal Activity Cards Row */}
      {activities.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-xs">
          Belum ada aktivitas terbaru.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {activities.map((act) => {
            return (
              <div
                key={act.id}
                className="p-3 rounded-2xl bg-[#F7F8FA] border border-[#E8ECF2] flex items-center gap-3 transition hover:border-slate-300"
              >
                {/* Icon Box */}
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    act.type === 'sale'
                      ? 'bg-emerald-100 text-[#12B76A]'
                      : act.type === 'purchase'
                      ? 'bg-orange-100 text-[#FF641F]'
                      : act.type === 'production'
                      ? 'bg-purple-100 text-purple-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}
                >
                  {act.type === 'sale' && <ShoppingCart className="w-4 h-4" />}
                  {act.type === 'purchase' && <Package className="w-4 h-4" />}
                  {act.type === 'production' && <Factory className="w-4 h-4" />}
                  {act.type === 'expense' && <Receipt className="w-4 h-4" />}
                </div>

                {/* Info Text */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider">
                      {act.category}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">
                      {act.timeAgo}
                    </span>
                  </div>
                  <span className="font-extrabold text-xs text-[#172033] block truncate">
                    {act.title}
                  </span>
                  <span className="text-xs font-black text-[#172033] block mt-0.5">
                    {act.valueText}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
