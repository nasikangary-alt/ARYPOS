import React, { useMemo } from 'react';
import { Sale } from '../../types';
import { formatRupiah, formatNumber } from '../../utils/formatters';
import { getProductImageUrl, getProductInitials, getProductInitialBadgeStyle } from '../../utils/productImages';
import { Flame, ChevronRight } from 'lucide-react';

interface OwnerTopProductsProps {
  sales: Sale[];
  onNavigateTab: (tab: string) => void;
}

export const OwnerTopProducts: React.FC<OwnerTopProductsProps> = ({ sales, onNavigateTab }) => {
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    const completed = sales.filter((s) => s.status === 'COMPLETED');

    completed.forEach((s) => {
      (s.items || []).forEach((item) => {
        const name = item.productName || 'Produk';
        const existing = map.get(name) || { name, qty: 0, revenue: 0 };
        map.set(name, {
          name,
          qty: existing.qty + (item.quantity || 0),
          revenue: existing.revenue + (item.subtotal || 0),
        });
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [sales]);

  return (
    <div className="bg-white rounded-2xl border border-[#E8ECF2] shadow-2xs p-4 sm:p-5 flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-50 text-[#FF641F]">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[#172033] tracking-tight">
                Produk Terlaris
              </h3>
              <p className="text-[11px] text-[#667085]">
                Peringkat menu terlaris berdasarkan kuantitas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('pesanan')}
            className="text-xs font-bold text-[#FF641F] hover:text-orange-700 flex items-center gap-0.5 cursor-pointer hover:underline"
          >
            <span>Lihat Semua</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Compact Table */}
        {topProducts.length === 0 ? (
          <div className="py-6 text-center text-slate-400">
            <Flame className="w-6 h-6 mx-auto mb-1.5 opacity-30 text-[#FF641F]" />
            <p className="text-xs font-bold text-[#172033]">Belum ada penjualan pada periode ini</p>
            <p className="text-[10px] text-[#667085]">
              Menu terlaris akan otomatis terisi saat transaksi tercatat.
            </p>
          </div>
        ) : (
          <div className="w-full">
            {/* Table Header */}
            <div className="grid grid-cols-12 text-[10px] font-bold text-[#667085] uppercase tracking-wider px-2 py-1.5 border-b border-slate-100 mb-1">
              <span className="col-span-1 text-center">#</span>
              <span className="col-span-6">Produk</span>
              <span className="col-span-2 text-right">Terjual</span>
              <span className="col-span-3 text-right">Omzet</span>
            </div>

            {/* Table Rows */}
            <div className="space-y-1">
              {topProducts.map((p, idx) => {
                const imgUrl = getProductImageUrl(p.name);
                const initials = getProductInitials(p.name);
                const initialStyle = getProductInitialBadgeStyle(p.name);

                return (
                  <div
                    key={p.name}
                    className="grid grid-cols-12 items-center p-1.5 rounded-xl hover:bg-[#F7F8FA] transition-colors text-xs"
                  >
                    {/* Rank */}
                    <div className="col-span-1 flex justify-center">
                      <span
                        className={`w-5 h-5 rounded-full font-black text-[10px] flex items-center justify-center shrink-0 ${
                          idx === 0
                            ? 'bg-amber-500 text-white'
                            : idx === 1
                            ? 'bg-slate-300 text-slate-800'
                            : idx === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {idx + 1}
                      </span>
                    </div>

                    {/* Product Name & Thumbnail */}
                    <div className="col-span-6 flex items-center gap-2 min-w-0 pr-1">
                      <div className="w-7 h-7 rounded-lg overflow-hidden relative shrink-0 bg-slate-100 border border-slate-200">
                        <img
                          src={imgUrl}
                          alt={p.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div
                          className={`absolute inset-0 flex items-center justify-center font-bold text-[9px] ${initialStyle.bg}`}
                          style={{ zIndex: -1 }}
                        >
                          {initials}
                        </div>
                      </div>
                      <span className="font-bold text-[#172033] truncate text-xs">
                        {p.name}
                      </span>
                    </div>

                    {/* Terjual */}
                    <div className="col-span-2 text-right font-extrabold text-[#FF641F] text-xs">
                      {formatNumber(p.qty)}
                    </div>

                    {/* Omzet */}
                    <div className="col-span-3 text-right font-semibold text-[#172033] text-xs">
                      {formatRupiah(p.revenue)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
