import { Sale } from '../types';

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
    console.error('Failed to read offline sales', e);
    return [];
  }
}

export function saveOfflineSale(sale: Sale): void {
  const current = getOfflineSales();
  current.push({ ...sale, isOfflineSync: true });
  localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(current));
}

export function clearOfflineSales(): void {
  localStorage.removeItem(OFFLINE_SALES_KEY);
}

export function removeOfflineSale(saleId: string): void {
  const current = getOfflineSales();
  const filtered = current.filter(s => s.id !== saleId);
  localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(filtered));
}

export function getSyncState(isOnline: boolean, pendingCount: number): SyncState {
  if (!isOnline) {
    return {
      status: 'OFFLINE',
      pendingCount,
      label: pendingCount > 0 ? `🔴 Offline (${pendingCount} tertunda)` : '🔴 Offline',
      badgeClass: 'bg-red-500 text-white',
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
