import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  PaymentMethod,
  OrderType,
  CompleteTransactionOptions,
} from '../../types';
import {
  formatRupiah,
  formatNumberInput,
  parseNumberInput,
} from '../../utils/formatters';
import { isCashPaymentMethod } from '../../utils/cashLedger';
import {
  isMarketplaceOrder,
  calculatePlatformFeeBreakdown,
  DEFAULT_PLATFORM_FEE_SETTINGS,
  validateAndCalculateCheckout,
  getOrderTypeLabel,
} from '../../utils/saleChannel';
import {
  ArrowLeft,
  Banknote,
  QrCode,
  Building2,
  Settings,
  Tag,
  Store,
  ShoppingBag,
  Wallet,
  X,
} from 'lucide-react';

interface PaymentScreenProps {
  totalAmount: number;
  onBack: () => void;
  onConfirm: (
    paymentMethod: PaymentMethod,
    cashReceived: number,
    discount: number,
    options?: CompleteTransactionOptions
  ) => Promise<void>;
  isDesktopWide?: boolean;
}

const OFFLINE_PAYMENT_OPTIONS: Array<{
  id: PaymentMethod;
  label: string;
  subtitle: string;
  type: 'CASH' | 'QRIS' | 'BANK';
}> = [
  {
    id: 'CASH',
    label: 'Cash',
    subtitle: 'Kas Kasir',
    type: 'CASH',
  },
  {
    id: 'QRIS',
    label: 'QRIS',
    subtitle: 'Kas QRIS',
    type: 'QRIS',
  },
  {
    id: 'BCA',
    label: 'BCA',
    subtitle: 'Bank BCA',
    type: 'BANK',
  },
  {
    id: 'JAGO',
    label: 'Jago',
    subtitle: 'Bank Jago',
    type: 'BANK',
  },
  {
    id: 'MANDIRI',
    label: 'Mandiri',
    subtitle: 'Bank Mandiri',
    type: 'BANK',
  },
];

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

function getFriendlyDestinationAccountName(
  orderType: OrderType,
  paymentMethod: PaymentMethod
): string {
  if (orderType === 'SHOPEEFOOD') return 'Dompet Shopee Food';
  if (orderType === 'GOFOOD') return 'Dompet GoFood';
  if (orderType === 'GRABFOOD') return 'Dompet GrabFood';

  const upper = (paymentMethod || 'CASH').toUpperCase();
  if (upper === 'QRIS' || upper === 'KAS_QRIS') return 'Kas QRIS';
  if (upper === 'BCA' || upper === 'BANK_BCA') return 'Bank BCA';
  if (upper === 'JAGO' || upper === 'BANK_JAGO') return 'Bank Jago';
  if (upper === 'MANDIRI' || upper === 'BANK_MANDIRI') return 'Bank Mandiri';
  return 'Kas Kasir';
}

