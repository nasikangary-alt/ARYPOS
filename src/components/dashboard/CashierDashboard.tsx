import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ExpenseCategory } from '../../types';
import {
  formatRupiah,
  formatNumber,
  formatNumberInput,
  parseNumberInput,
} from '../../utils/formatters';
import { calculateProductAvailability } from '../../services/stockEngine';
import {
  calculateShiftCashMetrics,
  formatPaymentMethodBadge,
} from '../../utils/cashLedger';
import { OpeningCashModal } from '../cash/OpeningCashModal';
import { QuickDrawerPurchaseModal } from '../purchase/QuickDrawerPurchaseModal';
import {
  ShoppingBag,
  Package,
  Factory,
  ArrowRight,
  CheckCircle2,
  Banknote,
  ArrowUpRight,
  MinusCircle,
  X,
} from 'lucide-react';

interface CashierDashboardProps {
  onNavigateTab: (tab: string) => void;
}

export const CashierDashboard: React.FC<CashierDashboardProps> = ({ onNavigateTab }) => {
  const {
    sales,
    expenses,
    cashMutations,
    products,
    shifts,
    openShift,
    transferCashAccount,
    ingredientsMap,
    productsMap,
    assembliesMap,
  } = useApp();
  const { userProfile, currentEmployee } = useAuth();

  const [showOpeningCashModal, setShowOpeningCashModal] = useState(false);
  const [showOwnerWithdrawModal, setShowOwnerWithdrawModal] = useState(false);
  const [showQuickPurchaseModal, setShowQuickPurchaseModal] = useState(false);

  // Form state for Owner Withdrawal (KAS_KASIR -> KAS_OWNER)
  const [ownerWithdrawAmount, setOwnerWithdrawAmount] = useState<number>(0);
  const [ownerWithdrawNotes, setOwnerWithdrawNotes] = useState<string>('Diambil oleh Owner dari laci kasir');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expNote, setExpNote] = useState<string>('');

  // Strict shift ownership: only match OPEN shift belonging to this cashier
  const activeShift = useMemo(() => {
    if (!currentEmployee) return undefined;
    return shifts.find(
      (s) =>
        s.status === 'OPEN' &&
        Boolean(s.staffId) &&
        ((Boolean(currentEmployee.id) && s.staffId === currentEmployee.id) ||
          (Boolean(currentEmployee.uid) && s.staffId === currentEmployee.uid) ||
          (Boolean(currentEmployee.username) && s.staffId === currentEmployee.username))
    );
  }, [shifts, currentEmployee]);

  const todayStartIso = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }, []);

  // Shift & Cash Calculation — 100% consistent with closeShift() via cashLedger
  const shiftMetrics = useMemo(() => {
    return calculateShiftCashMetrics({
      activeShift,
      sales,
      expenses,
      cashMutations,
      fallbackStartIso: todayStartIso,
    });
  }, [activeShift, sales, expenses, cashMutations, todayStartIso]);

  // Stock needing attention (0 or low stock <= 5 porsi)
  const attentionProducts = useMemo(() => {
    return products
      .filter((p) => p.active !== false)
      .map((p) => {
        const availablePortions = calculateProductAvailability(
          p,
          undefined,
          ingredientsMap,
          productsMap,
          assembliesMap
        );
        return {
          id: p.id,
          name: p.name,
          stock: Math.max(0, availablePortions),
        };
      })
      .filter((p) => p.stock <= 5)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 6);
  }, [products, ingredientsMap, productsMap, assembliesMap]);

  // Latest 3-5 transactions
  const latestSales = useMemo(() => {
    return shiftMetrics.relevantSales.slice(0, 5).map((s) => {
      const rawNo = s.transactionNo || s.id.slice(-3).toUpperCase();
      const code = rawNo.startsWith('#') ? rawNo : `#${rawNo.slice(-4)}`;
      const firstItemName =
        s.items && s.items.length > 0 ? s.items[0].productName : 'Pesanan POS';
      const extraCount = s.items && s.items.length > 1 ? s.items.length - 1 : 0;
      const itemLabel = extraCount > 0 ? `${firstItemName} +${extraCount}` : firstItemName;
      const timeStr = new Date(s.createdAt).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });

      return {
        id: s.id,
        code,
        itemLabel,
        amount: s.finalAmount,
        timeStr,
        paymentMethod: formatPaymentMethodBadge(s.paymentMethod),
      };
    });
  }, [shiftMetrics.relevantSales]);

  const cashierName = currentEmployee?.name || userProfile?.displayName || 'Kasir';

  const shiftStartTimeStr = useMemo(() => {
    if (!activeShift?.openedAt) return '-';
    return new Date(activeShift.openedAt)
      .toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      })
      .replace(':', '.');
  }, [activeShift]);

  // Simple cash status during shift
  const cashStatusInfo = useMemo(() => {
    if (shiftMetrics.totalCashOut > 0) {
      return {
        dotColor: 'bg-[#FF641F]',
        textColor: 'text-[#B54708]',
        bgColor: 'bg-[#FFFAEB] border-[#FEDF89]',
        label:
          shiftMetrics.ownerWithdrawals > 0
            ? 'Ada pengambilan owner / pengeluaran'
            : 'Ada pengeluaran tunai',
      };
    }
    if (shiftMetrics.cashSales > 0 || shiftMetrics.cashInMutations > 0) {
      return {
        dotColor: 'bg-[#12B76A]',
        textColor: 'text-[#027A48]',
        bgColor: 'bg-[#ECFDF3] border-[#A6F4C5]',
        label: 'Kas aktif',
      };
    }
    return {
      dotColor: 'bg-[#12B76A]',
      textColor: 'text-[#027A48]',
      bgColor: 'bg-[#ECFDF3] border-[#A6F4C5]',
      label: 'Modal awal tercatat',
    };
  }, [
    shiftMetrics.totalCashOut,
    shiftMetrics.ownerWithdrawals,
    shiftMetrics.cashSales,
    shiftMetrics.cashInMutations,
  ]);

  const otherCashOutMutations = useMemo(() => {
    return Math.max(0, shiftMetrics.cashOutMutations - shiftMetrics.ownerWithdrawals);
  }, [shiftMetrics.cashOutMutations, shiftMetrics.ownerWithdrawals]);

  const handleSaveOwnerWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ownerWithdrawAmount <= 0) {
      alert('Nominal harus lebih dari Rp 0.');
      return;
    }
    if (ownerWithdrawAmount > shiftMetrics.expectedCash) {
      alert(
        `Nominal melebihi Kas di Laci saat ini (${formatRupiah(
          shiftMetrics.expectedCash
        )}).`
      );
      return;
    }
    setIsSubmittingAction(true);
    try {
      await transferCashAccount({
        fromAccount: 'KAS_KASIR',
        toAccount: 'KAS_OWNER',
        amount: ownerWithdrawAmount,
        type: 'SETOR_OWNER',
        title: 'Ambil Kas Laci oleh Owner',
        notes: ownerWithdrawNotes || 'Diambil Owner dari laci kasir',
      });
      setShowOwnerWithdrawModal(false);
      setOwnerWithdrawAmount(0);
    } catch (err: any) {
      alert(err?.message || 'Gagal mencatat pengambilan kas oleh Owner.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#172033] pb-24 lg:pb-10 w-full max-w-none">
      <div className="w-full max-w-none p-4 lg:p-6 space-y-5">
        {/* 1. KARTU UTAMA SHIFT AKTIF & KAS DI LACI */}
        {!activeShift ? (
          <div className="bg-white rounded-[20px] border border-[#FEDF89] p-4 shadow-[0_1px_3px_rgba(23,32,51,0.03)] space-y-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#B54708] tracking-wide uppercase">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F79009]" />
                  <span>SHIFT BELUM DIMULAI</span>
                </div>
                <div className="text-[15px] font-extrabold text-[#172033] mt-1">
                  Halo, {cashierName}
                </div>
                <p className="text-[12px] text-[#667085] mt-0.5 leading-relaxed">
                  Hitung uang tunai modal awal di laci kasir sebelum mulai melayani transaksi penjualan.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowOpeningCashModal(true)}
              className="w-full h-[48px] rounded-[16px] bg-[#FF641F] hover:bg-[#F45116] active:scale-[0.99] text-white font-extrabold text-[13px] shadow-[0_4px_12px_rgba(255,100,31,0.22)] flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Banknote className="w-4 h-4" />
              <span>BUKA KASIR (HITUNG MODAL AWAL)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-[20px] border border-[#E5E7EB] p-4 shadow-[0_1px_3px_rgba(23,32,51,0.03)] space-y-3.5">
            {/* Shift Header & Simple Status Badge */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#027A48] tracking-wide uppercase">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#12B76A]" />
                  <span>SHIFT AKTIF</span>
                </div>
                <div className="text-[14px] font-bold text-[#172033] mt-0.5">
                  {activeShift.staffName || cashierName} &bull; Mulai {shiftStartTimeStr}
                </div>
              </div>

              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] font-bold shrink-0 ${cashStatusInfo.bgColor} ${cashStatusInfo.textColor}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cashStatusInfo.dotColor}`} />
                <span>{cashStatusInfo.label}</span>
              </div>
            </div>

            {/* KAS DI LACI & RINCIAN KAS SEHARUSNYA */}
            <div className="rounded-[16px] bg-[#F8FAFC] border border-[#E5E7EB] p-4 space-y-3.5">
              {/* Primary Highlight: KAS DI LACI */}
              <div className="pb-3 border-b border-[#E5E7EB]">
                <div className="text-[11px] font-extrabold text-[#FF641F] uppercase tracking-wider">
                  KAS DI LACI
                </div>
                <div className="text-[26px] font-black text-[#172033] tracking-tight mt-0.5 leading-tight">
                  {formatRupiah(shiftMetrics.expectedCash)}
                </div>
                <div className="text-[12px] text-[#667085] font-medium mt-0.5">
                  Uang tunai yang harus ada di laci
                </div>
              </div>

              {/* Rincian Perhitungan */}
              <div className="space-y-2 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#667085]">Modal awal</span>
                  <span className="font-bold text-[#172033]">
                    {formatRupiah(shiftMetrics.openingCash)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#667085]">Penjualan tunai</span>
                  <span className="font-bold text-[#12B76A]">
                    +{formatRupiah(shiftMetrics.cashSales)}
                  </span>
                </div>

                {shiftMetrics.cashInMutations > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#667085]">Kas masuk</span>
                    <span className="font-bold text-[#12B76A]">
                      +{formatRupiah(shiftMetrics.cashInMutations)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#667085]">Diambil owner</span>
                  <span
                    className={`font-bold ${
                      shiftMetrics.ownerWithdrawals > 0 ? 'text-[#D92D20]' : 'text-[#667085]'
                    }`}
                  >
                    -{formatRupiah(shiftMetrics.ownerWithdrawals)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#667085]">Pengeluaran tunai</span>
                  <span
                    className={`font-bold ${
                      shiftMetrics.cashExpenses > 0 ? 'text-[#D92D20]' : 'text-[#667085]'
                    }`}
                  >
                    -{formatRupiah(shiftMetrics.cashExpenses)}
                  </span>
                </div>

                {otherCashOutMutations > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#667085]">Kas keluar lainnya</span>
                    <span className="font-bold text-[#D92D20]">
                      -{formatRupiah(otherCashOutMutations)}
                    </span>
                  </div>
                )}
              </div>

              {/* Footer Line: KAS SEHARUSNYA */}
              <div className="pt-3 border-t border-dashed border-[#CBD5E1] flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-[#172033] uppercase tracking-wider">
                  KAS SEHARUSNYA
                </span>
                <span className="text-[16px] font-black text-[#172033]">
                  {formatRupiah(shiftMetrics.expectedCash)}
                </span>
              </div>
            </div>

            {/* Quick Drawer Cash Actions during Active Shift */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowOwnerWithdrawModal(true)}
                className="py-2 px-3 rounded-[12px] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E5E7EB] text-[11px] font-bold text-[#172033] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-[#FF641F]" />
                <span>Diambil Owner</span>
              </button>
              <button
                type="button"
                onClick={() => setShowQuickPurchaseModal(true)}
                className="py-2 px-3 rounded-[12px] bg-[#F8FAFC] hover:bg-[#FFF4ED] border border-[#E5E7EB] hover:border-[#FF641F] text-[11px] font-bold text-[#172033] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-[#FF641F]" />
                <span>Belanja Tunai Laci</span>
              </button>
            </div>

            {/* Primary CTA: BUKA POS */}
            <button
              type="button"
              onClick={() => onNavigateTab('kasir')}
              className="w-full h-[48px] rounded-[16px] bg-[#FF641F] hover:bg-[#F45116] active:scale-[0.99] text-white font-bold text-[13px] shadow-[0_4px_12px_rgba(255,100,31,0.22)] flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <span>BUKA POS</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 2. PENJUALAN */}
        <div className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(23,32,51,0.03)] overflow-hidden divide-y divide-[#E5E7EB]">
          {/* Row 1: TOTAL PENJUALAN & TRANSAKSI */}
          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-extrabold text-[#667085] uppercase tracking-wider">
                TOTAL PENJUALAN
              </div>
              <div className="text-[22px] font-black text-[#172033] mt-0.5">
                {formatRupiah(shiftMetrics.totalSales)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-[#667085] uppercase tracking-wider">
                TRANSAKSI
              </div>
              <div className="text-[16px] font-extrabold text-[#172033] mt-0.5">
                {formatNumber(shiftMetrics.transactionCount)} struk
              </div>
            </div>
          </div>

          {/* Row 2: Tunai vs QRIS */}
          <div className="grid grid-cols-2 divide-x divide-[#E5E7EB]">
            <div className="p-3.5">
              <div className="text-[12px] font-bold text-[#172033]">Tunai</div>
              <div className="text-[17px] font-extrabold text-[#12B76A] mt-0.5 truncate">
                {formatRupiah(shiftMetrics.cashSales)}
              </div>
              <div className="text-[11px] text-[#027A48] font-medium mt-1">
                Tunai &rarr; masuk Kas di Laci
              </div>
            </div>

            <div className="p-3.5">
              <div className="text-[12px] font-bold text-[#172033]">QRIS</div>
              <div className="text-[17px] font-extrabold text-[#1570EF] mt-0.5 truncate">
                {formatRupiah(shiftMetrics.qrisSales)}
              </div>
              <div className="text-[11px] text-[#667085] font-medium mt-1">
                QRIS &rarr; masuk Kas QRIS
              </div>
            </div>
          </div>
        </div>

        {/* 3. SALDO AKUN (Khusus Kasir: Kas di Laci, Kas QRIS, Kas Owner) */}
        <div className="bg-white rounded-[20px] border border-[#E5E7EB] p-4 shadow-[0_1px_3px_rgba(23,32,51,0.03)] space-y-3">
          <h3 className="text-[11px] font-extrabold text-[#667085] uppercase tracking-wider">
            SALDO AKUN
          </h3>

          <div className="divide-y divide-[#F1F5F9]">
            <div className="py-2.5 first:pt-0 flex items-center justify-between gap-2">
              <div>
                <div className="text-[13px] font-extrabold text-[#172033]">
                  Kas di Laci
                </div>
                <div className="text-[11px] text-[#667085] font-medium">
                  Uang tunai di laci kasir
                </div>
              </div>
              <div className="text-[15px] font-black text-[#172033] shrink-0">
                {formatRupiah(shiftMetrics.expectedCash)}
              </div>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-2">
              <div>
                <div className="text-[13px] font-extrabold text-[#172033]">
                  Kas QRIS
                </div>
                <div className="text-[11px] text-[#667085] font-medium">
                  Penerimaan QRIS
                </div>
              </div>
              <div className="text-[15px] font-extrabold text-[#1570EF] shrink-0">
                {formatRupiah(shiftMetrics.qrisSales)}
              </div>
            </div>

            <div className="py-2.5 last:pb-0 flex items-center justify-between gap-2">
              <div>
                <div className="text-[13px] font-extrabold text-[#172033]">
                  Kas Owner
                </div>
                <div className="text-[11px] text-[#667085] font-medium">
                  Uang yang sudah diambil owner
                </div>
              </div>
              <div className="text-[15px] font-extrabold text-[#172033] shrink-0">
                {formatRupiah(shiftMetrics.ownerWithdrawals)}
              </div>
            </div>
          </div>
        </div>

        {/* 3. AKSI CEPAT */}
        <div className="space-y-2">
          <div className="text-[11px] font-extrabold text-[#667085] uppercase tracking-wider px-0.5">
            AKSI CEPAT
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('kasir')}
              className="bg-white hover:bg-[#F8FAFC] active:scale-95 rounded-[16px] border border-[#E5E7EB] py-3 px-2 flex flex-col items-center justify-center gap-1.5 shadow-[0_1px_2px_rgba(23,32,51,0.02)] transition cursor-pointer"
            >
              <ShoppingBag className="w-5 h-5 text-[#FF641F]" />
              <span className="text-[11px] font-bold text-[#172033]">Kasir</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('produksi')}
              className="bg-white hover:bg-[#F8FAFC] active:scale-95 rounded-[16px] border border-[#E5E7EB] py-3 px-2 flex flex-col items-center justify-center gap-1.5 shadow-[0_1px_2px_rgba(23,32,51,0.02)] transition cursor-pointer"
            >
              <Factory className="w-5 h-5 text-[#FF641F]" />
              <span className="text-[11px] font-bold text-[#172033]">Produksi</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('stok')}
              className="bg-white hover:bg-[#F8FAFC] active:scale-95 rounded-[16px] border border-[#E5E7EB] py-3 px-2 flex flex-col items-center justify-center gap-1.5 shadow-[0_1px_2px_rgba(23,32,51,0.02)] transition cursor-pointer"
            >
              <Package className="w-5 h-5 text-[#FF641F]" />
              <span className="text-[11px] font-bold text-[#172033]">Stok</span>
            </button>
          </div>
        </div>

        {/* 4. STOK PERLU DIPERHATIKAN */}
        <div className="bg-white rounded-[20px] border border-[#E5E7EB] p-4 shadow-[0_1px_3px_rgba(23,32,51,0.03)] space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-extrabold text-[#172033] uppercase tracking-wider">
              STOK PERLU DIPERHATIKAN
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('stok')}
              className="text-[11px] font-bold text-[#FF641F] hover:underline cursor-pointer"
            >
              Lihat Semua →
            </button>
          </div>

          {attentionProducts.length === 0 ? (
            <div className="py-2 flex items-center gap-2 text-[13px] font-semibold text-[#027A48]">
              <CheckCircle2 className="w-4 h-4 text-[#12B76A] shrink-0" />
              <span>✓ Semua menu siap dijual</span>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {attentionProducts.map((item) => {
                const isZero = item.stock <= 0;
                return (
                  <div
                    key={item.id}
                    className="py-2 flex items-center justify-between text-[13px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          isZero ? 'bg-[#F04438]' : 'bg-[#FF641F]'
                        }`}
                      />
                      <span className="font-semibold text-[#172033] truncate">
                        {item.name}
                      </span>
                    </div>
                    <span
                      className={`font-bold text-[12px] shrink-0 ml-2 ${
                        isZero ? 'text-[#D92D20]' : 'text-[#FF641F]'
                      }`}
                    >
                      {formatNumber(item.stock)} porsi
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. TRANSAKSI TERAKHIR */}
        <div className="bg-white rounded-[20px] border border-[#E5E7EB] p-4 shadow-[0_1px_3px_rgba(23,32,51,0.03)] space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-extrabold text-[#172033] uppercase tracking-wider">
              TRANSAKSI TERAKHIR
            </h3>
          </div>

          {latestSales.length === 0 ? (
            <p className="text-[12px] text-[#667085] py-2">
              Belum ada transaksi pada shift ini.
            </p>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {latestSales.map((trx) => (
                <div
                  key={trx.id}
                  className="py-2.5 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-extrabold text-[#667085]">
                        {trx.code}
                      </span>
                      <span className="text-[13px] font-bold text-[#172033] truncate">
                        {trx.itemLabel}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#667085] font-medium mt-0.5 pl-9">
                      {trx.timeStr} &bull; {trx.paymentMethod}
                    </div>
                  </div>

                  <span className="text-[13px] font-extrabold text-[#172033] shrink-0">
                    {formatRupiah(trx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* OpeningCashModal triggered explicitly from BUKA KASIR */}
      {currentEmployee && (
        <OpeningCashModal
          isOpen={showOpeningCashModal}
          onClose={() => setShowOpeningCashModal(false)}
          shifts={shifts}
          currentStaffName={cashierName}
          currentStaffId={currentEmployee.id}
          onConfirmStartShift={async (openingCashConfirmedAmount, details) => {
            await openShift(
              currentEmployee.id,
              cashierName,
              openingCashConfirmedAmount,
              details
            );
          }}
        />
      )}

      {/* Modal Setor / Ambil Kas oleh Owner (KAS_KASIR -> KAS_OWNER) */}
      {showOwnerWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveOwnerWithdraw}
            className="bg-white rounded-[24px] max-w-[360px] w-full p-5 shadow-2xl border border-[#E5E5EA] space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-extrabold text-[#172033]">
                Diambil Owner dari Laci
              </h3>
              <button
                type="button"
                onClick={() => setShowOwnerWithdrawModal(false)}
                className="p-1 text-[#8E8E93] hover:text-[#172033]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-[14px] bg-[#F8FAFC] border border-[#E5E7EB] flex items-center justify-between text-[12px]">
              <span className="text-[#667085] font-semibold">Kas di Laci saat ini:</span>
              <span className="font-extrabold text-[#172033]">
                {formatRupiah(shiftMetrics.expectedCash)}
              </span>
            </div>

            <p className="text-[11px] text-[#667085] leading-relaxed">
              Mencatat uang tunai yang diambil owner dari laci kasir. Bukan biaya operasional dan otomatis mengurangi Kas di Laci.
            </p>

            <div>
              <label className="text-[11px] font-bold text-[#172033] block mb-1">
                Nominal Diambil Owner (Rp)
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={formatNumberInput(ownerWithdrawAmount)}
                onChange={(e) => setOwnerWithdrawAmount(parseNumberInput(e.target.value))}
                placeholder="0"
                className="w-full px-3.5 py-2.5 rounded-[14px] border border-[#D0D5DD] text-[15px] font-extrabold text-[#172033]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#172033] block mb-1">
                Catatan
              </label>
              <input
                type="text"
                value={ownerWithdrawNotes}
                onChange={(e) => setOwnerWithdrawNotes(e.target.value)}
                placeholder="Diambil Owner dari laci kasir"
                className="w-full px-3.5 py-2 rounded-[14px] border border-[#D0D5DD] text-[12px] font-semibold text-[#172033]"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowOwnerWithdrawModal(false)}
                className="flex-1 py-2.5 rounded-[14px] border border-[#D0D5DD] text-[12px] font-bold text-[#667085]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingAction || ownerWithdrawAmount <= 0}
                className="flex-1 py-2.5 rounded-[14px] bg-[#FF641F] text-white text-[12px] font-extrabold disabled:opacity-50"
              >
                {isSubmittingAction ? 'Menyimpan...' : 'Simpan Transfer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Belanja Bahan Tunai Laci -> Masuk ke Pembelian Bahan & Lunas Kas Kasir */}
      <QuickDrawerPurchaseModal
        isOpen={showQuickPurchaseModal}
        onClose={() => setShowQuickPurchaseModal(false)}
      />
    </div>
  );
};
