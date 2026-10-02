import {
  OrderType,
  PlatformFeeConfig,
  PlatformFeeSetting,
  PlatformFeeSettingsRecord,
  PlatformTransactionSnapshot,
  Product,
  Sale,
} from '../types';

export const ORDER_TYPE_OPTIONS: Array<{
  id: OrderType;
  label: string;
  shortLabel: string;
  icon: string;
  walletAccount?: 'WALLET_GOFOOD' | 'WALLET_GRABFOOD' | 'WALLET_SHOPEEFOOD';
  badgeClass: string;
  activeClass: string;
  isMarketplace: boolean;
}> = [
  {
    id: 'OFFLINE',
    label: 'OFFLINE',
    shortLabel: 'Offline',
    icon: '🏪',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    activeClass: 'bg-[#172033] text-white border-[#172033] shadow-sm',
    isMarketplace: false,
  },
  {
    id: 'GOFOOD',
    label: 'GOFOOD',
    shortLabel: 'GoFood',
    icon: '🟢',
    walletAccount: 'WALLET_GOFOOD',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900',
    activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
    isMarketplace: true,
  },
  {
    id: 'GRABFOOD',
    label: 'GRABFOOD',
    shortLabel: 'GrabFood',
    icon: '🟣',
    walletAccount: 'WALLET_GRABFOOD',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-900',
    activeClass: 'bg-purple-600 text-white border-purple-600 shadow-sm',
    isMarketplace: true,
  },
  {
    id: 'SHOPEEFOOD',
    label: 'SHOPEEFOOD',
    shortLabel: 'ShopeeFood',
    icon: '🟠',
    walletAccount: 'WALLET_SHOPEEFOOD',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900',
    activeClass: 'bg-[#FF641F] text-white border-[#FF641F] shadow-sm',
    isMarketplace: true,
  },
];

export const DEFAULT_PLATFORM_FEE_SETTINGS: PlatformFeeSettingsRecord = {
  GOFOOD: {
    id: 'GOFOOD',
    platform: 'GOFOOD',
    platformName: 'GoFood',
    percentageFee: 20,
    fixedFee: 1000,
    shippingDiscount: 0,
    active: true,
    notes: 'Biaya admin GoFood 20% + Biaya Tetap Rp1.000',
  },
  GRABFOOD: {
    id: 'GRABFOOD',
    platform: 'GRABFOOD',
    platformName: 'GrabFood',
    percentageFee: 20,
    fixedFee: 0,
    shippingDiscount: 0,
    active: true,
    notes: 'Biaya admin GrabFood 20%',
  },
  SHOPEEFOOD: {
    id: 'SHOPEEFOOD',
    platform: 'SHOPEEFOOD',
    platformName: 'ShopeeFood',
    percentageFee: 25,
    fixedFee: 0,
    shippingDiscount: 1000,
    active: true,
    notes: 'Biaya admin ShopeeFood 25% + Potongan Ongkir Rp1.000',
  },
};

export const DEFAULT_PLATFORM_FEE_CONFIGS: Record<OrderType, PlatformFeeConfig> = {
  OFFLINE: {
    platform: 'OFFLINE',
    enabled: false,
    feeType: 'fixed',
    feeValue: 0,
    defaultPaymentMethod: 'CASH',
  },
  GOFOOD: {
    platform: 'GOFOOD',
    enabled: true,
    feeType: 'percentage',
    feeValue: 20,
    defaultPaymentMethod: 'BCA',
  },
  GRABFOOD: {
    platform: 'GRABFOOD',
    enabled: true,
    feeType: 'percentage',
    feeValue: 20,
    defaultPaymentMethod: 'BCA',
  },
  SHOPEEFOOD: {
    platform: 'SHOPEEFOOD',
    enabled: true,
    feeType: 'percentage',
    feeValue: 25,
    defaultPaymentMethod: 'BCA',
  },
};

