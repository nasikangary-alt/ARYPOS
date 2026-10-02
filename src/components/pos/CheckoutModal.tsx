import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  PaymentMethod,
  OrderType,
  CompleteTransactionOptions,
} from '../../types';
import { formatRupiah, formatNumberInput, parseNumberInput } from '../../utils/formatters';
import {
  getCashAccountLabel,
  isCashPaymentMethod,
  mapPaymentMethodToAccount,
} from '../../utils/cashLedger';
import {
  ORDER_TYPE_OPTIONS,
  isMarketplaceOrder,
  calculatePlatformFeeBreakdown,
  DEFAULT_PLATFORM_FEE_SETTINGS,
  validateAndCalculateCheckout,
} from '../../utils/saleChannel';
import { X, Check, Banknote, QrCode, Building2, Percent, Store, Tag, AlertTriangle, Info } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  totalAmount: number;
  onClose: () => void;
  onConfirm: (
    paymentMethod: PaymentMethod,
    cashReceived: number,
    discount: number,
    options?: CompleteTransactionOptions
  ) => Promise<void>;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  totalAmount,
  onClose,
  onConfirm,
}) => {
  const {
    cartGrossTotal,
    cartItemDiscountTotal,
    platformFeeSettings,
    selectedOrderType,
    setSelectedOrderType,
  } = useApp();

  const orderType = selectedOrderType;
  const isMarketplace = isMarketplaceOrder(orderType);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() =>
    selectedOrderType === 'OFFLINE' ? 'CASH' : 'BCA'
  );
  const foodSubtotalInput = cartGrossTotal > 0 ? cartGrossTotal : totalAmount;
  const itemDiscountInput = cartItemDiscountTotal;
  const [orderDiscountInput, setOrderDiscountInput] = useState<number>(0);

  const defaultShippingDisc = isMarketplace
    ? (platformFeeSettings[orderType]?.shippingDiscount ?? DEFAULT_PLATFORM_FEE_SETTINGS[orderType]?.shippingDiscount ?? 0)
    : 0;
  const [shippingDiscountInput, setShippingDiscountInput] = useState<number>(defaultShippingDisc);

  const currentPlatformSetting = isMarketplace
    ? platformFeeSettings[orderType] || DEFAULT_PLATFORM_FEE_SETTINGS[orderType]
    : null;

  // Sync shipping discount default on order type change
  useEffect(() => {
    if (isMarketplace) {
      const def =
        platformFeeSettings[orderType]?.shippingDiscount ??
        DEFAULT_PLATFORM_FEE_SETTINGS[orderType]?.shippingDiscount ??
        0;
      setShippingDiscountInput(def);
    } else {
      setShippingDiscountInput(0);
    }
  }, [orderType, platformFeeSettings, isMarketplace]);

  const platformBreakdown = calculatePlatformFeeBreakdown({
    platform: orderType,
    grossAmount: foodSubtotalInput,
    discountAmount: itemDiscountInput + orderDiscountInput,
    setting: currentPlatformSetting,
    customShippingDiscount: shippingDiscountInput,
  });

  const discountedSubtotal = Math.max(0, foodSubtotalInput - itemDiscountInput);
  const foodTotal = platformBreakdown.netOrderAmount;
  const netSettlementAmount = isMarketplace
    ? platformBreakdown.walletAmount
    : foodTotal;

  const [cashReceived, setCashReceived] = useState<number>(foodTotal);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isMarketplace) {
      setCashReceived(foodTotal);
    }
  }, [foodTotal, isMarketplace]);

  if (!isOpen) return null;

  const isCash = !isMarketplace && isCashPaymentMethod(paymentMethod);
  const changeAmount = isCash ? Math.max(0, cashReceived - foodTotal) : 0;
  const isCashInsufficient = isCash && cashReceived < foodTotal;
  const targetAccount = mapPaymentMethodToAccount(paymentMethod, orderType);

  const validation = validateAndCalculateCheckout({
    orderType,
    subtotal: foodSubtotalInput,
    itemDiscountTotal: itemDiscountInput,
    orderDiscount: orderDiscountInput,
    shippingFee: 0,
    shippingDiscount: shippingDiscountInput,
    platformServiceFee: platformBreakdown.totalPlatformFee,
  });

  const quickCashOptions = [
    { label: `Uang Pas (${formatRupiah(foodTotal)})`, amount: foodTotal },
    { label: 'Rp 20.000', amount: 20000 },
    { label: 'Rp 50.000', amount: 50000 },
    { label: 'Rp 100.000', amount: 100000 },
  ];

  const handleSelectOrderType = (nextType: OrderType) => {
    setSelectedOrderType(nextType);
    if (nextType === 'OFFLINE') {
      setPaymentMethod('CASH');
    } else {
      setPaymentMethod('BCA');
    }
  };

  const handleSubmit = async () => {
    if (!validation.valid) {
      alert(validation.error || 'Mohon periksa nominal transaksi.');
      return;
    }
    if (isCashInsufficient) {
      alert('Uang tunai yang diterima kurang dari total tagihan.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirm(
        paymentMethod,
        isCash ? cashReceived : isMarketplace ? platformBreakdown.walletAmount : validation.foodTotal,
        orderDiscountInput,
        {
          orderType,
          subtotal: foodSubtotalInput,
          itemDiscountTotal: itemDiscountInput,
          orderDiscount: orderDiscountInput,
          foodTotal: platformBreakdown.netOrderAmount,
          shippingFee: 0,
          shippingDiscount: shippingDiscountInput,
          customerShippingPaid: 0,
          platformServiceFee: platformBreakdown.totalPlatformFee,
          netSettlementAmount: platformBreakdown.walletAmount,
        }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses transaksi';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Pembayaran Pesanan
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pilih tipe pemesanan &amp; metode pembayaran
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* 1. TIPE PEMESANAN (Slide Horizontal ke Kiri) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-orange-600" />
                <span>TIPE PEMESANAN</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Geser untuk memilih</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth snap-x">
              {ORDER_TYPE_OPTIONS.map(opt => {
                const isSelected = orderType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectOrderType(opt.id)}
                    className={`py-2.5 px-3.5 rounded-xl border text-xs font-extrabold transition cursor-pointer shrink-0 snap-start flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                      isSelected
                        ? opt.activeClass
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. BREAKDOWN TAMPILAN CHECKOUT KASIR (Section 5 Requirement) */}
          {isMarketplace ? (
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[#FF641F]" />
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                    Breakdown Biaya {currentPlatformSetting?.platformName || orderType}
                  </span>
                </div>
                {currentPlatformSetting?.active === false && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                    Non-Aktif
                  </span>
                )}
              </div>

              {/* Strict calculation sequence */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Total Belanja</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatRupiah(foodSubtotalInput)}
                  </span>
                </div>

                {(itemDiscountInput > 0 || orderDiscountInput > 0) && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Diskon Pelanggan</span>
                    <span className="font-bold">
                      -{formatRupiah(itemDiscountInput + orderDiscountInput)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Subtotal Setelah Diskon</span>
                  <span>{formatRupiah(platformBreakdown.netOrderAmount)}</span>
                </div>

                {platformBreakdown.percentageFee > 0 && (
                  <div className="flex justify-between text-rose-600 dark:text-rose-400 pt-1">
                    <span>
                      Biaya Admin {currentPlatformSetting?.platformName || orderType}{' '}
                      {platformBreakdown.percentageFee}%
                    </span>
                    <span className="font-bold">
                      -{formatRupiah(platformBreakdown.percentageFeeAmount)}
                    </span>
                  </div>
                )}

                {platformBreakdown.fixedFee > 0 && (
                  <div className="flex justify-between text-rose-600 dark:text-rose-400">
                    <span>Biaya Admin Tetap</span>
                    <span className="font-bold">
                      -{formatRupiah(platformBreakdown.fixedFee)}
                    </span>
                  </div>
                )}

                {platformBreakdown.shippingDiscount > 0 && (
                  <div className="flex justify-between text-rose-600 dark:text-rose-400">
                    <span>Potongan Ongkir Resto</span>
                    <span className="font-bold">
                      -{formatRupiah(platformBreakdown.shippingDiscount)}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t-2 border-slate-300 dark:border-slate-600 flex justify-between items-baseline font-black">
                  <span className="text-xs text-slate-900 dark:text-white">Dana Bersih:</span>
                  <span className="text-xl text-emerald-600 dark:text-emerald-400">
                    {formatRupiah(platformBreakdown.walletAmount)}
                  </span>
                </div>
              </div>

              {/* Potongan Ongkir Input (Dapat diedit / ditulis manual jika berbeda di struk Shopee/GoFood/Grab) */}
              <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block">
                    Potongan Diskon Ongkir Resto (Rp)
                  </label>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    *Tulis manual jika beda di struk
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={formatNumberInput(shippingDiscountInput)}
                    onChange={e =>
                      setShippingDiscountInput(
                        Math.max(0, parseNumberInput(e.target.value))
                      )
                    }
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#FF641F]"
                  />
                </div>
                {/* Quick amount buttons */}
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {[0, 1000, 2000, 3000, 4000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setShippingDiscountInput(val)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                        shippingDiscountInput === val
                          ? 'bg-[#FF641F] text-white border-[#FF641F]'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {val === 0 ? 'Rp 0' : `Rp ${val.toLocaleString('id-ID')}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Voucher input for cashier */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Tambah Diskon Nominal / Voucher Pelanggan (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={formatNumberInput(orderDiscountInput)}
                    onChange={e =>
                      setOrderDiscountInput(
                        Math.min(
                          discountedSubtotal,
                          Math.max(0, parseNumberInput(e.target.value))
                        )
                      )
                    }
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Total Display for Offline */
            <div className="bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900 rounded-2xl p-4 text-center">
              <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                Total Tagihan (Offline)
              </span>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-0.5">
                {formatRupiah(foodTotal)}
              </div>
              {itemDiscountInput > 0 && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold block mt-0.5">
                  Harga Normal {formatRupiah(foodSubtotalInput)} • Promo Channel -{formatRupiah(itemDiscountInput)}
                </span>
              )}
            </div>
          )}

          {/* Payment Method Selector (OFFLINE) or Platform Wallet Destination (ONLINE) */}
          {!isMarketplace ? (
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                Metode Pembayaran
              </label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {[
                  { id: 'CASH' as PaymentMethod, label: 'CASH (Tunai)', icon: Banknote },
                  { id: 'QRIS' as PaymentMethod, label: 'QRIS', icon: QrCode },
                ].map(m => {
                  const Icon = m.icon;
                  const isSelected =
                    paymentMethod === m.id ||
                    (m.id === 'CASH' && paymentMethod === 'Tunai');
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(m.id);
                        if (!isCashPaymentMethod(m.id)) {
                          setCashReceived(foodTotal);
                        }
                      }}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'border-orange-600 bg-orange-600 text-white shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'BCA' as PaymentMethod, label: 'BCA' },
                  { id: 'JAGO' as PaymentMethod, label: 'JAGO' },
                  { id: 'MANDIRI' as PaymentMethod, label: 'MANDIRI' },
                ].map(m => {
                  const isSelected = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(m.id);
                        setCashReceived(foodTotal);
                      }}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'border-orange-600 bg-orange-600 text-white shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <Building2 className="w-4 h-4 mb-1" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Akun Tujuan:</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {getCashAccountLabel(targetAccount)} ({targetAccount}) +{formatRupiah(foodTotal)}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-emerald-900 dark:text-emerald-200">
                  Dompet Tujuan: {getCashAccountLabel(targetAccount)} ({targetAccount})
                </span>
                <span className="font-black text-emerald-700 dark:text-emerald-400">
                  +{formatRupiah(netSettlementAmount)}
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                Dana bersih pesanan {orderType} sebesar <strong>{formatRupiah(netSettlementAmount)}</strong> otomatis masuk ke dompet <strong>{targetAccount}</strong>.
              </p>
            </div>
          )}

          {/* Cash Specific Inputs for Offline */}
          {isCash && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Uang Diterima
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberInput(cashReceived)}
                    onChange={e => setCashReceived(parseNumberInput(e.target.value))}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-lg focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {quickCashOptions.map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCashReceived(opt.amount)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:border-orange-400 transition cursor-pointer"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div
                className={`p-3 rounded-xl border flex justify-between items-center ${
                  isCashInsufficient
                    ? 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300'
                }`}
              >
                <span className="text-xs font-bold">
                  {isCashInsufficient ? 'Kurang Bayar' : 'Kembalian'}
                </span>
                <span className="text-base font-black">
                  {isCashInsufficient
                    ? formatRupiah(foodTotal - cashReceived)
                    : formatRupiah(changeAmount)}
                </span>
              </div>
            </div>
          )}

          {/* Optional Nominal Discount Input for Offline */}
          {!isMarketplace && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-slate-400" />
                  <span>Diskon Nominal Transaksi (Rp)</span>
                </label>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberInput(orderDiscountInput)}
                  onChange={e =>
                    setOrderDiscountInput(
                      Math.min(
                        discountedSubtotal,
                        Math.max(0, parseNumberInput(e.target.value))
                      )
                    )
                  }
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                  placeholder="0"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isCashInsufficient || isSubmitting || !validation.valid}
            onClick={handleSubmit}
            className={`flex-2 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs text-white shadow-md transition cursor-pointer ${
              isCashInsufficient || isSubmitting || !validation.valid
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-orange-600 hover:bg-orange-700 active:scale-98 shadow-orange-500/25'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{isSubmitting ? 'Memproses...' : 'Simpan Pesanan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
