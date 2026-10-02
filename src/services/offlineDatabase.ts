/**
 * ARY POS - IndexedDB Offline-First Local Database Engine
 * Compatible with PWA, Web Browsers, and Capacitor Android APK.
 */

import {
  Ingredient,
  Product,
  Vendor,
  Purchase,
  Sale,
  StockMovement,
  CashMutation,
  PurchaseItem,
} from '../types';

const DB_NAME = 'ARY_POS_OFFLINE_DB';
const DB_VERSION = 1;

export type OfflineQueueSyncStatus = 'PENDING' | 'SYNCING' | 'ERROR' | 'SYNCHRONIZED';

export interface OfflinePurchaseQueueItem {
  id: string; // offlinePurchaseId (idempotency key)
  purchase: Purchase;
  syncStatus: OfflineQueueSyncStatus;
  retryCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfflineSaleQueueItem {
  id: string; // sale id (idempotency key)
  sale: Sale;
  syncStatus: OfflineQueueSyncStatus;
  retryCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

export function openOfflineDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = request.result;

      // 1. Master Caches
      if (!db.objectStoreNames.contains('ingredients')) {
        const store = db.createObjectStore('ingredients', { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }

      if (!db.objectStoreNames.contains('products')) {
        const store = db.createObjectStore('products', { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('categoryId', 'categoryId', { unique: false });
      }

      if (!db.objectStoreNames.contains('vendors')) {
        const store = db.createObjectStore('vendors', { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
      }

      // 2. Transactions & Histories
      if (!db.objectStoreNames.contains('purchases')) {
        const store = db.createObjectStore('purchases', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('vendorId', 'vendorId', { unique: false });
        store.createIndex('paymentStatus', 'paymentStatus', { unique: false });
        store.createIndex('isOfflineSync', 'isOfflineSync', { unique: false });
      }

      if (!db.objectStoreNames.contains('sales')) {
        const store = db.createObjectStore('sales', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }

      if (!db.objectStoreNames.contains('stock_movements')) {
        const store = db.createObjectStore('stock_movements', { keyPath: 'id' });
        store.createIndex('entityId', 'entityId', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }

      if (!db.objectStoreNames.contains('cash_mutations')) {
        const store = db.createObjectStore('cash_mutations', { keyPath: 'id' });
        store.createIndex('account', 'account', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      }

      // 3. Offline Queues for Idempotent Sync
      if (!db.objectStoreNames.contains('offline_purchases_queue')) {
        const store = db.createObjectStore('offline_purchases_queue', { keyPath: 'id' });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('offline_sales_queue')) {
        const store = db.createObjectStore('offline_sales_queue', { keyPath: 'id' });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
        dbInitPromise = null;
      };
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });

  return dbInitPromise;
}

/** Generic Transaction Helper */
async function performTx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const req = callback(store);

      if (req) {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error(`Operation failed on ${storeName}`));
      }

      tx.oncomplete = () => {
        if (!req) resolve(undefined as unknown as T);
      };
      tx.onerror = () => reject(tx.error || new Error(`Transaction error on ${storeName}`));
      tx.onabort = () => reject(tx.error || new Error(`Transaction aborted on ${storeName}`));
    } catch (err) {
      reject(err);
    }
  });
}

/** Bulk Put items into an Object Store */
export async function bulkPut<T extends { id: string }>(
  storeName: string,
  items: T[]
): Promise<void> {
  if (!items || items.length === 0) return;
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (e) {
      reject(e);
    }
  });
}

/** Get all records from a store */
export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  try {
    const result = await performTx<T[]>(storeName, 'readonly', store => store.getAll());
    return result || [];
  } catch (e) {
    console.warn(`[IndexedDB] Failed getAll from ${storeName}:`, e);
    return [];
  }
}

/** Get single item by ID */
export async function getFromStore<T>(storeName: string, id: string): Promise<T | undefined> {
  try {
    return await performTx<T>(storeName, 'readonly', store => store.get(id));
  } catch (e) {
    console.warn(`[IndexedDB] Failed get(${id}) from ${storeName}:`, e);
    return undefined;
  }
}

/** Put single item into store */
export async function putInStore<T extends { id: string }>(
  storeName: string,
  item: T
): Promise<void> {
  await performTx(storeName, 'readwrite', store => {
    store.put(item);
  });
}

/** Delete single item by ID */
export async function deleteFromStore(storeName: string, id: string): Promise<void> {
  await performTx(storeName, 'readwrite', store => {
    store.delete(id);
  });
}

/** Clear an entire store */
export async function clearObjectStore(storeName: string): Promise<void> {
  await performTx(storeName, 'readwrite', store => {
    store.clear();
  });
}

// ============================================================================
// TYPED HIGH-LEVEL HELPERS
// ============================================================================

// --- Ingredients ---
export async function getCachedIngredients(): Promise<Ingredient[]> {
  return getAllFromStore<Ingredient>('ingredients');
}
export async function saveCachedIngredients(ingredients: Ingredient[]): Promise<void> {
  return bulkPut('ingredients', ingredients);
}
export async function updateCachedIngredient(ingredient: Ingredient): Promise<void> {
  return putInStore('ingredients', ingredient);
}

// --- Products ---
export async function getCachedProducts(): Promise<Product[]> {
  return getAllFromStore<Product>('products');
}
export async function saveCachedProducts(products: Product[]): Promise<void> {
  return bulkPut('products', products);
}
export async function updateCachedProduct(product: Product): Promise<void> {
  return putInStore('products', product);
}

// --- Vendors ---
export async function getCachedVendors(): Promise<Vendor[]> {
  return getAllFromStore<Vendor>('vendors');
}
export async function saveCachedVendors(vendors: Vendor[]): Promise<void> {
  return bulkPut('vendors', vendors);
}

// --- Purchases & Purchase Offline Queue ---
export async function getCachedPurchases(): Promise<Purchase[]> {
  return getAllFromStore<Purchase>('purchases');
}
export async function saveCachedPurchases(purchases: Purchase[]): Promise<void> {
  return bulkPut('purchases', purchases);
}
export async function saveCachedPurchase(purchase: Purchase): Promise<void> {
  return putInStore('purchases', purchase);
}

export async function getOfflinePurchasesQueue(): Promise<OfflinePurchaseQueueItem[]> {
  return getAllFromStore<OfflinePurchaseQueueItem>('offline_purchases_queue');
}

export async function saveOfflinePurchaseToQueue(purchase: Purchase): Promise<void> {
  const queueItem: OfflinePurchaseQueueItem = {
    id: purchase.id,
    purchase,
    syncStatus: 'PENDING',
    retryCount: 0,
    createdAt: purchase.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Save to both the purchases store and the queue store
  await putInStore('purchases', purchase);
  await putInStore('offline_purchases_queue', queueItem);
}

export async function updateOfflinePurchaseQueueItem(
  id: string,
  syncStatus: OfflineQueueSyncStatus,
  lastError?: string
): Promise<void> {
  const item = await getFromStore<OfflinePurchaseQueueItem>('offline_purchases_queue', id);
  if (item) {
    item.syncStatus = syncStatus;
    item.updatedAt = new Date().toISOString();
    if (lastError) item.lastError = lastError;
    if (syncStatus === 'ERROR') item.retryCount += 1;
    await putInStore('offline_purchases_queue', item);

    // Also update purchase record in purchases store
    const purchase = await getFromStore<Purchase>('purchases', id);
    if (purchase) {
      purchase.syncStatus = syncStatus;
      purchase.isOfflineSync = syncStatus !== 'SYNCHRONIZED';
      if (lastError) purchase.offlineSyncError = lastError;
      if (syncStatus === 'SYNCHRONIZED') purchase.syncedAt = new Date().toISOString();
      await putInStore('purchases', purchase);
    }
  }
}

export async function removeOfflinePurchaseFromQueue(id: string): Promise<void> {
  await deleteFromStore('offline_purchases_queue', id);
  // Mark purchase in store as synchronized
  const purchase = await getFromStore<Purchase>('purchases', id);
  if (purchase) {
    purchase.syncStatus = 'SYNCHRONIZED';
    purchase.isOfflineSync = false;
    purchase.syncedAt = new Date().toISOString();
    await putInStore('purchases', purchase);
  }
}

// --- Sales & Sales Offline Queue ---
export async function getCachedSales(): Promise<Sale[]> {
  return getAllFromStore<Sale>('sales');
}
export async function saveCachedSales(sales: Sale[]): Promise<void> {
  return bulkPut('sales', sales);
}
export async function getOfflineSalesQueue(): Promise<OfflineSaleQueueItem[]> {
  return getAllFromStore<OfflineSaleQueueItem>('offline_sales_queue');
}
export async function saveOfflineSaleToQueue(sale: Sale): Promise<void> {
  const queueItem: OfflineSaleQueueItem = {
    id: sale.id,
    sale,
    syncStatus: 'PENDING',
    retryCount: 0,
    createdAt: sale.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await putInStore('sales', sale);
  await putInStore('offline_sales_queue', queueItem);
}
export async function removeOfflineSaleFromQueue(id: string): Promise<void> {
  await deleteFromStore('offline_sales_queue', id);
  const sale = await getFromStore<Sale>('sales', id);
  if (sale) {
    sale.isOfflineSync = false;
    await putInStore('sales', sale);
  }
}

// --- Stock Movements ---
export async function getCachedStockMovements(): Promise<StockMovement[]> {
  return getAllFromStore<StockMovement>('stock_movements');
}
export async function saveCachedStockMovements(movements: StockMovement[]): Promise<void> {
  return bulkPut('stock_movements', movements);
}
export async function addCachedStockMovement(movement: StockMovement): Promise<void> {
  return putInStore('stock_movements', movement);
}

// --- Cash Mutations ---
export async function getCachedCashMutations(): Promise<CashMutation[]> {
  return getAllFromStore<CashMutation>('cash_mutations');
}
export async function saveCachedCashMutations(mutations: CashMutation[]): Promise<void> {
  return bulkPut('cash_mutations', mutations);
}
export async function addCachedCashMutation(mutation: CashMutation): Promise<void> {
  return putInStore('cash_mutations', mutation);
}
