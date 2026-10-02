import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { CanonicalCashAccount, CashMutationType } from '../../types';
import {
  formatRupiah,
  formatDateTimeIndonesian,
  formatNumberInput,
  parseNumberInput,
} from '../../utils/formatters';
import {
  CANONICAL_CASH_ACCOUNTS,
  getCashAccountLabel,
  getCashAccountShortLabel,
  getSaleLedgerInflow,
  isDuplicatePurchaseExpense,
  normalizeCashAccount,
} from '../../utils/cashLedger';
import { PageContainer } from '../common/PageContainer';
import { PageHeader } from '../common/PageHeader';
import {
  QrCode,
  Banknote,
  Calculator,
  Search,
  CheckCircle2,
  X,
  ArrowLeftRight,
  Smartphone,
  Plus,
} from 'lucide-react';

interface CashAndQrisViewProps {
  isDesktopWide?: boolean;
}

type MutationCategoryFilter = 'ALL' | 'KAS' | 'QRIS' | 'WALLET' | 'BANK';
type PeriodFilter = 'TODAY' | '7DAYS' | 'MONTH' | 'ALL';

interface UnifiedMutation {
  id: string;
  date: string;
  accountLabel: string;
  rawAccount: CanonicalCashAccount;
  type: string;
  typeLabel: string;
  title: string;
  notes?: string;
  amount: number;
  flow: 'IN' | 'OUT';
  balanceAfter: number;
  createdByName?: string;
  referenceId?: string;
  createdAt: string;
}

const KAS_ONLY_ACCOUNTS: CanonicalCashAccount[] = ['KAS_KASIR', 'KAS_OWNER'];
const QRIS_ACCOUNTS: CanonicalCashAccount[] = ['KAS_QRIS'];
const WALLET_ACCOUNTS: CanonicalCashAccount[] = [
  'WALLET_GOFOOD',
  'WALLET_GRABFOOD',
  'WALLET_SHOPEEFOOD',
];
const BANK_ACCOUNTS: CanonicalCashAccount[] = ['BANK_BCA', 'BANK_JAGO', 'BANK_MANDIRI'];

function getMutationTypeBadgeLabel(type: string): string {
  switch (type) {
    case 'PENCAIRAN_PLATFORM':
      return 'Pencairan Platform';
    case 'PENCAIRAN_QRIS':
      return 'Pencairan QRIS';
    case 'SETOR_OWNER':
      return 'Setor Kas Owner';
    case 'TRANSFER_DANA':
      return 'Transfer Dana';
    case 'PENJUALAN':
      return 'Penjualan';
    case 'PENGELUARAN':
      return 'Pengeluaran';
    case 'PEMBELIAN':
      return 'Pembelian Bahan';
    case 'MODAL_AWAL':
      return 'Modal Awal Kasir';
    case 'PENYESUAIAN':
      return 'Penyesuaian Kas';
    default:
      return type.replace(/_/g, ' ');
  }
}

