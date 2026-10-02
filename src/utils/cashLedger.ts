import {
  CanonicalCashAccount,
  CashAccount,
  CashBalanceSummary,
  CashMutation,
  Expense,
  PaymentMethod,
  Sale,
  Shift,
} from '../types';

export const CANONICAL_CASH_ACCOUNTS: Array<{
  id: CanonicalCashAccount;
  label: string;
  shortLabel: string;
  subtitle: string;
  isPhysicalDrawer?: boolean;
  isBank?: boolean;
  isPlatformWallet?: boolean;
  platform?: 'GOFOOD' | 'GRABFOOD' | 'SHOPEEFOOD';
}> = [
  {
    id: 'KAS_KASIR',
    label: 'Kas Kasir (Laci)',
    shortLabel: 'Kas Kasir',
    subtitle: 'Uang tunai fisik di laci kasir',
    isPhysicalDrawer: true,
  },
  {
    id: 'KAS_QRIS',
    label: 'Kas QRIS',
    shortLabel: 'Kas QRIS',
    subtitle: 'Penerimaan pembayaran QRIS',
  },
  {
    id: 'KAS_OWNER',
    label: 'Kas Owner',
    shortLabel: 'Kas Owner',
    subtitle: 'Uang tunai yang diambil/dipegang Owner',
  },
  {
    id: 'BANK_BCA',
    label: 'Bank BCA',
    shortLabel: 'BCA',
    subtitle: 'Saldo Rekening BCA',
    isBank: true,
  },
  {
    id: 'BANK_JAGO',
    label: 'Bank Jago',
    shortLabel: 'Jago',
    subtitle: 'Saldo Rekening Bank Jago',
    isBank: true,
  },
  {
    id: 'BANK_MANDIRI',
    label: 'Bank Mandiri',
    shortLabel: 'Mandiri',
    subtitle: 'Saldo Rekening Bank Mandiri',
    isBank: true,
  },
  {
    id: 'WALLET_GOFOOD',
    label: 'Dompet GoFood',
    shortLabel: 'Wallet GoFood',
    subtitle: 'Saldo tertahan aplikasi GoFood (sebelum settlement)',
    isPlatformWallet: true,
    platform: 'GOFOOD',
  },
  {
    id: 'WALLET_GRABFOOD',
    label: 'Dompet GrabFood',
    shortLabel: 'Wallet GrabFood',
    subtitle: 'Saldo tertahan aplikasi GrabFood (sebelum settlement)',
    isPlatformWallet: true,
    platform: 'GRABFOOD',
  },
  {
    id: 'WALLET_SHOPEEFOOD',
    label: 'Dompet ShopeeFood',
    shortLabel: 'Wallet ShopeeFood',
    subtitle: 'Saldo tertahan aplikasi ShopeeFood (sebelum settlement)',
    isPlatformWallet: true,
    platform: 'SHOPEEFOOD',
  },
];

export function getPlatformWalletAccount(
  orderType?: string | null
): CanonicalCashAccount | null {
  if (!orderType) return null;
  const upper = orderType.trim().toUpperCase();
  if (upper === 'GOFOOD' || upper === 'WALLET_GOFOOD') return 'WALLET_GOFOOD';
  if (upper === 'GRABFOOD' || upper === 'WALLET_GRABFOOD') return 'WALLET_GRABFOOD';
  if (upper === 'SHOPEEFOOD' || upper === 'WALLET_SHOPEEFOOD') return 'WALLET_SHOPEEFOOD';
  return null;
}

export function isPlatformWalletAccount(account?: string | null): boolean {
  if (!account) return false;
  const upper = account.trim().toUpperCase();
  return (
    upper === 'WALLET_GOFOOD' ||
    upper === 'WALLET_GRABFOOD' ||
    upper === 'WALLET_SHOPEEFOOD'
  );
}

export function isCashPaymentMethod(method?: string | null): boolean {
  if (!method) return true;
  const upper = method.trim().toUpperCase();
  return upper === 'CASH' || upper === 'TUNAI' || upper === 'KAS_KASIR' || upper === 'KAS_TUNAI';
}

