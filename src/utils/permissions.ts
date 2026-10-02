import { UserRole } from '../types';

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  OWNER: [
    'beranda',
    'kasir',
    'pesanan',
    'stok',
    'produksi',
    'resep',
    'menu',
    'diskon_promo',
    'biaya_platform',
    'perakitan',
    'pembelian',
    'vendor',
    'pengeluaran',
    'karyawan',
    'laporan_lengkap',
    'audit',
    'kas_saldo',
    'lainnya',
  ],
  ADMIN: [
    'beranda',
    'kasir',
    'pesanan',
    'stok',
    'produksi',
    'resep',
    'menu',
    'diskon_promo',
    'biaya_platform',
    'perakitan',
    'pembelian',
    'vendor',
    'pengeluaran',
    'karyawan',
    'laporan_lengkap',
    'audit',
    'kas_saldo',
    'lainnya',
  ],
  KASIR: [
    'beranda',
    'kasir',
    'produksi',
    'stok',
  ],
  KARYAWAN: [
    'beranda',
    'kasir',
    'produksi',
    'pesanan',
    'stok',
    'karyawan',
    'lainnya',
  ],
};

export const DEFAULT_ROLE_TAB: Record<UserRole, string> = {
  OWNER: 'beranda',
  ADMIN: 'beranda',
  KASIR: 'beranda',
  KARYAWAN: 'beranda',
};

export function isTabAllowedForRole(tab: string, role: UserRole): boolean {
  const allowed = ROLE_PERMISSIONS[role] || [];
  return allowed.includes(tab);
}
