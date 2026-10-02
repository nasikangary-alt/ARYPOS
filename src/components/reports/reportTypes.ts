export type ReportCategoryId =
  | 'RINGKASAN'
  | 'PENJUALAN'
  | 'PEMBELIAN'
  | 'PERSEDIAAN'
  | 'KEUANGAN';

export type ReportId =
  // A. RINGKASAN
  | 'ringkasan_usaha'
  // B. PENJUALAN
  | 'detail_penjualan'
  | 'penjualan_per_menu'
  | 'penjualan_per_channel'
  | 'penjualan_per_periode'
  // C. PEMBELIAN
  | 'detail_pembelian'
  | 'pembelian_per_produk'
  | 'pembelian_per_supplier'
  | 'hutang_supplier'
  // D. PERSEDIAAN
  | 'ringkasan_stok'
  | 'pergerakan_stok'
  | 'stok_produk_produksi'
  | 'pemakaian_bahan'
  // E. KEUANGAN
  | 'laba_rugi'
  | 'arus_kas'
  | 'pengeluaran'
  | 'kas_rekening';

export type PeriodPreset =
  | 'TODAY'
  | 'YESTERDAY'
  | 'THIS_WEEK'
  | 'LAST_WEEK'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_YEAR'
  | 'CUSTOM'
  | 'ALL';

export type ComparePeriodMode =
  | 'NONE'
  | 'PREV_PERIOD'
  | 'PREV_MONTH'
  | 'PREV_YEAR';

export interface ReportDefinition {
  id: ReportId;
  category: ReportCategoryId;
  title: string;
  formalTitle: string;
  description: string;
}

export const REPORT_CATEGORIES: Array<{
  id: ReportCategoryId;
  label: string;
  subtitle: string;
}> = [
  {
    id: 'RINGKASAN',
    label: 'RINGKASAN',
    subtitle: 'Gambaran menyeluruh performa usaha, arus kas, dan posisi aset',
  },
  {
    id: 'PENJUALAN',
    label: 'PENJUALAN',
    subtitle: 'Analisis transaksi kasir POS, performa menu, dan channel online',
  },
  {
    id: 'PEMBELIAN',
    label: 'PEMBELIAN',
    subtitle: 'Rincian faktur belanja bahan baku, produk, vendor, dan hutang PO',
  },
  {
    id: 'PERSEDIAAN',
    label: 'PERSEDIAAN',
    subtitle: 'Valuasi stok bahan, produk hasil produksi, mutasi, dan pemakaian',
  },
  {
    id: 'KEUANGAN',
    label: 'KEUANGAN',
    subtitle: 'Laporan Laba Rugi, Arus Kas (Cash Basis), pengeluaran, dan saldo rekening',
  },
];

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  // A. RINGKASAN
  {
    id: 'ringkasan_usaha',
    category: 'RINGKASAN',
    title: 'Ringkasan Usaha',
    formalTitle: 'Laporan Ringkasan Usaha',
    description: 'Ikhtisar eksekutif penjualan, laba rugi, kas operasional bersih, pembelian, stok & saldo kas',
  },
  // B. PENJUALAN
  {
    id: 'detail_penjualan',
    category: 'PENJUALAN',
    title: 'Detail Penjualan',
    formalTitle: 'Laporan Detail Penjualan',
    description: 'Rincian seluruh transaksi penjualan per nota beserta diskon & potongan platform',
  },
  {
    id: 'penjualan_per_menu',
    category: 'PENJUALAN',
    title: 'Penjualan per Menu',
    formalTitle: 'Laporan Penjualan per Menu',
    description: 'Penjualan berdasarkan menu, kuantitas porsi terjual, HPP, dan margin',
  },
  {
    id: 'penjualan_per_channel',
    category: 'PENJUALAN',
    title: 'Penjualan per Channel',
    formalTitle: 'Laporan Penjualan per Channel',
    description: 'Offline, GoFood, GrabFood, ShopeeFood beserta biaya admin & dana masuk',
  },
  {
    id: 'penjualan_per_periode',
    category: 'PENJUALAN',
    title: 'Penjualan per Periode',
    formalTitle: 'Laporan Penjualan per Periode',
    description: 'Rekapitulasi tren penjualan harian dan bulanan',
  },
  // C. PEMBELIAN
  {
    id: 'detail_pembelian',
    category: 'PEMBELIAN',
    title: 'Detail Pembelian',
    formalTitle: 'Laporan Detail Pembelian',
    description: 'Rincian pembelian bahan dan produk beserta status pembayaran PO',
  },
  {
    id: 'pembelian_per_produk',
    category: 'PEMBELIAN',
    title: 'Pembelian per Produk/Bahan',
    formalTitle: 'Laporan Pembelian per Produk & Bahan',
    description: 'Total kuantitas dan nilai pembelian berdasarkan item bahan baku / produk',
  },
  {
    id: 'pembelian_per_supplier',
    category: 'PEMBELIAN',
    title: 'Pembelian per Supplier',
    formalTitle: 'Laporan Pembelian per Supplier',
    description: 'Total pembelian, pembayaran, dan sisa hutang berdasarkan supplier/vendor',
  },
  {
    id: 'hutang_supplier',
    category: 'PEMBELIAN',
    title: 'Hutang Supplier',
    formalTitle: 'Laporan Hutang Supplier',
    description: 'Daftar faktur pembelian yang belum lunas dan kewajiban jatuh tempo',
  },
  // D. PERSEDIAAN
  {
    id: 'ringkasan_stok',
    category: 'PERSEDIAAN',
    title: 'Ringkasan Stok',
    formalTitle: 'Laporan Ringkasan Stok Persediaan',
    description: 'Posisi stok terkini bahan baku, kemasan & barang siap jual beserta nilai aset',
  },
  {
    id: 'pergerakan_stok',
    category: 'PERSEDIAAN',
    title: 'Pergerakan Stok',
    formalTitle: 'Laporan Pergerakan Stok (Mutasi)',
    description: 'Stok masuk, keluar dan penyesuaian dari pembelian, produksi & penjualan',
  },
  {
    id: 'stok_produk_produksi',
    category: 'PERSEDIAAN',
    title: 'Stok Produk Hasil Produksi',
    formalTitle: 'Laporan Stok Produk Hasil Produksi',
    description: 'Posisi stok produk olahan dapur, HPP/unit, dan riwayat batch produksi',
  },
  {
    id: 'pemakaian_bahan',
    category: 'PERSEDIAAN',
    title: 'Pemakaian Bahan',
    formalTitle: 'Laporan Pemakaian Bahan Baku & Kemasan',
    description: 'Rekapitulasi konsumsi bahan untuk produksi dapur dan penjualan POS',
  },
  // E. KEUANGAN
  {
    id: 'laba_rugi',
    category: 'KEUANGAN',
    title: 'Laporan Laba Rugi',
    formalTitle: 'Laporan Laba Rugi & Arus Kas Operasional',
    description: 'Laba Rugi berbasis HPP produk terjual, Realisasi Kas Operasional, Rekonsiliasi Laba & Arus Kas, serta Persediaan',
  },
  {
    id: 'arus_kas',
    category: 'KEUANGAN',
    title: 'Laporan Arus Kas',
    formalTitle: 'Laporan Arus Kas (Cash Basis)',
    description: 'Uang masuk aktual dikurangi uang keluar aktual (pembelian dibayar, biaya & mutasi kas)',
  },
  {
    id: 'pengeluaran',
    category: 'KEUANGAN',
    title: 'Pengeluaran',
    formalTitle: 'Laporan Pengeluaran Operasional',
    description: 'Rincian pengeluaran biaya operasional toko per kategori & riwayat catatan',
  },
  {
    id: 'kas_rekening',
    category: 'KEUANGAN',
    title: 'Kas & Rekening',
    formalTitle: 'Laporan Posisi Kas, Bank & Wallet Platform',
    description: 'Saldo dan mutasi Kas Kasir, QRIS, Kas Owner, Bank & Wallet Aplikasi',
  },
];