export interface CalculatedPlatformFeeBreakdown {
  platform: string;
  platformName: string;
  grossAmount: number; // Total Belanja Produk
  discountAmount: number; // Diskon Pelanggan
  netOrderAmount: number; // Nilai Setelah Diskon (grossAmount - discountAmount)
  percentageFee: number; // Persentase Admin (%)
  percentageFeeAmount: number; // Nilai Biaya Admin Persentase (netOrderAmount × percentageFee%)
  fixedFee: number; // Biaya Admin Tetap (Rp)
  shippingDiscount: number; // Diskon / Potongan Ongkir dari Merchant (Rp)
  totalPlatformFee: number; // Total Potongan Platform (percentageFeeAmount + fixedFee + shippingDiscount)
  walletAmount: number; // Dana Bersih yang masuk ke Platform Wallet (netOrderAmount - totalPlatformFee)
  isActive: boolean;
}

/**
 * Calculates complete platform fee breakdown strictly following the sequence:
 * 1. Total Belanja (Gross)
 * 2. - Diskon Pelanggan
 * 3. = Nilai Setelah Diskon (Net Order Amount)
 * 4. - Biaya Admin Persentase (Nilai Setelah Diskon × Persentase%)
 * 5. - Biaya Admin Tetap
 * 6. - Diskon / Potongan Ongkir Merchant
 * 7. = Dana Bersih yang masuk ke Dompet Platform (Wallet)
 */
export function calculatePlatformFeeBreakdown(params: {
  platform: string;
  grossAmount: number;
  discountAmount?: number;
  setting?: PlatformFeeSetting | null;
  customShippingDiscount?: number;
}): CalculatedPlatformFeeBreakdown {
  const platform = (params.platform || 'OFFLINE').toUpperCase();
  const setting = params.setting;
  const platformName = setting?.platformName || getOrderTypeLabel(platform as OrderType);

  const grossAmount = Math.max(0, Math.round(Number(params.grossAmount) || 0));
  const discountAmount = Math.min(
    grossAmount,
    Math.max(0, Math.round(Number(params.discountAmount) || 0))
  );
  const netOrderAmount = Math.max(0, grossAmount - discountAmount);

  if (!setting || setting.active === false || platform === 'OFFLINE') {
    return {
      platform,
      platformName,
      grossAmount,
      discountAmount,
      netOrderAmount,
      percentageFee: 0,
      percentageFeeAmount: 0,
      fixedFee: 0,
      shippingDiscount: 0,
      totalPlatformFee: 0,
      walletAmount: netOrderAmount,
      isActive: false,
    };
  }

  const percentageFee = Math.max(0, Number(setting.percentageFee) || 0);
  const fixedFee = Math.max(0, Math.round(Number(setting.fixedFee) || 0));
  
  // Use manual customShippingDiscount if provided by cashier, otherwise fallback to setting
  const shippingDiscount =
    params.customShippingDiscount !== undefined
      ? Math.max(0, Math.round(Number(params.customShippingDiscount) || 0))
      : Math.max(0, Math.round(Number(setting.shippingDiscount) || 0));

  const percentageFeeAmount = Math.round((netOrderAmount * percentageFee) / 100);
  const totalPlatformFee = percentageFeeAmount + fixedFee + shippingDiscount;
  const walletAmount = Math.max(0, netOrderAmount - totalPlatformFee);

  return {
    platform,
    platformName,
    grossAmount,
    discountAmount,
    netOrderAmount,
    percentageFee,
    percentageFeeAmount,
    fixedFee,
    shippingDiscount,
    totalPlatformFee,
    walletAmount,
    isActive: true,
  };
}

export function getPlatformFormulaDescription(setting?: PlatformFeeSetting | null): string {
  if (!setting || !setting.active) {
    return 'Tidak ada potongan biaya (Non-aktif)';
  }
  const parts: string[] = [];
  if (setting.percentageFee > 0) {
    parts.push(`(Total - Diskon) × ${setting.percentageFee}%`);
  }
  if (setting.fixedFee > 0) {
    parts.push(`Rp${setting.fixedFee.toLocaleString('id-ID')}`);
  }
  if (setting.shippingDiscount > 0) {
    parts.push(`Rp${setting.shippingDiscount.toLocaleString('id-ID')} (Ongkir)`);
  }
  if (parts.length === 0) {
    return '0% (Tanpa Potongan)';
  }
  return parts.join(' + ');
}

export interface ResolvedProductChannelPrice {
  basePrice: number;
  channelOriginalPrice: number;
  channelPrice: number;
  itemDiscount: number;
  hasPromo: boolean;
  isConfigured: boolean;
}

