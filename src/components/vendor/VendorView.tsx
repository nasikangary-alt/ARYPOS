import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Vendor } from '../../types';
import { formatRupiah, formatDate } from '../../utils/formatters';
import { PageContainer } from '../common/PageContainer';
import { PageHeader } from '../common/PageHeader';
import { SummaryBar } from '../common/SummaryBar';
import {
  Building2,
  Plus,
  Search,
  UserCheck,
  Phone,
  MapPin,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  Edit2,
  Trash2,
  ShoppingBag,
  ChevronRight,
} from 'lucide-react';

interface VendorViewProps {
  onNavigateTab?: (tab: string) => void;
  isDesktopWide?: boolean;
}

export const VendorView: React.FC<VendorViewProps> = ({
  onNavigateTab,
  isDesktopWide = true,
}) => {
  const { vendors, purchases, addVendor, updateVendor, deleteVendor } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'HAS_DEBT' | 'INACTIVE'>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  // Selected Vendor for History Modal
  const [selectedVendorHistory, setSelectedVendorHistory] = useState<Vendor | null>(null);

  // Form States
  const [vName, setVName] = useState('');
  const [vContact, setVContact] = useState('');
  const [vPhone, setVPhone] = useState('');
  const [vAddress, setVAddress] = useState('');
  const [vNotes, setVNotes] = useState('');
  const [vActive, setVActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirm State
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);

  // Enrich vendors with purchase stats
  const enrichedVendors = useMemo(() => {
    return vendors.map(v => {
      const vendorPurchases = purchases.filter(
        p =>
          p.vendorId === v.id ||
          (p.vendorName && p.vendorName.toLowerCase() === v.name.toLowerCase()) ||
          (p.supplier && p.supplier.toLowerCase() === v.name.toLowerCase())
      );

      const validPurchases = vendorPurchases.filter(p => p.status !== 'VOID');

      const totalPurch = validPurchases.reduce(
        (acc, p) => acc + (p.totalAmount || p.totalCost || 0),
        0
      );

      const totalDebt = validPurchases.reduce(
        (acc, p) => acc + (p.remainingAmount || 0),
        0
      );

      return {
        vendor: v,
        vendorPurchases,
        poCount: validPurchases.length,
        totalPurch,
        totalDebt,
        isActive: v.active !== false,
      };
    });
  }, [vendors, purchases]);

  // Overall Vendor Metrics
  const vendorMetrics = useMemo(() => {
    const totalVendors = enrichedVendors.length;
    const activeVendors = enrichedVendors.filter(item => item.isActive).length;
    const inactiveVendors = enrichedVendors.filter(item => !item.isActive).length;
    const debtVendors = enrichedVendors.filter(item => item.totalDebt > 0).length;

    let totalAllPurchases = 0;
    let totalAllDebt = 0;

    purchases.forEach(p => {
      if (p.status !== 'VOID') {
        totalAllPurchases += p.totalAmount || p.totalCost || 0;
        totalAllDebt += p.remainingAmount || 0;
      }
    });

    return {
      totalVendors,
      activeVendors,
      inactiveVendors,
      debtVendors,
      totalAllPurchases,
      totalAllDebt,
    };
  }, [enrichedVendors, purchases]);

  // Filtered Vendors
  const filteredVendors = useMemo(() => {
    return enrichedVendors.filter(item => {
      const v = item.vendor;

      if (statusFilter === 'ACTIVE' && !item.isActive) return false;
      if (statusFilter === 'INACTIVE' && item.isActive) return false;
      if (statusFilter === 'HAS_DEBT' && item.totalDebt <= 0) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        v.name.toLowerCase().includes(q) ||
        (v.contactName && v.contactName.toLowerCase().includes(q)) ||
        (v.phone && v.phone.toLowerCase().includes(q)) ||
        (v.address && v.address.toLowerCase().includes(q)) ||
        (v.notes && v.notes.toLowerCase().includes(q))
      );
    });
  }, [enrichedVendors, statusFilter, searchQuery]);

  const handleOpenAddModal = () => {
    setEditingVendor(null);
    setVName('');
    setVContact('');
    setVPhone('');
    setVAddress('');
    setVNotes('');
    setVActive(true);
    setShowModal(true);
  };

  const handleOpenEditModal = (v: Vendor) => {
    setEditingVendor(v);
    setVName(v.name);
    setVContact(v.contactName || '');
    setVPhone(v.phone || '');
    setVAddress(v.address || '');
    setVNotes(v.notes || '');
    setVActive(v.active ?? true);
    setShowModal(true);
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vName.trim()) {
      alert('Nama Vendor minimal wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingVendor) {
        await updateVendor(editingVendor.id, {
          name: vName.trim(),
          contactName: vContact.trim(),
          phone: vPhone.trim(),
          address: vAddress.trim(),
          notes: vNotes.trim(),
          active: vActive,
        });
        alert('Data Vendor berhasil diperbarui!');
      } else {
        await addVendor({
          name: vName.trim(),
          contactName: vContact.trim(),
          phone: vPhone.trim(),
          address: vAddress.trim(),
          notes: vNotes.trim(),
          active: vActive,
        });
        alert('Vendor baru berhasil ditambahkan!');
      }
      setShowModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan vendor';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVendor = async () => {
    if (!deletingVendor) return;
    try {
      await deleteVendor(deletingVendor.id);
      alert(`Vendor "${deletingVendor.name}" berhasil dihapus.`);
      setDeletingVendor(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus vendor';
      alert(msg);
    }
  };

  return (
    <PageContainer className="pb-28">
      {/* 1. PAGE HEADER */}
      <PageHeader
        title="Vendor & Supplier"
        description="Kelola data mitra penyedia bahan baku, packaging, & barang retail usaha."
        actions={
          <>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('pembelian')}
                className="h-9 px-3.5 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F7F8FA] text-[#172033] text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-[#FF5A1F]" />
                <span>Modul Pembelian</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="h-9 px-3.5 rounded-lg bg-[#FF5A1F] hover:bg-[#E04F16] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ Tambah Vendor</span>
            </button>
          </>
        }
      />

      {/* 2. COMPACT SUMMARY BAR */}
      <SummaryBar
        items={[
          {
            label: 'Total Vendor',
            value: `${vendorMetrics.totalVendors} Mitra`,
          },
          {
            label: 'Status Aktif',
            value: `${vendorMetrics.activeVendors} Vendor`,
            valueClassName: 'text-[#16A34A]',
          },
          {
            label: 'Total Pembelian',
            value: formatRupiah(vendorMetrics.totalAllPurchases),
          },
          {
            label: 'Total Hutang Dagang',
            value: formatRupiah(vendorMetrics.totalAllDebt),
            valueClassName:
              vendorMetrics.totalAllDebt > 0 ? 'text-[#DC2626]' : 'text-[#172033]',
          },
        ]}
      />

      <div className="space-y-4">

        {/* 3. FILTER & SEARCH BAR */}
        <div className="bg-white rounded-2xl border border-[#E2E6EC] p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap scrollbar-none pb-0.5 md:pb-0">
            {[
              { id: 'ALL', label: `Semua Vendor (${vendorMetrics.totalVendors})` },
              { id: 'ACTIVE', label: `Aktif (${vendorMetrics.activeVendors})` },
              { id: 'HAS_DEBT', label: `Ada Hutang (${vendorMetrics.debtVendors})` },
              { id: 'INACTIVE', label: `Nonaktif (${vendorMetrics.inactiveVendors})` },
            ].map(tab => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id as any)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    active
                      ? 'bg-[#172033] text-white'
                      : 'bg-[#F7F8FA] text-[#667085] hover:text-[#172033] hover:bg-[#EEF1F5]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72 lg:w-80 shrink-0">
            <Search className="w-3.5 h-3.5 text-[#8E8E93] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari nama vendor, PIC, telepon, alamat..."
              className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-[#E2E6EC] bg-[#F7F8FA] focus:bg-white text-xs font-medium text-[#172033] placeholder:text-[#8E8E93] focus:outline-none focus:border-[#FF641F] transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[#8E8E93] hover:text-[#172033] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 4. VENDOR LIST (DESKTOP TABLE & MOBILE COMPACT LIST) */}
        <div className="bg-white rounded-2xl border border-[#E2E6EC] shadow-2xs overflow-hidden">
          {filteredVendors.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#F7F8FA] border border-[#E2E6EC] flex items-center justify-center mx-auto text-[#8E8E93]">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-[#172033]">
                  {searchQuery || statusFilter !== 'ALL'
                    ? 'Tidak ada vendor yang sesuai filter.'
                    : 'Belum ada data vendor terdaftar.'}
                </p>
                <p className="text-xs text-[#667085]">
                  {searchQuery || statusFilter !== 'ALL'
                    ? 'Coba ubah kata kunci pencarian atau reset filter.'
                    : 'Tambahkan supplier bahan baku atau kemasan untuk memudahkan pencatatan pembelian.'}
                </p>
              </div>
              {searchQuery || statusFilter !== 'ALL' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                  }}
                  className="px-3.5 py-1.5 rounded-lg border border-[#E2E6EC] bg-white hover:bg-[#F7F8FA] text-xs font-bold text-[#172033] transition cursor-pointer"
                >
                  Reset Filter
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 rounded-xl bg-[#FF641F] hover:bg-[#E05212] text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Vendor Baru</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE LIST */}
              <div className={isDesktopWide ? 'hidden md:block overflow-x-auto' : 'hidden'}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F7F8FA] border-b border-[#E2E6EC] text-[11px] font-bold text-[#667085] uppercase tracking-wider">
                      <th className="py-3 pl-5 pr-3">Vendor / Supplier</th>
                      <th className="py-3 px-3">Kontak (PIC)</th>
                      <th className="py-3 px-3">Telepon / WA</th>
                      <th className="py-3 px-3">Alamat</th>
                      <th className="py-3 px-3 text-center">Riwayat PO</th>
                      <th className="py-3 px-3 text-right">Total Pembelian</th>
                      <th className="py-3 px-3 text-right">Hutang Vendor</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 pl-3 pr-5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF1F5] text-xs">
                    {filteredVendors.map(
                      ({ vendor: v, poCount, totalPurch, totalDebt, isActive }) => (
                        <tr
                          key={v.id}
                          className="hover:bg-[#F9FAFC] transition-colors group"
                        >
                          {/* Vendor Name & Notes */}
                          <td className="py-3.5 pl-5 pr-3">
                            <div className="flex items-center gap-3 min-w-[180px]">
                              <div className="w-9 h-9 rounded-lg bg-[#F7F8FA] border border-[#E2E6EC] flex items-center justify-center shrink-0 text-[#172033] font-extrabold text-xs">
                                {v.name.trim().charAt(0).toUpperCase() || 'V'}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-[#172033] text-xs truncate">
                                  {v.name}
                                </p>
                                {v.notes ? (
                                  <p className="text-[11px] text-[#667085] truncate max-w-[220px]">
                                    {v.notes}
                                  </p>
                                ) : (
                                  <p className="text-[11px] text-[#8E8E93]">
                                    Mitra Supplier
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* PIC */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {v.contactName ? (
                              <span className="font-semibold text-[#172033]">
                                {v.contactName}
                              </span>
                            ) : (
                              <span className="text-[#8E8E93]">-</span>
                            )}
                          </td>

                          {/* Phone */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {v.phone ? (
                              <span className="font-medium text-[#172033]">
                                {v.phone}
                              </span>
                            ) : (
                              <span className="text-[#8E8E93]">-</span>
                            )}
                          </td>

                          {/* Address */}
                          <td className="py-3.5 px-3">
                            {v.address ? (
                              <p
                                className="text-xs text-[#667085] truncate max-w-[220px]"
                                title={v.address}
                              >
                                {v.address}
                              </p>
                            ) : (
                              <span className="text-[#8E8E93]">-</span>
                            )}
                          </td>

                          {/* PO Count */}
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedVendorHistory(v)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F7F8FA] hover:bg-[#EEF1F5] border border-[#E2E6EC] text-[11px] font-bold text-[#172033] transition cursor-pointer"
                            >
                              <FileText className="w-3 h-3 text-[#FF641F]" />
                              <span>{poCount} PO</span>
                            </button>
                          </td>

                          {/* Total Pembelian */}
                          <td className="py-3.5 px-3 text-right whitespace-nowrap font-bold text-[#172033]">
                            {formatRupiah(totalPurch)}
                          </td>

                          {/* Hutang Vendor */}
                          <td className="py-3.5 px-3 text-right whitespace-nowrap">
                            {totalDebt > 0 ? (
                              <span className="font-extrabold text-[#D92D20]">
                                {formatRupiah(totalDebt)}
                              </span>
                            ) : (
                              <span className="font-bold text-[#12B76A]">Lunas</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#12B76A]">
                                <span className="w-2 h-2 rounded-full bg-[#12B76A]" />
                                Aktif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#667085]">
                                <span className="w-2 h-2 rounded-full bg-[#8E8E93]" />
                                Nonaktif
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedVendorHistory(v)}
                                title="Riwayat Pembelian PO"
                                className="px-2.5 py-1.5 rounded-lg border border-[#E2E6EC] bg-white hover:bg-[#F7F8FA] text-[#172033] font-bold text-[11px] transition cursor-pointer"
                              >
                                Riwayat
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(v)}
                                title="Edit Vendor"
                                className="p-1.5 rounded-lg border border-[#E2E6EC] bg-white hover:bg-[#F7F8FA] text-[#172033] transition cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingVendor(v)}
                                title="Hapus Vendor"
                                className="p-1.5 rounded-lg border border-[#E2E6EC] bg-white hover:bg-[#FEF3F2] text-[#667085] hover:text-[#D92D20] transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* MOBILE COMPACT LIST */}
              <div
                className={
                  isDesktopWide
                    ? 'md:hidden divide-y divide-[#EEF1F5]'
                    : 'divide-y divide-[#EEF1F5]'
                }
              >
                {filteredVendors.map(
                  ({ vendor: v, poCount, totalPurch, totalDebt, isActive }) => (
                    <div key={v.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-xs font-extrabold text-[#172033] truncate">
                            {v.name}
                          </h3>
                          <p className="text-[11px] text-[#667085] mt-0.5 truncate">
                            {v.contactName ? `PIC: ${v.contactName}` : 'Tanpa PIC'}
                            {v.phone ? ` · ${v.phone}` : ''}
                          </p>
                        </div>

                        {isActive ? (
                          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-[#12B76A]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A]" />
                            Aktif
                          </span>
                        ) : (
                          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-[#667085]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8E8E93]" />
                            Nonaktif
                          </span>
                        )}
                      </div>

                      {v.address && (
                        <p className="text-[11px] text-[#667085] truncate">
                          {v.address}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-[#EEF1F5] text-[11px]">
                        <div className="text-[#667085]">
                          <span>Total: </span>
                          <strong className="text-[#172033]">
                            {formatRupiah(totalPurch)}
                          </strong>
                          {totalDebt > 0 ? (
                            <span className="text-[#D92D20] font-bold ml-2">
                              · Hutang {formatRupiah(totalDebt)}
                            </span>
                          ) : (
                            <span className="text-[#12B76A] font-bold ml-2">
                              · Lunas
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedVendorHistory(v)}
                            className="px-2 py-1 rounded-lg border border-[#E2E6EC] bg-[#F7F8FA] text-[11px] font-bold text-[#172033] cursor-pointer"
                          >
                            PO ({poCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(v)}
                            className="p-1.5 rounded-lg border border-[#E2E6EC] text-[#172033] cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingVendor(v)}
                            className="p-1.5 rounded-lg border border-[#E2E6EC] text-[#D92D20] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODAL TAMBAH / EDIT VENDOR */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveVendor}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex justify-between items-center pb-3 border-b border-[#E8ECF2]">
              <h3 className="text-sm font-bold text-[#172033]">
                {editingVendor ? 'Edit Data Vendor / Supplier' : 'Tambah Vendor / Supplier Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-full text-[#667085] hover:bg-[#F7F8FA] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">
                  Nama Vendor / Toko <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: CV Sumber Ayam, Toko Plastik Jaya..."
                  value={vName}
                  onChange={e => setVName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#FF641F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">
                  Nama Kontak (PIC)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Pak Asep / Bu Ani"
                  value={vContact}
                  onChange={e => setVContact(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#FF641F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 081234567890"
                  value={vPhone}
                  onChange={e => setVPhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#FF641F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">Alamat</label>
                <input
                  type="text"
                  placeholder="Alamat lengkap vendor..."
                  value={vAddress}
                  onChange={e => setVAddress(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#FF641F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">Catatan</label>
                <textarea
                  rows={2}
                  placeholder="Catatan tambahan (misal: Supplier Ayam Harian)..."
                  value={vNotes}
                  onChange={e => setVNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#FF641F]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="vActiveCheck"
                  checked={vActive}
                  onChange={e => setVActive(e.target.checked)}
                  className="w-4 h-4 rounded-md text-[#FF641F] focus:ring-[#FF641F]"
                />
                <label htmlFor="vActiveCheck" className="text-xs font-bold text-[#172033] cursor-pointer">
                  Vendor Aktif
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-[#172033] hover:bg-[#232F48] text-white font-bold text-xs transition cursor-pointer"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Data Vendor'}
            </button>
          </form>
        </div>
      )}

      {/* MODAL VENDOR PURCHASES HISTORY */}
      {selectedVendorHistory && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-3 border-b border-[#E8ECF2]">
              <div>
                <h3 className="text-base font-bold text-[#172033]">
                  Histori Pembelian dari {selectedVendorHistory.name}
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  Daftar transaksi PO yang pernah dilakukan dengan supplier ini
                </p>
              </div>
              <button
                onClick={() => setSelectedVendorHistory(null)}
                className="p-1 rounded-full text-[#667085] hover:bg-[#F7F8FA] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {purchases.filter(
              p =>
                p.vendorId === selectedVendorHistory.id ||
                (p.vendorName && p.vendorName.toLowerCase() === selectedVendorHistory.name.toLowerCase()) ||
                (p.supplier && p.supplier.toLowerCase() === selectedVendorHistory.name.toLowerCase())
            ).length === 0 ? (
              <div className="text-center py-8 text-xs font-bold text-[#667085]">
                Belum ada transaksi pembelian tercatat dengan vendor ini.
              </div>
            ) : (
              <div className="divide-y divide-[#E8ECF2]">
                {purchases
                  .filter(
                    p =>
                      p.vendorId === selectedVendorHistory.id ||
                      (p.vendorName && p.vendorName.toLowerCase() === selectedVendorHistory.name.toLowerCase()) ||
                      (p.supplier && p.supplier.toLowerCase() === selectedVendorHistory.name.toLowerCase())
                  )
                  .map(p => (
                    <div key={p.id} className="py-3 space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-[#172033]">
                          {p.purchaseNo || `#${p.id.slice(-6)}`}
                        </span>
                        <span className="font-extrabold text-[#172033]">
                          {formatRupiah(p.totalAmount || p.totalCost || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-[#667085]">
                        <span>{formatDate(p.date)}</span>
                        <span className={`font-bold ${p.remainingAmount > 0 ? 'text-[#D92D20]' : 'text-[#12B76A]'}`}>
                          {p.remainingAmount > 0 ? `Sisa Hutang: ${formatRupiah(p.remainingAmount)}` : 'LUNAS'}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS VENDOR */}
      {deletingVendor && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-sm font-bold text-[#172033]">Konfirmasi Hapus Vendor</h3>
            </div>
            <p className="text-xs text-[#667085]">
              Apakah Anda yakin ingin menghapus vendor <strong>"{deletingVendor.name}"</strong>? Histori transaksi pembelian tidak akan terhapus.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingVendor(null)}
                className="px-4 py-2 rounded-xl border border-[#E8ECF2] text-xs font-bold text-[#172033] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteVendor}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
              >
                Hapus Vendor
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
