import {
  Sale,
  Purchase,
  Ingredient,
  Product,
  StockMovement,
  CashMutation,
  UserProfile,
  Assembly,
} from '../types';
import {
  getNextTransactionNumber,
  isOfflineTransactionNo,
} from './transactionCounter';
import {
  getOfflinePurchasesQueue,
  saveOfflinePurchaseToQueue,
  removeOfflinePurchaseFromQueue,
  updateOfflinePurchaseQueueItem,
  getOfflineSalesQueue,
  saveOfflineSaleToQueue,
  removeOfflineSaleFromQueue,
  getCachedPurchases,
  saveCachedPurchase,
  saveCachedPurchases,
  saveCachedIngredients,
  saveCachedProducts,
  addCachedStockMovement,
  addCachedCashMutation,
  openOfflineDb,
  OfflineQueueSyncStatus,
} from './offlineDatabase';
import {
  doc,
  writeBatch,
  collection,
  getDoc,
  setDoc,
  Firestore,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { sanitizeFirestore } from '../utils/sanitizeFirestore';
import { normalizeCashAccount, getCashAccountLabel } from '../utils/cashLedger';
import { processSaleStockDeduction } from './stockEngine';

const OFFLINE_SALES_KEY = 'geprek_ary_offline_sales';
const OFFLINE_PURCHASES_KEY = 'geprek_ary_offline_purchases';

export type NetworkSyncStatus = 'SYNCHRONIZED' | 'PENDING' | 'SYNCING' | 'OFFLINE';

export interface SyncState {
  status: NetworkSyncStatus;
  pendingSalesCount: number;
  pendingPurchasesCount: number;
  totalPendingCount: number;
  label: string;
  badgeClass: string;
}

// ============================================================================
// LOCAL STORAGE FALLBACKS (Backward compatibility & fast sync)
// ============================================================================

export function getOfflineSalesFromStorage(): Sale[] {
  try {
    const raw = localStorage.getItem(OFFLINE_SALES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read offline sales from localStorage', e);
    return [];
  }
}

export function saveOfflineSaleToStorage(sale: Sale): void {
  const current = getOfflineSalesFromStorage();
  const existingIdx = current.findIndex(s => s.id === sale.id);
  if (existingIdx >= 0) {
    current[existingIdx] = { ...sale, isOfflineSync: true };
  } else {
    current.push({ ...sale, isOfflineSync: true });
  }
  localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(current));
}

export function removeOfflineSaleFromStorage(saleId: string): void {
  const current = getOfflineSalesFromStorage();
  const filtered = current.filter(s => s.id !== saleId);
  localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(filtered));
}

