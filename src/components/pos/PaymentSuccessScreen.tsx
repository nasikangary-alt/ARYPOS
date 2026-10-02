import React, { useState } from 'react';
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
import { ReceiptModal } from '../common/ReceiptModal';
import { Check, FileText, Printer, Share2, PlusCircle } from 'lucide-react';

interface PaymentSuccessScreenProps {
  sale: Sale;
  onNewTransaction: () => void;
  isDesktopWide?: boolean;
}

export const PaymentSuccessScreen: React.FC<PaymentSuccessScreenProps> = ({
  sale,
  onNewTransaction,
  isDesktopWide = false,
}) => {
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const fin = normalizeSaleFinancials(sale);
  const orderMeta = getOrderTypeMeta(fin.orderType);
  const totalQty = sale.items.reduce((acc, it) => acc + it.quantity, 0);

  const handleShare = async () => {
    let txt = `*AYAM GEPREK ARY*\n`;
    txt += `No: ${sale.transactionNo}\n`;
    txt += `Tipe Order: ${orderMeta.shortLabel}\n`;
    txt += `Waktu: ${formatDateTimeIndonesian(sale.createdAt)}\n\n`;
    sale.items.forEach((it) => {
      txt += `${it.productName} (${formatNumber(it.quantity)}x) = ${formatRupiah(it.subtotal)}\n`;
    });
    txt += `\nTotal Makanan: ${formatRupiah(fin.foodTotal)}\n`;
    if (fin.customerShippingPaid > 0) {
      txt += `Ongkir Dibayar: ${formatRupiah(fin.customerShippingPaid)}\n`;
    }
    txt += `*TOTAL BAYAR: ${formatRupiah(fin.finalAmount)}*\n`;
    if (fin.platformServiceFee > 0) {
      txt += `Biaya Admin: -${formatRupiah(fin.platformServiceFee)}\n`;
      txt += `Dana Bersih: ${formatRupiah(fin.netSettlementAmount)}\n`;
    }
    if (!fin.isMarketplace) {
      txt += `Metode (${sale.paymentMethod}): ${formatRupiah(sale.cashReceived || fin.finalAmount)}\n`;
      if (fin.changeAmount > 0) {
        txt += `Kembalian: ${formatRupiah(fin.changeAmount)}\n`;
      }
    }
    txt += `\nTerima kasih atas kunjungannya!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Struk Pembayaran - ${sale.transactionNo}`,
          text: txt,
        });
      } catch {
        // user cancelled or unsupported
      }
    } else {
      await navigator.clipboard.writeText(txt);
      alert('Rincian struk telah disalin ke clipboard!');
    }
  };

  const handlePrint = () => {
    setShowReceiptModal(true);
  };

  const containerWidthClass = isDesktopWide
    ? 'w-full max-w-2xl mx-auto px-4 sm:px-6'
    : 'max-w-[430px] mx-auto w-full px-4';

  return (
    <div
      className={`fixed inset-0 ${
        isDesktopWide ? 'lg:left-64 z-40' : 'z-50'
      } bg-[#F7F8FA] text-[#172033] flex flex-col justify-between py-4 overflow-y-auto app-payment-success-screen`}
    >
      <div
        className={`flex-1 flex flex-col items-center justify-center py-6 text-center ${containerWidthClass}`}
      >
        {/* Success Icon */}
        <div className="w-16 h-16 rounded-full bg-[#12B76A] text-white flex items-center justify-center shadow-lg shadow-[#12B76A]/25 mb-4 animate-in zoom-in-75 duration-200">
          <Check className="w-8 h-8 stroke-[3]" />
        </div>

        {/* Title & Metadata */}
        <h1 className="text-xl font-extrabold text-[#172033]">
          Transaksi Berhasil!
        </h1>
        <div className="flex items-center justify-center gap-2 mt-1.5 text-xs text-[#667085] font-semibold">
          <span>{sale.transactionNo}</span>
          <span>&bull;</span>
          <span className="text-[#172033] font-bold">
            {orderMeta.shortLabel}
          </span>
        </div>
        <p className="text-[11px] text-[#667085] mt-1">
          {formatDateTimeIndonesian(sale.createdAt)}
        </p>

        {/* Receipt Summary Card */}
        <div className="w-full bg-white border border-[#E2E6EC] rounded-2xl p-4 mt-5 shadow-[0_1px_2px_rgba(23,32,51,0.04)] space-y-2.5 text-left tabular-nums">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#667085]">
              Total Makanan ({formatNumber(totalQty)} item)
            </span>
            <span className="font-extrabold text-[#172033]">
              {formatRupiah(fin.foodTotal)}
            </span>
          </div>

          {(fin.itemDiscountTotal > 0 || fin.orderDiscount > 0) && (
            <div className="flex justify-between items-center text-xs text-[#12B76A]">
              <span>Total Diskon</span>
              <span className="font-bold">
                -{formatRupiah(fin.itemDiscountTotal + fin.orderDiscount)}
              </span>
            </div>
          )}

          {fin.isMarketplace ? (
            <div className="pt-2 border-t border-[#E2E6EC] space-y-2">
              {fin.platformServiceFee > 0 && (
                <div className="flex justify-between items-center text-xs text-[#F04438]">
                  <span>Biaya Admin ({orderMeta.shortLabel})</span>
                  <span className="font-bold">
                    -{formatRupiah(fin.platformServiceFee)}
                  </span>
                </div>
              )}
              <div className="bg-[#ECFDF3] border border-[#ABEFC6] rounded-xl px-3 py-2 flex justify-between items-center">
                <span className="text-xs text-[#172033] font-extrabold">
                  Dana Bersih
                </span>
                <span className="font-extrabold text-base text-[#12B76A]">
                  {formatRupiah(fin.netSettlementAmount)}
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center text-xs pt-2 border-t border-[#E2E6EC]">
                <span className="text-[#172033] font-bold">
                  Dibayar ({sale.paymentMethod})
                </span>
                <span className="font-extrabold text-sm text-[#172033]">
                  {formatRupiah(sale.cashReceived || fin.finalAmount)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs pt-2 border-t border-[#E2E6EC]">
                <span className="text-[#667085] font-semibold">Kembalian</span>
                <span className="font-extrabold text-sm text-[#12B76A]">
                  {formatRupiah(fin.changeAmount)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* 3 Action Buttons */}
        <div className="grid grid-cols-3 gap-2.5 w-full mt-4">
          <button
            type="button"
            onClick={() => setShowReceiptModal(true)}
            className="p-3 bg-white border border-[#E2E6EC] rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:bg-[#F7F8FA] transition text-[#172033] cursor-pointer"
          >
            <FileText className="w-5 h-5 text-[#667085]" />
            <span className="text-[11px] font-bold">Lihat Struk</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="p-3 bg-white border border-[#E2E6EC] rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:bg-[#F7F8FA] transition text-[#172033] cursor-pointer"
          >
            <Printer className="w-5 h-5 text-[#667085]" />
            <span className="text-[11px] font-bold">Cetak Struk</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="p-3 bg-white border border-[#E2E6EC] rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:bg-[#F7F8FA] transition text-[#172033] cursor-pointer"
          >
            <Share2 className="w-5 h-5 text-[#667085]" />
            <span className="text-[11px] font-bold">Bagikan</span>
          </button>
        </div>
      </div>

      {/* Primary Action: Kembali ke Kasir / Transaksi Baru */}
      <div className={`pt-4 ${containerWidthClass}`}>
        <button
          type="button"
          onClick={onNewTransaction}
          className="w-full py-3.5 rounded-2xl bg-[#FF6B22] hover:bg-[#E85A15] active:scale-[0.99] text-white font-extrabold text-[15px] shadow-[0_6px_16px_rgba(255,107,34,0.25)] flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Kembali ke Kasir</span>
        </button>
      </div>

      {/* Thermal Receipt Preview Modal */}
      {showReceiptModal && (
        <ReceiptModal sale={sale} onClose={() => setShowReceiptModal(false)} />
      )}
    </div>
  );
};