export const PaymentScreen: React.FC<PaymentScreenProps> = ({
  totalAmount,
  onBack,
  onConfirm,
  isDesktopWide = false,
}) => {
  const {
    cartGrossTotal,
    cartItemDiscountTotal,
    platformFeeSettings,
    savePlatformFeeSetting,
    selectedOrderType,
  } = useApp();
  const { currentRole } = useAuth();

  // 1. Order Type from Kasir context (no channel switching on Pembayaran)
  const orderType = selectedOrderType;
  const isMarketplace = isMarketplaceOrder(orderType);
  const channelVisuals = getChannelVisuals(orderType);

  // 2. Payment Method for Offline orders
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() =>
    selectedOrderType === 'OFFLINE' ? 'CASH' : 'BCA'
  );

  // 3. Financial breakdown state
  const foodSubtotalInput = cartGrossTotal > 0 ? cartGrossTotal : totalAmount;
  const itemDiscountInput = cartItemDiscountTotal;
  const [orderDiscountInput, setOrderDiscountInput] = useState<number>(0);

  // Potongan Diskon Ongkir Resto defaults to Rp0
  const [shippingDiscountInput, setShippingDiscountInput] = useState<number>(0);

  // Owner Quick Platform Fee Config Modal
  const [showFeeConfigModal, setShowFeeConfigModal] = useState<boolean>(false);
  const [cfgPercentage, setCfgPercentage] = useState<number>(20);
  const [cfgFixedFee, setCfgFixedFee] = useState<number>(0);
  const [cfgShippingDiscount, setCfgShippingDiscount] = useState<number>(0);
  const [cfgActive, setCfgActive] = useState<boolean>(true);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);

  // Pull current platform configuration
  const currentPlatformSetting = isMarketplace
    ? platformFeeSettings[orderType] || DEFAULT_PLATFORM_FEE_SETTINGS[orderType]
    : null;

  useEffect(() => {
    setShippingDiscountInput(0);
  }, [orderType]);

  // Calculate live platform fee breakdown
  const platformBreakdown = calculatePlatformFeeBreakdown({
    platform: orderType,
    grossAmount: foodSubtotalInput,
    discountAmount: itemDiscountInput + orderDiscountInput,
    setting: currentPlatformSetting,
    customShippingDiscount: shippingDiscountInput,
  });

  const discountedSubtotal = Math.max(0, foodSubtotalInput - itemDiscountInput);
  const totalDiscountAmount = itemDiscountInput + orderDiscountInput;
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

  const handleOpenConfigModal = () => {
    const targetPlatform = isMarketplace ? orderType : 'GOFOOD';
    const currentCfg =
      platformFeeSettings[targetPlatform] ||
      DEFAULT_PLATFORM_FEE_SETTINGS[targetPlatform];
    setCfgPercentage(currentCfg?.percentageFee ?? 20);
    setCfgFixedFee(currentCfg?.fixedFee ?? 0);
    setCfgShippingDiscount(currentCfg?.shippingDiscount ?? 0);
    setCfgActive(currentCfg?.active !== false);
    setShowFeeConfigModal(true);
  };

  const handleSaveConfigModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPlatform = isMarketplace ? orderType : 'GOFOOD';
    if (cfgPercentage < 0 || cfgFixedFee < 0 || cfgShippingDiscount < 0) {
      alert('Nilai fee tidak boleh negatif.');
      return;
    }
    setIsSavingConfig(true);
    try {
      await savePlatformFeeSetting(targetPlatform, {
        percentageFee: cfgPercentage,
        fixedFee: cfgFixedFee,
        shippingDiscount: cfgShippingDiscount,
        active: cfgActive,
      });
      setShowFeeConfigModal(false);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const isCash = !isMarketplace && isCashPaymentMethod(paymentMethod);
  const changeAmount = isCash ? Math.max(0, cashReceived - foodTotal) : 0;
  const isCashInsufficient = isCash && cashReceived < foodTotal;
  const destinationLabel = getFriendlyDestinationAccountName(
    orderType,
    paymentMethod
  );

  const validation = validateAndCalculateCheckout({
    orderType,
    subtotal: foodSubtotalInput,
    itemDiscountTotal: itemDiscountInput,
    orderDiscount: orderDiscountInput,
    shippingFee: shippingDiscountInput,
    shippingDiscount: shippingDiscountInput,
    platformServiceFee: platformBreakdown.totalPlatformFee,
    allowNegativeSettlement: true,
  });

  // Quick cash suggestion pills for OFFLINE CASH
  const quickPills = [
    { label: 'Uang Pas', amount: foodTotal },
    { label: 'Rp 20.000', amount: 20000 },
    { label: 'Rp 50.000', amount: 50000 },
    { label: 'Rp 100.000', amount: 100000 },
  ];

  const handleCompleteTransaction = async () => {
    if (!validation.valid) {
      alert(validation.error || 'Mohon periksa kembali nominal transaksi.');
      return;
    }
    if (isCashInsufficient) {
      alert('Uang yang diterima kurang dari total pembayaran.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(
        paymentMethod,
        isCash
          ? cashReceived
          : isMarketplace
          ? platformBreakdown.walletAmount
          : validation.foodTotal,
        orderDiscountInput,
        {
          orderType,
          subtotal: foodSubtotalInput,
          itemDiscountTotal: itemDiscountInput,
          orderDiscount: orderDiscountInput,
          foodTotal: platformBreakdown.netOrderAmount,
          shippingFee: shippingDiscountInput,
          shippingDiscount: shippingDiscountInput,
          customerShippingPaid: 0,
          platformServiceFee: platformBreakdown.totalPlatformFee,
          netSettlementAmount: platformBreakdown.walletAmount,
          allowNegativeSettlement: true,
        }
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Gagal memproses transaksi';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const containerWidthClass = isDesktopWide
    ? 'w-full max-w-full px-4 sm:px-6'
    : 'max-w-[430px] mx-auto w-full px-4';

  return (
    <div
      className={`fixed inset-0 ${
        isDesktopWide ? 'lg:left-64 z-40' : 'z-50'
      } bg-[#F7F8FA] text-[#172033] flex flex-col justify-between overflow-hidden animate-in fade-in duration-150 app-fullscreen-screen`}
    >
      {/* HEADER SEDERHANA: <- Pembayaran / Selesaikan pembayaran pesanan */}
      <header className="shrink-0 bg-white border-b border-[#E2E6EC] py-3">
        <div
          className={`${containerWidthClass} flex items-center justify-between gap-3`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              id="btn-back-to-menu"
              type="button"
              onClick={onBack}
              className="p-1.5 -ml-1 rounded-xl text-[#172033] hover:bg-[#F7F8FA] transition active:scale-95 cursor-pointer shrink-0"
              title="Kembali ke Pesanan"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
            </button>
            <div className="min-w-0">
              <h1 className="text-[18px] font-extrabold text-[#172033] leading-tight truncate">
                Pembayaran
              </h1>
              <p className="text-xs text-[#667085] font-medium mt-0.5 truncate">
                Selesaikan pembayaran pesanan
              </p>
            </div>
          </div>

          {isMarketplace &&
            (currentRole === 'OWNER' || currentRole === 'ADMIN') && (
              <button
                type="button"
                onClick={handleOpenConfigModal}
                className="p-2 rounded-xl text-[#667085] hover:text-[#172033] hover:bg-[#F7F8FA] transition cursor-pointer shrink-0"
                title={`Atur Fee ${channelVisuals.label}`}
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main
        className={`flex-1 overflow-y-auto overflow-x-hidden no-scrollbar py-3.5 ${containerWidthClass} space-y-3.5`}
      >
        {/* CHANNEL INFO CARD (Read-only context, NO lock icon, NO "Channel Terkunci", NO channel selector) */}
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

        {/* RINCIAN PEMBAYARAN CARD */}
        <div className="bg-white rounded-2xl border border-[#E2E6EC] p-4 shadow-[0_1px_2px_rgba(23,32,51,0.04)] space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#FF6B22]" />
            <h2 className="text-[14px] font-extrabold text-[#172033]">
              Rincian Pembayaran
            </h2>
          </div>

          <div className="space-y-2 text-[13px] tabular-nums">
            <div className="flex justify-between items-center text-[#667085]">
              <span>Total Belanja</span>
              <span className="font-extrabold text-[#172033]">
                {formatRupiah(foodSubtotalInput)}
              </span>
            </div>

            <div className="flex justify-between items-center text-[#667085]">
              <span>Diskon</span>
              <span className="font-semibold text-[#667085]">
                {totalDiscountAmount > 0
                  ? `-${formatRupiah(totalDiscountAmount)}`
                  : 'Rp 0'}
              </span>
            </div>

            <div className="border-t border-[#E2E6EC] pt-2 flex justify-between items-center">
              <span className="text-[#667085] font-medium">
                Subtotal Setelah Diskon
              </span>
              <span className="font-extrabold text-[#172033]">
                {formatRupiah(platformBreakdown.netOrderAmount)}
              </span>
            </div>

            {isMarketplace && platformBreakdown.percentageFee > 0 && (
              <div className="flex justify-between items-center text-[#F04438]">
                <span className="font-semibold">
                  Biaya Admin {channelVisuals.label} (
                  {platformBreakdown.percentageFee}%)
                </span>
                <span className="font-extrabold">
                  -{formatRupiah(platformBreakdown.percentageFeeAmount)}
                </span>
              </div>
            )}

            {isMarketplace && platformBreakdown.fixedFee > 0 && (
              <div className="flex justify-between items-center text-[#F04438]">
                <span className="font-semibold">Biaya Admin Tetap</span>
                <span className="font-extrabold">
                  -{formatRupiah(platformBreakdown.fixedFee)}
                </span>
              </div>
            )}

            {isMarketplace && platformBreakdown.shippingDiscount > 0 && (
              <div className="flex justify-between items-center text-[#F04438]">
                <span className="font-semibold">Potongan Ongkir Resto</span>
                <span className="font-extrabold">
                  -{formatRupiah(platformBreakdown.shippingDiscount)}
                </span>
              </div>
            )}
          </div>

          {/* Dana Bersih Highlight Box */}
          <div className="bg-[#ECFDF3] border border-[#ABEFC6] rounded-xl px-3.5 py-2.5 flex items-center justify-between tabular-nums">
            <span className="text-[15px] font-extrabold text-[#172033]">
              Dana Bersih
            </span>
            <span className="text-[20px] font-extrabold text-[#12B76A]">
              {formatRupiah(netSettlementAmount)}
            </span>
          </div>
        </div>

        {/* DOMPET / ACCOUNT DESTINATION CARD (No internal account codes) */}
        <div className="bg-[#ECFDF3]/80 border border-[#ABEFC6] rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#12B76A] text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Wallet className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-extrabold text-[#172033] leading-tight">
              {destinationLabel}
            </div>
            <div className="text-[14px] font-extrabold text-[#12B76A] mt-0.5 tabular-nums">
              +{formatRupiah(netSettlementAmount)}
            </div>
          </div>
        </div>

        {/* DISKON NOMINAL / VOUCHER */}
        <div className="bg-white rounded-2xl border border-[#E2E6EC] p-3.5 shadow-[0_1px_2px_rgba(23,32,51,0.04)] space-y-2">
          <label className="text-xs font-bold text-[#172033] block">
            Diskon Nominal / Voucher{' '}
            <span className="font-normal text-[#667085]">(opsional)</span>
          </label>

          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#667085]">
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={formatNumberInput(orderDiscountInput)}
              onChange={(e) =>
                setOrderDiscountInput(
                  Math.min(
                    discountedSubtotal,
                    Math.max(0, parseNumberInput(e.target.value))
                  )
                )
              }
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#E2E6EC] bg-[#F7F8FA] text-sm font-extrabold text-[#172033] focus:outline-none focus:border-[#FF6B22] focus:bg-white transition tabular-nums"
            />
          </div>
        </div>

        {/* POTONGAN DISKON ONGKIR RESTO */}
        {isMarketplace && (
          <div className="bg-white rounded-2xl border border-[#E2E6EC] p-3.5 shadow-[0_1px_2px_rgba(23,32,51,0.04)] space-y-2">
            <label className="text-xs font-bold text-[#172033] block">
              Potongan Diskon Ongkir Resto{' '}
              <span className="font-normal text-[#667085]">(opsional)</span>
            </label>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#667085]">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={formatNumberInput(shippingDiscountInput)}
                onChange={(e) =>
                  setShippingDiscountInput(
                    Math.max(0, parseNumberInput(e.target.value))
                  )
                }
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#E2E6EC] bg-[#F7F8FA] text-sm font-extrabold text-[#172033] focus:outline-none focus:border-[#FF6B22] focus:bg-white transition tabular-nums"
              />
            </div>
          </div>
        )}

        {/* FOR OFFLINE CHANNEL: PAYMENT METHOD SELECTOR */}
        {!isMarketplace && (
          <>
            <div className="bg-white rounded-2xl border border-[#E2E6EC] p-3.5 shadow-[0_1px_2px_rgba(23,32,51,0.04)] space-y-2.5">
              <label className="text-xs font-bold text-[#172033] block">
                Metode Pembayaran
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {OFFLINE_PAYMENT_OPTIONS.map((opt) => {
                  const isSelected =
                    paymentMethod === opt.id ||
                    (opt.id === 'CASH' && paymentMethod === 'Tunai');
                  return (
                    <button
                      key={opt.id}
                      id={`payment-method-${opt.id.toLowerCase()}`}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(opt.id);
                        setCashReceived(foodTotal);
                      }}
                      className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#FF6B22] text-white border-[#FF6B22] shadow-2xs'
                          : 'bg-[#F7F8FA] border-[#E2E6EC] text-[#172033] hover:bg-white'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-white text-[#FF6B22] border border-[#E2E6EC]'
                        }`}
                      >
                        {opt.type === 'CASH' ? (
                          <Banknote className="w-4 h-4" />
                        ) : opt.type === 'QRIS' ? (
                          <QrCode className="w-4 h-4" />
                        ) : (
                          <Building2 className="w-4 h-4" />
                        )}
                      </div>
                      <div className="text-left min-w-0">
                        <span className="text-xs font-extrabold block leading-tight">
                          {opt.label}
                        </span>
                        <span
                          className={`text-[10px] font-medium block truncate ${
                            isSelected ? 'text-white/85' : 'text-[#667085]'
                          }`}
                        >
                          {opt.subtitle}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cash Received Input & Kembalian when Cash is selected */}
            {isCash && (
              <div className="bg-white rounded-2xl border border-[#E2E6EC] p-3.5 shadow-[0_1px_2px_rgba(23,32,51,0.04)] space-y-2.5">
                <label className="text-xs font-bold text-[#172033] block">
                  Uang Tunai Diterima
                </label>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#667085] font-bold text-xs">
                    Rp
                  </span>
                  <input
                    id="input-cash-received"
                    type="text"
                    inputMode="numeric"
                    value={formatNumberInput(cashReceived)}
                    onChange={(e) =>
                      setCashReceived(parseNumberInput(e.target.value))
                    }
                    placeholder="0"
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#E2E6EC] bg-[#F7F8FA] text-[#172033] font-extrabold text-sm focus:outline-none focus:border-[#FF6B22] focus:bg-white transition tabular-nums"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {quickPills.map((pill, idx) => {
                    const isSelected = cashReceived === pill.amount;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCashReceived(pill.amount)}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#FF6B22] text-white border-[#FF6B22]'
                            : 'bg-white border-[#E2E6EC] text-[#172033] hover:bg-[#F7F8FA]'
                        }`}
                      >
                        {pill.label}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-[#E2E6EC] flex items-center justify-between tabular-nums">
                  <span className="text-xs font-bold text-[#667085]">
                    Kembalian
                  </span>
                  <span
                    className={`text-base font-extrabold ${
                      isCashInsufficient ? 'text-[#F04438]' : 'text-[#12B76A]'
                    }`}
                  >
                    {isCashInsufficient
                      ? 'Uang Belum Cukup'
                      : formatRupiah(changeAmount)}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* STICKY BOTTOM PRIMARY CTA (ARY ORANGE) */}
      <footer className="shrink-0 bg-white border-t border-[#E2E6EC] pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom,0.875rem))] shadow-[0_-4px_20px_rgba(23,32,51,0.05)]">
        <div className={containerWidthClass}>
          <button
            id="btn-complete-transaction"
            type="button"
            disabled={isSubmitting || isCashInsufficient || !validation.valid}
            onClick={handleCompleteTransaction}
            className={`w-full py-3.5 rounded-2xl font-extrabold text-[15px] flex items-center justify-center gap-2 transition cursor-pointer ${
              isSubmitting || isCashInsufficient || !validation.valid
                ? 'bg-[#E2E6EC] text-[#667085] cursor-not-allowed'
                : 'bg-[#FF6B22] hover:bg-[#E85A15] active:scale-[0.99] text-white shadow-[0_6px_16px_rgba(255,107,34,0.25)]'
            }`}
          >
            {isSubmitting ? (
              <span className="animate-pulse">Menyimpan Pesanan...</span>
            ) : isCashInsufficient ? (
              <span>Uang Diterima Belum Cukup</span>
            ) : (
              <span>
                Simpan Pesanan ({formatRupiah(netSettlementAmount)})
              </span>
            )}
          </button>
        </div>
      </footer>

      {/* OWNER QUICK PLATFORM FEE CONFIGURATION MODAL */}
      {showFeeConfigModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowFeeConfigModal(false)}
        >
          <form
            onSubmit={handleSaveConfigModal}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-[#E2E6EC] space-y-4"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E2E6EC]">
              <h3 className="text-sm font-extrabold text-[#172033]">
                Pengaturan Biaya {channelVisuals.label}
              </h3>
              <button
                type="button"
                onClick={() => setShowFeeConfigModal(false)}
                className="p-1 rounded-full text-[#667085] hover:text-[#172033] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F7F8FA] border border-[#E2E6EC]">
                <div>
                  <span className="font-bold text-[#172033] block">
                    Status Platform Aktif
                  </span>
                  <span className="text-[10px] text-[#667085]">
                    Opsi tipe pesanan aktif di kasir
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={cfgActive}
                  onChange={(e) => setCfgActive(e.target.checked)}
                  className="w-4 h-4 accent-[#FF6B22] cursor-pointer"
                />
              </div>

              <div>
                <label className="font-bold text-[#172033] block mb-1">
                  Persentase Biaya Admin (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={cfgPercentage}
                    onChange={(e) =>
                      setCfgPercentage(
                        Math.max(0, parseFloat(e.target.value) || 0)
                      )
                    }
                    className="w-full pl-3 pr-7 py-2 rounded-xl border border-[#E2E6EC] bg-[#F7F8FA] text-xs font-bold text-[#172033]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#667085]">
                    %
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-[#172033] block mb-1">
                  Biaya Admin Tetap (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#667085]">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberInput(cfgFixedFee)}
                    onChange={(e) =>
                      setCfgFixedFee(
                        Math.max(0, parseNumberInput(e.target.value))
                      )
                    }
                    className="w-full pl-8 pr-2.5 py-2 rounded-xl border border-[#E2E6EC] bg-[#F7F8FA] text-xs font-bold text-[#172033]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#172033] block mb-1">
                  Diskon / Potongan Ongkir Default (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#667085]">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberInput(cfgShippingDiscount)}
                    onChange={(e) =>
                      setCfgShippingDiscount(
                        Math.max(0, parseNumberInput(e.target.value))
                      )
                    }
                    className="w-full pl-8 pr-2.5 py-2 rounded-xl border border-[#E2E6EC] bg-[#F7F8FA] text-xs font-bold text-[#172033]"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowFeeConfigModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E2E6EC] text-xs font-bold text-[#172033] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSavingConfig}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6B22] text-white text-xs font-bold cursor-pointer"
              >
                {isSavingConfig ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
