import React, { useState, useMemo } from 'react';
import { Expense, Purchase } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { filterStandaloneExpenses } from '../../utils/cashLedger';
import { Receipt, ChevronRight } from 'lucide-react';

interface OwnerExpenseSummaryProps {
  expenses: Expense[];
  purchases: Purchase[];
  onNavigateTab: (tab: string) => void;
}

export const OwnerExpenseSummary: React.FC<OwnerExpenseSummaryProps> = ({
  expenses,
  purchases,
  onNavigateTab,
}) => {
  const [expenseRange, setExpenseRange] = useState<'today' | 'week' | 'month'>('today');

  // Time boundary filter
  const timeBoundary = useMemo(() => {
    const now = new Date();
    if (expenseRange === 'today') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    }
    if (expenseRange === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.getTime();
    }
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }, [expenseRange]);

  // Breakdown calculation
  const breakdown = useMemo(() => {
    // 1. Pembelian Bahan (Actual PO purchases)
    const validPurchases = purchases.filter(
      (p) =>
        p.status !== 'VOID' &&
        new Date(p.date || p.createdAt).getTime() >= timeBoundary
    );
    const totalPurchases = validPurchases.reduce((s, p) => s + (p.totalAmount || 0), 0);

    // 2. Operational & Salaries (Standalone Expenses)
    const standaloneExp = filterStandaloneExpenses(expenses).filter(
      (e) => new Date(e.date || e.createdAt).getTime() >= timeBoundary
    );

    let totalGaji = 0;
    let totalOperasional = 0;
    let totalLainnya = 0;

    for (const e of standaloneExp) {
      const cat = (e.category || '').toLowerCase();
      const note = (e.note || '').toLowerCase();
      const amt = e.amount || 0;

      if (cat.includes('gaji') || note.includes('gaji') || note.includes('payroll')) {
        totalGaji += amt;
      } else if (
        cat.includes('operasional') ||
        cat.includes('listrik') ||
        cat.includes('sewa') ||
        cat.includes('pemasaran') ||
        cat.includes('utilitas') ||
        cat.includes('kebersihan')
      ) {
        totalOperasional += amt;
      } else {
        totalLainnya += amt;
      }
    }

    const grandTotal = totalPurchases + totalOperasional + totalGaji + totalLainnya;

    const getPct = (val: number) => (grandTotal > 0 ? Math.round((val / grandTotal) * 100) : 0);

    return {
      totalPurchases,
      totalOperasional,
      totalGaji,
      totalLainnya,
      grandTotal,
      purchasesPct: getPct(totalPurchases),
      operasionalPct: getPct(totalOperasional),
      gajiPct: getPct(totalGaji),
      lainnyaPct: getPct(totalLainnya),
    };
  }, [expenses, purchases, timeBoundary]);

  return (
    <div className="bg-white rounded-2xl border border-[#E8ECF2] shadow-2xs p-4 sm:p-5 flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-50 text-[#F04438]">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[#172033] tracking-tight">
                Ringkasan Pengeluaran
              </h3>
              <p className="text-[11px] text-[#667085]">
                Pembelian bahan &amp; biaya operasional
              </p>
            </div>
          </div>

          <div className="relative">
            <select
              value={expenseRange}
              onChange={(e) => setExpenseRange(e.target.value as any)}
              className="bg-[#F7F8FA] hover:bg-[#F1F4F8] text-[#172033] text-xs font-bold rounded-xl h-8 px-2.5 pr-6 border border-[#E8ECF2] cursor-pointer focus:outline-none appearance-none"
            >
              <option value="today">Hari Ini</option>
              <option value="week">7 Hari</option>
              <option value="month">Bulan Ini</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#667085]">
              <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Donut Chart & Legend Breakdown Grid */}
        {breakdown.grandTotal === 0 ? (
          <div className="py-6 text-center text-slate-400">
            <Receipt className="w-6 h-6 mx-auto mb-1.5 opacity-30 text-rose-500" />
            <p className="text-xs font-bold text-[#172033]">Belum ada pengeluaran pada periode ini</p>
            <p className="text-[10px] text-[#667085]">
              Pengeluaran operasional dan belanja bahan akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center my-1">
            {/* SVG Donut Ring */}
            <div className="sm:col-span-5 relative flex items-center justify-center p-1">
              <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 36 36">
                {/* Background Ring */}
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#F7F8FA"
                  strokeWidth="3.6"
                />

                {/* Donut Segments */}
                {/* 1. Purchases (Red #F04438) */}
                {breakdown.purchasesPct > 0 && (
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#F04438"
                    strokeWidth="3.8"
                    strokeDasharray={`${breakdown.purchasesPct}, 100`}
                  />
                )}
                {/* 2. Operasional (Blue #2F80ED) */}
                {breakdown.operasionalPct > 0 && (
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#2F80ED"
                    strokeWidth="3.8"
                    strokeDasharray={`${breakdown.operasionalPct}, 100`}
                    strokeDashoffset={`-${breakdown.purchasesPct}`}
                  />
                )}
                {/* 3. Gaji (Green #12B76A) */}
                {breakdown.gajiPct > 0 && (
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#12B76A"
                    strokeWidth="3.8"
                    strokeDasharray={`${breakdown.gajiPct}, 100`}
                    strokeDashoffset={`-${breakdown.purchasesPct + breakdown.operasionalPct}`}
                  />
                )}
                {/* 4. Lainnya (Yellow #F79009) */}
                {breakdown.lainnyaPct > 0 && (
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#F79009"
                    strokeWidth="3.8"
                    strokeDasharray={`${breakdown.lainnyaPct}, 100`}
                    strokeDashoffset={`-${breakdown.purchasesPct + breakdown.operasionalPct + breakdown.gajiPct}`}
                  />
                )}
              </svg>

              {/* Center Donut Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
                <span className="text-[10px] sm:text-[11px] font-black text-[#172033] tracking-tight leading-tight">
                  {formatRupiah(breakdown.grandTotal)}
                </span>
                <span className="text-[8px] font-bold text-[#667085] uppercase tracking-wider">
                  Total
                </span>
              </div>
            </div>

            {/* Category Legend Breakdown List */}
            <div className="sm:col-span-7 space-y-1.5 text-xs">
              {/* Pembelian Bahan */}
              <div className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#F04438]" />
                  <span className="font-semibold text-[#172033] text-[11px]">Pembelian Bahan</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-[#172033] text-[11px]">{breakdown.purchasesPct}%</span>
                </div>
              </div>

              {/* Operasional */}
              <div className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#2F80ED]" />
                  <span className="font-semibold text-[#172033] text-[11px]">Operasional</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-[#172033] text-[11px]">{breakdown.operasionalPct}%</span>
                </div>
              </div>

              {/* Gaji */}
              <div className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#12B76A]" />
                  <span className="font-semibold text-[#172033] text-[11px]">Gaji</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-[#172033] text-[11px]">{breakdown.gajiPct}%</span>
                </div>
              </div>

              {/* Lainnya */}
              <div className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#F79009]" />
                  <span className="font-semibold text-[#172033] text-[11px]">Lainnya</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-[#172033] text-[11px]">{breakdown.lainnyaPct}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Link Button */}
      <div className="mt-3 pt-2.5 border-t border-[#E8ECF2]">
        <button
          type="button"
          onClick={() => onNavigateTab('pengeluaran')}
          className="w-full py-2 px-3 rounded-xl bg-[#F7F8FA] hover:bg-[#F1F4F8] text-[#172033] font-bold text-xs flex items-center justify-center gap-1 border border-[#E8ECF2] transition-all cursor-pointer"
        >
          <span>Lihat Detail Pengeluaran</span>
          <ChevronRight className="w-3.5 h-3.5 text-[#667085]" />
        </button>
      </div>
    </div>
  );
};
