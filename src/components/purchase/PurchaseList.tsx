import React, { useState, useMemo } from 'react';
import { Purchase, PaymentStatus } from '../../types';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatRupiah, formatDate, formatNumber } from '../../utils/formatters';
import { PageHeader } from '../common/PageHeader';
import { SummaryBar } from '../common/SummaryBar';
import { PurchaseStatusBadge } from './PurchaseStatusBadge';
import { QuickDrawerPurchaseModal } from './QuickDrawerPurchaseModal';
import {
  Plus,
  Search,
  Calendar,
  Building2,
  Filter,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
  ShoppingBag,
  Clock,
  AlertTriangle,
  X,
  CreditCard,
  FileText,
  Zap,
} from 'lucide-react';

interface PurchaseListProps {
  onCreatePurchase: () => void;
  onSelectPurchase: (purchaseId: string) => void;
  onEditPurchase: (purchase: Purchase) => void;
  isDesktopWide?: boolean;
}

export const PurchaseList: React.FC<PurchaseListProps> = ({
  onCreatePurchase,
  onSelectPurchase,
  onEditPurchase,
  isDesktopWide = false,
}) => {
  const { purchases, vendors } = useApp();
  const { currentRole } = useAuth();

  const [showQuickPurchaseModal, setShowQuickPurchaseModal] = useState(false);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'SEMUA' | PaymentStatus>('SEMUA');
  const [dateRangeFilter, setDateRangeFilter] = useState<
    'HARI_INI' | 'MINGGU_INI' | 'BULAN_INI' | 'SEMUA'
  >('BULAN_INI');
  const [vendorFilter, setVendorFilter] = useState<string>('SEMUA');

  // Filtered Purchases
  const filteredPurchases = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return purchases.filter(p => {
      // 1. Status Filter
      if (statusFilter !== 'SEMUA') {
        const pStatus = p.paymentStatus || (p.paidAmount >= p.totalAmount ? 'LUNAS' : p.paidAmount > 0 ? 'SEBAGIAN' : 'BELUM_DIBAYAR');
        if (pStatus !== statusFilter) return false;
      }

      // 2. Vendor Filter
      if (vendorFilter !== 'SEMUA') {
        if (p.vendorId !== vendorFilter && (p.vendorName || p.supplier) !== vendorFilter) {
          return false;
        }
      }

      // 3. Date Range Filter
      if (dateRangeFilter === 'HARI_INI') {
        if (p.date !== todayStr) return false;
      } else if (dateRangeFilter === 'MINGGU_INI') {
        const pDateObj = new Date(p.date);
        const diffTime = Math.abs(now.getTime() - pDateObj.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) return false;
      } else if (dateRangeFilter === 'BULAN_INI') {
        const pDateObj = new Date(p.date);
        if (
          pDateObj.getMonth() !== now.getMonth() ||
          pDateObj.getFullYear() !== now.getFullYear()
        ) {
          return false;
        }
      }

      // 4. Text Search (Nomor, Vendor, Invoice, Referensi, Notes)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const vNameStr = (p.vendorName || p.supplier || '').toLowerCase();
        const pNo = (p.purchaseNo || '').toLowerCase();
        const inv = (p.invoiceNo || '').toLowerCase();
        const ref = (p.reference || '').toLowerCase();
        const note = (p.notes || '').toLowerCase();
        return (
          vNameStr.includes(q) ||
          pNo.includes(q) ||
          inv.includes(q) ||
          ref.includes(q) ||
          note.includes(q)
        );
      }

      return true;
    });
  }, [purchases, statusFilter, dateRangeFilter, vendorFilter, searchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const activePurchases = purchases.filter(p => p.status !== 'VOID');
    const thisMonthPurchases = activePurchases.filter(p => {
      const pDateObj = new Date(p.date);
      return (
        pDateObj.getMonth() === now.getMonth() &&
        pDateObj.getFullYear() === now.getFullYear()
      );
    });

    const totalBulanIni = thisMonthPurchases.reduce(
      (acc, p) => acc + (p.totalAmount || p.totalCost || 0),
      0
    );
    const sudahDibayar = thisMonthPurchases.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
    const totalHutang = activePurchases.reduce(
      (acc, p) => acc + (p.remainingAmount !== undefined ? p.remainingAmount : Math.max(0, p.totalAmount - p.paidAmount)),
      0
    );
    const totalTransaksi = thisMonthPurchases.length;

    return {
      totalBulanIni,
      sudahDibayar,
      totalHutang,
      totalTransaksi,
    };
  }, [purchases]);

  return (
    <div className="space-y-5 pb-20">
      {/* Global PageHeader */}
      <PageHeader
        title="Pembelian"
        description="Kelola transaksi pembelian bahan, supplier, tagihan dan pembayaran."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowQuickPurchaseModal(true)}
              className="h-10 px-3.5 rounded-xl bg-[#FFF4ED] hover:bg-[#FFE6D5] border border-[#FFD9C2] text-[#FF641F] font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-[#FF641F]" />
              <span>Belanja Cepat Laci</span>
            </button>
            <button
              type="button"
              onClick={onCreatePurchase}
              className="h-10 px-4 rounded-xl bg-[#FF641F] hover:bg-[#E04F16] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Tambah Pembelian</span>
            </button>
          </div>
        }
      />

      {/* Summary Bar */}
      <SummaryBar
        items={[
          {
            label: 'Total Pembelian Bulan Ini',
            value: formatRupiah(metrics.totalBulanIni),
            subValue: `${metrics.totalTransaksi} transaksi bulan ini`,
          },
          {
            label: 'Sudah Dibayar',
            value: formatRupiah(metrics.sudahDibayar),
            valueClassName: 'text-[#12B76A]',
          },
          {
            label: 'Belum Dibayar (Hutang)',
            value: formatRupiah(metrics.totalHutang),
            valueClassName: metrics.totalHutang > 0 ? 'text-[#D92D20]' : 'text-[#172033]',
          },
          {
            label: 'Total Transaksi',
            value: `${metrics.totalTransaksi} PO`,
          },
        ]}
      />

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E8ECF2] shadow-xs space-y-3.5">
        {/* Top: Search and Dropdown Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#A0AEC0] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nomor transaksi (PB-00001), supplier, invoice, referensi..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#FF641F] focus:bg-white transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#172033] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Range & Vendor Filter */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Date Range */}
            <select
              value={dateRangeFilter}
              onChange={e => setDateRangeFilter(e.target.value as any)}
              className="px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-bold text-[#172033] focus:outline-none focus:border-[#FF641F] cursor-pointer"
            >
              <option value="HARI_INI">Hari Ini</option>
              <option value="MINGGU_INI">Minggu Ini</option>
              <option value="BULAN_INI">Bulan Ini</option>
              <option value="SEMUA">Semua Tanggal</option>
            </select>

            {/* Vendor Filter */}
            <select
              value={vendorFilter}
              onChange={e => setVendorFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-bold text-[#172033] focus:outline-none focus:border-[#FF641F] cursor-pointer max-w-[180px] truncate"
            >
              <option value="SEMUA">Semua Supplier</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-[#E8ECF2] overflow-x-auto scrollbar-none">
          {[
            { id: 'SEMUA', label: 'Semua Status' },
            { id: 'BELUM_DIBAYAR', label: 'Belum Dibayar' },
            { id: 'SEBAGIAN', label: 'Dibayar Sebagian' },
            { id: 'LUNAS', label: 'Lunas' },
          ].map(tab => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-[#172033] text-white shadow-2xs'
                    : 'bg-[#F7F8FA] text-[#667085] hover:bg-[#E8ECF2] hover:text-[#172033]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Purchase Records List / Table */}
      <div className="bg-white rounded-2xl border border-[#E8ECF2] shadow-xs overflow-hidden">
        {filteredPurchases.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ShoppingBag className="w-12 h-12 text-[#A0AEC0] mx-auto" />
            <h3 className="text-sm font-bold text-[#172033]">
              Tidak ada transaksi pembelian yang cocok
            </h3>
            <p className="text-xs text-[#667085] max-w-sm mx-auto">
              Coba sesuaikan kata kunci pencarian atau filter status untuk melihat transaksi lainnya.
            </p>
            <button
              type="button"
              onClick={onCreatePurchase}
              className="mt-2 px-4 py-2 rounded-xl bg-[#FF641F] hover:bg-[#E04F16] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ Buat Pembelian Baru</span>
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E8ECF2] text-[#667085] font-bold text-[11px] uppercase tracking-wider">
                    <th className="p-3.5">Nomor</th>
                    <th className="p-3.5">Vendor / Supplier</th>
                    <th className="p-3.5">Tanggal</th>
                    <th className="p-3.5">Jatuh Tempo</th>
                    <th className="p-3.5 text-right">Total</th>
                    <th className="p-3.5 text-right">Dibayar</th>
                    <th className="p-3.5 text-right">Sisa</th>
                    <th className="p-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8ECF2] bg-white">
                  {filteredPurchases.map(p => {
                    const total = p.totalAmount || p.totalCost || 0;
                    const paid = p.paidAmount || 0;
                    const remaining =
                      p.remainingAmount !== undefined
                        ? p.remainingAmount
                        : Math.max(0, total - paid);

                    return (
                      <tr
                        key={p.id}
                        onClick={() => onSelectPurchase(p.id)}
                        className="hover:bg-[#F8FAFC] transition cursor-pointer group"
                      >
                        {/* Nomor */}
                        <td className="p-3.5 font-extrabold text-[#172033] group-hover:text-[#FF641F] transition">
                          {p.purchaseNo || `#${p.id.slice(-6)}`}
                        </td>

                        {/* Vendor */}
                        <td className="p-3.5">
                          <p className="font-bold text-[#172033]">
                            {p.vendorName || p.supplier || 'Supplier Umum'}
                          </p>
                          {p.invoiceNo && (
                            <p className="text-[10px] text-[#667085]">
                              Inv: {p.invoiceNo}
                            </p>
                          )}
                        </td>

                        {/* Tanggal */}
                        <td className="p-3.5 font-semibold text-[#172033]">
                          {formatDate(p.date)}
                        </td>

                        {/* Jatuh Tempo */}
                        <td className="p-3.5">
                          {p.dueDate ? (
                            <span className="font-semibold text-[#D92D20]">
                              {formatDate(p.dueDate)}
                            </span>
                          ) : (
                            <span className="text-[#667085]">-</span>
                          )}
                        </td>

                        {/* Total */}
                        <td className="p-3.5 text-right font-extrabold text-[#172033]">
                          {formatRupiah(total)}
                        </td>

                        {/* Dibayar */}
                        <td className="p-3.5 text-right font-bold text-[#12B76A]">
                          {formatRupiah(paid)}
                        </td>

                        {/* Sisa */}
                        <td className="p-3.5 text-right font-bold text-[#D92D20]">
                          {formatRupiah(remaining)}
                        </td>

                        {/* Status Badge */}
                        <td className="p-3.5 text-center">
                          <PurchaseStatusBadge status={p.paymentStatus} size="sm" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards */}
            <div className="md:hidden divide-y divide-[#E8ECF2]">
              {filteredPurchases.map(p => {
                const total = p.totalAmount || p.totalCost || 0;
                const paid = p.paidAmount || 0;
                const remaining =
                  p.remainingAmount !== undefined ? p.remainingAmount : Math.max(0, total - paid);

                return (
                  <div
                    key={p.id}
                    onClick={() => onSelectPurchase(p.id)}
                    className="p-4 space-y-2.5 active:bg-[#F7F8FA] cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-black text-[#172033]">
                          {p.purchaseNo || `#${p.id.slice(-6)}`}
                        </span>
                        <p className="text-xs font-bold text-[#172033] mt-0.5">
                          {p.vendorName || p.supplier}
                        </p>
                        <p className="text-[11px] text-[#667085]">
                          {formatDate(p.date)} &bull; {p.items?.length || 1} jenis barang
                        </p>
                      </div>
                      <PurchaseStatusBadge status={p.paymentStatus} size="sm" />
                    </div>

                    <div className="flex items-end justify-between pt-2 border-t border-[#E8ECF2] text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-[#667085] uppercase">Total:</span>
                        <p className="font-extrabold text-[#172033] text-sm">
                          {formatRupiah(total)}
                        </p>
                      </div>

                      <div className="text-right">
                        {remaining > 0 ? (
                          <>
                            <span className="text-[10px] font-bold text-[#D92D20] uppercase">Sisa Tagihan:</span>
                            <p className="font-extrabold text-[#D92D20]">
                              {formatRupiah(remaining)}
                            </p>
                          </>
                        ) : (
                          <span className="text-[11px] font-bold text-[#12B76A]">
                            Lunas ({formatRupiah(paid)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* MODAL BELANJA CEPAT TUNAI LACI */}
      <QuickDrawerPurchaseModal
        isOpen={showQuickPurchaseModal}
        onClose={() => setShowQuickPurchaseModal(false)}
      />
    </div>
  );
};
