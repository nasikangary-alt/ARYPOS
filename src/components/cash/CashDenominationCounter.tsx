import React from 'react';
import { formatRupiah, formatNumber } from '../../utils/formatters';
import { Plus, Minus, RotateCcw, Banknote, Coins } from 'lucide-react';

export interface DenominationItem {
  value: number;
  label: string;
  isCoin?: boolean;
}

export type DenominationCounts = Record<string, number>;

export const INDONESIAN_DENOMINATIONS: DenominationItem[] = [
  { value: 100000, label: 'Rp 100.000' },
  { value: 50000, label: 'Rp 50.000' },
  { value: 20000, label: 'Rp 20.000' },
  { value: 10000, label: 'Rp 10.000' },
  { value: 5000, label: 'Rp 5.000' },
  { value: 2000, label: 'Rp 2.000' },
  { value: 1000, label: 'Rp 1.000' },
  { value: 500, label: 'Rp 500', isCoin: true },
  { value: 200, label: 'Rp 200', isCoin: true },
  { value: 100, label: 'Rp 100', isCoin: true },
];

export function computeTotalFromDenominations(counts: Record<string, number>): number {
  let total = 0;
  INDONESIAN_DENOMINATIONS.forEach((d) => {
    const qty = counts[d.value.toString()] || 0;
    total += qty * d.value;
  });
  return total;
}

export const calculateDenominationTotal = computeTotalFromDenominations;

interface CashDenominationCounterProps {
  counts?: Record<string, number>;
  onChangeCounts?: (newCounts: Record<string, number>) => void;
  onChange?: (newCounts: Record<string, number>) => void;
  expectedAmount?: number;
}

export const CashDenominationCounter: React.FC<CashDenominationCounterProps> = ({
  counts = {},
  onChangeCounts,
  onChange,
}) => {
  const notifyChange = (newCounts: Record<string, number>) => {
    if (onChangeCounts) onChangeCounts(newCounts);
    if (onChange) onChange(newCounts);
  };

  const handleCountChange = (val: number, newCount: number) => {
    const clamped = Math.max(0, newCount);
    notifyChange({
      ...counts,
      [val.toString()]: clamped,
    });
  };

  const handleReset = () => {
    const zeroMap: Record<string, number> = {};
    INDONESIAN_DENOMINATIONS.forEach((d) => {
      zeroMap[d.value.toString()] = 0;
    });
    notifyChange(zeroMap);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Banknote className="w-4 h-4 text-[#FF641F]" />
          <span>Rincian Lembar &amp; Keping Uang Laci</span>
        </span>
        <button
          type="button"
          onClick={handleReset}
          className="text-[11px] font-semibold text-slate-500 hover:text-[#FF641F] flex items-center gap-1 cursor-pointer transition"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Hitungan</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
        {INDONESIAN_DENOMINATIONS.map((denom) => {
          const key = denom.value.toString();
          const currentQty = counts[key] || 0;
          const subtotal = currentQty * denom.value;

          return (
            <div
              key={denom.value}
              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition ${
                currentQty > 0
                  ? 'bg-orange-50/70 border-orange-200'
                  : 'bg-slate-50 border-slate-200/80'
              }`}
            >
              <div className="min-w-[100px]">
                <div className="flex items-center gap-1 font-bold text-slate-900">
                  {denom.isCoin ? (
                    <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  ) : (
                    <Banknote className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  )}
                  <span>{denom.label}</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Subtotal: {formatRupiah(subtotal)}
                </span>
              </div>

              {/* Stepper Inputs */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCountChange(denom.value, currentQty - 1)}
                  className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold active:scale-95 transition cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </button>

                <input
                  type="number"
                  min={0}
                  value={currentQty === 0 ? '' : currentQty}
                  onChange={(e) =>
                    handleCountChange(denom.value, parseInt(e.target.value) || 0)
                  }
                  placeholder="0"
                  className="w-12 h-7 rounded-lg bg-white border border-slate-300 text-center font-bold text-slate-900 text-xs outline-none focus:border-[#FF641F]"
                />

                <button
                  type="button"
                  onClick={() => handleCountChange(denom.value, currentQty + 1)}
                  className="w-7 h-7 rounded-lg bg-[#FF641F] text-white flex items-center justify-center font-bold active:scale-95 transition cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
