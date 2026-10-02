import React, { useRef } from 'react';
import { Purchase } from '../../types';
import { formatRupiah, formatDate, formatNumber } from '../../utils/formatters';
import { X, Printer, Download, Building2, ShoppingBag } from 'lucide-react';
import { PurchaseStatusBadge } from './PurchaseStatusBadge';

interface PurchaseReceiptModalProps {
  purchase: Purchase;
  onClose: () => void;
}

export const PurchaseReceiptModal: React.FC<PurchaseReceiptModalProps> = ({
  purchase,
  onClose,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const items = purchase.items || [];
  const payments = purchase.payments || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-[#E8ECF2] max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E8ECF2] shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-[#172033]">
              Faktur / Nota Pembelian
            </h3>
            <PurchaseStatusBadge status={purchase.paymentStatus} size="sm" />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-[#172033] hover:bg-[#232F48] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Faktur</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-[#667085] hover:bg-[#F7F8FA] hover:text-[#172033] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div
          ref={printAreaRef}
          className="flex-1 overflow-y-auto space-y-5 p-5 bg-[#FDFEFE] rounded-2xl border border-[#E8ECF2] text-[#172033]"
        >
          {/* Header Title */}
          <div className="flex items-start justify-between border-b border-[#E8ECF2] pb-4">
            <div>
              <h2 className="text-lg font-black tracking-tight text-[#FF641F]">
                AYAM GEPREK ARY
              </h2>
              <p className="text-xs text-[#667085] mt-0.5">
                Pencatatan Pembelian Bahan Baku &amp; Operasional
              </p>
            </div>
            <div className="text-right space-y-1">
              <span className="text-xs font-extrabold text-[#172033] block">
                {purchase.purchaseNo}
              </span>
              <p className="text-[11px] text-[#667085]">
                Tanggal: {formatDate(purchase.date)}
              </p>
              {purchase.dueDate && (
                <p className="text-[11px] text-[#D92D20] font-bold">
                  Jatuh Tempo: {formatDate(purchase.dueDate)}
                </p>
              )}
            </div>
          </div>

          {/* Vendor Info & Invoice Info */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="space-y-1 bg-[#F8FAFC] p-3 rounded-xl border border-[#E8ECF2]">
              <p className="text-[10px] font-bold text-[#667085] uppercase tracking-wider">
                SUPPLIER / VENDOR
              </p>
              <p className="font-extrabold text-[#172033] text-sm">
                {purchase.vendorName || purchase.supplier || 'Supplier Umum'}
              </p>
              {purchase.invoiceNo && (
                <p className="text-[#667085] text-[11px]">
                  No. Invoice Vendor: <strong className="text-[#172033]">{purchase.invoiceNo}</strong>
                </p>
              )}
            </div>

            <div className="space-y-1 bg-[#F8FAFC] p-3 rounded-xl border border-[#E8ECF2]">
              <p className="text-[10px] font-bold text-[#667085] uppercase tracking-wider">
                INFORMASI TAGIHAN
              </p>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#667085]">Status Pembayaran:</span>
                <span className="font-bold">{purchase.paymentStatus}</span>
              </div>
              {purchase.reference && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#667085]">Referensi:</span>
                  <span className="font-bold">{purchase.reference}</span>
                </div>
              )}
              {purchase.notes && (
                <p className="text-[11px] text-[#667085] italic pt-1 border-t border-[#E8ECF2]">
                  Catatan: {purchase.notes}
                </p>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-[#E8ECF2] rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F1F4F8] border-b border-[#E8ECF2] text-[#667085] font-bold text-[11px]">
                  <th className="p-2.5">No</th>
                  <th className="p-2.5">Barang</th>
                  <th className="p-2.5 text-right">Jumlah</th>
                  <th className="p-2.5 text-right">Harga Satuan</th>
                  <th className="p-2.5 text-right">Diskon</th>
                  <th className="p-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8ECF2]">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-[#667085]">
                      Tidak ada data barang.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const rowTotal = item.subtotal || item.total || 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-bold text-[#667085]">{idx + 1}</td>
                        <td className="p-2.5">
                          <p className="font-bold text-[#172033]">{item.targetName}</p>
                          {item.description && (
                            <p className="text-[10px] text-[#667085]">{item.description}</p>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-semibold text-[#172033]">
                          {formatNumber(item.quantity)} {item.unit || 'pcs'}
                        </td>
                        <td className="p-2.5 text-right font-medium text-[#172033]">
                          {formatRupiah(item.costPerUnit)}
                        </td>
                        <td className="p-2.5 text-right text-[#667085]">
                          {(item.discount || 0) > 0 ? formatRupiah(item.discount) : '-'}
                        </td>
                        <td className="p-2.5 text-right font-extrabold text-[#172033]">
                          {formatRupiah(rowTotal)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Financial Summary Calculation */}
          <div className="flex justify-end">
            <div className="w-full sm:w-72 space-y-1.5 text-xs bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E8ECF2]">
              <div className="flex justify-between text-[#667085]">
                <span>Subtotal Barang:</span>
                <span className="font-semibold text-[#172033]">
                  {formatRupiah(purchase.subtotal || purchase.totalAmount - (purchase.shippingCost || 0))}
                </span>
              </div>
              {(purchase.discount || 0) > 0 && (
                <div className="flex justify-between text-[#D92D20]">
                  <span>Diskon Tambahan:</span>
                  <span className="font-semibold">-{formatRupiah(purchase.discount)}</span>
                </div>
              )}
              {(purchase.tax || 0) > 0 && (
                <div className="flex justify-between text-[#667085]">
                  <span>Pajak:</span>
                  <span className="font-semibold text-[#172033]">+{formatRupiah(purchase.tax)}</span>
                </div>
              )}
              {(purchase.shippingCost || 0) > 0 && (
                <div className="flex justify-between text-[#667085]">
                  <span>Biaya Pengiriman:</span>
                  <span className="font-semibold text-[#172033]">+{formatRupiah(purchase.shippingCost)}</span>
                </div>
              )}
              {(purchase.transactionCost || 0) > 0 && (
                <div className="flex justify-between text-[#667085]">
                  <span>Biaya Transaksi:</span>
                  <span className="font-semibold text-[#172033]">+{formatRupiah(purchase.transactionCost)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-[#E8ECF2] text-sm font-black text-[#172033]">
                <span>TOTAL PEMBELIAN:</span>
                <span className="text-[#FF641F]">{formatRupiah(purchase.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-[#12B76A] font-bold text-xs pt-1 border-t border-[#E8ECF2]">
                <span>Total Sudah Dibayar:</span>
                <span>{formatRupiah(purchase.paidAmount)}</span>
              </div>
              <div className="flex justify-between text-[#D92D20] font-black text-xs">
                <span>Sisa Tagihan:</span>
                <span>{formatRupiah(purchase.remainingAmount)}</span>
              </div>
            </div>
          </div>

          {/* Payment History Log */}
          {payments.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#E8ECF2]">
              <p className="text-xs font-bold text-[#172033]">Catatan Riwayat Pembayaran:</p>
              <div className="divide-y divide-[#E8ECF2] border border-[#E8ECF2] rounded-xl overflow-hidden text-xs">
                {payments.map((p, idx) => (
                  <div key={idx} className="p-2.5 flex justify-between items-center bg-white">
                    <div>
                      <p className="font-bold text-[#172033]">
                        {p.paymentNo || `#${idx + 1}`} &bull; {p.sourceAccount}
                      </p>
                      <p className="text-[11px] text-[#667085]">
                        {formatDate(p.date)} {p.notes ? `&bull; ${p.notes}` : ''}
                      </p>
                    </div>
                    <p className="font-extrabold text-[#12B76A]">{formatRupiah(p.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
