import React, { useMemo } from 'react';
import { Ingredient, Product, Purchase } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';

interface OwnerAlertsProps {
  ingredients: Ingredient[];
  products: Product[];
  purchases: Purchase[];
  walletGofood: number;
  walletGrabfood: number;
  walletShopeefood: number;
  onNavigateTab: (tab: string) => void;
}

export const OwnerAlerts: React.FC<OwnerAlertsProps> = ({
  ingredients,
  products,
  purchases,
  walletGofood,
  walletGrabfood,
  walletShopeefood,
  onNavigateTab,
}) => {
  // 1. Critical stock calculation
  const criticalStockItems = useMemo(() => {
    const list: string[] = [];
    ingredients.forEach((ing) => {
      const min = ing.minimumStock || 5;
      if (ing.stock <= min) {
        list.push(ing.name);
      }
    });
    products.forEach((prod) => {
      if ((prod.stock || 0) <= 5) {
        list.push(`${prod.name} (Produk)`);
      }
    });
    return list;
  }, [ingredients, products]);

  // 2. Unpaid purchases calculation
  const unpaidPurchases = useMemo(() => {
    return purchases.filter((p) => p.status !== 'VOID' && (p.remainingAmount || 0) > 0);
  }, [purchases]);

  const totalUnpaidDebt = useMemo(() => {
    return unpaidPurchases.reduce((sum, p) => sum + (p.remainingAmount || 0), 0);
  }, [unpaidPurchases]);

  // 3. Unsettled platform wallet calculation
  const totalUnsettledWallet = walletGofood + walletGrabfood + walletShopeefood;

  const hasAnyAlerts =
    criticalStockItems.length > 0 ||
    unpaidPurchases.length > 0 ||
    totalUnsettledWallet > 0;

  return (
    <div className="bg-white rounded-2xl border border-[#E8ECF2] shadow-2xs p-4 sm:p-5 flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-50 text-[#F79009]">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[#172033] tracking-tight">
                Perlu Perhatian
              </h3>
              <p className="text-[11px] sm:text-xs text-[#667085]">
                Pusat peringatan operasional &amp; keuangan
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('stok')}
            className="text-xs font-bold text-[#FF641F] hover:text-orange-700 flex items-center gap-0.5 cursor-pointer hover:underline"
          >
            <span>Lihat Semua</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Alerts List */}
        <div className="space-y-2">
          {/* Critical Stock Alert */}
          {criticalStockItems.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigateTab('stok')}
              className="w-full text-left p-2.5 rounded-xl bg-rose-50/80 hover:bg-rose-100/80 border border-rose-200/80 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-rose-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                  {criticalStockItems.length}
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-xs text-rose-950 block truncate">
                    {criticalStockItems.length} bahan stok kritis
                  </span>
                  <span className="text-[10px] text-rose-700 block truncate font-medium">
                    {criticalStockItems.slice(0, 2).join(', ')}
                    {criticalStockItems.length > 2 && ` +${criticalStockItems.length - 2} lainnya`}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-rose-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>
          )}

          {/* Unpaid Purchases Alert */}
          {unpaidPurchases.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigateTab('pembelian')}
              className="w-full text-left p-2.5 rounded-xl bg-orange-50/80 hover:bg-orange-100/80 border border-orange-200/80 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-orange-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                  {unpaidPurchases.length}
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-xs text-orange-950 block truncate">
                    {unpaidPurchases.length} pembelian belum dibayar
                  </span>
                  <span className="text-[10px] text-orange-800 font-bold block truncate">
                    Total {formatRupiah(totalUnpaidDebt)}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-orange-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>
          )}

          {/* Unsettled Platform Settlement Alert */}
          {totalUnsettledWallet > 0 && (
            <button
              type="button"
              onClick={() => onNavigateTab('kas_saldo')}
              className="w-full text-left p-2.5 rounded-xl bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200/80 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                  !
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-xs text-amber-950 block truncate">
                    {formatRupiah(totalUnsettledWallet)} belum settlement
                  </span>
                  <span className="text-[10px] text-amber-800 font-medium block truncate">
                    Platform: {walletGofood > 0 ? 'GoFood ' : ''}{walletGrabfood > 0 ? 'GrabFood ' : ''}{walletShopeefood > 0 ? 'ShopeeFood' : ''}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>
          )}

          {/* All Safe State */}
          {!hasAnyAlerts && (
            <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-[#12B76A] shrink-0" />
              <div>
                <span className="font-bold text-xs text-emerald-950 block">
                  Tidak ada masalah yang perlu ditindaklanjuti
                </span>
                <span className="text-[10px] text-emerald-700 font-medium block">
                  Semua stok, pembayaran, dan saldo e-wallet dalam kondisi normal.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