/**
 * Resolves the active price and strikethrough original price for a Product
 * on a given OrderType channel ('OFFLINE' | 'GOFOOD' | 'GRABFOOD' | 'SHOPEEFOOD').
 *
 * Rules:
 * - Never mutates product.sellingPrice (basePrice).
 * - If channel is configured (`channelPrice > 0` and `isActive !== false`), uses channelPrice
 *   and channelOriginalPrice (with strikethrough only if `channelOriginalPrice > channelPrice`).
 * - If channel is NOT configured, falls back to `basePrice` (`product.sellingPrice`),
 *   never returning Rp0 or random prices.
 */
export function resolveProductChannelPrice(
  product: Product,
  orderType: OrderType = 'OFFLINE'
): ResolvedProductChannelPrice {
  const basePrice = Math.max(0, Math.round(Number(product.sellingPrice) || 0));
  const channelCfg = product.channelPricing?.[orderType];

  if (
    channelCfg &&
    channelCfg.isActive !== false &&
    typeof channelCfg.channelPrice === 'number' &&
    channelCfg.channelPrice > 0
  ) {
    const channelPrice = Math.round(channelCfg.channelPrice);
    const channelOriginalPrice =
      typeof channelCfg.channelOriginalPrice === 'number' &&
      channelCfg.channelOriginalPrice >= channelPrice
        ? Math.round(channelCfg.channelOriginalPrice)
        : channelPrice;
    const itemDiscount = Math.max(0, channelOriginalPrice - channelPrice);
    return {
      basePrice,
      channelOriginalPrice,
      channelPrice,
      itemDiscount,
      hasPromo: channelOriginalPrice > channelPrice,
      isConfigured: true,
    };
  }

  // Backward compatibility for legacy OFFLINE originalPrice if channelPricing.OFFLINE isn't explicitly set
  if (
    orderType === 'OFFLINE' &&
    !channelCfg &&
    typeof product.originalPrice === 'number' &&
    product.originalPrice > basePrice &&
    basePrice > 0
  ) {
    const orig = Math.round(product.originalPrice);
    return {
      basePrice,
      channelOriginalPrice: orig,
      channelPrice: basePrice,
      itemDiscount: Math.max(0, orig - basePrice),
      hasPromo: orig > basePrice,
      isConfigured: false,
    };
  }

  return {
    basePrice,
    channelOriginalPrice: basePrice,
    channelPrice: basePrice,
    itemDiscount: 0,
    hasPromo: false,
    isConfigured: false,
  };
}

export function isMarketplaceOrder(orderType?: OrderType | string | null): boolean {
  return (
    orderType === 'GOFOOD' ||
    orderType === 'GRABFOOD' ||
    orderType === 'SHOPEEFOOD'
  );
}

export function getOrderTypeLabel(orderType?: OrderType | string | null): string {
  if (!orderType || orderType === 'OFFLINE') return 'Offline';
  if (orderType === 'GOFOOD') return 'GoFood';
  if (orderType === 'GRABFOOD') return 'GrabFood';
  if (orderType === 'SHOPEEFOOD') return 'ShopeeFood';
  return String(orderType);
}

export function getOrderTypeBadgeClass(orderType?: OrderType | string | null): string {
  const found = ORDER_TYPE_OPTIONS.find((o) => o.id === (orderType || 'OFFLINE'));
  return found ? found.badgeClass : ORDER_TYPE_OPTIONS[0].badgeClass;
}

export function getOrderTypeMeta(orderType?: OrderType | string | null) {
  const found = ORDER_TYPE_OPTIONS.find((o) => o.id === (orderType || 'OFFLINE'));
  return found || ORDER_TYPE_OPTIONS[0];
}

/**
 * Calculates the platform service fee ONLY when the owner has explicitly enabled
 * the platform configuration (`config.enabled === true` and `config.feeValue > 0`).
 * Never applies a hardcoded percentage.
 */