export const PERIOD_OPTIONS: Array<{ id: PeriodPreset; label: string }> = [
  { id: 'TODAY', label: 'Hari Ini' },
  { id: 'YESTERDAY', label: 'Kemarin' },
  { id: 'THIS_WEEK', label: 'Minggu Ini' },
  { id: 'LAST_WEEK', label: 'Minggu Lalu' },
  { id: 'THIS_MONTH', label: 'Bulan Ini' },
  { id: 'LAST_MONTH', label: 'Bulan Lalu' },
  { id: 'THIS_YEAR', label: 'Tahun Ini' },
  { id: 'CUSTOM', label: 'Custom' },
  { id: 'ALL', label: 'Semua' },
];

export const COMPARE_OPTIONS: Array<{ id: ComparePeriodMode; label: string }> = [
  { id: 'NONE', label: 'Tidak ada' },
  { id: 'PREV_PERIOD', label: 'Periode sebelumnya' },
  { id: 'PREV_MONTH', label: 'Bulan sebelumnya' },
  { id: 'PREV_YEAR', label: 'Tahun sebelumnya' },
];

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  gaji: 'Gaji',
  listrik: 'Listrik',
  gas: 'Gas',
  transport: 'Transportasi',
  sewa: 'Sewa',
  packaging: 'Perlengkapan & Kemasan',
  'bahan baku': 'Bahan Dapur (Non-PO)',
  lainnya: 'Beban Operasional Lainnya',
};

export const ORDERED_OPERATIONAL_EXPENSE_KEYS: string[] = [
  'gaji',
  'listrik',
  'gas',
  'transport',
  'sewa',
  'packaging',
  'bahan baku',
  'lainnya',
];