export function getOfflinePurchasesFromStorage(): Purchase[] {
  try {
    const raw = localStorage.getItem(OFFLINE_PURCHASES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read offline purchases from localStorage', e);
    return [];
  }
}

export function saveOfflinePurchaseToStorage(purchase: Purchase): void {
  const current = getOfflinePurchasesFromStorage();
  const existingIdx = current.findIndex(p => p.id === purchase.id);
  if (existingIdx >= 0) {
    current[existingIdx] = { ...purchase, isOfflineSync: true, syncStatus: 'PENDING' };
  } else {
    current.push({ ...purchase, isOfflineSync: true, syncStatus: 'PENDING' });
  }
  localStorage.setItem(OFFLINE_PURCHASES_KEY, JSON.stringify(current));
}

export function removeOfflinePurchaseFromStorage(purchaseId: string): void {
  const current = getOfflinePurchasesFromStorage();
  const filtered = current.filter(p => p.id !== purchaseId);
  localStorage.setItem(OFFLINE_PURCHASES_KEY, JSON.stringify(filtered));
}

// ============================================================================
// ASYNC INDEXEDDB + SYNC QUEUE API
// ============================================================================

/** Get all offline sales (IndexedDB + Storage mirror) */
export async function getOfflineSalesAsync(): Promise<Sale[]> {
  try {
    const queue = await getOfflineSalesQueue();
    if (queue && queue.length > 0) {
      return queue.map(q => q.sale);
    }
  } catch (e) {
    console.warn('IDB getOfflineSales failed, falling back to storage', e);
  }
  return getOfflineSalesFromStorage();
}

/** Synchronous getter for immediate render backward compatibility */
export function getOfflineSales(): Sale[] {
  return getOfflineSalesFromStorage();
}

export async function saveOfflineSaleAsync(sale: Sale): Promise<void> {
  saveOfflineSaleToStorage(sale);
  try {
    await saveOfflineSaleToQueue(sale);
  } catch (e) {
    console.warn('Failed saving offline sale to IDB queue', e);
  }
}

export function saveOfflineSale(sale: Sale): void {
  saveOfflineSaleToStorage(sale);
  saveOfflineSaleToQueue(sale).catch(e => console.warn(e));
}

export async function removeOfflineSaleAsync(saleId: string): Promise<void> {
  removeOfflineSaleFromStorage(saleId);
  try {
    await removeOfflineSaleFromQueue(saleId);
  } catch (e) {
    console.warn('Failed removing offline sale from IDB', e);
  }
}

export function removeOfflineSale(saleId: string): void {
  removeOfflineSaleFromStorage(saleId);
  removeOfflineSaleFromQueue(saleId).catch(e => console.warn(e));
}

export function clearOfflineSales(): void {
  localStorage.removeItem(OFFLINE_SALES_KEY);
}

// --- Purchases Offline Queue ---

export async function getOfflinePurchasesAsync(): Promise<Purchase[]> {
  try {
    const queue = await getOfflinePurchasesQueue();
    const idbPurchases = queue ? queue.map(q => q.purchase) : [];
    const lsPurchases = getOfflinePurchasesFromStorage();
    const map = new Map<string, Purchase>();
    lsPurchases.forEach(p => map.set(p.id, p));
    idbPurchases.forEach(p => map.set(p.id, p)); // IDB takes precedence!
    return Array.from(map.values());
  } catch (e) {
    console.warn('IDB getOfflinePurchases failed, falling back to storage', e);
    return getOfflinePurchasesFromStorage();
  }
}

export function getOfflinePurchases(): Purchase[] {
  return getOfflinePurchasesFromStorage();
}

export interface PendingStockAdditions {
  ingredientAdditions: Map<string, number>;
  productAdditions: Map<string, number>;
  pendingPurchasesMap: Map<string, Purchase>;
}

export async function getPendingOfflineStockAdditions(): Promise<PendingStockAdditions> {
  const pendingPurchases = await getOfflinePurchasesAsync();
  const ingredientAdditions = new Map<string, number>();
  const productAdditions = new Map<string, number>();
  const pendingPurchasesMap = new Map<string, Purchase>();

  for (const purch of pendingPurchases) {
    if (purch.isOfflineSync || purch.syncStatus !== 'SYNCHRONIZED') {
      pendingPurchasesMap.set(purch.id, purch);
      for (const item of purch.items || []) {
        const cFactor = item.conversionFactor || 1;
        const stockAdded =
          item.stockQuantityAdded !== undefined && item.stockQuantityAdded > 0
            ? item.stockQuantityAdded
            : item.quantity * cFactor;

        if (item.entityType === 'PRODUCT') {
          const current = productAdditions.get(item.targetId) || 0;
          productAdditions.set(item.targetId, current + stockAdded);
        } else {
          const current = ingredientAdditions.get(item.targetId) || 0;
          ingredientAdditions.set(item.targetId, current + stockAdded);
        }
      }
    }
  }

  return {
    ingredientAdditions,
    productAdditions,
    pendingPurchasesMap,
  };
}

export async function saveOfflinePurchase(purchase: Purchase): Promise<void> {
  saveOfflinePurchaseToStorage(purchase);
  try {
    await saveOfflinePurchaseToQueue(purchase);
  } catch (e) {
    console.warn('Failed saving offline purchase to IDB queue', e);
  }
}

export async function removeOfflinePurchase(purchaseId: string): Promise<void> {
  removeOfflinePurchaseFromStorage(purchaseId);
  try {
    await removeOfflinePurchaseFromQueue(purchaseId);
  } catch (e) {
    console.warn('Failed removing offline purchase from IDB', e);
  }
}

// ============================================================================
// SYNC STATE BADGE FORMATTER
// ============================================================================

export function getSyncState(
  isOnline: boolean,
  pendingCount: number,
  pendingPurchasesCount: number = 0
): SyncState {
  const total = pendingCount + pendingPurchasesCount;

  if (!isOnline) {
    return {
      status: 'OFFLINE',
      pendingSalesCount: pendingCount,
      pendingPurchasesCount,
      totalPendingCount: total,
      label: total > 0 ? `🔴 Offline (${total} tertunda)` : '🔴 Offline',
      badgeClass: 'bg-red-500 text-white',
    };
  }

  if (total > 0) {
    const details = [];
    if (pendingCount > 0) details.push(`${pendingCount} POS`);
    if (pendingPurchasesCount > 0) details.push(`${pendingPurchasesCount} Pembelian`);

    return {
      status: 'PENDING',
      pendingSalesCount: pendingCount,
      pendingPurchasesCount,
      totalPendingCount: total,
      label: `🟡 Menunggu sync (${details.join(', ')})`,
      badgeClass: 'bg-amber-500 text-white animate-pulse',
    };
  }

  return {
    status: 'SYNCHRONIZED',
    pendingSalesCount: 0,
    pendingPurchasesCount: 0,
    totalPendingCount: 0,
    label: '🟢 Tersinkron',
    badgeClass: 'bg-emerald-600 text-white',
  };
}

// ============================================================================
// FIRESTORE ATOMIC & IDEMPOTENT SYNC ENGINE
// ============================================================================

export interface SaleSyncResult {
  syncedSales: Sale[];
  failedSales: { sale: Sale; error: string }[];
}

/**
 * Sinkronisasi penjualan offline ke Firestore:
 * 1. Mengganti nomor transaksi prefix perangkat (OFF-<deviceId>-<seq>) dengan nomor atomik Firestore (counters/sales_YYYYMMDD)
 * 2. Menyimpan nomor offline asli di offlineTransactionNo untuk jejak audit
 * 3. Hanya memotong stok jika stockDeducted !== true
 * 4. Menandai stockDeducted: true di dalam batch yang sama dengan pemotongan stok
 */
export async function syncOfflineSalesToFirestore(
  firestoreInstance: Firestore,
  userProfile: UserProfile | null,
  productsMap: Map<string, Product>,
  ingredientsMap?: Map<string, Ingredient>,
  assembliesMap?: Map<string, Assembly>,
  onProgress?: (syncedId: string, current: number, total: number) => void
): Promise<SaleSyncResult> {
  const offlineSales = await getOfflineSalesAsync();
  const syncedSales: Sale[] = [];
  const failedSales: { sale: Sale; error: string }[] = [];

  if (!offlineSales || offlineSales.length === 0) {
    return { syncedSales, failedSales };
  }

  const total = offlineSales.length;
  let count = 0;

  for (const offlineSale of offlineSales) {
    count += 1;
    try {
      let officialTxNo = offlineSale.transactionNo;
      let originalOfflineNo = offlineSale.offlineTransactionNo;

      // 1. Nomor transaksi dari counter atomik di Firestore jika berprefix offline
      if (isOfflineTransactionNo(offlineSale.transactionNo)) {
        const counterResult = await getNextTransactionNumber(
          firestoreInstance,
          offlineSale.date || offlineSale.createdAt
        );
        officialTxNo = counterResult.transactionNo;
        originalOfflineNo = offlineSale.transactionNo;
      }

      const now = new Date().toISOString();
      const saleRef = doc(firestoreInstance, 'sales', offlineSale.id);
      const existingSnap = await getDoc(saleRef);
      const isAlreadyDeducted =
        existingSnap.exists() && existingSnap.data()?.stockDeducted === true;

      const syncedSale: Sale = {
        ...offlineSale,
        transactionNo: officialTxNo,
        offlineTransactionNo: originalOfflineNo || offlineSale.offlineTransactionNo,
        isOfflineSync: false,
        syncedAt: now,
        stockDeducted: isAlreadyDeducted || offlineSale.stockDeducted === true,
      };

      // 2. Simpan atau perbarui dokumen penjualan di Firestore
      await setDoc(saleRef, sanitizeFirestore(syncedSale), { merge: true });

      // 3. Potong stok HANYA jika false (atau belum pernah dipotong sebelumnya)
      if (!isAlreadyDeducted && offlineSale.stockDeducted !== true) {
        await processSaleStockDeduction(
          syncedSale,
          productsMap,
          userProfile?.uid || 'offline_sync',
          ingredientsMap,
          assembliesMap
        );
        syncedSale.stockDeducted = true;
      }

      // 4. Hapus dari queue offline setelah berhasil disinkronkan
      await removeOfflineSaleAsync(offlineSale.id);
      syncedSales.push(syncedSale);

      if (onProgress) {
        onProgress(offlineSale.id, count, total);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown sync error';
      console.error(`Failed to sync sale ${offlineSale.id}:`, err);
      failedSales.push({ sale: offlineSale, error: errorMsg });
    }
  }

  return { syncedSales, failedSales };
}

export interface PurchaseSyncResult {
  syncedPurchases: Purchase[];
  failedPurchases: { purchase: Purchase; error: string }[];
}

/**
 * Synchronize offline purchases to Firestore with full idempotency guarantee.
 * 1 offline purchase = 1 Firestore doc + 1 batch stock update + 1 cash mutation.
 */
export async function syncOfflinePurchasesToFirestore(
  firestoreInstance: Firestore,
  userProfile: UserProfile | null,
  productsMap: Map<string, Product>,
  ingredientsMap: Map<string, Ingredient>,
  onProgress?: (syncedId: string, current: number, total: number) => void
): Promise<PurchaseSyncResult> {
  const offlineQueue = await getOfflinePurchasesAsync();
  const syncedPurchases: Purchase[] = [];
  const failedPurchases: { purchase: Purchase; error: string }[] = [];

  if (!offlineQueue || offlineQueue.length === 0) {
    return { syncedPurchases, failedPurchases };
  }

  // Pre-calculate total pending stock additions per entity in current offline queue
  // Used as fallback deduction if an entity document is not yet on Firestore
  const totalPendingProductStock = new Map<string, number>();
  const totalPendingIngredientStock = new Map<string, number>();

  for (const p of offlineQueue) {
    for (const item of p.items || []) {
      const cFactor = item.conversionFactor || 1;
      const stockAdded =
        item.stockQuantityAdded !== undefined && item.stockQuantityAdded > 0
          ? item.stockQuantityAdded
          : item.quantity * cFactor;
      if (item.entityType === 'PRODUCT') {
        const cur = totalPendingProductStock.get(item.targetId) || 0;
        totalPendingProductStock.set(item.targetId, cur + stockAdded);
      } else {
        const cur = totalPendingIngredientStock.get(item.targetId) || 0;
        totalPendingIngredientStock.set(item.targetId, cur + stockAdded);
      }
    }
  }

  // Sequential stock accumulators during sync session
  const runningProductStock = new Map<string, number>();
  const runningIngredientStock = new Map<string, number>();
  const runningProductObj = new Map<string, Product>();
  const runningIngredientObj = new Map<string, Ingredient>();

  const total = offlineQueue.length;
  let count = 0;

  for (const purchase of offlineQueue) {
    count += 1;
    try {
      await updateOfflinePurchaseQueueItem(purchase.id, 'SYNCING');

      // 1. Check if document already exists on Firestore (Idempotency Check)
      const purchRef = doc(firestoreInstance, 'purchases', purchase.id);
      const existingSnap = await getDoc(purchRef);

      const batch = writeBatch(firestoreInstance);
      const now = new Date().toISOString();

      const sanitizedPurchase: Purchase = {
        ...purchase,
        isOfflineSync: false,
        syncStatus: 'SYNCHRONIZED',
        syncedAt: now,
      };

      if (!existingSnap.exists()) {
        // Document does not exist yet: commit the purchase and its stock movements + cash mutations
        batch.set(purchRef, sanitizeFirestore(sanitizedPurchase));

        // Process stock additions on Firestore using Firestore baseline & sequential accumulator
        for (const item of purchase.items || []) {
          if (item.entityType === 'PRODUCT') {
            let baseProduct: Product | undefined;
            let currentStock = 0;

            if (runningProductStock.has(item.targetId)) {
              // Continuation from earlier pending purchase in this sync session
              currentStock = runningProductStock.get(item.targetId)!;
              baseProduct = runningProductObj.get(item.targetId);
            } else {
              // First encounter: Fetch raw baseline stock directly from Firestore
              const prodDocRef = doc(firestoreInstance, 'products', item.targetId);
              const prodDocSnap = await getDoc(prodDocRef);

              if (prodDocSnap.exists()) {
                baseProduct = { ...(prodDocSnap.data() as Product), id: item.targetId };
                currentStock = typeof baseProduct.stock === 'number' ? baseProduct.stock : 0;
              } else {
                // Fallback for product created offline / not yet in Firestore collection
                baseProduct =
                  productsMap.get(item.targetId) ||
                  Array.from(productsMap.values()).find(
                    p => p.name.trim().toLowerCase() === (item.targetName || '').trim().toLowerCase()
                  );
                const rawStock = baseProduct && typeof baseProduct.stock === 'number' ? baseProduct.stock : 0;
                const pendingAdd = totalPendingProductStock.get(item.targetId) || 0;
                currentStock = Math.max(0, rawStock - pendingAdd);
              }
            }

            const stockUnit = item.stockUnit || baseProduct?.stockUnit || 'pcs';
            const purchaseUnit = item.purchaseUnit || item.unit || baseProduct?.purchaseUnit || stockUnit;
            const conversionFactor = item.conversionFactor || baseProduct?.conversionFactor || 1;
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

            const newStock = currentStock + stockAdded;

            // Update accumulator maps
            runningProductStock.set(item.targetId, newStock);

            // Tahap 7: Hitung costPerUnit dengan rata-rata tertimbang (stokLama*costLama + qtyBaru*costBaru) / (stokLama + qtyBaru)
            const oldStock = Math.max(0, currentStock);
            const oldCost = Number(baseProduct?.costPerUnit ?? item.costPerUnit ?? 0);
            const newUnitCost = costPerStockUnit > 0 ? costPerStockUnit : oldCost;
            const weightedCost =
              oldStock > 0 && oldCost > 0 && oldStock + stockAdded > 0
                ? Math.round(((oldStock * oldCost + stockAdded * newUnitCost) / (oldStock + stockAdded)) * 100) / 100
                : newUnitCost;

            const updatedProd: Product = {
              ...(baseProduct || ({ id: item.targetId, name: item.targetName || 'Produk' } as Product)),
              id: item.targetId,
              stock: newStock,
              stockUnit,
              purchaseUnit,
              conversionFactor,
              purchasePrice: item.costPerUnit,
              costPerUnit: weightedCost,
              updatedAt: now,
            };
            runningProductObj.set(item.targetId, updatedProd);

            const prodRef = doc(firestoreInstance, 'products', item.targetId);
            batch.set(prodRef, sanitizeFirestore(updatedProd), { merge: true });

            const moveRef = doc(collection(firestoreInstance, 'stock_movements'));
            const movement: StockMovement = {
              id: moveRef.id,
              entityType: 'PRODUCT',
              entityId: item.targetId,
              entityName: item.targetName || baseProduct?.name || 'Produk',
              productId: item.targetId,
              productName: item.targetName || baseProduct?.name || 'Produk',
              type: 'PURCHASE',
              changeAmount: stockAdded,
              balanceAfter: newStock,
              unit: stockUnit,
              purchaseUnit,
              purchaseQuantity: item.quantity,
              conversionFactor,
              referenceId: purchase.purchaseNo,
              notes: `Pembelian Offline Sync #${purchase.purchaseNo} (${item.quantity} ${purchaseUnit} = +${stockAdded} ${stockUnit}) dari ${purchase.vendorName || 'Supplier'}`,
              createdBy: userProfile?.uid || 'offline_sync',
              createdAt: now,
            };
            batch.set(moveRef, sanitizeFirestore(movement));
          } else {
            let baseIng: Ingredient | undefined;
            let currentStock = 0;

            if (runningIngredientStock.has(item.targetId)) {
              // Continuation from earlier pending purchase in this sync session
              currentStock = runningIngredientStock.get(item.targetId)!;
              baseIng = runningIngredientObj.get(item.targetId);
            } else {
              // First encounter: Fetch raw baseline stock directly from Firestore
              const ingDocRef = doc(firestoreInstance, 'ingredients', item.targetId);
              const ingDocSnap = await getDoc(ingDocRef);

              if (ingDocSnap.exists()) {
                baseIng = { ...(ingDocSnap.data() as Ingredient), id: item.targetId };
                currentStock = typeof baseIng.stock === 'number' ? baseIng.stock : 0;
              } else {
                // Fallback for ingredient created offline / not yet in Firestore collection
                baseIng =
                  ingredientsMap.get(item.targetId) ||
                  Array.from(ingredientsMap.values()).find(
                    i => i.name.trim().toLowerCase() === (item.targetName || '').trim().toLowerCase()
                  );
                const rawStock = baseIng && typeof baseIng.stock === 'number' ? baseIng.stock : 0;
                const pendingAdd = totalPendingIngredientStock.get(item.targetId) || 0;
                currentStock = Math.max(0, rawStock - pendingAdd);
              }
            }

            const stockUnit = item.stockUnit || baseIng?.stockUnit || baseIng?.unit || 'pcs';
            const purchaseUnit = item.purchaseUnit || item.unit || baseIng?.purchaseUnit || stockUnit;
            const conversionFactor = item.conversionFactor || baseIng?.conversionFactor || 1;
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

            const newStock = currentStock + stockAdded;

            // Update accumulator maps
            runningIngredientStock.set(item.targetId, newStock);

            // Tahap 7: Hitung costPerUnit bahan dengan rata-rata tertimbang
            const oldStock = Math.max(0, currentStock);
            const oldCost = Number(baseIng?.costPerUnit ?? item.costPerUnit ?? 0);
            const newUnitCost = costPerStockUnit > 0 ? costPerStockUnit : oldCost;
            const weightedCost =
              oldStock > 0 && oldCost > 0 && oldStock + stockAdded > 0
                ? Math.round(((oldStock * oldCost + stockAdded * newUnitCost) / (oldStock + stockAdded)) * 100) / 100
                : newUnitCost;

            const updatedIng: Ingredient = {
              ...(baseIng || ({ id: item.targetId, name: item.targetName || 'Bahan' } as Ingredient)),
              id: item.targetId,
              stock: newStock,
              unit: stockUnit,
              stockUnit,
              purchaseUnit,
              conversionFactor,
              purchasePrice: item.costPerUnit,
              costPerUnit: weightedCost,
              updatedAt: now,
            };
            runningIngredientObj.set(item.targetId, updatedIng);

            const ingRef = doc(firestoreInstance, 'ingredients', item.targetId);
            batch.set(ingRef, sanitizeFirestore(updatedIng), { merge: true });

            const moveRef = doc(collection(firestoreInstance, 'stock_movements'));
            const movement: StockMovement = {
              id: moveRef.id,
              entityType: 'INGREDIENT',
              entityId: item.targetId,
              entityName: item.targetName || baseIng?.name || 'Bahan',
              ingredientId: item.targetId,
              ingredientName: item.targetName || baseIng?.name || 'Bahan',
              type: 'PURCHASE',
              changeAmount: stockAdded,
              balanceAfter: newStock,
              unit: stockUnit,
              purchaseUnit,
              purchaseQuantity: item.quantity,
              conversionFactor,
              referenceId: purchase.purchaseNo,
              notes: `Pembelian Offline Sync #${purchase.purchaseNo} (${item.quantity} ${purchaseUnit} = +${stockAdded} ${stockUnit}) dari ${purchase.vendorName || 'Supplier'}`,
              createdBy: userProfile?.uid || 'offline_sync',
              createdAt: now,
            };
            batch.set(moveRef, sanitizeFirestore(movement));
          }
        }

        // Cash Deduction for paidAmount
        if (purchase.paidAmount > 0) {
          const sourceAcc = purchase.paymentSource || 'KAS_KASIR';
          const mappedAcc = normalizeCashAccount(sourceAcc);

          const mutRef = doc(collection(firestoreInstance, 'cash_mutations'));
          const cashMut: CashMutation = {
            id: mutRef.id,
            date: purchase.date || now.split('T')[0],
            account: mappedAcc,
            type: 'PENGELUARAN',
            amount: purchase.paidAmount,
            flow: 'OUT',
            referenceId: purchase.id,
            title: `Pembelian Offline Sync #${purchase.purchaseNo} - ${purchase.vendorName || 'Supplier'}`,
            notes: `Pembayaran ${purchase.paymentStatus} via ${getCashAccountLabel(mappedAcc)}`,
            createdBy: userProfile?.uid || 'offline_sync',
            createdByName: userProfile?.displayName || 'Kasir',
            createdAt: now,
          };
          batch.set(mutRef, sanitizeFirestore(cashMut));
        }

        // Audit Log
        const logRef = doc(collection(firestoreInstance, 'audit_logs'));
        batch.set(
          logRef,
          sanitizeFirestore({
            id: logRef.id,
            action: 'PEMBELIAN_OFFLINE_SYNC',
            details: `Sinkronisasi pembelian offline #${purchase.purchaseNo} total Rp ${purchase.totalAmount.toLocaleString('id-ID')}`,
            userUid: userProfile?.uid || 'offline_sync',
            userName: userProfile?.displayName || 'Offline Sync',
            createdAt: now,
          })
        );

        await batch.commit();
      } else {
        // Document already exists on Firestore: just ensure isOfflineSync is marked false
        await setDoc(purchRef, sanitizeFirestore(sanitizedPurchase), { merge: true });
      }

      // Success: Remove from local queue and mark as synchronized
      await removeOfflinePurchase(purchase.id);
      syncedPurchases.push(sanitizedPurchase);

      if (onProgress) {
        onProgress(purchase.id, count, total);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown sync error';
      console.error(`Failed to sync purchase ${purchase.id}:`, err);
      await updateOfflinePurchaseQueueItem(purchase.id, 'ERROR', errorMsg);
      failedPurchases.push({ purchase, error: errorMsg });
    }
  }

  return { syncedPurchases, failedPurchases };
}