export function mapPaymentMethodToAccount(
  method?: string | null,
  orderType?: string | null
): CanonicalCashAccount {
  const platformWallet = getPlatformWalletAccount(orderType);
  if (platformWallet) {
    return platformWallet;
  }

  if (!method) return 'KAS_KASIR';
  const upper = method.trim().toUpperCase();
  if (upper === 'WALLET_GOFOOD' || upper === 'GOFOOD') return 'WALLET_GOFOOD';
  if (upper === 'WALLET_GRABFOOD' || upper === 'GRABFOOD') return 'WALLET_GRABFOOD';
  if (upper === 'WALLET_SHOPEEFOOD' || upper === 'SHOPEEFOOD') return 'WALLET_SHOPEEFOOD';
  if (upper === 'CASH' || upper === 'TUNAI' || upper === 'KAS_KASIR' || upper === 'KAS_TUNAI') {
    return 'KAS_KASIR';
  }
  if (upper === 'QRIS' || upper === 'KAS_QRIS' || upper === 'SALDO_QRIS') {
    return 'KAS_QRIS';
  }
  if (upper === 'BCA' || upper === 'BANK_BCA') {
    return 'BANK_BCA';
  }
  if (upper === 'JAGO' || upper === 'BANK_JAGO' || upper.includes('JAGO')) {
    return 'BANK_JAGO';
  }
  if (upper === 'MANDIRI' || upper === 'BANK_MANDIRI' || upper.includes('MANDIRI')) {
    return 'BANK_MANDIRI';
  }
  if (upper === 'KAS_OWNER' || upper === 'OWNER') {
    return 'KAS_OWNER';
  }
  if (upper === 'TRANSFER' || upper === 'SALDO_TRANSFER') {
    return 'BANK_BCA';
  }
  return 'KAS_KASIR';
}

/**
 * Computes the wallet account and exact ledger inflow amount for a completed Sale.
 * - For OFFLINE (or legacy sales): uses `sale.finalAmount` into `KAS_KASIR` / `KAS_QRIS` / `BANK_*`.
 * - For Marketplace (`GOFOOD` / `GRABFOOD` / `SHOPEEFOOD`):
 *   - ALWAYS routes into the platform's own wallet (`WALLET_GOFOOD`, `WALLET_GRABFOOD`, `WALLET_SHOPEEFOOD`).
 *   - NEVER goes directly into `KAS_KASIR`, `KAS_QRIS`, or `BANK_*` until a Settlement (Pencairan) is performed.
 *   - Uses `sale.netSettlementAmount` (i.e. `foodTotal - platformServiceFee`).
 */
export function getSaleLedgerInflow(sale: Sale): {
  account: CanonicalCashAccount | null;
  amount: number;
} {
  const platformWallet = getPlatformWalletAccount(sale.orderType);

  if (platformWallet) {
    if (typeof sale.walletAmount === 'number') {
      return { account: platformWallet, amount: Math.max(0, sale.walletAmount) };
    }
    if (sale.platformSnapshot && typeof sale.platformSnapshot.walletAmount === 'number') {
      return { account: platformWallet, amount: Math.max(0, sale.platformSnapshot.walletAmount) };
    }
    if (typeof sale.netSettlementAmount === 'number') {
      return { account: platformWallet, amount: Math.max(0, sale.netSettlementAmount) };
    }
    const foodTotal =
      typeof sale.foodTotal === 'number' ? sale.foodTotal : sale.finalAmount || 0;
    const platformFee = sale.platformServiceFee || sale.totalPlatformFee || 0;
    const netAmount = Math.max(0, foodTotal - platformFee);

    return { account: platformWallet, amount: netAmount };
  }

  const amount = sale.finalAmount || 0;
  const targetAcc = sale.paymentAccount
    ? normalizeCashAccount(sale.paymentAccount)
    : mapPaymentMethodToAccount(sale.paymentMethod, 'OFFLINE');

  return { account: targetAcc, amount };
}

