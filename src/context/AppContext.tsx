import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, deleteField, writeBatch, runTransaction, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { createHashedPinCredentials } from '../utils/pinSecurity';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import {
  Category,
  Ingredient,
  Product,
  Recipe,
  Sale,
  StockMovement,
  StockProduction,
  Production,
  Purchase,
  PurchaseItem,
  PurchasePayment,
  PaymentStatus,
  Vendor,
  Expense,
  ExpenseHistoryEntry,
  Employee,
  Attendance,
  CartItem,
  PaymentMethod,
  AuditLog,
  CashAccount,
  CashMutation,
  CashMutationType,
  CashBalanceSummary,
  IngredientCategory,
  RecipeItem,
  OverheadItem,
  Assembly,
  AssemblyItem,
  Staff,
  Shift,
  UserRole,
  ExpensePaymentSource,
  OrderType,
  PlatformFeeConfig,
  PlatformFeeSetting,
  PlatformFeeSettingsRecord,
  PlatformTransactionSnapshot,
  CompleteTransactionOptions,
  ProductChannelPricing,
  TaxSettings,
  DEFAULT_TAX_SETTINGS,
} from '../types';
import {
  calculateCompanyCashSummary,
  calculateShiftCashMetrics,
  getAccountBalanceFromSummary,
  getCashAccountLabel,
  isCashPaymentMethod,
  mapPaymentMethodToAccount,
  normalizeCashAccount,
} from '../utils/cashLedger';
import {
  DEFAULT_PLATFORM_FEE_CONFIGS,
  DEFAULT_PLATFORM_FEE_SETTINGS,
  calculatePlatformFeeBreakdown,
  resolveProductChannelPrice,
  validateAndCalculateCheckout,
} from '../utils/saleChannel';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_INGREDIENTS,
  DEFAULT_INGREDIENT_CATEGORIES,
  DEFAULT_PRODUCTS,
  DEFAULT_RECIPES,
  DEFAULT_VENDORS,
  DEFAULT_ASSEMBLIES,
} from '../utils/seedData';
import {
  calculateProductAvailability,
  processSaleStockDeduction,
  processVoidStockReversal,
  processChickenProduction,
  processGeneralProduction,
  cancelGeneralProduction,
  cancelChickenProduction,
  processProductStockOpname,
  processAssemblyExecution,
} from '../services/stockEngine';
import { generateTransactionNo, getMenuHpp, getProductRecipeHpp } from '../utils/formatters';
import { sanitizeFirestore } from '../utils/sanitizeFirestore';
import { useAuth } from './AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  getOfflineSales,
  getOfflineSalesAsync,
  saveOfflineSale,
  removeOfflineSale,
  syncOfflineSalesToFirestore,
  getSyncState,
  SyncState,
} from '../services/offlineSync';
import {
  getNextTransactionNumber,
  getNextOfflineTransactionNo,
  isOfflineTransactionNo,
} from '../services/transactionCounter';

interface AppContextType {
  categories: Category[];
  ingredientCategories: IngredientCategory[];
  ingredients: Ingredient[];
  ingredientsMap: Map<string, Ingredient>;
  products: Product[];
  productsMap: Map<string, Product>;
  recipes: Recipe[];
  recipesMap: Map<string, Recipe>;
  assemblies: Assembly[];
  assembliesMap: Map<string, Assembly>;
  sales: Sale[];
  stockMovements: StockMovement[];
  stockProductions: StockProduction[];
  productions: Production[];
  purchases: Purchase[];
  vendors: Vendor[];
  expenses: Expense[];
  cashMutations: CashMutation[];
  cashBalanceSummary: CashBalanceSummary;
  employees: Employee[];
  attendance: Attendance[];
  auditLogs: AuditLog[];
  staff: Staff[];
  shifts: Shift[];
  shiftsLoaded: boolean;
  
  // Cart & Order Channel
  selectedOrderType: OrderType;
  setSelectedOrderType: (orderType: OrderType) => void;
  cart: CartItem[];
  addToCart: (product: Product) => { success: boolean; message?: string };
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  updateCartItemPrice: (
    productId: string,
    originalPrice: number,
    sellingPrice: number
  ) => void;
  clearCart: () => void;
  cartGrossTotal: number;
  cartItemDiscountTotal: number;
  cartTotal: number;
  cartCount: number;

  // Platform Fee & Channel Promo Configurations
  platformFeeSettings: PlatformFeeSettingsRecord;
  savePlatformFeeSetting: (
    platformId: string,
    setting: Partial<PlatformFeeSetting>
  ) => Promise<void>;
  addPlatformFeeSetting: (setting: PlatformFeeSetting) => Promise<void>;
  deletePlatformFeeSetting: (platformId: string) => Promise<void>;

  platformFeeConfigs: Record<OrderType, PlatformFeeConfig>;
  savePlatformFeeConfig: (
    platform: OrderType,
    config: Partial<PlatformFeeConfig>
  ) => Promise<void>;
  updateProductChannelPricing: (
    productId: string,
    channelPricing: ProductChannelPricing
  ) => Promise<void>;

  // Pengaturan Tarif Pajak (Tahap 7)
  taxSettings: TaxSettings;
  updateTaxSettings: (settings: Partial<TaxSettings>) => Promise<void>;

  // Actions
  completeTransaction: (
    paymentMethod: PaymentMethod,
    cashReceived: number,
    discount?: number,
    options?: CompleteTransactionOptions
  ) => Promise<Sale>;
  voidTransaction: (sale: Sale, reason: string) => Promise<void>;
  submitChickenProduction: (
    rawKg: number,
    preparedPcs: number,
    notes?: string
  ) => Promise<void>;
  cancelChickenProduction: (
    stockProductionId: string,
    reason?: string
  ) => Promise<void>;
  submitGeneralProduction: (
    productId: string,
    actualYield?: number,
    notes?: string,
    batchQty?: number
  ) => Promise<Production>;
  cancelGeneralProduction: (
    productionId: string,
    reason?: string
  ) => Promise<void>;
  submitStockOpname: (
    ingredient: Ingredient,
    physicalStock: number,
    reason: string
  ) => Promise<void>;
  submitProductStockOpname: (
    product: Product,
    physicalStock: number,
    reason: string
  ) => Promise<void>;
  submitPurchase: (
    supplier: string,
    itemId: string,
    quantity: number,
    costPerUnit: number,
    notes?: string,
    itemType?: 'INGREDIENT' | 'PRODUCT'
  ) => Promise<void>;
  createPurchase: (params: {
    purchaseNo?: string;
    vendorId?: string;
    vendorName: string;
    invoiceNo?: string;
    reference?: string;
    dueDate?: string;
    date: string;
    items: PurchaseItem[];
    subtotal?: number;
    discount?: number;
    tax?: number;
    shippingCost?: number;
    transactionCost?: number;
    totalAmount: number;
    paidAmount?: number;
    paymentSource?: string;
    notes?: string;
  }) => Promise<Purchase>;
  updatePurchase: (
    purchaseId: string,
    params: {
      purchaseNo?: string;
      vendorId?: string;
      vendorName: string;
      invoiceNo?: string;
      reference?: string;
      dueDate?: string;
      date: string;
      items: PurchaseItem[];
      subtotal?: number;
      discount?: number;
      tax?: number;
      shippingCost?: number;
      transactionCost?: number;
      totalAmount: number;
      notes?: string;
    }
  ) => Promise<Purchase>;
  deletePurchase: (purchaseId: string, reason?: string) => Promise<void>;
  addPurchasePayment: (
    purchaseId: string,
    paymentData: {
      amount: number;
      date: string;
      sourceAccount: string;
      reference?: string;
      notes?: string;
    }
  ) => Promise<PurchasePayment>;
  deletePurchasePayment: (
    purchaseId: string,
    paymentId: string
  ) => Promise<void>;
  payPurchaseDebt: (
    purchaseId: string,
    amount: number,
    sourceAccount: string,
    notes?: string
  ) => Promise<void>;
  voidPurchase: (purchaseId: string, reason: string) => Promise<void>;
  addVendor: (data: Omit<Vendor, 'id' | 'createdAt'>) => Promise<Vendor>;
  updateVendor: (vendorId: string, data: Partial<Vendor>) => Promise<void>;
  deleteVendor: (vendorId: string) => Promise<void>;
  updateProductPrice: (productId: string, newPrice: number) => Promise<void>;
  addProduct: (
    productData: Omit<Product, 'id'> & { id?: string },
    recipeItems?: RecipeItem[],
    recipeMeta?: {
      recipeMode?: 'PORTION' | 'BATCH';
      yieldQty?: number;
      batchItems?: RecipeItem[];
      portionItems?: RecipeItem[];
      overheadCostPerUnit?: number;
      overheadItems?: OverheadItem[];
      overheadNotes?: string;
    }
  ) => Promise<Product>;
  updateProduct: (
    productId: string,
    productData: Partial<Product>,
    recipeItems?: RecipeItem[],
    recipeMeta?: {
      recipeMode?: 'PORTION' | 'BATCH';
      yieldQty?: number;
      batchItems?: RecipeItem[];
      portionItems?: RecipeItem[];
      overheadCostPerUnit?: number;
      overheadItems?: OverheadItem[];
      overheadNotes?: string;
    }
  ) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  addProductCategory: (name: string) => Promise<Category>;
  saveRecipe: (recipe: Recipe) => Promise<void>;
  addIngredient: (data: Omit<Ingredient, 'id'> & { id?: string }) => Promise<Ingredient>;
  updateIngredient: (ingredientId: string, data: Partial<Ingredient>) => Promise<void>;
  deleteIngredient: (ingredientId: string) => Promise<void>;
  addIngredientCategory: (data: Omit<IngredientCategory, 'id'> & { id?: string }) => Promise<IngredientCategory>;
  updateIngredientCategory: (id: string, data: Partial<IngredientCategory>) => Promise<void>;
  deleteIngredientCategory: (id: string) => Promise<void>;
  addExpense: (
    category: Expense['category'],
    amount: number,
    note?: string,
    paymentSource?: ExpensePaymentSource,
    date?: string
  ) => Promise<void>;
  updateExpense: (
    id: string,
    data: {
      category?: Expense['category'];
      amount?: number;
      note?: string;
      paymentSource?: ExpensePaymentSource;
      date?: string;
    }
  ) => Promise<void>;
  deleteExpense: (id: string, reason?: string) => Promise<void>;
  addCashMutation: (params: {
    account: CashAccount;
    type: CashMutationType;
    amount: number;
    flow: 'IN' | 'OUT';
    title: string;
    notes?: string;
    referenceId?: string;
    relatedAccount?: CashAccount;
  }) => Promise<void>;
  transferCashAccount: (params: {
    fromAccount: CashAccount;
    toAccount: CashAccount;
    amount: number;
    title?: string;
    notes?: string;
    type?: CashMutationType;
  }) => Promise<void>;
  settlePlatformWallet: (params: {
    fromWallet: 'WALLET_GOFOOD' | 'WALLET_GRABFOOD' | 'WALLET_SHOPEEFOOD';
    toAccount: CashAccount;
    grossAmount: number;
    feeAmount?: number;
    notes?: string;
  }) => Promise<void>;
  addEmployee: (
    employeeData: Partial<Employee> | string,
    position?: string,
    dailyWage?: number
  ) => Promise<Employee>;
  updateEmployee: (id: string, data: Partial<Employee>) => Promise<void>;
  toggleEmployeeStatus: (id: string, active: boolean) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  recordAttendance: (
    employeeId: string,
    employeeName: string,
    status: Attendance['status'],
    overtimeHours?: number,
    notes?: string
  ) => Promise<void>;
  addStaff: (username: string, name: string, pin: string, role: UserRole) => Promise<void>;
  toggleStaffStatus: (id: string, active: boolean) => Promise<void>;
  openShift: (
    staffId: string,
    staffName: string,
    openingCash: number,
    openingDetails?: {
      openingCashExpected?: number;
      openingCashActual?: number;
      openingCashVariance?: number;
      openingCashConfirmed?: boolean;
      openingDenominations?: Record<string, number>;
    }
  ) => Promise<void>;
  closeShift: (
    shiftId: string,
    actualCash: number,
    notes?: string,
    closingDetails?: {
      expectedCash?: number;
      cashDifference?: number;
      closingDenominations?: Record<string, number>;
    }
  ) => Promise<void>;

  // Komposisi Menu POS / Formula Actions
  addAssembly: (data: Omit<Assembly, 'id' | 'createdAt'>) => Promise<Assembly>;
  updateAssembly: (id: string, data: Partial<Assembly>) => Promise<void>;
  deleteAssembly: (id: string) => Promise<void>;
  saveProductComposition: (
    productId: string,
    components: AssemblyItem[],
    resultUnit?: string,
    notes?: string
  ) => Promise<void>;
  deleteProductComposition: (productId: string) => Promise<void>;
  executeAssembly: (assemblyId: string, quantityToAssemble: number, notes?: string) => Promise<void>;

  // Data Seeding, Reset & Sync
  resetAllData: () => Promise<void>;
  seedInitialData: () => Promise<void>;
  isSeeding: boolean;
  syncState: SyncState;
  isOnline: boolean;
  
  // Dark mode
  darkMode: boolean;
  toggleDarkMode: () => void;

