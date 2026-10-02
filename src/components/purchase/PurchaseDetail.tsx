import React, { useState, useEffect, useMemo } from 'react';
import { Purchase, PurchasePayment } from '../../types';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  formatRupiah,
  formatDate,
  formatNumber,
  formatNumberInput,
  parseNumberInput,
} from '../../utils/formatters';
import { PurchaseReceiptModal } from './PurchaseReceiptModal';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Printer,
  Plus,
  Building2,
  Calendar,
  CreditCard,
  ShoppingBag,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  MoreVertical,
  Share2,
  Check,
} from 'lucide-react';

interface PurchaseDetailProps {
  purchaseId: string;
  onBack: () => void;
  onEdit: (purchase: Purchase) => void;
  onDeleted: () => void;
  isDesktopWide?: boolean;
}

export const PurchaseDetail: React.FC<PurchaseDetailProps> = ({
  purchaseId,
  onBack,
  onEdit,
  onDeleted,
  isDesktopWide = false,
}) => {
  const { purchases, deletePurchase, addPurchasePayment, deletePurchasePayment } = useApp();
  const { currentRole } = useAuth();

  const purchase = purchases.find(p => p.id === purchaseId);

  // Modals & Menu
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null);
  const [paymentErrorMsg, setPaymentErrorMsg] = useState<string | null>(null);

  const items = purchase?.items || [];
  const payments = purchase?.payments || [];
  const remaining =
    purchase?.remainingAmount !== undefined
      ? purchase.remainingAmount
      : Math.max(0, (purchase?.totalAmount || 0) - (purchase?.paidAmount || 0));

  // Inline "Kirim pembayaran" Form States (Kledo Style)
  const [payAmount, setPayAmount] = useState<number>(remaining);
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paySource, setPaySource] = useState<string>('KAS_KASIR');
  const [payNumber, setPayNumber] = useState<string>('');
  const [payReference, setPayReference] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');

  // Update default payAmount whenever remaining changes
  useEffect(() => {
    setPayAmount(remaining);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setPayNumber(`PP/${randomSuffix}`);
  }, [remaining]);

  // Total Quantity Calculation
  const totalQuantity = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  }, [items]);

  // Subtotal Calculation
  const itemsSubtotal = useMemo(() => {
    if (purchase?.subtotal !== undefined) return purchase.subtotal;
    return items.reduce((sum, it) => sum + (it.subtotal || it.total || 0), 0);
  }, [purchase, items]);

  if (!purchase) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-[#E8ECF2] text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h3 className="text-sm font-bold text-[#172033]">Data Pembelian Tidak Ditemukan</h3>
        <p className="text-xs text-[#667085]">
          Transaksi ini mungkin telah dihapus atau tidak tersedia.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-[#FF641F] text-white text-xs font-bold"
        >
          Kembali ke Riwayat Pembelian
        </button>
      </div>
    );
  }

  const handleDeletePurchase = async () => {
    setIsProcessingDelete(true);
    try {
      await deletePurchase(purchase.id);
      setShowDeleteConfirmModal(false);
      onDeleted();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus transaksi pembelian');
    } finally {
      setIsProcessingDelete(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (
      !window.confirm(
        'Hapus catatan pembayaran ini? Mutasi kas akan dikembalikan dan sisa tagihan bertambah.'
      )
    ) {
      return;
    }
    try {
      await deletePurchasePayment(purchase.id, paymentId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus pembayaran');
    }
  };

  const handleInlineSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentErrorMsg(null);
    setPaymentSuccessMsg(null);

    if (payAmount <= 0) {
      setPaymentErrorMsg('Jumlah pembayaran harus lebih besar dari Rp 0.');
      return;
    }

    if (payAmount > remaining) {
      setPaymentErrorMsg(
        `Jumlah pembayaran (Rp ${payAmount.toLocaleString('id-ID')}) melebihi sisa tagihan (Rp ${remaining.toLocaleString('id-ID')}).`
      );
      return;
    }

    setIsSubmittingPayment(true);
    try {
      await addPurchasePayment(purchase.id, {
        amount: payAmount,
        date: payDate,
        sourceAccount: paySource,
        reference: payReference.trim() || payNumber.trim(),
        notes: payNotes.trim() || 'Pembayaran Tagihan Pembelian',
      });

      setPaymentSuccessMsg('Pembayaran berhasil dicatat!');
      setPayReference('');
      setPayNotes('');
      setTimeout(() => setPaymentSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setPaymentErrorMsg(
        err instanceof Error ? err.message : 'Gagal menambahkan pembayaran tagihan'
      );
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const statusLabel =
    purchase.paymentStatus === 'LUNAS' || remaining <= 0
      ? 'Lunas'
      : purchase.paidAmount > 0
      ? 'Dibayar Sebagian'
      : 'Belum Dibayar';

  const statusColorClass =
    purchase.paymentStatus === 'LUNAS' || remaining <= 0
      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
      : purchase.paidAmount > 0
      ? 'text-amber-600 bg-amber-50 border-amber-200'
      : 'text-red-600 bg-red-50 border-red-200';

  return (
    <div className="space-y-5 pb-24 max-w-6xl mx-auto">
      {/* 1. TOP BREADCRUMB & BACK BUTTON (KLEDO STYLE) */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#667085]">
          <span>Beranda</span>
          <span>&middot;</span>
          <span>Pembelian</span>
          <span>&middot;</span>
          <span>Tagihan Pembelian</span>
          <span>&middot;</span>
          <span className="text-[#172033] font-bold">Detil</span>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-[#FF641F] hover:bg-[#E04F16] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali</span>
        </button>
      </div>

      {/* 2. MAIN DETAIL CARD (KLEDO STYLE) */}
      <div className="bg-white rounded-2xl border border-[#E8ECF2] shadow-xs p-6 space-y-6">
        {/* Title & Action Buttons Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#E8ECF2]">
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-[#172033] tracking-tight">
              Detil Tagihan Pembelian {purchase.purchaseNo || purchase.invoiceNo}
            </h1>
            <div>
              <span
                className={`inline-block px-3 py-1 rounded-lg text-xs font-bold border ${statusColorClass}`}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          {/* Action Tools: Print, Bagikan, Edit/Hapus */}
          <div className="flex items-center gap-2 relative">
            <button
              type="button"
              onClick={() => {
                if (navigator.share) {
                  navigator
                    .share({
                      title: `Tagihan Pembelian ${purchase.purchaseNo}`,
                      text: `Tagihan pembelian dari ${purchase.vendorName || purchase.supplier} total ${formatRupiah(purchase.totalAmount)}`,
                      url: window.location.href,
                    })
                    .catch(() => {});
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  alert('Link faktur disalin ke clipboard');
                }
              }}
              className="px-3.5 py-2 rounded-xl border border-[#E8ECF2] bg-white hover:bg-[#F7F8FA] text-xs font-bold text-[#172033] flex items-center gap-1.5 transition cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-[#667085]" />
              <span>Bagikan</span>
            </button>

            <button
              type="button"
              onClick={() => setShowReceiptModal(true)}
              className="px-3.5 py-2 rounded-xl border border-[#E8ECF2] bg-white hover:bg-[#F7F8FA] text-xs font-bold text-[#172033] flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#667085]" />
              <span>Print</span>
            </button>

            {/* Actions Menu */}
            {currentRole !== 'KASIR' && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowActionMenu(!showActionMenu)}
                  className="p-2 rounded-xl border border-[#E8ECF2] bg-white hover:bg-[#F7F8FA] text-[#667085] hover:text-[#172033] transition cursor-pointer"
                  title="Menu Opsi"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {showActionMenu && (
                  <div
                    className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl border border-[#E8ECF2] shadow-xl py-1 z-30"
                    onMouseLeave={() => setShowActionMenu(false)}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setShowActionMenu(false);
                        onEdit(purchase);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-bold text-[#172033] hover:bg-[#F7F8FA] flex items-center gap-2 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5 text-[#FF641F]" />
                      <span>Edit Transaksi</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowActionMenu(false);
                        setShowDeleteConfirmModal(true);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-bold text-[#D92D20] hover:bg-[#FEF3F2] flex items-center gap-2 cursor-pointer border-t border-[#F1F4F8]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Transaksi</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3. TRANSACTION INFO GRID (KLEDO STYLE) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
          <div>
            <span className="text-[11px] font-semibold text-[#667085] block">Vendor</span>
            <span className="text-sm font-bold text-[#175CD3] mt-0.5 block">
              {purchase.vendorName || purchase.supplier || 'Supplier Umum'}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-[#667085] block">Nomor</span>
            <span className="text-sm font-extrabold text-[#172033] mt-0.5 block">
              {purchase.purchaseNo || purchase.invoiceNo || '-'}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-[#667085] block">Tgl. Transaksi</span>
            <span className="text-sm font-bold text-[#172033] mt-0.5 block">
              {formatDate(purchase.date)}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-[#667085] block">Tgl. Jatuh Tempo</span>
            <span
              className={`text-sm font-bold mt-0.5 block ${
                purchase.dueDate ? 'text-[#D92D20]' : 'text-[#667085]'
              }`}
            >
              {purchase.dueDate ? formatDate(purchase.dueDate) : '-'}
            </span>
          </div>

          {purchase.invoiceNo && (
            <div>
              <span className="text-[11px] font-semibold text-[#667085] block">
                No. Invoice Vendor
              </span>
              <span className="text-xs font-bold text-[#172033] mt-0.5 block">
                {purchase.invoiceNo}
              </span>
            </div>
          )}

          {purchase.reference && (
            <div>
              <span className="text-[11px] font-semibold text-[#667085] block">Referensi</span>
              <span className="text-xs font-bold text-[#172033] mt-0.5 block">
                {purchase.reference}
              </span>
            </div>
          )}

          <div>
            <span className="text-[11px] font-semibold text-[#667085] block">Gudang</span>
            <span className="text-xs font-bold text-[#172033] mt-0.5 block">
              Gudang Dapur / Utama
            </span>
          </div>
        </div>

        {purchase.notes && (
          <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E8ECF2] text-xs">
            <span className="font-bold text-[#667085]">Catatan: </span>
            <span className="text-[#172033] font-medium">{purchase.notes}</span>
          </div>
        )}

        {/* 4. ITEMS TABLE (KLEDO STYLE) */}
        <div className="space-y-3 pt-2">
          <div className="overflow-x-auto border border-[#E8ECF2] rounded-xl">
            <table className="w-full text-left text-xs border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E8ECF2] text-[#667085] font-bold text-[11px] uppercase tracking-wider">
                  <th className="p-3.5">Produk</th>
                  <th className="p-3.5">Deskripsi</th>
                  <th className="p-3.5 text-right">Kuantitas</th>
                  <th className="p-3.5 text-center">Satuan</th>
                  <th className="p-3.5 text-right">Discount</th>
                  <th className="p-3.5 text-right">Harga</th>
                  <th className="p-3.5 text-right">Pajak</th>
                  <th className="p-3.5 text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8ECF2] bg-white">
                {items.map((item, idx) => {
                  const pUnit = item.purchaseUnit || item.unit || 'Pcs';
                  const rowTotal = item.subtotal || item.total || 0;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/40">
                      <td className="p-3.5">
                        <span className="font-extrabold text-[#175CD3] block">
                          {item.targetName}
                        </span>
                      </td>
                      <td className="p-3.5 text-[#667085]">{item.description || '-'}</td>
                      <td className="p-3.5 text-right font-bold text-[#172033]">
                        {formatNumber(item.quantity)}
                      </td>
                      <td className="p-3.5 text-center font-semibold text-[#475467]">{pUnit}</td>
                      <td className="p-3.5 text-right text-[#667085]">
                        {(item.discount || 0) > 0 ? formatRupiah(item.discount) : '0%'}
                      </td>
                      <td className="p-3.5 text-right font-semibold text-[#172033]">
                        {formatNumber(item.costPerUnit)}
                      </td>
                      <td className="p-3.5 text-right text-[#667085]">
                        {(item.tax || 0) > 0 ? formatRupiah(item.tax) : '-'}
                      </td>
                      <td className="p-3.5 text-right font-extrabold text-[#172033]">
                        {formatNumber(rowTotal)}
                      </td>
                    </tr>
                  );
                })}

                {/* Table Footer: Total Kuantitas */}
                <tr className="bg-[#F8FAFC]/70 font-bold border-t border-[#E8ECF2]">
                  <td colSpan={2} className="p-3 text-[#172033] font-extrabold">
                    Total Kuantitas
                  </td>
                  <td className="p-3 text-right font-black text-[#172033]">
                    {formatNumber(totalQuantity)}
                  </td>
                  <td colSpan={5}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 5. SUMMARY FINANCIAL RECONCILIATION (KLEDO STYLE) */}
          <div className="flex justify-end pt-2">
            <div className="w-full sm:w-80 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-[#667085]">
                <span className="font-semibold">Sub Total</span>
                <span className="font-extrabold text-[#172033] text-sm">
                  {formatNumber(itemsSubtotal)}
                </span>
              </div>

              {(purchase.discount || 0) > 0 && (
                <div className="flex justify-between items-center text-[#D92D20]">
                  <span className="font-semibold">Tambahan Diskon</span>
                  <span className="font-bold">-{formatNumber(purchase.discount || 0)}</span>
                </div>
              )}

              {(purchase.tax || 0) > 0 && (
                <div className="flex justify-between items-center text-[#667085]">
                  <span className="font-semibold">Pajak</span>
                  <span className="font-bold text-[#172033]">
                    +{formatNumber(purchase.tax || 0)}
                  </span>
                </div>
              )}

              {(purchase.shippingCost || 0) > 0 && (
                <div className="flex justify-between items-center text-[#667085]">
                  <span className="font-semibold">Biaya pengiriman</span>
                  <span className="font-bold text-[#172033]">
                    +{formatNumber(purchase.shippingCost || 0)}
                  </span>
                </div>
              )}

              {(purchase.transactionCost || 0) > 0 && (
                <div className="flex justify-between items-center text-[#667085]">
                  <span className="font-semibold">Biaya Transaksi</span>
                  <span className="font-bold text-[#172033]">
                    +{formatNumber(purchase.transactionCost || 0)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-[#E8ECF2]">
                <span className="font-bold text-[#172033]">Total</span>
                <span className="font-extrabold text-[#172033] text-base">
                  {formatNumber(purchase.totalAmount)}
                </span>
              </div>

              <div className="flex justify-between items-center pt-1 text-sm">
                <span className="font-black text-[#172033]">Sisa Tagihan</span>
                <span className="font-black text-lg text-[#172033]">
                  {formatNumber(remaining)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. INLINE SECTION "Kirim pembayaran" (KLEDO EXACT PATTERN) */}
      {remaining > 0 && (
        <div className="bg-white rounded-2xl border border-[#E8ECF2] shadow-xs p-6 space-y-4">
          <h2 className="text-base font-extrabold text-[#172033] tracking-tight pb-3 border-b border-[#E8ECF2]">
            Kirim pembayaran
          </h2>

          {paymentSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{paymentSuccessMsg}</span>
            </div>
          )}

          {paymentErrorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{paymentErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handleInlineSubmitPayment} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Total Dibayar */}
              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1.5">
                  Total Dibayar <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={payAmount ? formatNumberInput(payAmount) : ''}
                  onChange={e => {
                    const val = parseNumberInput(e.target.value);
                    setPayAmount(val);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8ECF2] bg-white text-xs font-extrabold text-right text-[#172033] focus:outline-none focus:border-[#FF641F] focus:ring-1 focus:ring-[#FF641F]"
                />
              </div>

              {/* Nomor Pembayaran */}
              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1.5">
                  Nomor (Auto)
                </label>
                <input
                  type="text"
                  value={payNumber}
                  onChange={e => setPayNumber(e.target.value)}
                  placeholder="PP/01318"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#FF641F]"
                />
              </div>

              {/* Tanggal Pembayaran */}
              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1.5">
                  Tgl. Pembayaran <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8ECF2] bg-white text-xs font-bold text-[#172033] focus:outline-none focus:border-[#FF641F]"
                />
              </div>

              {/* Dibayar Dari */}
              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1.5">
                  Dibayar Dari <span className="text-red-500">*</span>
                </label>
                <select
                  value={paySource}
                  onChange={e => setPaySource(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8ECF2] bg-white text-xs font-bold text-[#172033] focus:outline-none focus:border-[#FF641F] cursor-pointer"
                >
                  <option value="KAS_KASIR">1-10001 Kas Kasir Resto</option>
                  <option value="KAS_QRIS">1-10002 Kas QRIS &amp; EDC</option>
                  <option value="KAS_OWNER">1-10003 Kas Owner / Operasional</option>
                  {currentRole !== 'KASIR' && (
                    <>
                      <option value="BANK_BCA">1-10004 Bank BCA</option>
                      <option value="BANK_JAGO">1-10005 Bank Jago</option>
                      <option value="BANK_MANDIRI">1-10006 Bank Mandiri</option>
                    </>
                  )}
                </select>
              </div>

              {/* Referensi */}
              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1.5">Referensi</label>
                <input
                  type="text"
                  placeholder="Contoh: No. Bukti Transfer BCA / Nota"
                  value={payReference}
                  onChange={e => setPayReference(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8ECF2] bg-white text-xs font-medium text-[#172033] focus:outline-none focus:border-[#FF641F]"
                />
              </div>

              {/* Catatan / Keterangan */}
              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1.5">Catatan</label>
                <input
                  type="text"
                  placeholder="Keterangan pembayaran..."
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8ECF2] bg-white text-xs font-medium text-[#172033] focus:outline-none focus:border-[#FF641F]"
                />
              </div>
            </div>

            {/* Bottom Total & Submit Button (Kledo Style) */}
            <div className="pt-3 border-t border-[#E8ECF2] flex flex-col sm:flex-row sm:items-center justify-end gap-5">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-[#667085]">Total:</span>
                <span className="text-base font-black text-[#172033]">
                  {formatNumber(payAmount || 0)}
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmittingPayment}
                className="px-6 py-2.5 rounded-xl bg-[#2E90FA] hover:bg-[#1570EF] disabled:bg-[#CBD5E1] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>{isSubmittingPayment ? 'Memproses...' : 'Tambah Pembayaran'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 7. RIWAYAT PEMBAYARAN TABLE (RECORDED PAYMENTS) */}
      {payments.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E8ECF2] shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8ECF2]">
            <span className="text-sm font-extrabold text-[#172033] tracking-tight">
              Riwayat Pembayaran ({payments.length})
            </span>
            <span className="text-xs font-bold text-emerald-600">
              Total Terbayar: {formatRupiah(purchase.paidAmount)}
            </span>
          </div>

          <div className="overflow-x-auto border border-[#E8ECF2] rounded-xl">
            <table className="w-full text-left text-xs border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E8ECF2] text-[#667085] font-bold text-[11px] uppercase tracking-wider">
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">No. Pembayaran</th>
                  <th className="p-3">Dibayar Dari</th>
                  <th className="p-3">Referensi</th>
                  <th className="p-3">Catatan</th>
                  <th className="p-3 text-right">Jumlah</th>
                  {currentRole !== 'KASIR' && <th className="p-3 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8ECF2] bg-white">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/40">
                    <td className="p-3 font-semibold text-[#172033]">{formatDate(p.date)}</td>
                    <td className="p-3 font-extrabold text-[#172033]">{p.paymentNo || '-'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-lg bg-[#F1F4F8] text-[11px] font-bold text-[#172033]">
                        {p.sourceAccount}
                      </span>
                    </td>
                    <td className="p-3 text-[#667085]">{p.reference || '-'}</td>
                    <td className="p-3 text-[#667085]">{p.notes || '-'}</td>
                    <td className="p-3 text-right font-extrabold text-emerald-600 text-sm">
                      {formatRupiah(p.amount)}
                    </td>
                    {currentRole !== 'KASIR' && (
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeletePayment(p.id)}
                          className="p-1 rounded-lg text-[#667085] hover:text-[#D92D20] hover:bg-[#FEF3F2] transition cursor-pointer"
                          title="Hapus pembayaran"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. AUDIT LOG FOOTER (KLEDO STYLE) */}
      <div className="bg-white rounded-2xl border border-[#E8ECF2] shadow-xs p-5 space-y-2">
        <span className="text-xs font-extrabold text-[#172033] block">
          Pantau log perubahan data
        </span>
        <p className="text-xs text-[#667085] flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[#A0AEC0]" />
          <span>
            Terakhir diubah pada{' '}
            <strong className="text-[#172033]">
              {formatDate(purchase.updatedAt || purchase.createdAt || purchase.date)}
            </strong>
          </span>
        </p>
      </div>

      {/* MODAL CETAK NOTA / FAKTUR */}
      {showReceiptModal && (
        <PurchaseReceiptModal purchase={purchase} onClose={() => setShowReceiptModal(false)} />
      )}

      {/* CONFIRMATION MODAL: HAPUS PEMBELIAN */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#E8ECF2]">
            <div className="flex items-center gap-3 text-[#D92D20]">
              <div className="w-10 h-10 rounded-2xl bg-[#FEF3F2] flex items-center justify-center shrink-0 border border-[#FECDCA]">
                <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#172033]">
                  Hapus Pembelian {purchase.purchaseNo}?
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E8ECF2] text-xs space-y-1 text-[#667085]">
              <p>
                &bull; Stok barang yang masuk akan <strong>dikurangi kembali</strong>.
              </p>
              <p>
                &bull; Jurnal pengeluaran kas yang terkait akan <strong>dibatalkan</strong>.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                disabled={isProcessingDelete}
                className="flex-1 py-2.5 rounded-xl border border-[#E8ECF2] text-xs font-bold text-[#667085] hover:bg-[#F7F8FA]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeletePurchase}
                disabled={isProcessingDelete}
                className="flex-1 py-2.5 rounded-xl bg-[#D92D20] hover:bg-[#B42318] text-white text-xs font-bold"
              >
                {isProcessingDelete ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