export function normalizeCashAccount(
  account?: string | null,
  hintText?: string
): CanonicalCashAccount {
  if (!account) return 'KAS_KASIR';
  const upper = account.trim().toUpperCase();

  // 1. Exact canonical matches first (prevents hintText from overriding explicit account keys)
  if (upper === 'KAS_KASIR') return 'KAS_KASIR';
  if (upper === 'KAS_QRIS') return 'KAS_QRIS';
  if (upper === 'KAS_OWNER') return 'KAS_OWNER';
  if (upper === 'BANK_BCA') return 'BANK_BCA';
  if (upper === 'BANK_JAGO') return 'BANK_JAGO';
  if (upper === 'BANK_MANDIRI') return 'BANK_MANDIRI';
  if (upper === 'WALLET_GOFOOD') return 'WALLET_GOFOOD';
  if (upper === 'WALLET_GRABFOOD') return 'WALLET_GRABFOOD';
  if (upper === 'WALLET_SHOPEEFOOD') return 'WALLET_SHOPEEFOOD';

  // 2. Legacy & alias matches
  if (upper === 'GOFOOD' || upper.includes('WALLET_GOFOOD') || upper.includes('DOMPET GOFOOD')) {
    return 'WALLET_GOFOOD';
  }
  if (upper === 'GRABFOOD' || upper.includes('WALLET_GRABFOOD') || upper.includes('DOMPET GRABFOOD')) {
    return 'WALLET_GRABFOOD';
  }
  if (upper === 'SHOPEEFOOD' || upper.includes('WALLET_SHOPEEFOOD') || upper.includes('DOMPET SHOPEEFOOD')) {
    return 'WALLET_SHOPEEFOOD';
  }

  if (
    upper === 'KAS_TUNAI' ||
    upper === 'TUNAI' ||
    upper === 'CASH' ||
    upper === 'KAS' ||
    upper === 'KAS LACI'
  ) {
    return 'KAS_KASIR';
  }
  if (
    upper === 'SALDO_QRIS' ||
    upper === 'QRIS' ||
    upper.includes('QRIS') ||
    upper.includes('GOPAY') ||
    upper.includes('OVO') ||
    upper.includes('DANA')
  ) {
    return 'KAS_QRIS';
  }
  if (upper === 'OWNER' || upper.includes('OWNER')) {
    return 'KAS_OWNER';
  }
  if (upper === 'JAGO' || upper.includes('JAGO')) {
    return 'BANK_JAGO';
  }
  if (upper === 'MANDIRI' || upper.includes('MANDIRI')) {
    return 'BANK_MANDIRI';
  }
  if (upper === 'BCA' || upper.includes('BCA')) {
    return 'BANK_BCA';
  }

  // Legacy SALDO_TRANSFER or Transfer: inspect hintText (e.g. title/notes) for Jago or Mandiri
  if (upper === 'SALDO_TRANSFER' || upper === 'TRANSFER' || upper.includes('BANK')) {
    if (hintText) {
      const hintUpper = hintText.toUpperCase();
      if (hintUpper.includes('JAGO')) return 'BANK_JAGO';
      if (hintUpper.includes('MANDIRI')) return 'BANK_MANDIRI';
    }
    return 'BANK_BCA';
  }

  return 'KAS_KASIR';
}

export function getCashAccountLabel(account?: string | null, hintText?: string): string {
  const canonical = normalizeCashAccount(account, hintText);
  const found = CANONICAL_CASH_ACCOUNTS.find((a) => a.id === canonical);
  return found ? found.label : 'Kas Kasir (Laci)';
}

export function getCashAccountShortLabel(account?: string | null, hintText?: string): string {
  const canonical = normalizeCashAccount(account, hintText);
  const found = CANONICAL_CASH_ACCOUNTS.find((a) => a.id === canonical);
  return found ? found.shortLabel : 'Kas Kasir';
}

export function formatPaymentMethodBadge(method?: PaymentMethod | string | null): string {
  if (!method) return 'CASH';
  const upper = method.trim().toUpperCase();
  if (upper === 'TUNAI' || upper === 'CASH') return 'CASH';
  if (upper === 'QRIS') return 'QRIS';
  if (upper === 'BCA') return 'BCA';
  if (upper === 'JAGO') return 'JAGO';
  if (upper === 'MANDIRI') return 'MANDIRI';
  if (upper === 'TRANSFER') return 'BCA';
  return method;
}

/**
 * Prevents double-counting of legacy Purchase expenses that also generated a CashMutation
 * with the same PO number or purchase ID.
 */
export function isDuplicatePurchaseExpense(
  exp: Expense,
  cashMutations: CashMutation[]
): boolean {
  const note = (exp.note || '').trim();
  if (!note.startsWith('Pembelian #PO-') && !note.startsWith('Bayar Hutang PO #')) {
    return false;
  }
  const poMatch = note.match(/PO-\d{8}-\d+/);
  if (!poMatch) return false;
  const poNumber = poMatch[0];

  return cashMutations.some(
    (m) =>
      m.flow === 'OUT' &&
      m.amount === exp.amount &&
      ((m.title && m.title.includes(poNumber)) || (m.notes && m.notes.includes(poNumber)))
  );
}

