export type UserRole = 'OWNER' | 'ADMIN' | 'KASIR' | 'KARYAWAN';

export interface UserProfile {
  uid: string;
  employeeId?: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type IngredientType = 'RAW' | 'PREPARED' | 'PACKAGING' | 'OTHER' | string;

export interface IngredientCategory {
  id: string;
  name: string;
  description?: string;
  displayOrder?: number;
  isSystem?: boolean;
  createdAt?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  code?: string;
  unit: string; // e.g., 'kg', 'pcs', 'porsi', 'gelas' (acts as stockUnit)
  stockUnit?: string; // Internal stock unit (e.g. 'pcs', 'gram', 'ml')
  purchaseUnit?: string; // Purchase unit (e.g. 'pack', 'dus', 'kg', 'liter')
  conversionFactor?: number; // 1 purchaseUnit = N stockUnit (e.g. 1 pack = 100 pcs -> 100)
  purchasePrice?: number; // Harga per purchaseUnit (e.g. Rp 10.000 / pack)
  stock: number; // Stored in stockUnit
  minimumStock: number; // In stockUnit
  criticalStock: number; // In stockUnit
  costPerUnit: number; // HPP per stockUnit (e.g. Rp 100 / pcs or Rp 38 / gram)
  type: IngredientType;
  categoryId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  displayOrder: number;
}

export interface RecipeItem {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  costPerUnit?: number;
}

export interface OverheadItem {
  name: string; // e.g. "Gas LPG", "Listrik & Air", "Biaya Kemasan Tambahan"
  cost: number; // nominal Rp per cup/porsi
}

export interface Recipe {
  id: string;
  productId: string;
  productName: string;
  items: RecipeItem[]; // All per-portion items that deduct stock at POS
  totalHpp: number;
  recipeMode?: 'PORTION' | 'BATCH';
  yieldQty?: number; // e.g. 25 cup
  yieldUnit?: string; // e.g. 'cup', 'pcs', 'porsi'
  batchItems?: RecipeItem[]; // original batch quantities (Gula 0.5kg, Teh 7pcs)
  portionItems?: RecipeItem[]; // per-cup standalone items (Cup Plastik 1pcs, Seal Cup 1pcs, Sedotan 1pcs)
  overheadCostPerUnit?: number; // Total overhead per cup/porsi (Gas, Listrik, Air)
  overheadItems?: OverheadItem[]; // Breakdown of overhead costs
  overheadNotes?: string;
  patokanIngredientId?: string;
  patokanIngredientName?: string;
  updatedAt: string;
}

export type ProductType = 'SINGLE' | 'PACKAGE';
export type StockSource = 'PRODUCTION' | 'ASSEMBLY' | 'COMPOSITION' | 'READY_TO_SELL' | 'NONE';

export interface PackageItem {
  productId: string;
  productName?: string;
  quantity: number;
}

export interface AssemblyItem {
  sourceType: 'PRODUCT' | 'INGREDIENT';
  sourceId: string;
  sourceName: string;
  quantity: number;
  unit: string;
  costPerUnit?: number;
  subtotalCost?: number;
}

export interface Assembly {
  id: string;
  name: string;
  productId: string; // Target menu ID in Product
  targetProductId?: string;
  productName?: string;
  resultUnit: string; // e.g. 'porsi', 'pcs', 'cup', 'gelas', 'botol', 'box', 'pack'
  components: AssemblyItem[];
  hppPerUnit: number;
  active: boolean;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// Aliases for Menu Composition
export type MenuCompositionItem = AssemblyItem;
export type MenuComposition = Assembly;

export interface ChannelPriceConfig {
  channelOriginalPrice: number; // Harga normal pada channel tersebut
  channelPrice: number; // Harga jual / harga promo pada channel tersebut
  isActive?: boolean; // Apakah konfigurasi khusus channel ini aktif
}

export type ProductChannelPricing = Partial<
  Record<'OFFLINE' | 'GOFOOD' | 'GRABFOOD' | 'SHOPEEFOOD', ChannelPriceConfig>
>;

export interface Product {
  id: string;
  name: string;
  sku?: string;
  categoryId: string;
  category?: string;
  originalPrice?: number; // Harga normal sebelum promo (Harga Coret default / legacy)
  sellingPrice: number; // basePrice (Harga dasar utama produk)
  channelPricing?: ProductChannelPricing; // Konfigurasi harga & harga coret per channel (OFFLINE, GOFOOD, GRABFOOD, SHOPEEFOOD)
  active: boolean;
  image?: string;
  recipeId?: string;
  assemblyId?: string;
  compositionId?: string;
  compositionItems?: MenuCompositionItem[];
  stockTracked: boolean;
  stock?: number; // Finished goods stock (Stok Produk Jadi) / Barang Siap Jual stock in stockUnit
  stockUnit?: string; // Internal stock unit (e.g., 'botol', 'pcs', 'porsi', 'gelas')
  purchaseUnit?: string; // Purchase unit for READY_TO_SELL (e.g., 'dus', 'pack', 'karton')
  conversionFactor?: number; // 1 purchaseUnit = N stockUnit (e.g. 1 dus = 24 botol -> 24)
  purchasePrice?: number; // Price per purchaseUnit (e.g. Rp 60.000 / dus)
  minStock?: number;
  criticalStock?: number;
  costPerUnit?: number; // HPP modal per stockUnit untuk produk retail tanpa resep
  isProduction?: boolean; // Whether product is produced via recipes
  productType?: ProductType; // 'SINGLE' or 'PACKAGE'
  stockSource?: StockSource; // 'PRODUCTION', 'ASSEMBLY', 'COMPOSITION', 'READY_TO_SELL', or 'NONE'
  packageItems?: PackageItem[]; // Component SINGLE products for PACKAGE menu items
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type MovementType = 'PURCHASE' | 'PRODUCTION' | 'SALE' | 'ADJUSTMENT' | 'WASTE' | 'RETURN';

export interface StockMovement {
  id: string;
  entityType?: 'INGREDIENT' | 'PRODUCT'; // Ledger entity type
  movementCategory?: 'BAHAN_BAKU' | 'BARANG_SIAP_JUAL' | 'KEMASAN' | 'PRODUK_JADI';
  entityId?: string;
  entityName?: string;
  ingredientId?: string; // Backwards compatibility with old records
  ingredientName?: string; // Backwards compatibility with old records
  productId?: string;
  productName?: string;
  type: MovementType;
  changeAmount: number; // positive for addition (+), negative for deduction (-)
  balanceAfter: number;
  unit?: string; // Internal stock unit or display unit
  stockUnit?: string;
  purchaseUnit?: string;
  purchaseQuantity?: number;
  conversionFactor?: number;
  referenceId?: string; // transactionNo or purchaseId or productionId
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface ProductionItem {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
  type: 'RAW' | 'PACKAGING' | string;
}

export interface Production {
  id: string;
  date: string;
  productId: string;
  productName: string;
  recipeId: string;
  batchQty: number; // e.g. 1, 2, 3 batches
  yieldQty: number; // yield per batch (e.g. 20 cup)
  yieldUnit?: string; // e.g. 'cup', 'pcs', 'porsi'
  totalProduced: number; // batchQty * yieldQty (e.g. 60 cup)
  totalHpp: number; // total cost for all batches
  hppPerUnit: number; // totalHpp / totalProduced
  items: ProductionItem[]; // snapshot of raw & packaging used
  itemsConsumed?: ProductionItem[]; // snapshot compatibility
  overheadItems?: OverheadItem[];
  totalOverheadCost?: number;
  notes?: string;
  status?: 'COMPLETED' | 'CANCELLED';
  cancelledAt?: string;
  cancelledBy?: string;
  cancelledByName?: string;
  cancelReason?: string;
  createdBy: string;
  userName?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface StockProduction {
  id: string;
  date: string;
  rawIngredientId: string;
  rawIngredientName: string;
  rawQuantity: number; // in kg
  preparedIngredientId: string;
  preparedIngredientName: string;
  preparedQuantity: number; // in pcs
  yieldRatio: number; // e.g. 157 / 20 = 7.85 pcs/kg
  notes?: string;
  status?: 'COMPLETED' | 'CANCELLED';
  cancelledAt?: string;
  cancelledBy?: string;
  cancelledByName?: string;
  cancelReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  address?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type PaymentStatus = 'LUNAS' | 'SEBAGIAN' | 'BELUM_DIBAYAR' | 'VOID';

export interface PurchaseItem {
  id?: string;
  entityType: 'INGREDIENT' | 'PRODUCT';
  targetId: string;
  targetName: string;
  description?: string;
  itemType: 'BAHAN_BAKU' | 'KEMASAN' | 'BARANG_SIAP_JUAL';
  quantity: number; // Purchase quantity in purchaseUnit (e.g., 2)
  unit: string; // Purchase unit name (e.g. 'pack', 'dus', 'kg')
  purchaseUnit?: string; // Explicit purchase unit name
  costPerUnit: number; // Price per purchaseUnit (e.g. Rp 10.000 / pack)
  costPerPurchaseUnit?: number;
  conversionFactor?: number; // 1 purchaseUnit = N stockUnit (e.g., 100)
  stockUnit?: string; // Internal stock unit (e.g. 'pcs', 'gram')
  stockQuantityAdded?: number; // quantity * conversionFactor (e.g., 200 pcs)
  costPerStockUnit?: number; // costPerUnit / conversionFactor (e.g. Rp 100 / pcs)
  discount?: number;
  tax?: number;
  subtotal: number;
  total?: number;
}

export interface PurchasePayment {
  id: string;
  purchaseId: string;
  paymentNo?: string;
  date: string;
  amount: number;
  sourceAccount: string; // e.g. 'KAS_KASIR', 'KAS_OWNER', 'BANK_BCA', etc.
  reference?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Purchase {
  id: string;
  purchaseNo: string; // e.g. PB-00001 or PO-20260924-0001
  date: string;
  dueDate?: string;
  vendorId?: string;
  vendorName: string;
  invoiceNo?: string;
  reference?: string;

  // Legacy single-item compatibility
  supplier?: string;
  ingredientId?: string;
  ingredientName?: string;
  purchaseType?: 'BAHAN_BAKU' | 'BARANG_SIAP_JUAL' | 'KEMASAN';
  entityType?: 'INGREDIENT' | 'PRODUCT';
  targetId?: string;
  targetName?: string;
  quantity?: number;
  costPerUnit?: number;
  totalCost?: number;

  // Multi-item details
  items: PurchaseItem[];

  // Financial tracking
  subtotal?: number;
  discount?: number;
  tax?: number;
  shippingCost?: number;
  transactionCost?: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus;
  paymentSource?: string;
  payments?: PurchasePayment[];

  status?: 'COMPLETED' | 'VOID';
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidedByName?: string;

  notes?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;

  // Offline-First Sync Metadata
  isOfflineSync?: boolean;
  syncStatus?: 'SYNCHRONIZED' | 'PENDING' | 'SYNCING' | 'ERROR';
  offlineSyncError?: string;
  offlineCreatedAt?: string;
  syncedAt?: string;
}

export type PurchaseSyncStatus = 'SYNCHRONIZED' | 'PENDING' | 'SYNCING' | 'ERROR';

export type OrderType = 'OFFLINE' | 'GOFOOD' | 'GRABFOOD' | 'SHOPEEFOOD';

export type PlatformFeeType = 'percentage' | 'fixed';

export interface PlatformFeeConfig {
  platform: OrderType;
  enabled: boolean;
  feeType: PlatformFeeType;
  feeValue: number;
  defaultPaymentMethod?: PaymentMethod;
  updatedAt?: string;
}

export interface PlatformFeeSetting {
  id: string; // e.g. 'GOFOOD', 'GRABFOOD', 'SHOPEEFOOD', or custom ID
  platform: string; // 'GOFOOD' | 'GRABFOOD' | 'SHOPEEFOOD' | string
  platformName: string; // e.g. 'GoFood', 'GrabFood', 'ShopeeFood'
  percentageFee: number; // e.g. 20 (%)
  fixedFee: number; // e.g. 1000 (Rp)
  shippingDiscount: number; // e.g. 1000 (Rp)
  active: boolean; // Status Aktif
  notes?: string;
  updatedAt?: string;
}

export type PlatformFeeSettingsRecord = Record<string, PlatformFeeSetting>;

export interface PlatformTransactionSnapshot {
  platform: string; // 'GOFOOD' | 'GRABFOOD' | 'SHOPEEFOOD' | string
  platformName?: string;
  grossAmount: number; // Total Belanja Produk
  discountAmount: number; // Total Diskon Pelanggan
  netOrderAmount: number; // Nilai Setelah Diskon (grossAmount - discountAmount)
  platformFeePercentage: number; // Persentase Biaya Admin (e.g. 20)
  platformFeeAmount: number; // Nilai Biaya Admin Persentase
  platformFixedFee: number; // Biaya Admin Tetap
  shippingDiscount: number; // Diskon / Potongan Ongkir dari Merchant
  totalPlatformFee: number; // Total Potongan Platform (platformFeeAmount + platformFixedFee + shippingDiscount)
  walletAmount: number; // Dana Bersih yang masuk ke Platform Wallet (netOrderAmount - totalPlatformFee)
}

export interface CartItem {
  product: Product;
  quantity: number;
  originalPrice?: number;
  sellingPrice?: number;
  itemDiscount?: number;
  subtotal: number;
  recipe?: Recipe;
  maxAvailable: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  originalPrice?: number;
  sellingPrice: number;
  itemDiscount?: number;
  subtotal: number;
  recipeId?: string;
  hppPerItem?: number;
}

export type PaymentMethod =
  | 'CASH'
  | 'Tunai'
  | 'QRIS'
  | 'BCA'
  | 'JAGO'
  | 'MANDIRI'
  | 'Transfer'
  | 'Lainnya';
export type SaleStatus = 'COMPLETED' | 'VOID';

export interface CompleteTransactionOptions {
  orderType?: OrderType;
  subtotal?: number;
  itemDiscountTotal?: number;
  orderDiscount?: number;
  foodTotal?: number;
  shippingFee?: number;
  shippingDiscount?: number;
  customerShippingPaid?: number;
  platformServiceFee?: number;
  netSettlementAmount?: number;
  allowNegativeSettlement?: boolean;
  notes?: string;
}

export interface Sale {
  id: string;
  transactionNo: string;
  date: string;
  orderType?: OrderType;
  items: SaleItem[];
  subtotal?: number;
  itemDiscountTotal?: number;
  orderDiscount?: number;
  foodTotal?: number;
  shippingFee?: number;
  shippingDiscount?: number;
  customerShippingPaid?: number;
  platformServiceFee?: number;
  netSettlementAmount?: number;
  // Platform Fee Snapshot
  platformSnapshot?: PlatformTransactionSnapshot;
  grossAmount?: number;
  discountAmount?: number;
  netOrderAmount?: number;
  platformFeePercentage?: number;
  platformFeeAmount?: number;
  platformFixedFee?: number;
  totalPlatformFee?: number;
  walletAmount?: number;

  totalAmount: number;
  discount: number;
  finalAmount: number;
  totalHpp?: number;
  paymentMethod: PaymentMethod;
  paymentAccount?: CanonicalCashAccount;
  cashReceived: number;
  changeAmount: number;
  status: SaleStatus;
  stockDeducted?: boolean; // Menandakan apakah pemotongan stok bahan/produk sudah dicatat secara atomik di Firestore
  offlineTransactionNo?: string; // Menyimpan nomor transaksi sementara offline (OFF-<deviceId>-<seq>) sebelum dipetakan
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidedByName?: string;
  notes?: string;
  cashierId: string;
  cashierName: string;
  shiftId?: string;
  createdAt: string;
  updatedAt?: string;
  isOfflineSync?: boolean;
  syncedAt?: string;
}

export type ExpenseCategory =
  | 'listrik'
  | 'gas'
  | 'sewa'
  | 'transport'
  | 'gaji'
  | 'kebersihan'
  | 'internet'
  | 'atk'
  | 'administrasi'
  | 'lainnya'
  | 'bahan baku'
  | 'packaging'
  | string;

export type ExpensePaymentSource =
  | 'Tunai'
  | 'CASH'
  | 'QRIS'
  | 'Transfer'
  | 'BCA'
  | 'JAGO'
  | 'MANDIRI'
  | 'KAS_KASIR'
  | 'KAS_QRIS'
  | 'KAS_OWNER'
  | 'BANK_BCA'
  | 'BANK_JAGO'
  | 'BANK_MANDIRI'
  | string;

// Jejak nilai lama setiap kali expense dikoreksi (append-only history)
export interface ExpenseHistoryEntry {
  amount: number;
  category: ExpenseCategory;
  paymentSource?: ExpensePaymentSource;
  note?: string;
  date?: string;
  changedAt: string;
  changedBy: string;
  changedByName?: string;
}

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  paymentSource?: ExpensePaymentSource;
  note?: string;
  referenceId?: string; // ID referensi transaksi/presensi yang mendasari pengeluaran
  status?: 'COMPLETED' | 'VOID';
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidedByName?: string;
  history?: ExpenseHistoryEntry[];
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export type CanonicalCashAccount =
  | 'KAS_KASIR'
  | 'KAS_QRIS'
  | 'KAS_OWNER'
  | 'BANK_BCA'
  | 'BANK_JAGO'
  | 'BANK_MANDIRI'
  | 'WALLET_GOFOOD'
  | 'WALLET_GRABFOOD'
  | 'WALLET_SHOPEEFOOD';

export type CashAccount =
  | CanonicalCashAccount
  | 'KAS_TUNAI'
  | 'SALDO_QRIS'
  | 'SALDO_TRANSFER';

export type CashMutationType =
  | 'MODAL_AWAL'
  | 'PENJUALAN'
  | 'TARIK_KAS'
  | 'SETOR_OWNER'
  | 'PENCAIRAN_QRIS'
  | 'PENCAIRAN_PLATFORM'
  | 'PENGELUARAN'
  | 'PENYESUAIAN'
  | 'TRANSFER_DANA';

export interface CashMutation {
  id: string;
  date: string;
  account: CashAccount;
  type: CashMutationType;
  amount: number;
  flow: 'IN' | 'OUT'; // IN: tambah saldo, OUT: kurangi saldo
  referenceId?: string; // e.g. transactionNo or expenseId or transferGroupId
  relatedAccount?: CashAccount; // For transfers between accounts
  title: string;
  notes?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
}

export interface CashBalanceSummary {
  // 6 Canonical Cash & Bank Wallets
  kasKasir: number;
  kasQris: number;
  kasOwner: number;
  bankBca: number;
  bankJago: number;
  bankMandiri: number;

  // 3 Online Platform Wallets (Belum Cair / Menunggu Settlement)
  walletGofood: number;
  walletGrabfood: number;
  walletShopeefood: number;
  totalPlatformWallet: number;

  // Backwards-compatible aliases
  kasTunai: number;
  saldoQris: number;
  saldoTransfer: number;
  totalSaldo: number; // Total Kas & Bank Cair (tidak termasuk dompet platform yang belum dicairkan)
  totalSaldoDanPlatform: number; // Total Kas & Bank + Saldo Dompet Platform

  // Daily movement metrics
  todayKasMasuk: number;
  todayQrisMasuk: number;
  todayTransferMasuk: number;
  todayBcaMasuk: number;
  todayJagoMasuk: number;
  todayMandiriMasuk: number;
  todayGofoodMasuk: number;
  todayGrabfoodMasuk: number;
  todayShopeefoodMasuk: number;
  todayPlatformMasuk: number;
  todayPlatformSettled: number;
  todayPengeluaranKas: number;
  todayDiambilOwner: number;
}

export interface Employee {
  id: string;
  uid?: string;
  name: string;
  email?: string;
  username?: string;
  pin?: string; // Legacy plaintext compatibility (dimigrasikan ke staff/{id} pinHash + pinSalt)
  hasPin?: boolean;
  pinHash?: string;
  pinSalt?: string;
  role: UserRole;
  position?: string;
  phone?: string;
  dailyWage?: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type AttendanceStatus = 'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT' | 'ALPA' | 'LEMBUR' | 'PRESENT' | 'ABSENT' | 'OVERTIME';

export interface Attendance {
  id: string;
  employeeId: string;
  employeeName: string;
  userUid?: string;
  date: string; // YYYY-MM-DD
  checkInAt: string; // ISO string
  checkOutAt?: string; // ISO string
  status: AttendanceStatus;
  overtimeHours?: number;
  wagePaid?: boolean | number;
  wageAmount?: number;
  wageExpenseId?: string; // Referensi ID pengeluaran gaji di collection expenses
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  userUid: string;
  userName: string;
  createdAt: string;
}

export interface StockStatusInfo {
  status: 'AMAN' | 'MENIPIS' | 'KRITIS' | 'HABIS';
  colorClass: string;
}

export interface Staff {
  id: string;
  employeeId?: string;
  username: string;
  name: string;
  pin?: string; // Legacy compatibility only (tidak disimpan plaintext lagi)
  pinHash: string;
  pinSalt: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Shift {
  id: string;
  staffId: string;
  staffName: string;
  openedAt: string;
  closedAt?: string;
  openingCash: number; // Final confirmed opening cash (physical cash in KAS_KASIR)
  openingCashExpected?: number; // Expected cash from previous closed shift
  openingCashActual?: number; // Physical cash counted at opening
  openingCashVariance?: number; // Variance at opening (actual - expected)
  openingCashConfirmed?: boolean;
  openingDenominations?: Record<string, number>;
  expectedCash?: number;
  actualCash?: number;
  cashDifference?: number;
  closingDenominations?: Record<string, number>;
  totalSalesCash?: number;
  totalSalesQris?: number;
  totalSalesTransfer?: number;
  totalSalesBca?: number;
  totalSalesJago?: number;
  totalSalesMandiri?: number;
  totalExpensesCash?: number;
  totalOwnerWithdrawals?: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
  closedBy?: string;
  closedByName?: string;
}

// Konfigurasi Tarif Pajak (Tahap 7 Audit Keuangan)
export interface TaxSettings {
  enablePphFinal: boolean; // PPh Final UMKM PP 55/2022 (tarif 0.5%)
  pphFinalRate: number;    // % tarif PPh Final (default: 0.5%)
  enablePb1: boolean;      // PB1 / Pajak Restoran Daerah (tarif default 10%)
  pb1Rate: number;         // % tarif PB1 (default: 10%)
}

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  enablePphFinal: false,
  pphFinalRate: 0.5,
  enablePb1: false,
  pb1Rate: 10,
};
