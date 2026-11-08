import {
  Sale,
  Ingredient,
  Product,
  UserProfile,
  Assembly,
} from '../types';
import {
  getNextTransactionNumber,
  isOfflineTransactionNo,
} from './transactionCounter';
import {
  doc,
  getDoc,
  setDoc,
  Firestore,
} from 'firebase/firestore';
import { sanitizeFirestore } from '../utils/sanitizeFirestore';
import { processSaleStockDeduction } from './stockEngine';

const OFFLINE_SALES_KEY = 'geprek_ary_offline_sales';

export type NetworkSyncStatus = 'SYNCHRONIZED' | 'PENDING' | 'OFFLINE';

export interface SyncState {
  status: NetworkSyncStatus;
  pendingCount: number;
  label: string;
  badgeClass: string;
}

export function getOfflineSales(): Sale[] {
  try {
    const raw = localStorage.getItem(OFFLINE_SALES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading offline sales:', e);
    return [];
  }
}

export async function getOfflineSalesAsync(): Promise<Sale[]> {
  return getOfflineSales();
}

export function saveOfflineSale(sale: Sale): void {
  try {
    const existing = getOfflineSales();
    const updated = [sale, ...existing.filter((s) => s.id !== sale.id)];
    localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving offline sale:', e);
  }
}

export function removeOfflineSale(id: string): void {
  try {
    const existing = getOfflineSales();
    const updated = existing.filter((s) => s.id !== id);
    localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error removing offline sale:', e);
  }
}

export async function removeOfflineSaleAsync(id: string): Promise<void> {
  removeOfflineSale(id);
}

export function clearAllOfflineSales(): void {
  try {
    localStorage.removeItem(OFFLINE_SALES_KEY);
  } catch (e) {
    console.error('Error clearing offline sales:', e);
  }
}

export function getSyncState(
  isOnline: boolean,
  pendingCount: number
): SyncState {
  if (!isOnline) {
    return {
      status: 'OFFLINE',
      pendingCount,
      label: pendingCount > 0 ? `🔴 Offline (${pendingCount})` : '🔴 Offline',
      badgeClass: 'bg-rose-600 text-white',
    };
  }

  if (pendingCount > 0) {
    return {
      status: 'PENDING',
      pendingCount,
      label: `🟡 Menunggu sync (${pendingCount})`,
      badgeClass: 'bg-amber-500 text-white animate-pulse',
    };
  }

  return {
    status: 'SYNCHRONIZED',
    pendingCount: 0,
    label: '🟢 Tersinkron',
    badgeClass: 'bg-emerald-600 text-white',
  };
}

// ============================================================================
// FIRESTORE ATOMIC & IDEMPOTENT SYNC ENGINE (Tahap 4)
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