/**
 * Filters out legacy auto-generated PO/purchase expense entries so operational expenses
 * are not double-counted alongside purchase records or cash mutations.
 */
export function filterStandaloneExpenses(expenses: Expense[]): Expense[] {
  return expenses.filter((exp) => {
    const note = (exp.note || '').trim();
    if (note.startsWith('Pembelian #PO-') || note.startsWith('Bayar Hutang PO #')) {
      return false;
    }
    return true;
  });
}

export interface ShiftCashMetrics {
  openingCash: number;
  cashSales: number;
  qrisSales: number;
  bcaSales: number;
  jagoSales: number;
  mandiriSales: number;
  transferSales: number;
  gofoodSales: number;
  grabfoodSales: number;
  shopeefoodSales: number;
  platformSales: number;
  totalSales: number;
  cashExpenses: number;
  ownerWithdrawals: number;
  cashInMutations: number;
  cashOutMutations: number;
  totalCashOut: number;
  expectedCash: number;
  transactionCount: number;
  relevantSales: Sale[];
}

/**
 * Single source of truth for active/closing shift cash calculations.
 * Ensures KAS_KASIR (expectedCash) ONLY includes:
 *   openingCash + cashSales + cashInMutations - cashExpenses - cashOutMutations (including owner withdrawals).
 * QRIS, Bank Transfers, and Platform Wallets (GoFood, GrabFood, ShopeeFood) NEVER enter physical drawer cash.
 */