function formatMutationDateTime(isoStr?: string, fallbackDate?: string): string {
  const raw = isoStr || fallbackDate;
  if (!raw) return '-';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

export const CashAndQrisView: React.FC<CashAndQrisViewProps> = ({
  isDesktopWide = true,
}) => {
  const {
    sales,
    expenses,
    cashMutations,
    cashBalanceSummary,
    addCashMutation,
    transferCashAccount,
  } = useApp();
  const { currentRole } = useAuth();

  const isOwnerOrAdmin = currentRole === 'OWNER' || currentRole === 'ADMIN';

  // Toggle between grouped 4-row account view and expanded 9-account view
  const [showDetailedAccounts, setShowDetailedAccounts] = useState(false);

  // Mutation History Filters
  const [mutationCategory, setMutationCategory] = useState<MutationCategoryFilter>('ALL');
  const [specificAccountFilter, setSpecificAccountFilter] = useState<CanonicalCashAccount | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Mutation for Detail Modal
  const [selectedMutation, setSelectedMutation] = useState<UnifiedMutation | null>(null);

  // Modals
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showOwnerTakeModal, setShowOwnerTakeModal] = useState(false);
  const [showCairkanQrisModal, setShowCairkanQrisModal] = useState(false);
  const [showPlatformSettlementModal, setShowPlatformSettlementModal] = useState(false);
  const [showManualMutationModal, setShowManualMutationModal] = useState(false);
  const [showOpnameModal, setShowOpnameModal] = useState(false);
  const [showQrisDisplayModal, setShowQrisDisplayModal] = useState(false);

  // Form states: Ambil Kas oleh Owner (KAS_KASIR -> KAS_OWNER)
  const [ownerTakeAmount, setOwnerTakeAmount] = useState<number>(0);
  const [ownerTakeNotes, setOwnerTakeNotes] = useState<string>(
    'Owner mengambil uang tunai dari laci kasir'
  );

  // Form states: Transfer Antar Akun
  const [trfFrom, setTrfFrom] = useState<CanonicalCashAccount>('KAS_KASIR');
  const [trfTo, setTrfTo] = useState<CanonicalCashAccount>(
    isOwnerOrAdmin ? 'KAS_OWNER' : 'KAS_QRIS'
  );
  const [trfAmount, setTrfAmount] = useState<number>(0);
  const [trfNotes, setTrfNotes] = useState<string>('');

  // Form states: Cairkan QRIS ke Bank
  const [cairkanAmount, setCairkanAmount] = useState<number>(0);
  const [cairkanDestAccount, setCairkanDestAccount] =
    useState<CanonicalCashAccount>('BANK_BCA');
  const [cairkanNotes, setCairkanNotes] = useState<string>(
    'Pencairan saldo QRIS ke rekening bank'
  );

  // Form states: Pencairan Platform Online (GoFood / GrabFood / ShopeeFood -> Bank)
  const [settleSourceAccount, setSettleSourceAccount] =
    useState<CanonicalCashAccount>('WALLET_GOFOOD');
  const [settleDestAccount, setSettleDestAccount] =
    useState<CanonicalCashAccount>('BANK_BCA');
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleNotes, setSettleNotes] = useState<string>(
    'Pencairan saldo Dompet GoFood ke Rekening Bank'
  );

  // Form states: Mutasi Manual / Tambah Saldo Akun
  const [manualAccount, setManualAccount] = useState<CanonicalCashAccount>('KAS_KASIR');
  const [manualType] = useState<CashMutationType>('PENYESUAIAN');
  const [manualFlow, setManualFlow] = useState<'IN' | 'OUT'>('IN');
  const [manualAmount, setManualAmount] = useState<number>(0);
  const [manualTitle, setManualTitle] = useState<string>('Penyesuaian Saldo');
  const [manualCustomNotes, setManualCustomNotes] = useState<string>('');

  // Cash Opname / Calculator breakdown
  const [cashDenominations, setCashDenominations] = useState<{ [key: number]: number }>({
    100000: 0,
    50000: 0,
    20000: 0,
    10000: 0,
    5000: 0,
    2000: 0,
    1000: 0,
    500: 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const getAccountBalance = (acc: CanonicalCashAccount): number => {
    switch (acc) {
      case 'KAS_KASIR':
        return cashBalanceSummary.kasKasir;
      case 'KAS_QRIS':
        return cashBalanceSummary.kasQris;
      case 'KAS_OWNER':
        return cashBalanceSummary.kasOwner;
      case 'BANK_BCA':
        return cashBalanceSummary.bankBca;
      case 'BANK_JAGO':
        return cashBalanceSummary.bankJago;
      case 'BANK_MANDIRI':
        return cashBalanceSummary.bankMandiri;
      case 'WALLET_GOFOOD':
        return cashBalanceSummary.walletGofood;
      case 'WALLET_GRABFOOD':
        return cashBalanceSummary.walletGrabfood;
      case 'WALLET_SHOPEEFOOD':
        return cashBalanceSummary.walletShopeefood;
      default:
        return 0;
    }
  };

  // Summary group totals (using existing cashBalanceSummary)
  const totalKasOnly = isOwnerOrAdmin
    ? cashBalanceSummary.kasKasir + cashBalanceSummary.kasOwner
    : cashBalanceSummary.kasKasir;
  const totalQrisOnly = cashBalanceSummary.kasQris;
  const totalWalletOnly =
    cashBalanceSummary.walletGofood +
    cashBalanceSummary.walletGrabfood +
    cashBalanceSummary.walletShopeefood;
  const totalBankOnly = isOwnerOrAdmin
    ? cashBalanceSummary.bankBca +
      cashBalanceSummary.bankJago +
      cashBalanceSummary.bankMandiri
    : 0;

  const totalSaldoBisnis =
    totalKasOnly + totalQrisOnly + totalWalletOnly + totalBankOnly;

  // Build unified mutations list across accounts with accurate Saldo Setelah (running balance)
  const unifiedMutations = useMemo<UnifiedMutation[]>(() => {
    const rawList: Omit<UnifiedMutation, 'balanceAfter'>[] = [];

    // 1. Sales
    sales.forEach((sale) => {
      if (sale.status === 'COMPLETED') {
        const { account: rawAcc, amount: inflowAmount } = getSaleLedgerInflow(sale);
        if (!rawAcc || inflowAmount <= 0) return;

        if (
          !isOwnerOrAdmin &&
          (rawAcc === 'KAS_OWNER' || BANK_ACCOUNTS.includes(rawAcc))
        ) {
          return;
        }

        const channelLabel =
          sale.orderType && sale.orderType !== 'OFFLINE'
            ? sale.orderType
            : sale.paymentMethod;

        rawList.push({
          id: `sale-${sale.id}`,
          date: sale.date,
          accountLabel:
            rawAcc === 'KAS_QRIS' ? 'QRIS' : getCashAccountShortLabel(rawAcc),
          rawAccount: rawAcc,
          type: 'PENJUALAN',
          typeLabel: `Penjualan ${channelLabel}`,
          title: `Penjualan #${sale.transactionNo || sale.id.slice(-6)}`,
          notes: `${sale.items.length} item`,
          amount: inflowAmount,
          flow: 'IN',
          createdByName: sale.cashierName || 'Kasir',
          referenceId: sale.transactionNo,
          createdAt: sale.createdAt || new Date().toISOString(),
        });
      }
    });

    // 2. Expenses (deduplicated against purchase cashMutations)
    expenses.forEach((exp) => {
      if (isDuplicatePurchaseExpense(exp, cashMutations)) return;
      const rawAcc = normalizeCashAccount(exp.paymentSource || 'KAS_KASIR', exp.note);

      if (
        !isOwnerOrAdmin &&
        (rawAcc === 'KAS_OWNER' || BANK_ACCOUNTS.includes(rawAcc))
      ) {
        return;
      }

      rawList.push({
        id: `exp-${exp.id}`,
        date: exp.date,
        accountLabel:
          rawAcc === 'KAS_QRIS' ? 'QRIS' : getCashAccountShortLabel(rawAcc),
        rawAccount: rawAcc,
        type: 'PENGELUARAN',
        typeLabel: 'Pengeluaran Operasional',
        title: exp.note || `Pengeluaran ${exp.category}`,
        notes: exp.category,
        amount: exp.amount,
        flow: 'OUT',
        createdByName: 'Operasional',
        referenceId: exp.id,
        createdAt: exp.createdAt || new Date().toISOString(),
      });
    });

    // 3. Cash Mutations
    cashMutations.forEach((mut) => {
      const rawAcc = normalizeCashAccount(
        mut.account,
        `${mut.title || ''} ${mut.notes || ''}`
      );

      if (
        !isOwnerOrAdmin &&
        (rawAcc === 'KAS_OWNER' || BANK_ACCOUNTS.includes(rawAcc))
      ) {
        return;
      }

      let displayTitle = mut.title;
      if (mut.relatedAccount) {
        const fromAcc =
          mut.flow === 'OUT' ? rawAcc : normalizeCashAccount(mut.relatedAccount);
        const toAcc =
          mut.flow === 'OUT' ? normalizeCashAccount(mut.relatedAccount) : rawAcc;

        if (mut.type === 'PENCAIRAN_PLATFORM') {
          displayTitle = `Pencairan ${getCashAccountShortLabel(fromAcc).replace(
            'Wallet ',
            ''
          )} → ${getCashAccountShortLabel(toAcc)}`;
        } else if (mut.type === 'PENCAIRAN_QRIS') {
          displayTitle = `Cairkan QRIS → ${getCashAccountShortLabel(toAcc)}`;
        } else if (mut.type === 'SETOR_OWNER') {
          displayTitle = `Setor Kas Owner`;
        } else if (mut.type === 'TRANSFER_DANA') {
          displayTitle =
            mut.flow === 'OUT'
              ? `Transfer ke ${getCashAccountShortLabel(toAcc)}`
              : `Transfer dari ${getCashAccountShortLabel(fromAcc)}`;
        }
      }

      rawList.push({
        id: `mut-${mut.id}`,
        date: mut.date,
        accountLabel:
          rawAcc === 'KAS_QRIS' ? 'QRIS' : getCashAccountShortLabel(rawAcc),
        rawAccount: rawAcc,
        type: mut.type,
        typeLabel: getMutationTypeBadgeLabel(mut.type),
        title: displayTitle,
        notes: mut.notes,
        amount: mut.amount,
        flow: mut.flow,
        createdByName: mut.createdByName || 'Sistem',
        referenceId: mut.referenceId || mut.id,
        createdAt: mut.createdAt || new Date().toISOString(),
      });
    });

    // Sort newest first
    const sorted = rawList.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Compute Saldo Setelah per canonical account from actual current balances
    const runningBalances: Record<CanonicalCashAccount, number> = {
      KAS_KASIR: cashBalanceSummary.kasKasir,
      KAS_QRIS: cashBalanceSummary.kasQris,
      KAS_OWNER: cashBalanceSummary.kasOwner,
      WALLET_GOFOOD: cashBalanceSummary.walletGofood,
      WALLET_GRABFOOD: cashBalanceSummary.walletGrabfood,
      WALLET_SHOPEEFOOD: cashBalanceSummary.walletShopeefood,
      BANK_BCA: cashBalanceSummary.bankBca,
      BANK_JAGO: cashBalanceSummary.bankJago,
      BANK_MANDIRI: cashBalanceSummary.bankMandiri,
    };

    return sorted.map((item) => {
      const currentAfter = runningBalances[item.rawAccount] ?? 0;
      // Step backwards for the next older entry on the same account
      if (item.flow === 'IN') {
        runningBalances[item.rawAccount] = currentAfter - item.amount;
      } else {
        runningBalances[item.rawAccount] = currentAfter + item.amount;
      }
      return {
        ...item,
        balanceAfter: currentAfter,
      };
    });
  }, [sales, expenses, cashMutations, cashBalanceSummary, isOwnerOrAdmin]);

  // Filter mutations based on category, specific account, period, and search
  const filteredMutations = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}-01`;

    return unifiedMutations.filter((m) => {
      if (specificAccountFilter && m.rawAccount !== specificAccountFilter) {
        return false;
      }

      if (mutationCategory === 'KAS' && !KAS_ONLY_ACCOUNTS.includes(m.rawAccount)) {
        return false;
      }
      if (mutationCategory === 'QRIS' && !QRIS_ACCOUNTS.includes(m.rawAccount)) {
        return false;
      }
      if (mutationCategory === 'WALLET' && !WALLET_ACCOUNTS.includes(m.rawAccount)) {
        return false;
      }
      if (mutationCategory === 'BANK' && !BANK_ACCOUNTS.includes(m.rawAccount)) {
        return false;
      }

      if (
        periodFilter === 'TODAY' &&
        !m.createdAt.startsWith(todayStr) &&
        m.date !== todayStr
      ) {
        return false;
      }
      if (periodFilter === '7DAYS' && m.date < sevenDaysAgo) {
        return false;
      }
      if (periodFilter === 'MONTH' && m.date < monthStart) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = m.title.toLowerCase().includes(q);
        const matchNotes = (m.notes || '').toLowerCase().includes(q);
        const matchRef = (m.referenceId || '').toLowerCase().includes(q);
        const matchType = m.typeLabel.toLowerCase().includes(q);
        const matchAcc = m.accountLabel.toLowerCase().includes(q);
        if (!matchTitle && !matchNotes && !matchRef && !matchType && !matchAcc) {
          return false;
        }
      }
      return true;
    });
  }, [unifiedMutations, mutationCategory, specificAccountFilter, periodFilter, searchQuery]);

  // Account rows for SALDO AKUN table/list
  const accountRows = useMemo(() => {
    if (showDetailedAccounts) {
      const list: Array<{
        key: string;
        name: string;
        balance: number;
        description: string;
        categoryFilter: MutationCategoryFilter;
        specificAccount?: CanonicalCashAccount;
      }> = [
        {
          key: 'KAS_KASIR',
          name: 'Kas Kasir',
          balance: cashBalanceSummary.kasKasir,
          description: 'Kas operasional harian (laci kasir)',
          categoryFilter: 'KAS',
          specificAccount: 'KAS_KASIR',
        },
        ...(isOwnerOrAdmin
          ? [
              {
                key: 'KAS_OWNER',
                name: 'Kas Owner',
                balance: cashBalanceSummary.kasOwner,
                description: 'Kas tunai yang dipegang Owner',
                categoryFilter: 'KAS' as MutationCategoryFilter,
                specificAccount: 'KAS_OWNER' as CanonicalCashAccount,
              },
            ]
          : []),
        {
          key: 'KAS_QRIS',
          name: 'QRIS',
          balance: cashBalanceSummary.kasQris,
          description: 'Pembayaran QRIS',
          categoryFilter: 'QRIS',
          specificAccount: 'KAS_QRIS',
        },
        {
          key: 'WALLET_GOFOOD',
          name: 'Wallet GoFood',
          balance: cashBalanceSummary.walletGofood,
          description: 'Saldo platform GoFood',
          categoryFilter: 'WALLET',
          specificAccount: 'WALLET_GOFOOD',
        },
        {
          key: 'WALLET_GRABFOOD',
          name: 'Wallet GrabFood',
          balance: cashBalanceSummary.walletGrabfood,
          description: 'Saldo platform GrabFood',
          categoryFilter: 'WALLET',
          specificAccount: 'WALLET_GRABFOOD',
        },
        {
          key: 'WALLET_SHOPEEFOOD',
          name: 'Wallet ShopeeFood',
          balance: cashBalanceSummary.walletShopeefood,
          description: 'Saldo platform ShopeeFood',
          categoryFilter: 'WALLET',
          specificAccount: 'WALLET_SHOPEEFOOD',
        },
        ...(isOwnerOrAdmin
          ? [
              {
                key: 'BANK_BCA',
                name: 'Bank BCA',
                balance: cashBalanceSummary.bankBca,
                description: 'Rekening usaha Bank BCA',
                categoryFilter: 'BANK' as MutationCategoryFilter,
                specificAccount: 'BANK_BCA' as CanonicalCashAccount,
              },
              {
                key: 'BANK_JAGO',
                name: 'Bank Jago',
                balance: cashBalanceSummary.bankJago,
                description: 'Rekening usaha Bank Jago',
                categoryFilter: 'BANK' as MutationCategoryFilter,
                specificAccount: 'BANK_JAGO' as CanonicalCashAccount,
              },
              {
                key: 'BANK_MANDIRI',
                name: 'Bank Mandiri',
                balance: cashBalanceSummary.bankMandiri,
                description: 'Rekening usaha Bank Mandiri',
                categoryFilter: 'BANK' as MutationCategoryFilter,
                specificAccount: 'BANK_MANDIRI' as CanonicalCashAccount,
              },
            ]
          : []),
      ];
      return list;
    }

    // Default clean grouped view (Kas Kasir, Kas Owner if non-zero, QRIS, Wallet Platform, Rekening Bank)
    const grouped: Array<{
      key: string;
      name: string;
      balance: number;
      description: string;
      categoryFilter: MutationCategoryFilter;
      specificAccount?: CanonicalCashAccount;
    }> = [
      {
        key: 'KAS_KASIR',
        name: 'Kas Kasir',
        balance: cashBalanceSummary.kasKasir,
        description: 'Kas operasional harian',
        categoryFilter: 'KAS',
        specificAccount: 'KAS_KASIR',
      },
      ...(isOwnerOrAdmin && cashBalanceSummary.kasOwner !== 0
        ? [
            {
              key: 'KAS_OWNER',
              name: 'Kas Owner',
              balance: cashBalanceSummary.kasOwner,
              description: 'Kas tunai pemilik',
              categoryFilter: 'KAS' as MutationCategoryFilter,
              specificAccount: 'KAS_OWNER' as CanonicalCashAccount,
            },
          ]
        : []),
      {
        key: 'QRIS',
        name: 'QRIS',
        balance: totalQrisOnly,
        description: 'Pembayaran QRIS',
        categoryFilter: 'QRIS',
        specificAccount: 'KAS_QRIS',
      },
      {
        key: 'WALLET_PLATFORM',
        name: 'Wallet Platform',
        balance: totalWalletOnly,
        description: 'GoFood, GrabFood, ShopeeFood',
        categoryFilter: 'WALLET',
      },
      ...(isOwnerOrAdmin
        ? [
            {
              key: 'REKENING_BANK',
              name: 'Rekening Bank',
              balance: totalBankOnly,
              description: 'Rekening usaha (BCA, Jago, Mandiri)',
              categoryFilter: 'BANK' as MutationCategoryFilter,
            },
          ]
        : []),
    ];

    return grouped;
  }, [
    showDetailedAccounts,
    cashBalanceSummary,
    isOwnerOrAdmin,
    totalQrisOnly,
    totalWalletOnly,
    totalBankOnly,
  ]);

  const handleJumpToAccountHistory = (
    category: MutationCategoryFilter,
    specificAccount?: CanonicalCashAccount
  ) => {
    setMutationCategory(category);
    setSpecificAccountFilter(specificAccount || null);
    const el = document.getElementById('riwayat-mutasi-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Opname calculations for KAS_KASIR
  const totalPhysicalCash = useMemo(() => {
    return Object.entries(cashDenominations).reduce(
      (acc, [denom, count]) => acc + Number(denom) * count,
      0
    );
  }, [cashDenominations]);

  const cashDifference = totalPhysicalCash - cashBalanceSummary.kasKasir;

  // Action Handlers
  const handleSaveOwnerTake = async () => {
    if (ownerTakeAmount <= 0) {
      alert('Nominal pengambilan kas harus lebih dari Rp 0.');
      return;
    }
    if (ownerTakeAmount > cashBalanceSummary.kasKasir) {
      alert(
        `Nominal melebihi saldo Kas Kasir saat ini (${formatRupiah(
          cashBalanceSummary.kasKasir
        )}).`
      );
      return;
    }
    setIsSubmitting(true);
    try {
      await transferCashAccount({
        fromAccount: 'KAS_KASIR',
        toAccount: 'KAS_OWNER',
        amount: ownerTakeAmount,
        type: 'SETOR_OWNER',
        title: 'Kas Kasir → Kas Owner',
        notes: ownerTakeNotes,
      });
      setShowOwnerTakeModal(false);
      setOwnerTakeAmount(0);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal mencatat pengambilan kas.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveTransfer = async () => {
    if (trfAmount <= 0) {
      alert('Nominal transfer harus lebih dari Rp 0.');
      return;
    }
    if (trfFrom === trfTo) {
      alert('Akun asal dan akun tujuan tidak boleh sama.');
      return;
    }
    const sourceBal = getAccountBalance(trfFrom);
    if (trfAmount > sourceBal) {
      alert(
        `Nominal melebihi saldo ${getCashAccountLabel(trfFrom)} saat ini (${formatRupiah(
          sourceBal
        )}).`
      );
      return;
    }
    setIsSubmitting(true);
    try {
      await transferCashAccount({
        fromAccount: trfFrom,
        toAccount: trfTo,
        amount: trfAmount,
        notes:
          trfNotes ||
          `Transfer ${getCashAccountShortLabel(trfFrom)} → ${getCashAccountShortLabel(
            trfTo
          )}`,
      });
      setShowTransferModal(false);
      setTrfAmount(0);
      setTrfNotes('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal mencatat transfer antar akun.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCairkanQris = async () => {
    if (cairkanAmount <= 0) {
      alert('Nominal pencairan harus lebih dari Rp 0.');
      return;
    }
    if (cairkanAmount > cashBalanceSummary.kasQris) {
      alert(
        `Nominal pencairan melebihi saldo Kas QRIS saat ini (${formatRupiah(
          cashBalanceSummary.kasQris
        )}).`
      );
      return;
    }
    setIsSubmitting(true);
    try {
      await transferCashAccount({
        fromAccount: 'KAS_QRIS',
        toAccount: cairkanDestAccount,
        amount: cairkanAmount,
        type: 'PENCAIRAN_QRIS',
        title: `Cairkan QRIS → ${getCashAccountShortLabel(cairkanDestAccount)}`,
        notes: cairkanNotes,
      });
      setShowCairkanQrisModal(false);
      setCairkanAmount(0);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal mencatat pencairan QRIS.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenPlatformSettlement = (wallet: CanonicalCashAccount) => {
    setSettleSourceAccount(wallet);
    setSettleDestAccount('BANK_BCA');
    const available = getAccountBalance(wallet);
    setSettleAmount(available > 0 ? available : 0);
    setSettleNotes(
      `Pencairan ${getCashAccountShortLabel(wallet)} ke Rekening Bank`
    );
    setShowPlatformSettlementModal(true);
  };

  const handleSavePlatformSettlement = async () => {
    const available = getAccountBalance(settleSourceAccount);
    if (settleAmount <= 0) {
      alert('Nominal pencairan harus lebih dari Rp 0.');
      return;
    }
    if (settleAmount > available) {
      alert(
        `Nominal pencairan (${formatRupiah(settleAmount)}) melebihi saldo ${getCashAccountLabel(
          settleSourceAccount
        )} saat ini (${formatRupiah(available)}).`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await transferCashAccount({
        fromAccount: settleSourceAccount,
        toAccount: settleDestAccount,
        amount: settleAmount,
        type: 'PENCAIRAN_PLATFORM',
        title: `Pencairan ${getCashAccountShortLabel(settleSourceAccount).replace(
          'Wallet ',
          ''
        )} → ${getCashAccountShortLabel(settleDestAccount).replace('Bank ', '')}`,
        notes:
          settleNotes ||
          `Pencairan ${getCashAccountLabel(settleSourceAccount)} ke ${getCashAccountLabel(
            settleDestAccount
          )}`,
      });
      setShowPlatformSettlementModal(false);
      setSettleAmount(0);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal mencatat pencairan saldo platform.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveManualMutation = async () => {
    if (manualAmount <= 0) {
      alert('Nominal mutasi harus lebih dari Rp 0.');
      return;
    }
    setIsSubmitting(true);
    try {
      await addCashMutation({
        account: manualAccount,
        type: manualType,
        amount: manualAmount,
        flow: manualFlow,
        title: manualTitle || 'Penyesuaian Saldo',
        notes: manualCustomNotes,
      });
      setShowManualMutationModal(false);
      setManualAmount(0);
    } catch {
      alert('Gagal mencatat mutasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveOpname = async () => {
    setIsSubmitting(true);
    try {
      const statusText =
        cashDifference === 0
          ? 'Pas (Sesuai)'
          : cashDifference > 0
          ? `Lebih ${formatRupiah(cashDifference)}`
          : `Kurang ${formatRupiah(Math.abs(cashDifference))}`;

      if (cashDifference !== 0) {
        await addCashMutation({
          account: 'KAS_KASIR',
          type: 'PENYESUAIAN',
          amount: Math.abs(cashDifference),
          flow: cashDifference >= 0 ? 'IN' : 'OUT',
          title: `Opname Kas Kasir (${statusText})`,
          notes: `Fisik: ${formatRupiah(totalPhysicalCash)} | Sistem: ${formatRupiah(
            cashBalanceSummary.kasKasir
          )}`,
        });
      }

      setShowOpnameModal(false);
      setCashDenominations({
        100000: 0,
        50000: 0,
        20000: 0,
        10000: 0,
        5000: 0,
        2000: 0,
        1000: 0,
        500: 0,
      });
    } catch {
      alert('Gagal menyimpan rekonsiliasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const allowedTransferAccounts = useMemo(() => {
    if (isOwnerOrAdmin) return CANONICAL_CASH_ACCOUNTS;
    return CANONICAL_CASH_ACCOUNTS.filter(
      (a) => a.id !== 'KAS_OWNER' && !BANK_ACCOUNTS.includes(a.id)
    );
  }, [isOwnerOrAdmin]);

  return (
    <PageContainer className="pb-28">
      {/* 1. HEADER */}
      <PageHeader
        title="Kas & Rekening"
        description="Kelola saldo dan mutasi dana usaha."
        actions={
          <button
            type="button"
            onClick={() => {
              if (isOwnerOrAdmin) {
                setManualAccount('KAS_KASIR');
                setManualFlow('IN');
                setManualAmount(0);
                setManualTitle('Saldo Awal / Penyesuaian Akun');
                setManualCustomNotes('');
                setShowManualMutationModal(true);
              } else {
                setShowQrisDisplayModal(true);
              }
            }}
            className="h-9 px-3.5 rounded-lg bg-[#FF5A1F] hover:bg-[#E04F16] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ Tambah Akun</span>
          </button>
        }
      />

      <div className="space-y-6">
        {/* 2. BLOK TOTAL SALDO (Single Horizontal Block) */}
        <section className="bg-white rounded-xl border border-[#E4E7EC] p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] block">
                TOTAL SALDO SELURUH AKUN
              </span>
              <div
                className={`text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight mt-1 ${
                  totalSaldoBisnis < 0 ? 'text-[#F04438]' : 'text-[#172033]'
                }`}
              >
                {formatRupiah(totalSaldoBisnis)}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-8 pt-3.5 lg:pt-0 border-t lg:border-t-0 lg:border-l border-[#E4E7EC] lg:pl-8">
              <div>
                <span className="text-xs text-[#667085] block">Kas Kasir</span>
                <span
                  className={`text-sm font-bold tabular-nums mt-0.5 block ${
                    totalKasOnly < 0 ? 'text-[#F04438]' : 'text-[#172033]'
                  }`}
                >
                  {formatRupiah(totalKasOnly)}
                </span>
              </div>

              <div>
                <span className="text-xs text-[#667085] block">QRIS</span>
                <span
                  className={`text-sm font-bold tabular-nums mt-0.5 block ${
                    totalQrisOnly < 0 ? 'text-[#F04438]' : 'text-[#172033]'
                  }`}
                >
                  {formatRupiah(totalQrisOnly)}
                </span>
              </div>

              <div>
                <span className="text-xs text-[#667085] block">Wallet Platform</span>
                <span
                  className={`text-sm font-bold tabular-nums mt-0.5 block ${
                    totalWalletOnly < 0 ? 'text-[#F04438]' : 'text-[#172033]'
                  }`}
                >
                  {formatRupiah(totalWalletOnly)}
                </span>
              </div>

              {isOwnerOrAdmin && (
                <div>
                  <span className="text-xs text-[#667085] block">Bank</span>
                  <span
                    className={`text-sm font-bold tabular-nums mt-0.5 block ${
                      totalBankOnly < 0 ? 'text-[#F04438]' : 'text-[#172033]'
                    }`}
                  >
                    {formatRupiah(totalBankOnly)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 3. SALDO AKUN (Single Table on Desktop, Compact List on Mobile) */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#172033]">
              SALDO AKUN
            </h2>
            <button
              type="button"
              onClick={() => setShowDetailedAccounts((prev) => !prev)}
              className="text-xs font-semibold text-[#667085] hover:text-[#172033] transition cursor-pointer"
            >
              {showDetailedAccounts ? 'Tampilan Ringkas' : 'Lihat Rincian Akun'}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-[#E4E7EC] overflow-hidden">
            {/* Desktop Table */}
            <div className={isDesktopWide ? 'hidden md:block overflow-x-auto' : 'hidden'}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F8FA] border-b border-[#E4E7EC] text-[11px] font-bold text-[#667085] uppercase tracking-wider">
                    <th className="py-3 pl-5 pr-3">Akun</th>
                    <th className="py-3 px-3 text-right">Saldo Saat Ini</th>
                    <th className="py-3 px-3">Keterangan</th>
                    <th className="py-3 pl-3 pr-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EC] text-xs">
                  {accountRows.map((row) => (
                    <tr
                      key={row.key}
                      className="hover:bg-[#F9FAFC] transition-colors"
                    >
                      <td className="py-3.5 pl-5 pr-3 font-bold text-[#172033] whitespace-nowrap">
                        {row.name}
                      </td>
                      <td
                        className={`py-3.5 px-3 text-right font-extrabold tabular-nums whitespace-nowrap ${
                          row.balance < 0 ? 'text-[#F04438]' : 'text-[#172033]'
                        }`}
                      >
                        {formatRupiah(row.balance)}
                      </td>
                      <td className="py-3.5 px-3 text-[#667085]">
                        {row.description}
                      </td>
                      <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            handleJumpToAccountHistory(
                              row.categoryFilter,
                              row.specificAccount
                            )
                          }
                          className="px-2.5 py-1 rounded-lg border border-[#E4E7EC] bg-white hover:bg-[#F7F8FA] text-[#172033] font-semibold text-xs transition cursor-pointer"
                        >
                          Riwayat
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Compact List */}
            <div
              className={
                isDesktopWide
                  ? 'md:hidden divide-y divide-[#E4E7EC]'
                  : 'divide-y divide-[#E4E7EC]'
              }
            >
              {accountRows.map((row) => (
                <div
                  key={row.key}
                  className="p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#172033]">{row.name}</p>
                    <p
                      className={`text-sm font-extrabold tabular-nums mt-0.5 ${
                        row.balance < 0 ? 'text-[#F04438]' : 'text-[#172033]'
                      }`}
                    >
                      {formatRupiah(row.balance)}
                    </p>
                    <p className="text-[11px] text-[#667085] mt-0.5 truncate">
                      {row.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleJumpToAccountHistory(
                        row.categoryFilter,
                        row.specificAccount
                      )
                    }
                    className="shrink-0 px-2.5 py-1.5 rounded-lg border border-[#E4E7EC] bg-white hover:bg-[#F7F8FA] text-[#172033] font-semibold text-xs transition cursor-pointer"
                  >
                    Riwayat
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. AKSI CEPAT (Compact Single Row, No Card Wrapper) */}
        <section className="space-y-2">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#172033]">
            AKSI CEPAT
          </h2>

          <div className="flex items-center gap-2 overflow-x-auto flex-nowrap scrollbar-none pb-0.5">
            <button
              type="button"
              onClick={() => {
                setTrfFrom('KAS_KASIR');
                setTrfTo(isOwnerOrAdmin ? 'BANK_BCA' : 'KAS_QRIS');
                setTrfAmount(0);
                setTrfNotes('');
                setShowTransferModal(true);
              }}
              className="shrink-0 px-3.5 py-2 rounded-lg bg-[#FF6B22] hover:bg-[#E05A16] text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Transfer</span>
            </button>

            {isOwnerOrAdmin && (
              <button
                type="button"
                onClick={() => {
                  setOwnerTakeAmount(
                    cashBalanceSummary.kasKasir > 0 ? cashBalanceSummary.kasKasir : 0
                  );
                  setShowOwnerTakeModal(true);
                }}
                className="shrink-0 px-3.5 py-2 rounded-lg border border-[#E4E7EC] bg-white hover:bg-[#F7F8FA] text-[#172033] text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <Banknote className="w-3.5 h-3.5 text-[#667085]" />
                <span>Ambil Kas</span>
              </button>
            )}

            {isOwnerOrAdmin && (
              <button
                type="button"
                onClick={() => handleOpenPlatformSettlement('WALLET_GOFOOD')}
                className="shrink-0 px-3.5 py-2 rounded-lg border border-[#E4E7EC] bg-white hover:bg-[#F7F8FA] text-[#172033] text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5 text-[#667085]" />
                <span>Cairkan Wallet</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setCairkanAmount(
                  cashBalanceSummary.kasQris > 0 ? cashBalanceSummary.kasQris : 0
                );
                setShowCairkanQrisModal(true);
              }}
              className="shrink-0 px-3.5 py-2 rounded-lg border border-[#E4E7EC] bg-white hover:bg-[#F7F8FA] text-[#172033] text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-[#667085]" />
              <span>Cairkan QRIS</span>
            </button>

            <button
              type="button"
              onClick={() => setShowOpnameModal(true)}
              className="shrink-0 px-3.5 py-2 rounded-lg border border-[#E4E7EC] bg-white hover:bg-[#F7F8FA] text-[#667085] hover:text-[#172033] text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Opname Kas</span>
            </button>
          </div>
        </section>

        {/* 5. RIWAYAT MUTASI */}
        <section id="riwayat-mutasi-section" className="space-y-3">
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#172033]">
              RIWAYAT MUTASI
            </h2>
            <p className="text-xs text-[#667085] mt-0.5">
              Catatan semua aliran dana masuk, keluar &amp; transfer antar akun.
            </p>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white rounded-xl border border-[#E4E7EC] p-3 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
              {/* Filter Akun: [ Semua ] [ Kas ] [ QRIS ] [ Wallet ] [ Bank ] */}
              <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap scrollbar-none">
                {(
                  [
                    { id: 'ALL', label: 'Semua' },
                    { id: 'KAS', label: 'Kas' },
                    { id: 'QRIS', label: 'QRIS' },
                    { id: 'WALLET', label: 'Wallet' },
                    ...(isOwnerOrAdmin ? [{ id: 'BANK', label: 'Bank' }] : []),
                  ] as Array<{ id: MutationCategoryFilter; label: string }>
                ).map((tab) => {
                  const active =
                    mutationCategory === tab.id && !specificAccountFilter;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setMutationCategory(tab.id);
                        setSpecificAccountFilter(null);
                      }}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        active
                          ? 'bg-[#172033] text-white'
                          : 'bg-[#F7F8FA] text-[#667085] hover:text-[#172033]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}

                {specificAccountFilter && (
                  <button
                    type="button"
                    onClick={() => setSpecificAccountFilter(null)}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg bg-[#172033] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>{getCashAccountShortLabel(specificAccountFilter)}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Filter Periode: [ Hari Ini ] [ 7 Hari ] [ Bulan Ini ] [ Semua ] */}
              <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap scrollbar-none">
                {(
                  [
                    { id: 'TODAY', label: 'Hari Ini' },
                    { id: '7DAYS', label: '7 Hari' },
                    { id: 'MONTH', label: 'Bulan Ini' },
                    { id: 'ALL', label: 'Semua' },
                  ] as Array<{ id: PeriodFilter; label: string }>
                ).map((p) => {
                  const active = periodFilter === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPeriodFilter(p.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        active
                          ? 'bg-[#FF6B22] text-white'
                          : 'bg-[#F7F8FA] text-[#667085] hover:text-[#172033]'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#667085] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari transaksi, nomor nota, atau keterangan..."
                className="w-full pl-8 pr-7 py-2 rounded-lg border border-[#E4E7EC] bg-[#F7F8FA] focus:bg-white text-xs font-medium text-[#172033] placeholder:text-[#667085] focus:outline-none focus:border-[#FF6B22] transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#172033] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Table / List Mutasi */}
          <div className="bg-white rounded-xl border border-[#E4E7EC] overflow-hidden">
            {filteredMutations.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-xs font-bold text-[#172033]">
                  Belum ada riwayat mutasi yang sesuai filter.
                </p>
                {(mutationCategory !== 'ALL' ||
                  specificAccountFilter ||
                  periodFilter !== 'ALL' ||
                  searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setMutationCategory('ALL');
                      setSpecificAccountFilter(null);
                      setPeriodFilter('ALL');
                      setSearchQuery('');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[#E4E7EC] bg-white hover:bg-[#F7F8FA] text-xs font-semibold text-[#172033] cursor-pointer"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Table Mutasi */}
                <div
                  className={
                    isDesktopWide ? 'hidden md:block overflow-x-auto' : 'hidden'
                  }
                >
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F7F8FA] border-b border-[#E4E7EC] text-[11px] font-bold text-[#667085] uppercase tracking-wider">
                        <th className="py-3 pl-5 pr-3">Tanggal</th>
                        <th className="py-3 px-3">Keterangan</th>
                        <th className="py-3 px-3">Akun</th>
                        <th className="py-3 px-3">Jenis</th>
                        <th className="py-3 px-3 text-right">Nominal</th>
                        <th className="py-3 px-3 text-right">Saldo Setelah</th>
                        <th className="py-3 pl-3 pr-5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E7EC] text-xs">
                      {filteredMutations.slice(0, 100).map((mut) => {
                        const isIn = mut.flow === 'IN';
                        return (
                          <tr
                            key={mut.id}
                            className="hover:bg-[#F9FAFC] transition-colors"
                          >
                            <td className="py-3.5 pl-5 pr-3 whitespace-nowrap text-[#667085] tabular-nums">
                              {formatMutationDateTime(mut.createdAt, mut.date)}
                            </td>
                            <td className="py-3.5 px-3">
                              <p className="font-semibold text-[#172033]">
                                {mut.title}
                              </p>
                              {mut.notes && mut.notes !== mut.title && (
                                <p className="text-[11px] text-[#667085] truncate max-w-[260px]">
                                  {mut.notes}
                                </p>
                              )}
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap text-[#172033] font-medium">
                              {mut.accountLabel}
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <span
                                className={`font-bold ${
                                  isIn ? 'text-[#12B76A]' : 'text-[#F04438]'
                                }`}
                              >
                                {isIn ? 'Masuk' : 'Keluar'}
                              </span>
                            </td>
                            <td
                              className={`py-3.5 px-3 text-right whitespace-nowrap font-extrabold tabular-nums ${
                                isIn ? 'text-[#12B76A]' : 'text-[#F04438]'
                              }`}
                            >
                              {isIn ? '+' : '-'}
                              {formatRupiah(mut.amount)}
                            </td>
                            <td
                              className={`py-3.5 px-3 text-right whitespace-nowrap font-semibold tabular-nums ${
                                mut.balanceAfter < 0
                                  ? 'text-[#F04438]'
                                  : 'text-[#172033]'
                              }`}
                            >
                              {formatRupiah(mut.balanceAfter)}
                            </td>
                            <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setSelectedMutation(mut)}
                                className="text-xs font-semibold text-[#667085] hover:text-[#172033] underline-offset-2 hover:underline cursor-pointer"
                              >
                                Lihat
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Compact List Mutasi */}
                <div
                  className={
                    isDesktopWide
                      ? 'md:hidden divide-y divide-[#E4E7EC]'
                      : 'divide-y divide-[#E4E7EC]'
                  }
                >
                  {filteredMutations.slice(0, 80).map((mut) => {
                    const isIn = mut.flow === 'IN';
                    return (
                      <div
                        key={mut.id}
                        className="p-3.5 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-xs font-bold text-[#172033] truncate">
                            {mut.title}
                          </p>
                          <p className="text-[11px] text-[#667085] truncate">
                            {formatMutationDateTime(mut.createdAt, mut.date)} &middot;{' '}
                            {mut.accountLabel} &middot;{' '}
                            <span
                              className={`font-semibold ${
                                isIn ? 'text-[#12B76A]' : 'text-[#F04438]'
                              }`}
                            >
                              {isIn ? 'Masuk' : 'Keluar'}
                            </span>
                          </p>
                          <p className="text-[11px] text-[#667085]">
                            Saldo: {formatRupiah(mut.balanceAfter)}
                          </p>
                        </div>

                        <div className="text-right shrink-0 space-y-1">
                          <span
                            className={`block text-xs font-extrabold tabular-nums ${
                              isIn ? 'text-[#12B76A]' : 'text-[#F04438]'
                            }`}
                          >
                            {isIn ? '+' : '-'}
                            {formatRupiah(mut.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedMutation(mut)}
                            className="text-[11px] font-semibold text-[#667085] hover:text-[#172033] cursor-pointer"
                          >
                            Lihat
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* ========================================================= */}
      {/* MODALS                                                    */}
      {/* ========================================================= */}

      {/* MODAL DETAIL MUTASI ("Lihat") */}
      {selectedMutation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 border border-[#E4E7EC] shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#172033]">
                  Detail Mutasi Dana
                </h3>
                <p className="text-[11px] text-[#667085]">
                  {formatDateTimeIndonesian(selectedMutation.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMutation(null)}
                className="p-1.5 rounded-lg text-[#667085] hover:text-[#172033] hover:bg-[#F7F8FA] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#F2F4F7]">
                <span className="text-[#667085]">Keterangan</span>
                <span className="font-bold text-[#172033] text-right">
                  {selectedMutation.title}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F2F4F7]">
                <span className="text-[#667085]">Akun</span>
                <span className="font-semibold text-[#172033]">
                  {selectedMutation.accountLabel}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F2F4F7]">
                <span className="text-[#667085]">Kategori</span>
                <span className="font-semibold text-[#172033]">
                  {selectedMutation.typeLabel}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F2F4F7]">
                <span className="text-[#667085]">Jenis Aliran</span>
                <span
                  className={`font-bold ${
                    selectedMutation.flow === 'IN'
                      ? 'text-[#12B76A]'
                      : 'text-[#F04438]'
                  }`}
                >
                  {selectedMutation.flow === 'IN' ? 'Masuk' : 'Keluar'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F2F4F7]">
                <span className="text-[#667085]">Nominal</span>
                <span
                  className={`font-extrabold tabular-nums ${
                    selectedMutation.flow === 'IN'
                      ? 'text-[#12B76A]'
                      : 'text-[#F04438]'
                  }`}
                >
                  {selectedMutation.flow === 'IN' ? '+' : '-'}
                  {formatRupiah(selectedMutation.amount)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F2F4F7]">
                <span className="text-[#667085]">Saldo Setelah</span>
                <span className="font-bold text-[#172033] tabular-nums">
                  {formatRupiah(selectedMutation.balanceAfter)}
                </span>
              </div>
              {selectedMutation.notes && (
                <div className="flex justify-between py-1.5 border-b border-[#F2F4F7] gap-4">
                  <span className="text-[#667085] shrink-0">Catatan</span>
                  <span className="text-[#172033] text-right">
                    {selectedMutation.notes}
                  </span>
                </div>
              )}
              {selectedMutation.createdByName && (
                <div className="flex justify-between py-1.5">
                  <span className="text-[#667085]">Dicatat Oleh</span>
                  <span className="font-medium text-[#172033]">
                    {selectedMutation.createdByName}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedMutation(null)}
              className="w-full py-2.5 rounded-xl bg-[#172033] hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: AMBIL KAS OLEH OWNER (KAS_KASIR -> KAS_OWNER) */}
      {showOwnerTakeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 border border-[#E4E7EC] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#172033]">
                  Ambil Kas Laci oleh Owner
                </h3>
                <p className="text-[11px] text-[#667085]">
                  Pindahkan uang tunai Kas Kasir → Kas Owner (bukan pengeluaran)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOwnerTakeModal(false)}
                className="p-1.5 rounded-full bg-[#F7F8FA] text-[#667085] hover:text-[#172033]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#E4E7EC] flex items-center justify-between text-xs">
              <span className="text-[#667085] font-medium">Saldo Kas Kasir Tersedia:</span>
              <span className="font-black text-[#172033] tabular-nums">
                {formatRupiah(cashBalanceSummary.kasKasir)}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">
                  Nominal Diambil (Rp)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberInput(ownerTakeAmount)}
                  onChange={(e) => setOwnerTakeAmount(parseNumberInput(e.target.value))}
                  placeholder="0"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E7EC] bg-[#F7F8FA] text-sm font-extrabold text-[#172033] focus:outline-hidden focus:border-[#FF6B22] focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">
                  Catatan
                </label>
                <input
                  type="text"
                  value={ownerTakeNotes}
                  onChange={(e) => setOwnerTakeNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E4E7EC] bg-[#F7F8FA] text-xs text-[#172033]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowOwnerTakeModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E4E7EC] text-xs font-bold text-[#667085]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting || ownerTakeAmount <= 0}
                onClick={handleSaveOwnerTake}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6B22] hover:bg-[#E05A16] disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Mutasi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: TRANSFER ANTAR AKUN */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 border border-[#E4E7EC] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#172033]">
                  Transfer Antar Akun
                </h3>
                <p className="text-[11px] text-[#667085]">
                  Mutasi saldo internal tanpa mengubah omzet / biaya
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="p-1.5 rounded-full bg-[#F7F8FA] text-[#667085] hover:text-[#172033]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">
                  Dari Akun Asal
                </label>
                <select
                  value={trfFrom}
                  onChange={(e) => setTrfFrom(e.target.value as CanonicalCashAccount)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EC] bg-[#F7F8FA] text-xs font-bold text-[#172033]"
                >
                  {allowedTransferAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.label} ({formatRupiah(getAccountBalance(acc.id))})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">
                  Ke Akun Tujuan
                </label>
                <select
                  value={trfTo}
                  onChange={(e) => setTrfTo(e.target.value as CanonicalCashAccount)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EC] bg-[#F7F8FA] text-xs font-bold text-[#172033]"
                >
                  {CANONICAL_CASH_ACCOUNTS.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#172033]">
                    Nominal Transfer (Rp)
                  </label>
                  <button
                    type="button"
                    onClick={() => setTrfAmount(Math.max(0, getAccountBalance(trfFrom)))}
                    className="text-[11px] font-bold text-[#FF6B22] hover:underline cursor-pointer"
                  >
                    Semua Saldo ({formatRupiah(getAccountBalance(trfFrom))})
                  </button>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberInput(trfAmount)}
                  onChange={(e) => setTrfAmount(parseNumberInput(e.target.value))}
                  placeholder="0"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E7EC] bg-[#F7F8FA] text-sm font-extrabold text-[#172033]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">
                  Keterangan
                </label>
                <input
                  type="text"
                  value={trfNotes}
                  onChange={(e) => setTrfNotes(e.target.value)}
                  placeholder="Contoh: Setor uang tunai ke BCA"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E4E7EC] bg-[#F7F8FA] text-xs text-[#172033]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E4E7EC] text-xs font-bold text-[#667085]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting || trfAmount <= 0}
                onClick={handleSaveTransfer}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6B22] hover:bg-[#E05A16] disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer"
              >
                {isSubmitting ? 'Memproses...' : 'Transfer Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CAIRKAN QRIS KE BANK */}
      {showCairkanQrisModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 border border-[#E4E7EC] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#172033]">
                  Cairkan Saldo QRIS ke Bank
                </h3>
                <p className="text-[11px] text-[#667085]">
                  Pindahkan dana settlement QRIS ke rekening bank
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCairkanQrisModal(false)}
                className="p-1.5 rounded-full bg-[#F7F8FA] text-[#667085] hover:text-[#172033]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#E4E7EC] flex items-center justify-between text-xs">
              <span className="text-[#667085] font-medium">Saldo Kas QRIS Saat Ini:</span>
              <span className="font-black text-[#172033] tabular-nums">
                {formatRupiah(cashBalanceSummary.kasQris)}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">
                  Rekening Bank Tujuan
                </label>
                <select
                  value={cairkanDestAccount}
                  onChange={(e) =>
                    setCairkanDestAccount(e.target.value as CanonicalCashAccount)
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EC] bg-[#F7F8FA] text-xs font-bold text-[#172033]"
                >
                  <option value="BANK_BCA">Bank BCA</option>
                  <option value="BANK_JAGO">Bank Jago</option>
                  <option value="BANK_MANDIRI">Bank Mandiri</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">
                  Nominal Pencairan (Rp)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberInput(cairkanAmount)}
                  onChange={(e) => setCairkanAmount(parseNumberInput(e.target.value))}
                  placeholder="0"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E7EC] bg-[#F7F8FA] text-sm font-extrabold text-[#172033]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">
                  Catatan
                </label>
                <input
                  type="text"
                  value={cairkanNotes}
                  onChange={(e) => setCairkanNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E4E7EC] bg-[#F7F8FA] text-xs text-[#172033]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCairkanQrisModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E4E7EC] text-xs font-bold text-[#667085]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting || cairkanAmount <= 0}
                onClick={handleSaveCairkanQris}
                className="flex-1 py-2.5 rounded-xl bg-[#172033] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer"
              >
                {isSubmitting ? 'Menyimpan...' : 'Cairkan Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: PENCAIRAN SALDO WALLET PLATFORM KE BANK */}
      {showPlatformSettlementModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 border border-[#E4E7EC] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#172033]">
                  Cairkan Saldo Wallet Platform
                </h3>
                <p className="text-[11px] text-[#667085]">
                  Pindahkan dana bersih platform online ke rekening bank
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPlatformSettlementModal(false)}
                className="p-1.5 rounded-full bg-[#F7F8FA] text-[#667085] hover:text-[#172033]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">
                  Pilih Wallet Platform
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'WALLET_GOFOOD', label: 'GoFood' },
                      { id: 'WALLET_GRABFOOD', label: 'GrabFood' },
                      { id: 'WALLET_SHOPEEFOOD', label: 'ShopeeFood' },
                    ] as Array<{ id: CanonicalCashAccount; label: string }>
                  ).map((w) => {
                    const bal = getAccountBalance(w.id);
                    const active = settleSourceAccount === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          setSettleSourceAccount(w.id);
                          setSettleAmount(bal > 0 ? bal : 0);
                          setSettleNotes(`Pencairan ${w.label} ke Rekening Bank`);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          active
                            ? 'border-[#FF6B22] bg-[#FFF6F0] text-[#172033]'
                            : 'border-[#E4E7EC] bg-[#F7F8FA] text-[#667085]'
                        }`}
                      >
                        <span className="text-xs font-extrabold block">{w.label}</span>
                        <span className="text-[11px] font-bold tabular-nums block mt-0.5 text-[#172033]">
                          {formatRupiah(bal)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">
                  Ke Rekening Bank Tujuan
                </label>
                <select
                  value={settleDestAccount}
                  onChange={(e) =>
                    setSettleDestAccount(e.target.value as CanonicalCashAccount)
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EC] bg-[#F7F8FA] text-xs font-bold text-[#172033]"
                >
                  <option value="BANK_BCA">Bank BCA</option>
                  <option value="BANK_JAGO">Bank Jago</option>
                  <option value="BANK_MANDIRI">Bank Mandiri</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#172033]">
                    Nominal Pencairan (Rp)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setSettleAmount(Math.max(0, getAccountBalance(settleSourceAccount)))
                    }
                    className="text-[11px] font-bold text-[#FF6B22] hover:underline cursor-pointer"
                  >
                    Cairkan Semua ({formatRupiah(getAccountBalance(settleSourceAccount))})
                  </button>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberInput(settleAmount)}
                  onChange={(e) => setSettleAmount(parseNumberInput(e.target.value))}
                  placeholder="0"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E7EC] bg-[#F7F8FA] text-sm font-extrabold text-[#172033]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">
                  Catatan
                </label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E4E7EC] bg-[#F7F8FA] text-xs text-[#172033]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPlatformSettlementModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E4E7EC] text-xs font-bold text-[#667085]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting || settleAmount <= 0}
                onClick={handleSavePlatformSettlement}
                className="flex-1 py-2.5 rounded-xl bg-[#172033] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer"
              >
                {isSubmitting ? 'Memproses...' : 'Cairkan ke Bank'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: OPNAME / HITUNG FISIK KAS KASIR */}
      {showOpnameModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 border border-[#E4E7EC] shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#172033]">
                  Hitung Uang Fisik Laci (Opname)
                </h3>
                <p className="text-[11px] text-[#667085]">
                  Cocokkan jumlah uang tunai di laci dengan saldo sistem
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOpnameModal(false)}
                className="p-1.5 rounded-full bg-[#F7F8FA] text-[#667085] hover:text-[#172033]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {Object.keys(cashDenominations)
                .map(Number)
                .sort((a, b) => b - a)
                .map((denom) => (
                  <div
                    key={denom}
                    className="p-2.5 rounded-xl bg-[#F7F8FA] border border-[#E4E7EC] flex items-center justify-between gap-2"
                  >
                    <span className="text-xs font-bold text-[#172033] tabular-nums">
                      {formatRupiah(denom)}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={cashDenominations[denom] || ''}
                      placeholder="0"
                      onChange={(e) =>
                        setCashDenominations((prev) => ({
                          ...prev,
                          [denom]: Math.max(0, parseInt(e.target.value || '0', 10)),
                        }))
                      }
                      className="w-16 px-2 py-1 rounded-lg bg-white border border-[#E4E7EC] text-right text-xs font-extrabold text-[#172033]"
                    />
                  </div>
                ))}
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#E4E7EC] space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#667085]">Saldo Sistem (Kas Kasir):</span>
                <span className="font-bold text-[#172033] tabular-nums">
                  {formatRupiah(cashBalanceSummary.kasKasir)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#667085]">Total Fisik Dihitung:</span>
                <span className="font-extrabold text-[#172033] tabular-nums">
                  {formatRupiah(totalPhysicalCash)}
                </span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-[#E4E7EC]">
                <span className="font-bold text-[#172033]">Selisih:</span>
                <span
                  className={`font-black tabular-nums ${
                    cashDifference === 0
                      ? 'text-[#12B76A]'
                      : cashDifference > 0
                      ? 'text-[#12B76A]'
                      : 'text-[#F04438]'
                  }`}
                >
                  {cashDifference === 0
                    ? 'Pas (Rp 0)'
                    : `${cashDifference > 0 ? '+' : '-'}${formatRupiah(
                        Math.abs(cashDifference)
                      )}`}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowOpnameModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E4E7EC] text-xs font-bold text-[#667085]"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveOpname}
                className="flex-1 py-2.5 rounded-xl bg-[#172033] hover:bg-slate-800 text-white text-xs font-extrabold cursor-pointer"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Hasil Opname'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: TAMBAH / PENYESUAIAN SALDO AKUN */}
      {showManualMutationModal && isOwnerOrAdmin && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 border border-[#E4E7EC] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#172033]">
                  Tambah / Sesuaikan Saldo Akun
                </h3>
                <p className="text-[11px] text-[#667085]">
                  Catat saldo awal atau koreksi mutasi masuk/keluar pada akun
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManualMutationModal(false)}
                className="p-1.5 rounded-full bg-[#F7F8FA] text-[#667085] hover:text-[#172033]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">
                  Pilih Akun
                </label>
                <select
                  value={manualAccount}
                  onChange={(e) =>
                    setManualAccount(e.target.value as CanonicalCashAccount)
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EC] bg-[#F7F8FA] text-xs font-bold text-[#172033]"
                >
                  {CANONICAL_CASH_ACCOUNTS.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.label} ({formatRupiah(getAccountBalance(acc.id))})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setManualFlow('IN')}
                  className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                    manualFlow === 'IN'
                      ? 'bg-[#12B76A] text-white border-[#12B76A]'
                      : 'bg-[#F7F8FA] text-[#667085] border-[#E4E7EC]'
                  }`}
                >
                  + Saldo Masuk
                </button>
                <button
                  type="button"
                  onClick={() => setManualFlow('OUT')}
                  className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                    manualFlow === 'OUT'
                      ? 'bg-[#F04438] text-white border-[#F04438]'
                      : 'bg-[#F7F8FA] text-[#667085] border-[#E4E7EC]'
                  }`}
                >
                  - Saldo Keluar
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">
                  Nominal (Rp)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberInput(manualAmount)}
                  onChange={(e) => setManualAmount(parseNumberInput(e.target.value))}
                  placeholder="0"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E7EC] bg-[#F7F8FA] text-sm font-extrabold text-[#172033]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">
                  Keterangan
                </label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E4E7EC] bg-[#F7F8FA] text-xs text-[#172033]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">
                  Catatan Tambahan
                </label>
                <input
                  type="text"
                  value={manualCustomNotes}
                  onChange={(e) => setManualCustomNotes(e.target.value)}
                  placeholder="Opsional..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E4E7EC] bg-[#F7F8FA] text-xs text-[#172033]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowManualMutationModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E4E7EC] text-xs font-bold text-[#667085]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting || manualAmount <= 0}
                onClick={handleSaveManualMutation}
                className="flex-1 py-2.5 rounded-xl bg-[#172033] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: KODE QRIS STATIS */}
      {showQrisDisplayModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 border border-[#E4E7EC] shadow-2xl text-center">
            <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-3 text-left">
              <div>
                <h3 className="text-sm font-extrabold text-[#172033]">
                  QRIS Ayam Geprek ARY
                </h3>
                <p className="text-[11px] text-[#667085]">
                  Dana masuk otomatis ke akun Kas QRIS
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQrisDisplayModal(false)}
                className="p-1.5 rounded-full bg-[#F7F8FA] text-[#667085] hover:text-[#172033]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 bg-[#F7F8FA] rounded-xl border border-[#E4E7EC] flex flex-col items-center justify-center space-y-2">
              <QrCode className="w-36 h-36 text-[#172033]" />
              <span className="text-xs font-extrabold text-[#172033]">
                AYAM GEPREK ARY - QRIS
              </span>
              <span className="text-[11px] text-[#12B76A] font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Terintegrasi Kas QRIS</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowQrisDisplayModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#172033] text-white text-xs font-extrabold cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
