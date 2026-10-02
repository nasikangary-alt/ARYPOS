import React, { useRef } from 'react';
import { Sale } from '../../types';
import {
  formatRupiah,
  formatNumber,
  formatDateTimeIndonesian,
} from '../../utils/formatters';
import {
  normalizeSaleFinancials,
  getOrderTypeMeta,
} from '../../utils/saleChannel';
import { Printer, Download, Share2, X, CheckCircle2 } from 'lucide-react';

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, onClose }) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!sale) return null;

  const fin = normalizeSaleFinancials(sale);
  const orderMeta = getOrderTypeMeta(fin.orderType);

  const handlePrint = () => {
    window.print();
  };

  const generateTextReceipt = () => {
    let txt = `AYAM GEPREK ARY\n`;
    txt += `================================\n`;
    txt += `No. TRX : ${sale.transactionNo}\n`;
    txt += `Tipe    : ${orderMeta.label}\n`;
    txt += `Tanggal : ${formatDateTimeIndonesian(sale.createdAt)}\n`;
    txt += `Kasir   : ${sale.cashierName}\n`;
    txt += `--------------------------------\n`;

    sale.items.forEach((item) => {
      const origPrice =
        typeof item.originalPrice === 'number' && item.originalPrice > item.sellingPrice
          ? item.originalPrice
          : item.sellingPrice;
      txt += `${item.productName}\n`;
      if (origPrice > item.sellingPrice) {
        txt += `  Harga Normal: ${formatRupiah(origPrice)} -> Promo: ${formatRupiah(item.sellingPrice)}\n`;
      }
      txt += `  ${formatNumber(item.quantity)}x @${formatRupiah(item.sellingPrice)} = ${formatRupiah(item.subtotal)}\n`;
    });

    txt += `--------------------------------\n`;
    if (fin.itemDiscountTotal > 0 || fin.orderDiscount > 0 || fin.isMarketplace) {
      txt += `HARGA MAKANAN : ${formatRupiah(fin.subtotal)}\n`;
    }
    if (fin.itemDiscountTotal > 0) {
      txt += `DISKON HARGA  : -${formatRupiah(fin.itemDiscountTotal)}\n`;
    }
    if (fin.orderDiscount > 0) {
      txt += `DISKON ORDER  : -${formatRupiah(fin.orderDiscount)}\n`;
    }
    txt += `TOTAL MAKANAN : ${formatRupiah(fin.foodTotal)}\n`;

    if (fin.shippingFee > 0 || fin.shippingDiscount > 0 || fin.customerShippingPaid > 0) {
      txt += `ONGKIR        : ${formatRupiah(fin.shippingFee)}\n`;
      if (fin.shippingDiscount > 0) {
        txt += `DISKON ONGKIR : -${formatRupiah(fin.shippingDiscount)}\n`;
      }
      txt += `ONGKIR DIBAYAR: ${formatRupiah(fin.customerShippingPaid)}\n`;
    }

    txt += `TOTAL BAYAR   : ${formatRupiah(fin.finalAmount)}\n`;
    if (fin.platformServiceFee > 0) {
      txt += `BIAYA APLIKASI: -${formatRupiah(fin.platformServiceFee)}\n`;
      txt += `NET DITERIMA  : ${formatRupiah(fin.netSettlementAmount)}\n`;
    }
    txt += `METODE (${sale.paymentMethod}) : ${formatRupiah(sale.cashReceived || fin.finalAmount)}\n`;
    if (fin.changeAmount > 0) {
      txt += `KEMBALIAN     : ${formatRupiah(fin.changeAmount)}\n`;
    }
    txt += `================================\n`;
    txt += `Terima Kasih Atas Kunjungan Anda!\n`;
    txt += `Nikmati Pedas Gurihnya Ayam Geprek ARY!\n`;
    return txt;
  };

  const handleDownload = () => {
    const textContent = generateTextReceipt();
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Struk-${sale.transactionNo}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const textContent = generateTextReceipt();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Struk ${sale.transactionNo} - Ayam Geprek ARY`,
          text: textContent,
        });
      } catch (err) {
        console.log('Share canceled or failed', err);
      }
    } else {
      await navigator.clipboard.writeText(textContent);
      alert('Teks Struk berhasil disalin ke clipboard!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-emerald-600 text-white p-4 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded-full bg-black/20 hover:bg-black/30 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-7 h-7 text-white" />
          </div>
          <h3 className="font-extrabold text-lg">Rincian Struk</h3>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-xs text-emerald-100">{sale.transactionNo}</span>
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold">
              {orderMeta.shortLabel}
            </span>
          </div>
        </div>

        {/* Printable Thermal Receipt Card */}
        <div className="p-5 max-h-[62vh] overflow-y-auto">
          <div
            ref={receiptRef}
            className="bg-amber-50/70 dark:bg-slate-800/80 p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 font-mono text-xs text-slate-800 dark:text-slate-200"
          >
            <div className="text-center mb-3">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                AYAM GEPREK ARY
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Kuliner Pedas Gurih Nikmat
              </p>
              <div className="mt-1">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                  ORDER: {orderMeta.shortLabel}
                </span>
              </div>
              <div className="my-2 border-b border-dashed border-slate-300 dark:border-slate-700" />
            </div>

            <div className="space-y-2 mb-3">
              {sale.items.map((item, idx) => {
                const origPrice =
                  typeof item.originalPrice === 'number' &&
                  item.originalPrice > item.sellingPrice
                    ? item.originalPrice
                    : item.sellingPrice;
                const hasPromo = origPrice > item.sellingPrice;
                return (
                  <div
                    key={`${item.productId || 'item'}-${idx}`}
                    className="flex justify-between items-start text-[11px]"
                  >
                    <div>
                      <span className="font-bold">{item.productName}</span>
                      <div className="text-slate-500 dark:text-slate-400 text-[10px] flex items-center gap-1.5 flex-wrap">
                        <span>{formatNumber(item.quantity)} x</span>
                        {hasPromo && (
                          <span className="line-through text-slate-400">
                            {formatRupiah(origPrice)}
                          </span>
                        )}
                        <span>{formatRupiah(item.sellingPrice)}</span>
                      </div>
                    </div>
                    <span className="font-semibold">{formatRupiah(item.subtotal)}</span>
                  </div>
                );
              })}
            </div>

            <div className="my-2 border-b border-dashed border-slate-300 dark:border-slate-700" />

            <div className="space-y-1 text-[11px]">
              {(fin.itemDiscountTotal > 0 || fin.orderDiscount > 0 || fin.isMarketplace) && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Harga Makanan</span>
                  <span>{formatRupiah(fin.subtotal)}</span>
                </div>
              )}

              {fin.itemDiscountTotal > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Diskon Harga Coret</span>
                  <span>-{formatRupiah(fin.itemDiscountTotal)}</span>
                </div>
              )}

              {fin.orderDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Diskon Nominal</span>
                  <span>-{formatRupiah(fin.orderDiscount)}</span>
                </div>
              )}

              <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                <span>Total Makanan</span>
                <span>{formatRupiah(fin.foodTotal)}</span>
              </div>

              {(fin.shippingFee > 0 ||
                fin.shippingDiscount > 0 ||
                fin.customerShippingPaid > 0) && (
                <div className="pt-1 border-t border-dashed border-slate-200 dark:border-slate-700 space-y-0.5">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Ongkir</span>
                    <span>{formatRupiah(fin.shippingFee)}</span>
                  </div>
                  {fin.shippingDiscount > 0 && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Diskon Ongkir</span>
                      <span>-{formatRupiah(fin.shippingDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-700 dark:text-slate-300 font-semibold">
                    <span>Ongkir Dibayar</span>
                    <span>{formatRupiah(fin.customerShippingPaid)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between font-extrabold text-slate-900 dark:text-white pt-1 border-t border-dashed border-slate-300 dark:border-slate-700">
                <span>TOTAL BAYAR</span>
                <span>{formatRupiah(fin.finalAmount)}</span>
              </div>

              {fin.platformServiceFee > 0 && (
                <div className="pt-1 space-y-0.5">
                  <div className="flex justify-between text-rose-600 dark:text-rose-400">
                    <span>Biaya Aplikasi ({orderMeta.shortLabel})</span>
                    <span>-{formatRupiah(fin.platformServiceFee)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-400">
                    <span>Net Diterima Merchant</span>
                    <span>{formatRupiah(fin.netSettlementAmount)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-1">
                <span>Metode Bayar</span>
                <span>{sale.paymentMethod}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Dibayar</span>
                <span>{formatRupiah(sale.cashReceived || fin.finalAmount)}</span>
              </div>
              {fin.changeAmount > 0 && (
                <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-0.5">
                  <span>Kembalian</span>
                  <span>{formatRupiah(fin.changeAmount)}</span>
                </div>
              )}
            </div>

            <div className="my-2 border-b border-dashed border-slate-300 dark:border-slate-700" />

            <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5 text-center">
              <p>{formatDateTimeIndonesian(sale.createdAt)}</p>
              <p>Kasir: {sale.cashierName}</p>
              <p className="pt-2 font-medium text-slate-700 dark:text-slate-300">
                ~ Terima Kasih Atas Kunjungan Anda ~
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-900 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>
      </div>
    </div>
  );
};