  // POS Display Preferences (Grid vs List, Foto vs Inisial)
  posLayoutMode: 'grid' | 'list';
  setPosLayoutMode: (mode: 'grid' | 'list') => void;
  posVisualMode: 'foto' | 'inisial';
  setPosVisualMode: (mode: 'foto' | 'inisial') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper to deduplicate array by id
function deduplicate<T extends { id?: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = item.id;
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    result.push(item);
  }
  return result;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, currentRole, userProfile, currentEmployee } = useAuth();
  const isOnline = useOnlineStatus();

  // Firestore Realtime Collections (Default Empty: no dummy data)
  const [categories, setCategories] = useState<Category[]>([]);
  const [ingredientCategories, setIngredientCategories] = useState<IngredientCategory[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [stockProductions, setStockProductions] = useState<StockProduction[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cashMutations, setCashMutations] = useState<CashMutation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftsLoaded, setShiftsLoaded] = useState<boolean>(false);

  // Cart & Active POS Order Type State
  const [selectedOrderType, setSelectedOrderTypeState] = useState<OrderType>('OFFLINE');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);

  // Platform Fee Settings State (Separate per platform, flexible and customizable)
  const [platformFeeSettings, setPlatformFeeSettings] = useState<PlatformFeeSettingsRecord>(() => {
    try {
      const saved = localStorage.getItem('ary_platform_fee_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_PLATFORM_FEE_SETTINGS, ...parsed };
      }
    } catch {
      // ignore
    }
    return DEFAULT_PLATFORM_FEE_SETTINGS;
  });

  // Legacy Platform Fee Configs State
  const [platformFeeConfigs, setPlatformFeeConfigs] = useState<
    Record<OrderType, PlatformFeeConfig>
  >(() => {
    try {
      const saved = localStorage.getItem('ary_platform_fee_configs');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_PLATFORM_FEE_CONFIGS, ...parsed };
      }
    } catch {
      // ignore
    }
    return DEFAULT_PLATFORM_FEE_CONFIGS;
  });

  // Pengaturan Tarif Pajak State (Tahap 7 - Laba Rugi & HPP)
  const [taxSettings, setTaxSettings] = useState<TaxSettings>(() => {
    try {
      const saved = localStorage.getItem('ary_tax_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_TAX_SETTINGS, ...parsed };
      }
    } catch {
      // ignore
    }
    return DEFAULT_TAX_SETTINGS;
  });

  // Dark Mode State
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('geprek_ary_theme') === 'dark';
  });

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('geprek_ary_theme', next ? 'dark' : 'light');
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  // POS Display Preferences State (Grid vs List, Foto vs Inisial)
  const [posLayoutMode, setPosLayoutModeState] = useState<'grid' | 'list'>(() => {
    try {
      const saved = localStorage.getItem('pos_layout_mode');
      return saved === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });

  const [posVisualMode, setPosVisualModeState] = useState<'foto' | 'inisial'>(() => {
    try {
      const saved = localStorage.getItem('pos_visual_mode');
      return saved === 'inisial' ? 'inisial' : 'foto';
    } catch {
      return 'foto';
    }
  });

  const setPosLayoutMode = (mode: 'grid' | 'list') => {
    setPosLayoutModeState(mode);
    try {
      localStorage.setItem('pos_layout_mode', mode);
    } catch {
      // ignore
    }
  };

  const setPosVisualMode = (mode: 'foto' | 'inisial') => {
    setPosVisualModeState(mode);
    try {
      localStorage.setItem('pos_visual_mode', mode);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Derived Lookup Maps
  const ingredientsMap = useMemo(() => {
    const map = new Map<string, Ingredient>();
    ingredients.forEach(i => map.set(i.id, i));
    return map;
  }, [ingredients]);

  const productsMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  const recipesMap = useMemo(() => {
    const map = new Map<string, Recipe>();
    recipes.forEach(r => map.set(r.productId, r));
    recipes.forEach(r => map.set(r.id, r));
    return map;
  }, [recipes]);

  const assembliesMap = useMemo(() => {
    const map = new Map<string, Assembly>();
    assemblies.forEach(a => {
      if (a.productId) map.set(a.productId, a);
      if (a.targetProductId) map.set(a.targetProductId, a);
      if (a.id) map.set(a.id, a);
    });
    return map;
  }, [assemblies]);

  // Reset All Data (Hapus Total Data di Firestore & Memori - Tanpa Data Dummy)
  const resetAllData = async (): Promise<void> => {
    setIsSeeding(true);
    try {
      const collectionsToClear = [
        'sales',
        'products',
        'recipes',
        'assemblies',
        'ingredients',
        'categories',
        'ingredient_categories',
        'stock_movements',
        'stock_productions',
        'productions',
        'purchases',
        'vendors',
        'expenses',
        'cash_mutations',
        'employees',
        'attendance',
        'audit_logs',
        'shifts',
        'system_locks',
      ];

      for (const colName of collectionsToClear) {
        try {
          const snap = await getDocs(collection(db, colName));
          if (!snap.empty) {
            const docs = snap.docs;
            for (let i = 0; i < docs.length; i += 400) {
              const chunk = docs.slice(i, i + 400);
              const batch = writeBatch(db);
              chunk.forEach(docSnap => {
                batch.delete(docSnap.ref);
              });
              await batch.commit();
            }
          }
        } catch (colErr) {
          console.error(`Gagal menghapus koleksi ${colName}:`, colErr);
        }
      }

      // Bersihkan seluruh state lokal di memori secara seketika
      setCart([]);
      setCategories([]);
      setIngredientCategories([]);
      setIngredients([]);
      setProducts([]);
      setRecipes([]);
      setAssemblies([]);
      setSales([]);
      setStockMovements([]);
      setStockProductions([]);
      setProductions([]);
      setPurchases([]);
      setVendors([]);
      setExpenses([]);
      setCashMutations([]);
      setEmployees([]);
      setAttendance([]);
      setAuditLogs([]);
      setShifts([]);

      // Bersihkan offline queue & cart di localStorage
      try {
        localStorage.removeItem('geprek_ary_offline_sales');
        localStorage.removeItem('geprek_ary_cart');
      } catch {
        // ignore
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'all_collections');
      throw e;
    } finally {
      setIsSeeding(false);
    }
  };

  // Seed Data Trigger (Hanya dimuat jika pengguna secara eksplisit meminta data contoh)
  const seedInitialData = async () => {
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);

      DEFAULT_CATEGORIES.forEach(cat => {
        batch.set(doc(db, 'categories', cat.id), cat);
      });

      DEFAULT_VENDORS.forEach(v => {
        batch.set(doc(db, 'vendors', v.id), v);
      });

      DEFAULT_INGREDIENT_CATEGORIES.forEach(cat => {
        batch.set(doc(db, 'ingredient_categories', cat.id), {
          ...cat,
          createdAt: new Date().toISOString(),
        });
      });

      DEFAULT_INGREDIENTS.forEach(ing => {
        batch.set(doc(db, 'ingredients', ing.id), {
          ...ing,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });

      DEFAULT_PRODUCTS.forEach(p => {
        batch.set(doc(db, 'products', p.id), {
          ...p,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });

      DEFAULT_RECIPES.forEach(r => {
        batch.set(doc(db, 'recipes', r.id), r);
      });

      DEFAULT_ASSEMBLIES.forEach(a => {
        batch.set(doc(db, 'assemblies', a.id), a);
      });

      await batch.commit();
      console.log('Seed data initialized successfully');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'seed_data');
    } finally {
      setIsSeeding(false);
    }
  };

  // 1. Realtime Subscriptions (hanya dijalankan saat sesi Firebase Auth aktif)
  useEffect(() => {
    if (!currentUser) return;

    const unsubCat = onSnapshot(collection(db, 'categories'), snap => {
      if (!snap.empty) {
        const list = snap.docs.map(doc => ({ ...(doc.data() as Category), id: (doc.data() as Category).id || doc.id }));
        const unique = deduplicate(list);
        unique.sort((a, b) => a.displayOrder - b.displayOrder);
        setCategories(unique);
      } else {
        setCategories([]);
      }
    }, err => handleFirestoreError(err, OperationType.GET, 'categories'));

    const unsubIngCat = onSnapshot(collection(db, 'ingredient_categories'), snap => {
      if (!snap.empty) {
        const list = snap.docs.map(doc => ({ ...(doc.data() as IngredientCategory), id: (doc.data() as IngredientCategory).id || doc.id }));
        const unique = deduplicate(list);
        unique.sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));
        setIngredientCategories(unique);
      } else {
        setIngredientCategories([]);
      }
    }, err => handleFirestoreError(err, OperationType.GET, 'ingredient_categories'));

    const unsubIng = onSnapshot(collection(db, 'ingredients'), snap => {
      if (!snap.empty) {
        const list = snap.docs.map(doc => ({ ...(doc.data() as Ingredient), id: (doc.data() as Ingredient).id || doc.id }));
        setIngredients(deduplicate(list));
      } else {
        setIngredients([]);
      }
    }, err => handleFirestoreError(err, OperationType.GET, 'ingredients'));

    const unsubProd = onSnapshot(collection(db, 'products'), snap => {
      if (!snap.empty) {
        const defaultProdById = new Map<string, Product>(
          DEFAULT_PRODUCTS.map(dp => [dp.id, dp])
        );
        const KNOWN_PRODUCTION_IDS = new Set([
          'prod_ayam_crispy',
          'prod_sambal',
          'prod_nasi',
          'prod_teh_manis',
          'prod_tahu',
          'prod_tempe',
        ]);
        const KNOWN_MENU_POS_IDS = new Set([
          'prod_ayam_geprek',
          'prod_menu_teh_manis',
          'prod_paket_nasi',
          'prod_paket_mantul',
          'prod_paket_kenyang',
        ]);
        const LEGACY_FAKE_PKG_IDS = new Set([
          'p_1',
          'p_8',
          'p_9',
          'p_10',
          'p_12',
          'p_13',
          'p1',
          'p2',
          'p3',
          'p4',
          'p5',
          'p6',
        ]);

        const rawList = snap.docs.map(doc => ({ ...(doc.data() as Product), id: (doc.data() as Product).id || doc.id }));
        const normalized = rawList.map(data => {
          const seedDefault = defaultProdById.get(data.id);
          let productType = data.productType || seedDefault?.productType;
          let stockSource = data.stockSource;
          let isProduction = data.isProduction;
          let stockTracked = data.stockTracked;

          if (!productType) {
            if (data.categoryId === 'cat_paket' || data.name.toLowerCase().includes('paket')) {
              productType = 'PACKAGE';
            } else {
              productType = 'SINGLE';
            }
          }

          const isProdOutput = Boolean(
            KNOWN_PRODUCTION_IDS.has(data.id) ||
              data.isProduction === true ||
              Boolean(data.recipeId && data.recipeId.trim() !== '') ||
              (data.category || '').trim().toUpperCase() === 'PRODUK STOK' ||
              stockSource === 'PRODUCTION'
          );

          if (isProdOutput && !KNOWN_MENU_POS_IDS.has(data.id) && productType !== 'PACKAGE') {
            stockSource = 'PRODUCTION';
            isProduction = true;
            stockTracked = true;
          } else if (
            KNOWN_MENU_POS_IDS.has(data.id) ||
            productType === 'PACKAGE' ||
            stockSource === 'COMPOSITION' ||
            stockSource === 'ASSEMBLY' ||
            stockSource === 'NONE' ||
            data.stockTracked === false ||
            Boolean(
              data.compositionId ||
                data.assemblyId ||
                (data.compositionItems && data.compositionItems.length > 0)
            )
          ) {
            stockSource = 'COMPOSITION';
            isProduction = false;
            stockTracked = false;
          } else if (!stockSource) {
            stockSource = 'READY_TO_SELL';
          }

          let compositionItems = data.compositionItems;
          if (
            (!compositionItems || compositionItems.length === 0) &&
            seedDefault?.compositionItems &&
            seedDefault.compositionItems.length > 0
          ) {
            compositionItems = seedDefault.compositionItems;
          }

          // Clean any legacy hardcoded packageItems (p_1, p_12, p1, p2, etc.)
          let packageItems = data.packageItems;
          if (packageItems && packageItems.length > 0) {
            const hasLegacyFakeIds = packageItems.some(pi => LEGACY_FAKE_PKG_IDS.has(pi.productId));
            if (hasLegacyFakeIds) {
              if (compositionItems && compositionItems.length > 0) {
                packageItems = [];
              } else {
                const legacyToActualMap: Record<string, { id: string; name: string }> = {
                  p_1: { id: 'prod_ayam_geprek', name: 'Ayam Geprek' },
                  p_10: { id: 'prod_menu_teh_manis', name: 'Teh Manis' },
                  p_12: { id: 'prod_nasi', name: 'Nasi' },
                  p_13: { id: 'prod_sambal', name: 'Sambal' },
                  p_8: { id: 'prod_tahu', name: 'Tahu Crispy' },
                  p_9: { id: 'prod_tempe', name: 'Tempe Crispy' },
                  p1: { id: 'prod_ayam_crispy', name: 'Ayam Crispy' },
                  p2: { id: 'prod_sambal', name: 'Sambal' },
                  p3: { id: 'prod_nasi', name: 'Nasi' },
                  p4: { id: 'prod_teh_manis', name: 'Teh Manis Mentah' },
                  p5: { id: 'prod_tahu', name: 'Tahu Crispy' },
                  p6: { id: 'prod_tempe', name: 'Tempe Crispy' },
                };
                packageItems = packageItems.map(pi => {
                  const mapped = legacyToActualMap[pi.productId];
                  return mapped
                    ? { ...pi, productId: mapped.id, productName: mapped.name }
                    : pi;
                });
              }
            }
          }

          return {
            ...data,
            productType,
            stockSource,
            isProduction,
            stockTracked,
            compositionItems,
            compositionId: data.compositionId || seedDefault?.compositionId,
            assemblyId: data.assemblyId || seedDefault?.assemblyId,
            packageItems,
          };
        });
        setProducts(deduplicate(normalized));
      } else {
        setProducts([]);
      }
    }, err => handleFirestoreError(err, OperationType.GET, 'products'));

    const unsubRec = onSnapshot(collection(db, 'recipes'), snap => {
      if (!snap.empty) {
        const list = snap.docs.map(doc => ({ ...(doc.data() as Recipe), id: (doc.data() as Recipe).id || doc.id }));
        setRecipes(deduplicate(list));
      } else {
        setRecipes([]);
      }
    }, err => handleFirestoreError(err, OperationType.GET, 'recipes'));

    const unsubAsm = onSnapshot(collection(db, 'assemblies'), snap => {
      if (!snap.empty) {
        const legacyCompMap: Record<string, { id: string; name: string }> = {
          p1: { id: 'prod_ayam_crispy', name: 'Ayam Crispy' },
          p2: { id: 'prod_sambal', name: 'Sambal' },
          p3: { id: 'prod_nasi', name: 'Nasi' },
          p4: { id: 'prod_teh_manis', name: 'Teh Manis Mentah' },
          p5: { id: 'prod_tahu', name: 'Tahu Crispy' },
          p6: { id: 'prod_tempe', name: 'Tempe Crispy' },
          p_1: { id: 'prod_ayam_geprek', name: 'Ayam Geprek' },
          p_10: { id: 'prod_menu_teh_manis', name: 'Teh Manis' },
          p_12: { id: 'prod_nasi', name: 'Nasi' },
          p_13: { id: 'prod_sambal', name: 'Sambal' },
        };
        const list = snap.docs.map(docSnap => {
          const raw = { ...(docSnap.data() as Assembly), id: (docSnap.data() as Assembly).id || docSnap.id };
          if (raw.components && raw.components.length > 0) {
            raw.components = raw.components.map(c => {
              if (c.sourceType === 'PRODUCT' && legacyCompMap[c.sourceId]) {
                return {
                  ...c,
                  sourceId: legacyCompMap[c.sourceId].id,
                  sourceName: legacyCompMap[c.sourceId].name,
                };
              }
              return c;
            });
          }
          return raw;
        });
        setAssemblies(deduplicate(list));
      } else {
        setAssemblies([]);
      }
    }, err => handleFirestoreError(err, OperationType.GET, 'assemblies'));

    const qSales = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
    const unsubSales = onSnapshot(qSales, snap => {
      if (!snap.empty) {
        const list = snap.docs.map(doc => ({ ...(doc.data() as Sale), id: (doc.data() as Sale).id || doc.id }));
        setSales(deduplicate(list));
      } else {
        setSales([]);
      }
    }, err => handleFirestoreError(err, OperationType.GET, 'sales'));

    const qMove = query(collection(db, 'stock_movements'), orderBy('createdAt', 'desc'));
    const unsubMove = onSnapshot(qMove, snap => {
      if (!snap.empty) {
        const list = snap.docs.map(doc => ({ ...(doc.data() as StockMovement), id: (doc.data() as StockMovement).id || doc.id }));
        setStockMovements(deduplicate(list));
      } else {
        setStockMovements([]);
      }
    }, err => handleFirestoreError(err, OperationType.GET, 'stock_movements'));

    const qProd = query(collection(db, 'stock_productions'), orderBy('createdAt', 'desc'));
    const unsubStockProd = onSnapshot(qProd, snap => {
      if (!snap.empty) {
        const list = snap.docs.map(doc => ({ ...(doc.data() as StockProduction), id: (doc.data() as StockProduction).id || doc.id }));
        setStockProductions(deduplicate(list));
      } else {
        setStockProductions([]);
      }
    }, err => handleFirestoreError(err, OperationType.GET, 'stock_productions'));

    const qProductions = query(collection(db, 'productions'), orderBy('createdAt', 'desc'));
    const unsubProductions = onSnapshot(qProductions, snap => {
      if (!snap.empty) {
        const list = snap.docs.map(doc => ({ ...(doc.data() as Production), id: (doc.data() as Production).id || doc.id }));
        setProductions(deduplicate(list));
      } else {
        setProductions([]);
      }
    }, err => handleFirestoreError(err, OperationType.GET, 'productions'));

    const qPurch = query(collection(db, 'purchases'), orderBy('createdAt', 'desc'));
    const unsubPurch = onSnapshot(qPurch, snap => {
      if (!snap.empty) {
        const list = snap.docs.map(doc => {
          const p = doc.data() as any;
          const id = p.id || doc.id;
          const totalAmount = p.totalAmount ?? p.totalCost ?? ((p.quantity || 1) * (p.costPerUnit || 0));
          const paidAmount = p.paidAmount ?? totalAmount;
          const remainingAmount = p.remainingAmount ?? Math.max(0, totalAmount - paidAmount);
          const paymentStatus = p.paymentStatus || (remainingAmount <= 0 ? 'LUNAS' : (paidAmount > 0 ? 'SEBAGIAN' : 'BELUM_DIBAYAR'));
          const purchaseNo = p.purchaseNo || `PO-${(p.date || '2026-09-24').replace(/-/g, '')}-${id.slice(-4).toUpperCase()}`;
          const vendorName = p.vendorName || p.supplier || 'Supplier Umum';
          
          let items: PurchaseItem[] = p.items || [];
          if (!items || items.length === 0) {
            if (p.ingredientName || p.targetName) {
              items = [{
                targetId: p.targetId || p.ingredientId || '',
                targetName: p.targetName || p.ingredientName || 'Barang',
                entityType: p.entityType || 'INGREDIENT',
                itemType: p.purchaseType || 'BAHAN_BAKU',
                quantity: p.quantity || 1,
                unit: p.unit || 'unit',
                costPerUnit: p.costPerUnit || totalAmount,
                subtotal: totalAmount,
              }];
            }
          }

          return {
            ...p,
            id,
            purchaseNo,
            vendorName,
            supplier: vendorName,
            items,
            totalAmount,
            paidAmount,
            remainingAmount,
            paymentStatus,
            status: p.status || 'COMPLETED',
            payments: p.payments || [],
          } as Purchase;
        });
        setPurchases(deduplicate(list));
      } else {
        setPurchases([]);
      }
    }, err => handleFirestoreError(err, OperationType.GET, 'purchases'));

    const qVendors = query(collection(db, 'vendors'), orderBy('createdAt', 'desc'));
    const unsubVendors = onSnapshot(qVendors, snap => {
      if (!snap.empty) {
        const list = snap.docs.map(doc => ({ ...(doc.data() as Vendor), id: (doc.data() as Vendor).id || doc.id }));
        setVendors(deduplicate(list));
      } else {
        setVendors([]);
      }
    }, err => handleFirestoreError(err, OperationType.GET, 'vendors'));

    const qExp = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
    const unsubExp = onSnapshot(qExp, snap => {
      if (!snap.empty) {
        const list = snap.docs.map(doc => ({ ...(doc.data() as Expense), id: (doc.data() as Expense).id || doc.id }));
        setExpenses(deduplicate(list));
      } else {
        setExpenses([]);
      }
    }, err => handleFirestoreError(err, OperationType.GET, 'expenses'));

    const unsubEmp = onSnapshot(collection(db, 'employees'), snap => {
      if (!snap.empty) {
        const list = snap.docs.map(doc => ({ ...(doc.data() as Employee), id: (doc.data() as Employee).id || doc.id }));
        setEmployees(deduplicate(list));
      } else {
        setEmployees([]);
      }
    }, err => handleFirestoreError(err, OperationType.GET, 'employees'));

    const qAtt = query(collection(db, 'attendance'), orderBy('createdAt', 'desc'));
    const unsubAtt = onSnapshot(qAtt, snap => {
      if (!snap.empty) {
        const list = snap.docs
          .map(doc => ({ ...(doc.data() as Attendance), id: (doc.data() as Attendance).id || doc.id }))
          .filter(a => a.employeeId !== 'emp_owner_1' && a.employeeName?.toLowerCase() !== 'owner ary');
        setAttendance(deduplicate(list));
      } else {
        setAttendance([]);
      }
    }, err => handleFirestoreError(err, OperationType.GET, 'attendance'));

    const isAdminOrOwnerRole = currentRole === 'OWNER' || currentRole === 'ADMIN';

    const qLogs = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'));
    const unsubLogs = isAdminOrOwnerRole
      ? onSnapshot(qLogs, snap => {
          if (!snap.empty) {
            const list = snap.docs.map(doc => ({ ...(doc.data() as AuditLog), id: (doc.data() as AuditLog).id || doc.id }));
            setAuditLogs(deduplicate(list));
          } else {
            setAuditLogs([]);
          }
        }, err => handleFirestoreError(err, OperationType.GET, 'audit_logs'))
      : () => {
          setAuditLogs([]);
        };

    const qCash = query(collection(db, 'cash_mutations'), orderBy('createdAt', 'desc'));
    const unsubCash = onSnapshot(qCash, snap => {
      if (!snap.empty) {
        const list = snap.docs.map(doc => ({ ...(doc.data() as CashMutation), id: (doc.data() as CashMutation).id || doc.id }));
        setCashMutations(deduplicate(list));
      } else {
        setCashMutations([]);
      }
    }, err => handleFirestoreError(err, OperationType.GET, 'cash_mutations'));

    // Koleksi staff (berisi pinHash & pinSalt) hanya boleh dibaca oleh ADMIN/OWNER, dilarang untuk KASIR
    const unsubStaff = isAdminOrOwnerRole
      ? onSnapshot(collection(db, 'staff'), snap => {
          if (!snap.empty) {
            const list = snap.docs.map(doc => ({ ...(doc.data() as Staff), id: doc.id }));
            setStaff(deduplicate(list));
          } else {
            setStaff([]);
          }
        }, err => handleFirestoreError(err, OperationType.GET, 'staff'))
      : () => {
          setStaff([]);
        };

    const qShifts = query(collection(db, 'shifts'), orderBy('openedAt', 'desc'));
    const unsubShifts = onSnapshot(qShifts, snap => {
      if (!snap.empty) {
        const list = snap.docs.map(doc => ({ ...(doc.data() as Shift), id: doc.id }));
        setShifts(deduplicate(list));
      } else {
        setShifts([]);
      }
      setShiftsLoaded(true);
    }, err => {
      setShiftsLoaded(true);
      handleFirestoreError(err, OperationType.GET, 'shifts');
    });

    const unsubPlatformSettings = onSnapshot(
      doc(db, 'settings', 'platform_fee_settings'),
      snap => {
        if (snap.exists()) {
          const data = snap.data() as PlatformFeeSettingsRecord;
          const merged: PlatformFeeSettingsRecord = {
            ...DEFAULT_PLATFORM_FEE_SETTINGS,
            ...data,
          };
          setPlatformFeeSettings(merged);
          try {
            localStorage.setItem('ary_platform_fee_settings', JSON.stringify(merged));
          } catch {
            // ignore
          }
        }
      },
      () => {
        // Optional settings doc
      }
    );

    const unsubPlatformConfigs = onSnapshot(
      doc(db, 'settings', 'platform_fees'),
      snap => {
        if (snap.exists()) {
          const data = snap.data() as Record<string, PlatformFeeConfig>;
          const merged: Record<OrderType, PlatformFeeConfig> = {
            OFFLINE: { ...DEFAULT_PLATFORM_FEE_CONFIGS.OFFLINE, ...(data.OFFLINE || {}) },
            GOFOOD: { ...DEFAULT_PLATFORM_FEE_CONFIGS.GOFOOD, ...(data.GOFOOD || {}) },
            GRABFOOD: { ...DEFAULT_PLATFORM_FEE_CONFIGS.GRABFOOD, ...(data.GRABFOOD || {}) },
            SHOPEEFOOD: { ...DEFAULT_PLATFORM_FEE_CONFIGS.SHOPEEFOOD, ...(data.SHOPEEFOOD || {}) },
          };
          setPlatformFeeConfigs(merged);
          try {
            localStorage.setItem('ary_platform_fee_configs', JSON.stringify(merged));
          } catch {
            // ignore
          }
        }
      },
      () => {
        // Optional settings doc
      }
    );

    const unsubTaxSettings = onSnapshot(
      doc(db, 'settings', 'tax'),
      snap => {
        if (snap.exists()) {
          const data = snap.data() as TaxSettings;
          const merged: TaxSettings = {
            ...DEFAULT_TAX_SETTINGS,
            ...data,
          };
          setTaxSettings(merged);
          try {
            localStorage.setItem('ary_tax_settings', JSON.stringify(merged));
          } catch {
            // ignore
          }
        }
      },
      () => {
        // Optional tax settings doc
      }
    );

    return () => {
      unsubCat();
      unsubIngCat();
      unsubIng();
      unsubProd();
      unsubRec();
      unsubAsm();
      unsubSales();
      unsubMove();
      unsubStockProd();
      unsubProductions();
      unsubPurch();
      unsubExp();
      unsubCash();
      unsubEmp();
      unsubAtt();
      unsubLogs();
      unsubStaff();
      unsubShifts();
      unsubPlatformSettings();
      unsubPlatformConfigs();
      unsubTaxSettings();
    };
  }, [currentUser, currentRole]);



  // Sync offline queued transactions when network is restored
  useEffect(() => {
    const offlineList = getOfflineSales();
    setOfflinePendingCount(offlineList.length);

    if (isOnline && offlineList.length > 0) {
      const syncPending = async () => {
        try {
          const saleSyncResult = await syncOfflineSalesToFirestore(
            db,
            userProfile,
            productsMap,
            ingredientsMap,
            assembliesMap
          );

          if (saleSyncResult.syncedSales.length > 0) {
            setSales(prev => {
              const map = new Map(prev.map(s => [s.id, s]));
              saleSyncResult.syncedSales.forEach(ss => {
                map.set(ss.id, ss);
              });
              return Array.from(map.values());
            });
          }
          setOfflinePendingCount(getOfflineSales().length);
        } catch (err) {
          console.error('Offline synchronization error:', err);
        }
      };
      syncPending();
    }
  }, [isOnline]);

  const syncState = useMemo(() => {
    return getSyncState(isOnline, offlinePendingCount);
  }, [isOnline, offlinePendingCount]);

  // Real-time Cash and Wallet Balance Summary (6 Accounts, zero double-counting)
  const cashBalanceSummary = useMemo<CashBalanceSummary>(() => {
    return calculateCompanyCashSummary({
      sales,
      expenses,
      cashMutations,
      shifts,
    });
  }, [sales, expenses, cashMutations, shifts]);

  // Recalculate cart item prices automatically whenever selectedOrderType or product channelPricing updates
  const setSelectedOrderType = (nextOrderType: OrderType) => {
    setSelectedOrderTypeState(nextOrderType);
    setCart(prevCart =>
      prevCart.map(item => {
        const liveProd = productsMap.get(item.product.id) || item.product;
        const resolved = resolveProductChannelPrice(liveProd, nextOrderType);
        return {
          ...item,
          product: liveProd,
          originalPrice: resolved.channelOriginalPrice,
          sellingPrice: resolved.channelPrice,
          itemDiscount: resolved.itemDiscount,
          subtotal: item.quantity * resolved.channelPrice,
        };
      })
    );
  };

  useEffect(() => {
    setCart(prevCart => {
      if (prevCart.length === 0) return prevCart;
      let changed = false;
      const updated = prevCart.map(item => {
        const liveProd = productsMap.get(item.product.id) || item.product;
        const resolved = resolveProductChannelPrice(liveProd, selectedOrderType);
        const expectedSubtotal = item.quantity * resolved.channelPrice;
        if (
          item.originalPrice !== resolved.channelOriginalPrice ||
          item.sellingPrice !== resolved.channelPrice ||
          item.itemDiscount !== resolved.itemDiscount ||
          item.subtotal !== expectedSubtotal ||
          item.product !== liveProd
        ) {
          changed = true;
          return {
            ...item,
            product: liveProd,
            originalPrice: resolved.channelOriginalPrice,
            sellingPrice: resolved.channelPrice,
            itemDiscount: resolved.itemDiscount,
            subtotal: expectedSubtotal,
          };
        }
        return item;
      });
      return changed ? updated : prevCart;
    });
  }, [productsMap, selectedOrderType]);

  // Cart Functions
  const addToCart = (product: Product): { success: boolean; message?: string } => {
    const liveProd = productsMap.get(product.id) || product;
    const recipe = liveProd.recipeId ? recipesMap.get(liveProd.recipeId) : undefined;
    const maxAvailable = calculateProductAvailability(liveProd, recipe, ingredientsMap, productsMap, assembliesMap);

    const existingIndex = cart.findIndex(ci => ci.product.id === product.id);
    const currentQtyInCart = existingIndex >= 0 ? cart[existingIndex].quantity : 0;

    if (currentQtyInCart + 1 > maxAvailable) {
      const isPackage = liveProd.productType === 'PACKAGE' || (liveProd.packageItems && liveProd.packageItems.length > 0);
      const isProduction = liveProd.stockSource === 'PRODUCTION';

      let msg = `Maaf, stok ${product.name} HABIS / TIDAK TERSEDIA.`;
      if (maxAvailable > 0) {
        msg = `Maaf, stok ${product.name} hanya cukup untuk ${maxAvailable} item.`;
      } else if (isPackage) {
        msg = `Maaf, stok ${product.name} HABIS. Salah satu komponen menu paket ini tidak tersedia.`;
      } else if (isProduction) {
        msg = `Maaf, stok ${product.name} HABIS. Silakan lakukan Produksi Dapur terlebih dahulu.`;
      } else {
        msg = `Maaf, stok ${product.name} HABIS. Komponen stok tidak mencukupi.`;
      }

      return {
        success: false,
        message: msg,
      };
    }

    const resolved = resolveProductChannelPrice(liveProd, selectedOrderType);
    const sellPrice = resolved.channelPrice;
    const origPrice = resolved.channelOriginalPrice;
    const itemDisc = resolved.itemDiscount;

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].product = liveProd;
      newCart[existingIndex].quantity += 1;
      newCart[existingIndex].originalPrice = origPrice;
      newCart[existingIndex].sellingPrice = sellPrice;
      newCart[existingIndex].itemDiscount = itemDisc;
      newCart[existingIndex].subtotal = newCart[existingIndex].quantity * sellPrice;
      newCart[existingIndex].maxAvailable = maxAvailable;
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          product: liveProd,
          quantity: 1,
          originalPrice: origPrice,
          sellingPrice: sellPrice,
          itemDiscount: itemDisc,
          subtotal: sellPrice,
          recipe,
          maxAvailable,
        },
      ]);
    }

    return { success: true };
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    const liveProd = productsMap.get(productId) || item.product;
    const recipe = liveProd.recipeId ? recipesMap.get(liveProd.recipeId) : undefined;
    const maxAvailable = calculateProductAvailability(liveProd, recipe, ingredientsMap, productsMap, assembliesMap);

    if (quantity > maxAvailable) {
      alert(`Stok ${item.product.name} hanya cukup untuk ${maxAvailable} item.`);
      return;
    }

    const resolved = resolveProductChannelPrice(liveProd, selectedOrderType);

    setCart(
      cart.map(i => {
        if (i.product.id === productId) {
          return {
            ...i,
            product: liveProd,
            quantity,
            originalPrice: resolved.channelOriginalPrice,
            sellingPrice: resolved.channelPrice,
            itemDiscount: resolved.itemDiscount,
            subtotal: quantity * resolved.channelPrice,
            maxAvailable,
          };
        }
        return i;
      })
    );
  };

  const updateCartItemPrice = (
    productId: string,
    originalPrice: number,
    sellingPrice: number
  ) => {
    if (currentRole === 'KASIR' || currentRole === 'KARYAWAN') {
      return;
    }
    const safeSell = Math.max(0, Math.round(Number(sellingPrice) || 0));
    const safeOrig = Math.max(safeSell, Math.round(Number(originalPrice) || safeSell));
    const safeDisc = Math.max(0, safeOrig - safeSell);

    setCart(prev =>
      prev.map(i => {
        if (i.product.id !== productId) return i;
        return {
          ...i,
          originalPrice: safeOrig,
          sellingPrice: safeSell,
          itemDiscount: safeDisc,
          subtotal: i.quantity * safeSell,
        };
      })
    );
  };

  const clearCart = () => setCart([]);

  const cartGrossTotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      const sell = item.sellingPrice ?? item.product.sellingPrice;
      const orig =
        typeof item.originalPrice === 'number' && item.originalPrice >= sell
          ? item.originalPrice
          : typeof item.product.originalPrice === 'number' && item.product.originalPrice >= sell
          ? item.product.originalPrice
          : sell;
      return acc + orig * item.quantity;
    }, 0);
  }, [cart]);

  const cartItemDiscountTotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      const sell = item.sellingPrice ?? item.product.sellingPrice;
      const orig =
        typeof item.originalPrice === 'number' && item.originalPrice >= sell
          ? item.originalPrice
          : typeof item.product.originalPrice === 'number' && item.product.originalPrice >= sell
          ? item.product.originalPrice
          : sell;
      return acc + Math.max(0, orig - sell) * item.quantity;
    }, 0);
  }, [cart]);

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.subtotal, 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Save Flexible Platform Fee Settings (Separate per Platform)
  const savePlatformFeeSetting = async (
    platformId: string,
    setting: Partial<PlatformFeeSetting>
  ): Promise<void> => {
    if (currentRole !== 'OWNER' && currentRole !== 'ADMIN') {
      throw new Error('Akses Ditolak: Hanya OWNER atau ADMIN yang dapat mengubah biaya platform.');
    }
    const targetKey = platformId.trim().toUpperCase();
    const existing =
      platformFeeSettings[targetKey] ||
      DEFAULT_PLATFORM_FEE_SETTINGS[targetKey] || {
        id: targetKey,
        platform: targetKey,
        platformName: targetKey,
        percentageFee: 0,
        fixedFee: 0,
        shippingDiscount: 0,
        active: true,
      };

    const updated: PlatformFeeSetting = {
      ...existing,
      ...setting,
      id: targetKey,
      percentageFee: Math.max(0, Number(setting.percentageFee ?? existing.percentageFee ?? 0)),
      fixedFee: Math.max(0, Math.round(Number(setting.fixedFee ?? existing.fixedFee ?? 0))),
      shippingDiscount: Math.max(
        0,
        Math.round(Number(setting.shippingDiscount ?? existing.shippingDiscount ?? 0))
      ),
      active: setting.active !== undefined ? setting.active : existing.active,
      updatedAt: new Date().toISOString(),
    };

    const nextSettings: PlatformFeeSettingsRecord = {
      ...platformFeeSettings,
      [targetKey]: updated,
    };

    setPlatformFeeSettings(nextSettings);
    try {
      localStorage.setItem('ary_platform_fee_settings', JSON.stringify(nextSettings));
    } catch {
      // ignore
    }

    if (isOnline) {
      await setDoc(
        doc(db, 'settings', 'platform_fee_settings'),
        sanitizeFirestore(nextSettings),
        { merge: true }
      );
    }

    const auditRef = doc(collection(db, 'audit_logs'));
    await setDoc(
      auditRef,
      sanitizeFirestore({
        id: auditRef.id,
        action: 'PLATFORM_FEE_UPDATED',
        details: `Ubah Pengaturan Biaya Admin [${updated.platformName}] -> Admin: ${updated.percentageFee}%, Tetap: Rp ${updated.fixedFee.toLocaleString('id-ID')}, Ongkir: Rp ${updated.shippingDiscount.toLocaleString('id-ID')}, Status: ${updated.active ? 'Aktif' : 'Nonaktif'}`,
        userUid: currentEmployee?.id || userProfile?.uid || 'admin',
        userName: currentEmployee?.name || userProfile?.displayName || 'Admin',
        createdAt: new Date().toISOString(),
      })
    );
  };

  const addPlatformFeeSetting = async (
    setting: PlatformFeeSetting
  ): Promise<void> => {
    await savePlatformFeeSetting(setting.id, setting);
  };

  const deletePlatformFeeSetting = async (
    platformId: string
  ): Promise<void> => {
    if (currentRole !== 'OWNER' && currentRole !== 'ADMIN') {
      throw new Error('Akses Ditolak: Hanya OWNER atau ADMIN yang dapat menghapus biaya platform.');
    }
    const targetKey = platformId.trim().toUpperCase();
    const nextSettings: PlatformFeeSettingsRecord = { ...platformFeeSettings };
    delete nextSettings[targetKey];

    setPlatformFeeSettings(nextSettings);
    try {
      localStorage.setItem('ary_platform_fee_settings', JSON.stringify(nextSettings));
    } catch {
      // ignore
    }

    if (isOnline) {
      await setDoc(
        doc(db, 'settings', 'platform_fee_settings'),
        sanitizeFirestore(nextSettings)
      );
    }
  };

  // Save Platform Fee Config (Legacy fallback)
  const savePlatformFeeConfig = async (
    platform: OrderType,
    config: Partial<PlatformFeeConfig>
  ): Promise<void> => {
    const updatedForPlatform: PlatformFeeConfig = {
      ...platformFeeConfigs[platform],
      ...config,
      platform,
      feeValue: Math.max(0, Number(config.feeValue ?? platformFeeConfigs[platform]?.feeValue ?? 0)),
      updatedAt: new Date().toISOString(),
    };
    const nextConfigs: Record<OrderType, PlatformFeeConfig> = {
      ...platformFeeConfigs,
      [platform]: updatedForPlatform,
    };
    setPlatformFeeConfigs(nextConfigs);
    try {
      localStorage.setItem('ary_platform_fee_configs', JSON.stringify(nextConfigs));
    } catch {
      // ignore
    }
    if (isOnline) {
      await setDoc(
        doc(db, 'settings', 'platform_fees'),
        sanitizeFirestore(nextConfigs),
        { merge: true }
      );
    }
  };

  // Save Product Channel Promo Pricing (OWNER & ADMIN only, never mutates basePrice)
  const updateProductChannelPricing = async (
    productId: string,
    channelPricing: ProductChannelPricing
  ): Promise<void> => {
    if (currentRole !== 'OWNER' && currentRole !== 'ADMIN') {
      throw new Error('Akses Ditolak: Hanya OWNER atau ADMIN yang dapat mengatur Diskon & Harga Promo.');
    }
    const existing = productsMap.get(productId) || products.find(p => p.id === productId);
    if (!existing) {
      throw new Error('Produk tidak ditemukan.');
    }

    const now = new Date().toISOString();
    const batch = writeBatch(db);
    const pRef = doc(db, 'products', productId);

    // Preserve basePrice (sellingPrice) untouched; only update channelPricing
    batch.set(
      pRef,
      sanitizeFirestore({
        channelPricing,
        updatedAt: now,
      }),
      { merge: true }
    );

    const auditRef = doc(collection(db, 'audit_logs'));
    batch.set(
      auditRef,
      sanitizeFirestore({
        id: auditRef.id,
        action: 'PROMO_PRICING_UPDATED',
        details: `Atur Diskon & Harga Promo Channel untuk [${existing.name}] (Harga Dasar: Rp ${existing.sellingPrice.toLocaleString('id-ID')})`,
        userUid: currentEmployee?.id || userProfile?.uid || 'admin',
        userName: currentEmployee?.name || userProfile?.displayName || 'Admin',
        createdAt: now,
      })
    );

    await batch.commit();
  };

  // Update Pengaturan Tarif Pajak (Tahap 7 - PPh Final & PB1)
  const updateTaxSettings = async (settings: Partial<TaxSettings>): Promise<void> => {
    if (currentRole !== 'OWNER' && currentRole !== 'ADMIN') {
      throw new Error('Akses Ditolak: Hanya OWNER atau ADMIN yang dapat mengubah pengaturan pajak.');
    }
    const updated: TaxSettings = {
      ...taxSettings,
      ...settings,
    };
    setTaxSettings(updated);
    try {
      localStorage.setItem('ary_tax_settings', JSON.stringify(updated));
    } catch {
      // ignore
    }
    if (isOnline) {
      try {
        await setDoc(doc(db, 'settings', 'tax'), sanitizeFirestore(updated), { merge: true });
        const auditRef = doc(collection(db, 'audit_logs'));
        await setDoc(
          auditRef,
          sanitizeFirestore({
            id: auditRef.id,
            action: 'UPDATE_TAX_SETTINGS',
            details: `Perbarui pengaturan tarif pajak: PPh Final ${
              updated.enablePphFinal ? `${updated.pphFinalRate}%` : 'Nonaktif'
            }, PB1 ${updated.enablePb1 ? `${updated.pb1Rate}%` : 'Nonaktif'}`,
            userUid: currentEmployee?.id || userProfile?.uid || 'user',
            userName: currentEmployee?.name || userProfile?.displayName || 'User',
            createdAt: new Date().toISOString(),
          })
        );
      } catch (err) {
        console.warn('Gagal menyimpan pengaturan pajak ke Firestore:', err);
      }
    }
  };

  // Complete POS Transaction
  const completeTransaction = async (
    paymentMethod: PaymentMethod,
    cashReceived: number,
    discount = 0,
    options?: CompleteTransactionOptions
  ): Promise<Sale> => {
    if (cart.length === 0) {
      throw new Error('Keranjang belanja kosong.');
    }

    const orderType: OrderType = options?.orderType || selectedOrderType || 'OFFLINE';
    const isMarketplace =
      orderType === 'GOFOOD' || orderType === 'GRABFOOD' || orderType === 'SHOPEEFOOD';

    let totalHpp = 0;
    const saleItems = cart.map(item => {
      const liveProd = productsMap.get(item.product.id) || item.product;
      const recipe = liveProd.recipeId ? recipesMap.get(liveProd.recipeId) : undefined;
      const hppPerItem =
        getMenuHpp(liveProd, productsMap, ingredientsMap, assembliesMap, recipesMap) ||
        (recipe ? recipe.totalHpp : (liveProd.costPerUnit || 0));
      totalHpp += hppPerItem * item.quantity;

      const resolved = resolveProductChannelPrice(liveProd, orderType);
      const unitSell = resolved.channelPrice;
      const unitOrig = resolved.channelOriginalPrice;
      const unitDisc = resolved.itemDiscount;

      return {
        productId: liveProd.id,
        productName: liveProd.name,
        quantity: item.quantity,
        originalPrice: unitOrig,
        sellingPrice: unitSell,
        itemDiscount: unitDisc,
        subtotal: item.quantity * unitSell,
        recipeId: liveProd.recipeId,
        hppPerItem,
      };
    });

    const computedGrossSubtotal =
      options?.subtotal !== undefined ? Number(options.subtotal) : cartGrossTotal;
    const computedItemDiscountTotal =
      options?.itemDiscountTotal !== undefined
        ? Number(options.itemDiscountTotal)
        : cartItemDiscountTotal;
    const computedOrderDiscount =
      options?.orderDiscount !== undefined
        ? Number(options.orderDiscount)
        : Math.max(0, Number(discount || 0));

    // Pull configured platform fee setting from master settings menu
    const platformSetting = isMarketplace
      ? platformFeeSettings[orderType] || DEFAULT_PLATFORM_FEE_SETTINGS[orderType]
      : null;

    const manualShippingDiscount =
      options?.shippingDiscount !== undefined ? Number(options.shippingDiscount) : undefined;

    const platformBreakdown = calculatePlatformFeeBreakdown({
      platform: orderType,
      grossAmount: computedGrossSubtotal,
      discountAmount: computedItemDiscountTotal + computedOrderDiscount,
      setting: platformSetting,
      customShippingDiscount: manualShippingDiscount,
    });

    const isManualPlatformFee =
      isMarketplace &&
      options?.platformServiceFee !== undefined &&
      options.platformServiceFee !== null;

    const effectivePlatformFee = isMarketplace
      ? isManualPlatformFee
        ? Math.max(0, Number(options.platformServiceFee))
        : platformBreakdown.totalPlatformFee
      : 0;

    // Jika kasir mengisi platformServiceFee manual, hitung ulang walletAmount = netOrderAmount - fee efektif,
    // supaya ledger dan laporan memakai angka yang sama
    const netOrderAmount = platformBreakdown.netOrderAmount;
    const effectiveWalletAmount = isMarketplace
      ? Math.max(0, netOrderAmount - effectivePlatformFee)
      : 0;

    const validation = validateAndCalculateCheckout({
      orderType,
      subtotal: computedGrossSubtotal,
      itemDiscountTotal: computedItemDiscountTotal,
      orderDiscount: computedOrderDiscount,
      shippingFee: options?.shippingFee ?? 0,
      shippingDiscount: options?.shippingDiscount ?? platformBreakdown.shippingDiscount,
      platformServiceFee: effectivePlatformFee,
      allowNegativeSettlement: options?.allowNegativeSettlement,
    });

    if (!validation.valid) {
      throw new Error(validation.error || 'Data transaksi tidak valid.');
    }

    // Penomoran transaksi:
    // - Online: counter atomik di Firestore (runTransaction pada counters/sales_YYYYMMDD)
    // - Offline: prefix perangkat (OFF-<deviceId>-<seq>) lalu diganti/dipetakan saat sinkron
    let transactionNo = '';
    let isOfflineNumber = false;

    if (isOnline) {
      try {
        const counterResult = await getNextTransactionNumber(db, new Date());
        transactionNo = counterResult.transactionNo;
      } catch (counterErr) {
        console.warn('Gagal mengambil counter transaksi Firestore online, beralih ke prefix perangkat:', counterErr);
        const offlineResult = getNextOfflineTransactionNo();
        transactionNo = offlineResult.transactionNo;
        isOfflineNumber = true;
      }
    } else {
      const offlineResult = getNextOfflineTransactionNo();
      transactionNo = offlineResult.transactionNo;
      isOfflineNumber = true;
    }

    const finalAmount = validation.foodTotal;
    const isCash = orderType === 'OFFLINE' && isCashPaymentMethod(paymentMethod);
    const netWalletAmount = isMarketplace
      ? effectiveWalletAmount
      : validation.foodTotal;

    const safeCashReceived = isCash
      ? Math.max(finalAmount, Number(cashReceived || 0))
      : orderType === 'OFFLINE'
      ? finalAmount
      : netWalletAmount;
    const changeAmount = isCash ? Math.max(0, safeCashReceived - finalAmount) : 0;
    const paymentAccount = mapPaymentMethodToAccount(paymentMethod, orderType);
    const now = new Date().toISOString();

    // Prepare immutable platform fee snapshot dengan fee efektif & walletAmount yang dihitung ulang
    const platformSnapshot: PlatformTransactionSnapshot | undefined = isMarketplace
      ? {
          platform: orderType,
          platformName: platformSetting?.platformName || orderType,
          grossAmount: platformBreakdown.grossAmount,
          discountAmount: platformBreakdown.discountAmount,
          netOrderAmount,
          platformFeePercentage: isManualPlatformFee ? 0 : platformBreakdown.percentageFee,
          platformFeeAmount: isManualPlatformFee
            ? effectivePlatformFee
            : platformBreakdown.percentageFeeAmount,
          platformFixedFee: isManualPlatformFee ? 0 : platformBreakdown.fixedFee,
          shippingDiscount: platformBreakdown.shippingDiscount,
          totalPlatformFee: effectivePlatformFee,
          walletAmount: effectiveWalletAmount,
        }
      : undefined;

    const newSaleRef = doc(collection(db, 'sales'));
    const saleRecord: Sale = {
      id: newSaleRef.id,
      transactionNo,
      offlineTransactionNo: isOfflineNumber ? transactionNo : undefined,
      stockDeducted: false, // Diset true secara atomik di dalam batch pemotongan stok
      date: new Date().toISOString().split('T')[0],
      orderType,
      items: saleItems,
      subtotal: validation.subtotal,
      itemDiscountTotal: validation.itemDiscountTotal,
      orderDiscount: validation.orderDiscount,
      foodTotal: validation.foodTotal,
      shippingFee: validation.shippingFee,
      shippingDiscount: validation.shippingDiscount,
      customerShippingPaid: validation.customerShippingPaid,
      platformServiceFee: effectivePlatformFee,
      netSettlementAmount: netWalletAmount,

      // Immutable Platform Snapshot
      platformSnapshot,
      grossAmount: platformBreakdown.grossAmount,
      discountAmount: platformBreakdown.discountAmount,
      netOrderAmount,
      platformFeePercentage: isMarketplace
        ? (isManualPlatformFee ? 0 : platformBreakdown.percentageFee)
        : 0,
      platformFeeAmount: isMarketplace
        ? (isManualPlatformFee ? effectivePlatformFee : platformBreakdown.percentageFeeAmount)
        : 0,
      platformFixedFee: isMarketplace
        ? (isManualPlatformFee ? 0 : platformBreakdown.fixedFee)
        : 0,
      totalPlatformFee: isMarketplace ? effectivePlatformFee : 0,
      walletAmount: isMarketplace ? netWalletAmount : undefined,

      totalAmount: validation.subtotal,
      discount: validation.itemDiscountTotal + validation.orderDiscount,
      finalAmount: validation.foodTotal,
      totalHpp,
      paymentMethod,
      paymentAccount,
      cashReceived: safeCashReceived,
      changeAmount,
      status: 'COMPLETED',
      notes: options?.notes || '',
      cashierId: localStorage.getItem('ary_active_staff_id') || currentEmployee?.id || userProfile?.uid || 'cashier_anon',
      cashierName: localStorage.getItem('ary_active_staff_name') || currentEmployee?.name || userProfile?.displayName || 'Kasir',
      createdAt: now,
    };

    if (isOnline && !isOfflineNumber) {
      try {
        await setDoc(newSaleRef, sanitizeFirestore(saleRecord));
        await processSaleStockDeduction(
          saleRecord,
          productsMap,
          userProfile?.uid || 'cashier_anon',
          ingredientsMap,
          assembliesMap
        );
        saleRecord.stockDeducted = true;
      } catch (err) {
        console.error('Online sale save failed, queueing offline', err);
        saleRecord.isOfflineSync = true;
        saveOfflineSale(saleRecord);
        setOfflinePendingCount(getOfflineSales().length);
      }
    } else {
      saleRecord.isOfflineSync = true;
      saveOfflineSale(saleRecord);
      setOfflinePendingCount(getOfflineSales().length);
    }

    // Optimistically add to state for immediate receipt display, guarding against duplicates
    setSales(prev => {
      if (prev.some(s => s.id === saleRecord.id)) return prev;
      return [saleRecord, ...prev];
    });
    clearCart();
    setSelectedOrderType('OFFLINE');

    return saleRecord;
  };

  const voidTransaction = async (sale: Sale, reason: string) => {
    if (currentRole === 'KASIR') {
      alert('Hanya ADMIN atau OWNER yang berhak membatalkan transaksi.');
      return;
    }
    if (sale.status === 'VOID') {
      alert('Transaksi penjualan ini sudah berstatus VOID.');
      return;
    }
    await processVoidStockReversal(
      sale,
      productsMap,
      currentEmployee?.id || userProfile?.uid || 'admin',
      reason,
      ingredientsMap,
      assembliesMap,
      currentEmployee?.name || userProfile?.displayName || 'Admin'
    );
  };

  const submitGeneralProduction = async (
    productId: string,
    actualYield?: number,
    notes?: string,
    batchQty?: number
  ): Promise<Production> => {
    const product = productsMap.get(productId) || products.find(p => p.id === productId);
    if (!product) throw new Error('Produk tidak ditemukan');

    const recipe =
      (product.recipeId ? recipesMap.get(product.recipeId) : undefined) ||
      recipesMap.get(productId) ||
      recipes.find(
        r =>
          r.productId === productId ||
          r.id === product.recipeId ||
          (r.productName && r.productName.trim().toLowerCase() === product.name.trim().toLowerCase())
      );
    if (!recipe) throw new Error(`Resep untuk ${product.name} belum dibuat.`);

    const standardYield = Math.max(1, recipe.yieldQty || 1);
    const effectiveBatchQty = batchQty !== undefined && batchQty > 0
      ? batchQty
      : (actualYield ? Math.max(1, Math.round(actualYield / standardYield)) : 1);

    return await processGeneralProduction({
      product,
      recipe,
      batchQty: effectiveBatchQty,
      actualYield,
      ingredientsMap,
      notes: notes || '',
      userUid: userProfile?.uid || 'user',
      userName: userProfile?.displayName || 'Admin',
      date: new Date().toISOString().split('T')[0],
    });
  };

  const cancelGeneralProductionHandler = async (
    productionId: string,
    reason?: string
  ): Promise<void> => {
    if (currentRole !== 'OWNER') {
      throw new Error('Akses Ditolak: Khusus akun OWNER yang berhak membatalkan produksi.');
    }
    await cancelGeneralProduction({
      productionId,
      reason,
      userUid: userProfile?.uid || currentEmployee?.id || 'owner',
      userName: userProfile?.displayName || currentEmployee?.name || 'Owner ARY',
      productsMap,
      ingredientsMap,
      productions,
    });
  };

  const cancelChickenProductionHandler = async (
    stockProductionId: string,
    reason?: string
  ): Promise<void> => {
    if (currentRole !== 'OWNER') {
      throw new Error('Akses Ditolak: Khusus akun OWNER yang berhak membatalkan produksi.');
    }
    await cancelChickenProduction({
      stockProductionId,
      reason,
      userUid: userProfile?.uid || currentEmployee?.id || 'owner',
      userName: userProfile?.displayName || currentEmployee?.name || 'Owner ARY',
      ingredientsMap,
      stockProductions,
    });
  };

  const submitProductStockOpname = async (
    product: Product,
    physicalStock: number,
    reason: string
  ) => {
    await processProductStockOpname(
      product,
      physicalStock,
      reason,
      userProfile?.uid || 'user'
    );
  };

  const submitChickenProduction = async (
    rawKg: number,
    preparedPcs: number,
    notes?: string
  ) => {
    const rawIng = ingredientsMap.get('ing_ayam_raw') || ingredients.find(i => i.type === 'RAW');
    const prepIng = ingredientsMap.get('ing_ayam_ready') || ingredients.find(i => i.type === 'PREPARED');

    if (!rawIng || !prepIng) {
      throw new Error('Bahan Ayam Mentah atau Ayam Siap Jual tidak ditemukan di database.');
    }

    if (rawKg > rawIng.stock) {
      throw new Error(`Stok Ayam Mentah hanya ada ${rawIng.stock} kg, tidak cukup untuk diproses ${rawKg} kg.`);
    }

    await processChickenProduction({
      date: new Date().toISOString().split('T')[0],
      rawIngredient: rawIng,
      rawKg,
      preparedIngredient: prepIng,
      preparedPcs,
      notes: notes || '',
      userUid: userProfile?.uid || 'user',
    });
  };

  const submitStockOpname = async (
    ingredient: Ingredient,
    physicalStock: number,
    reason: string
  ) => {
    const variance = physicalStock - ingredient.stock;
    const now = new Date().toISOString();

    const batch = writeBatch(db);
    const ingRef = doc(db, 'ingredients', ingredient.id);

    batch.set(
      ingRef,
      sanitizeFirestore({
        ...ingredient,
        stock: physicalStock,
        updatedAt: now,
      }),
      { merge: true }
    );

    const moveRef = doc(collection(db, 'stock_movements'));
    const movement: StockMovement = {
      id: moveRef.id,
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      type: variance < 0 ? 'WASTE' : 'ADJUSTMENT',
      changeAmount: variance,
      balanceAfter: physicalStock,
      notes: `Stock Opname selisih ${variance} (${ingredient.unit}). Alasan: ${reason}`,
      createdBy: userProfile?.uid || 'user',
      createdAt: now,
    };

    batch.set(moveRef, sanitizeFirestore(movement));

    try {
      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'stock_opname');
    }
  };

  const addVendor = async (vendorData: Omit<Vendor, 'id' | 'createdAt'>): Promise<Vendor> => {
    const vRef = doc(collection(db, 'vendors'));
    const now = new Date().toISOString();
    const newVendor: Vendor = {
      ...vendorData,
      id: vRef.id,
      active: vendorData.active ?? true,
      createdAt: now,
    };
    await setDoc(vRef, sanitizeFirestore(newVendor));
    return newVendor;
  };

  const updateVendor = async (vendorId: string, vendorData: Partial<Vendor>): Promise<void> => {
    const vRef = doc(db, 'vendors', vendorId);
    await updateDoc(vRef, sanitizeFirestore({ ...vendorData, updatedAt: new Date().toISOString() }));
  };

  const deleteVendor = async (vendorId: string): Promise<void> => {
    await deleteDoc(doc(db, 'vendors', vendorId));
  };

  const createPurchase = async (params: {
    purchaseNo?: string;
    vendorId?: string;
    vendorName: string;
    invoiceNo?: string;
    reference?: string;
    dueDate?: string;
    date: string;
    items: PurchaseItem[];
    subtotal?: number;
    discount?: number;
    tax?: number;
    shippingCost?: number;
    transactionCost?: number;
    totalAmount: number;
    paidAmount?: number;
    paymentSource?: string;
    notes?: string;
  }): Promise<Purchase> => {
    const now = new Date().toISOString();
    const batch = writeBatch(db);

    const purchRef = doc(collection(db, 'purchases'));
    const dateFormatted = (params.date || now.split('T')[0]).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const purchaseNo =
      params.purchaseNo && params.purchaseNo.trim()
        ? params.purchaseNo.trim()
        : `PB-${dateFormatted}-${randomSuffix}`;

    const paidAmount = Math.max(0, Math.min(params.paidAmount || 0, params.totalAmount));
    const remainingAmount = Math.max(0, params.totalAmount - paidAmount);

    let paymentStatus: PaymentStatus = 'BELUM_DIBAYAR';
    if (paidAmount >= params.totalAmount && params.totalAmount > 0) {
      paymentStatus = 'LUNAS';
    } else if (paidAmount > 0) {
      paymentStatus = 'SEBAGIAN';
    }

    const initialPayments: PurchasePayment[] = [];
    if (paidAmount > 0) {
      initialPayments.push({
        id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        purchaseId: purchRef.id,
        paymentNo: 'PAY-00001',
        date: params.date || now.split('T')[0],
        amount: paidAmount,
        sourceAccount: params.paymentSource || 'KAS_KASIR',
        reference: params.reference || '',
        notes: 'Pembayaran Awal',
        createdBy: userProfile?.uid || 'user',
        createdAt: now,
        updatedAt: now,
      });
    }

    const itemsSubtotal =
      params.subtotal !== undefined
        ? params.subtotal
        : params.items.reduce((sum, it) => sum + (it.subtotal || it.total || 0), 0);

    const newPurchase: Purchase = {
      id: purchRef.id,
      purchaseNo,
      date: params.date || now.split('T')[0],
      dueDate: params.dueDate || '',
      vendorId: params.vendorId || '',
      vendorName: params.vendorName || 'Supplier Umum',
      supplier: params.vendorName || 'Supplier Umum',
      invoiceNo: params.invoiceNo || '',
      reference: params.reference || '',
      items: params.items,
      subtotal: itemsSubtotal,
      discount: params.discount || 0,
      tax: params.tax || 0,
      shippingCost: params.shippingCost || 0,
      transactionCost: params.transactionCost || 0,
      totalAmount: params.totalAmount,
      totalCost: params.totalAmount,
      paidAmount,
      remainingAmount,
      paymentStatus,
      paymentSource: params.paymentSource || 'KAS_KASIR',
      payments: initialPayments,
      status: 'COMPLETED',
      notes: params.notes || '',
      createdBy: userProfile?.uid || 'user',
      createdByName: userProfile?.displayName || 'User',
      createdAt: now,
      updatedAt: now,
    };

    batch.set(purchRef, sanitizeFirestore(newPurchase));

    // Stock Movement & Physical Stock Update
    const updatedIngredients: Ingredient[] = [];
    const updatedProducts: Product[] = [];
    const createdMovements: StockMovement[] = [];

    for (const item of params.items) {
      if (item.entityType === 'PRODUCT') {
        const product =
          productsMap.get(item.targetId) ||
          Array.from(productsMap.values()).find(
            p => p.name.trim().toLowerCase() === (item.targetName || '').trim().toLowerCase()
          );
        if (product) {
          const stockUnit = item.stockUnit || product.stockUnit || 'pcs';
          const purchaseUnit = item.purchaseUnit || item.unit || product.purchaseUnit || stockUnit;
          const conversionFactor = item.conversionFactor || product.conversionFactor || 1;
          const stockAdded =
            item.stockQuantityAdded !== undefined && item.stockQuantityAdded > 0
              ? item.stockQuantityAdded
              : item.quantity * conversionFactor;
          const costPerStockUnit =
            item.costPerStockUnit !== undefined && item.costPerStockUnit > 0
              ? item.costPerStockUnit
              : conversionFactor > 0
              ? Math.round((item.costPerUnit / conversionFactor) * 100) / 100
              : item.costPerUnit;

          const currentStock = typeof product.stock === 'number' ? product.stock : 0;
          const newStock = currentStock + stockAdded;

          // Tahap 7: Hitung costPerUnit produk dengan rata-rata tertimbang
          const oldStock = Math.max(0, currentStock);
          const oldCost = Number(product.costPerUnit || 0);
          const newUnitCost = costPerStockUnit > 0 ? costPerStockUnit : oldCost;
          const weightedCost =
            oldStock > 0 && oldCost > 0 && oldStock + stockAdded > 0
              ? Math.round(((oldStock * oldCost + stockAdded * newUnitCost) / (oldStock + stockAdded)) * 100) / 100
              : newUnitCost;

          const updatedProd: Product = {
            ...product,
            stock: newStock,
            stockUnit,
            purchaseUnit,
            conversionFactor,
            purchasePrice: item.costPerUnit,
            costPerUnit: weightedCost,
            updatedAt: now,
          };

          const prodRef = doc(db, 'products', product.id);
          batch.set(prodRef, sanitizeFirestore(updatedProd), { merge: true });
          updatedProducts.push(updatedProd);

          const moveRef = doc(collection(db, 'stock_movements'));
          const movement: StockMovement = {
            id: moveRef.id,
            entityType: 'PRODUCT',
            entityId: product.id,
            entityName: product.name,
            productId: product.id,
            productName: product.name,
            type: 'PURCHASE',
            changeAmount: stockAdded,
            balanceAfter: newStock,
            unit: stockUnit,
            purchaseUnit,
            purchaseQuantity: item.quantity,
            conversionFactor,
            referenceId: purchaseNo,
            notes: `Pembelian #${purchaseNo} (${item.quantity} ${purchaseUnit} = +${stockAdded} ${stockUnit}) dari ${params.vendorName || 'Supplier'}`,
            createdBy: userProfile?.uid || 'user',
            createdAt: now,
          };
          batch.set(moveRef, sanitizeFirestore(movement));
          createdMovements.push(movement);
        }
      } else {
        const ing =
          ingredientsMap.get(item.targetId) ||
          Array.from(ingredientsMap.values()).find(
            i => i.name.trim().toLowerCase() === (item.targetName || '').trim().toLowerCase()
          );

        if (ing) {
          const stockUnit = item.stockUnit || ing.stockUnit || ing.unit || 'pcs';
          const purchaseUnit = item.purchaseUnit || item.unit || ing.purchaseUnit || stockUnit;
          const conversionFactor = item.conversionFactor || ing.conversionFactor || 1;
          const stockAdded =
            item.stockQuantityAdded !== undefined && item.stockQuantityAdded > 0
              ? item.stockQuantityAdded
              : item.quantity * conversionFactor;
          const costPerStockUnit =
            item.costPerStockUnit !== undefined && item.costPerStockUnit > 0
              ? item.costPerStockUnit
              : conversionFactor > 0
              ? Math.round((item.costPerUnit / conversionFactor) * 100) / 100
              : item.costPerUnit;

          const currentStock = typeof ing.stock === 'number' ? ing.stock : 0;
          const newStock = currentStock + stockAdded;

          // Tahap 7: Hitung costPerUnit bahan dengan rata-rata tertimbang (stokLama*costLama + qtyBaru*costBaru) / (stokLama + qtyBaru)
          const oldStock = Math.max(0, currentStock);
          const oldCost = Number(ing.costPerUnit || 0);
          const newUnitCost = costPerStockUnit > 0 ? costPerStockUnit : oldCost;
          const weightedCost =
            oldStock > 0 && oldCost > 0 && oldStock + stockAdded > 0
              ? Math.round(((oldStock * oldCost + stockAdded * newUnitCost) / (oldStock + stockAdded)) * 100) / 100
              : newUnitCost;

          const updatedIng: Ingredient = {
            ...ing,
            stock: newStock,
            unit: stockUnit,
            stockUnit,
            purchaseUnit,
            conversionFactor,
            purchasePrice: item.costPerUnit,
            costPerUnit: weightedCost,
            updatedAt: now,
          };

          const ingRef = doc(db, 'ingredients', ing.id);
          batch.set(ingRef, sanitizeFirestore(updatedIng), { merge: true });
          updatedIngredients.push(updatedIng);

          const moveRef = doc(collection(db, 'stock_movements'));
          const movement: StockMovement = {
            id: moveRef.id,
            entityType: 'INGREDIENT',
            entityId: ing.id,
            entityName: ing.name,
            ingredientId: ing.id,
            ingredientName: ing.name,
            type: 'PURCHASE',
            changeAmount: stockAdded,
            balanceAfter: newStock,
            unit: stockUnit,
            purchaseUnit,
            purchaseQuantity: item.quantity,
            conversionFactor,
            referenceId: purchaseNo,
            notes: `Pembelian #${purchaseNo} (${item.quantity} ${purchaseUnit} = +${stockAdded} ${stockUnit}) dari ${params.vendorName || 'Supplier'}`,
            createdBy: userProfile?.uid || 'user',
            createdAt: now,
          };
          batch.set(moveRef, sanitizeFirestore(movement));
          createdMovements.push(movement);

          // Keep matching READY_TO_SELL product synced if exists
          const matchingProd =
            productsMap.get(ing.id) ||
            Array.from(productsMap.values()).find(
              p => p.name.trim().toLowerCase() === ing.name.trim().toLowerCase()
            );
          if (matchingProd && matchingProd.stockSource === 'READY_TO_SELL') {
            const curProdStock = typeof matchingProd.stock === 'number' ? matchingProd.stock : 0;
            const newProdStock = curProdStock + stockAdded;
            const syncedProd: Product = {
              ...matchingProd,
              stock: newProdStock,
              stockUnit,
              purchaseUnit,
              conversionFactor,
              updatedAt: now,
            };
            batch.set(
              doc(db, 'products', matchingProd.id),
              sanitizeFirestore(syncedProd),
              { merge: true }
            );
            updatedProducts.push(syncedProd);
          }
        } else if (item.targetName && item.targetName.trim()) {
          // Automatically create a new Ingredient in master stock if item does not exist yet
          const newIngRef = doc(collection(db, 'ingredients'));
          const stockUnit = item.stockUnit || item.unit || 'pcs';
          const purchaseUnit = item.purchaseUnit || item.unit || stockUnit;
          const conversionFactor = item.conversionFactor || 1;
          const stockAdded =
            item.stockQuantityAdded !== undefined && item.stockQuantityAdded > 0
              ? item.stockQuantityAdded
              : item.quantity * conversionFactor;
          const costPerStockUnit =
            conversionFactor > 0
              ? Math.round((item.costPerUnit / conversionFactor) * 100) / 100
              : item.costPerUnit;

          const newIng: Ingredient = {
            id: newIngRef.id,
            name: item.targetName.trim(),
            categoryId: item.itemType === 'KEMASAN' ? 'cat_ing_packaging' : 'cat_ing_raw',
            type: item.itemType === 'KEMASAN' ? 'PACKAGING' : 'RAW',
            unit: stockUnit,
            stockUnit,
            purchaseUnit,
            conversionFactor,
            stock: stockAdded,
            minimumStock: 5,
            criticalStock: 2,
            costPerUnit: costPerStockUnit,
            purchasePrice: item.costPerUnit,
            createdAt: now,
            updatedAt: now,
          };

          batch.set(newIngRef, sanitizeFirestore(newIng));
          updatedIngredients.push(newIng);

          const moveRef = doc(collection(db, 'stock_movements'));
          const movement: StockMovement = {
            id: moveRef.id,
            entityType: 'INGREDIENT',
            entityId: newIng.id,
            entityName: newIng.name,
            ingredientId: newIng.id,
            ingredientName: newIng.name,
            type: 'PURCHASE',
            changeAmount: stockAdded,
            balanceAfter: stockAdded,
            unit: stockUnit,
            purchaseUnit,
            purchaseQuantity: item.quantity,
            conversionFactor,
            referenceId: purchaseNo,
            notes: `Pembelian Bahan Baru #${purchaseNo} (${item.quantity} ${purchaseUnit} = +${stockAdded} ${stockUnit}) dari ${params.vendorName || 'Supplier'}`,
            createdBy: userProfile?.uid || 'user',
            createdAt: now,
          };
          batch.set(moveRef, sanitizeFirestore(movement));
          createdMovements.push(movement);
        }
      }
    }

    // Cash Deduction for paidAmount
    let createdCashMut: CashMutation | null = null;
    if (paidAmount > 0) {
      const sourceAcc = params.paymentSource || 'KAS_KASIR';
      const mappedAcc = normalizeCashAccount(sourceAcc);

      const mutRef = doc(collection(db, 'cash_mutations'));
      const cashMut: CashMutation = {
        id: mutRef.id,
        date: params.date || now.split('T')[0],
        account: mappedAcc,
        type: 'PENGELUARAN',
        amount: paidAmount,
        flow: 'OUT',
        referenceId: purchRef.id,
        title: `Pembelian #${purchaseNo} - ${params.vendorName || 'Supplier'}`,
        notes: `Pembayaran ${paymentStatus} via ${getCashAccountLabel(mappedAcc)}`,
        createdBy: userProfile?.uid || 'user',
        createdByName: userProfile?.displayName || 'User',
        createdAt: now,
      };
      batch.set(mutRef, sanitizeFirestore(cashMut));
      createdCashMut = cashMut;
    }

    // Record Audit Log
    const logRef = doc(collection(db, 'audit_logs'));
    batch.set(
      logRef,
      sanitizeFirestore({
        id: logRef.id,
        action: 'PEMBELIAN_BARU',
        details: `Membuat pembelian #${purchaseNo} total Rp ${params.totalAmount.toLocaleString('id-ID')}, dibayar Rp ${paidAmount.toLocaleString('id-ID')}`,
        userUid: userProfile?.uid || 'user',
        userName: userProfile?.displayName || 'User',
        createdAt: now,
      })
    );

    await batch.commit();

    // Update optimistic local state immediately
    setPurchases(prev => deduplicate([newPurchase, ...prev]));
    if (updatedIngredients.length > 0) {
      setIngredients(prev => {
        const map = new Map(prev.map(i => [i.id, i]));
        updatedIngredients.forEach(u => map.set(u.id, u));
        return Array.from(map.values());
      });
    }
    if (updatedProducts.length > 0) {
      setProducts(prev => {
        const map = new Map(prev.map(p => [p.id, p]));
        updatedProducts.forEach(u => map.set(u.id, u));
        return Array.from(map.values());
      });
    }
    if (createdMovements.length > 0) {
      setStockMovements(prev => deduplicate([...createdMovements, ...prev]));
    }
    if (createdCashMut) {
      setCashMutations(prev => deduplicate([createdCashMut!, ...prev]));
    }

    return newPurchase;
  };

  const updatePurchase = async (
    purchaseId: string,
    params: {
      purchaseNo?: string;
      vendorId?: string;
      vendorName: string;
      invoiceNo?: string;
      reference?: string;
      dueDate?: string;
      date: string;
      items: PurchaseItem[];
      subtotal?: number;
      discount?: number;
      tax?: number;
      shippingCost?: number;
      transactionCost?: number;
      totalAmount: number;
      notes?: string;
    }
  ): Promise<Purchase> => {
    const targetPurch = purchases.find(p => p.id === purchaseId);
    if (!targetPurch) throw new Error('Data pembelian tidak ditemukan');

    if (params.totalAmount < targetPurch.paidAmount) {
      throw new Error(
        `Total pembelian (Rp ${params.totalAmount.toLocaleString('id-ID')}) tidak boleh lebih kecil dari total yang sudah dibayar (Rp ${targetPurch.paidAmount.toLocaleString('id-ID')}). Sesuaikan atau batalkan pembayaran terlebih dahulu.`
      );
    }

    const now = new Date().toISOString();
    const batch = writeBatch(db);

    // Calculate Stock Deltas between old items and new items
    const oldStockMap = new Map<string, { entityType: 'INGREDIENT' | 'PRODUCT'; qty: number }>();
    (targetPurch.items || []).forEach(item => {
      const cFactor = item.conversionFactor || 1;
      const added = item.stockQuantityAdded !== undefined ? item.stockQuantityAdded : item.quantity * cFactor;
      const prev = oldStockMap.get(item.targetId) || { entityType: item.entityType, qty: 0 };
      oldStockMap.set(item.targetId, { entityType: item.entityType, qty: prev.qty + added });
    });

    const newStockMap = new Map<string, { entityType: 'INGREDIENT' | 'PRODUCT'; qty: number; item: PurchaseItem }>();
    (params.items || []).forEach(item => {
      const cFactor = item.conversionFactor || 1;
      const added = item.stockQuantityAdded !== undefined ? item.stockQuantityAdded : item.quantity * cFactor;
      const prev = newStockMap.get(item.targetId) || { entityType: item.entityType, qty: 0, item };
      newStockMap.set(item.targetId, { entityType: item.entityType, qty: prev.qty + added, item });
    });

    const allTargetIds = new Set([...oldStockMap.keys(), ...newStockMap.keys()]);
    for (const targetId of allTargetIds) {
      const oldInfo = oldStockMap.get(targetId);
      const newInfo = newStockMap.get(targetId);
      const oldQty = oldInfo?.qty || 0;
      const newQty = newInfo?.qty || 0;
      const delta = newQty - oldQty;

      if (delta !== 0) {
        const entityType = newInfo?.entityType || oldInfo?.entityType || 'INGREDIENT';
        if (entityType === 'PRODUCT') {
          const product = productsMap.get(targetId);
          if (product) {
            const currentStock = typeof product.stock === 'number' ? product.stock : 0;
            const updatedStock = Math.max(0, currentStock + delta);
            const prodRef = doc(db, 'products', product.id);
            batch.set(
              prodRef,
              sanitizeFirestore({ ...product, stock: updatedStock, updatedAt: now }),
              { merge: true }
            );

            const moveRef = doc(collection(db, 'stock_movements'));
            batch.set(
              moveRef,
              sanitizeFirestore({
                id: moveRef.id,
                entityType: 'PRODUCT',
                entityId: product.id,
                entityName: product.name,
                productId: product.id,
                productName: product.name,
                type: delta > 0 ? 'PURCHASE' : 'ADJUSTMENT',
                changeAmount: delta,
                balanceAfter: updatedStock,
                referenceId: params.purchaseNo || targetPurch.purchaseNo,
                notes: `Penyesuaian Edit Pembelian #${params.purchaseNo || targetPurch.purchaseNo}: (${delta > 0 ? '+' : ''}${delta} ${product.stockUnit || 'pcs'})`,
                createdBy: userProfile?.uid || 'user',
                createdAt: now,
              })
            );
          }
        } else {
          const ing = ingredientsMap.get(targetId);
          if (ing) {
            const currentStock = typeof ing.stock === 'number' ? ing.stock : 0;
            const updatedStock = Math.max(0, currentStock + delta);
            const ingRef = doc(db, 'ingredients', ing.id);
            batch.set(
              ingRef,
              sanitizeFirestore({ ...ing, stock: updatedStock, updatedAt: now }),
              { merge: true }
            );

            const moveRef = doc(collection(db, 'stock_movements'));
            batch.set(
              moveRef,
              sanitizeFirestore({
                id: moveRef.id,
                entityType: 'INGREDIENT',
                entityId: ing.id,
                entityName: ing.name,
                ingredientId: ing.id,
                ingredientName: ing.name,
                type: delta > 0 ? 'PURCHASE' : 'ADJUSTMENT',
                changeAmount: delta,
                balanceAfter: updatedStock,
                referenceId: params.purchaseNo || targetPurch.purchaseNo,
                notes: `Penyesuaian Edit Pembelian #${params.purchaseNo || targetPurch.purchaseNo}: (${delta > 0 ? '+' : ''}${delta} ${ing.stockUnit || ing.unit || 'pcs'})`,
                createdBy: userProfile?.uid || 'user',
                createdAt: now,
              })
            );
          }
        }
      }
    }

    const remainingAmount = Math.max(0, params.totalAmount - targetPurch.paidAmount);
    const paymentStatus: PaymentStatus =
      targetPurch.paidAmount >= params.totalAmount && params.totalAmount > 0
        ? 'LUNAS'
        : targetPurch.paidAmount > 0
        ? 'SEBAGIAN'
        : 'BELUM_DIBAYAR';

    const itemsSubtotal =
      params.subtotal !== undefined
        ? params.subtotal
        : params.items.reduce((sum, it) => sum + (it.subtotal || it.total || 0), 0);

    const updatedPurchase: Purchase = {
      ...targetPurch,
      purchaseNo: params.purchaseNo?.trim() || targetPurch.purchaseNo,
      date: params.date || targetPurch.date,
      dueDate: params.dueDate || '',
      vendorId: params.vendorId || '',
      vendorName: params.vendorName || targetPurch.vendorName,
      supplier: params.vendorName || targetPurch.vendorName,
      invoiceNo: params.invoiceNo || '',
      reference: params.reference || '',
      items: params.items,
      subtotal: itemsSubtotal,
      discount: params.discount || 0,
      tax: params.tax || 0,
      shippingCost: params.shippingCost || 0,
      transactionCost: params.transactionCost || 0,
      totalAmount: params.totalAmount,
      totalCost: params.totalAmount,
      remainingAmount,
      paymentStatus,
      notes: params.notes || '',
      updatedAt: now,
    };

    const purchRef = doc(db, 'purchases', purchaseId);
    batch.set(purchRef, sanitizeFirestore(updatedPurchase), { merge: true });

    // Record Audit Log
    const logRef = doc(collection(db, 'audit_logs'));
    batch.set(
      logRef,
      sanitizeFirestore({
        id: logRef.id,
        action: 'EDIT_PEMBELIAN',
        details: `Mengedit pembelian #${updatedPurchase.purchaseNo} total Rp ${params.totalAmount.toLocaleString('id-ID')}`,
        userUid: userProfile?.uid || 'user',
        userName: userProfile?.displayName || 'User',
        createdAt: now,
      })
    );

    await batch.commit();
    return updatedPurchase;
  };

  // Ubah hapus pembelian menjadi VOID (tanpa deleteDoc) dengan alasan dan jejak pengguna
  const deletePurchase = async (purchaseId: string, reason?: string): Promise<void> => {
    const targetPurch = purchases.find(p => p.id === purchaseId);
    if (!targetPurch) throw new Error('Data pembelian tidak ditemukan');
    if (targetPurch.status === 'VOID') {
      throw new Error('Transaksi pembelian ini sudah berstatus VOID');
    }

    const now = new Date().toISOString();
    const voidReasonText = reason?.trim() || 'Dibatalkan / Void Pembelian';
    const actorId = currentEmployee?.id || userProfile?.uid || 'user';
    const actorName = currentEmployee?.name || userProfile?.displayName || 'User';
    const batch = writeBatch(db);

    // Revert Stock Additions
    if (targetPurch.items && targetPurch.items.length > 0) {
      for (const item of targetPurch.items) {
        const cFactor = item.conversionFactor || 1;
        const stockAdded =
          item.stockQuantityAdded !== undefined
            ? item.stockQuantityAdded
            : item.quantity * cFactor;

        if (item.entityType === 'PRODUCT') {
          const product = productsMap.get(item.targetId);
          if (product) {
            const currentStock = typeof product.stock === 'number' ? product.stock : 0;
            // Tahap 7: Hilangkan Math.max(0, ...) saat void/hapus pembelian
            const newStock = currentStock - stockAdded;
            const isInsufficient = currentStock < stockAdded;

            if (isInsufficient) {
              const deficit = stockAdded - currentStock;
              const warningMsg = `Peringatan: Stok ${product.name} saat ini (${currentStock}) tidak cukup untuk membatalkan pembelian (${stockAdded}). Selisih kekurangan (${deficit}) dicatat sebagai ADJUSTMENT.`;
              console.warn(warningMsg);
              if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                try {
                  window.alert(warningMsg);
                } catch {
                  // ignore
                }
              }
            }

            const prodRef = doc(db, 'products', product.id);
            batch.set(
              prodRef,
              sanitizeFirestore({ ...product, stock: newStock, updatedAt: now }),
              { merge: true }
            );

            const returnQty = Math.max(0, Math.min(currentStock, stockAdded));
            if (returnQty > 0 || !isInsufficient) {
              const moveRef = doc(collection(db, 'stock_movements'));
              batch.set(
                moveRef,
                sanitizeFirestore({
                  id: moveRef.id,
                  entityType: 'PRODUCT',
                  entityId: product.id,
                  entityName: product.name,
                  productId: product.id,
                  productName: product.name,
                  type: 'RETURN',
                  changeAmount: isInsufficient ? -returnQty : -stockAdded,
                  balanceAfter: isInsufficient ? 0 : newStock,
                  referenceId: targetPurch.purchaseNo || targetPurch.id,
                  notes: `Reversal Hapus Pembelian #${targetPurch.purchaseNo || targetPurch.id}`,
                  createdBy: userProfile?.uid || 'user',
                  createdAt: now,
                })
              );
            }

            if (isInsufficient) {
              const deficit = stockAdded - currentStock;
              const adjRef = doc(collection(db, 'stock_movements'));
              batch.set(
                adjRef,
                sanitizeFirestore({
                  id: adjRef.id,
                  entityType: 'PRODUCT',
                  entityId: product.id,
                  entityName: product.name,
                  productId: product.id,
                  productName: product.name,
                  type: 'ADJUSTMENT',
                  changeAmount: -deficit,
                  balanceAfter: newStock,
                  referenceId: targetPurch.purchaseNo || targetPurch.id,
                  notes: `Selisih stok tidak cukup saat void pembelian #${targetPurch.purchaseNo || targetPurch.id} (stok ada: ${currentStock}, ditarik: ${stockAdded})`,
                  createdBy: userProfile?.uid || 'user',
                  createdAt: now,
                })
              );
            }
          }
        } else {
          const ing = ingredientsMap.get(item.targetId);
          if (ing) {
            const currentStock = typeof ing.stock === 'number' ? ing.stock : 0;
            // Tahap 7: Hilangkan Math.max(0, ...) saat void/hapus pembelian
            const newStock = currentStock - stockAdded;
            const isInsufficient = currentStock < stockAdded;

            if (isInsufficient) {
              const deficit = stockAdded - currentStock;
              const warningMsg = `Peringatan: Stok bahan ${ing.name} saat ini (${currentStock}) tidak cukup untuk membatalkan pembelian (${stockAdded}). Selisih kekurangan (${deficit}) dicatat sebagai ADJUSTMENT.`;
              console.warn(warningMsg);
              if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                try {
                  window.alert(warningMsg);
                } catch {
                  // ignore
                }
              }
            }

            const ingRef = doc(db, 'ingredients', ing.id);
            batch.set(
              ingRef,
              sanitizeFirestore({ ...ing, stock: newStock, updatedAt: now }),
              { merge: true }
            );

            const returnQty = Math.max(0, Math.min(currentStock, stockAdded));
            if (returnQty > 0 || !isInsufficient) {
              const moveRef = doc(collection(db, 'stock_movements'));
              batch.set(
                moveRef,
                sanitizeFirestore({
                  id: moveRef.id,
                  entityType: 'INGREDIENT',
                  entityId: ing.id,
                  entityName: ing.name,
                  ingredientId: ing.id,
                  ingredientName: ing.name,
                  type: 'RETURN',
                  changeAmount: isInsufficient ? -returnQty : -stockAdded,
                  balanceAfter: isInsufficient ? 0 : newStock,
                  referenceId: targetPurch.purchaseNo || targetPurch.id,
                  notes: `Reversal Hapus Pembelian #${targetPurch.purchaseNo || targetPurch.id}`,
                  createdBy: userProfile?.uid || 'user',
                  createdAt: now,
                })
              );
            }

            if (isInsufficient) {
              const deficit = stockAdded - currentStock;
              const adjRef = doc(collection(db, 'stock_movements'));
              batch.set(
                adjRef,
                sanitizeFirestore({
                  id: adjRef.id,
                  entityType: 'INGREDIENT',
                  entityId: ing.id,
                  entityName: ing.name,
                  ingredientId: ing.id,
                  ingredientName: ing.name,
                  type: 'ADJUSTMENT',
                  changeAmount: -deficit,
                  balanceAfter: newStock,
                  referenceId: targetPurch.purchaseNo || targetPurch.id,
                  notes: `Selisih stok tidak cukup saat void pembelian #${targetPurch.purchaseNo || targetPurch.id} (stok ada: ${currentStock}, ditarik: ${stockAdded})`,
                  createdBy: userProfile?.uid || 'user',
                  createdAt: now,
                })
              );
            }
          }
        }
      }
    }

    // Revert Cash Mutations per pembayaran ke sourceAccount masing-masing (fallback ke paymentSource untuk data lama)
    const validPayments = (targetPurch.payments || []).filter(p => Number(p.amount) > 0);
    if (validPayments.length > 0) {
      for (const pay of validPayments) {
        const refundAcc = normalizeCashAccount(
          pay.sourceAccount || targetPurch.paymentSource || 'KAS_KASIR'
        );
        const mutRef = doc(collection(db, 'cash_mutations'));
        batch.set(
          mutRef,
          sanitizeFirestore({
            id: mutRef.id,
            date: now.split('T')[0],
            account: refundAcc,
            type: 'PENYESUAIAN',
            amount: pay.amount,
            flow: 'IN',
            referenceId: purchaseId,
            title: `Reversal Hapus Pembelian #${targetPurch.purchaseNo || targetPurch.id}${
              pay.paymentNo ? ` (${pay.paymentNo})` : ''
            }`,
            notes: `Pengembalian dana pembayaran ke ${getCashAccountLabel(refundAcc)} karena transaksi pembelian dihapus`,
            createdBy: userProfile?.uid || 'user',
            createdByName: userProfile?.displayName || 'User',
            createdAt: now,
          })
        );
      }
    } else if (targetPurch.paidAmount > 0) {
      const fallbackAcc = normalizeCashAccount(targetPurch.paymentSource || 'KAS_KASIR');
      const mutRef = doc(collection(db, 'cash_mutations'));
      batch.set(
        mutRef,
        sanitizeFirestore({
          id: mutRef.id,
          date: now.split('T')[0],
          account: fallbackAcc,
          type: 'PENYESUAIAN',
          amount: targetPurch.paidAmount,
          flow: 'IN',
          referenceId: purchaseId,
          title: `Reversal Hapus Pembelian #${targetPurch.purchaseNo || targetPurch.id}`,
          notes: `Pengembalian dana pembayaran ke ${getCashAccountLabel(fallbackAcc)} karena transaksi pembelian dihapus`,
          createdBy: userProfile?.uid || 'user',
          createdByName: userProfile?.displayName || 'User',
          createdAt: now,
        })
      );
    }

    // Tandai pembelian sebagai VOID (dilarang menghapus dokumen secara permanen)
    const purchRef = doc(db, 'purchases', purchaseId);
    batch.set(
      purchRef,
      sanitizeFirestore({
        ...targetPurch,
        status: 'VOID',
        paymentStatus: 'VOID',
        voidReason: voidReasonText,
        voidedAt: now,
        voidedBy: actorId,
        voidedByName: actorName,
        updatedAt: now,
      }),
      { merge: true }
    );

    // Record Audit Log secara atomik dalam batch
    const logRef = doc(collection(db, 'audit_logs'));
    batch.set(
      logRef,
      sanitizeFirestore({
        id: logRef.id,
        action: 'VOID_PEMBELIAN',
        details: `Void transaksi pembelian #${targetPurch.purchaseNo || targetPurch.id} (${targetPurch.vendorName || targetPurch.supplier}). Alasan: ${voidReasonText}`,
        userUid: actorId,
        userName: actorName,
        createdAt: now,
      })
    );

    await batch.commit();
  };

  const addPurchasePayment = async (
    purchaseId: string,
    paymentData: {
      amount: number;
      date: string;
      sourceAccount: string;
      reference?: string;
      notes?: string;
    }
  ): Promise<PurchasePayment> => {
    if (paymentData.amount <= 0) {
      throw new Error('Jumlah pembayaran harus lebih dari 0');
    }

    const mappedAcc = normalizeCashAccount(paymentData.sourceAccount);
    const availableBalance = getAccountBalanceFromSummary(cashBalanceSummary, mappedAcc);

    // Validasi saldo akun sumber cukup sebelum mutasi OUT; jika tidak cukup, tolak dengan pesan jelas
    if (availableBalance < paymentData.amount) {
      const accLabel = getCashAccountLabel(mappedAcc);
      throw new Error(
        `Saldo akun ${accLabel} tidak mencukupi untuk melakukan pembayaran hutang. ` +
        `Saldo tersedia: Rp ${Math.max(0, availableBalance).toLocaleString('id-ID')}, ` +
        `dibutuhkan: Rp ${paymentData.amount.toLocaleString('id-ID')}.`
      );
    }

    const now = new Date().toISOString();
    const today = paymentData.date || now.split('T')[0];
    const actorId = currentEmployee?.id || userProfile?.uid || 'user';
    const actorName = currentEmployee?.name || userProfile?.displayName || 'User';

    // Eksekusi atomik runTransaction dengan membaca dokumen purchase terbaru langsung dari server (bukan dari state lokal)
    const newPaymentLog = await runTransaction(db, async (transaction) => {
      const purchRef = doc(db, 'purchases', purchaseId);
      const purchSnap = await transaction.get(purchRef);

      if (!purchSnap.exists()) {
        throw new Error('Data pembelian tidak ditemukan di server.');
      }

      const targetPurch = { ...(purchSnap.data() as Purchase), id: purchSnap.id };

      if (targetPurch.status === 'VOID') {
        throw new Error('Tidak dapat melakukan pembayaran pada transaksi pembelian yang sudah berstatus VOID.');
      }

      const currentRemaining = typeof targetPurch.remainingAmount === 'number'
        ? targetPurch.remainingAmount
        : Math.max(0, targetPurch.totalAmount - (targetPurch.paidAmount || 0));

      if (paymentData.amount > currentRemaining) {
        throw new Error(
          `Jumlah bayar (Rp ${paymentData.amount.toLocaleString('id-ID')}) melebihi sisa tagihan terkini di server (Rp ${currentRemaining.toLocaleString('id-ID')}).`
        );
      }

      const newPaidAmount = (targetPurch.paidAmount || 0) + paymentData.amount;
      const newRemaining = Math.max(0, targetPurch.totalAmount - newPaidAmount);
      const newStatus: PaymentStatus = newRemaining <= 0 ? 'LUNAS' : 'SEBAGIAN';

      const payCount = (targetPurch.payments || []).length + 1;
      const paymentNo = `PAY-${String(payCount).padStart(5, '0')}`;

      const createdPayment: PurchasePayment = {
        id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        purchaseId,
        paymentNo,
        date: today,
        amount: paymentData.amount,
        sourceAccount: mappedAcc,
        reference: paymentData.reference || '',
        notes: paymentData.notes || 'Pembayaran Tagihan Pembelian',
        createdBy: actorId,
        createdAt: now,
        updatedAt: now,
      };

      const updatedPayments = [...(targetPurch.payments || []), createdPayment];

      // 1. Update purchase document di server
      transaction.set(
        purchRef,
        sanitizeFirestore({
          ...targetPurch,
          paidAmount: newPaidAmount,
          remainingAmount: newRemaining,
          paymentStatus: newStatus,
          payments: updatedPayments,
          updatedAt: now,
        }),
        { merge: true }
      );

      // 2. Buat mutasi pengeluaran kas (OUT) dari akun sumber
      const mutRef = doc(collection(db, 'cash_mutations'));
      const cashMut: CashMutation = {
        id: mutRef.id,
        date: today,
        account: mappedAcc,
        type: 'PENGELUARAN',
        amount: paymentData.amount,
        flow: 'OUT',
        referenceId: purchaseId,
        title: `Bayar #${paymentNo} (${targetPurch.purchaseNo || targetPurch.id}) - ${targetPurch.vendorName || targetPurch.supplier || 'Supplier'}`,
        notes: `Pembayaran via ${getCashAccountLabel(mappedAcc)}${paymentData.notes ? ` - ${paymentData.notes}` : ''}`,
        createdBy: actorId,
        createdByName: actorName,
        createdAt: now,
      };
      transaction.set(mutRef, sanitizeFirestore(cashMut));

      // 3. Catat audit log secara atomik
      const auditRef = doc(collection(db, 'audit_logs'));
      const auditLog: AuditLog = {
        id: auditRef.id,
        action: 'BAYAR_PEMBELIAN',
        details: `Bayar hutang pembelian #${targetPurch.purchaseNo || targetPurch.id} sebesar Rp ${paymentData.amount.toLocaleString('id-ID')} via ${getCashAccountLabel(mappedAcc)} (${paymentNo})`,
        userUid: actorId,
        userName: actorName,
        createdAt: now,
      };
      transaction.set(auditRef, sanitizeFirestore(auditLog));

      return createdPayment;
    });

    return newPaymentLog;
  };

  const deletePurchasePayment = async (
    purchaseId: string,
    paymentId: string
  ): Promise<void> => {
    const now = new Date().toISOString();
    const actorId = currentEmployee?.id || userProfile?.uid || 'user';
    const actorName = currentEmployee?.name || userProfile?.displayName || 'User';

    // Eksekusi atomik runTransaction dengan membaca dokumen purchase terbaru langsung dari server (bukan dari state lokal)
    await runTransaction(db, async (transaction) => {
      const purchRef = doc(db, 'purchases', purchaseId);
      const purchSnap = await transaction.get(purchRef);

      if (!purchSnap.exists()) {
        throw new Error('Data pembelian tidak ditemukan di server.');
      }

      const targetPurch = { ...(purchSnap.data() as Purchase), id: purchSnap.id };

      if (targetPurch.status === 'VOID') {
        throw new Error('Tidak dapat membatalkan pembayaran pada transaksi pembelian yang sudah berstatus VOID.');
      }

      const targetPayment = (targetPurch.payments || []).find(p => p.id === paymentId);
      if (!targetPayment) {
        throw new Error('Data pembayaran tidak ditemukan pada dokumen pembelian di server.');
      }

      const newPaidAmount = Math.max(0, (targetPurch.paidAmount || 0) - targetPayment.amount);
      const newRemaining = Math.max(0, targetPurch.totalAmount - newPaidAmount);
      const newStatus: PaymentStatus =
        newPaidAmount === 0
          ? 'BELUM_DIBAYAR'
          : newPaidAmount >= targetPurch.totalAmount
          ? 'LUNAS'
          : 'SEBAGIAN';

      const updatedPayments = (targetPurch.payments || []).filter(p => p.id !== paymentId);

      // 1. Update purchase document di server
      transaction.set(
        purchRef,
        sanitizeFirestore({
          ...targetPurch,
          paidAmount: newPaidAmount,
          remainingAmount: newRemaining,
          paymentStatus: newStatus,
          payments: updatedPayments,
          updatedAt: now,
        }),
        { merge: true }
      );

      // 2. Buat mutasi pengembalian dana (reversal IN) ke akun sumber pembayaran
      const mappedAcc = normalizeCashAccount(targetPayment.sourceAccount);
      const mutRef = doc(collection(db, 'cash_mutations'));
      const cashMut: CashMutation = {
        id: mutRef.id,
        date: now.split('T')[0],
        account: mappedAcc,
        type: 'PENYESUAIAN',
        amount: targetPayment.amount,
        flow: 'IN',
        referenceId: purchaseId,
        title: `Batal Pembayaran #${targetPayment.paymentNo || targetPayment.id} (${targetPurch.purchaseNo || targetPurch.id})`,
        notes: `Pembatalan mutasi pembayaran via ${getCashAccountLabel(mappedAcc)}`,
        createdBy: actorId,
        createdByName: actorName,
        createdAt: now,
      };
      transaction.set(mutRef, sanitizeFirestore(cashMut));

      // 3. Catat audit log secara atomik
      const auditRef = doc(collection(db, 'audit_logs'));
      const auditLog: AuditLog = {
        id: auditRef.id,
        action: 'BATAL_BAYAR_PEMBELIAN',
        details: `Batalkan pembayaran hutang #${targetPayment.paymentNo || targetPayment.id} pembelian #${targetPurch.purchaseNo || targetPurch.id} sebesar Rp ${targetPayment.amount.toLocaleString('id-ID')} ke ${getCashAccountLabel(mappedAcc)}`,
        userUid: actorId,
        userName: actorName,
        createdAt: now,
      };
      transaction.set(auditRef, sanitizeFirestore(auditLog));
    });
  };

  const payPurchaseDebt = async (
    purchaseId: string,
    amount: number,
    sourceAccount: string,
    notes?: string
  ): Promise<void> => {
    await addPurchasePayment(purchaseId, {
      amount,
      date: new Date().toISOString().split('T')[0],
      sourceAccount,
      notes,
    });
  };

  const voidPurchase = async (purchaseId: string, reason: string): Promise<void> => {
    const targetPurch = purchases.find(p => p.id === purchaseId);
    if (!targetPurch) throw new Error('Data pembelian tidak ditemukan');
    if (targetPurch.status === 'VOID') throw new Error('Pembelian ini sudah dibatalkan');

    const now = new Date().toISOString();
    const batch = writeBatch(db);

    if (targetPurch.items && targetPurch.items.length > 0) {
      for (const item of targetPurch.items) {
        const cFactor = item.conversionFactor || 1;
        const stockAdded =
          item.stockQuantityAdded !== undefined
            ? item.stockQuantityAdded
            : item.quantity * cFactor;

        if (item.entityType === 'PRODUCT') {
          const product = productsMap.get(item.targetId);
          if (product) {
            const currentStock = typeof product.stock === 'number' ? product.stock : 0;
            // Tahap 7: Hilangkan Math.max(0, ...) saat void pembelian
            const newStock = currentStock - stockAdded;
            const isInsufficient = currentStock < stockAdded;

            if (isInsufficient) {
              const deficit = stockAdded - currentStock;
              const warningMsg = `Peringatan: Stok ${product.name} saat ini (${currentStock}) tidak cukup untuk membatalkan pembelian (${stockAdded}). Selisih kekurangan (${deficit}) dicatat sebagai ADJUSTMENT.`;
              console.warn(warningMsg);
              if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                try {
                  window.alert(warningMsg);
                } catch {
                  // ignore
                }
              }
            }

            const prodRef = doc(db, 'products', product.id);
            batch.set(
              prodRef,
              sanitizeFirestore({ ...product, stock: newStock, updatedAt: now }),
              { merge: true }
            );

            const returnQty = Math.max(0, Math.min(currentStock, stockAdded));
            if (returnQty > 0 || !isInsufficient) {
              const moveRef = doc(collection(db, 'stock_movements'));
              batch.set(
                moveRef,
                sanitizeFirestore({
                  id: moveRef.id,
                  entityType: 'PRODUCT',
                  entityId: product.id,
                  entityName: product.name,
                  productId: product.id,
                  productName: product.name,
                  type: 'RETURN',
                  changeAmount: isInsufficient ? -returnQty : -stockAdded,
                  balanceAfter: isInsufficient ? 0 : newStock,
                  referenceId: targetPurch.purchaseNo || targetPurch.id,
                  notes: `Void Pembelian #${targetPurch.purchaseNo || targetPurch.id}: ${reason}`,
                  createdBy: userProfile?.uid || 'user',
                  createdAt: now,
                })
              );
            }

            if (isInsufficient) {
              const deficit = stockAdded - currentStock;
              const adjRef = doc(collection(db, 'stock_movements'));
              batch.set(
                adjRef,
                sanitizeFirestore({
                  id: adjRef.id,
                  entityType: 'PRODUCT',
                  entityId: product.id,
                  entityName: product.name,
                  productId: product.id,
                  productName: product.name,
                  type: 'ADJUSTMENT',
                  changeAmount: -deficit,
                  balanceAfter: newStock,
                  referenceId: targetPurch.purchaseNo || targetPurch.id,
                  notes: `Selisih stok tidak cukup saat void pembelian #${targetPurch.purchaseNo || targetPurch.id} (stok ada: ${currentStock}, ditarik: ${stockAdded})`,
                  createdBy: userProfile?.uid || 'user',
                  createdAt: now,
                })
              );
            }
          }
        } else {
          const ing = ingredientsMap.get(item.targetId);
          if (ing) {
            const currentStock = typeof ing.stock === 'number' ? ing.stock : 0;
            // Tahap 7: Hilangkan Math.max(0, ...) saat void pembelian
            const newStock = currentStock - stockAdded;
            const isInsufficient = currentStock < stockAdded;

            if (isInsufficient) {
              const deficit = stockAdded - currentStock;
              const warningMsg = `Peringatan: Stok bahan ${ing.name} saat ini (${currentStock}) tidak cukup untuk membatalkan pembelian (${stockAdded}). Selisih kekurangan (${deficit}) dicatat sebagai ADJUSTMENT.`;
              console.warn(warningMsg);
              if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                try {
                  window.alert(warningMsg);
                } catch {
                  // ignore
                }
              }
            }

            const ingRef = doc(db, 'ingredients', ing.id);
            batch.set(
              ingRef,
              sanitizeFirestore({ ...ing, stock: newStock, updatedAt: now }),
              { merge: true }
            );

            const returnQty = Math.max(0, Math.min(currentStock, stockAdded));
            if (returnQty > 0 || !isInsufficient) {
              const moveRef = doc(collection(db, 'stock_movements'));
              batch.set(
                moveRef,
                sanitizeFirestore({
                  id: moveRef.id,
                  entityType: 'INGREDIENT',
                  entityId: ing.id,
                  entityName: ing.name,
                  ingredientId: ing.id,
                  ingredientName: ing.name,
                  type: 'RETURN',
                  changeAmount: isInsufficient ? -returnQty : -stockAdded,
                  balanceAfter: isInsufficient ? 0 : newStock,
                  referenceId: targetPurch.purchaseNo || targetPurch.id,
                  notes: `Void Pembelian #${targetPurch.purchaseNo || targetPurch.id}: ${reason}`,
                  createdBy: userProfile?.uid || 'user',
                  createdAt: now,
                })
              );
            }

            if (isInsufficient) {
              const deficit = stockAdded - currentStock;
              const adjRef = doc(collection(db, 'stock_movements'));
              batch.set(
                adjRef,
                sanitizeFirestore({
                  id: adjRef.id,
                  entityType: 'INGREDIENT',
                  entityId: ing.id,
                  entityName: ing.name,
                  ingredientId: ing.id,
                  ingredientName: ing.name,
                  type: 'ADJUSTMENT',
                  changeAmount: -deficit,
                  balanceAfter: newStock,
                  referenceId: targetPurch.purchaseNo || targetPurch.id,
                  notes: `Selisih stok tidak cukup saat void pembelian #${targetPurch.purchaseNo || targetPurch.id} (stok ada: ${currentStock}, ditarik: ${stockAdded})`,
                  createdBy: userProfile?.uid || 'user',
                  createdAt: now,
                })
              );
            }
          }
        }
      }
    }

    // Refund per pembayaran di purchase.payments ke sourceAccount masing-masing (fallback ke paymentSource untuk data lama)
    const validPayments = (targetPurch.payments || []).filter(p => Number(p.amount) > 0);
    if (validPayments.length > 0) {
      for (const pay of validPayments) {
        const refundAcc = normalizeCashAccount(
          pay.sourceAccount || targetPurch.paymentSource || 'KAS_KASIR'
        );
        const mutRef = doc(collection(db, 'cash_mutations'));
        batch.set(
          mutRef,
          sanitizeFirestore({
            id: mutRef.id,
            date: now.split('T')[0],
            account: refundAcc,
            type: 'PENYESUAIAN',
            amount: pay.amount,
            flow: 'IN',
            referenceId: purchaseId,
            title: `Void Pembelian #${targetPurch.purchaseNo || targetPurch.id}${
              pay.paymentNo ? ` (${pay.paymentNo})` : ''
            }`,
            notes: `Pengembalian dana void pembelian ke ${getCashAccountLabel(refundAcc)}: ${reason}`,
            createdBy: userProfile?.uid || 'user',
            createdByName: userProfile?.displayName || 'User',
            createdAt: now,
          })
        );
      }
    } else if (targetPurch.paidAmount > 0) {
      const fallbackAcc = normalizeCashAccount(targetPurch.paymentSource || 'KAS_KASIR');
      const mutRef = doc(collection(db, 'cash_mutations'));
      batch.set(
        mutRef,
        sanitizeFirestore({
          id: mutRef.id,
          date: now.split('T')[0],
          account: fallbackAcc,
          type: 'PENYESUAIAN',
          amount: targetPurch.paidAmount,
          flow: 'IN',
          referenceId: purchaseId,
          title: `Void Pembelian #${targetPurch.purchaseNo || targetPurch.id}`,
          notes: `Pengembalian dana void pembelian ke ${getCashAccountLabel(fallbackAcc)}: ${reason}`,
          createdBy: userProfile?.uid || 'user',
          createdByName: userProfile?.displayName || 'User',
          createdAt: now,
        })
      );
    }

    const actorId = currentEmployee?.id || userProfile?.uid || 'user';
    const actorName = currentEmployee?.name || userProfile?.displayName || 'User';
    const purchRef = doc(db, 'purchases', purchaseId);
    batch.set(
      purchRef,
      sanitizeFirestore({
        ...targetPurch,
        status: 'VOID',
        paymentStatus: 'VOID',
        voidReason: reason,
        voidedAt: now,
        voidedBy: actorId,
        voidedByName: actorName,
        updatedAt: now,
      }),
      { merge: true }
    );

    // Catat Audit Log void pembelian secara atomik
    const logRef = doc(collection(db, 'audit_logs'));
    batch.set(
      logRef,
      sanitizeFirestore({
        id: logRef.id,
        action: 'VOID_PEMBELIAN',
        details: `Void transaksi pembelian #${targetPurch.purchaseNo || targetPurch.id} (${targetPurch.vendorName || targetPurch.supplier}). Alasan: ${reason}`,
        userUid: actorId,
        userName: actorName,
        createdAt: now,
      })
    );

    await batch.commit();
  };

  const submitPurchase = async (
    supplier: string,
    itemId: string,
    quantity: number,
    costPerUnit: number,
    notes?: string,
    itemType?: 'INGREDIENT' | 'PRODUCT'
  ) => {
    const targetProduct = productsMap.get(itemId);
    const targetIng = ingredientsMap.get(itemId);
    const isProd = itemType === 'PRODUCT' || (targetProduct && !targetIng);

    const targetName = isProd ? (targetProduct?.name || 'Barang') : (targetIng?.name || 'Bahan');
    const unit = isProd ? 'unit' : (targetIng?.unit || 'unit');
    const entityType: 'INGREDIENT' | 'PRODUCT' = isProd ? 'PRODUCT' : 'INGREDIENT';
    const subtotal = quantity * costPerUnit;

    await createPurchase({
      vendorName: supplier || 'Supplier Umum',
      date: new Date().toISOString().split('T')[0],
      items: [{
        targetId: itemId,
        targetName,
        entityType,
        itemType: isProd ? 'BARANG_SIAP_JUAL' : (targetIng?.type === 'PACKAGING' ? 'KEMASAN' : 'BAHAN_BAKU'),
        quantity,
        unit,
        costPerUnit,
        subtotal,
      }],
      totalAmount: subtotal,
      paidAmount: subtotal,
      paymentSource: 'Kas',
      notes: notes || '',
    });
  };

  const addProductCategory = async (name: string): Promise<Category> => {
    const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newCat: Category = {
      id,
      name: name.trim(),
      displayOrder: categories.length + 1,
    };
    await setDoc(doc(db, 'categories', id), newCat);
    return newCat;
  };

  const addProduct = async (
    productData: Omit<Product, 'id'> & { id?: string },
    recipeItems?: RecipeItem[],
    recipeMeta?: {
      recipeMode?: 'PORTION' | 'BATCH';
      yieldQty?: number;
      batchItems?: RecipeItem[];
      portionItems?: RecipeItem[];
      overheadCostPerUnit?: number;
      overheadItems?: OverheadItem[];
      overheadNotes?: string;
    }
  ): Promise<Product> => {
    if (currentRole === 'KASIR') {
      throw new Error('Akses Ditolak: Hanya ADMIN/OWNER yang dapat menambah menu.');
    }
    const id = productData.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const isProduction = productData.isProduction !== undefined 
      ? productData.isProduction 
      : Boolean(productData.stockSource === 'PRODUCTION' || (recipeItems && recipeItems.length > 0));
    const initialStock = typeof productData.stock === 'number' ? productData.stock : 0;
    const costPerUnit = typeof productData.costPerUnit === 'number' ? productData.costPerUnit : 0;
    const recipeId =
      productData.recipeId ||
      (isProduction && recipeItems && recipeItems.length > 0 ? `rec_${id}` : undefined);

    const resolvedProductType =
      productData.productType ||
      (productData.categoryId === 'cat_paket' || productData.name.toLowerCase().includes('paket')
        ? 'PACKAGE'
        : 'SINGLE');

    const resolvedStockSource =
      productData.stockSource ||
      (isProduction
        ? 'PRODUCTION'
        : resolvedProductType === 'PACKAGE' || productData.stockTracked === false
        ? 'COMPOSITION'
        : 'READY_TO_SELL');

    const resolvedStockTracked =
      productData.stockTracked !== undefined
        ? productData.stockTracked
        : resolvedStockSource === 'COMPOSITION' || resolvedProductType === 'PACKAGE'
        ? false
        : true;

    const newProduct: Product = {
      ...productData,
      id,
      name: productData.name.trim(),
      sku: productData.sku?.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      categoryId: productData.categoryId || 'cat_ayam',
      productType: resolvedProductType,
      stockSource: resolvedStockSource,
      sellingPrice: Number(productData.sellingPrice) || 0,
      active: productData.active !== undefined ? productData.active : true,
      image: productData.image || '',
      recipeId,
      stockTracked: resolvedStockTracked,
      stock: resolvedStockTracked ? initialStock : 0,
      costPerUnit,
      isProduction,
      createdAt: now,
      updatedAt: now,
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'products', id), sanitizeFirestore(newProduct));

    if (isProduction && recipeItems && recipeItems.length > 0) {
      let totalHpp = 0;
      const validItems = recipeItems.map(item => {
        const ing = ingredientsMap.get(item.ingredientId);
        const cost = ing ? (ing.costPerUnit || 0) : (item.costPerUnit || 0);
        totalHpp += cost * item.quantity;
        return {
          ingredientId: item.ingredientId,
          ingredientName: ing ? ing.name : item.ingredientName,
          quantity: Number(item.quantity) || 0,
          unit: ing ? ing.unit : item.unit,
          costPerUnit: cost,
        };
      });

      const overheadCost = recipeMeta?.overheadCostPerUnit || 0;

      const recipeDoc: Recipe = {
        id: recipeId!,
        productId: id,
        productName: newProduct.name,
        items: validItems,
        totalHpp: totalHpp + overheadCost,
        recipeMode: recipeMeta?.recipeMode || 'PORTION',
        yieldQty: recipeMeta?.yieldQty || 1,
        batchItems: recipeMeta?.batchItems || [],
        portionItems: recipeMeta?.portionItems || [],
        overheadCostPerUnit: overheadCost,
        overheadItems: recipeMeta?.overheadItems || [],
        overheadNotes: recipeMeta?.overheadNotes || '',
        updatedAt: now,
      };

      batch.set(doc(db, 'recipes', recipeId!), sanitizeFirestore(recipeDoc));
    } else if (!isProduction && resolvedStockTracked && resolvedStockSource === 'READY_TO_SELL') {
      if (initialStock > 0) {
        const moveRef = doc(collection(db, 'stock_movements'));
        const movement: StockMovement = {
          id: moveRef.id,
          entityType: 'PRODUCT',
          entityId: id,
          entityName: newProduct.name,
          productId: id,
          productName: newProduct.name,
          ingredientId: id,
          ingredientName: newProduct.name,
          type: 'PURCHASE',
          changeAmount: initialStock,
          balanceAfter: initialStock,
          referenceId: 'INITIAL_STOCK',
          notes: `Stok awal produk tanpa resep: ${newProduct.name}`,
          createdBy: userProfile?.uid || 'user',
          createdAt: now,
        };
        batch.set(moveRef, sanitizeFirestore(movement));
      }
    }

    // Audit log
    const auditRef = doc(collection(db, 'audit_logs'));
    batch.set(auditRef, sanitizeFirestore({
      id: auditRef.id,
      action: 'PRODUCT_CREATED',
      details: `Tambah menu/paket [${newProduct.name}] harga Rp ${newProduct.sellingPrice} (${isProduction ? 'Dengan Resep' : 'Tanpa Resep / Retail'})`,
      userUid: userProfile?.uid || 'user',
      userName: userProfile?.displayName || 'User',
      createdAt: now,
    }));

    await batch.commit();
    return newProduct;
  };

  const updateProduct = async (
    productId: string,
    productData: Partial<Product>,
    recipeItems?: RecipeItem[],
    recipeMeta?: {
      recipeMode?: 'PORTION' | 'BATCH';
      yieldQty?: number;
      batchItems?: RecipeItem[];
      portionItems?: RecipeItem[];
      overheadCostPerUnit?: number;
      overheadItems?: OverheadItem[];
      overheadNotes?: string;
    }
  ): Promise<void> => {
    if (currentRole === 'KASIR') {
      throw new Error('Akses Ditolak: Hanya ADMIN/OWNER yang dapat mengubah menu.');
    }
    const now = new Date().toISOString();
    const existing = products.find(p => p.id === productId);
    if (!existing) throw new Error('Menu tidak ditemukan');

    const batch = writeBatch(db);
    let recipeId = existing.recipeId;
    const isProduction = productData.isProduction !== undefined 
      ? productData.isProduction 
      : (recipeItems && recipeItems.length > 0 ? true : existing.isProduction ?? Boolean(recipeId));

    if (!isProduction) {
      // Remove any existing recipe
      if (recipeId) {
        batch.delete(doc(db, 'recipes', recipeId));
        recipeId = undefined;
      }
    } else if (recipeItems !== undefined) {
      if (recipeItems.length > 0) {
        if (!recipeId) recipeId = `rec_${productId}`;
        let totalHpp = 0;
        const validItems = recipeItems.map(item => {
          const ing = ingredientsMap.get(item.ingredientId);
          const cost = ing ? (ing.costPerUnit || 0) : (item.costPerUnit || 0);
          totalHpp += cost * item.quantity;
          return {
            ingredientId: item.ingredientId,
            ingredientName: ing ? ing.name : item.ingredientName,
            quantity: Number(item.quantity) || 0,
            unit: ing ? ing.unit : item.unit,
            costPerUnit: cost,
          };
        });

        const overheadCost = recipeMeta?.overheadCostPerUnit || 0;

        const recipeDoc: Recipe = {
          id: recipeId,
          productId,
          productName: productData.name?.trim() || existing.name,
          items: validItems,
          totalHpp: totalHpp + overheadCost,
          recipeMode: recipeMeta?.recipeMode || 'PORTION',
          yieldQty: recipeMeta?.yieldQty || 1,
          batchItems: recipeMeta?.batchItems || [],
          portionItems: recipeMeta?.portionItems || [],
          overheadCostPerUnit: overheadCost,
          overheadItems: recipeMeta?.overheadItems || [],
          overheadNotes: recipeMeta?.overheadNotes || '',
          updatedAt: now,
        };
        batch.set(doc(db, 'recipes', recipeId), sanitizeFirestore(recipeDoc));
      } else if (recipeId && !isProduction) {
        // removed all recipe items
        batch.delete(doc(db, 'recipes', recipeId));
        recipeId = undefined;
      }
    }

    const updatedProduct: Partial<Product> = {
      ...productData,
      isProduction,
      recipeId: recipeId || '',
      updatedAt: now,
    };

    batch.set(doc(db, 'products', productId), sanitizeFirestore(updatedProduct), { merge: true });

    // Sync matching ingredient if it exists
    const matchingIng = ingredientsMap.get(productId);
    if (matchingIng) {
      batch.set(
        doc(db, 'ingredients', productId),
        sanitizeFirestore({
          ...matchingIng,
          name: productData.name?.trim() || matchingIng.name,
          costPerUnit: typeof productData.costPerUnit === 'number' ? productData.costPerUnit : matchingIng.costPerUnit,
          stock: typeof productData.stock === 'number' ? productData.stock : matchingIng.stock,
          updatedAt: now,
        }),
        { merge: true }
      );
    }

    // Audit log
    const auditRef = doc(collection(db, 'audit_logs'));
    batch.set(auditRef, sanitizeFirestore({
      id: auditRef.id,
      action: 'PRODUCT_UPDATED',
      details: `Ubah menu/paket [${productData.name || existing.name}] (${isProduction ? 'Dengan Resep' : 'Tanpa Resep / Retail'})`,
      userUid: userProfile?.uid || 'user',
      userName: userProfile?.displayName || 'User',
      createdAt: now,
    }));

    await batch.commit();
  };

  const deleteProduct = async (productId: string): Promise<void> => {
    if (currentRole === 'KASIR') {
      throw new Error('Akses Ditolak: Hanya ADMIN/OWNER yang dapat menghapus menu.');
    }
    const existing = products.find(p => p.id === productId);
    const batch = writeBatch(db);

    batch.delete(doc(db, 'products', productId));
    if (existing?.recipeId) {
      batch.delete(doc(db, 'recipes', existing.recipeId));
    }

    const auditRef = doc(collection(db, 'audit_logs'));
    batch.set(auditRef, {
      id: auditRef.id,
      action: 'PRODUCT_DELETED',
      details: `Hapus menu/paket [${existing?.name || productId}]`,
      userUid: userProfile?.uid || 'user',
      userName: userProfile?.displayName || 'User',
      createdAt: new Date().toISOString(),
    });

    await batch.commit();
  };

  const updateProductPrice = async (productId: string, newPrice: number) => {
    if (currentRole === 'KASIR') {
      alert('Akses Ditolak: Kasir tidak boleh mengubah harga.');
      return;
    }
    const pRef = doc(db, 'products', productId);
    const existingProduct = products.find(p => p.id === productId);
    await setDoc(
      pRef,
      {
        ...(existingProduct || {}),
        sellingPrice: newPrice,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  };

  const saveRecipe = async (recipe: Recipe) => {
    if (currentRole === 'KASIR') {
      alert('Akses Ditolak: Kasir tidak boleh mengubah resep.');
      return;
    }

    let totalHpp = 0;
    const updatedItems = recipe.items.map(item => {
      const ing = ingredientsMap.get(item.ingredientId);
      const cost = ing ? ing.costPerUnit : (item.costPerUnit || 0);
      totalHpp += cost * item.quantity;
      return {
        ...item,
        costPerUnit: cost,
      };
    });

    const finalRecipe: Recipe = {
      ...recipe,
      items: updatedItems,
      totalHpp: totalHpp + (recipe.overheadCostPerUnit || 0),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'recipes', recipe.id), sanitizeFirestore(finalRecipe));

    // Update product reference
    const pRef = doc(db, 'products', recipe.productId);
    const existingProduct = products.find(p => p.id === recipe.productId);
    const computedHpp = Math.round((totalHpp + (recipe.overheadCostPerUnit || 0)) * 100) / 100;
    await setDoc(
      pRef,
      sanitizeFirestore({
        ...(existingProduct || {}),
        recipeId: recipe.id,
        costPerUnit: computedHpp,
        stockUnit: recipe.yieldUnit || existingProduct?.stockUnit || 'pcs',
        isProduction: true,
        stockSource: 'PRODUCTION',
        stockTracked: true,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  };

  const addIngredient = async (data: Omit<Ingredient, 'id'> & { id?: string }): Promise<Ingredient> => {
    const id = data.id || `ing_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    
    const stockUnit = (data.stockUnit || data.unit || 'pcs').trim();
    const purchaseUnit = (data.purchaseUnit || stockUnit).trim();
    const conversionFactor = Number(data.conversionFactor) > 0 ? Number(data.conversionFactor) : 1;
    const purchasePrice = Number(data.purchasePrice) || 0;
    
    // Calculate costPerUnit (HPP per stock unit)
    const costPerUnit = purchasePrice > 0
      ? Math.round((purchasePrice / conversionFactor) * 100) / 100
      : (Number(data.costPerUnit) || 0);

    const newIngredient: Ingredient = {
      id,
      name: data.name.trim(),
      unit: stockUnit, // Sync unit with stockUnit
      stockUnit,
      purchaseUnit,
      conversionFactor,
      purchasePrice,
      stock: Number(data.stock) || 0,
      minimumStock: Number(data.minimumStock) || 0,
      criticalStock: Number(data.criticalStock) || 0,
      costPerUnit,
      type: data.type || 'OTHER',
      categoryId: data.categoryId || '',
      createdAt: now,
      updatedAt: now,
    };

    const batch = writeBatch(db);
    const ingRef = doc(db, 'ingredients', id);
    batch.set(ingRef, sanitizeFirestore(newIngredient));

    // Initial stock movement log if initial stock > 0
    if (newIngredient.stock > 0) {
      const moveRef = doc(collection(db, 'stock_movements'));
      const movement: StockMovement = {
        id: moveRef.id,
        ingredientId: id,
        ingredientName: newIngredient.name,
        type: 'ADJUSTMENT',
        changeAmount: newIngredient.stock,
        balanceAfter: newIngredient.stock,
        unit: stockUnit,
        purchaseUnit,
        conversionFactor,
        notes: `Stok awal barang baru (${newIngredient.stock} ${newIngredient.stockUnit})`,
        createdBy: userProfile?.uid || 'user',
        createdAt: now,
      };
      batch.set(moveRef, sanitizeFirestore(movement));
    }

    // Audit log
    const auditRef = doc(collection(db, 'audit_logs'));
    batch.set(auditRef, sanitizeFirestore({
      id: auditRef.id,
      action: 'INGREDIENT_CREATED',
      details: `Tambah barang [${newIngredient.name}] - Satuan Stok: ${newIngredient.stockUnit}, Beli: ${newIngredient.purchaseUnit} (1 ${newIngredient.purchaseUnit} = ${newIngredient.conversionFactor} ${newIngredient.stockUnit}), Stok: ${newIngredient.stock}, HPP: Rp ${newIngredient.costPerUnit.toLocaleString('id-ID')}/${newIngredient.stockUnit}`,
      userUid: userProfile?.uid || 'user',
      userName: userProfile?.displayName || 'User',
      createdAt: now,
    }));

    try {
      await batch.commit();
      return newIngredient;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'ingredients');
      throw e;
    }
  };

  const updateIngredient = async (ingredientId: string, data: Partial<Ingredient>): Promise<void> => {
    const existing = ingredientsMap.get(ingredientId);
    if (!existing) throw new Error('Barang tidak ditemukan');

    const now = new Date().toISOString();
    const batch = writeBatch(db);
    const ingRef = doc(db, 'ingredients', ingredientId);

    const stockUnit = (data.stockUnit || data.unit || existing.stockUnit || existing.unit || 'pcs').trim();
    const purchaseUnit = (data.purchaseUnit || existing.purchaseUnit || stockUnit).trim();
    const conversionFactor = Number(data.conversionFactor) > 0
      ? Number(data.conversionFactor)
      : (existing.conversionFactor || 1);
    const purchasePrice = data.purchasePrice !== undefined ? Number(data.purchasePrice) : (existing.purchasePrice || 0);

    let costPerUnit = data.costPerUnit !== undefined ? Number(data.costPerUnit) : existing.costPerUnit;
    if (purchasePrice > 0 && (data.purchasePrice !== undefined || data.conversionFactor !== undefined)) {
      costPerUnit = Math.round((purchasePrice / conversionFactor) * 100) / 100;
    }

    const updatedData: Partial<Ingredient> = {
      ...data,
      unit: stockUnit,
      stockUnit,
      purchaseUnit,
      conversionFactor,
      purchasePrice,
      costPerUnit,
      updatedAt: now,
    };

    if (data.name) updatedData.name = data.name.trim();
    if (data.stock !== undefined) updatedData.stock = Number(data.stock);
    if (data.minimumStock !== undefined) updatedData.minimumStock = Number(data.minimumStock);
    if (data.criticalStock !== undefined) updatedData.criticalStock = Number(data.criticalStock);
    if (data.type) updatedData.type = data.type;
    if (data.categoryId !== undefined) updatedData.categoryId = data.categoryId;

    batch.set(ingRef, sanitizeFirestore(updatedData), { merge: true });

    // If stock explicitly changed in update
    if (data.stock !== undefined && data.stock !== existing.stock) {
      const diff = Number(data.stock) - existing.stock;
      const moveRef = doc(collection(db, 'stock_movements'));
      const movement: StockMovement = {
        id: moveRef.id,
        ingredientId,
        ingredientName: data.name || existing.name,
        type: diff < 0 ? 'WASTE' : 'ADJUSTMENT',
        changeAmount: diff,
        balanceAfter: Number(data.stock),
        notes: `Koreksi stok & satuan (${data.unit || existing.unit})`,
        createdBy: userProfile?.uid || 'user',
        createdAt: now,
      };
      batch.set(moveRef, sanitizeFirestore(movement));
    }

    // Audit log
    const auditRef = doc(collection(db, 'audit_logs'));
    batch.set(auditRef, sanitizeFirestore({
      id: auditRef.id,
      action: 'INGREDIENT_UPDATED',
      details: `Ubah barang [${existing.name}] -> Satuan: ${data.unit || existing.unit}, HPP: Rp ${(data.costPerUnit ?? existing.costPerUnit).toLocaleString('id-ID')}`,
      userUid: userProfile?.uid || 'user',
      userName: userProfile?.displayName || 'User',
      createdAt: now,
    }));

    try {
      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'ingredients');
      throw e;
    }
  };

  const deleteIngredient = async (ingredientId: string): Promise<void> => {
    const existing = ingredientsMap.get(ingredientId);
    const ingName = existing ? existing.name : ingredientId;

    try {
      await deleteDoc(doc(db, 'ingredients', ingredientId));

      // Record audit log
      const auditRef = doc(collection(db, 'audit_logs'));
      await setDoc(auditRef, sanitizeFirestore({
        id: auditRef.id,
        action: 'INGREDIENT_DELETED',
        details: `Hapus barang [${ingName}] dari daftar stok bahan`,
        userUid: userProfile?.uid || 'user',
        userName: userProfile?.displayName || 'User',
        createdAt: new Date().toISOString(),
      }));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'ingredients');
      throw e;
    }
  };

  const addIngredientCategory = async (data: Omit<IngredientCategory, 'id'> & { id?: string }): Promise<IngredientCategory> => {
    const id = data.id || `cat_ing_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const newCategory: IngredientCategory = {
      id,
      name: data.name.trim(),
      description: data.description?.trim() || '',
      displayOrder: data.displayOrder ?? (ingredientCategories.length + 1),
      isSystem: false,
      createdAt: now,
    };

    try {
      await setDoc(doc(db, 'ingredient_categories', id), sanitizeFirestore(newCategory));

      // Audit log
      const auditRef = doc(collection(db, 'audit_logs'));
      await setDoc(auditRef, sanitizeFirestore({
        id: auditRef.id,
        action: 'INGREDIENT_CATEGORY_CREATED',
        details: `Tambah kategori barang [${newCategory.name}]`,
        userUid: userProfile?.uid || 'user',
        userName: userProfile?.displayName || 'User',
        createdAt: now,
      }));

      return newCategory;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'ingredient_categories');
      throw e;
    }
  };

  const updateIngredientCategory = async (id: string, data: Partial<IngredientCategory>): Promise<void> => {
    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'ingredient_categories', id), sanitizeFirestore({
        ...data,
        updatedAt: now,
      }));

      // Audit log
      const auditRef = doc(collection(db, 'audit_logs'));
      await setDoc(auditRef, sanitizeFirestore({
        id: auditRef.id,
        action: 'INGREDIENT_CATEGORY_UPDATED',
        details: `Ubah kategori barang [${data.name || id}]`,
        userUid: userProfile?.uid || 'user',
        userName: userProfile?.displayName || 'User',
        createdAt: now,
      }));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'ingredient_categories');
      throw e;
    }
  };

  const deleteIngredientCategory = async (id: string): Promise<void> => {
    const cat = ingredientCategories.find(c => c.id === id);
    if (cat?.isSystem) {
      throw new Error('Kategori bawaan sistem tidak dapat dihapus');
    }

    try {
      await deleteDoc(doc(db, 'ingredient_categories', id));

      // Audit log
      const auditRef = doc(collection(db, 'audit_logs'));
      await setDoc(auditRef, sanitizeFirestore({
        id: auditRef.id,
        action: 'INGREDIENT_CATEGORY_DELETED',
        details: `Hapus kategori barang [${cat?.name || id}]`,
        userUid: userProfile?.uid || 'user',
        userName: userProfile?.displayName || 'User',
        createdAt: new Date().toISOString(),
      }));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'ingredient_categories');
      throw e;
    }
  };

  const addExpense = async (
    category: Expense['category'],
    amount: number,
    note?: string,
    paymentSource: ExpensePaymentSource = 'KAS_KASIR',
    date?: string
  ) => {
    const batch = writeBatch(db);
    const expRef = doc(collection(db, 'expenses'));
    const canonicalSource = normalizeCashAccount(paymentSource, note);
    const nowIso = new Date().toISOString();
    const expDate = date || nowIso.split('T')[0];
    const actorId = currentEmployee?.id || userProfile?.uid || 'user';
    const actorName = currentEmployee?.name || userProfile?.displayName || 'Owner ARY';
    const exp: Expense = {
      id: expRef.id,
      date: expDate,
      category,
      amount,
      paymentSource: canonicalSource,
      note: note || '',
      status: 'COMPLETED',
      createdBy: actorId,
      createdByName: actorName,
      createdAt: nowIso,
    };
    batch.set(expRef, sanitizeFirestore(exp));

    // Catat audit log secara atomik dalam batch yang sama
    const auditRef = doc(collection(db, 'audit_logs'));
    batch.set(auditRef, sanitizeFirestore({
      id: auditRef.id,
      action: 'EXPENSE_RECORDED',
      details: `Biaya Operasional [${category.toUpperCase()}] via ${getCashAccountLabel(canonicalSource)}: Rp ${amount.toLocaleString('id-ID')} ${note ? `(${note})` : ''}`,
      userUid: actorId,
      userName: actorName,
      createdAt: nowIso,
    }));

    await batch.commit();
  };

  // Simpan nilai lama di array history (amount, category, paymentSource, changedAt, changedBy) secara atomik
  const updateExpense = async (
    id: string,
    data: {
      category?: Expense['category'];
      amount?: number;
      note?: string;
      paymentSource?: ExpensePaymentSource;
      date?: string;
    }
  ) => {
    const existing = expenses.find((e) => e.id === id);
    if (!existing) throw new Error('Data pengeluaran tidak ditemukan');
    if (existing.status === 'VOID') {
      throw new Error('Pengeluaran yang sudah di-VOID tidak dapat diubah');
    }

    const nowIso = new Date().toISOString();
    const actorId = currentEmployee?.id || userProfile?.uid || 'user';
    const actorName = currentEmployee?.name || userProfile?.displayName || 'User';
    const canonicalSource = data.paymentSource
      ? normalizeCashAccount(data.paymentSource, data.note ?? existing.note)
      : existing.paymentSource || 'KAS_KASIR';

    const historyEntry: ExpenseHistoryEntry = {
      amount: existing.amount,
      category: existing.category,
      paymentSource: existing.paymentSource || 'KAS_KASIR',
      note: existing.note,
      date: existing.date,
      changedAt: nowIso,
      changedBy: actorId,
      changedByName: actorName,
    };
    const nextHistory: ExpenseHistoryEntry[] = [
      ...(existing.history || []),
      historyEntry,
    ];

    const updatedFields: Partial<Expense> = {
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.amount !== undefined ? { amount: Number(data.amount) } : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
      ...(canonicalSource !== undefined ? { paymentSource: canonicalSource } : {}),
      ...(data.date !== undefined ? { date: data.date } : {}),
      history: nextHistory,
      updatedAt: nowIso,
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'expenses', id), sanitizeFirestore(updatedFields), { merge: true });

    const auditRef = doc(collection(db, 'audit_logs'));
    batch.set(auditRef, sanitizeFirestore({
      id: auditRef.id,
      action: 'EXPENSE_UPDATED',
      details: `Ubah Biaya Operasional [${(data.category || existing.category || '').toUpperCase()}]: dari Rp ${existing.amount.toLocaleString('id-ID')} (${existing.paymentSource || 'KAS_KASIR'}) menjadi Rp ${(data.amount ?? existing.amount ?? 0).toLocaleString('id-ID')} (${canonicalSource})`,
      userUid: actorId,
      userName: actorName,
      createdAt: nowIso,
    }));

    await batch.commit();
  };

  // Ubah hapus pengeluaran menjadi VOID (status 'VOID', voidReason, voidedAt, voidedBy) tanpa deleteDoc
  const deleteExpense = async (id: string, reason?: string) => {
    const existing = expenses.find((e) => e.id === id);
    if (!existing) throw new Error('Data pengeluaran tidak ditemukan');
    if (existing.status === 'VOID') return;

    const nowIso = new Date().toISOString();
    const voidReasonText = reason?.trim() || 'Dibatalkan oleh pengguna';
    const actorId = currentEmployee?.id || userProfile?.uid || 'user';
    const actorName = currentEmployee?.name || userProfile?.displayName || 'User';

    const batch = writeBatch(db);
    batch.set(
      doc(db, 'expenses', id),
      sanitizeFirestore({
        status: 'VOID',
        voidReason: voidReasonText,
        voidedAt: nowIso,
        voidedBy: actorId,
        voidedByName: actorName,
        updatedAt: nowIso,
      }),
      { merge: true }
    );

    const auditRef = doc(collection(db, 'audit_logs'));
    batch.set(auditRef, sanitizeFirestore({
      id: auditRef.id,
      action: 'EXPENSE_VOIDED',
      details: `Void Biaya Operasional [${(existing.category || '').toUpperCase()}]: Rp ${(existing.amount ?? 0).toLocaleString('id-ID')} (${existing.note || '-'}). Alasan: ${voidReasonText}`,
      userUid: actorId,
      userName: actorName,
      createdAt: nowIso,
    }));

    await batch.commit();
  };

  const addCashMutation = async (params: {
    account: CashAccount;
    type: CashMutationType;
    amount: number;
    flow: 'IN' | 'OUT';
    title: string;
    notes?: string;
    referenceId?: string;
    relatedAccount?: CashAccount;
  }) => {
    const mutRef = doc(collection(db, 'cash_mutations'));
    const canonicalAccount = normalizeCashAccount(params.account, `${params.title} ${params.notes || ''}`);
    const mutation: CashMutation = {
      id: mutRef.id,
      date: new Date().toISOString().split('T')[0],
      account: canonicalAccount,
      type: params.type,
      amount: Math.abs(params.amount),
      flow: params.flow,
      title: params.title,
      notes: params.notes || '',
      referenceId: params.referenceId || '',
      relatedAccount: params.relatedAccount ? normalizeCashAccount(params.relatedAccount) : undefined,
      createdBy: currentEmployee?.id || userProfile?.uid || 'user',
      createdByName: currentEmployee?.name || userProfile?.displayName || 'Kasir',
      createdAt: new Date().toISOString(),
    };
    await setDoc(mutRef, sanitizeFirestore(mutation));

    // Audit log
    const auditRef = doc(collection(db, 'audit_logs'));
    await setDoc(auditRef, sanitizeFirestore({
      id: auditRef.id,
      action: `CASH_${canonicalAccount}_${params.type}`,
      details: `${params.title} [${params.flow === 'IN' ? '+' : '-'}] Rp ${params.amount.toLocaleString('id-ID')} ${params.notes ? `(${params.notes})` : ''}`,
      userUid: currentEmployee?.id || userProfile?.uid || 'user',
      userName: currentEmployee?.name || userProfile?.displayName || 'User',
      createdAt: new Date().toISOString(),
    }));
  };

  const transferCashAccount = async (params: {
    fromAccount: CashAccount;
    toAccount: CashAccount;
    amount: number;
    title?: string;
    notes?: string;
    type?: CashMutationType;
  }) => {
    const cleanAmount = Math.abs(params.amount);
    if (cleanAmount <= 0) {
      throw new Error('Nominal transfer harus lebih dari Rp 0.');
    }

    const fromAcc = normalizeCashAccount(params.fromAccount);
    const toAcc = normalizeCashAccount(params.toAccount);

    if (fromAcc === toAcc) {
      throw new Error('Akun asal dan akun tujuan tidak boleh sama.');
    }

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const transferGroupId = `trf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fromLabel = getCashAccountLabel(fromAcc);
    const toLabel = getCashAccountLabel(toAcc);

    const isOwnerWithdrawal = fromAcc === 'KAS_KASIR' && toAcc === 'KAS_OWNER';
    const isQrisSettlement = fromAcc === 'KAS_QRIS';
    const isPlatformSettlement =
      fromAcc === 'WALLET_GOFOOD' ||
      fromAcc === 'WALLET_GRABFOOD' ||
      fromAcc === 'WALLET_SHOPEEFOOD';

    const mutationType: CashMutationType =
      params.type ||
      (isOwnerWithdrawal
        ? 'SETOR_OWNER'
        : isPlatformSettlement
        ? 'PENCAIRAN_PLATFORM'
        : isQrisSettlement
        ? 'PENCAIRAN_QRIS'
        : 'TRANSFER_DANA');

    const defaultTitleOut = isOwnerWithdrawal
      ? `Setor / Ambil Kas oleh Owner (${fromLabel} → ${toLabel})`
      : isPlatformSettlement
      ? `Pencairan Saldo ${fromLabel} ke ${toLabel}`
      : isQrisSettlement
      ? `Pencairan QRIS ke ${toLabel}`
      : `Transfer Keluar ke ${toLabel}`;

    const defaultTitleIn = isOwnerWithdrawal
      ? `Terima Kas dari Laci Kasir (${fromLabel} → ${toLabel})`
      : isPlatformSettlement
      ? `Dana Cair Settlement dari ${fromLabel} (${fromLabel} → ${toLabel})`
      : isQrisSettlement
      ? `Dana Cair dari QRIS (${fromLabel} → ${toLabel})`
      : `Transfer Masuk dari ${fromLabel}`;

    const batch = writeBatch(db);

    const outRef = doc(collection(db, 'cash_mutations'));
    const outMut: CashMutation = {
      id: outRef.id,
      date: today,
      account: fromAcc,
      type: mutationType,
      amount: cleanAmount,
      flow: 'OUT',
      referenceId: transferGroupId,
      relatedAccount: toAcc,
      title: params.title ? `${params.title} (${fromLabel} → ${toLabel})` : defaultTitleOut,
      notes: params.notes || `Perpindahan saldo ${fromLabel} ke ${toLabel}`,
      createdBy: currentEmployee?.id || userProfile?.uid || 'user',
      createdByName: currentEmployee?.name || userProfile?.displayName || 'Owner/Kasir',
      createdAt: now,
    };
    batch.set(outRef, sanitizeFirestore(outMut));

    const inRef = doc(collection(db, 'cash_mutations'));
    const inMut: CashMutation = {
      id: inRef.id,
      date: today,
      account: toAcc,
      type: mutationType,
      amount: cleanAmount,
      flow: 'IN',
      referenceId: transferGroupId,
      relatedAccount: fromAcc,
      title: params.title ? `${params.title} (${fromLabel} → ${toLabel})` : defaultTitleIn,
      notes: params.notes || `Perpindahan saldo ${fromLabel} ke ${toLabel}`,
      createdBy: currentEmployee?.id || userProfile?.uid || 'user',
      createdByName: currentEmployee?.name || userProfile?.displayName || 'Owner/Kasir',
      createdAt: now,
    };
    batch.set(inRef, sanitizeFirestore(inMut));

    const auditRef = doc(collection(db, 'audit_logs'));
    batch.set(
      auditRef,
      sanitizeFirestore({
        id: auditRef.id,
        action: isPlatformSettlement ? 'PLATFORM_SETTLEMENT' : 'CASH_TRANSFER',
        details: `Transfer ${fromLabel} → ${toLabel}: Rp ${cleanAmount.toLocaleString('id-ID')}${params.notes ? ` (${params.notes})` : ''}`,
        userUid: currentEmployee?.id || userProfile?.uid || 'user',
        userName: currentEmployee?.name || userProfile?.displayName || 'User',
        createdAt: now,
      })
    );

    await batch.commit();
  };

  const settlePlatformWallet = async (params: {
    fromWallet: 'WALLET_GOFOOD' | 'WALLET_GRABFOOD' | 'WALLET_SHOPEEFOOD';
    toAccount: CashAccount;
    grossAmount: number;
    feeAmount?: number;
    notes?: string;
  }) => {
    const cleanGross = Math.round(Math.abs(params.grossAmount || 0));
    const cleanFee = Math.round(Math.max(0, params.feeAmount || 0));

    if (cleanGross <= 0) {
      throw new Error('Nominal saldo yang dicairkan harus lebih dari Rp 0.');
    }
    if (cleanFee >= cleanGross) {
      throw new Error('Potongan biaya platform tidak boleh melebihi atau sama dengan nominal yang dicairkan.');
    }

    const fromAcc = normalizeCashAccount(params.fromWallet);
    const toAcc = normalizeCashAccount(params.toAccount);

    if (fromAcc === toAcc) {
      throw new Error('Dompet platform asal dan rekening tujuan tidak boleh sama.');
    }

    const availableBalance =
      fromAcc === 'WALLET_GOFOOD'
        ? cashBalanceSummary.walletGofood
        : fromAcc === 'WALLET_GRABFOOD'
        ? cashBalanceSummary.walletGrabfood
        : cashBalanceSummary.walletShopeefood;

    const fromLabel = getCashAccountLabel(fromAcc);
    const toLabel = getCashAccountLabel(toAcc);

    if (cleanGross > availableBalance) {
      throw new Error(
        `Nominal pencairan (Rp ${cleanGross.toLocaleString('id-ID')}) melebihi saldo tersedia di ${fromLabel} (Rp ${availableBalance.toLocaleString('id-ID')}).`
      );
    }

    const netAmount = cleanGross - cleanFee;
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const settlementGroupId = `stl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const batch = writeBatch(db);

    // 1. Outflow of netAmount from platform wallet to destination bank/account
    const outRef = doc(collection(db, 'cash_mutations'));
    const outMut: CashMutation = {
      id: outRef.id,
      date: today,
      account: fromAcc,
      type: 'PENCAIRAN_PLATFORM',
      amount: netAmount,
      flow: 'OUT',
      referenceId: settlementGroupId,
      relatedAccount: toAcc,
      title: `Pencairan Settlement ${fromLabel} ke ${toLabel}`,
      notes:
        params.notes ||
        `Settlement ${fromLabel} → ${toLabel} (Dicairkan: Rp ${cleanGross.toLocaleString('id-ID')}${
          cleanFee > 0 ? `, Potongan: Rp ${cleanFee.toLocaleString('id-ID')}` : ''
        }, Cair Bersih: Rp ${netAmount.toLocaleString('id-ID')})`,
      createdBy: currentEmployee?.id || userProfile?.uid || 'user',
      createdByName: currentEmployee?.name || userProfile?.displayName || 'Owner/Admin',
      createdAt: now,
    };
    batch.set(outRef, sanitizeFirestore(outMut));

    // 2. Inflow of netAmount into destination bank/account
    const inRef = doc(collection(db, 'cash_mutations'));
    const inMut: CashMutation = {
      id: inRef.id,
      date: today,
      account: toAcc,
      type: 'PENCAIRAN_PLATFORM',
      amount: netAmount,
      flow: 'IN',
      referenceId: settlementGroupId,
      relatedAccount: fromAcc,
      title: `Dana Cair Settlement dari ${fromLabel}`,
      notes:
        params.notes ||
        `Terima pencairan saldo ${fromLabel} (Cair Bersih: Rp ${netAmount.toLocaleString('id-ID')})`,
      createdBy: currentEmployee?.id || userProfile?.uid || 'user',
      createdByName: currentEmployee?.name || userProfile?.displayName || 'Owner/Admin',
      createdAt: now,
    };
    batch.set(inRef, sanitizeFirestore(inMut));

    // 3. Optional platform settlement fee deduction on platform wallet
    if (cleanFee > 0) {
      const feeRef = doc(collection(db, 'cash_mutations'));
      const feeMut: CashMutation = {
        id: feeRef.id,
        date: today,
        account: fromAcc,
        type: 'PENCAIRAN_PLATFORM',
        amount: cleanFee,
        flow: 'OUT',
        referenceId: settlementGroupId,
        relatedAccount: toAcc,
        title: `Potongan Biaya Settlement ${fromLabel}`,
        notes: `Biaya potongan platform saat pencairan ke ${toLabel}${params.notes ? ` (${params.notes})` : ''}`,
        createdBy: currentEmployee?.id || userProfile?.uid || 'user',
        createdByName: currentEmployee?.name || userProfile?.displayName || 'Owner/Admin',
        createdAt: now,
      };
      batch.set(feeRef, sanitizeFirestore(feeMut));
    }

    // 4. Audit log
    const auditRef = doc(collection(db, 'audit_logs'));
    batch.set(
      auditRef,
      sanitizeFirestore({
        id: auditRef.id,
        action: 'PLATFORM_SETTLEMENT',
        details: `Settlement ${fromLabel} → ${toLabel}: Kotor Rp ${cleanGross.toLocaleString('id-ID')}, Potongan Rp ${cleanFee.toLocaleString('id-ID')}, Bersih Masuk Rp ${netAmount.toLocaleString('id-ID')}${params.notes ? ` (${params.notes})` : ''}`,
        userUid: currentEmployee?.id || userProfile?.uid || 'user',
        userName: currentEmployee?.name || userProfile?.displayName || 'User',
        createdAt: now,
      })
    );

    await batch.commit();
  };

  const addEmployee = async (
    employeeData: Partial<Employee> | string,
    position?: string,
    dailyWage?: number
  ): Promise<Employee> => {
    const empRef = doc(collection(db, 'employees'));
    const now = new Date().toISOString();
    const batch = writeBatch(db);

    let newEmp: Employee;
    let rawPin = '';

    if (typeof employeeData === 'string') {
      newEmp = {
        id: empRef.id,
        name: employeeData.trim(),
        position: position || 'Kasir',
        role: position?.toUpperCase().includes('KASIR') ? 'KASIR' : 'KARYAWAN',
        dailyWage: Math.max(0, dailyWage || 80000),
        active: true,
        hasPin: false,
        createdAt: now,
        updatedAt: now,
      };
    } else {
      rawPin = (employeeData.pin || '').trim();
      newEmp = {
        id: empRef.id,
        name: (employeeData.name || '').trim(),
        username: (employeeData.username || '').trim().toLowerCase() || undefined,
        hasPin: Boolean(rawPin),
        email: (employeeData.email || '').trim().toLowerCase() || undefined,
        role: employeeData.role || 'KARYAWAN',
        position: employeeData.position || (employeeData.role === 'KASIR' ? 'Kasir' : 'Karyawan'),
        phone: employeeData.phone || undefined,
        dailyWage: Math.max(0, typeof employeeData.dailyWage === 'number' ? employeeData.dailyWage : 80000),
        active: employeeData.active !== false,
        createdAt: now,
        updatedAt: now,
      };
    }

    // Simpan profil karyawan tanpa field PIN plaintext
    batch.set(empRef, sanitizeFirestore(newEmp));

    // Jika PIN diisi, simpan kredensial Hash + Salt di koleksi /staff/{id} (tidak bisa dibaca KASIR)
    if (rawPin) {
      const { pinHash, pinSalt } = await createHashedPinCredentials(rawPin);
      const staffDoc: Staff = {
        id: empRef.id,
        employeeId: empRef.id,
        username: newEmp.username || empRef.id,
        name: newEmp.name,
        pinHash,
        pinSalt,
        role: newEmp.role,
        active: newEmp.active,
        createdAt: now,
        updatedAt: now,
      };
      batch.set(doc(db, 'staff', empRef.id), sanitizeFirestore(staffDoc));
    }

    await batch.commit();
    return newEmp;
  };

  const updateEmployee = async (id: string, data: Partial<Employee>) => {
    const empRef = doc(db, 'employees', id);
    const now = new Date().toISOString();
    const batch = writeBatch(db);

    const rawPin = (data.pin || '').trim();
    const { pin: _ignoredPlaintextPin, pinHash: _ignoredHash, pinSalt: _ignoredSalt, ...safeData } = data;

    const updateData: Record<string, unknown> = {
      ...safeData,
      ...(typeof safeData.dailyWage === 'number'
        ? { dailyWage: Math.max(0, safeData.dailyWage) }
        : {}),
      ...(rawPin ? { hasPin: true, pin: deleteField(), pinHash: deleteField(), pinSalt: deleteField() } : {}),
      updatedAt: now,
    };

    batch.update(empRef, sanitizeFirestore(updateData));

    // Jika ada pembaruan PIN atau perubahan atribut staf, sinkronkan ke /staff/{id} secara atomik
    const existingEmp = employees.find(e => e.id === id);
    if (rawPin) {
      const { pinHash, pinSalt } = await createHashedPinCredentials(rawPin);
      batch.set(
        doc(db, 'staff', id),
        sanitizeFirestore({
          id,
          employeeId: id,
          username: safeData.username || existingEmp?.username || id,
          name: safeData.name || existingEmp?.name || 'Staf',
          pinHash,
          pinSalt,
          role: safeData.role || existingEmp?.role || 'KASIR',
          active: safeData.active !== undefined ? safeData.active : existingEmp?.active !== false,
          createdAt: existingEmp?.createdAt || now,
          updatedAt: now,
        }),
        { merge: true }
      );
    }

    await batch.commit();
  };

  const toggleEmployeeStatus = async (id: string, active: boolean) => {
    const now = new Date().toISOString();
    const batch = writeBatch(db);

    batch.update(doc(db, 'employees', id), {
      active,
      updatedAt: now,
    });

    if (!active) {
      batch.set(
        doc(db, 'system_locks', 'active_cashier'),
        sanitizeFirestore({
          isActive: false,
          employeeId: null,
          employeeName: null,
          username: null,
          logoutAt: now,
        })
      );
    }

    await batch.commit();
  };

  const deleteEmployee = async (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (emp && (emp.role === 'OWNER' || emp.username === 'owner')) {
      throw new Error('Akun Owner utama tidak dapat dihapus.');
    }
    await updateDoc(doc(db, 'employees', id), {
      active: false,
      updatedAt: new Date().toISOString(),
    });
  };

  const recordAttendance = async (
    employeeId: string,
    employeeName: string,
    status: Attendance['status'],
    overtimeHours = 0,
    notes?: string
  ) => {
    const emp = employees.find(e => e.id === employeeId);
    // OWNER does not have attendance
    if (emp?.role === 'OWNER' || employeeId === 'emp_owner_1') {
      return;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();
    const dailyWage = emp ? emp.dailyWage || 80000 : 80000;
    let wagePaid = 0;

    if (status === 'HADIR' || status === 'PRESENT') {
      wagePaid = dailyWage;
    } else if (status === 'OVERTIME' || status === 'LEMBUR') {
      const hourlyRate = dailyWage / 8;
      wagePaid = dailyWage + overtimeHours * (hourlyRate * 1.5);
    }

    const cleanWage = Math.round(wagePaid);
    const existingAtt = attendance.find(a => a.employeeId === employeeId && a.date === todayDate);
    const targetAttId = existingAtt ? existingAtt.id : doc(collection(db, 'attendance')).id;
    const actorId = currentEmployee?.id || userProfile?.uid || 'user';
    const actorName = currentEmployee?.name || userProfile?.displayName || 'User';

    const batch = writeBatch(db);

    // 1. Simpan/Update Dokumen Attendance
    if (existingAtt) {
      batch.update(doc(db, 'attendance', existingAtt.id), sanitizeFirestore({
        status,
        overtimeHours,
        wagePaid: cleanWage,
        wageAmount: dailyWage,
        notes: notes || existingAtt.notes || '',
        updatedAt: nowIso,
      }));
    } else {
      const att: Attendance = {
        id: targetAttId,
        employeeId,
        employeeName,
        userUid: emp?.uid || employeeId,
        date: todayDate,
        checkInAt: nowIso,
        status,
        overtimeHours,
        wagePaid: cleanWage,
        wageAmount: dailyWage,
        notes: notes || '',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      batch.set(doc(db, 'attendance', targetAttId), sanitizeFirestore(att));
    }

    // 2. Tahap 7: Otomatis buat / sinkronkan expense kategori 'gaji' (referenceId = attendanceId, cegah dobel)
    const existingWageExp = expenses.find(
      e => e.referenceId === targetAttId && e.category === 'gaji' && e.status !== 'VOID'
    );

    if (cleanWage > 0) {
      if (existingWageExp) {
        // Perbarui nominal pengeluaran jika gaji berubah (mis. tambah jam lembur)
        const expRef = doc(db, 'expenses', existingWageExp.id);
        batch.update(expRef, sanitizeFirestore({
          amount: cleanWage,
          note: `Gaji harian presensi ${employeeName} (${status}${overtimeHours > 0 ? ` +${overtimeHours} jam` : ''})`,
          updatedAt: nowIso,
        }));
      } else {
        // Buat dokumen pengeluaran baru secara atomik
        const expRef = doc(collection(db, 'expenses'));
        const newExpense: Expense = {
          id: expRef.id,
          date: todayDate,
          category: 'gaji',
          amount: cleanWage,
          paymentSource: 'KAS_KASIR',
          note: `Gaji harian presensi ${employeeName} (${status}${overtimeHours > 0 ? ` +${overtimeHours} jam` : ''})`,
          referenceId: targetAttId,
          status: 'COMPLETED',
          createdBy: actorId,
          createdByName: actorName,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        batch.set(expRef, sanitizeFirestore(newExpense));
      }
    } else if (existingWageExp) {
      // Jika status presensi diubah menjadi Izin/Sakit/Alpha (upah = 0), VOID beban gaji lama
      const expRef = doc(db, 'expenses', existingWageExp.id);
      batch.update(expRef, sanitizeFirestore({
        status: 'VOID',
        voidReason: `Status presensi ${employeeName} diubah menjadi ${status}`,
        voidedAt: nowIso,
        voidedBy: actorId,
        voidedByName: actorName,
        updatedAt: nowIso,
      }));
    }

    // 3. Catat audit log secara atomik
    const auditRef = doc(collection(db, 'audit_logs'));
    batch.set(
      auditRef,
      sanitizeFirestore({
        id: auditRef.id,
        action: 'ATTENDANCE_RECORDED',
        details: `Presensi [${employeeName}]: ${status} (Upah: Rp ${cleanWage.toLocaleString('id-ID')})`,
        userUid: actorId,
        userName: actorName,
        createdAt: nowIso,
      })
    );

    await batch.commit();
  };

  const addStaff = async (username: string, name: string, pin: string, role: UserRole) => {
    await addEmployee({
      name,
      username,
      pin,
      role,
      position: role === 'KASIR' ? 'Kasir' : role === 'ADMIN' ? 'Admin' : 'Staf',
      active: true,
    });
  };

  const toggleStaffStatus = async (id: string, active: boolean) => {
    await toggleEmployeeStatus(id, active);
  };

  const openShift = async (
    staffId: string,
    staffName: string,
    openingCash: number,
    openingDetails?: {
      openingCashExpected?: number;
      openingCashActual?: number;
      openingCashVariance?: number;
      openingCashConfirmed?: boolean;
      openingDenominations?: Record<string, number>;
    }
  ) => {
    const shiftRef = doc(collection(db, 'shifts'));
    const openedAt = new Date().toISOString();

    const shift: Shift = {
      id: shiftRef.id,
      staffId,
      staffName,
      openedAt,
      openingCash,
      openingCashExpected: openingDetails?.openingCashExpected ?? openingCash,
      openingCashActual: openingDetails?.openingCashActual ?? openingCash,
      openingCashVariance: openingDetails?.openingCashVariance ?? 0,
      openingCashConfirmed: openingDetails?.openingCashConfirmed ?? true,
      openingDenominations: openingDetails?.openingDenominations,
      status: 'OPEN',
    };

    await setDoc(shiftRef, sanitizeFirestore(shift));
    setShifts(prev => deduplicate([shift, ...prev]));

    if (openingCash > 0) {
      await addCashMutation({
        account: 'KAS_KASIR',
        type: 'MODAL_AWAL',
        amount: openingCash,
        flow: 'IN',
        title: `Modal Awal Shift - ${staffName}`,
        notes: `Pembukaan shift ${staffName} (Fisik: Rp ${shift.openingCashActual?.toLocaleString('id-ID')}, Selisih Awal: Rp ${shift.openingCashVariance?.toLocaleString('id-ID')})`,
        referenceId: shiftRef.id,
      });
    }

    // Tahap 8: jika openingCashVariance != 0, buat mutasi PENYESUAIAN agar selisih tercatat
    const openVariance = shift.openingCashVariance ?? 0;
    if (openVariance !== 0) {
      await addCashMutation({
        account: 'KAS_KASIR',
        type: 'PENYESUAIAN',
        amount: Math.abs(openVariance),
        flow: openVariance > 0 ? 'IN' : 'OUT',
        title: `Selisih Modal Awal Shift - ${staffName}`,
        notes: `Selisih modal awal buka shift (${
          openVariance > 0 ? 'Kelebihan fisik' : 'Kekurangan fisik'
        } Rp ${Math.abs(openVariance).toLocaleString('id-ID')}. Fisik: Rp ${shift.openingCashActual?.toLocaleString('id-ID')}, Seharusnya: Rp ${shift.openingCashExpected?.toLocaleString('id-ID')})`,
        referenceId: shiftRef.id,
      });
    }

    const auditRef = doc(collection(db, 'audit_logs'));
    await setDoc(auditRef, sanitizeFirestore({
      id: auditRef.id,
      action: 'SHIFT_OPEN',
      details: `Shift dibuka untuk ${staffName} dengan modal awal Rp ${openingCash.toLocaleString('id-ID')} (Seharusnya: Rp ${shift.openingCashExpected?.toLocaleString('id-ID')}, Selisih: Rp ${shift.openingCashVariance?.toLocaleString('id-ID')})`,
      userUid: staffId,
      userName: staffName,
      createdAt: openedAt,
    }));
  };

  const closeShift = async (
    shiftId: string,
    actualCash: number,
    notes = '',
    closingDetails?: {
      expectedCash?: number;
      cashDifference?: number;
      closingDenominations?: Record<string, number>;
    }
  ) => {
    if (typeof actualCash !== 'number' || Number.isNaN(actualCash)) {
      throw new Error('Jumlah uang fisik belum dihitung.');
    }

    const shiftRef = doc(db, 'shifts', shiftId);
    const shiftDoc = shifts.find(s => s.id === shiftId);
    if (!shiftDoc) throw new Error('Shift tidak ditemukan');

    const closedAt = new Date().toISOString();

    const metrics = calculateShiftCashMetrics({
      activeShift: shiftDoc,
      sales,
      expenses,
      cashMutations,
      endIso: closedAt,
    });

    // Tahap 8: Hitung ulang expectedCash dan cashDifference dari calculateShiftCashMetrics.
    // Abaikan nilai dari UI (UI hanya boleh mengirim actualCash dan denominasi).
    const expectedCash = metrics.expectedCash;
    const cashDifference = actualCash - expectedCash;

    const closedShift: Shift = {
      ...shiftDoc,
      closedAt,
      expectedCash,
      actualCash,
      cashDifference,
      closingDenominations: closingDetails?.closingDenominations,
      totalSalesCash: metrics.cashSales,
      totalSalesQris: metrics.qrisSales,
      totalSalesTransfer: metrics.transferSales,
      totalSalesBca: metrics.bcaSales,
      totalSalesJago: metrics.jagoSales,
      totalSalesMandiri: metrics.mandiriSales,
      totalExpensesCash: metrics.cashExpenses,
      totalOwnerWithdrawals: metrics.ownerWithdrawals,
      status: 'CLOSED',
      notes,
      closedBy: currentEmployee?.id || userProfile?.uid || 'user',
      closedByName: currentEmployee?.name || userProfile?.displayName || 'Kasir',
    };

    await setDoc(shiftRef, sanitizeFirestore(closedShift));

    // Also close any duplicate/orphan OPEN shifts belonging to the same staffId so no stale OPEN shifts remain
    const otherOpenShifts = shifts.filter(
      s => s.id !== shiftId && s.status === 'OPEN' && s.staffId === shiftDoc.staffId
    );
    for (const orphan of otherOpenShifts) {
      try {
        await updateDoc(doc(db, 'shifts', orphan.id), {
          status: 'CLOSED',
          closedAt,
          notes: 'Ditutup otomatis bersamaan dengan penutupan shift utama',
        });
      } catch {
        // ignore
      }
    }

    // Release active_cashier lock in Firestore when shift is closed
    try {
      await setDoc(
        doc(db, 'system_locks', 'active_cashier'),
        sanitizeFirestore({
          isActive: false,
          employeeId: null,
          employeeName: null,
          username: null,
          deviceId: null,
          logoutAt: closedAt,
        })
      );
    } catch {
      // ignore
    }

    // Update local state immediately so status is CLOSED right away
    setShifts(prev =>
      prev.map(s =>
        s.id === shiftId
          ? closedShift
          : s.status === 'OPEN' && s.staffId === shiftDoc.staffId
          ? { ...s, status: 'CLOSED', closedAt }
          : s
      )
    );

    if (cashDifference !== 0) {
      await addCashMutation({
        account: 'KAS_KASIR',
        type: 'PENYESUAIAN',
        amount: Math.abs(cashDifference),
        flow: cashDifference > 0 ? 'IN' : 'OUT',
        title: `Selisih Kas Shift - ${shiftDoc.staffName}`,
        notes: `Selisih kas tutup shift (${cashDifference > 0 ? 'Kelebihan' : 'Kekurangan'}). Catatan: ${notes}`,
        referenceId: shiftId,
      });
    }

    const auditRef = doc(collection(db, 'audit_logs'));
    await setDoc(
      auditRef,
      sanitizeFirestore({
        id: auditRef.id,
        action: 'SHIFT_CLOSE',
        details: `Shift ditutup untuk ${shiftDoc.staffName}. Fisik: Rp ${actualCash.toLocaleString('id-ID')} (Sistem: Rp ${expectedCash.toLocaleString('id-ID')}, Selisih: Rp ${cashDifference.toLocaleString('id-ID')})`,
        userUid: currentEmployee?.id || userProfile?.uid || 'user',
        userName: currentEmployee?.name || userProfile?.displayName || 'User',
        createdAt: closedAt,
      })
    );
  };

  // Komposisi Menu POS / Formula Functions
  const addAssembly = async (
    data: Omit<Assembly, 'id' | 'createdAt'>
  ): Promise<Assembly> => {
    const docRef = doc(collection(db, 'assemblies'));
    const now = new Date().toISOString();
    const newAssembly: Assembly = {
      ...data,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(docRef, sanitizeFirestore(newAssembly));

    if (data.productId) {
      const targetProd = productsMap.get(data.productId);
      if (targetProd) {
        await updateDoc(doc(db, 'products', data.productId), sanitizeFirestore({
          costPerUnit: data.hppPerUnit || targetProd.costPerUnit,
          stockSource: 'COMPOSITION',
          compositionId: docRef.id,
          assemblyId: docRef.id,
          compositionItems: data.components || [],
          updatedAt: now,
        }));
      }
    }

    return newAssembly;
  };

  const updateAssembly = async (
    id: string,
    data: Partial<Assembly>
  ): Promise<void> => {
    const now = new Date().toISOString();
    const asmRef = doc(db, 'assemblies', id);
    await updateDoc(asmRef, sanitizeFirestore({
      ...data,
      updatedAt: now,
    }));

    if (data.productId || data.hppPerUnit !== undefined || data.components !== undefined) {
      const asm = assembliesMap.get(id);
      const prodId = data.productId || asm?.productId;
      if (prodId) {
        const targetProd = productsMap.get(prodId);
        if (targetProd) {
          await updateDoc(doc(db, 'products', prodId), sanitizeFirestore({
            costPerUnit: data.hppPerUnit !== undefined ? data.hppPerUnit : targetProd.costPerUnit,
            stockSource: 'COMPOSITION',
            compositionId: id,
            assemblyId: id,
            ...(data.components ? { compositionItems: data.components } : {}),
            updatedAt: now,
          }));
        }
      }
    }
  };

  const deleteAssembly = async (id: string): Promise<void> => {
    const asm = assembliesMap.get(id);
    await deleteDoc(doc(db, 'assemblies', id));

    if (asm?.productId) {
      const targetProd = productsMap.get(asm.productId);
      if (targetProd && (targetProd.stockSource === 'COMPOSITION' || targetProd.stockSource === 'ASSEMBLY')) {
        await updateDoc(doc(db, 'products', asm.productId), sanitizeFirestore({
          stockSource: 'NONE',
          compositionId: '',
          assemblyId: '',
          compositionItems: [],
          updatedAt: new Date().toISOString(),
        }));
      }
    }
  };

  const saveProductComposition = async (
    productId: string,
    components: AssemblyItem[],
    resultUnit = 'porsi',
    notes = ''
  ): Promise<void> => {
    const targetProd = productsMap.get(productId);
    if (!targetProd) throw new Error('Menu POS tidak ditemukan');
    const existingAsm = assembliesMap.get(productId) || (targetProd.compositionId ? assembliesMap.get(targetProd.compositionId) : undefined);
    
    let totalHpp = 0;
    const cleanComponents: AssemblyItem[] = components.map(c => {
      let cost = c.costPerUnit || 0;
      let name = c.sourceName;
      if (c.sourceType === 'PRODUCT') {
        const p = productsMap.get(c.sourceId);
        if (p) {
          name = p.name;
          cost = getProductRecipeHpp(p.id, productsMap, recipesMap, ingredientsMap);
        }
      } else {
        const ing = ingredientsMap.get(c.sourceId);
        if (ing) {
          name = ing.name;
          cost = ing.costPerUnit || cost;
        }
      }
      totalHpp += (c.quantity || 1) * cost;
      return {
        sourceType: c.sourceType,
        sourceId: c.sourceId,
        sourceName: name,
        quantity: c.quantity || 1,
        unit: c.unit || 'pcs',
        costPerUnit: Math.round(cost),
        subtotalCost: Math.round((c.quantity || 1) * cost),
      };
    });

    const now = new Date().toISOString();
    const asmId = existingAsm?.id || `asm_${productId}`;

    const asmDoc: Assembly = {
      id: asmId,
      name: `Komposisi ${targetProd.name}`,
      productId: targetProd.id,
      productName: targetProd.name,
      resultUnit,
      components: cleanComponents,
      hppPerUnit: Math.round(totalHpp),
      active: true,
      notes,
      createdAt: existingAsm?.createdAt || now,
      updatedAt: now,
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'assemblies', asmId), sanitizeFirestore(asmDoc));
    batch.update(doc(db, 'products', productId), sanitizeFirestore({
      costPerUnit: Math.round(totalHpp),
      stockSource: 'COMPOSITION',
      stockTracked: false,
      isProduction: false,
      compositionId: asmId,
      assemblyId: asmId,
      compositionItems: cleanComponents,
      packageItems: [],
      updatedAt: now,
    }));

    await batch.commit();
  };

  const deleteProductComposition = async (productId: string): Promise<void> => {
    const targetProd = productsMap.get(productId);
    if (!targetProd) return;
    const asm = assembliesMap.get(productId) || (targetProd.compositionId ? assembliesMap.get(targetProd.compositionId) : undefined);
    
    const batch = writeBatch(db);
    if (asm) {
      batch.delete(doc(db, 'assemblies', asm.id));
    }
    batch.update(doc(db, 'products', productId), sanitizeFirestore({
      stockSource: 'NONE',
      compositionId: '',
      assemblyId: '',
      compositionItems: [],
      updatedAt: new Date().toISOString(),
    }));
    await batch.commit();
  };

  const executeAssembly = async (
    assemblyId: string,
    quantityToAssemble: number,
    notes?: string
  ): Promise<void> => {
    throw new Error(
      'Eksekusi Perakitan tidak lagi digunakan. Menu POS tidak memiliki stok fisik sendiri. Stok komponen produk/bahan terpotong secara otomatis saat penjualan di Kasir POS.'
    );
  };

  return (
    <AppContext.Provider
      value={{
        categories,
        ingredientCategories,
        ingredients,
        ingredientsMap,
        products,
        productsMap,
        recipes,
        recipesMap,
        assemblies,
        assembliesMap,
        sales,
        stockMovements,
        stockProductions,
        productions,
        purchases,
        vendors,
        expenses,
        cashMutations,
        cashBalanceSummary,
        employees,
        attendance,
        auditLogs,
        staff,
        shifts,
        shiftsLoaded,
        cart,
        selectedOrderType,
        setSelectedOrderType,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        updateCartItemPrice,
        clearCart,
        cartGrossTotal,
        cartItemDiscountTotal,
        cartTotal,
        cartCount,
        platformFeeSettings,
        savePlatformFeeSetting,
        addPlatformFeeSetting,
        deletePlatformFeeSetting,
        platformFeeConfigs,
        savePlatformFeeConfig,
        updateProductChannelPricing,
        taxSettings,
        updateTaxSettings,
        completeTransaction,
        voidTransaction,
        submitChickenProduction,
        cancelChickenProduction: cancelChickenProductionHandler,
        submitGeneralProduction,
        cancelGeneralProduction: cancelGeneralProductionHandler,
        submitStockOpname,
        submitProductStockOpname,
        submitPurchase,
        createPurchase,
        updatePurchase,
        deletePurchase,
        addPurchasePayment,
        deletePurchasePayment,
        payPurchaseDebt,
        voidPurchase,
        addVendor,
        updateVendor,
        deleteVendor,
        updateProductPrice,
        addProduct,
        updateProduct,
        deleteProduct,
        addProductCategory,
        saveRecipe,
        addIngredient,
        updateIngredient,
        deleteIngredient,
        addIngredientCategory,
        updateIngredientCategory,
        deleteIngredientCategory,
        addExpense,
        updateExpense,
        deleteExpense,
        addCashMutation,
        transferCashAccount,
        settlePlatformWallet,
        addEmployee,
        updateEmployee,
        toggleEmployeeStatus,
        deleteEmployee,
        recordAttendance,
        addStaff,
        toggleStaffStatus,
        openShift,
        closeShift,
        addAssembly,
        updateAssembly,
        deleteAssembly,
        saveProductComposition,
        deleteProductComposition,
        executeAssembly,
        resetAllData,
        seedInitialData,
        isSeeding,
        syncState,
        isOnline,
        darkMode,
        toggleDarkMode,
        posLayoutMode,
        setPosLayoutMode,
        posVisualMode,
        setPosVisualMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
