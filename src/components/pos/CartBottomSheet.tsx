import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/formatters';
import {
  getOrderTypeLabel,
  resolveProductChannelPrice,
} from '../../utils/saleChannel';
import { getProductImageUrl } from '../../utils/productImages';
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Minus,
  Plus,
  ShoppingBag,
  Store,
  Trash2,
} from 'lucide-react';
import { OrderType } from '../../types';

interface CartBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialNotes?: string;
  onProceedToPayment: (notes: string) => void;
  isDesktopWide?: boolean;
}

function getChannelVisuals(orderType: OrderType) {
  const label = getOrderTypeLabel(orderType);
  if (orderType === 'SHOPEEFOOD') {
    return {
      label: 'ShopeeFood',
      iconBg: 'bg-[#FF5722] text-white',
      isOffline: false,
    };
  }
  if (orderType === 'GOFOOD') {
    return {
      label: 'GoFood',
      iconBg: 'bg-[#12B76A] text-white',
      isOffline: false,
    };
  }
  if (orderType === 'GRABFOOD') {
    return {
      label: 'GrabFood',
      iconBg: 'bg-[#00B14F] text-white',
      isOffline: false,
    };
  }
  return {
    label,
    iconBg: 'bg-[#FF6B22] text-white',
    isOffline: true,
  };
}