export function calculateConfiguredPlatformFee(
  foodTotal: number,
  config?: PlatformFeeConfig
): number {
  if (!config || !config.enabled || config.feeValue <= 0) {
    return 0;
  }
  const safeFoodTotal = Math.max(0, Number(foodTotal) || 0);
  if (config.feeType === 'percentage') {
    return Math.max(0, Math.round((safeFoodTotal * config.feeValue) / 100));
  }
  return Math.max(0, Math.round(config.feeValue));
}

export interface NormalizedSaleFinancials {
  orderType: OrderType;
  isMarketplace: boolean;
  subtotal: number; // Gross food sales before discounts
  itemDiscountTotal: number; // Strikethrough / item discount total
  orderDiscount: number; // Transaction-level nominal discount
  legacyDiscount: number; // Legacy discount on old transactions that did not separate item vs order discount
  totalFoodDiscount: number; // itemDiscountTotal + orderDiscount + legacyDiscount
  discountedSubtotal: number; // subtotal - itemDiscountTotal
  foodTotal: number; // Omzet Makanan (after food discounts, excluding shipping & platform fees)
  shippingFee: number;
  shippingDiscount: number;
  customerShippingPaid: number; // shippingFee - shippingDiscount
  platformServiceFee: number;
  finalAmount: number; // Food total (Omzet Makanan)
  netSettlementAmount: number; // Net amount received by merchant after platformServiceFee
  cashReceived: number;
  changeAmount: number;
}

/**
 * Safely normalizes any Sale record (including legacy sales without orderType or separated discounts).
 * - Legacy sales without orderType default to 'OFFLINE'.
 * - Legacy sales with only `discount` do NOT arbitrarily assign it to `itemDiscount` or `orderDiscount`,
 *   preserving exact backward compatibility.
 */
export function normalizeSaleFinancials(sale: Sale): NormalizedSaleFinancials {
  const orderType: OrderType =
    sale.orderType === 'GOFOOD' ||
    sale.orderType === 'GRABFOOD' ||
    sale.orderType === 'SHOPEEFOOD'
      ? sale.orderType
      : 'OFFLINE';

  const isMarketplace = isMarketplaceOrder(orderType);

  const hasStructuredBreakdown =
    typeof sale.subtotal === 'number' ||
    typeof sale.foodTotal === 'number' ||
    typeof sale.itemDiscountTotal === 'number' ||
    typeof sale.orderDiscount === 'number';

  if (hasStructuredBreakdown) {
    // Compute item gross and item discount from items if needed
    const itemsGross = (sale.items || []).reduce((acc, it) => {
      const orig =
        typeof it.originalPrice === 'number' && it.originalPrice >= it.sellingPrice
          ? it.originalPrice
          : it.sellingPrice;
      return acc + orig * (it.quantity || 0);
    }, 0);

    const itemsDisc = (sale.items || []).reduce((acc, it) => {
      const disc =
        typeof it.itemDiscount === 'number'
          ? Math.max(0, it.itemDiscount)
          : typeof it.originalPrice === 'number' && it.originalPrice > it.sellingPrice
          ? it.originalPrice - it.sellingPrice
          : 0;
      return acc + disc * (it.quantity || 0);
    }, 0);

    const subtotal = Math.max(0, Number(sale.subtotal ?? (itemsGross || sale.totalAmount || 0)));
    const itemDiscountTotal = Math.min(
      subtotal,
      Math.max(0, Number(sale.itemDiscountTotal ?? itemsDisc))
    );
    const discountedSubtotal = Math.max(0, subtotal - itemDiscountTotal);
    const orderDiscount = Math.min(
      discountedSubtotal,
      Math.max(0, Number(sale.orderDiscount ?? 0))
    );
    const foodTotal =
      typeof sale.foodTotal === 'number'
        ? Math.max(0, sale.foodTotal)
        : Math.max(0, discountedSubtotal - orderDiscount);

    const shippingFee = Math.max(0, Number(sale.shippingFee || 0));
    const shippingDiscount = Math.min(
      shippingFee,
      Math.max(0, Number(sale.shippingDiscount || 0))
    );
    const customerShippingPaid =
      typeof sale.customerShippingPaid === 'number'
        ? Math.max(0, sale.customerShippingPaid)
        : Math.max(0, shippingFee - shippingDiscount);

    const platformServiceFee = Math.max(0, Number(sale.platformServiceFee || 0));
    const netSettlementAmount =
      typeof sale.netSettlementAmount === 'number'
        ? sale.netSettlementAmount
        : Math.max(0, foodTotal - platformServiceFee);
    const cashReceived = Math.max(0, Number(sale.cashReceived ?? foodTotal));
    const changeAmount =
      typeof sale.changeAmount === 'number'
        ? Math.max(0, sale.changeAmount)
        : Math.max(0, cashReceived - foodTotal);

    return {
      orderType,
      isMarketplace,
      subtotal,
      itemDiscountTotal,
      orderDiscount,
      legacyDiscount: 0,
      totalFoodDiscount: itemDiscountTotal + orderDiscount,
      discountedSubtotal,
      foodTotal,
      shippingFee,
      shippingDiscount,
      customerShippingPaid,
      platformServiceFee,
      finalAmount: foodTotal,
      netSettlementAmount,
      cashReceived,
      changeAmount,
    };
  }

  // Legacy transaction fallback
  const rawTotal = Math.max(0, Number(sale.totalAmount ?? sale.finalAmount ?? 0));
  const legacyDiscount = Math.min(rawTotal, Math.max(0, Number(sale.discount || 0)));
  const foodTotal =
    typeof sale.finalAmount === 'number'
      ? Math.max(0, sale.finalAmount)
      : Math.max(0, rawTotal - legacyDiscount);
  const cashReceived = Math.max(0, Number(sale.cashReceived ?? foodTotal));
  const changeAmount =
    typeof sale.changeAmount === 'number'
      ? Math.max(0, sale.changeAmount)
      : Math.max(0, cashReceived - foodTotal);

  return {
    orderType: 'OFFLINE',
    isMarketplace: false,
    subtotal: rawTotal,
    itemDiscountTotal: 0,
    orderDiscount: 0,
    legacyDiscount,
    totalFoodDiscount: legacyDiscount,
    discountedSubtotal: rawTotal,
    foodTotal,
    shippingFee: 0,
    shippingDiscount: 0,
    customerShippingPaid: 0,
    platformServiceFee: 0,
    finalAmount: foodTotal,
    netSettlementAmount: foodTotal,
    cashReceived,
    changeAmount,
  };
}

