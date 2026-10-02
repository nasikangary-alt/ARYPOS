import React, { useState, useMemo } from 'react';
import { Sale } from '../../types';
import { formatNumber, formatRupiah } from '../../utils/formatters';
import { normalizeSaleFinancials } from '../../utils/saleChannel';
import { Clock, Zap, ShoppingBag } from 'lucide-react';

interface OwnerHourlySalesProps {
  sales: Sale[];
}

export const OwnerHourlySales: React.FC<OwnerHourlySalesProps> = ({ sales }) => {
  const [hourlyRange, setHourlyRange] = useState<'today' | 'yesterday' | 'week'>('today');
  const [hoveredHourIndex, setHoveredHourIndex] = useState<number | null>(null);

  // Filter sales based on selected range
  const relevantSales = useMemo(() => {
    const now = new Date();
    const completed = sales.filter((s) => s.status === 'COMPLETED');

    if (hourlyRange === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return completed.filter((s) => new Date(s.createdAt).getTime() >= todayStart);
    }
    if (hourlyRange === 'yesterday') {
      const yStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
      const yEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return completed.filter((s) => {
        const ts = new Date(s.createdAt).getTime();
        return ts >= yStart && ts < yEnd;
      });
    }
    // 7 days
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
    return completed.filter((s) => new Date(s.createdAt).getTime() >= weekStart);
  }, [sales, hourlyRange]);

  // Hourly distribution (08:00 to 22:00)
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 15 }, (_, i) => i + 8); // Hours 08 to 22
    const result = hours.map((h) => {
      const hSales = relevantSales.filter((s) => {
        const d = new Date(s.createdAt);
        return d.getHours() === h;
      });

      let omzet = 0;
      for (const s of hSales) {
        omzet += normalizeSaleFinancials(s).foodTotal;
      }

      return {
        hour: h,
        hourLabel: `${String(h).padStart(2, '0')}:00`,
        timeRangeLabel: `${String(h).padStart(2, '0')}:00 - ${String(h + 1).padStart(2, '0')}:00`,
        count: hSales.length,
        omzet,
      };
    });

    return result;
  }, [relevantSales]);

  // Peak hour
  const peakHour = useMemo(() => {
    if (relevantSales.length === 0) return null;
    let max = hourlyData[0];
    for (const h of hourlyData) {
      if (h.count > max.count) {
        max = h;
      }
    }
    return max.count > 0 ? max : null;
  }, [hourlyData, relevantSales]);

  const maxHourCount = useMemo(() => {
    const max = Math.max(...hourlyData.map((h) => h.count), 5);
    return max;
  }, [hourlyData]);

  const totalTxCount = relevantSales.length;

  return (
    <div className="bg-white rounded-2xl border border-[#E8ECF2] shadow-2xs p-4 sm:p-5 flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[#172033] tracking-tight">
                Penjualan per Jam
              </h3>
              <p className="text-[11px] text-[#667085]">
                Kepadatan transaksi &amp; jam tersibuk
              </p>
            </div>
          </div>

          <div className="relative">
            <select
              value={hourlyRange}
              onChange={(e) => setHourlyRange(e.target.value as any)}
              className="bg-[#F7F8FA] hover:bg-[#F1F4F8] text-[#172033] text-xs font-bold rounded-xl h-8 px-2.5 pr-6 border border-[#E8ECF2] cursor-pointer focus:outline-none appearance-none"
            >
              <option value="today">Hari Ini</option>
              <option value="yesterday">Kemarin</option>
              <option value="week">7 Hari</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#667085]">
              <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Hourly Density Bars */}
        {totalTxCount === 0 ? (
          <div className="py-6 text-center text-slate-400">
            <Clock className="w-6 h-6 mx-auto mb-1.5 opacity-30 text-blue-500" />
            <p className="text-xs font-bold text-[#172033]">Belum ada transaksi di jam operasional</p>
            <p className="text-[10px] text-[#667085]">
              Grafik kepadatan akan otomatis terbentuk saat transaksi masuk.
            </p>
          </div>
        ) : (
          <div className="my-1">
            <div className="relative pt-6 pb-1 h-32 flex items-end justify-between gap-1">
              {hourlyData.map((item, idx) => {
                const heightPct = Math.max((item.count / maxHourCount) * 88, item.count > 0 ? 12 : 4);
                const isHovered = hoveredHourIndex === idx;
                const isPeak = peakHour && peakHour.hour === item.hour && item.count > 0;

                return (
                  <div
                    key={item.hour}
                    onMouseEnter={() => setHoveredHourIndex(idx)}
                    onMouseLeave={() => setHoveredHourIndex(null)}
                    className="relative flex-1 flex flex-col items-center justify-end h-full group cursor-pointer"
                  >
                    {/* Tooltip */}
                    {isHovered && (
                      <div className="absolute -top-12 z-30 bg-[#0B132B] text-white p-2 rounded-xl shadow-xl text-[10px] font-medium whitespace-nowrap pointer-events-none transform -translate-x-1/2 left-1/2 border border-slate-700 animate-in fade-in zoom-in-95 duration-150">
                        <div className="font-extrabold text-blue-400">{item.timeRangeLabel}</div>
                        <div>{item.count} Transaksi ({formatRupiah(item.omzet)})</div>
                      </div>
                    )}

                    {/* Bar */}
                    <div
                      className={`w-full max-w-[20px] rounded-t-sm transition-all duration-200 ${
                        isPeak
                          ? 'bg-[#2F80ED] shadow-xs'
                          : isHovered
                          ? 'bg-blue-600'
                          : item.count > 0
                          ? 'bg-blue-300'
                          : 'bg-slate-100'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />

                    {/* Hour Label */}
                    <span className="text-[9px] font-semibold text-slate-500 mt-1">
                      {String(item.hour).padStart(2, '0')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Summary Metric Badges */}
      <div className="mt-3 pt-2.5 border-t border-[#E8ECF2] grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-100 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold text-emerald-800 uppercase block tracking-wider">
              Jam Tersibuk
            </span>
            <span className="text-xs font-black text-emerald-950 block truncate">
              {peakHour ? peakHour.timeRangeLabel : '-'}
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-100 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 shrink-0">
            <ShoppingBag className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold text-blue-800 uppercase block tracking-wider">
              Total Transaksi
            </span>
            <span className="text-xs font-black text-blue-950 block truncate">
              {formatNumber(totalTxCount)} transaksi
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