export const CartBottomSheet: React.FC<CartBottomSheetProps> = ({
  isOpen,
  onClose,
  initialNotes = '',
  onProceedToPayment,
  isDesktopWide = false,
}) => {
  const {
    cart,
    selectedOrderType,
    updateCartQuantity,
    clearCart,
    cartGrossTotal,
    cartItemDiscountTotal,
    cartTotal,
  } = useApp();
  const [orderNotes, setOrderNotes] = useState(initialNotes);

  useEffect(() => {
    setOrderNotes(initialNotes);
  }, [initialNotes]);

  if (!isOpen) return null;

  const channelVisuals = getChannelVisuals(selectedOrderType);
  const containerWidthClass = isDesktopWide
    ? 'w-full max-w-full px-4 sm:px-6'
    : 'max-w-[430px] mx-auto w-full px-4';

  return (
    <div
      className={`fixed inset-0 ${
        isDesktopWide ? 'lg:left-64 z-40' : 'z-50'
      } bg-[#F7F8FA] text-[#172033] flex flex-col justify-between overflow-hidden animate-in fade-in duration-150 app-fullscreen-screen`}
    >
      {/* Top Header: <- Pesanan (Channel) / Review pesanan sebelum pembayaran */}
      <header className="shrink-0 bg-white border-b border-[#E2E6EC] py-3">
        <div
          className={`${containerWidthClass} flex items-center justify-between gap-3`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 -ml-1 rounded-xl text-[#172033] hover:bg-[#F7F8FA] active:scale-95 transition cursor-pointer shrink-0"
              title="Kembali ke Kasir"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
            </button>
            <div className="min-w-0">
              <h1 className="text-[18px] font-extrabold text-[#172033] leading-tight truncate">
                Pesanan ({channelVisuals.label})
              </h1>
              <p className="text-xs text-[#667085] font-medium mt-0.5 truncate">
                Review pesanan sebelum pembayaran
              </p>
            </div>
          </div>

          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Kosongkan semua menu di pesanan ini?')) {
                  clearCart();
                  onClose();
                }
              }}
              className="p-2 text-[#F04438] hover:bg-[#FEF3F2] rounded-xl transition cursor-pointer shrink-0"
              title="Kosongkan Pesanan"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main
        className={`flex-1 overflow-y-auto py-3.5 ${containerWidthClass} space-y-3.5`}
      >
        {/* 1. Channel Context Card (Read-only visual indicator, NO channel selector buttons, NO "Channel Terkunci" text) */}
        <div className="bg-white rounded-2xl border border-[#E2E6EC] p-3.5 flex items-center gap-3 shadow-[0_1px_2px_rgba(23,32,51,0.04)]">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${channelVisuals.iconBg}`}
          >
            {channelVisuals.isOffline ? (
              <Store className="w-5 h-5 stroke-[2.2]" />
            ) : (
              <ShoppingBag className="w-5 h-5 stroke-[2.2]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-extrabold text-[#172033] leading-tight">
              {channelVisuals.label}
            </div>
            <div className="text-xs font-medium text-[#667085] mt-0.5">
              Pesanan dari channel {channelVisuals.label}
            </div>
          </div>
        </div>

        {/* 2. Order Items List Card */}
        <div className="bg-white rounded-2xl border border-[#E2E6EC] px-4 py-1 divide-y divide-[#E2E6EC] shadow-[0_1px_2px_rgba(23,32,51,0.04)]">
          {cart.length === 0 ? (
            <div className="text-center py-10 text-[#667085]">
              <Store className="w-8 h-8 mx-auto mb-2 text-[#98A2B3]" />
              <p className="text-xs font-bold text-[#172033]">
                Pesanan masih kosong
              </p>
              <p className="text-[11px] text-[#667085] mt-0.5">
                Pilih menu di halaman Kasir untuk mulai memesan
              </p>
            </div>
          ) : (
            cart.map((item) => {
              const resolved = resolveProductChannelPrice(
                item.product,
                selectedOrderType
              );
              const unitSelling = resolved.channelPrice;
              const unitOriginal = resolved.channelOriginalPrice;
              const hasPromo = resolved.hasPromo;

              return (
                <div key={item.product.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    {/* Left: Thumbnail & Product Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <img
                        src={getProductImageUrl(item.product.name)}
                        alt={item.product.name}
                        className="w-[52px] h-[52px] rounded-xl object-cover shrink-0 border border-[#E2E6EC] bg-[#F7F8FA]"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[14px] font-bold text-[#172033] truncate leading-snug">
                          {item.product.name}
                        </h4>

                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap tabular-nums">
                          {hasPromo ? (
                            <>
                              <span className="text-xs text-[#667085] line-through font-medium">
                                {formatRupiah(unitOriginal)}
                              </span>
                              <span className="text-[13px] font-bold text-[#FF6B22]">
                                {formatRupiah(unitSelling)}
                              </span>
                            </>
                          ) : (
                            <span className="text-[13px] text-[#667085] font-medium">
                              {formatRupiah(unitSelling)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Stepper & Item Subtotal */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="flex items-center border border-[#E2E6EC] rounded-xl bg-[#F7F8FA] h-8 px-1">
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQuantity(
                              item.product.id,
                              item.quantity - 1
                            )
                          }
                          className="w-7 h-7 flex items-center justify-center text-[#172033] hover:bg-white rounded-lg active:scale-95 transition cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5 stroke-[2.2]" />
                        </button>
                        <span className="w-7 text-center text-xs font-extrabold text-[#172033] tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQuantity(
                              item.product.id,
                              item.quantity + 1
                            )
                          }
                          className="w-7 h-7 flex items-center justify-center text-[#172033] hover:bg-white rounded-lg active:scale-95 transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
                        </button>
                      </div>

                      <div className="text-right tabular-nums min-w-[90px]">
                        {hasPromo && (
                          <span className="text-[11px] text-[#667085] line-through block">
                            {formatRupiah(unitOriginal * item.quantity)}
                          </span>
                        )}
                        <span className="text-[14px] font-extrabold text-[#172033]">
                          {formatRupiah(unitSelling * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 3. Tambah Catatan (opsional) */}
        {cart.length > 0 && (
          <div className="space-y-1.5 pt-0.5">
            <label className="text-xs font-bold text-[#172033] block">
              Tambah Catatan{' '}
              <span className="font-normal text-[#667085]">(opsional)</span>
            </label>
            <div className="bg-white rounded-2xl border border-[#E2E6EC] flex items-stretch overflow-hidden shadow-[0_1px_2px_rgba(23,32,51,0.03)] focus-within:border-[#FF6B22] transition">
              <div className="w-11 bg-[#F7F8FA] border-r border-[#E2E6EC] flex items-center justify-center text-[#667085] shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <textarea
                rows={2}
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Contoh: level pedas, tanpa sambal, dll."
                className="w-full px-3 py-2.5 text-xs font-medium text-[#172033] placeholder-[#667085] bg-white focus:outline-none resize-none"
              />
            </div>
          </div>
        )}
      </main>

      {/* Sticky Bottom Footer: Total Makanan & Lanjut ke Pembayaran */}
      {cart.length > 0 && (
        <footer className="shrink-0 bg-white border-t border-[#E2E6EC] py-3.5 shadow-[0_-4px_20px_rgba(23,32,51,0.04)]">
          <div className={`${containerWidthClass} space-y-3`}>
            <div className="space-y-1 tabular-nums">
              {cartItemDiscountTotal > 0 && (
                <>
                  <div className="flex items-center justify-between text-xs text-[#667085]">
                    <span>Subtotal Normal</span>
                    <span className="line-through">
                      {formatRupiah(cartGrossTotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#12B76A] font-bold">
                    <span>Diskon Promo ({channelVisuals.label})</span>
                    <span>-{formatRupiah(cartItemDiscountTotal)}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-extrabold text-[#172033]">
                  Total Makanan
                </span>
                <span className="text-[18px] font-extrabold text-[#172033]">
                  {formatRupiah(cartTotal)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onProceedToPayment(orderNotes)}
              className="w-full py-3.5 rounded-2xl bg-[#FF6B22] hover:bg-[#E85A15] active:scale-[0.99] text-white font-extrabold text-[15px] shadow-[0_6px_16px_rgba(255,107,34,0.25)] flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <span>Lanjut ke Pembayaran</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};
