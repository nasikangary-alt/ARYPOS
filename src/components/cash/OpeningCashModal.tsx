import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Shift } from '../../types';
import { formatRupiah, formatNumberInput, parseNumberInput } from '../../utils/formatters';
import {
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowRight,
  Loader2,
  LogOut,
  Banknote,
  Coins,
} from 'lucide-react';

interface OpeningCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  shifts: Shift[];
  currentStaffName: string;
  currentStaffId: string;
  isMandatory?: boolean;
  onCancelLogout?: () => Promise<void> | void;
  onConfirmStartShift: (
    openingCashConfirmedAmount: number,
    details: {
      openingCashExpected: number;
      openingCashActual: number;
      openingCashVariance: number;
      openingCashConfirmed: boolean;
      openingDenominations?: Record<string, number>;
    }
  ) => Promise<void>;
}

export const OpeningCashModal: React.FC<OpeningCashModalProps> = ({
  isOpen,
  onClose,
  shifts,
  currentStaffName,
  isMandatory = false,
  onCancelLogout,
  onConfirmStartShift,
}) => {
  const [amountInput, setAmountInput] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const nominalInputRef = useRef<HTMLInputElement>(null);

  // Find previous closed shift
  const lastClosedShift = useMemo(() => {
    const closed = shifts.filter((s) => s.status === 'CLOSED');
    if (closed.length === 0) return null;
    return closed.sort((a, b) => {
      const timeA = new Date(a.closedAt || a.openedAt).getTime();
      const timeB = new Date(b.closedAt || b.openedAt).getTime();
      return timeB - timeA;
    })[0];
  }, [shifts]);

  // Expected opening cash reference from previous shift's actual closing physical cash
  const expectedOpeningCash = useMemo(() => {
    if (!lastClosedShift) return 0;
    return typeof lastClosedShift.actualCash === 'number'
      ? lastClosedShift.actualCash
      : lastClosedShift.expectedCash ?? 0;
  }, [lastClosedShift]);

  useEffect(() => {
    if (isOpen) {
      setAmountInput('');
      setErrorMsg(null);
      setIsSubmitting(false);
      setTimeout(() => {
        nominalInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const actualAmount = typeof amountInput === 'number' ? amountInput : 0;
  const isInputFilled = amountInput !== '';
  const cashVariance = actualAmount - expectedOpeningCash;

  const handleStartShift = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isInputFilled) {
      setErrorMsg('Masukkan nominal uang fisik di laci kasir terlebih dahulu.');
      nominalInputRef.current?.focus();
      return;
    }

    if (actualAmount < 0) {
      setErrorMsg('Nominal modal awal tidak boleh negatif.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await onConfirmStartShift(actualAmount, {
        openingCashExpected: expectedOpeningCash,
        openingCashActual: actualAmount,
        openingCashVariance: cashVariance,
        openingCashConfirmed: true,
      });
      onClose();
    } catch (err: unknown) {
      console.error('Error starting shift:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membuka kasir.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-hidden select-none">
      <form
        onSubmit={handleStartShift}
        className="bg-white rounded-[24px] max-w-[400px] w-full p-6 shadow-2xl border border-[#E5E5EA] space-y-4 max-h-[92dvh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* 1. Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FFF6F0] border border-[#FF641F]/20 text-[#FF641F] flex items-center justify-center shrink-0">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#172033] leading-tight">
                Buka Kasir &bull; Modal Awal
              </h3>
              <p className="text-xs text-[#667085] font-medium mt-0.5">
                Kasir: <strong className="text-[#172033]">{currentStaffName}</strong>
              </p>
            </div>
          </div>

          {!isMandatory && (
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-full text-[#8E8E93] hover:text-[#172033] hover:bg-[#F7F7F8] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 2. Reference Sisa Shift Lalu */}
        {expectedOpeningCash > 0 && (
          <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E8ECF2] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-[#667085] block">
                Sisa Kas Shift Sebelumnya:
              </span>
              <span className="text-xs font-extrabold text-[#172033]">
                {formatRupiah(expectedOpeningCash)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setAmountInput(expectedOpeningCash);
                setErrorMsg(null);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-[#EFF8FF] text-[#175CD3] border border-[#B2DDFF] text-[11px] font-bold hover:bg-[#D1E9FF] transition cursor-pointer"
            >
              Pakai Nominal Ini
            </button>
          </div>
        )}

        {/* 3. Direct Nominal Input Field */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-[#172033]">
            Nominal Uang Fisik di Laci <span className="text-red-500">*</span>
          </label>

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-[#667085]">
              Rp
            </span>
            <input
              ref={nominalInputRef}
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={amountInput !== '' ? formatNumberInput(amountInput) : ''}
              onChange={(e) => {
                const parsed = parseNumberInput(e.target.value);
                setAmountInput(e.target.value === '' ? '' : parsed);
                setErrorMsg(null);
              }}
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl border-2 border-[#E8ECF2] bg-white text-lg font-black text-[#172033] focus:outline-none focus:border-[#FF641F] focus:ring-2 focus:ring-[#FF641F]/10 transition"
            />
          </div>

          {/* Quick Preset Buttons */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[0, 100000, 200000, 300000, 500000, 1000000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setAmountInput(preset);
                  setErrorMsg(null);
                }}
                className={`py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                  amountInput === preset
                    ? 'bg-[#FF641F] text-white border-[#FF641F]'
                    : 'bg-[#F8FAFC] text-[#475467] border-[#E8ECF2] hover:border-[#FF641F] hover:bg-[#FFF6F0]'
                }`}
              >
                {preset === 0 ? 'Rp 0' : `${preset / 1000}rb`}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Variance Status Feedback */}
        {isInputFilled && expectedOpeningCash > 0 && (
          <div
            className={`p-3 rounded-2xl border text-xs font-semibold flex items-center justify-between ${
              cashVariance === 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : cashVariance > 0
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <span>
              {cashVariance === 0
                ? 'Sesuai kas shift sebelumnya'
                : cashVariance > 0
                ? `Lebih ${formatRupiah(cashVariance)} dari shift lalu`
                : `Kurang ${formatRupiah(Math.abs(cashVariance))} dari shift lalu`}
            </span>
            <span className="font-extrabold">{formatRupiah(actualAmount)}</span>
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#F04438]" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 5. Action Buttons */}
        <div className="pt-2 space-y-2 shrink-0">
          <button
            type="submit"
            disabled={!isInputFilled || isSubmitting}
            className="w-full py-3.5 rounded-2xl bg-[#FF641F] hover:bg-[#E05212] active:scale-[0.99] text-white font-extrabold text-sm shadow-md shadow-[#FF641F]/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Membuka Kasir...</span>
              </>
            ) : (
              <>
                <span>
                  Buka Kasir ({isInputFilled ? formatRupiah(actualAmount) : 'Rp 0'})
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {isMandatory && onCancelLogout && (
            <button
              type="button"
              onClick={onCancelLogout}
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl border border-[#E8ECF2] text-[#667085] hover:text-[#D92D20] hover:bg-[#FEF3F2] hover:border-[#FECDCA] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar Akun</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
