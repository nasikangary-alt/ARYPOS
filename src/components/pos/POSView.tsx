import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  Product,
  PaymentMethod,
  Sale,
  Ingredient,
  CompleteTransactionOptions,
  OrderType,
} from '../../types';
import { formatRupiah, formatNumber } from '../../utils/formatters';
import { resolveProductChannelPrice } from '../../utils/saleChannel';
import {
  calculateProductAvailability,
  getPackageOutOfStockReason,
  getProductComposition,
  isPosMenuProduct,
  resolveProductReference,
  resolveIngredientReference,
} from '../../services/stockEngine';
import { getProductImageUrl } from '../../utils/productImages';
import { CartBottomSheet } from './CartBottomSheet';
import { PaymentScreen } from './PaymentScreen';
import { PaymentSuccessScreen } from './PaymentSuccessScreen';
import { OpeningCashModal } from '../cash/OpeningCashModal';
import { CloseCashierModal } from '../cash/CloseCashierModal';
import { QuickDrawerPurchaseModal } from '../purchase/QuickDrawerPurchaseModal';
import {
  Search,
  Plus,
  Minus,
  Coins,
  LogOut,
  AlertTriangle,
  X,
  Store,
  Tag,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  ShoppingBag,
} from 'lucide-react';

// Priority order for Ayam Geprek ARY menu items
const PRODUCT_PRIORITY_ORDER: Record<string, number> = {
  'Ayam Geprek': 1,
  'Teh Manis': 2,
  'Paket Mantul': 3,
  'Paket Kenyang': 4,
  'Paket Komplit': 5,
  'Paket Hemat': 6,
  'Paket Nasi Ayam Geprek': 7,
  'Ayam Geprek + Sambal': 8,
  'Ayam Geprek + Indomie': 9,
  'Ayam Geprek + Indomie + Sambal': 10,
  'Ayam Geprek + Indomie + Sambal + Teh Manis': 11,
  'Es Teh Manis': 12,
  Tahu: 13,
  Tempe: 14,
  Indomie: 15,
};

const FILTER_CATEGORIES = [
  { id: 'semua', label: 'Semua' },
  { id: 'ayam', label: 'Ayam' },
  { id: 'paket', label: 'Paket' },
  { id: 'minuman', label: 'Minuman' },
  { id: 'tambahan', label: 'Tambahan' },
];

const CHANNEL_TABS: Array<{
  id: OrderType;
  label: string;
  dotColor?: string;
  activeBg: string;
}> = [
  {
    id: 'OFFLINE',
    label: 'OFFLINE',
    activeBg: 'bg-[#FF6B22] text-white border-[#FF6B22] shadow-2xs',
  },
  {
    id: 'GOFOOD',
    label: 'GOFOOD',
    dotColor: 'bg-[#12B76A]',
    activeBg: 'bg-[#FF6B22] text-white border-[#FF6B22] shadow-2xs',
  },
  {
    id: 'GRABFOOD',
    label: 'GRABFOOD',
    dotColor: 'bg-[#8B3DFF]',
    activeBg: 'bg-[#FF6B22] text-white border-[#FF6B22] shadow-2xs',
  },
  {
    id: 'SHOPEEFOOD',
    label: 'SHOPEEFOOD',
    dotColor: 'bg-[#FF6B22]',
    activeBg: 'bg-[#FF6B22] text-white border-[#FF6B22] shadow-2xs',
  },
];

interface POSViewProps {
  onNavigateTab?: (tab: string) => void;
  isDesktopWide?: boolean;
}

