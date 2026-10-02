import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Expense, ExpenseCategory, ExpensePaymentSource } from '../../types';
import {
  formatRupiah,
  formatNumber,
  formatNumberInput,
  parseNumberInput,
} from '../../utils/formatters';
import {
  CANONICAL_CASH_ACCOUNTS,
  filterStandaloneExpenses,
  getCashAccountLabel,
  normalizeCashAccount,
} from '../../utils/cashLedger';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Receipt,
  RotateCcw,
  Eye,
  AlertTriangle,
} from 'lucide-react';

interface ExpensesViewProps {
  isDesktopWide?: boolean;
}

type PeriodPreset = 'ALL' | 'TODAY' | '7DAYS' | 'MONTH' | 'CUSTOM';

interface CategoryOption {
  id: ExpenseCategory;
  label: string;
}

// Section 8: Default operational expense categories (excludes "Bahan Baku")
const CATEGORY_OPTIONS: CategoryOption[] = [
  { id: 'listrik', label: 'Listrik & Air' },
  { id: 'gas', label: 'Gas LPG' },
  { id: 'sewa', label: 'Sewa' },
  { id: 'transport', label: 'Transportasi' },
  { id: 'gaji', label: 'Gaji & Honor' },
  { id: 'internet', label: 'Internet & Telepon' },
  { id: 'kebersihan', label: 'Kebersihan' },
  { id: 'atk', label: 'ATK' },
  { id: 'administrasi', label: 'Administrasi' },
  { id: 'lainnya', label: 'Lainnya' },
];

// Section 9: Canonical funding source accounts for operational expenses
const EXPENSE_FUNDING_ACCOUNTS = CANONICAL_CASH_ACCOUNTS.filter(
  (acc) => !acc.isPlatformWallet
);

const SHORT_MONTHS_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

function getCategoryLabel(catStr: string): string {
  if (!catStr) return 'Lainnya';
  const match = CATEGORY_OPTIONS.find(
    (c) => c.id === catStr || c.label.toLowerCase() === catStr.toLowerCase()
  );
  if (match) return match.label;
  // Preserve legacy history readability without offering as a normal new option
  const lower = catStr.toLowerCase();
  if (lower === 'perawatan') return 'Perawatan';
  if (lower === 'bahan baku' || lower === 'bahan_baku') return 'Bahan Baku (Lama)';
  if (lower === 'packaging' || lower === 'kemasan') return 'Kemasan (Lama)';
  return catStr.charAt(0).toUpperCase() + catStr.slice(1);
}

function getFriendlyAccountShortName(rawSource?: string): string {
  const canonical = normalizeCashAccount(rawSource || 'KAS_KASIR');
  switch (canonical) {
    case 'KAS_KASIR':
      return 'Kas Kasir';
    case 'KAS_OWNER':
      return 'Kas Owner';
    case 'KAS_QRIS':
      return 'Kas QRIS';
    case 'BANK_BCA':
      return 'Bank BCA';
    case 'BANK_JAGO':
      return 'Bank Jago';
    case 'BANK_MANDIRI':
      return 'Bank Mandiri';
    default:
      return getCashAccountLabel(canonical);
  }
}

function formatSlashDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const raw = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = raw.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatShortDateMobile(dateStr?: string): string {
  if (!dateStr) return '-';
  const raw = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = raw.split('-');
  if (parts.length === 3) {
    const day = parts[2];
    const mIdx = parseInt(parts[1], 10) - 1;
    const month = SHORT_MONTHS_ID[mIdx] || parts[1];
    const year = parts[0];
    return `${day} ${month} ${year}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, '0')} ${SHORT_MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function splitNoteAndExtra(rawNote?: string): { mainNote: string; extraNote: string } {
  if (!rawNote) return { mainNote: '', extraNote: '' };
  const sep = ' | Catatan: ';
  const idx = rawNote.indexOf(sep);
  if (idx === -1) {
    return { mainNote: rawNote, extraNote: '' };
  }
  return {
    mainNote: rawNote.slice(0, idx).trim(),
    extraNote: rawNote.slice(idx + sep.length).trim(),
  };
}

function combineNoteAndExtra(mainNote: string, extraNote: string): string {
  const cleanMain = mainNote.trim();
  const cleanExtra = extraNote.trim();
  if (!cleanExtra) return cleanMain;
  return `${cleanMain} | Catatan: ${cleanExtra}`;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  isDesktopWide = true,
}) => {
  const {
    expenses,
    addExpense,
    updateExpense,
    deleteExpense,
    cashBalanceSummary,
  } = useApp();
  const { currentRole, currentEmployee } = useAuth();

  // Filter & Search States
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Modal / Drawer States
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedDetailExpense, setSelectedDetailExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form Fields (Section 6)
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('listrik');
  const [formDate, setFormDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [formPaymentSource, setFormPaymentSource] =
    useState<ExpensePaymentSource>('KAS_KASIR');
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formDescription, setFormDescription] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // Exclude duplicate purchase expenses to maintain strict business logic segregation
  const standaloneExpenses = useMemo(() => {
    return filterStandaloneExpenses(expenses);
  }, [expenses]);

  // Date range bounds for filter
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
      const monthStart = `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, '0')}-01`;
      return { start: monthStart, end: todayStr };
    }
    if (periodPreset === 'CUSTOM') {
      return { start: startDate, end: endDate };
    }
    return { start: '', end: '' };
  }, [periodPreset, startDate, endDate]);

  // Section 3: Simple Summary Metrics (Bulan Ini | Hari Ini | Transaksi)
  const summary = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const monthStart = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, '0')}-01`;

    let todayTotal = 0;
    let monthTotal = 0;

    standaloneExpenses.forEach((exp: Expense) => {
      const expDate = exp.date || exp.createdAt?.split('T')[0] || todayStr;
      if (expDate === todayStr) todayTotal += exp.amount;
      if (expDate >= monthStart) monthTotal += exp.amount;
    });

    return {
      monthTotal,
      todayTotal,
      transactionCount: standaloneExpenses.length,
    };
  }, [standaloneExpenses]);

  // Filtered & Sorted List
  const filteredExpenses = useMemo(() => {
    return standaloneExpenses
      .filter((exp: Expense) => {
        // 1. Category Filter
        if (selectedCategory !== 'ALL') {
          if (exp.category !== selectedCategory) {
            const label = getCategoryLabel(exp.category);
            const targetLabel = getCategoryLabel(selectedCategory);
            if (label !== targetLabel) return false;
          }
        }

        // 2. Funding Source Filter
        if (selectedSource !== 'ALL') {
          const canonical = normalizeCashAccount(
            exp.paymentSource || 'KAS_KASIR'
          );
          if (canonical !== selectedSource) return false;
        }

        // 3. Period Filter
        const expDateStr =
          exp.date || (exp.createdAt ? exp.createdAt.split('T')[0] : '');
        if (computedDateBounds.start && expDateStr < computedDateBounds.start) {
          return false;
        }
        if (computedDateBounds.end && expDateStr > computedDateBounds.end) {
          return false;
        }

        // 4. Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchNote = (exp.note || '').toLowerCase().includes(q);
          const matchCat = getCategoryLabel(exp.category)
            .toLowerCase()
            .includes(q);
          const matchUser = (exp.createdByName || '')
            .toLowerCase()
            .includes(q);
          const matchSource = getFriendlyAccountShortName(exp.paymentSource)
            .toLowerCase()
            .includes(q);
          if (!matchNote && !matchCat && !matchUser && !matchSource) {
            return false;
          }
        }

        return true;
      })
      .sort(
        (a: Expense, b: Expense) =>
          new Date(b.createdAt || b.date).getTime() -
          new Date(a.createdAt || a.date).getTime()
      );
  }, [
    standaloneExpenses,
    selectedCategory,
    selectedSource,
    computedDateBounds,
    searchQuery,
  ]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage) || 1;
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredExpenses.slice(start, start + itemsPerPage);
  }, [filteredExpenses, currentPage, itemsPerPage]);

  const hasActiveFilter =
    selectedCategory !== 'ALL' ||
    selectedSource !== 'ALL' ||
    periodPreset !== 'ALL' ||
    Boolean(searchQuery.trim());

  const handleResetFilters = () => {
    setSelectedCategory('ALL');
    setSelectedSource('ALL');
    setPeriodPreset('ALL');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Helper for Wallet Balance display in dropdown
  const getWalletBalance = (sourceKey: ExpensePaymentSource): number => {
    const canonical = normalizeCashAccount(sourceKey);
    switch (canonical) {
      case 'KAS_KASIR':
        return cashBalanceSummary.kasKasir;
      case 'KAS_OWNER':
        return cashBalanceSummary.kasOwner;
      case 'KAS_QRIS':
        return cashBalanceSummary.kasQris;
      case 'WALLET_GOFOOD':
        return cashBalanceSummary.walletGofood;
      case 'WALLET_GRABFOOD':
        return cashBalanceSummary.walletGrabfood;
      case 'WALLET_SHOPEEFOOD':
        return cashBalanceSummary.walletShopeefood;
      case 'BANK_BCA':
        return cashBalanceSummary.bankBca;
      case 'BANK_JAGO':
        return cashBalanceSummary.bankJago;
      case 'BANK_MANDIRI':
        return cashBalanceSummary.bankMandiri;
      default:
        return cashBalanceSummary.kasKasir;
    }
  };

  // Open Form for New Expense
  const handleOpenNewForm = () => {
    setEditingExpense(null);
    setFormCategory('listrik');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormPaymentSource('KAS_KASIR');
    setFormAmount(0);
    setFormDescription('');
    setFormNotes('');
    setIsFormOpen(true);
  };

  // Open Form for Editing Expense
  const handleOpenEditForm = (exp: Expense) => {
    const parsed = splitNoteAndExtra(exp.note);
    setEditingExpense(exp);
    setFormCategory(exp.category || 'listrik');
    setFormDate(
      exp.date ||
        (exp.createdAt ? exp.createdAt.split('T')[0] : new Date().toISOString().split('T')[0])
    );
    setFormPaymentSource(
      normalizeCashAccount(exp.paymentSource || 'KAS_KASIR')
    );
    setFormAmount(exp.amount);
    setFormDescription(parsed.mainNote);
    setFormNotes(parsed.extraNote);
    setSelectedDetailExpense(null);
    setActiveActionMenuId(null);
    setIsFormOpen(true);
  };

  // Submit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formAmount <= 0) {
      alert('Nominal biaya harus lebih dari Rp 0');
      return;
    }
    if (!formDescription.trim()) {
      alert('Keterangan biaya wajib diisi.');
      return;
    }

    const combinedNote = combineNoteAndExtra(formDescription, formNotes);

    setIsSubmitting(true);
    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, {
          category: formCategory,
          amount: formAmount,
          note: combinedNote,
          paymentSource: formPaymentSource,
          date: formDate,
        });
      } else {
        await addExpense(
          formCategory,
          formAmount,
          combinedNote,
          formPaymentSource,
          formDate
        );
      }
      setIsFormOpen(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan biaya operasional.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Handler
  const handleDeleteConfirm = async () => {
    if (!deletingExpense) return;
    setIsSubmitting(true);
    try {
      await deleteExpense(deletingExpense.id);
      if (selectedDetailExpense?.id === deletingExpense.id) {
        setSelectedDetailExpense(null);
      }
      setDeletingExpense(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal menghapus biaya operasional.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultRecorderName =
    currentEmployee?.name || (currentRole === 'OWNER' ? 'Owner ARY' : 'Kasir');

  return (
    <div
      className="w-full max-w-full min-w-0 min-h-screen bg-[#F7F8FA] text-[#1F2937] p-4 sm:p-5 space-y-3.5"
      onClick={() => {
        if (activeActionMenuId) setActiveActionMenuId(null);
      }}
    >
      {/* 1. HEADER HALAMAN (Section 2) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[#1F2937] tracking-tight">
            Biaya Operasional
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Catat biaya usaha yang tidak masuk ke Pembelian Bahan.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenNewForm}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF5A1F] hover:bg-[#E04D17] text-white text-xs font-bold transition active:scale-[0.99] cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Tambah Biaya</span>
        </button>
      </div>

      {/* 2. RINGKASAN SEDERHANA — SATU HORIZONTAL SUMMARY BAR (Section 3) */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] px-4 py-3">
        <div className="grid grid-cols-3 divide-x divide-[#E5E7EB] text-left tabular-nums">
          <div className="pr-3 sm:pr-6">
            <span className="text-[11px] font-medium text-[#6B7280] block">
              Bulan Ini
            </span>
            <span className="text-sm sm:text-base font-bold text-[#1F2937] mt-0.5 block">
              {formatRupiah(summary.monthTotal)}
            </span>
          </div>

          <div className="px-3 sm:px-6">
            <span className="text-[11px] font-medium text-[#6B7280] block">
              Hari Ini
            </span>
            <span className="text-sm sm:text-base font-bold text-[#1F2937] mt-0.5 block">
              {formatRupiah(summary.todayTotal)}
            </span>
          </div>

          <div className="pl-3 sm:pl-6">
            <span className="text-[11px] font-medium text-[#6B7280] block">
              Transaksi
            </span>
            <span className="text-sm sm:text-base font-bold text-[#1F2937] mt-0.5 block">
              {formatNumber(summary.transactionCount)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. FILTER TOOLBAR PUTIH (Section 4) */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 space-y-2.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Semua Kategori ▼ */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#1F2937] focus:outline-none focus:border-[#FF5A1F] cursor-pointer"
            >
              <option value="ALL">Semua Kategori</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>

            {/* Semua Sumber Dana ▼ */}
            <select
              value={selectedSource}
              onChange={(e) => {
                setSelectedSource(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#1F2937] focus:outline-none focus:border-[#FF5A1F] cursor-pointer"
            >
              <option value="ALL">Semua Sumber Dana</option>
              {EXPENSE_FUNDING_ACCOUNTS.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.shortLabel}
                </option>
              ))}
            </select>

            {/* Periode ▼ */}
            <select
              value={periodPreset}
              onChange={(e) => {
                setPeriodPreset(e.target.value as PeriodPreset);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#1F2937] focus:outline-none focus:border-[#FF5A1F] cursor-pointer"
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
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] hover:bg-[#F3F4F6] text-xs font-medium text-[#6B7280] transition cursor-pointer"
                title="Reset Filter"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* 🔍 Cari biaya... */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari biaya..."
              className="w-full pl-9 pr-7 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#FF5A1F] transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#1F2937] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {periodPreset === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F3F4F6] text-xs">
            <span className="font-medium text-[#6B7280]">Rentang Tanggal:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-lg border border-[#E5E7EB] bg-white text-xs text-[#1F2937]"
            />
            <span className="text-[#9CA3AF]">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-lg border border-[#E5E7EB] bg-white text-xs text-[#1F2937]"
            />
          </div>
        )}
      </div>

      {/* 4. TABEL BIAYA DESKTOP & COMPACT LIST MOBILE (Sections 5 & 12) */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden w-full">
        {filteredExpenses.length === 0 ? (
          <div className="py-14 px-4 text-center">
            <Receipt className="w-9 h-9 mx-auto mb-2.5 text-[#D1D5DB]" />
            <p className="text-xs font-semibold text-[#1F2937]">
              Belum ada catatan biaya operasional
            </p>
            <p className="text-[11px] text-[#6B7280] mt-0.5">
              Klik tombol &quot;+ Tambah Biaya&quot; untuk mencatat pengeluaran usaha.
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div
              className={
                isDesktopWide ? 'hidden md:block w-full overflow-x-auto' : 'hidden'
              }
            >
              <table className="w-full table-auto text-left border-collapse">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                    <th className="py-2.5 pl-4 pr-3 w-[115px] whitespace-nowrap">
                      Tanggal
                    </th>
                    <th className="py-2.5 px-3 w-[150px] whitespace-nowrap">
                      Kategori
                    </th>
                    <th className="py-2.5 px-3 min-w-[220px]">
                      Keterangan
                    </th>
                    <th className="py-2.5 px-3 w-[135px] whitespace-nowrap">
                      Sumber Dana
                    </th>
                    <th className="py-2.5 px-3 w-[130px] text-right whitespace-nowrap">
                      Nominal
                    </th>
                    <th className="py-2.5 px-3 w-[130px] whitespace-nowrap">
                      Dicatat Oleh
                    </th>
                    <th className="py-2.5 pl-3 pr-4 w-[105px] text-right whitespace-nowrap">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] text-xs">
                  {paginatedExpenses.map((item: Expense) => {
                    const categoryLabel = getCategoryLabel(item.category);
                    const sourceLabel = getFriendlyAccountShortName(
                      item.paymentSource
                    );
                    const recorder =
                      item.createdByName || defaultRecorderName;
                    const parsedNote = splitNoteAndExtra(item.note);

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedDetailExpense(item)}
                        className="hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                      >
                        {/* Tanggal */}
                        <td className="py-3 pl-4 pr-3 whitespace-nowrap font-medium text-[#1F2937] tabular-nums">
                          {formatSlashDate(item.date || item.createdAt)}
                        </td>

                        {/* Kategori */}
                        <td className="py-3 px-3 whitespace-nowrap font-semibold text-[#1F2937]">
                          {categoryLabel}
                        </td>

                        {/* Keterangan */}
                        <td className="py-3 px-3 text-[#1F2937] max-w-[340px]">
                          <div className="font-medium truncate">
                            {parsedNote.mainNote || '-'}
                          </div>
                          {parsedNote.extraNote && (
                            <div className="text-[11px] text-[#6B7280] truncate mt-0.5">
                              {parsedNote.extraNote}
                            </div>
                          )}
                        </td>

                        {/* Sumber Dana */}
                        <td className="py-3 px-3 whitespace-nowrap text-[#6B7280] font-medium">
                          {sourceLabel}
                        </td>

                        {/* Nominal */}
                        <td className="py-3 px-3 text-right whitespace-nowrap font-bold text-[#DC2626] tabular-nums">
                          -{formatRupiah(item.amount)}
                        </td>

                        {/* Dicatat Oleh */}
                        <td className="py-3 px-3 whitespace-nowrap text-[#6B7280] font-medium">
                          {recorder}
                        </td>

                        {/* Aksi: Lihat ⋮ */}
                        <td
                          className="py-3 pl-3 pr-4 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-1.5 relative">
                            <button
                              type="button"
                              onClick={() => setSelectedDetailExpense(item)}
                              className="px-2.5 py-1 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-xs font-semibold text-[#1F2937] transition cursor-pointer"
                            >
                              Lihat
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionMenuId(
                                  activeActionMenuId === item.id
                                    ? null
                                    : item.id
                                );
                              }}
                              className="p-1 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-[#6B7280] hover:text-[#1F2937] transition cursor-pointer"
                              title="Aksi lainnya"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {activeActionMenuId === item.id && (
                              <div
                                className="absolute right-0 top-8 z-30 w-36 bg-white rounded-xl border border-[#E5E7EB] shadow-lg py-1 text-left"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuId(null);
                                    setSelectedDetailExpense(item);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs font-medium text-[#1F2937] hover:bg-[#F9FAFB] flex items-center gap-2 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-[#6B7280]" />
                                  <span>Lihat Detail</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditForm(item)}
                                  className="w-full px-3 py-1.5 text-xs font-medium text-[#1F2937] hover:bg-[#F9FAFB] flex items-center gap-2 cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-[#6B7280]" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuId(null);
                                    setDeletingExpense(item);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-2 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                                  <span>Hapus</span>
                                </button>
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

            {/* MOBILE COMPACT LIST (Section 12) */}
            <div
              className={
                isDesktopWide
                  ? 'block md:hidden divide-y divide-[#E5E7EB]'
                  : 'block divide-y divide-[#E5E7EB]'
              }
            >
              {paginatedExpenses.map((item: Expense) => {
                const categoryLabel = getCategoryLabel(item.category);
                const sourceLabel = getFriendlyAccountShortName(
                  item.paymentSource
                );
                const parsedNote = splitNoteAndExtra(item.note);

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedDetailExpense(item)}
                    className="p-3.5 hover:bg-[#F9FAFB] transition-colors cursor-pointer flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="text-xs font-bold text-[#1F2937]">
                        {categoryLabel}
                      </div>
                      <div className="text-xs text-[#1F2937] truncate">
                        {parsedNote.mainNote || '-'}
                      </div>
                      <div className="text-[11px] text-[#6B7280] flex items-center gap-1.5 pt-0.5">
                        <span>
                          {formatShortDateMobile(item.date || item.createdAt)}
                        </span>
                        <span>&bull;</span>
                        <span>{sourceLabel}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-1">
                      <div className="text-xs font-bold text-[#DC2626] tabular-nums">
                        -{formatRupiah(item.amount)}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDetailExpense(item);
                        }}
                        className="px-2 py-0.5 rounded-md border border-[#E5E7EB] bg-white text-[11px] font-semibold text-[#1F2937]"
                      >
                        Lihat
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PAGINATION FOOTER */}
            <div className="px-4 py-3 border-t border-[#E5E7EB] bg-white flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-[#6B7280]">
              <div className="flex items-center gap-2">
                <span>
                  Menampilkan{' '}
                  <strong className="text-[#1F2937]">
                    {filteredExpenses.length === 0
                      ? 0
                      : (currentPage - 1) * itemsPerPage + 1}
                  </strong>
                  –
                  <strong className="text-[#1F2937]">
                    {Math.min(
                      currentPage * itemsPerPage,
                      filteredExpenses.length
                    )}
                  </strong>{' '}
                  dari{' '}
                  <strong className="text-[#1F2937]">
                    {filteredExpenses.length}
                  </strong>{' '}
                  transaksi
                </span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 rounded-lg border border-[#E5E7EB] bg-white text-xs text-[#1F2937]"
                >
                  <option value={10}>10 / hal</option>
                  <option value={20}>20 / hal</option>
                  <option value={50}>50 / hal</option>
                </select>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded-lg border border-[#E5E7EB] bg-white text-[#1F2937] disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2.5 py-1 font-semibold text-[#1F2937]">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    className="p-1 rounded-lg border border-[#E5E7EB] bg-white text-[#1F2937] disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 5. DETAIL TRANSAKSI DRAWER / MODAL (Section 10) */}
      {selectedDetailExpense && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 animate-in fade-in duration-150"
          onClick={() => setSelectedDetailExpense(null)}
        >
          <div
            className="bg-white w-full max-w-md h-full shadow-xl border-l border-[#E5E7EB] flex flex-col justify-between animate-in slide-in-from-right duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {/* Header */}
              <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#1F2937]">
                    Biaya Operasional
                  </h3>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Rincian pengeluaran usaha
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDetailExpense(null)}
                  className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F3F4F6] transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Detail Fields */}
              {(() => {
                const parsed = splitNoteAndExtra(selectedDetailExpense.note);
                const sourceLabel = getFriendlyAccountShortName(
                  selectedDetailExpense.paymentSource
                );
                const recorder =
                  selectedDetailExpense.createdByName || defaultRecorderName;

                return (
                  <div className="p-5 space-y-4 text-xs">
                    {/* Nominal Box */}
                    <div className="p-4 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-between">
                      <span className="font-semibold text-[#6B7280]">
                        Nominal
                      </span>
                      <span className="text-lg font-extrabold text-[#DC2626] tabular-nums">
                        -{formatRupiah(selectedDetailExpense.amount)}
                      </span>
                    </div>

                    <div className="divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
                      <div className="py-3 flex items-center justify-between gap-4">
                        <span className="text-[#6B7280]">Tanggal</span>
                        <span className="font-semibold text-[#1F2937] tabular-nums">
                          {formatSlashDate(
                            selectedDetailExpense.date ||
                              selectedDetailExpense.createdAt
                          )}
                        </span>
                      </div>

                      <div className="py-3 flex items-center justify-between gap-4">
                        <span className="text-[#6B7280]">Kategori</span>
                        <span className="font-semibold text-[#1F2937]">
                          {getCategoryLabel(selectedDetailExpense.category)}
                        </span>
                      </div>

                      <div className="py-3 flex items-start justify-between gap-4">
                        <span className="text-[#6B7280] shrink-0">
                          Keterangan
                        </span>
                        <span className="font-semibold text-[#1F2937] text-right">
                          {parsed.mainNote || '-'}
                        </span>
                      </div>

                      {parsed.extraNote && (
                        <div className="py-3 flex items-start justify-between gap-4">
                          <span className="text-[#6B7280] shrink-0">
                            Catatan
                          </span>
                          <span className="font-medium text-[#1F2937] text-right">
                            {parsed.extraNote}
                          </span>
                        </div>
                      )}

                      <div className="py-3 flex items-center justify-between gap-4">
                        <span className="text-[#6B7280]">Sumber Dana</span>
                        <span className="font-semibold text-[#1F2937]">
                          {sourceLabel}
                        </span>
                      </div>

                      <div className="py-3 flex items-center justify-between gap-4">
                        <span className="text-[#6B7280]">Dicatat Oleh</span>
                        <span className="font-semibold text-[#1F2937]">
                          {recorder}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer Actions: [ Edit ] [ Hapus ] */}
            <div className="p-4 border-t border-[#E5E7EB] bg-white flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => handleOpenEditForm(selectedDetailExpense)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-xs font-bold text-[#1F2937] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setDeletingExpense(selectedDetailExpense)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] text-xs font-bold text-[#DC2626] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. SIDE DRAWER PUTIH — TAMBAH / EDIT BIAYA OPERASIONAL (Section 6) */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 animate-in fade-in duration-150"
          onClick={() => setIsFormOpen(false)}
        >
          <div
            className="bg-white w-full max-w-md h-full shadow-xl border-l border-[#E5E7EB] flex flex-col justify-between animate-in slide-in-from-right duration-150 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {/* Drawer Header */}
              <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
                <h3 className="text-base font-bold text-[#1F2937]">
                  {editingExpense
                    ? 'Edit Biaya Operasional'
                    : 'Tambah Biaya Operasional'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F3F4F6] transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form
                id="expense-form"
                onSubmit={handleSubmitForm}
                className="p-5 space-y-4"
              >
                {/* Kategori * */}
                <div>
                  <label className="text-xs font-bold text-[#1F2937] block mb-1.5">
                    Kategori <span className="text-[#DC2626]">*</span>
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) =>
                      setFormCategory(e.target.value as ExpenseCategory)
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-xs font-semibold text-[#1F2937] focus:outline-none focus:border-[#FF5A1F]"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tanggal * */}
                <div>
                  <label className="text-xs font-bold text-[#1F2937] block mb-1.5">
                    Tanggal <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-xs font-semibold text-[#1F2937] focus:outline-none focus:border-[#FF5A1F]"
                  />
                </div>

                {/* Sumber Dana * */}
                <div>
                  <label className="text-xs font-bold text-[#1F2937] block mb-1.5">
                    Sumber Dana <span className="text-[#DC2626]">*</span>
                  </label>
                  <select
                    value={formPaymentSource}
                    onChange={(e) =>
                      setFormPaymentSource(
                        e.target.value as ExpensePaymentSource
                      )
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-xs font-semibold text-[#1F2937] focus:outline-none focus:border-[#FF5A1F]"
                  >
                    {EXPENSE_FUNDING_ACCOUNTS.map((acc) => {
                      const bal = getWalletBalance(
                        acc.id as ExpensePaymentSource
                      );
                      return (
                        <option key={acc.id} value={acc.id}>
                          {acc.shortLabel} — Saldo: {formatRupiah(bal)}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Nominal * */}
                <div>
                  <label className="text-xs font-bold text-[#1F2937] block mb-1.5">
                    Nominal <span className="text-[#DC2626]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#6B7280]">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={formatNumberInput(formAmount)}
                      onChange={(e) =>
                        setFormAmount(parseNumberInput(e.target.value))
                      }
                      placeholder="0"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-xs font-bold text-[#1F2937] focus:outline-none focus:border-[#FF5A1F] tabular-nums"
                    />
                  </div>
                </div>

                {/* Keterangan * */}
                <div>
                  <label className="text-xs font-bold text-[#1F2937] block mb-1.5">
                    Keterangan <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Contoh: Bayar listrik bulan September"
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-xs text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#FF5A1F]"
                  />
                </div>

                {/* Catatan (Opsional) */}
                <div>
                  <label className="text-xs font-bold text-[#1F2937] block mb-1.5">
                    Catatan{' '}
                    <span className="font-normal text-[#6B7280]">
                      (Opsional)
                    </span>
                  </label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Tambahkan catatan bila diperlukan..."
                    className="w-full p-3 rounded-xl border border-[#E5E7EB] bg-white text-xs text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#FF5A1F] resize-none"
                  />
                </div>
              </form>
            </div>

            {/* Footer: [Batal] [Simpan Biaya] */}
            <div className="p-4 border-t border-[#E5E7EB] bg-white flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-xs font-bold text-[#1F2937] transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                form="expense-form"
                disabled={
                  isSubmitting || formAmount <= 0 || !formDescription.trim()
                }
                className="px-5 py-2.5 rounded-xl bg-[#FF5A1F] hover:bg-[#E04D17] text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Biaya'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL KONFIRMASI HAPUS BIAYA (Section 10) */}
      {deletingExpense && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-in fade-in duration-150"
          onClick={() => setDeletingExpense(null)}
        >
          <div
            className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xl w-full max-w-sm p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1F2937]">
                  Hapus Biaya Operasional?
                </h3>
                <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                  Biaya{' '}
                  <strong className="text-[#1F2937]">
                    {splitNoteAndExtra(deletingExpense.note).mainNote ||
                      getCategoryLabel(deletingExpense.category)}
                  </strong>{' '}
                  sebesar{' '}
                  <strong className="text-[#DC2626]">
                    {formatRupiah(deletingExpense.amount)}
                  </strong>{' '}
                  akan dihapus dan saldo akun{' '}
                  <strong className="text-[#1F2937]">
                    {getFriendlyAccountShortName(deletingExpense.paymentSource)}
                  </strong>{' '}
                  akan dikembalikan.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingExpense(null)}
                className="px-4 py-2 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-xs font-bold text-[#1F2937] transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
