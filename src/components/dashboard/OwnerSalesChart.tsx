import React, { useState, useMemo } from 'react';
import { Sale } from '../../types';
import { formatRupiah, formatNumber } from '../../utils/formatters';
import { normalizeSaleFinancials } from '../../utils/saleChannel';
import { BarChart2 } from 'lucide-react';

interface OwnerSalesChartProps {
  sales: Sale[];
  resolveSoldItemUnitHpp: (productId: string, productName: string, snapshotUnitHpp?: number) => number;
}

export const OwnerSalesChart: React.FC<OwnerSalesChartProps> = ({
  sales,
  resolveSoldItemUnitHpp,
}) => {
  const [chartRange, setChartRange] = useState<'7days' | '30days' | 'thisMonth'>('30days');
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Generate daily data points based on selected chartRange
  const dailyData = useMemo(() => {
    const now = new Date();
    const result: Array<{
      dayLabel: string;
      shortDateLabel: string;
      fullDateLabel: string;
      dateKey: string;
      omzet: number;
      transactions: number;
      hpp: number;
      grossProfit: number;
    }> = [];

    let daysCount = 30;
    if (chartRange === '7days') daysCount = 7;
    else if (chartRange === 'thisMonth') {
      daysCount = Math.max(1, now.getDate());
    }

    const completedSales = sales.filter((s) => s.status === 'COMPLETED');

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const yearStr = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      const dateKey = `${yearStr}-${monthStr}-${dayStr}`;

      const dayName =
        i === 0
          ? 'Hari Ini'
          : d.toLocaleDateString('id-ID', { weekday: 'short' });
      const shortDateLabel = `${d.getDate()} ${d.toLocaleDateString('id-ID', { month: 'short' })}`;
      const fullDateLabel = `${d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`;

      // Filter sales on this specific calendar date
      const daySales = completedSales.filter((s) => {
        const sDate = new Date(s.createdAt);
        const sKey = `${sDate.getFullYear()}-${String(sDate.getMonth() + 1).padStart(2, '0')}-${String(sDate.getDate()).padStart(2, '0')}`;
        return sKey === dateKey;
      });

      let omzet = 0;
      let hpp = 0;
      for (const s of daySales) {
        const fin = normalizeSaleFinancials(s);
        omzet += fin.foodTotal;

        let saleHpp = 0;
        for (const it of s.items || []) {
          saleHpp +=
            resolveSoldItemUnitHpp(it.productId, it.productName, it.hppPerItem) *
            (it.quantity || 0);
        }
        if (saleHpp === 0 && (s.totalHpp || 0) > 0) {
          saleHpp = s.totalHpp || 0;
        }
        hpp += saleHpp;
      }

      result.push({
        dayLabel: dayName,
        shortDateLabel,
        fullDateLabel,
        dateKey,
        omzet,
        transactions: daySales.length,
        hpp,
        grossProfit: omzet - hpp,
      });
    }

    return result;
  }, [sales, chartRange, resolveSoldItemUnitHpp]);

  // Aggregate metrics for bottom summary strip
  const chartTotals = useMemo(() => {
    const totalOmzet = dailyData.reduce((sum, d) => sum + d.omzet, 0);
    const totalTx = dailyData.reduce((sum, d) => sum + d.transactions, 0);
    const totalHpp = dailyData.reduce((sum, d) => sum + d.hpp, 0);
    const totalGrossProfit = totalOmzet - totalHpp;
    const avgTxValue = totalTx > 0 ? totalOmzet / totalTx : 0;
    const marginPct = totalOmzet > 0 ? (totalGrossProfit / totalOmzet) * 100 : 0;

    return {
      totalOmzet,
      totalTx,
      totalGrossProfit,
      avgTxValue,
      marginPct,
    };
  }, [dailyData]);

  const maxOmzet = useMemo(() => {
    const actualMax = Math.max(...dailyData.map((d) => d.omzet), 0);
    return Math.max(actualMax * 1.15, 2000000);
  }, [dailyData]);

  const maxTx = useMemo(() => {
    const actualMax = Math.max(...dailyData.map((d) => d.transactions), 0);
    return Math.max(actualMax * 1.2, 50);
  }, [dailyData]);

  const totalBars = dailyData.length;

  // Selected horizontal labels to prevent overlapping or repeating
  const xLabels = useMemo(() => {
    if (totalBars <= 7) {
      return dailyData.map((item, idx) => ({
        key: item.dateKey,
        text: item.dayLabel,
        percent: ((idx + 0.5) / totalBars) * 100,
        align: (idx === 0 ? 'left' : idx === totalBars - 1 ? 'right' : 'center') as 'left' | 'right' | 'center',
        isToday: idx === totalBars - 1,
      }));
    }

    // Pick 6 to 8 nicely distributed indices
    const targetCount = 7;
    const step = (totalBars - 1) / (targetCount - 1);
    const indices: number[] = [];
    for (let i = 0; i < targetCount; i++) {
      const idx = Math.min(Math.round(i * step), totalBars - 1);
      if (!indices.includes(idx)) {
        indices.push(idx);
      }
    }

    return indices.map((idx, pos) => {
      const item = dailyData[idx];
      const isFirst = pos === 0;
      const isLast = pos === indices.length - 1;
      return {
        key: item.dateKey,
        text: item.shortDateLabel,
        percent: ((idx + 0.5) / totalBars) * 100,
        align: (isFirst ? 'left' : isLast ? 'right' : 'center') as 'left' | 'right' | 'center',
        isToday: idx === totalBars - 1,
      };
    });
  }, [dailyData, totalBars]);

  // SVG Line path points calculation for Omzet trend
  const linePoints = useMemo(() => {
    if (totalBars <= 1) return '';
    return dailyData
      .map((item, idx) => {
        const x = ((idx + 0.5) / totalBars) * 100;
        const y = 100 - (item.omzet / maxOmzet) * 82;
        return `${x},${y}`;
      })
      .join(' ');
  }, [dailyData, maxOmzet, totalBars]);

  return (
    <div className="bg-white rounded-2xl border border-[#E8ECF2] shadow-2xs p-4 sm:p-5 flex flex-col justify-between">
      {/* Header & Controls */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-50 text-[#FF641F]">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[#172033] tracking-tight">
                Grafik Penjualan
              </h3>
              <p className="text-[11px] sm:text-xs text-[#667085]">
                Tren omzet &amp; volume transaksi
              </p>
            </div>
          </div>

          {/* Range Selector Pill */}
          <div className="flex items-center bg-[#F7F8FA] p-0.5 rounded-xl border border-[#E8ECF2]">
            <button
              type="button"
              onClick={() => setChartRange('7days')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                chartRange === '7days'
                  ? 'bg-[#FF641F] text-white shadow-2xs'
                  : 'text-[#667085] hover:text-[#172033]'
              }`}
            >
              7 Hari
            </button>
            <button
              type="button"
              onClick={() => setChartRange('30days')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                chartRange === '30days'
                  ? 'bg-[#FF641F] text-white shadow-2xs'
                  : 'text-[#667085] hover:text-[#172033]'
              }`}
            >
              30 Hari
            </button>
            <button
              type="button"
              onClick={() => setChartRange('thisMonth')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                chartRange === 'thisMonth'
                  ? 'bg-[#FF641F] text-white shadow-2xs'
                  : 'text-[#667085] hover:text-[#172033]'
              }`}
            >
              Bulan Ini
            </button>
          </div>
        </div>

        {/* Legend Indicator Sub-row */}
        <div className="flex items-center gap-4 mb-2 text-xs font-bold text-[#667085]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF641F]" />
            <span>Omzet</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFE5D9] border border-[#FF641F]/30" />
            <span>Transaksi</span>
          </div>
        </div>

        {/* Main Chart Area */}
        <div className="relative my-1">
          {/* Guide Grid Lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40 text-[10px] text-slate-400 font-mono">
            <div className="border-b border-dashed border-slate-300 w-full flex justify-between">
              <span>Rp {formatNumber(Math.round(maxOmzet))}</span>
              <span>{Math.round(maxTx)} tx</span>
            </div>
            <div className="border-b border-dashed border-slate-300 w-full flex justify-between">
              <span>Rp {formatNumber(Math.round(maxOmzet * 0.75))}</span>
              <span>{Math.round(maxTx * 0.75)} tx</span>
            </div>
            <div className="border-b border-dashed border-slate-300 w-full flex justify-between">
              <span>Rp {formatNumber(Math.round(maxOmzet * 0.5))}</span>
              <span>{Math.round(maxTx * 0.5)} tx</span>
            </div>
            <div className="border-b border-dashed border-slate-300 w-full flex justify-between">
              <span>Rp {formatNumber(Math.round(maxOmzet * 0.25))}</span>
              <span>{Math.round(maxTx * 0.25)} tx</span>
            </div>
            <div className="border-b border-slate-200 w-full flex justify-between">
              <span>Rp 0</span>
              <span>0 tx</span>
            </div>
          </div>

          {/* SVG Line Overlay for Omzet */}
          <div className="absolute inset-0 pt-6 pb-2 px-1 pointer-events-none z-20">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
              {linePoints && (
                <polyline
                  fill="none"
                  stroke="#FF641F"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={linePoints}
                />
              )}
              {dailyData.map((item, idx) => {
                if (item.omzet <= 0 && item.transactions <= 0) return null;
                const x = ((idx + 0.5) / totalBars) * 100;
                const y = 100 - (item.omzet / maxOmzet) * 82;
                return (
                  <circle
                    key={`pt-${item.dateKey}`}
                    cx={`${x}`}
                    cy={`${y}`}
                    r="3"
                    className="fill-white stroke-[#FF641F] stroke-[2]"
                  />
                );
              })}
            </svg>
          </div>

          {/* Bars Container */}
          <div className="relative z-10 pt-6 pb-1 h-44 sm:h-48 flex items-end justify-between gap-1 px-1">
            {dailyData.map((item, idx) => {
              const barHeightPct =
                maxTx > 0
                  ? Math.max((item.transactions / maxTx) * 82, item.transactions > 0 ? 8 : 3)
                  : 3;
              const isHovered = hoveredBarIndex === idx;
              const isToday = idx === totalBars - 1;

              return (
                <div
                  key={item.dateKey}
                  onMouseEnter={() => setHoveredBarIndex(idx)}
                  onMouseLeave={() => setHoveredBarIndex(null)}
                  className="relative flex-1 flex flex-col items-center justify-end h-full group cursor-pointer"
                >
                  {/* Tooltip on Hover */}
                  {isHovered && (
                    <div className="absolute -top-16 z-30 bg-[#0B132B] text-white p-2.5 rounded-xl shadow-xl text-[10px] font-medium whitespace-nowrap pointer-events-none transform -translate-x-1/2 left-1/2 border border-slate-700 animate-in fade-in zoom-in-95 duration-150">
                      <div className="font-extrabold text-[#FF641F] text-xs mb-0.5">
                        {item.fullDateLabel}
                      </div>
                      <div className="font-bold text-white">Omzet: {formatRupiah(item.omzet)}</div>
                      <div className="text-slate-300">
                        Transaksi: {item.transactions} tx &bull; Laba Kotor: {formatRupiah(item.grossProfit)}
                      </div>
                    </div>
                  )}

                  {/* Vertical Transaction Bar */}
                  <div
                    className={`w-full max-w-[28px] rounded-t-sm transition-all duration-200 ${
                      item.transactions > 0
                        ? isToday
                          ? 'bg-[#FFE5D9] border-t-2 border-[#FF641F]'
                          : isHovered
                          ? 'bg-[#FF641F]/40'
                          : 'bg-[#F2F4F7] hover:bg-slate-300'
                        : 'bg-slate-100/60'
                    }`}
                    style={{ height: `${barHeightPct}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Dedicated X-Axis Labels Row (Strictly Non-overlapping with Absolute Positioning) */}
          <div className="relative w-full h-5 mt-1 border-t border-slate-100">
            {xLabels.map((lbl) => (
              <span
                key={lbl.key}
                className={`absolute top-1 text-[10px] sm:text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  lbl.isToday ? 'text-[#FF641F] font-bold' : 'text-[#667085]'
                }`}
                style={{
                  left: `${lbl.percent}%`,
                  transform:
                    lbl.align === 'left'
                      ? 'translateX(0)'
                      : lbl.align === 'right'
                      ? 'translateX(-100%)'
                      : 'translateX(-50%)',
                }}
              >
                {lbl.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom 4 Inline Summary Blocks */}
      <div className="mt-3 pt-3 border-t border-[#E8ECF2] grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#F7F8FA] p-3 rounded-xl text-center sm:text-left">
        <div>
          <span className="text-[10px] font-semibold text-[#667085] uppercase tracking-wider block">
            TOTAL OMZET
          </span>
          <span className="text-sm font-extrabold text-[#172033] block">
            {formatRupiah(chartTotals.totalOmzet)}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-semibold text-[#667085] uppercase tracking-wider block">
            TOTAL TRANSAKSI
          </span>
          <span className="text-sm font-extrabold text-[#172033] block">
            {formatNumber(chartTotals.totalTx)}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-semibold text-[#667085] uppercase tracking-wider block">
            RATA-RATA TRANSAKSI
          </span>
          <span className="text-sm font-extrabold text-[#172033] block">
            {formatRupiah(chartTotals.avgTxValue)}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-semibold text-[#667085] uppercase tracking-wider block">
            ESTIMASI LABA KOTOR
          </span>
          <span className="text-sm font-extrabold text-[#12B76A] block">
            {formatRupiah(chartTotals.totalGrossProfit)}
          </span>
          <span className="text-[10px] text-slate-500 font-medium block">
            Margin {chartTotals.marginPct.toFixed(1).replace('.', ',')}%
          </span>
        </div>
      </div>
    </div>
  );
};