export function calculateShiftCashMetrics(params: {
  activeShift?: Shift;
  sales: Sale[];
  expenses: Expense[];
  cashMutations: CashMutation[];
  fallbackStartIso?: string;
  endIso?: string;
}): ShiftCashMetrics {
  const { activeShift, sales, expenses, cashMutations, fallbackStartIso, endIso } = params;
  const nowIso = endIso || new Date().toISOString();
  const boundaryIso = activeShift
    ? activeShift.openedAt
    : fallbackStartIso || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const relevantSales = sales
    .filter(
      (s) =>
        s.status === 'COMPLETED' &&
        s.createdAt >= boundaryIso &&
        s.createdAt <= nowIso
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  let cashSales = 0;
  let qrisSales = 0;
  let bcaSales = 0;
  let jagoSales = 0;
  let mandiriSales = 0;
  let gofoodSales = 0;
  let grabfoodSales = 0;
  let shopeefoodSales = 0;

  relevantSales.forEach((s) => {
    const { account: targetAcc, amount: amt } = getSaleLedgerInflow(s);
    if (!targetAcc || amt <= 0) return;

    if (targetAcc === 'KAS_KASIR') cashSales += amt;
    else if (targetAcc === 'KAS_QRIS') qrisSales += amt;
    else if (targetAcc === 'BANK_BCA') bcaSales += amt;
    else if (targetAcc === 'BANK_JAGO') jagoSales += amt;
    else if (targetAcc === 'BANK_MANDIRI') mandiriSales += amt;
    else if (targetAcc === 'WALLET_GOFOOD') gofoodSales += amt;
    else if (targetAcc === 'WALLET_GRABFOOD') grabfoodSales += amt;
    else if (targetAcc === 'WALLET_SHOPEEFOOD') shopeefoodSales += amt;
  });

  const transferSales = bcaSales + jagoSales + mandiriSales;
  const platformSales = gofoodSales + grabfoodSales + shopeefoodSales;
  const totalSales = cashSales + qrisSales + transferSales + platformSales;

  let cashExpenses = 0;
  let ownerWithdrawals = 0;
  let cashInMutations = 0;
  let cashOutMutations = 0;

  if (activeShift) {
    const relevantExpenses = expenses.filter(
      (e) =>
        e.createdAt >= activeShift.openedAt &&
        e.createdAt <= nowIso &&
        !isDuplicatePurchaseExpense(e, cashMutations)
    );

    relevantExpenses.forEach((e) => {
      const expAcc = normalizeCashAccount(e.paymentSource || 'KAS_KASIR', e.note);
      if (expAcc === 'KAS_KASIR') {
        cashExpenses += e.amount || 0;
      }
    });

    const relevantMutations = cashMutations.filter((m) => {
      if (m.createdAt < activeShift.openedAt || m.createdAt > nowIso) return false;
      // Never double-count the shift's own MODAL_AWAL mutation because activeShift.openingCash is already the base
      if (m.type === 'MODAL_AWAL') {
        if (m.referenceId === activeShift.id) return false;
        if (
          Math.abs(
            new Date(m.createdAt).getTime() - new Date(activeShift.openedAt).getTime()
          ) < 15000
        ) {
          return false;
        }
      }
      // Also ignore closing reconciliation mutation of this shift if already created
      if (m.type === 'PENYESUAIAN' && m.referenceId === activeShift.id) {
        return false;
      }
      return true;
    });

    relevantMutations.forEach((m) => {
      const mutAcc = normalizeCashAccount(m.account, `${m.title} ${m.notes || ''}`);
      if (mutAcc === 'KAS_KASIR') {
        if (m.flow === 'IN') {
          cashInMutations += m.amount || 0;
        } else {
          cashOutMutations += m.amount || 0;
          if (
            m.type === 'SETOR_OWNER' ||
            normalizeCashAccount(m.relatedAccount) === 'KAS_OWNER' ||
            (m.title && m.title.toUpperCase().includes('OWNER'))
          ) {
            ownerWithdrawals += m.amount || 0;
          }
        }
      }
    });
  }

  const openingCash = activeShift ? activeShift.openingCash || 0 : 0;
  const totalCashOut = cashExpenses + cashOutMutations;
  const expectedCash = activeShift
    ? openingCash + cashSales + cashInMutations - totalCashOut
    : cashSales;

  return {
    openingCash,
    cashSales,
    qrisSales,
    bcaSales,
    jagoSales,
    mandiriSales,
    transferSales,
    gofoodSales,
    grabfoodSales,
    shopeefoodSales,
    platformSales,
    totalSales,
    cashExpenses,
    ownerWithdrawals,
    cashInMutations,
    cashOutMutations,
    totalCashOut,
    expectedCash,
    transactionCount: relevantSales.length,
    relevantSales,
  };
}

/**
 * Calculates all company cash, bank, and online platform wallets without double-counting shifts' MODAL_AWAL
 * or duplicate purchase expenses.
 */
export function calculateCompanyCashSummary(params: {
  sales: Sale[];
  expenses: Expense[];
  cashMutations: CashMutation[];
  shifts: Shift[];
}): CashBalanceSummary {
  const { sales, expenses, cashMutations, shifts } = params;

  let kasKasir = 0;
  let kasQris = 0;
  let kasOwner = 0;
  let bankBca = 0;
  let bankJago = 0;
  let bankMandiri = 0;
  let walletGofood = 0;
  let walletGrabfood = 0;
  let walletShopeefood = 0;

  let todayKasMasuk = 0;
  let todayQrisMasuk = 0;
  let todayBcaMasuk = 0;
  let todayJagoMasuk = 0;
  let todayMandiriMasuk = 0;
  let todayGofoodMasuk = 0;
  let todayGrabfoodMasuk = 0;
  let todayShopeefoodMasuk = 0;
  let todayPlatformSettled = 0;
  let todayPengeluaranKas = 0;
  let todayDiambilOwner = 0;

  const todayStr = new Date().toISOString().split('T')[0];

  // Determine the latest shift anchor for physical KAS_KASIR so openingCash is NEVER double-counted across shifts
  const sortedOpenShifts = shifts
    .filter((s) => s.status === 'OPEN')
    .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
  const currentOpenShift = sortedOpenShifts[0];

  const sortedClosedShifts = shifts
    .filter((s) => s.status === 'CLOSED')
    .sort(
      (a, b) =>
        new Date(b.closedAt || b.openedAt).getTime() -
        new Date(a.closedAt || a.openedAt).getTime()
    );
  const lastClosedShift = sortedClosedShifts[0];

  let kasKasirAnchorTime: string | null = null;
  let kasKasirAnchorShiftId: string | null = null;

  if (currentOpenShift) {
    kasKasir = currentOpenShift.openingCash || 0;
    kasKasirAnchorTime = currentOpenShift.openedAt;
    kasKasirAnchorShiftId = currentOpenShift.id;
  } else if (lastClosedShift) {
    kasKasir =
      typeof lastClosedShift.actualCash === 'number'
        ? lastClosedShift.actualCash
        : lastClosedShift.expectedCash ?? 0;
    kasKasirAnchorTime = lastClosedShift.closedAt || lastClosedShift.openedAt;
    kasKasirAnchorShiftId = lastClosedShift.id;
  }

  // 1. Sales inflows
  sales.forEach((sale) => {
    if (sale.status !== 'COMPLETED') return;
    const { account: targetAcc, amount } = getSaleLedgerInflow(sale);
    if (!targetAcc || amount <= 0) return;

    const isToday =
      (sale.createdAt && sale.createdAt.startsWith(todayStr)) || sale.date === todayStr;

    if (targetAcc === 'KAS_KASIR') {
      if (!kasKasirAnchorTime || sale.createdAt >= kasKasirAnchorTime) {
        kasKasir += amount;
      }
      if (isToday) todayKasMasuk += amount;
    } else if (targetAcc === 'KAS_QRIS') {
      kasQris += amount;
      if (isToday) todayQrisMasuk += amount;
    } else if (targetAcc === 'BANK_BCA') {
      bankBca += amount;
      if (isToday) todayBcaMasuk += amount;
    } else if (targetAcc === 'BANK_JAGO') {
      bankJago += amount;
      if (isToday) todayJagoMasuk += amount;
    } else if (targetAcc === 'BANK_MANDIRI') {
      bankMandiri += amount;
      if (isToday) todayMandiriMasuk += amount;
    } else if (targetAcc === 'KAS_OWNER') {
      kasOwner += amount;
    } else if (targetAcc === 'WALLET_GOFOOD') {
      walletGofood += amount;
      if (isToday) todayGofoodMasuk += amount;
    } else if (targetAcc === 'WALLET_GRABFOOD') {
      walletGrabfood += amount;
      if (isToday) todayGrabfoodMasuk += amount;
    } else if (targetAcc === 'WALLET_SHOPEEFOOD') {
      walletShopeefood += amount;
      if (isToday) todayShopeefoodMasuk += amount;
    }
  });

  // 2. Expenses outflows (excluding legacy duplicate purchase expenses)
  expenses.forEach((exp) => {
    if (isDuplicatePurchaseExpense(exp, cashMutations)) return;

    const amount = exp.amount || 0;
    const isToday =
      (exp.createdAt && exp.createdAt.startsWith(todayStr)) || exp.date === todayStr;
    const targetAcc = normalizeCashAccount(exp.paymentSource || 'KAS_KASIR', exp.note);

    if (targetAcc === 'KAS_KASIR') {
      if (!kasKasirAnchorTime || exp.createdAt >= kasKasirAnchorTime) {
        kasKasir -= amount;
      }
      if (isToday) todayPengeluaranKas += amount;
    } else if (targetAcc === 'KAS_QRIS') {
      kasQris -= amount;
    } else if (targetAcc === 'KAS_OWNER') {
      kasOwner -= amount;
    } else if (targetAcc === 'BANK_BCA') {
      bankBca -= amount;
    } else if (targetAcc === 'BANK_JAGO') {
      bankJago -= amount;
    } else if (targetAcc === 'BANK_MANDIRI') {
      bankMandiri -= amount;
    } else if (targetAcc === 'WALLET_GOFOOD') {
      walletGofood -= amount;
    } else if (targetAcc === 'WALLET_GRABFOOD') {
      walletGrabfood -= amount;
    } else if (targetAcc === 'WALLET_SHOPEEFOOD') {
      walletShopeefood -= amount;
    }
  });

  // 3. Cash Mutations (Transfers, Owner Withdrawals, Platform Settlements, QRIS Settlements, Manual Adjustments)
  cashMutations.forEach((mut) => {
    const amount = mut.amount || 0;
    const isToday =
      (mut.createdAt && mut.createdAt.startsWith(todayStr)) || mut.date === todayStr;
    const targetAcc = normalizeCashAccount(
      mut.account,
      `${mut.title || ''} ${mut.notes || ''}`
    );

    if (targetAcc === 'KAS_KASIR') {
      if (kasKasirAnchorTime) {
        if (mut.createdAt < kasKasirAnchorTime) return;
        // Skip the anchor shift's own MODAL_AWAL or closing PENYESUAIAN because the anchor already includes it
        if (mut.type === 'MODAL_AWAL') {
          if (mut.referenceId === kasKasirAnchorShiftId) return;
          if (
            Math.abs(
              new Date(mut.createdAt).getTime() - new Date(kasKasirAnchorTime).getTime()
            ) < 15000
          ) {
            return;
          }
        }
        if (mut.type === 'PENYESUAIAN' && mut.referenceId === kasKasirAnchorShiftId) {
          return;
        }
      }

      if (mut.flow === 'IN') {
        kasKasir += amount;
      } else {
        kasKasir -= amount;
        if (isToday) {
          if (
            mut.type === 'SETOR_OWNER' ||
            normalizeCashAccount(mut.relatedAccount) === 'KAS_OWNER' ||
            (mTitleHasOwner(mut.title))
          ) {
            todayDiambilOwner += amount;
          } else {
            todayPengeluaranKas += amount;
          }
        }
      }
    } else if (targetAcc === 'KAS_QRIS') {
      if (mut.flow === 'IN') kasQris += amount;
      else kasQris -= amount;
    } else if (targetAcc === 'KAS_OWNER') {
      if (mut.flow === 'IN') kasOwner += amount;
      else kasOwner -= amount;
    } else if (targetAcc === 'BANK_BCA') {
      if (mut.flow === 'IN') bankBca += amount;
      else bankBca -= amount;
    } else if (targetAcc === 'BANK_JAGO') {
      if (mut.flow === 'IN') bankJago += amount;
      else bankJago -= amount;
    } else if (targetAcc === 'BANK_MANDIRI') {
      if (mut.flow === 'IN') bankMandiri += amount;
      else bankMandiri -= amount;
    } else if (targetAcc === 'WALLET_GOFOOD') {
      if (mut.flow === 'IN') walletGofood += amount;
      else {
        walletGofood -= amount;
        if (isToday && (mut.type === 'PENCAIRAN_PLATFORM' || mut.type === 'TRANSFER_DANA')) {
          todayPlatformSettled += amount;
        }
      }
    } else if (targetAcc === 'WALLET_GRABFOOD') {
      if (mut.flow === 'IN') walletGrabfood += amount;
      else {
        walletGrabfood -= amount;
        if (isToday && (mut.type === 'PENCAIRAN_PLATFORM' || mut.type === 'TRANSFER_DANA')) {
          todayPlatformSettled += amount;
        }
      }
    } else if (targetAcc === 'WALLET_SHOPEEFOOD') {
      if (mut.flow === 'IN') walletShopeefood += amount;
      else {
        walletShopeefood -= amount;
        if (isToday && (mut.type === 'PENCAIRAN_PLATFORM' || mut.type === 'TRANSFER_DANA')) {
          todayPlatformSettled += amount;
        }
      }
    }
  });

  const saldoTransfer = bankBca + bankJago + bankMandiri;
  const totalSaldo = kasKasir + kasQris + kasOwner + saldoTransfer;
  const todayTransferMasuk = todayBcaMasuk + todayJagoMasuk + todayMandiriMasuk;
  const totalPlatformWallet = walletGofood + walletGrabfood + walletShopeefood;
  const todayPlatformMasuk = todayGofoodMasuk + todayGrabfoodMasuk + todayShopeefoodMasuk;
  const totalSaldoDanPlatform = totalSaldo + totalPlatformWallet;

  return {
    kasKasir,
    kasQris,
    kasOwner,
    bankBca,
    bankJago,
    bankMandiri,
    walletGofood,
    walletGrabfood,
    walletShopeefood,
    totalPlatformWallet,
    kasTunai: kasKasir,
    saldoQris: kasQris,
    saldoTransfer,
    totalSaldo,
    totalSaldoDanPlatform,
    todayKasMasuk,
    todayQrisMasuk,
    todayTransferMasuk,
    todayBcaMasuk,
    todayJagoMasuk,
    todayMandiriMasuk,
    todayGofoodMasuk,
    todayGrabfoodMasuk,
    todayShopeefoodMasuk,
    todayPlatformMasuk,
    todayPlatformSettled,
    todayPengeluaranKas,
    todayDiambilOwner,
  };
}

function mTitleHasOwner(title?: string): boolean {
  return Boolean(title && title.toUpperCase().includes('OWNER'));
}
