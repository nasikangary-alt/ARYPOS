import React, { useState } from 'react';
import { Purchase } from '../../types';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatRupiah, formatNumberInput, parseNumberInput } from '../../utils/formatters';
import { X, CreditCard, Calendar, Wallet, FileText, CheckCircle2 } from 'lucide-react';

interface PurchasePaymentModalProps {
  purchase: Purchase;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PurchasePaymentModal: React.FC<PurchasePaymentModalProps> = ({
  purchase,
  onClose,
  onSuccess,
}) => {
  const { addPurchasePayment } = useApp();
  const { currentRole } = useAuth();

  const [amount, setAmount] = useState<number>(purchase.remainingAmount || 0);
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [sourceAccount, setSourceAccount] = useState<string>('KAS_KASIR');
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const remaining = purchase.remainingAmount || Math.max(0, purchase.totalAmount - purchase.paidAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (amount <= 0) {
      setErrorMsg('Jumlah pembayaran harus lebih dari 0.');
      return;
    }

    if (amount > remaining) {
      setErrorMsg(
        `Jumlah pembayaran (Rp ${amount.toLocaleString('id-ID')}) melebihi sisa tagihan (Rp ${remaining.toLocaleString('id-ID')}).`
      );
      return;
    }

    if (!sourceAccount) {
      setErrorMsg('Pilih sumber dana / akun kas pembayaran.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addPurchasePayment(purchase.id, {
        amount,
        date,
        sourceAccount,
        reference: reference.trim(),
        notes: notes.trim(),
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan pembayaran';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-[#E8ECF2] animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E8ECF2]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#ECFDF3] text-[#12B76A] flex items-center justify-center border border-[#A6F4C5]/60">
              <CreditCard className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#172033]">
                Tambah Pembayaran
              </h3>
              <p className="text-xs text-[#667085]">
                {purchase.purchaseNo} &bull; {purchase.vendorName || purchase.supplier}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#667085] hover:bg-[#F7F8FA] hover:text-[#172033] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-xs font-bold text-[#D92D20]">
            {errorMsg}
          </div>
        )}

        {/* Balance Summary Box */}
        <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E8ECF2] text-center">
          <div>
            <p className="text-[10px] font-bold text-[#667085] uppercase tracking-wider">Total Tagihan</p>
            <p className="text-xs font-extrabold text-[#172033] mt-0.5">
              {formatRupiah(purchase.totalAmount)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#667085] uppercase tracking-wider">Sudah Dibayar</p>
            <p className="text-xs font-extrabold text-[#12B76A] mt-0.5">
              {formatRupiah(purchase.paidAmount)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#667085] uppercase tracking-wider">Sisa Tagihan</p>
            <p className="text-xs font-extrabold text-[#D92D20] mt-0.5">
              {formatRupiah(remaining)}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Jumlah Pembayaran */}
          <div>
            <label className="block text-xs font-bold text-[#172033] mb-1.5 flex items-center justify-between">
              <span>Jumlah Pembayaran (Rp) <span className="text-red-500">*</span></span>
              {remaining > 0 && amount !== remaining && (
                <button
                  type="button"
                  onClick={() => setAmount(remaining)}
                  className="text-[11px] font-bold text-[#FF641F] hover:underline cursor-pointer"
                >
                  Bayar Lunas ({formatRupiah(remaining)})
                </button>
              )}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#667085]">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                required
                placeholder="0"
                value={amount ? formatNumberInput(amount) : ''}
                onChange={e => {
                  const val = parseNumberInput(e.target.value);
                  setAmount(val);
                }}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-extrabold text-[#172033] focus:outline-none focus:border-[#FF641F] focus:bg-white transition"
              />
            </div>
          </div>

          {/* Tanggal & Dibayar Dari */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#172033] mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#667085]" />
                <span>Tanggal Pembayaran <span className="text-red-500">*</span></span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#FF641F] focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#172033] mb-1.5 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-[#667085]" />
                <span>Dibayar Dari (Akun Kas) <span className="text-red-500">*</span></span>
              </label>
              <select
                required
                value={sourceAccount}
                onChange={e => setSourceAccount(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-bold text-[#172033] focus:outline-none focus:border-[#FF641F] focus:bg-white transition cursor-pointer"
              >
                <option value="KAS_KASIR">Kas Kasir (Tunai)</option>
                <option value="KAS_QRIS">Kas QRIS</option>
                <option value="KAS_OWNER">Kas Owner</option>
                {currentRole !== 'KASIR' && (
                  <>
                    <option value="BANK_BCA">Bank BCA</option>
                    <option value="BANK_JAGO">Bank Jago</option>
                    <option value="BANK_MANDIRI">Bank Mandiri</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Referensi & Catatan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#172033] mb-1.5">
                Nomor Referensi (Opsional)
              </label>
              <input
                type="text"
                placeholder="Contoh: Bukti Transfer #TRX123"
                value={reference}
                onChange={e => setReference(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-medium text-[#172033] focus:outline-none focus:border-[#FF641F] focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#172033] mb-1.5">
                Catatan (Opsional)
              </label>
              <input
                type="text"
                placeholder="Catatan pembayaran..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-medium text-[#172033] focus:outline-none focus:border-[#FF641F] focus:bg-white transition"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#E8ECF2]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#E8ECF2] bg-white text-xs font-bold text-[#667085] hover:bg-[#F7F8FA] hover:text-[#172033] transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || amount <= 0}
              className="px-5 py-2.5 rounded-xl bg-[#12B76A] hover:bg-[#0E9355] disabled:bg-[#CBD5E1] text-white text-xs font-extrabold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Pembayaran'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
