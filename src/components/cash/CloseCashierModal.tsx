import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Shift, Sale } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatRupiah, formatNumberInput } from '../../utils/formatters';
import { calculateShiftCashMetrics } from '../../utils/cashLedger';
import {
  AlertTriangle,
  LogOut,
  X,
  Loader2,
  Lock,
  CheckCircle2,
  Plus,
  Minus,
} from 'lucide-react';

interface CloseCashierModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartCount: number;
  activeShift?: Shift;
  sales: Sale[];
  onExecuteCloseShiftAndLogout: (
    actualCash?: number,
    notes?: string,
    closingDetails?: {
      expectedCash: number;
      cashDifference: number;
      closingDenominations: Record<string, number>;
    }
  ) => Promise<void>;
}

const DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500];

export const CloseCashierModal: React.FC<CloseCashierModalProps> = ({
  isOpen,
  onClose,
  cartCount,
  activeShift,
  sales,
  onExecuteCloseShiftAndLogout,
}) => {
  const { expenses, cashMutations } = useApp();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'nominal' | 'pecahan'>('nominal');
  const [directAmountInput, setDirectAmountInput] = useState<number | ''>('');
  const [denomCounts, setDenomCounts] = useState<Record<number, number>>({});
  const [hasTouchedDenom, setHasTouchedDenom] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');

  const nominalInputRef = useRef<HTMLInputElement>(null);

  // Reset form state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setDirectAmountInput('');
      setDenomCounts({});
      setHasTouchedDenom(false);
      setInputMode('nominal');
      setCloseNotes('');
      setErrorMsg(null);
      setIsSubmitting(false);
      setTimeout(() => {
        nominalInputRef.current?.focus();
      }, 80);
    }
  }, [isOpen]);

  // Calculate shift sales & cash totals matching AppContext.closeShift via cashLedger
  const shiftTotals = useMemo(() => {
    const metrics = calculateShiftCashMetrics({
      activeShift,
      sales,
      expenses,
      cashMutations,
    });
    return {
      openingCash: metrics.openingCash,
      cashSales: metrics.cashSales,
      qrisSales: metrics.qrisSales,
      transferSales: metrics.transferSales,
      expensesCash: metrics.cashExpenses,
      ownerWithdrawals: metrics.ownerWithdrawals,
      otherCashOut: Math.max(0, metrics.cashOutMutations - metrics.ownerWithdrawals),
      cashInMutations: metrics.cashInMutations,
      expectedCash: metrics.expectedCash,
      transactionCount: metrics.transactionCount,
    };
  }, [activeShift, sales, expenses, cashMutations]);

  const denomTotal = useMemo(() => {
    return DENOMINATIONS.reduce(
      (sum, d) => sum + d * (denomCounts[d] || 0),
      0
    );
  }, [denomCounts]);

  const isPhysicalCashCounted =
    inputMode === 'nominal'
      ? directAmountInput !== '' && typeof directAmountInput === 'number'
      : hasTouchedDenom;

  const actualCash: number | null = isPhysicalCashCounted
    ? inputMode === 'nominal'
      ? (directAmountInput as number)
      : denomTotal
    : null;

  const cashVariance: number | null =
    actualCash !== null ? actualCash - shiftTotals.expectedCash : null;

  if (!isOpen) return null;

  const hasOpenCart = cartCount > 0;

  const handleDirectNominalChange = (rawValue: string) => {
    const digitsOnly = rawValue.replace(/[^0-9]/g, '');
    if (!digitsOnly) {
      setDirectAmountInput('');
    } else {
      const numericVal = parseInt(digitsOnly, 10) || 0;
      setDirectAmountInput(numericVal);
    }
    setErrorMsg(null);
  };

  const updateDenomCount = (denom: number, delta: number) => {
    setHasTouchedDenom(true);
    setDenomCounts((prev) => {
      const next = Math.max(0, (prev[denom] || 0) + delta);
      return { ...prev, [denom]: next };
    });
    setErrorMsg(null);
  };

  const handleConfirm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (hasOpenCart) return;

    if (activeShift) {
      if (!isPhysicalCashCounted || actualCash === null) {
        setErrorMsg('Hitung uang fisik terlebih dahulu sebelum menutup kasir.');
        nominalInputRef.current?.focus();
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      let notes = closeNotes.trim();
      if (activeShift && actualCash !== null && cashVariance !== null) {
        if (cashVariance !== 0) {
          notes = `${notes ? notes + ' | ' : ''}Selisih kas tutup shift: ${
            cashVariance > 0 ? '+' : ''
          }${formatRupiah(cashVariance)}`;
        }
        const closingDenominations: Record<string, number> = {};
        if (inputMode === 'pecahan') {
          DENOMINATIONS.forEach((d) => {
            if (denomCounts[d]) closingDenominations[String(d)] = denomCounts[d];
          });
        }
        await onExecuteCloseShiftAndLogout(actualCash, notes, {
          expectedCash: shiftTotals.expectedCash,
          cashDifference: cashVariance,
          closingDenominations,
        });
      } else {
        await onExecuteCloseShiftAndLogout(undefined, notes);
      }
    } catch (err: any) {
      console.error('Error closing cashier session:', err);
      setErrorMsg(err?.message || 'Gagal menutup kasir. Silakan coba lagi.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-hidden select-none">
      <form
        onSubmit={handleConfirm}
        className="bg-white rounded-[24px] max-w-[370px] w-full p-5 shadow-2xl border border-[#E5E5EA] space-y-3.5 overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* 1. Compact Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF6F0] border border-[#FF641F]/20 text-[#FF641F] flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-extrabold text-[#172033] tracking-wide uppercase leading-tight">
                TUTUP KASIR
              </h3>
              <p className="text-[11px] text-[#8E8E93] font-medium">
                Hitung uang fisik di laci &amp; keluar sesi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-full text-[#8E8E93] hover:text-[#172033] hover:bg-[#F7F7F8] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning if open cart exists */}
        {hasOpenCart && (
          <div className="p-3 rounded-[14px] bg-[#FFFAEB] border border-[#FEDF89] text-[#B54708] text-[11px] font-semibold flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[#F79009] shrink-0 mt-0.5" />
            <span>
              Selesaikan transaksi di keranjang ({cartCount} item) sebelum menutup kasir.
            </span>
          </div>
        )}

        {activeShift ? (
          <>
            {/* 2. KAS DI LACI Summary */}
            <div className="p-3.5 rounded-[16px] bg-[#F7F7F8] border border-[#E5E5EA] space-y-2 text-[12px]">
              <div className="text-[11px] font-extrabold text-[#FF641F] uppercase tracking-wider">
                KAS DI LACI
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[#667085]">
                  <span>Modal awal</span>
                  <span className="font-semibold text-[#172033]">
                    {formatRupiah(shiftTotals.openingCash)}
                  </span>
                </div>
                <div className="flex justify-between text-[#667085]">
                  <span>Penjualan tunai</span>
                  <span className="font-semibold text-[#12B76A]">
                    +{formatRupiah(shiftTotals.cashSales)}
                  </span>
                </div>
                {shiftTotals.cashInMutations > 0 && (
                  <div className="flex justify-between text-[#667085]">
                    <span>Kas masuk</span>
                    <span className="font-semibold text-[#12B76A]">
                      +{formatRupiah(shiftTotals.cashInMutations)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-[#667085]">
                  <span>Diambil owner</span>
                  <span
                    className={`font-semibold ${
                      shiftTotals.ownerWithdrawals > 0 ? 'text-[#D92D20]' : 'text-[#667085]'
                    }`}
                  >
                    -{formatRupiah(shiftTotals.ownerWithdrawals)}
                  </span>
                </div>
                <div className="flex justify-between text-[#667085]">
                  <span>Pengeluaran tunai</span>
                  <span
                    className={`font-semibold ${
                      shiftTotals.expensesCash > 0 ? 'text-[#D92D20]' : 'text-[#667085]'
                    }`}
                  >
                    -{formatRupiah(shiftTotals.expensesCash)}
                  </span>
                </div>
                {shiftTotals.otherCashOut > 0 && (
                  <div className="flex justify-between text-[#667085]">
                    <span>Kas keluar lainnya</span>
                    <span className="font-semibold text-[#D92D20]">
                      -{formatRupiah(shiftTotals.otherCashOut)}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#E5E5EA] flex justify-between items-baseline">
                <div>
                  <span className="font-extrabold text-[#172033] text-[12px] block">
                    Kas seharusnya
                  </span>
                  <span className="text-[10px] text-[#667085]">
                    Uang tunai yang harus ada di laci
                  </span>
                </div>
                <span className="text-[17px] font-black text-[#172033]">
                  {formatRupiah(shiftTotals.expectedCash)}
                </span>
              </div>
              {shiftTotals.qrisSales > 0 && (
                <div className="pt-1.5 border-t border-[#E5E5EA] flex items-center justify-between text-[10px] text-[#667085]">
                  <span>Kas QRIS (Penerimaan QRIS):</span>
                  <span className="font-bold text-[#1570EF]">
                    {formatRupiah(shiftTotals.qrisSales)}
                  </span>
                </div>
              )}
            </div>

            {/* 3. HITUNG UANG FISIK DI LACI */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-[#172033]">
                  Uang fisik di laci
                </span>
                <div className="flex items-center bg-[#F1F4F8] p-0.5 rounded-lg border border-[#E5E5EA] text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('nominal');
                      setErrorMsg(null);
                    }}
                    className={`px-2 py-1 rounded-md transition cursor-pointer ${
                      inputMode === 'nominal'
                        ? 'bg-white text-[#172033] shadow-2xs'
                        : 'text-[#667085]'
                    }`}
                  >
                    Input Nominal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('pecahan');
                      setErrorMsg(null);
                    }}
                    className={`px-2 py-1 rounded-md transition cursor-pointer ${
                      inputMode === 'pecahan'
                        ? 'bg-white text-[#172033] shadow-2xs'
                        : 'text-[#667085]'
                    }`}
                  >
                    Pecahan Lembar
                  </button>
                </div>
              </div>

              {inputMode === 'nominal' ? (
                <div className="space-y-1.5">
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-[15px] font-extrabold text-[#8E8E93] pointer-events-none">
                      Rp
                    </span>
                    <input
                      ref={nominalInputRef}
                      id="closing-physical-cash-input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={
                        directAmountInput === ''
                          ? ''
                          : formatNumberInput(directAmountInput)
                      }
                      onChange={(e) => handleDirectNominalChange(e.target.value)}
                      placeholder="Masukkan uang fisik di laci"
                      className="w-full h-[50px] pl-11 pr-4 rounded-[16px] bg-[#F7F7F8] border border-[#E5E5EA] text-[18px] font-extrabold text-[#172033] placeholder:text-[#8E8E93] placeholder:font-normal placeholder:text-[13px] focus:outline-none focus:border-[#FF641F] focus:bg-white transition-colors"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setDirectAmountInput(0);
                        setErrorMsg(null);
                      }}
                      className="text-[11px] font-bold text-[#FF641F] hover:underline cursor-pointer"
                    >
                      Laci Kosong (Rp 0)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#F7F7F8] border border-[#E5E5EA] rounded-[16px] p-2.5 space-y-1.5 max-h-[190px] overflow-y-auto">
                  {DENOMINATIONS.map((denom) => {
                    const count = denomCounts[denom] || 0;
                    return (
                      <div
                        key={denom}
                        className="flex items-center justify-between bg-white rounded-xl px-2.5 py-1.5 border border-[#E5E7EB] text-[12px]"
                      >
                        <span className="font-bold text-[#172033]">
                          {formatNumberInput(denom)}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateDenomCount(denom, -1)}
                            className="w-6 h-6 rounded-lg bg-[#F1F4F8] flex items-center justify-center text-[#172033] active:scale-95 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-14 text-center font-extrabold text-[#172033] text-[11px]">
                            {count} lbr
                          </span>
                          <button
                            type="button"
                            onClick={() => updateDenomCount(denom, 1)}
                            className="w-6 h-6 rounded-lg bg-[#FFF6F0] text-[#FF641F] border border-[#FF641F]/30 flex items-center justify-center active:scale-95 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. RINGKASAN KAS DI LACI: Kas seharusnya, Uang fisik di laci, Selisih */}
            {isPhysicalCashCounted && actualCash !== null && cashVariance !== null && (
              <div className="p-3.5 rounded-[16px] bg-[#F8FAFC] border border-[#E5E7EB] space-y-2 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#667085]">
                    Kas seharusnya
                  </span>
                  <span className="font-bold text-[#172033]">
                    {formatRupiah(shiftTotals.expectedCash)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#667085]">
                    Uang fisik di laci
                  </span>
                  <span className="font-extrabold text-[14px] text-[#172033]">
                    {formatRupiah(actualCash)}
                  </span>
                </div>

                <div
                  className={`pt-2 border-t border-[#E5E7EB] flex items-center justify-between ${
                    cashVariance === 0
                      ? 'text-[#027A48]'
                      : cashVariance > 0
                      ? 'text-[#175CD3]'
                      : 'text-[#D92D20]'
                  }`}
                >
                  <span className="font-bold text-[12px]">Selisih</span>
                  <span className="font-extrabold text-[14px]">
                    {cashVariance === 0
                      ? 'Rp 0'
                      : `${cashVariance > 0 ? '+' : '-'}${formatRupiah(Math.abs(cashVariance))}`}
                  </span>
                </div>

                {cashVariance === 0 ? (
                  <div className="pt-1 flex items-center gap-1.5 text-[12px] font-bold text-[#027A48]">
                    <CheckCircle2 className="w-4 h-4 text-[#12B76A] shrink-0" />
                    <span>&#10003; Kas sesuai</span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-[12px] bg-[#FFFAEB] border border-[#FEDF89] text-[#B54708] text-[11px] font-semibold flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#F79009] shrink-0 mt-0.5" />
                    <span>Jumlah uang di laci berbeda dari kas seharusnya.</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="p-3.5 rounded-[16px] bg-[#F7F7F8] border border-[#E5E5EA] text-[12px] text-[#8E8E93]">
            Tidak ada shift aktif. Tekan tombol di bawah untuk keluar dari sesi kasir.
          </div>
        )}

        {errorMsg && (
          <div className="px-3 py-2 rounded-[12px] bg-[#FEF3F2] border border-[#FECDCA] text-[#D92D20] text-[11px] font-semibold">
            {errorMsg}
          </div>
        )}

        {/* 5. Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-[50px] px-4 rounded-[15px] bg-[#F7F7F8] hover:bg-[#EFEFF4] border border-[#E5E5EA] text-[#172033] font-bold text-[12px] transition cursor-pointer disabled:opacity-50 shrink-0"
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={hasOpenCart || isSubmitting}
            className="flex-1 h-[50px] rounded-[15px] bg-[#FF641F] hover:bg-[#F45116] active:scale-[0.99] text-white font-bold text-[14px] shadow-[0_6px_16px_rgba(255,100,31,0.25)] flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4" />
                <span>TUTUP KASIR</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
