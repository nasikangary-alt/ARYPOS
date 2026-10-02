import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Sale, OrderType } from '../../types';
import {
  formatRupiah,
  formatDateTimeIndonesian,
} from '../../utils/formatters';
import {
  normalizeSaleFinancials,
  getOrderTypeMeta,
  ORDER_TYPE_OPTIONS,
} from '../../utils/saleChannel';
import { ReceiptModal } from '../common/ReceiptModal';
import {
  Search,
  Receipt,
  Ban,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  MoreVertical,
  Eye,
  Printer,
  Download,
} from 'lucide-react';

type PeriodPreset = 'ALL' | 'TODAY' | '7DAYS' | 'MONTH' | 'CUSTOM';

interface OrdersViewProps {
  isDesktopWide?: boolean;
}

const SHORT_MONTHS_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

function formatCompactDateTime(dateStringOrObject: string | Date | undefined): string {
  if (!dateStringOrObject) return '-';
  const d = new Date(dateStringOrObject);
  if (isNaN(d.getTime())) return String(dateStringOrObject);
  const day = String(d.getDate()).padStart(2, '0');
  const month = SHORT_MONTHS_ID[d.getMonth()] || '';
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hours}:${minutes}`;
}

function getChannelBadgeStyle(orderType: string): { label: string; className: string } {
  switch (orderType) {
    case 'GOFOOD':
      return {
        label: 'GOFOOD',
        className: 'bg-[#ECFDF3] text-[#027A48] border border-[#ABEFC6]',
      };
    case 'GRABFOOD':
      return {
        label: 'GRABFOOD',
        className: 'bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]',
      };
    case 'SHOPEEFOOD':
      return {
        label: 'SHOPEEFOOD',
        className: 'bg-[#FFF4ED] text-[#C4320A] border border-[#F9DBAF]',
      };
    case 'OFFLINE':
    default:
      return {
        label: 'OFFLINE',
        className: 'bg-[#F2F4F7] text-[#344054] border border-[#E4E7EC]',
      };
  }
}

export const OrdersView: React.FC<OrdersViewProps> = ({ isDesktopWide = true }) => {
  const { sales, voidTransaction } = useApp();
  const { currentRole } = useAuth();

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'VOID'>('ALL');
  const [channelFilter, setChannelFilter] = useState<'ALL' | OrderType>('ALL');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal & Drawer States
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);
  const [saleToVoid, setSaleToVoid] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Date range bounds
  const computedDateBounds = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (periodPreset === 'TODAY') {
      return { start: todayStr, end: todayStr };
    }
    if (periodPreset === '7DAYS') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      return { start: sevenDaysAgo, end: todayStr };
    }
    if (periodPreset === 'MONTH') {
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      return { start: monthStart, end: todayStr };
    }
    if (periodPreset === 'CUSTOM') {
      return { start: startDate, end: endDate };
    }
    return { start: '', end: '' };
  }, [periodPreset, startDate, endDate]);

  // Filtered & Sorted Sales (Newest First)
  const filteredSales = useMemo(() => {
    let list = sales.filter((s) => {
      const fin = normalizeSaleFinancials(s);

      // Status Match
      const isVoid = s.status === 'VOID';
      if (statusFilter === 'COMPLETED' && isVoid) return false;
      if (statusFilter === 'VOID' && !isVoid) return false;

      // Channel Match
      if (channelFilter !== 'ALL' && fin.orderType !== channelFilter) return false;

      // Date Match
      const saleDateStr = s.date || (s.createdAt ? s.createdAt.split('T')[0] : '');
      if (computedDateBounds.start && saleDateStr < computedDateBounds.start) return false;
      if (computedDateBounds.end && saleDateStr > computedDateBounds.end) return false;

      // Search Match
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchSearch =
          s.transactionNo.toLowerCase().includes(q) ||
          s.items.some((i) => i.productName.toLowerCase().includes(q)) ||
          (s.cashierName && s.cashierName.toLowerCase().includes(q)) ||
          fin.orderType.toLowerCase().includes(q) ||
          (s.paymentMethod && s.paymentMethod.toLowerCase().includes(q));
        if (!matchSearch) return false;
      }

      return true;
    });

    // Deduplicate by ID
    const seen = new Set<string>();
    list = list.filter((item, idx) => {
      const key = item.id || `sale-${idx}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort newest first
    list.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.date).getTime();
      const timeB = new Date(b.createdAt || b.date).getTime();
      return timeB - timeA;
    });

    return list;
  }, [sales, statusFilter, channelFilter, computedDateBounds, searchQuery]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setChannelFilter('ALL');
    setPeriodPreset('ALL');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredSales.length === 0) {
      alert('Tidak ada data transaksi untuk diexport.');
      return;
    }

    const headers = [
      'No. Transaksi',
      'Tanggal',
      'Channel',
      'Item',
      'Total',
      'Diskon',
      'Biaya Platform',
      'Diterima',
      'Metode Pembayaran',
      'Status',
    ];

    const rows = filteredSales.map((s) => {
      const fin = normalizeSaleFinancials(s);
      const itemStr = s.items.map((i) => `${i.productName} x${i.quantity}`).join('; ');
      const isVoid = s.status === 'VOID';
      return [
        `"${s.transactionNo}"`,
        `"${formatDateTimeIndonesian(s.createdAt || s.date)}"`,
        `"${fin.orderType}"`,
        `"${itemStr}"`,
        fin.foodTotal || s.totalAmount || s.finalAmount,
        fin.itemDiscountTotal + fin.orderDiscount,
        fin.platformServiceFee,
        fin.netSettlementAmount || (s.finalAmount - fin.platformServiceFee),
        `"${s.paymentMethod || 'Tunai'}"`,
        `"${isVoid ? 'VOID' : 'SELESAI'}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Riwayat_Penjualan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pagination Slice
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage) || 1;
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSales.slice(start, start + itemsPerPage);
  }, [filteredSales, currentPage, itemsPerPage]);

  // Handle Void Confirmation
  const handleConfirmVoid = async () => {
    if (!saleToVoid) return;
    if (!voidReason.trim()) {
      alert('Mohon masukkan alasan pembatalan transaksi.');
      return;
    }
    setIsVoiding(true);
    try {
      await voidTransaction(saleToVoid, voidReason);
      setSaleToVoid(null);
      setVoidReason('');
      setSelectedSaleDetail(null);
      alert('Transaksi berhasil dibatalkan (VOID) dan stok produk telah dikembalikan.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membatalkan transaksi';
      alert(msg);
    } finally {
      setIsVoiding(false);
    }
  };

  const hasActiveFilter =
    Boolean(searchQuery.trim()) ||
    channelFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    periodPreset !== 'ALL';

  return (
    <div className="w-full max-w-full min-w-0 min-h-screen bg-[#F7F8FA] text-[#172033] p-4 sm:p-5 space-y-3.5">
      {/* 1. HEADER HALAMAN */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[#172033] tracking-tight">
            Riwayat Penjualan
          </h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Daftar seluruh transaksi penjualan dan status pembayaran.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCSV}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#172033] text-xs font-semibold transition cursor-pointer shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-[#667085]" />
          <span>Export</span>
        </button>
      </div>

      {/* 2. COMPACT WHITE FILTER & SEARCH TOOLBAR */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 space-y-2.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-[#98A2B3] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari no. transaksi, menu, channel..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs text-[#172033] placeholder:text-[#98A2B3] focus:outline-none focus:border-[#FF641F] transition"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Channel Dropdown */}
            <select
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value as 'ALL' | OrderType);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#172033] focus:outline-none focus:border-[#FF641F] cursor-pointer"
            >
              <option value="ALL">Semua Channel</option>
              {ORDER_TYPE_OPTIONS.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.shortLabel}
                </option>
              ))}
            </select>

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'ALL' | 'COMPLETED' | 'VOID');
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#172033] focus:outline-none focus:border-[#FF641F] cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="COMPLETED">Selesai</option>
              <option value="VOID">Void</option>
            </select>

            {/* Periode Dropdown */}
            <select
              value={periodPreset}
              onChange={(e) => {
                setPeriodPreset(e.target.value as PeriodPreset);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#172033] focus:outline-none focus:border-[#FF641F] cursor-pointer"
            >
              <option value="ALL">Periode: Semua</option>
              <option value="TODAY">Hari Ini</option>
              <option value="7DAYS">7 Hari Terakhir</option>
              <option value="MONTH">Bulan Ini</option>
              <option value="CUSTOM">Pilih Tanggal</option>
            </select>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] hover:bg-[#F2F4F7] text-xs font-medium text-[#667085] transition cursor-pointer"
                title="Reset Filter"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {periodPreset === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F2F4F7] text-xs">
            <span className="font-medium text-[#667085]">Rentang Tanggal:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-lg border border-[#E5E7EB] bg-white text-xs text-[#172033]"
            />
            <span className="text-[#98A2B3]">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-lg border border-[#E5E7EB] bg-white text-xs text-[#172033]"
            />
          </div>
        )}
      </div>

      {/* 3. WHITE TABLE CONTAINER */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden w-full">
        {filteredSales.length === 0 ? (
          <div className="py-14 px-4 text-center">
            <Receipt className="w-9 h-9 mx-auto mb-2.5 text-[#D0D5DD]" />
            <p className="text-xs font-semibold text-[#172033]">
              Tidak ada transaksi penjualan
            </p>
            <p className="text-[11px] text-[#667085] mt-0.5">
              Transaksi penjualan yang sesuai dengan pencarian atau filter akan tampil di sini.
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP HORIZONTAL TABLE */}
            <div className={isDesktopWide ? 'hidden md:block w-full overflow-x-auto' : 'hidden'}>
              <table className="w-full table-auto text-left border-collapse">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11px] font-semibold text-[#667085] uppercase tracking-wider">
                    <th className="py-2.5 pl-4 pr-2.5 min-w-[160px] w-[165px] whitespace-nowrap">
                      NO. TRANSAKSI
                    </th>
                    <th className="py-2.5 px-2.5 min-w-[125px] w-[135px] whitespace-nowrap">
                      TANGGAL
                    </th>
                    <th className="py-2.5 px-2 w-[96px] whitespace-nowrap">
                      CHANNEL
                    </th>
                    <th className="py-2.5 px-2.5 min-w-[180px]">
                      ITEM
                    </th>
                    <th className="py-2.5 px-2 w-[98px] text-right whitespace-nowrap">
                      TOTAL
                    </th>
                    <th className="py-2.5 px-2 w-[92px] text-right whitespace-nowrap">
                      DISKON
                    </th>
                    <th className="py-2.5 px-2 w-[108px] text-right whitespace-nowrap">
                      BIAYA PLATFORM
                    </th>
                    <th className="py-2.5 px-2.5 w-[104px] text-right whitespace-nowrap">
                      DITERIMA
                    </th>
                    <th className="py-2.5 px-2 w-[80px] text-center whitespace-nowrap">
                      STATUS
                    </th>
                    <th className="py-2.5 pl-2 pr-4 w-[88px] text-right whitespace-nowrap">
                      AKSI
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] text-xs">
                  {paginatedSales.map((sale) => {
                    const isVoid = sale.status === 'VOID';
                    const fin = normalizeSaleFinancials(sale);
                    const channelBadge = getChannelBadgeStyle(fin.orderType);
                    const totalQty = sale.items.reduce((acc, it) => acc + it.quantity, 0);

                    const itemPreview = sale.items.slice(0, 2);
                    const remainingItemCount = sale.items.length - 2;
                    const totalDiscount = fin.itemDiscountTotal + fin.orderDiscount;
                    const netAmount = fin.netSettlementAmount || (sale.finalAmount - fin.platformServiceFee);

                    return (
                      <tr
                        key={sale.id}
                        onClick={() => setSelectedSaleDetail(sale)}
                        className={`hover:bg-[#F9FAFB] transition cursor-pointer ${
                          isVoid ? 'bg-[#FEF3F2]/25' : 'bg-white'
                        }`}
                      >
                        {/* NO. TRANSAKSI — Never truncated or hidden */}
                        <td className="py-2.5 pl-4 pr-2.5 min-w-[160px] font-semibold text-[#172033] whitespace-nowrap align-middle">
                          {sale.transactionNo}
                        </td>

                        {/* TANGGAL */}
                        <td className="py-2.5 px-2.5 text-[#667085] whitespace-nowrap align-middle">
                          {formatCompactDateTime(sale.createdAt || sale.date)}
                        </td>

                        {/* CHANNEL */}
                        <td className="py-2.5 px-2 whitespace-nowrap align-middle">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${channelBadge.className}`}
                          >
                            {channelBadge.label}
                          </span>
                        </td>

                        {/* ITEM */}
                        <td className="py-2 px-2.5 align-middle">
                          <div className="text-[11px] font-semibold text-[#172033] leading-snug">
                            {totalQty} item ({sale.items.length} jenis)
                          </div>
                          <div className="text-[11px] text-[#667085] leading-tight mt-0.5 space-y-0.5 max-w-[240px] xl:max-w-[320px]">
                            {itemPreview.map((it, idx) => (
                              <div key={idx} className="truncate">
                                {it.productName} <span className="font-medium text-[#344054]">×{it.quantity}</span>
                              </div>
                            ))}
                            {remainingItemCount > 0 && (
                              <div className="text-[10px] font-medium text-[#FF641F]">
                                +{remainingItemCount} item lainnya
                              </div>
                            )}
                          </div>
                        </td>

                        {/* TOTAL */}
                        <td className="py-2.5 px-2 text-right font-medium text-[#172033] whitespace-nowrap tabular-nums align-middle">
                          {formatRupiah(fin.foodTotal || sale.totalAmount)}
                        </td>

                        {/* DISKON */}
                        <td className="py-2.5 px-2 text-right whitespace-nowrap tabular-nums align-middle font-medium text-[#D92D20]">
                          {totalDiscount > 0 ? (
                            `-${formatRupiah(totalDiscount)}`
                          ) : (
                            <span className="text-[#98A2B3]">-</span>
                          )}
                        </td>

                        {/* BIAYA PLATFORM */}
                        <td className="py-2.5 px-2 text-right whitespace-nowrap tabular-nums align-middle font-medium text-[#D92D20]">
                          {fin.platformServiceFee > 0 ? (
                            `-${formatRupiah(fin.platformServiceFee)}`
                          ) : (
                            <span className="text-[#98A2B3]">-</span>
                          )}
                        </td>

                        {/* DITERIMA */}
                        <td className="py-2.5 px-2.5 text-right whitespace-nowrap tabular-nums align-middle">
                          <span
                            className={`font-bold text-[13px] ${
                              isVoid ? 'line-through text-[#98A2B3]' : 'text-[#027A48]'
                            }`}
                          >
                            {formatRupiah(netAmount)}
                          </span>
                        </td>

                        {/* STATUS */}
                        <td className="py-2.5 px-2 text-center whitespace-nowrap align-middle">
                          {isVoid ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FEF3F2] text-[#D92D20] border border-[#FECDCA]">
                              Void
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#ECFDF3] text-[#027A48] border border-[#ABEFC6]">
                              Selesai
                            </span>
                          )}
                        </td>

                        {/* AKSI */}
                        <td
                          className="py-2.5 pl-2 pr-4 text-right whitespace-nowrap align-middle"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="relative inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedSaleDetail(sale)}
                              className="px-2.5 py-1 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-[#172033] font-medium text-xs transition cursor-pointer"
                            >
                              Lihat
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setActiveMenuId(activeMenuId === sale.id ? null : sale.id)
                              }
                              className="p-1 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-[#667085] transition cursor-pointer"
                              title="Menu Aksi"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {activeMenuId === sale.id && (
                              <div
                                className="absolute right-0 top-full mt-1 z-30 bg-white rounded-xl border border-[#E5E7EB] shadow-lg py-1 w-38 text-left"
                                onMouseLeave={() => setActiveMenuId(null)}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSaleDetail(sale);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs font-medium text-[#172033] hover:bg-[#F9FAFB] flex items-center gap-2 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-[#667085]" />
                                  <span>Lihat Detail</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSaleForReceipt(sale);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs font-medium text-[#172033] hover:bg-[#F9FAFB] flex items-center gap-2 cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5 text-[#667085]" />
                                  <span>Cetak Struk</span>
                                </button>
                                {!isVoid && currentRole !== 'KASIR' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSaleToVoid(sale);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs font-medium text-[#D92D20] hover:bg-[#FEF3F2] flex items-center gap-2 cursor-pointer"
                                  >
                                    <Ban className="w-3.5 h-3.5 text-[#D92D20]" />
                                    <span>Void Transaksi</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE COMPACT TRANSACTION LIST */}
            <div className={isDesktopWide ? 'block md:hidden divide-y divide-[#E5E7EB]' : 'block divide-y divide-[#E5E7EB]'}>
              {paginatedSales.map((sale) => {
                const isVoid = sale.status === 'VOID';
                const fin = normalizeSaleFinancials(sale);
                const orderMeta = getOrderTypeMeta(fin.orderType);
                const netAmount = fin.netSettlementAmount || (sale.finalAmount - fin.platformServiceFee);
                const firstTwoItems = sale.items
                  .slice(0, 2)
                  .map((i) => `${i.productName} ×${i.quantity}`)
                  .join(', ');
                const extraCount = sale.items.length - 2;

                return (
                  <div
                    key={sale.id}
                    onClick={() => setSelectedSaleDetail(sale)}
                    className={`p-3.5 space-y-1.5 hover:bg-[#F9FAFB] transition cursor-pointer ${
                      isVoid ? 'bg-[#FEF3F2]/25' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-xs text-[#172033]">
                          {sale.transactionNo}
                        </div>
                        <div className="text-[11px] text-[#667085] mt-0.5">
                          {orderMeta.shortLabel} &middot; {formatCompactDateTime(sale.createdAt || sale.date)}
                        </div>
                      </div>
                      {isVoid ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FEF3F2] text-[#D92D20] border border-[#FECDCA]">
                          Void
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#ECFDF3] text-[#027A48] border border-[#ABEFC6]">
                          Selesai
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[#344054] truncate">
                      {firstTwoItems}
                      {extraCount > 0 ? ` (+${extraCount} item lainnya)` : ''}
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <div className="text-xs font-medium text-[#172033] tabular-nums">
                        {formatRupiah(fin.foodTotal || sale.totalAmount)}{' '}
                        <span className="text-[#98A2B3]">&rarr;</span>{' '}
                        <span className={isVoid ? 'line-through text-[#98A2B3]' : 'font-bold text-[#027A48]'}>
                          {formatRupiah(netAmount)}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-[#FF641F]">
                        Lihat
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PAGINATION FOOTER */}
            <div className="px-4 py-3 border-t border-[#E5E7EB] bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#667085]">
              <div>
                Menampilkan{' '}
                <span className="font-semibold text-[#172033]">
                  {filteredSales.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
                </span>
                –
                <span className="font-semibold text-[#172033]">
                  {Math.min(currentPage * itemsPerPage, filteredSales.length)}
                </span>{' '}
                dari <span className="font-semibold text-[#172033]">{filteredSales.length}</span> transaksi
              </div>

              <div className="flex items-center gap-2.5">
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#172033] cursor-pointer"
                >
                  <option value={10}>10 / halaman</option>
                  <option value={20}>20 / halaman</option>
                  <option value={50}>50 / halaman</option>
                </select>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded-lg border border-[#E5E7EB] bg-white text-[#667085] hover:bg-[#F9FAFB] disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))
                    .map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          currentPage === p
                            ? 'bg-[#FF641F] text-white'
                            : 'border border-[#E5E7EB] bg-white text-[#344054] hover:bg-[#F9FAFB]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded-lg border border-[#E5E7EB] bg-white text-[#667085] hover:bg-[#F9FAFB] disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 4. DETAIL TRANSAKSI DRAWER */}
      {selectedSaleDetail && (() => {
        const sale = selectedSaleDetail;
        const isVoid = sale.status === 'VOID';
        const fin = normalizeSaleFinancials(sale);
        const orderMeta = getOrderTypeMeta(fin.orderType);
        const channelBadge = getChannelBadgeStyle(fin.orderType);
        const totalDiscount = fin.itemDiscountTotal + fin.orderDiscount;
        const netAmount = fin.netSettlementAmount || (sale.finalAmount - fin.platformServiceFee);

        return (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-2xs">
            <div className="bg-white w-full max-w-md h-full shadow-xl flex flex-col justify-between border-l border-[#E5E7EB]">
              {/* Drawer Header */}
              <div className="p-5 border-b border-[#E5E7EB] flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#172033]">
                    Detail Transaksi
                  </h3>
                  <div className="text-xs font-semibold text-[#172033] mt-1">
                    {sale.transactionNo}
                  </div>
                  <div className="text-[11px] text-[#667085] mt-0.5">
                    {formatCompactDateTime(sale.createdAt || sale.date)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSaleDetail(null)}
                  className="p-1.5 rounded-lg text-[#667085] hover:text-[#172033] hover:bg-[#F9FAFB] transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="p-5 space-y-5 overflow-y-auto flex-1">
                {/* Channel & Status Info */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] text-xs">
                  <div>
                    <span className="text-[11px] text-[#667085] block mb-1">Channel</span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${channelBadge.className}`}
                    >
                      {orderMeta.shortLabel}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#667085] block mb-1">Status</span>
                    {isVoid ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FEF3F2] text-[#D92D20] border border-[#FECDCA]">
                        Void
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#ECFDF3] text-[#027A48] border border-[#ABEFC6]">
                        Selesai
                      </span>
                    )}
                  </div>
                </div>

                {/* Item List */}
                <div>
                  <h4 className="text-xs font-semibold text-[#667085] uppercase tracking-wider mb-2">
                    Item
                  </h4>
                  <div className="divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
                    {sale.items.map((it, idx) => (
                      <div key={idx} className="py-2.5 flex items-start justify-between text-xs">
                        <div>
                          <span className="font-semibold text-[#172033] block">
                            {it.productName} ×{it.quantity}
                          </span>
                          <span className="text-[11px] text-[#667085]">
                            @ {formatRupiah(it.sellingPrice)}
                          </span>
                        </div>
                        <span className="font-semibold text-[#172033] tabular-nums">
                          {formatRupiah(it.subtotal || it.quantity * it.sellingPrice)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ringkasan */}
                <div>
                  <h4 className="text-xs font-semibold text-[#667085] uppercase tracking-wider mb-2">
                    Ringkasan
                  </h4>
                  <div className="p-3.5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] space-y-2 text-xs">
                    <div className="flex justify-between text-[#667085]">
                      <span>Total Belanja</span>
                      <span className="font-semibold text-[#172033] tabular-nums">
                        {formatRupiah(fin.foodTotal || sale.totalAmount)}
                      </span>
                    </div>

                    <div className="flex justify-between text-[#667085]">
                      <span>Diskon</span>
                      <span className={totalDiscount > 0 ? 'font-semibold text-[#D92D20] tabular-nums' : 'text-[#98A2B3]'}>
                        {totalDiscount > 0 ? `-${formatRupiah(totalDiscount)}` : '-Rp 0'}
                      </span>
                    </div>

                    <div className="flex justify-between text-[#667085]">
                      <span>Biaya Platform</span>
                      <span className={fin.platformServiceFee > 0 ? 'font-semibold text-[#D92D20] tabular-nums' : 'text-[#98A2B3]'}>
                        {fin.platformServiceFee > 0 ? `-${formatRupiah(fin.platformServiceFee)}` : '-Rp 0'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-[#E5E7EB] flex justify-between text-sm font-bold text-[#172033]">
                      <span>Net Diterima</span>
                      <span className="text-[#027A48] tabular-nums">
                        {formatRupiah(netAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pembayaran */}
                <div>
                  <h4 className="text-xs font-semibold text-[#667085] uppercase tracking-wider mb-2">
                    Pembayaran
                  </h4>
                  <div className="p-3.5 rounded-xl bg-white border border-[#E5E7EB] space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#667085]">Metode / Wallet</span>
                      <span className="font-semibold text-[#172033]">
                        {fin.isMarketplace ? `Dompet ${orderMeta.shortLabel}` : sale.paymentMethod || 'Tunai'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#667085]">Kasir</span>
                      <span className="font-medium text-[#172033]">
                        {sale.cashierName || 'Kasir'}
                      </span>
                    </div>
                    {isVoid && sale.voidReason && (
                      <div className="pt-1.5 border-t border-[#E5E7EB] flex justify-between text-[#D92D20]">
                        <span>Alasan Void</span>
                        <span className="font-semibold">{sale.voidReason}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-[#E5E7EB] bg-white flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSaleForReceipt(sale)}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-xs font-semibold text-[#172033] transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[#667085]" />
                  <span>Cetak Struk</span>
                </button>

                <div className="flex items-center gap-2">
                  {!isVoid && currentRole !== 'KASIR' && (
                    <button
                      type="button"
                      onClick={() => setSaleToVoid(sale)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#FECDCA] bg-[#FEF3F2] hover:bg-[#FEE4E2] text-xs font-semibold text-[#D92D20] transition cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Void</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedSaleDetail(null)}
                    className="px-4 py-2 rounded-xl bg-[#172033] hover:bg-[#25324B] text-white text-xs font-semibold transition cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 5. THERMAL RECEIPT MODAL */}
      {selectedSaleForReceipt && (
        <ReceiptModal
          sale={selectedSaleForReceipt}
          onClose={() => setSelectedSaleForReceipt(null)}
        />
      )}

      {/* 6. VOID CONFIRMATION MODAL */}
      {saleToVoid && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-[#E5E7EB] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2.5">
              <h3 className="font-bold text-sm text-[#D92D20] flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Batalkan Transaksi (VOID)</span>
              </h3>
              <button
                type="button"
                onClick={() => setSaleToVoid(null)}
                className="p-1 rounded-full text-[#98A2B3] hover:text-[#172033] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#667085]">
              Membatalkan <strong className="text-[#172033]">{saleToVoid.transactionNo}</strong> senilai{' '}
              <strong className="text-[#D92D20]">{formatRupiah(saleToVoid.finalAmount)}</strong> akan mengembalikan produk ke stok siap jual.
            </p>

            <div>
              <label className="text-[11px] font-semibold text-[#172033] block mb-1">
                Alasan Pembatalan <span className="text-[#D92D20]">*</span>
              </label>
              <input
                type="text"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Misal: Salah input menu, pelanggan cancel"
                required
                className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] bg-white text-xs text-[#172033] focus:outline-none focus:border-[#D92D20]"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSaleToVoid(null)}
                className="flex-1 py-2 rounded-xl border border-[#E5E7EB] bg-white text-xs font-semibold text-[#667085] hover:bg-[#F9FAFB] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isVoiding || !voidReason.trim()}
                onClick={handleConfirmVoid}
                className="flex-1 py-2 rounded-xl bg-[#D92D20] hover:bg-[#B42318] text-white font-semibold text-xs shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {isVoiding ? 'Membatalkan...' : 'Konfirmasi VOID'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