export interface CheckoutValidationResult {
  valid: boolean;
  error?: string;
  subtotal: number;
  itemDiscountTotal: number;
  discountedSubtotal: number;
  orderDiscount: number;
  foodTotal: number;
  shippingFee: number;
  shippingDiscount: number;
  customerShippingPaid: number;
  platformServiceFee: number;
  netSettlementAmount: number;
}

export function validateAndCalculateCheckout(params: {
  orderType: OrderType;
  subtotal: number;
  itemDiscountTotal: number;
  orderDiscount: number;
  shippingFee?: number;
  shippingDiscount?: number;
  platformServiceFee?: number;
  allowNegativeSettlement?: boolean;
}): CheckoutValidationResult {
  const subtotal = Number(params.subtotal || 0);
  const itemDiscountTotal = Number(params.itemDiscountTotal || 0);
  const orderDiscount = Number(params.orderDiscount || 0);
  const shippingFee = Number(params.shippingFee || 0);
  const shippingDiscount = Number(params.shippingDiscount || 0);
  const platformServiceFee = Number(params.platformServiceFee || 0);

  if (subtotal < 0) {
    return {
      valid: false,
      error: 'Harga makanan (subtotal) tidak boleh negatif.',
      subtotal: 0,
      itemDiscountTotal: 0,
      discountedSubtotal: 0,
      orderDiscount: 0,
      foodTotal: 0,
      shippingFee: 0,
      shippingDiscount: 0,
      customerShippingPaid: 0,
      platformServiceFee: 0,
      netSettlementAmount: 0,
    };
  }

  if (itemDiscountTotal < 0 || orderDiscount < 0) {
    return {
      valid: false,
      error: 'Diskon tidak boleh bernilai negatif.',
      subtotal,
      itemDiscountTotal: Math.max(0, itemDiscountTotal),
      discountedSubtotal: Math.max(0, subtotal),
      orderDiscount: Math.max(0, orderDiscount),
      foodTotal: Math.max(0, subtotal),
      shippingFee: Math.max(0, shippingFee),
      shippingDiscount: Math.max(0, shippingDiscount),
      customerShippingPaid: 0,
      platformServiceFee: Math.max(0, platformServiceFee),
      netSettlementAmount: 0,
    };
  }

  if (itemDiscountTotal > subtotal) {
    return {
      valid: false,
      error: 'Diskon harga coret tidak boleh melebihi subtotal harga makanan.',
      subtotal,
      itemDiscountTotal,
      discountedSubtotal: 0,
      orderDiscount,
      foodTotal: 0,
      shippingFee,
      shippingDiscount,
      customerShippingPaid: 0,
      platformServiceFee,
      netSettlementAmount: 0,
    };
  }

  const discountedSubtotal = Math.max(0, subtotal - itemDiscountTotal);

  if (orderDiscount > discountedSubtotal) {
    return {
      valid: false,
      error: 'Diskon nominal tidak boleh melebihi subtotal makanan setelah harga promo.',
      subtotal,
      itemDiscountTotal,
      discountedSubtotal,
      orderDiscount,
      foodTotal: 0,
      shippingFee,
      shippingDiscount,
      customerShippingPaid: 0,
      platformServiceFee,
      netSettlementAmount: 0,
    };
  }

  const foodTotal = Math.max(0, discountedSubtotal - orderDiscount);

  if (shippingFee < 0) {
    return {
      valid: false,
      error: 'Ongkir tidak boleh bernilai negatif.',
      subtotal,
      itemDiscountTotal,
      discountedSubtotal,
      orderDiscount,
      foodTotal,
      shippingFee: 0,
      shippingDiscount: 0,
      customerShippingPaid: 0,
      platformServiceFee,
      netSettlementAmount: Math.max(0, foodTotal - platformServiceFee),
    };
  }

  if (shippingDiscount < 0) {
    return {
      valid: false,
      error: 'Diskon ongkir tidak boleh bernilai negatif.',
      subtotal,
      itemDiscountTotal,
      discountedSubtotal,
      orderDiscount,
      foodTotal,
      shippingFee,
      shippingDiscount: 0,
      customerShippingPaid: shippingFee,
      platformServiceFee,
      netSettlementAmount: Math.max(0, foodTotal - platformServiceFee),
    };
  }

  if (shippingDiscount > shippingFee) {
    return {
      valid: false,
      error: 'Diskon ongkir tidak boleh lebih besar dari ongkir.',
      subtotal,
      itemDiscountTotal,
      discountedSubtotal,
      orderDiscount,
      foodTotal,
      shippingFee,
      shippingDiscount,
      customerShippingPaid: 0,
      platformServiceFee,
      netSettlementAmount: Math.max(0, foodTotal - platformServiceFee),
    };
  }

  const customerShippingPaid = Math.max(0, shippingFee - shippingDiscount);

  if (platformServiceFee < 0) {
    return {
      valid: false,
      error: 'Biaya layanan aplikasi / platform tidak boleh bernilai negatif.',
      subtotal,
      itemDiscountTotal,
      discountedSubtotal,
      orderDiscount,
      foodTotal,
      shippingFee,
      shippingDiscount,
      customerShippingPaid,
      platformServiceFee: 0,
      netSettlementAmount: foodTotal,
    };
  }

  const rawNetSettlement = foodTotal - platformServiceFee;
  if (rawNetSettlement < 0 && !params.allowNegativeSettlement) {
    return {
      valid: false,
      error: 'Biaya platform melebihi total makanan sehingga Net Settlement menjadi negatif.',
      subtotal,
      itemDiscountTotal,
      discountedSubtotal,
      orderDiscount,
      foodTotal,
      shippingFee,
      shippingDiscount,
      customerShippingPaid,
      platformServiceFee,
      netSettlementAmount: 0,
    };
  }

  const netSettlementAmount = params.allowNegativeSettlement
    ? rawNetSettlement
    : Math.max(0, rawNetSettlement);

  return {
    valid: true,
    subtotal,
    itemDiscountTotal,
    discountedSubtotal,
    orderDiscount,
    foodTotal,
    shippingFee,
    shippingDiscount,
    customerShippingPaid,
    platformServiceFee,
    netSettlementAmount,
  };
}