export const POSView: React.FC<POSViewProps> = ({
  onNavigateTab,
  isDesktopWide = false,
}) => {
  const {
    products,
    productsMap,
    recipes,
    ingredientsMap,
    assemblies,
    assembliesMap,
    cart,
    selectedOrderType,
    setSelectedOrderType,
    addToCart,
    updateCartQuantity,
    cartTotal,
    cartCount,
    completeTransaction,
    shifts,
    openShift,
    closeShift,
    sales,
  } = useApp();
  const { currentEmployee, currentRole, todayAttendance, logout } = useAuth();

  const [selectedCategory, setSelectedCategory] = useState<string>('semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);
  const [viewStep, setViewStep] = useState<'menu' | 'payment' | 'success'>('menu');
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [pendingOrderNotes, setPendingOrderNotes] = useState<string>('');

  // Shift & Cashier Menu States
  const [showCashierMenu, setShowCashierMenu] = useState(false);
  const [showOpeningCashModal, setShowOpeningCashModal] = useState(false);
  const [showCloseKasirModal, setShowCloseKasirModal] = useState(false);
  const [showQuickPurchaseModal, setShowQuickPurchaseModal] = useState(false);
  const [pendingOrderTypeChange, setPendingOrderTypeChange] =
    useState<OrderType | null>(null);

  const handleSelectOrderType = (nextType: OrderType) => {
    if (nextType === selectedOrderType) return;
    if (cart.length > 0) {
      setPendingOrderTypeChange(nextType);
    } else {
      setSelectedOrderType(nextType);
    }
  };

  const handleConfirmOrderTypeChange = () => {
    if (pendingOrderTypeChange) {
      setSelectedOrderType(pendingOrderTypeChange);
      setPendingOrderTypeChange(null);
    }
  };

  // Active shift belonging to current logged in user
  const activeShift = useMemo(() => {
    if (!currentEmployee) return undefined;
    return shifts.find(
      (s) =>
        s.status === 'OPEN' &&
        Boolean(s.staffId) &&
        ((Boolean(currentEmployee.id) && s.staffId === currentEmployee.id) ||
          (Boolean(currentEmployee.uid) && s.staffId === currentEmployee.uid) ||
          (Boolean(currentEmployee.username) &&
            s.staffId === currentEmployee.username))
    );
  }, [shifts, currentEmployee]);

  // Keep localStorage synced for context use
  React.useEffect(() => {
    if (activeShift) {
      localStorage.setItem('ary_active_staff_id', activeShift.staffId);
      localStorage.setItem('ary_active_staff_name', activeShift.staffName);
      localStorage.setItem('ary_active_shift_id', activeShift.id);
    } else if (currentEmployee) {
      localStorage.setItem('ary_active_staff_id', currentEmployee.id);
      localStorage.setItem('ary_active_staff_name', currentEmployee.name);
      localStorage.removeItem('ary_active_shift_id');
    } else {
      localStorage.removeItem('ary_active_staff_id');
      localStorage.removeItem('ary_active_staff_name');
      localStorage.removeItem('ary_active_shift_id');
    }
  }, [activeShift, currentEmployee]);

  // Live stock availability adjusted dynamically by items currently in the cart
  const productStockStatus = useMemo(() => {
    const adjustedProducts = new Map<string, Product>();
    for (const [id, p] of productsMap.entries()) {
      adjustedProducts.set(id, {
        ...p,
        stock: typeof p.stock === 'number' ? p.stock : 0,
      });
    }

    const adjustedIngredients = new Map<string, Ingredient>();
    for (const [id, ing] of ingredientsMap.entries()) {
      adjustedIngredients.set(id, {
        ...ing,
        stock: typeof ing.stock === 'number' ? ing.stock : 0,
      });
    }

    const deductStock = (
      prod: Product,
      qty: number,
      visited: Set<string> = new Set()
    ) => {
      if (!prod || visited.has(prod.id)) return;
      const nextVisited = new Set(visited);
      nextVisited.add(prod.id);

      const composition = getProductComposition(prod, assembliesMap);
      if (composition && composition.length > 0) {
        for (const comp of composition) {
          const deductQty = qty * (comp.quantity || 1);
          if (comp.sourceType === 'PRODUCT') {
            const compProd = resolveProductReference(
              comp.sourceId,
              comp.sourceName,
              adjustedProducts
            );
            if (compProd) {
              const nestedComp = getProductComposition(compProd, assembliesMap);
              if (
                (nestedComp && nestedComp.length > 0) ||
                compProd.stockSource === 'COMPOSITION' ||
                compProd.productType === 'PACKAGE'
              ) {
                deductStock(compProd, deductQty, nextVisited);
              } else {
                const current =
                  typeof compProd.stock === 'number' ? compProd.stock : 0;
                compProd.stock = Math.max(0, current - deductQty);
              }
            }
          } else {
            const compIng = resolveIngredientReference(
              comp.sourceId,
              comp.sourceName,
              adjustedIngredients
            );
            if (compIng) {
              const current =
                typeof compIng.stock === 'number' ? compIng.stock : 0;
              compIng.stock = Math.max(0, current - deductQty);
            }
          }
        }
        return;
      }

      if (
        prod.productType === 'PACKAGE' &&
        prod.packageItems &&
        prod.packageItems.length > 0
      ) {
        for (const pkgItem of prod.packageItems) {
          const compProd = resolveProductReference(
            pkgItem.productId,
            pkgItem.productName,
            adjustedProducts
          );
          if (compProd) {
            deductStock(compProd, qty * (pkgItem.quantity || 1), nextVisited);
          }
        }
        return;
      }

      if (prod.stockTracked === false) return;

      const targetProd = adjustedProducts.get(prod.id);
      if (targetProd) {
        const current =
          typeof targetProd.stock === 'number' ? targetProd.stock : 0;
        targetProd.stock = Math.max(0, current - qty);
      }
    };

    for (const item of cart) {
      deductStock(item.product, item.quantity);
    }

    const map = new Map<string, number>();
    for (const p of products) {
      const avail = calculateProductAvailability(
        p,
        undefined,
        adjustedIngredients,
        adjustedProducts,
        assembliesMap
      );
      map.set(p.id, avail);
    }
    return map;
  }, [products, cart, ingredientsMap, productsMap, assembliesMap]);

  const getOutOfStockReason = (p: Product): string => {
    const reason = getPackageOutOfStockReason(
      p,
      productsMap,
      ingredientsMap,
      assembliesMap
    );
    if (reason.limitingComponent) {
      return `${reason.limitingComponent.name}: ${reason.limitingComponent.stock} sisa`;
    }
    if (p.stockSource === 'PRODUCTION') {
      return 'Butuh Produksi Dapur';
    }
    return 'Stok Habis';
  };

  // Filter & sort products (strictly Menu POS, excluding Produk Hasil Produksi)
  const filteredProducts = useMemo(() => {
    const list = products.filter((p) => {
      if (!isPosMenuProduct(p, recipes, assemblies)) return false;

      let matchCat = true;
      const nameLower = p.name.toLowerCase();
      const catId = p.categoryId?.toLowerCase() || '';

      if (selectedCategory === 'ayam') {
        matchCat = nameLower.includes('ayam') && !nameLower.includes('paket');
      } else if (selectedCategory === 'paket') {
        matchCat = nameLower.includes('paket');
      } else if (selectedCategory === 'minuman') {
        matchCat =
          nameLower.includes('teh') ||
          nameLower.includes('es') ||
          nameLower.includes('jus') ||
          catId.includes('drink') ||
          catId.includes('minum');
      } else if (selectedCategory === 'tambahan' || selectedCategory === 'lainnya') {
        const isAyam =
          nameLower.includes('ayam') && !nameLower.includes('paket');
        const isPaket = nameLower.includes('paket');
        const isMinuman =
          nameLower.includes('teh') ||
          nameLower.includes('es') ||
          nameLower.includes('jus') ||
          catId.includes('drink') ||
          catId.includes('minum');
        matchCat = !isAyam && !isPaket && !isMinuman;
      }

      const matchQuery =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchCat && matchQuery && p.active !== false;
    });

    return list.sort((a, b) => {
      const prioA = PRODUCT_PRIORITY_ORDER[a.name] ?? 99;
      const prioB = PRODUCT_PRIORITY_ORDER[b.name] ?? 99;
      if (prioA !== prioB) return prioA - prioB;
      return a.name.localeCompare(b.name);
    });
  }, [products, recipes, assemblies, selectedCategory, searchQuery]);

  const handleAddToCart = (product: Product) => {
    const res = addToCart(product);
    if (!res.success && res.message) {
      alert(res.message);
    }
  };

  const handleConfirmCheckout = async (
    paymentMethod: PaymentMethod,
    cashReceived: number,
    discount: number,
    options?: CompleteTransactionOptions
  ) => {
    const sale = await completeTransaction(
      paymentMethod,
      cashReceived,
      discount,
      {
        ...options,
        notes: options?.notes || pendingOrderNotes || undefined,
      }
    );
    setCompletedSale(sale);
    setPendingOrderNotes('');
    setIsCartSheetOpen(false);
    setViewStep('success');
  };

  const handleStartNewTransaction = () => {
    setCompletedSale(null);
    setSelectedOrderType('OFFLINE');
    setViewStep('menu');
  };

  const handleExecuteCloseShiftAndLogout = async (
    actualCash?: number,
    notes?: string,
    closingDetails?: {
      expectedCash: number;
      cashDifference: number;
      closingDenominations: Record<string, number>;
    }
  ) => {
    sessionStorage.setItem('ary_closing_shift', '1');
    try {
      if (activeShift) {
        if (typeof actualCash !== 'number' || Number.isNaN(actualCash)) {
          sessionStorage.removeItem('ary_closing_shift');
          throw new Error('Jumlah uang fisik belum dihitung.');
        }
        await closeShift(
          activeShift.id,
          actualCash,
          notes || 'Tutup kasir dari halaman Kasir',
          closingDetails
        );
      }
      await logout();
      setShowCloseKasirModal(false);
      setShowCashierMenu(false);
    } catch (err) {
      sessionStorage.removeItem('ary_closing_shift');
      throw err;
    }
  };

  const roleLabel =
    currentRole === 'KASIR'
      ? 'Kasir'
      : currentRole === 'OWNER'
      ? 'Owner'
      : currentRole === 'ADMIN'
      ? 'Admin'
      : 'Kasir';

  // ==========================================
  // PAYMENT SCREEN STEP
  // ==========================================
  if (viewStep === 'payment') {
    return (
      <PaymentScreen
        totalAmount={cartTotal}
        isDesktopWide={isDesktopWide}
        onBack={() => {
          setViewStep('menu');
          setIsCartSheetOpen(true);
        }}
        onConfirm={handleConfirmCheckout}
      />
    );
  }

  // ==========================================
  // TRANSACTION SUCCESS SCREEN
  // ==========================================
  if (viewStep === 'success' && completedSale) {
    return (
      <PaymentSuccessScreen
        sale={completedSale}
        isDesktopWide={isDesktopWide}
        onNewTransaction={handleStartNewTransaction}
      />
    );
  }

  // ==========================================
  // MAIN CASHIER SCREEN (CLEAN & FAST LIST POS)
  // ==========================================
  return (
    <div
      className={`min-h-screen bg-[#F7F8FA] text-[#172033] ${
        isDesktopWide
          ? 'w-full max-w-full pb-24'
          : 'max-w-[430px] mx-auto w-full pb-32'
      }`}
    >
      {/* STICKY TOP CONTROLS: HEADER + CHANNEL + SEARCH + CATEGORIES */}
      <header
        className={`sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E2E6EC] ${
          isDesktopWide ? 'px-4 sm:px-6 pt-3 pb-3 space-y-2.5' : 'px-3.5 pt-3 pb-2.5 space-y-2.5'
        }`}
      >
        {/* 1. COMPACT HEADER */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[20px] sm:text-[22px] font-extrabold text-[#172033] tracking-tight leading-none">
              Kasir
            </h1>
            <p className="text-[12px] sm:text-[13px] font-medium text-[#667085] leading-snug mt-0.5">
              Ayam Geprek ARY
            </p>
          </div>

          {/* Right: Small green status dot + Cashier Name (Kasir) with subtle dropdown chevron */}
          <button
            type="button"
            onClick={() => setShowCashierMenu(true)}
            className="px-3 py-1.5 rounded-full bg-white hover:bg-[#F7F8FA] border border-[#E2E6EC] shadow-2xs flex items-center gap-2 text-xs font-bold text-[#172033] active:scale-95 transition cursor-pointer shrink-0"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#12B76A] shrink-0" />
            <span className="truncate max-w-[160px]">
              {currentEmployee?.name || 'Rina'} ({roleLabel})
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#667085] shrink-0" />
          </button>
        </div>

        {/* 2. CHANNEL SELECTOR (OFFLINE / GOFOOD / GRABFOOD / SHOPEEFOOD) */}
        <div className="flex items-center gap-2 overflow-x-auto flex-nowrap no-scrollbar py-0.5">
          {CHANNEL_TABS.map((ch) => {
            const isSelected = selectedOrderType === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => handleSelectOrderType(ch.id)}
                className={`h-9 min-w-[96px] sm:min-w-[112px] px-3.5 rounded-xl border text-xs font-extrabold tracking-wide flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap transition cursor-pointer active:scale-[0.98] ${
                  isSelected
                    ? ch.activeBg
                    : 'bg-[#F7F8FA] border-[#E2E6EC] text-[#172033] hover:bg-white'
                }`}
              >
                {ch.id === 'OFFLINE' ? (
                  <Store
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? 'text-white' : 'text-[#FF6B22]'
                    }`}
                  />
                ) : (
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      isSelected ? 'bg-white' : ch.dotColor
                    }`}
                  />
                )}
                <span>{ch.label}</span>
              </button>
            );
          })}
        </div>

        {/* 3. SEARCH FIELD */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#667085]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari menu makanan / minuman..."
            className="w-full h-9 sm:h-10 pl-10 pr-8 rounded-full bg-[#F7F8FA] border border-[#E2E6EC] text-xs font-medium text-[#172033] placeholder-[#667085] focus:outline-none focus:border-[#FF6B22] focus:bg-white transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#172033] p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 4. CATEGORY FILTER (Semua | Ayam | Paket | Minuman | Tambahan) */}
        <div className="flex items-center gap-2 overflow-x-auto flex-nowrap no-scrollbar pt-0.5">
          {FILTER_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 whitespace-nowrap transition cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'bg-[#FF6B22] text-white border border-[#FF6B22] shadow-2xs'
                    : 'bg-white border border-[#E2E6EC] text-[#172033] hover:bg-[#F7F8FA]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* 5. MENU LIST (COMPACT LIST VIEW ONLY, FULL POS WIDTH) */}
      <main className={isDesktopWide ? 'px-4 sm:px-6 pt-3 pb-4' : 'px-3.5 pt-2.5 pb-4'}>
        <div className="flex flex-col gap-2">
          {filteredProducts.map((product) => {
            const stock = productStockStatus.get(product.id) ?? 0;
            const isOutOfStock = stock <= 0;
            const inCartItem = cart.find((ci) => ci.product.id === product.id);
            const reason = isOutOfStock ? getOutOfStockReason(product) : '';
            const channelPricing = resolveProductChannelPrice(
              product,
              selectedOrderType
            );

            return (
              <div
                key={product.id}
                onClick={() => !isOutOfStock && handleAddToCart(product)}
                className={`bg-white rounded-2xl border px-3 py-2 flex items-center justify-between gap-3 transition-all shadow-[0_1px_2px_rgba(23,32,51,0.04)] ${
                  isOutOfStock
                    ? 'border-[#E2E6EC] opacity-65'
                    : inCartItem
                    ? 'border-[#FF6B22]/40 bg-[#FFFDFB] active:scale-[0.995] cursor-pointer'
                    : 'border-[#E2E6EC] hover:border-[#FF6B22]/40 active:scale-[0.995] cursor-pointer'
                }`}
              >
                {/* Left: Compact Square Food Thumbnail + Details */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-[#F7F8FA] border border-[#E2E6EC]">
                    <img
                      src={getProductImageUrl(product.name)}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    {inCartItem && (
                      <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF6B22] text-white font-extrabold text-[10px] flex items-center justify-center shadow-xs">
                        {inCartItem.quantity}
                      </span>
                    )}
                  </div>

                  {/* Middle: Name, Price in Orange, Stock Status in Green */}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-[14px] sm:text-[15px] text-[#172033] leading-snug truncate">
                      {product.name}
                    </h3>

                    <div className="mt-0.5 flex items-baseline gap-1.5 tabular-nums">
                      {channelPricing.hasPromo && (
                        <span className="text-[11px] text-[#667085] line-through font-medium">
                          {formatRupiah(channelPricing.channelOriginalPrice)}
                        </span>
                      )}
                      <span className="font-extrabold text-[13px] sm:text-[14px] text-[#FF6B22] leading-snug">
                        {formatRupiah(channelPricing.channelPrice)}
                      </span>
                    </div>

                    <div className="mt-0.5 text-[11px] sm:text-[12px] leading-snug">
                      {isOutOfStock ? (
                        <span className="font-semibold text-[#F04438]">
                          Habis ({reason})
                        </span>
                      ) : (
                        <span className="font-medium text-[#12B76A]">
                          Tersedia ({stock})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Far Right: Compact Rounded "+" Button */}
                <div
                  className="shrink-0 flex items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {inCartItem && (
                    <button
                      type="button"
                      onClick={() =>
                        updateCartQuantity(product.id, inCartItem.quantity - 1)
                      }
                      className="w-8 h-9 rounded-xl bg-white border border-[#FFD9C2] text-[#FF6B22] flex items-center justify-center active:scale-95 transition cursor-pointer"
                      title="Kurangi"
                    >
                      <Minus className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => !isOutOfStock && handleAddToCart(product)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                      isOutOfStock
                        ? 'bg-[#F7F8FA] text-[#667085] border border-[#E2E6EC] cursor-not-allowed'
                        : 'bg-[#FFF3EC] hover:bg-[#FFE6D5] border border-[#FFD9C2] text-[#FF6B22] active:scale-95 cursor-pointer'
                    }`}
                    title="Tambah ke pesanan"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-10 text-[#667085] bg-white rounded-2xl border border-[#E2E6EC] p-6 space-y-2.5 mt-2">
            <p className="text-xs font-semibold text-[#172033]">
              {products.length === 0
                ? 'Belum ada menu produk terdaftar'
                : 'Menu tidak ditemukan'}
            </p>
            {products.length === 0 && onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('menu')}
                className="px-4 py-2 rounded-xl bg-[#FF6B22] text-white text-xs font-bold shadow-xs hover:bg-[#E85A15] transition cursor-pointer"
              >
                + Tambah Menu Produk Baru
              </button>
            )}
          </div>
        )}
      </main>

      {/* 6. STICKY CART BAR ALIGNED WITH POS MAIN AREA */}
      <div
        className={`fixed z-30 pointer-events-none ${
          isDesktopWide
            ? 'bottom-[56px] lg:bottom-3 left-0 lg:left-64 right-0 px-4 sm:px-6 pb-1.5 lg:pb-0'
            : 'bottom-[56px] left-0 right-0 px-3 pb-1.5'
        }`}
      >
        <div className={isDesktopWide ? 'w-full max-w-full' : 'max-w-[430px] mx-auto'}>
          <div
            onClick={() => {
              if (cartCount > 0) {
                setIsCartSheetOpen(true);
              }
            }}
            className={`pointer-events-auto bg-[#FF6B22] text-white rounded-2xl px-4 py-2.5 shadow-[0_6px_20px_rgba(255,107,34,0.28)] flex items-center justify-between gap-3 transition ${
              cartCount > 0
                ? 'cursor-pointer active:scale-[0.995]'
                : 'opacity-95'
            }`}
          >
            {/* Left: Cart Icon + Badge + Item Count & Total */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex items-center justify-center shrink-0">
                <ShoppingCart className="w-5 h-5 text-white stroke-[2.2]" />
                <span className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] px-1 rounded-full bg-white text-[#FF6B22] text-[10px] font-extrabold flex items-center justify-center shadow-2xs">
                  {formatNumber(cartCount)}
                </span>
              </div>

              <div className="h-5 w-px bg-white/25 shrink-0" />

              <div className="text-[13px] font-extrabold tracking-tight truncate tabular-nums">
                {formatNumber(cartCount)} item &nbsp;&bull;&nbsp;{' '}
                {formatRupiah(cartTotal)}
              </div>
            </div>

            {/* Right: Lihat Pesanan -> */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (cartCount > 0) {
                  setIsCartSheetOpen(true);
                }
              }}
              className="px-3.5 py-1.5 rounded-full bg-white text-[#FF6B22] text-xs font-extrabold flex items-center gap-1 shadow-2xs shrink-0 active:scale-95 transition cursor-pointer"
            >
              <span>Lihat Pesanan</span>
              <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>

      {/* 7. PESANAN / REVIEW ORDER SCREEN */}
      <CartBottomSheet
        isOpen={isCartSheetOpen}
        onClose={() => setIsCartSheetOpen(false)}
        initialNotes={pendingOrderNotes}
        isDesktopWide={isDesktopWide}
        onProceedToPayment={(notes) => {
          setPendingOrderNotes(notes || '');
          setIsCartSheetOpen(false);
          setViewStep('payment');
        }}
      />

      {/* COMPACT CASHIER / SHIFT DROPDOWN SHEET (Opened from top-right pill) */}
      {showCashierMenu && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowCashierMenu(false)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-[#E2E6EC] space-y-4 animate-in slide-in-from-bottom duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E6EC]">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#12B76A]" />
                <div>
                  <h3 className="font-extrabold text-sm text-[#172033]">
                    {currentEmployee?.name || 'Kasir'} ({roleLabel})
                  </h3>
                  <p className="text-[11px] text-[#667085]">
                    {activeShift
                      ? `Shift Aktif · Mulai ${new Date(
                          activeShift.openedAt
                        ).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`
                      : todayAttendance?.checkInAt
                      ? `Hadir · Masuk ${new Date(
                          todayAttendance.checkInAt
                        ).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`
                      : 'Sesi Kasir Aktif'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCashierMenu(false)}
                className="p-1 rounded-full text-[#667085] hover:text-[#172033] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {!activeShift && (
                <button
                  type="button"
                  onClick={() => {
                    setShowCashierMenu(false);
                    setShowOpeningCashModal(true);
                  }}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-[#FFF3EC] hover:bg-[#FFE6D5] border border-[#FFD9C2] text-[#FF6B22] font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Coins className="w-4 h-4" />
                  <span>Hitung Modal Awal Shift</span>
                </button>
              )}

              {/* Belanja Bahan Tunai Laci (Otomatis Masuk Pembelian & Potong Kas Kasir) */}
              <button
                type="button"
                onClick={() => {
                  setShowCashierMenu(false);
                  setShowQuickPurchaseModal(true);
                }}
                className="w-full py-2.5 px-3.5 rounded-xl bg-[#FFF4ED] hover:bg-[#FFE6D5] border border-[#FFD9C2] text-[#FF641F] font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Belanja Bahan Tunai Laci</span>
              </button>

              {(currentRole === 'OWNER' || currentRole === 'ADMIN') &&
                onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCashierMenu(false);
                      onNavigateTab('diskon_promo');
                    }}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-[#F7F8FA] hover:bg-[#EEF2F6] border border-[#E2E6EC] text-[#172033] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Tag className="w-4 h-4 text-[#FF6B22]" />
                    <span>Atur Diskon &amp; Harga Promo Channel</span>
                  </button>
                )}

              <button
                type="button"
                onClick={async () => {
                  setShowCashierMenu(false);
                  if (currentRole === 'KASIR') {
                    setShowCloseKasirModal(true);
                  } else {
                    if (confirm('Yakin ingin keluar dari sesi?')) {
                      await logout();
                    }
                  }
                }}
                className="w-full py-2.5 px-3.5 rounded-xl bg-[#FEF3F2] hover:bg-[#FEE4E2] border border-[#FECDCA] text-[#F04438] font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>
                  {currentRole === 'KASIR'
                    ? 'Tutup Kasir & Hitung Uang'
                    : 'Keluar Sesi'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BELANJA BAHAN TUNAI LACI (AUTO PEMBELIAN & LUNAS KAS KASIR) */}
      <QuickDrawerPurchaseModal
        isOpen={showQuickPurchaseModal}
        onClose={() => setShowQuickPurchaseModal(false)}
      />

      {/* MODAL HITUNG MODAL AWAL SHIFT */}
      <OpeningCashModal
        isOpen={showOpeningCashModal}
        onClose={() => setShowOpeningCashModal(false)}
        shifts={shifts}
        currentStaffName={currentEmployee?.name || 'Kasir ARY'}
        currentStaffId={currentEmployee?.id || ''}
        onConfirmStartShift={async (openingCashConfirmedAmount, details) => {
          if (!currentEmployee) {
            throw new Error('Tidak ada sesi karyawan aktif.');
          }
          await openShift(
            currentEmployee.id,
            currentEmployee.name,
            openingCashConfirmedAmount,
            details
          );
          setShowOpeningCashModal(false);
        }}
      />

      {/* MODAL TUTUP KASIR */}
      <CloseCashierModal
        isOpen={showCloseKasirModal}
        onClose={() => setShowCloseKasirModal(false)}
        cartCount={cartCount}
        activeShift={activeShift}
        sales={sales}
        onExecuteCloseShiftAndLogout={handleExecuteCloseShiftAndLogout}
      />

      {/* MODAL KONFIRMASI UBAH TIPE PESANAN SAAT CART SUDAH BERISI PRODUK */}
      {pendingOrderTypeChange && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPendingOrderTypeChange(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-[#E2E6EC] space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FFF3EC] text-[#FF6B22] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#172033]">
                  Ubah tipe pesanan?
                </h3>
                <p className="text-xs text-[#667085] mt-1 leading-relaxed">
                  Harga menu akan dihitung ulang sesuai channel baru.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPendingOrderTypeChange(null)}
                className="py-2.5 px-4 rounded-xl border border-[#E2E6EC] bg-white hover:bg-[#F7F8FA] text-[#172033] text-xs font-extrabold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmOrderTypeChange}
                className="py-2.5 px-4 rounded-xl bg-[#FF6B22] hover:bg-[#E85A15] text-white text-xs font-extrabold transition shadow-xs cursor-pointer"
              >
                Ubah Channel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
