import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  CanonicalCashAccount,
  CashMutation,
  Expense,
  MovementType,
  OrderType,
  PaymentStatus,
  Sale,
  StockMovement,
} from '../../types';
import {
  CANONICAL_CASH_ACCOUNTS,
  filterStandaloneExpenses,
  getCashAccountShortLabel,
  getSaleLedgerInflow,
  normalizeCashAccount,
} from '../../utils/cashLedger';
import {
  normalizeSaleFinancials,
  ORDER_TYPE_OPTIONS,
} from '../../utils/saleChannel';
import {
  formatNumber,
  formatRupiah,
  getMenuHpp,
  getProductRecipeHpp,
} from '../../utils/formatters';
import { resolveProductReference } from '../../services/stockEngine';
import {
  ComparePeriodMode,
  EXPENSE_CATEGORY_LABELS,
  ORDERED_OPERATIONAL_EXPENSE_KEYS,
  PeriodPreset,
  ReportId,
} from './reportTypes';
import { ExportReportPayload } from './reportExportUtils';

/**
 * Identifies whether a stock movement represents an initial stock entry ("Saldo Awal Persediaan")
 * rather than a purchase or an operational stock opname adjustment.
 */
export function isInitialStockMovement(m: StockMovement): boolean {
  if (m.type !== 'ADJUSTMENT') return false;
  const ref = (m.referenceId || '').toUpperCase().trim();
  const notes = (m.notes || '').toLowerCase();
  return (
    ref === 'INIT_STOCK' ||
    notes.includes('stok awal') ||
    notes.includes('saldo awal')
  );
}

export interface InventoryPeriodSummary {
  openingInventoryValue: number; // Saldo Awal Persediaan (Rp)
  purchaseInventoryValue: number; // Pembelian pada periode berjalan (Rp)
  usageInventoryValue: number; // Pemakaian Bahan / HPP (Rp)
  adjustmentInventoryValue: number; // Penyesuaian Stok di luar Stok Awal (Rp)
  closingInventoryValue: number; // Saldo Akhir Persediaan (Rp)
}

export interface InventoryReconciliationRow {
  id: string;
  code: string;
  name: string;
  categoryType: 'BAHAN_BAKU' | 'KEMASAN' | 'BARANG_SIAP_JUAL';
  categoryLabel: string;
  unit: string;
  costPerUnit: number;
  openingQty: number;
  openingValue: number;
  purchaseQty: number;
  purchaseValue: number;
  usageQty: number;
  usageValue: number;
  adjustmentQty: number;
  adjustmentValue: number;
  closingQty: number;
  closingValue: number;
  minStock: number;
  status: 'AMAN' | 'MENIPIS' | 'KRITIS' | 'HABIS';
}

export interface UseReportFilterParams {
  period: PeriodPreset;
  customStartDate: string;
  customEndDate: string;
  compareMode: ComparePeriodMode;
  channelFilter: 'ALL' | OrderType;
  searchQuery: string;
  periodGroupMode: 'DAILY' | 'MONTHLY';
  purchaseStatusFilter: 'ALL' | PaymentStatus;
  supplierFilter: string;
  purchaseItemTypeFilter: 'ALL' | 'BAHAN_BAKU' | 'KEMASAN' | 'BARANG_SIAP_JUAL';
  stockTypeFilter: 'ALL' | 'BAHAN_BAKU' | 'KEMASAN' | 'BARANG_SIAP_JUAL';
  stockStatusFilter: 'ALL' | 'AMAN' | 'MENIPIS' | 'KRITIS' | 'HABIS';
  movementTypeFilter: 'ALL' | MovementType;
  expenseCategoryFilter: string;
  cashAccountFilter: 'ALL' | CanonicalCashAccount;
}

export interface SalesDrillDownRow {
  saleId: string;
  date: string;
  createdAt: string;
  transactionNo: string;
  channel: OrderType;
  menuSummary: string;
  qty: number;
  grossSales: number;
  discount: number;
  netSales: number;
}

export interface HppDrillDownRow {
  id: string;
  saleId: string;
  date: string;
  createdAt: string;
  transactionNo: string;
  channel: OrderType;
  menuName: string;
  qty: number;
  unitHpp: number;
  totalHpp: number;
}

export interface PlatformFeeDrillDownRow {
  saleId: string;
  date: string;
  createdAt: string;
  transactionNo: string;
  platform: OrderType;
  grossAmount: number;
  discountAmount: number;
  netOrderAmount: number;
  feePercent: number;
  percentageFeeAmount: number;
  fixedFee: number;
  shippingDiscount: number;
  totalPlatformFee: number;
  netSettlement: number;
}

export interface PurchaseDrillDownRow {
  purchaseId: string;
  date: string;
  createdAt: string;
  purchaseNo: string;
  supplier: string;
  itemSummary: string;
  qtySummary: string;
  totalQty: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus;
}

export interface ProfitLossSnapshot {
  periodTitle: string;
  shortHeaderLabel: string;
  hasData: boolean;
  // PENDAPATAN
  grossByChannel: Record<OrderType, number>;
  netByChannel: Record<OrderType, number>;
  totalGrossSales: number;
  salesDiscount: number;
  netSales: number; // TOTAL PENDAPATAN / PENJUALAN BERSIH (Gross - Diskon)
  // HPP
  totalHpp: number; // HPP Produk Terjual
  // LABA KOTOR
  grossProfit: number; // netSales - totalHpp
  // BEBAN PENJUALAN
  platformFeeByChannel: Record<OrderType, number>;
  totalPlatformFee: number;
  otherSellingExpense: number;
  totalSellingExpense: number;
  // BEBAN OPERASIONAL
  operatingExpensesByCategory: Record<string, number>;
  totalOperatingExpense: number;
  // LABA OPERASIONAL
  operatingProfit: number; // grossProfit - totalSellingExpense - totalOperatingExpense
  // PENDAPATAN / BEBAN LAIN-LAIN
  otherIncome: number;
  otherExpense: number;
  // LABA SEBELUM PAJAK & PAJAK
  profitBeforeTax: number;
  taxExpense: number;
  // LABA BERSIH (BERDASARKAN HPP)
  netProfit: number;
  // PEMBELIAN & ARUS KAS OPERASIONAL (REALISASI KAS OPERASIONAL)
  actualPurchaseTotal: number; // Total Pembelian Aktual (PO) periode berjalan (Rp0 jika tidak ada PO)
  actualPurchasePaidTotal: number; // Total PO periode berjalan yang sudah dibayar
  actualPurchaseUnpaidDebt: number; // Sisa Hutang PO periode berjalan (tidak dianggap kas keluar)
  cashPurchasePaymentTotal: number; // Total pembayaran pembelian aktual via mutasi kas periode berjalan
  purchasePaymentTotal: number; // Total pembayaran pembelian yang benar-benar keluar kas pada periode berjalan
  operatingCashFlow: number; // Arus Kas Bersih Operasional = netSales - purchasePaymentTotal - totalSellingExpense - totalOperatingExpense - otherExpense + otherIncome - taxExpense
  // REKONSILIASI LABA DAN ARUS KAS
  reconciliationDifference: number; // operatingCashFlow - netProfit
  // RINGKASAN PERSEDIAAN
  inventorySummary: InventoryPeriodSummary;
  // Drill-down datasets for this period
  salesDrillDownRows: SalesDrillDownRow[];
  hppDrillDownRows: HppDrillDownRow[];
  platformFeeDrillDownRows: PlatformFeeDrillDownRow[];
  expenseDrillDownRows: Expense[];
  purchaseDrillDownRows: PurchaseDrillDownRow[];
}

export function formatPctChange(current: number, previous?: number | null): string {
  if (previous === undefined || previous === null) return '-';
  if (previous === 0) {
    if (current === 0) return '0,0%';
    return '-';
  }
  const diff = ((current - previous) / Math.abs(previous)) * 100;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(1).replace('.', ',')}%`;
}

export function useReportData(filters: UseReportFilterParams) {
  const {
    sales,
    purchases,
    vendors,
    expenses,
    cashMutations,
    cashBalanceSummary,
    ingredients,
    ingredientsMap,
    products,
    productsMap,
    recipes,
    recipesMap,
    assembliesMap,
    productions,
    stockProductions,
    stockMovements,
  } = useApp();

  const {
    period,
    customStartDate,
    customEndDate,
    compareMode,
    channelFilter,
    searchQuery,
    periodGroupMode,
    purchaseStatusFilter,
    supplierFilter,
    purchaseItemTypeFilter,
    stockTypeFilter,
    stockStatusFilter,
    movementTypeFilter,
    expenseCategoryFilter,
    cashAccountFilter,
  } = filters;

  // Compute active period boundaries & comparison period boundaries
  const {
    startMs,
    endMs,
    periodLabel,
    shortPeriodHeader,
    compStartMs,
    compEndMs,
    compPeriodLabel,
    compShortHeader,
    isDateInPeriod,
  } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );

    const fmtDate = (d: Date) =>
      d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

    const fmtShortMonth = (d: Date) =>
      d.toLocaleDateString('id-ID', {
        month: 'short',
        year: 'numeric',
      });

    let sDate = new Date(todayStart);
    let eDate = new Date(todayEnd);
    let label = 'Semua Periode';
    let shortHeader = 'Periode Ini';

    if (period === 'TODAY') {
      sDate = new Date(todayStart);
      eDate = new Date(todayEnd);
      label = `${fmtDate(sDate)} - ${fmtDate(eDate)}`;
      shortHeader = fmtDate(sDate);
    } else if (period === 'YESTERDAY') {
      sDate = new Date(todayStart);
      sDate.setDate(sDate.getDate() - 1);
      eDate = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate(), 23, 59, 59, 999);
      label = `${fmtDate(sDate)} - ${fmtDate(eDate)}`;
      shortHeader = fmtDate(sDate);
    } else if (period === 'THIS_WEEK') {
      const dayOfWeek = todayStart.getDay(); // 0=Sun, 1=Mon...
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      sDate = new Date(todayStart);
      sDate.setDate(sDate.getDate() - diffToMonday);
      eDate = new Date(todayEnd);
      label = `${fmtDate(sDate)} - ${fmtDate(eDate)}`;
      shortHeader = 'Minggu Ini';
    } else if (period === 'LAST_WEEK') {
      const dayOfWeek = todayStart.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const thisMonday = new Date(todayStart);
      thisMonday.setDate(thisMonday.getDate() - diffToMonday);
      sDate = new Date(thisMonday);
      sDate.setDate(sDate.getDate() - 7);
      eDate = new Date(thisMonday);
      eDate.setMilliseconds(-1);
      label = `${fmtDate(sDate)} - ${fmtDate(eDate)}`;
      shortHeader = 'Minggu Lalu';
    } else if (period === 'THIS_MONTH') {
      sDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      eDate = new Date(todayEnd);
      label = `${fmtDate(sDate)} - ${fmtDate(eDate)}`;
      shortHeader = fmtShortMonth(sDate);
    } else if (period === 'LAST_MONTH') {
      sDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      eDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      label = `${fmtDate(sDate)} - ${fmtDate(eDate)}`;
      shortHeader = fmtShortMonth(sDate);
    } else if (period === 'THIS_YEAR') {
      sDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      eDate = new Date(todayEnd);
      label = `${fmtDate(sDate)} - ${fmtDate(eDate)}`;
      shortHeader = `Tahun ${now.getFullYear()}`;
    } else if (period === 'CUSTOM') {
      const parsedS = customStartDate
        ? new Date(`${customStartDate}T00:00:00`)
        : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const parsedE = customEndDate
        ? new Date(`${customEndDate}T23:59:59.999`)
        : new Date(todayEnd);
      sDate = Number.isNaN(parsedS.getTime()) ? todayStart : parsedS;
      eDate = Number.isNaN(parsedE.getTime()) ? todayEnd : parsedE;
      label = `${fmtDate(sDate)} - ${fmtDate(eDate)}`;
      shortHeader = `${fmtDate(sDate)} - ${fmtDate(eDate)}`;
    } else if (period === 'ALL') {
      sDate = new Date(2020, 0, 1, 0, 0, 0, 0);
      eDate = new Date(todayEnd);
      label = 'Semua Periode';
      shortHeader = 'Semua Periode';
    }

    const activeStartMs = sDate.getTime();
    const activeEndMs = eDate.getTime();

    // Calculate Comparison Range
    let cStartMs: number | null = null;
    let cEndMs: number | null = null;
    let cLabel = '-';
    let cShort = '-';

    if (compareMode !== 'NONE' && period !== 'ALL') {
      if (compareMode === 'PREV_PERIOD') {
        const durationMs = Math.max(86400000, activeEndMs - activeStartMs + 1);
        const cs = new Date(activeStartMs - durationMs);
        const ce = new Date(activeStartMs - 1);
        cStartMs = cs.getTime();
        cEndMs = ce.getTime();
        cLabel = `${fmtDate(cs)} - ${fmtDate(ce)}`;
        cShort =
          period === 'TODAY' || period === 'YESTERDAY'
            ? fmtDate(cs)
            : `${fmtDate(cs)} - ${fmtDate(ce)}`;
      } else if (compareMode === 'PREV_MONTH') {
        const cs = new Date(sDate);
        cs.setMonth(cs.getMonth() - 1);
        const ce = new Date(eDate);
        ce.setMonth(ce.getMonth() - 1);
        // If THIS_MONTH or LAST_MONTH, use full previous month if appropriate
        if (period === 'THIS_MONTH' || period === 'LAST_MONTH') {
          const fullStart = new Date(sDate.getFullYear(), sDate.getMonth() - 1, 1, 0, 0, 0, 0);
          const fullEnd = new Date(sDate.getFullYear(), sDate.getMonth(), 0, 23, 59, 59, 999);
          cStartMs = fullStart.getTime();
          cEndMs = fullEnd.getTime();
          cLabel = `${fmtDate(fullStart)} - ${fmtDate(fullEnd)}`;
          cShort = fmtShortMonth(fullStart);
        } else {
          cStartMs = cs.getTime();
          cEndMs = ce.getTime();
          cLabel = `${fmtDate(cs)} - ${fmtDate(ce)}`;
          cShort = fmtShortMonth(cs);
        }
      } else if (compareMode === 'PREV_YEAR') {
        const cs = new Date(sDate);
        cs.setFullYear(cs.getFullYear() - 1);
        const ce = new Date(eDate);
        ce.setFullYear(ce.getFullYear() - 1);
        cStartMs = cs.getTime();
        cEndMs = ce.getTime();
        cLabel = `${fmtDate(cs)} - ${fmtDate(ce)}`;
        cShort =
          period === 'THIS_YEAR'
            ? `Tahun ${cs.getFullYear()}`
            : `${fmtShortMonth(cs)}`;
      }
    }

    const checkInRange = (
      createdAt?: string,
      dateStr?: string,
      rangeStart = activeStartMs,
      rangeEnd = activeEndMs,
      isAll = period === 'ALL'
    ): boolean => {
      if (isAll) return true;
      const raw = createdAt || dateStr;
      if (!raw) return false;
      // Handle YYYY-MM-DD date strings in local time
      const ts =
        raw.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(raw)
          ? new Date(`${raw}T12:00:00`).getTime()
          : new Date(raw).getTime();
      if (Number.isNaN(ts)) return false;
      return ts >= rangeStart && ts <= rangeEnd;
    };

    return {
      startMs: activeStartMs,
      endMs: activeEndMs,
      periodLabel: label,
      shortPeriodHeader: shortHeader,
      compStartMs: cStartMs,
      compEndMs: cEndMs,
      compPeriodLabel: cLabel,
      compShortHeader: cShort,
      isDateInPeriod: (createdAt?: string, dateStr?: string) =>
        checkInRange(createdAt, dateStr, activeStartMs, activeEndMs, period === 'ALL'),
    };
  }, [period, customStartDate, customEndDate, compareMode]);

  // Helper to resolve exact unit HPP of a sold item using existing system (hppPerItem -> getMenuHpp -> getProductRecipeHpp)
  const resolveSoldItemUnitHpp = useMemo(() => {
    return (productId: string, productName: string, snapshotUnitHpp?: number): number => {
      if (typeof snapshotUnitHpp === 'number' && snapshotUnitHpp > 0) {
        return snapshotUnitHpp;
      }
      const prod =
        productsMap.get(productId) ||
        resolveProductReference(productId, productName, productsMap);
      if (!prod) return 0;
      const menuHpp = getMenuHpp(
        prod,
        productsMap,
        ingredientsMap,
        assembliesMap,
        recipesMap
      );
      if (menuHpp > 0) return menuHpp;
      return getProductRecipeHpp(prod.id, productsMap, recipesMap, ingredientsMap);
    };
  }, [productsMap, ingredientsMap, assembliesMap, recipesMap]);

  // Helper to compute complete Profit & Loss (Laba Rugi) snapshot for any date range
  const buildProfitLossSnapshot = useMemo(() => {
    return (
      rangeStartMs: number,
      rangeEndMs: number,
      isAll: boolean,
      headerTitle: string,
      shortHeader: string
    ): ProfitLossSnapshot => {
      const inRange = (createdAt?: string, dateStr?: string): boolean => {
        if (isAll) return true;
        const raw = createdAt || dateStr;
        if (!raw) return false;
        const ts =
          raw.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(raw)
            ? new Date(`${raw}T12:00:00`).getTime()
            : new Date(raw).getTime();
        if (Number.isNaN(ts)) return false;
        return ts >= rangeStartMs && ts <= rangeEndMs;
      };

      const rangeSales = sales
        .filter((s) => s.status === 'COMPLETED' && inRange(s.createdAt, s.date))
        .filter((s) => {
          if (channelFilter === 'ALL') return true;
          return normalizeSaleFinancials(s).orderType === channelFilter;
        })
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      const grossByChannel: Record<OrderType, number> = {
        OFFLINE: 0,
        GOFOOD: 0,
        GRABFOOD: 0,
        SHOPEEFOOD: 0,
      };
      const netByChannel: Record<OrderType, number> = {
        OFFLINE: 0,
        GOFOOD: 0,
        GRABFOOD: 0,
        SHOPEEFOOD: 0,
      };
      const platformFeeByChannel: Record<OrderType, number> = {
        OFFLINE: 0,
        GOFOOD: 0,
        GRABFOOD: 0,
        SHOPEEFOOD: 0,
      };

      let totalGrossSales = 0;
      let salesDiscount = 0;
      let netSales = 0;
      let totalHpp = 0;
      let totalPlatformFee = 0;

      const salesDrillDownRows: SalesDrillDownRow[] = [];
      const hppDrillDownRows: HppDrillDownRow[] = [];
      const platformFeeDrillDownRows: PlatformFeeDrillDownRow[] = [];

      for (const s of rangeSales) {
        const fin = normalizeSaleFinancials(s);
        const ch = fin.orderType;
        const gross = fin.subtotal;
        const disc = fin.totalFoodDiscount;
        const net = fin.foodTotal; // Gross - Diskon
        const pFee = fin.platformServiceFee;

        grossByChannel[ch] = (grossByChannel[ch] || 0) + gross;
        netByChannel[ch] = (netByChannel[ch] || 0) + net;
        platformFeeByChannel[ch] = (platformFeeByChannel[ch] || 0) + pFee;

        totalGrossSales += gross;
        salesDiscount += disc;
        netSales += net;
        totalPlatformFee += pFee;

        const qtySum = (s.items || []).reduce(
          (acc, it) => acc + (it.quantity || 0),
          0
        );

        salesDrillDownRows.push({
          saleId: s.id,
          date: s.date || new Date(s.createdAt).toLocaleDateString('id-ID'),
          createdAt: s.createdAt,
          transactionNo: s.transactionNo,
          channel: ch,
          menuSummary: (s.items || [])
            .map((it) => `${it.quantity}x ${it.productName}`)
            .join(', '),
          qty: qtySum,
          grossSales: gross,
          discount: disc,
          netSales: net,
        });

        // HPP Produk Terjual per item
        let saleComputedHpp = 0;
        if (s.items && s.items.length > 0) {
          s.items.forEach((it, idx) => {
            const unitHpp = resolveSoldItemUnitHpp(
              it.productId,
              it.productName,
              it.hppPerItem
            );
            const itemTotalHpp = unitHpp * (it.quantity || 0);
            saleComputedHpp += itemTotalHpp;

            hppDrillDownRows.push({
              id: `${s.id}_${idx}`,
              saleId: s.id,
              date: s.date || new Date(s.createdAt).toLocaleDateString('id-ID'),
              createdAt: s.createdAt,
              transactionNo: s.transactionNo,
              channel: ch,
              menuName: it.productName,
              qty: it.quantity || 0,
              unitHpp,
              totalHpp: itemTotalHpp,
            });
          });
        }
        // Fallback if sale had totalHpp but items had 0
        if (saleComputedHpp === 0 && (s.totalHpp || 0) > 0) {
          saleComputedHpp = s.totalHpp || 0;
          hppDrillDownRows.push({
            id: `${s.id}_fallback`,
            saleId: s.id,
            date: s.date || new Date(s.createdAt).toLocaleDateString('id-ID'),
            createdAt: s.createdAt,
            transactionNo: s.transactionNo,
            channel: ch,
            menuName:
              (s.items || []).map((i) => i.productName).join(', ') ||
              'Menu Terjual',
            qty: Math.max(1, qtySum),
            unitHpp: Math.round(saleComputedHpp / Math.max(1, qtySum)),
            totalHpp: saleComputedHpp,
          });
        }
        totalHpp += saleComputedHpp;

        // Platform Fee Drill-Down Row (for marketplace orders or orders with platform fee)
        if (ch !== 'OFFLINE' || pFee > 0) {
          const snap = s.platformSnapshot;
          const feePct =
            snap?.platformFeePercentage ?? s.platformFeePercentage ?? 0;
          const pctFeeAmt =
            snap?.platformFeeAmount ?? s.platformFeeAmount ?? pFee;
          const fixFee = snap?.platformFixedFee ?? s.platformFixedFee ?? 0;
          const shipDisc =
            snap?.shippingDiscount ?? fin.shippingDiscount ?? 0;
          const netSettle =
            snap?.walletAmount ??
            s.walletAmount ??
            fin.netSettlementAmount;

          platformFeeDrillDownRows.push({
            saleId: s.id,
            date: s.date || new Date(s.createdAt).toLocaleDateString('id-ID'),
            createdAt: s.createdAt,
            transactionNo: s.transactionNo,
            platform: ch,
            grossAmount: gross,
            discountAmount: disc,
            netOrderAmount: net,
            feePercent: feePct,
            percentageFeeAmount: pctFeeAmt,
            fixedFee: fixFee,
            shippingDiscount: shipDisc,
            totalPlatformFee: pFee,
            netSettlement: netSettle,
          });
        }
      }

      // Standalone Operating Expenses in range (never includes PO purchases or Owner Withdrawals)
      const rangeExpenses = filterStandaloneExpenses(expenses)
        .filter((e) => inRange(e.createdAt, e.date))
        .sort(
          (a, b) =>
            new Date(b.createdAt || b.date).getTime() -
            new Date(a.createdAt || a.date).getTime()
        );

      const operatingExpensesByCategory: Record<string, number> = {};
      for (const k of ORDERED_OPERATIONAL_EXPENSE_KEYS) {
        operatingExpensesByCategory[k] = 0;
      }

      let totalOperatingExpense = 0;
      for (const e of rangeExpenses) {
        const rawCat = (e.category || 'lainnya').toLowerCase().trim();
        const cat =
          operatingExpensesByCategory[rawCat] !== undefined
            ? rawCat
            : 'lainnya';
        operatingExpensesByCategory[cat] =
          (operatingExpensesByCategory[cat] || 0) + (e.amount || 0);
        totalOperatingExpense += e.amount || 0;
      }

      const grossProfit = netSales - totalHpp;
      const otherSellingExpense = 0;
      const totalSellingExpense = totalPlatformFee + otherSellingExpense;
      const operatingProfit =
        grossProfit - totalSellingExpense - totalOperatingExpense;
      const otherIncome = 0;
      const otherExpense = 0;
      const profitBeforeTax = operatingProfit + otherIncome - otherExpense;
      const taxExpense = 0;
      const netProfit = profitBeforeTax - taxExpense;

      // Actual Purchases (Pembelian Aktual) in range (excluding VOID)
      const activePurchases = purchases.filter((p) => p.status !== 'VOID');
      const voidedPurchaseIds = new Set(
        purchases.filter((p) => p.status === 'VOID').map((p) => p.id)
      );
      const validPurchaseIds = new Set(activePurchases.map((p) => p.id));

      const rangePurchases = activePurchases
        .filter((p) => inRange(p.createdAt, p.date))
        .sort(
          (a, b) =>
            new Date(b.createdAt || b.date).getTime() -
            new Date(a.createdAt || a.date).getTime()
        );

      let actualPurchaseTotal = 0;
      let actualPurchasePaidTotal = 0;
      let actualPurchaseUnpaidDebt = 0;
      const purchaseDrillDownRows: PurchaseDrillDownRow[] = [];

      for (const p of rangePurchases) {
        const totAmt = Number(p.totalAmount ?? p.totalCost ?? 0);
        const paidAmt = Number(p.paidAmount ?? 0);
        const remAmt = Math.max(0, Number(p.remainingAmount ?? totAmt - paidAmt));

        actualPurchaseTotal += totAmt;
        actualPurchasePaidTotal += paidAmt;
        actualPurchaseUnpaidDebt += remAmt;

        const items = p.items || [];
        const totalQty =
          items.length > 0
            ? items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
            : Number(p.quantity || 0);

        const itemSummary =
          items.length > 0
            ? items.map((it) => it.targetName).join(', ')
            : p.targetName || p.ingredientName || 'Bahan / Produk';

        const qtySummary =
          items.length > 0
            ? items
                .map(
                  (it) =>
                    `${formatNumber(it.quantity)} ${
                      it.purchaseUnit || it.unit || 'pcs'
                    }`
                )
                .join(', ')
            : `${formatNumber(totalQty)} pcs`;

        purchaseDrillDownRows.push({
          purchaseId: p.id,
          date: p.date || new Date(p.createdAt).toLocaleDateString('id-ID'),
          createdAt: p.createdAt,
          purchaseNo: p.purchaseNo || p.id,
          supplier: p.vendorName || p.supplier || 'Supplier Umum',
          itemSummary,
          qtySummary,
          totalQty,
          totalAmount: totAmt,
          paidAmount: paidAmt,
          remainingAmount: remAmt,
          paymentStatus: p.paymentStatus || 'LUNAS',
        });
      }

      const rangePurchaseMutations = cashMutations.filter((m) => {
        if (!inRange(m.createdAt, m.date)) return false;
        if (m.type !== 'PENGELUARAN' || m.flow !== 'OUT') return false;
        if (m.referenceId && voidedPurchaseIds.has(m.referenceId)) return false;
        if (m.referenceId && validPurchaseIds.has(m.referenceId)) return true;
        const title = (m.title || '').trim();
        return (
          Boolean(m.referenceId) ||
          title.startsWith('Pembelian #') ||
          title.startsWith('Bayar Hutang #')
        );
      });

      const cashPurchasePaymentTotal = rangePurchaseMutations.reduce(
        (sum, m) => sum + (m.amount || 0),
        0
      );

      // Include paidAmount from rangePurchases only if no cash_mutations record exists for that PO
      // Unpaid purchases (paidAmount = 0, remainingAmount > 0) are NEVER treated as cash outflow
      const allPurchaseIdsWithMutations = new Set(
        cashMutations
          .filter(
            (m) =>
              m.type === 'PENGELUARAN' &&
              m.flow === 'OUT' &&
              Boolean(m.referenceId)
          )
          .map((m) => m.referenceId as string)
      );
      const unmutatedPaidFromRangePurchases = rangePurchases
        .filter((p) => !allPurchaseIdsWithMutations.has(p.id))
        .reduce((sum, p) => sum + Math.max(0, Number(p.paidAmount ?? 0)), 0);

      const purchasePaymentTotal =
        cashPurchasePaymentTotal + unmutatedPaidFromRangePurchases;

      // Arus Kas Bersih Operasional (Realisasi Kas Operasional) =
      // Kas Masuk dari Penjualan (netSales)
      // - Pembayaran Pembelian (purchasePaymentTotal)
      // - Biaya Admin / Platform (totalSellingExpense)
      // - Pengeluaran Operasional Aktual (totalOperatingExpense)
      // - Beban Lain-lain Aktual (otherExpense)
      // + Pendapatan Lain (otherIncome)
      // - Pajak (taxExpense)
      // PENTING: Arus Kas Operasional berbeda dengan Laba Bersih dan tidak menggunakan HPP.
      const operatingCashFlow =
        netSales -
        purchasePaymentTotal -
        totalSellingExpense -
        totalOperatingExpense +
        otherIncome -
        otherExpense -
        taxExpense;

      const reconciliationDifference = operatingCashFlow - netProfit;

      // Compute Inventory Period Summary (Saldo Awal + Pembelian - Pemakaian +/- Penyesuaian = Saldo Akhir)
      // using stockMovements as primary source of truth.
      let openingInventoryValue = 0;
      let purchaseInventoryValue = 0;
      let usageInventoryValue = 0;
      let adjustmentInventoryValue = 0;
      let closingInventoryValue = 0;

      const trackedItems: Array<{
        id: string;
        stock: number;
        costPerUnit: number;
      }> = [];

      for (const ing of ingredients) {
        if (ing.type === 'PREPARED') continue;
        trackedItems.push({
          id: ing.id,
          stock: Math.max(0, Number(ing.stock || 0)),
          costPerUnit: Math.max(0, Number(ing.costPerUnit || 0)),
        });
      }
      for (const prod of products) {
        if (prod.stockSource === 'READY_TO_SELL') {
          trackedItems.push({
            id: prod.id,
            stock: Math.max(0, Number(prod.stock || 0)),
            costPerUnit: Math.max(0, Number(prod.costPerUnit || 0)),
          });
        }
      }

      for (const item of trackedItems) {
        const itemMovs = stockMovements.filter(
          (m) =>
            (m.entityId || m.ingredientId || m.productId) === item.id
        );

        let netAfterPeriod = 0;
        let pQty = 0;
        let uQty = 0;
        let adjQty = 0;

        for (const m of itemMovs) {
          const rawTs = m.createdAt;
          const ts = rawTs ? new Date(rawTs).getTime() : 0;
          if (!isAll && ts > rangeEndMs) {
            netAfterPeriod += Number(m.changeAmount || 0);
            continue;
          }
          if (!inRange(m.createdAt)) continue;

          const chg = Number(m.changeAmount || 0);
          if (m.type === 'PURCHASE' && chg > 0) {
            pQty += chg;
          } else if (
            (m.type === 'PRODUCTION' || m.type === 'SALE' || m.type === 'WASTE') &&
            chg < 0
          ) {
            uQty += Math.abs(chg);
          } else if (
            (m.type === 'ADJUSTMENT' || m.type === 'RETURN') &&
            !isInitialStockMovement(m)
          ) {
            const isCancelReturn =
              m.type === 'RETURN' &&
              ((m.notes || '').toLowerCase().includes('batal') ||
                (m.notes || '').toLowerCase().includes('cancel'));
            if (isCancelReturn && chg > 0) {
              uQty = Math.max(0, uQty - chg);
            } else {
              adjQty += chg;
            }
          }
        }

        const closeQty = Math.max(0, item.stock - netAfterPeriod);
        // Conservation of stock: Saldo Akhir = Saldo Awal + Pembelian - Pemakaian +/- Penyesuaian
        // Therefore: Saldo Awal = Saldo Akhir - Pembelian + Pemakaian - Penyesuaian
        const openQty = Math.max(0, closeQty - pQty + uQty - adjQty);

        openingInventoryValue += openQty * item.costPerUnit;
        purchaseInventoryValue += pQty * item.costPerUnit;
        usageInventoryValue += uQty * item.costPerUnit;
        adjustmentInventoryValue += adjQty * item.costPerUnit;
        closingInventoryValue += closeQty * item.costPerUnit;
      }

      // Ensure purchaseInventoryValue reflects actualPurchaseTotal if PO items were recorded
      if (purchaseInventoryValue === 0 && actualPurchaseTotal > 0) {
        purchaseInventoryValue = actualPurchaseTotal;
      }

      const inventorySummary: InventoryPeriodSummary = {
        openingInventoryValue: Math.round(openingInventoryValue),
        purchaseInventoryValue: Math.round(purchaseInventoryValue),
        usageInventoryValue: Math.round(
          usageInventoryValue > 0 ? usageInventoryValue : totalHpp
        ),
        adjustmentInventoryValue: Math.round(adjustmentInventoryValue),
        closingInventoryValue: Math.round(closingInventoryValue),
      };

      return {
        periodTitle: headerTitle,
        shortHeaderLabel: shortHeader,
        hasData:
          rangeSales.length > 0 ||
          rangeExpenses.length > 0 ||
          rangePurchases.length > 0,
        grossByChannel,
        netByChannel,
        totalGrossSales,
        salesDiscount,
        netSales,
        totalHpp,
        grossProfit,
        platformFeeByChannel,
        totalPlatformFee,
        otherSellingExpense,
        totalSellingExpense,
        operatingExpensesByCategory,
        totalOperatingExpense,
        operatingProfit,
        otherIncome,
        otherExpense,
        profitBeforeTax,
        taxExpense,
        netProfit,
        actualPurchaseTotal,
        actualPurchasePaidTotal,
        actualPurchaseUnpaidDebt,
        cashPurchasePaymentTotal,
        purchasePaymentTotal,
        operatingCashFlow,
        reconciliationDifference,
        inventorySummary,
        salesDrillDownRows,
        hppDrillDownRows,
        platformFeeDrillDownRows,
        expenseDrillDownRows: rangeExpenses,
        purchaseDrillDownRows,
      };
    };
  }, [
    sales,
    expenses,
    purchases,
    cashMutations,
    ingredients,
    products,
    stockMovements,
    channelFilter,
    resolveSoldItemUnitHpp,
  ]);

  // Active Period Profit & Loss
  const profitLoss = useMemo(
    () =>
      buildProfitLossSnapshot(
        startMs,
        endMs,
        period === 'ALL',
        periodLabel,
        shortPeriodHeader
      ),
    [buildProfitLossSnapshot, startMs, endMs, period, periodLabel, shortPeriodHeader]
  );

  // Comparison Period Profit & Loss (if enabled)
  const comparisonProfitLoss = useMemo(() => {
    if (
      compareMode === 'NONE' ||
      period === 'ALL' ||
      compStartMs === null ||
      compEndMs === null
    ) {
      return null;
    }
    return buildProfitLossSnapshot(
      compStartMs,
      compEndMs,
      false,
      compPeriodLabel,
      compShortHeader
    );
  }, [
    buildProfitLossSnapshot,
    compareMode,
    period,
    compStartMs,
    compEndMs,
    compPeriodLabel,
    compShortHeader,
  ]);

  // 1. Filtered Completed Sales for Sales Reports
  const periodSales = useMemo(() => {
    return sales
      .filter(
        (s) =>
          s.status === 'COMPLETED' && isDateInPeriod(s.createdAt, s.date)
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [sales, isDateInPeriod]);

  const filteredSales = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return periodSales.filter((s) => {
      const fin = normalizeSaleFinancials(s);
      if (channelFilter !== 'ALL' && fin.orderType !== channelFilter) {
        return false;
      }
      if (!q) return true;
      const matchTx = (s.transactionNo || '').toLowerCase().includes(q);
      const matchCashier = (s.cashierName || '').toLowerCase().includes(q);
      const matchItems = s.items.some((it) =>
        (it.productName || '').toLowerCase().includes(q)
      );
      return matchTx || matchCashier || matchItems;
    });
  }, [periodSales, channelFilter, searchQuery]);

  // 2. Sales & Cash Inflow Summary
  const salesSummary = useMemo(() => {
    let grossFoodSales = 0;
    let itemDiscountTotal = 0;
    let orderDiscountTotal = 0;
    let foodOmzet = 0;
    let platformServiceFeeTotal = 0;
    let netSalesInflow = 0;
    let offlineSalesInflow = 0;
    let onlineWalletSalesInflow = 0;
    let totalHpp = 0;
    let totalItemsQty = 0;

    const inflowByAccount: Record<CanonicalCashAccount, number> = {
      KAS_KASIR: 0,
      KAS_QRIS: 0,
      KAS_OWNER: 0,
      BANK_BCA: 0,
      BANK_JAGO: 0,
      BANK_MANDIRI: 0,
      WALLET_GOFOOD: 0,
      WALLET_GRABFOOD: 0,
      WALLET_SHOPEEFOOD: 0,
    };

    const byChannel: Record<
      OrderType,
      {
        count: number;
        qty: number;
        grossFood: number;
        foodDiscount: number;
        foodOmzet: number;
        platformFee: number;
        ledgerInflow: number;
        hpp: number;
      }
    > = {
      OFFLINE: {
        count: 0,
        qty: 0,
        grossFood: 0,
        foodDiscount: 0,
        foodOmzet: 0,
        platformFee: 0,
        ledgerInflow: 0,
        hpp: 0,
      },
      GOFOOD: {
        count: 0,
        qty: 0,
        grossFood: 0,
        foodDiscount: 0,
        foodOmzet: 0,
        platformFee: 0,
        ledgerInflow: 0,
        hpp: 0,
      },
      GRABFOOD: {
        count: 0,
        qty: 0,
        grossFood: 0,
        foodDiscount: 0,
        foodOmzet: 0,
        platformFee: 0,
        ledgerInflow: 0,
        hpp: 0,
      },
      SHOPEEFOOD: {
        count: 0,
        qty: 0,
        grossFood: 0,
        foodDiscount: 0,
        foodOmzet: 0,
        platformFee: 0,
        ledgerInflow: 0,
        hpp: 0,
      },
    };

    for (const s of filteredSales) {
      const fin = normalizeSaleFinancials(s);
      const { account: targetAcc, amount: inflowAmt } = getSaleLedgerInflow(s);
      const saleQty = s.items.reduce((acc, it) => acc + (it.quantity || 0), 0);

      let saleHpp = 0;
      for (const it of s.items || []) {
        saleHpp +=
          resolveSoldItemUnitHpp(it.productId, it.productName, it.hppPerItem) *
          (it.quantity || 0);
      }
      if (saleHpp === 0 && (s.totalHpp || 0) > 0) {
        saleHpp = s.totalHpp || 0;
      }

      grossFoodSales += fin.subtotal;
      itemDiscountTotal += fin.itemDiscountTotal;
      orderDiscountTotal += fin.orderDiscount + fin.legacyDiscount;
      foodOmzet += fin.foodTotal;
      platformServiceFeeTotal += fin.platformServiceFee;
      netSalesInflow += inflowAmt;
      totalHpp += saleHpp;
      totalItemsQty += saleQty;

      if (fin.orderType === 'OFFLINE') {
        offlineSalesInflow += inflowAmt;
      } else {
        onlineWalletSalesInflow += inflowAmt;
      }

      if (targetAcc && inflowByAccount[targetAcc] !== undefined) {
        inflowByAccount[targetAcc] += inflowAmt;
      }

      const ch = byChannel[fin.orderType] || byChannel.OFFLINE;
      ch.count += 1;
      ch.qty += saleQty;
      ch.grossFood += fin.subtotal;
      ch.foodDiscount += fin.totalFoodDiscount;
      ch.foodOmzet += fin.foodTotal;
      ch.platformFee += fin.platformServiceFee;
      ch.ledgerInflow += inflowAmt;
      ch.hpp += saleHpp;
    }

    return {
      transactionCount: filteredSales.length,
      totalItemsQty,
      grossFoodSales,
      itemDiscountTotal,
      orderDiscountTotal,
      totalFoodDiscount: itemDiscountTotal + orderDiscountTotal,
      foodOmzet,
      platformServiceFeeTotal,
      netSalesInflow,
      offlineSalesInflow,
      onlineWalletSalesInflow,
      totalHpp,
      grossProfitAccrual: foodOmzet - totalHpp,
      inflowByAccount,
      byChannel,
    };
  }, [filteredSales, resolveSoldItemUnitHpp]);

  // 3. Penjualan per Menu
  const salesByMenu = useMemo(() => {
    const map = new Map<
      string,
      {
        productId: string;
        name: string;
        sku: string;
        category: string;
        qty: number;
        grossAmount: number;
        discountAmount: number;
        netOmzet: number;
        totalHpp: number;
        margin: number;
      }
    >();

    for (const s of filteredSales) {
      for (const it of s.items) {
        const prod =
          productsMap.get(it.productId) ||
          resolveProductReference(it.productId, it.productName, productsMap);
        const unitOrig =
          it.originalPrice && it.originalPrice > it.sellingPrice
            ? it.originalPrice
            : it.sellingPrice;
        const itemGross = unitOrig * it.quantity;
        const itemNet = it.subtotal;
        const itemDisc = Math.max(0, itemGross - itemNet);
        const unitHpp = resolveSoldItemUnitHpp(
          it.productId,
          it.productName,
          it.hppPerItem
        );
        const itemHpp = unitHpp * it.quantity;

        const existing = map.get(it.productId || it.productName) || {
          productId: it.productId,
          name: it.productName,
          sku: prod?.sku || '-',
          category: prod?.category || 'Menu POS',
          qty: 0,
          grossAmount: 0,
          discountAmount: 0,
          netOmzet: 0,
          totalHpp: 0,
          margin: 0,
        };

        existing.qty += it.quantity;
        existing.grossAmount += itemGross;
        existing.discountAmount += itemDisc;
        existing.netOmzet += itemNet;
        existing.totalHpp += itemHpp;
        existing.margin = existing.netOmzet - existing.totalHpp;
        map.set(it.productId || it.productName, existing);
      }
    }

    const q = searchQuery.trim().toLowerCase();
    return Array.from(map.values())
      .filter(
        (m) =>
          !q ||
          m.name.toLowerCase().includes(q) ||
          m.sku.toLowerCase().includes(q)
      )
      .sort((a, b) => b.qty - a.qty);
  }, [filteredSales, productsMap, resolveSoldItemUnitHpp, searchQuery]);

  // 4. Penjualan per Periode (Daily / Monthly)
  const salesByPeriod = useMemo(() => {
    const map = new Map<
      string,
      {
        periodKey: string;
        periodLabel: string;
        txCount: number;
        qty: number;
        grossFood: number;
        discount: number;
        foodOmzet: number;
        platformFee: number;
        netInflow: number;
        hpp: number;
        margin: number;
      }
    >();

    for (const s of filteredSales) {
      const d = new Date(s.createdAt || s.date);
      const isValid = !Number.isNaN(d.getTime());
      const key = isValid
        ? periodGroupMode === 'MONTHLY'
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
              2,
              '0'
            )}-${String(d.getDate()).padStart(2, '0')}`
        : s.date || 'Lainnya';

      const label = isValid
        ? periodGroupMode === 'MONTHLY'
          ? d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
          : d.toLocaleDateString('id-ID', {
              weekday: 'short',
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
        : key;

      const fin = normalizeSaleFinancials(s);
      const inflow = getSaleLedgerInflow(s);
      const qty = s.items.reduce((acc, it) => acc + (it.quantity || 0), 0);

      let saleHpp = 0;
      for (const it of s.items || []) {
        saleHpp +=
          resolveSoldItemUnitHpp(it.productId, it.productName, it.hppPerItem) *
          (it.quantity || 0);
      }
      if (saleHpp === 0 && (s.totalHpp || 0) > 0) {
        saleHpp = s.totalHpp || 0;
      }

      const cur = map.get(key) || {
        periodKey: key,
        periodLabel: label,
        txCount: 0,
        qty: 0,
        grossFood: 0,
        discount: 0,
        foodOmzet: 0,
        platformFee: 0,
        netInflow: 0,
        hpp: 0,
        margin: 0,
      };

      cur.txCount += 1;
      cur.qty += qty;
      cur.grossFood += fin.subtotal;
      cur.discount += fin.totalFoodDiscount;
      cur.foodOmzet += fin.foodTotal;
      cur.platformFee += fin.platformServiceFee;
      cur.netInflow += inflow.amount;
      cur.hpp += saleHpp;
      cur.margin = cur.foodOmzet - cur.hpp;
      map.set(key, cur);
    }

    return Array.from(map.values()).sort((a, b) =>
      b.periodKey.localeCompare(a.periodKey)
    );
  }, [filteredSales, periodGroupMode, resolveSoldItemUnitHpp]);

  // 5. Purchases & Cash Flow for Purchases
  const purchaseData = useMemo(() => {
    const activePurchases = purchases.filter((p) => p.status !== 'VOID');
    const voidedIds = new Set(
      purchases.filter((p) => p.status === 'VOID').map((p) => p.id)
    );
    const validIds = new Set(activePurchases.map((p) => p.id));

    const purchaseMutations: CashMutation[] = cashMutations.filter((m) => {
      if (!isDateInPeriod(m.createdAt, m.date)) return false;
      if (m.type !== 'PENGELUARAN' || m.flow !== 'OUT') return false;
      if (m.referenceId && voidedIds.has(m.referenceId)) return false;
      if (m.referenceId && validIds.has(m.referenceId)) return true;
      const title = (m.title || '').trim();
      return (
        Boolean(m.referenceId) ||
        title.startsWith('Pembelian #') ||
        title.startsWith('Bayar Hutang #')
      );
    });

    const cashMutationPurchasePayment = purchaseMutations.reduce(
      (sum, m) => sum + (m.amount || 0),
      0
    );

    const periodPurchases = activePurchases
      .filter((p) => isDateInPeriod(p.createdAt, p.date))
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.date).getTime() -
          new Date(a.createdAt || a.date).getTime()
      );

    const purchaseIdsWithCashMutations = new Set(
      cashMutations
        .filter(
          (m) =>
            m.type === 'PENGELUARAN' &&
            m.flow === 'OUT' &&
            Boolean(m.referenceId)
        )
        .map((m) => m.referenceId as string)
    );
    const unmutatedPaidPO = periodPurchases
      .filter((p) => !purchaseIdsWithCashMutations.has(p.id))
      .reduce((sum, p) => sum + Math.max(0, Number(p.paidAmount ?? 0)), 0);

    const totalPurchasePayment = cashMutationPurchasePayment + unmutatedPaidPO;

    const q = searchQuery.trim().toLowerCase();
    const filteredPurchases = periodPurchases.filter((p) => {
      if (
        purchaseStatusFilter !== 'ALL' &&
        p.paymentStatus !== purchaseStatusFilter
      ) {
        return false;
      }
      if (
        supplierFilter !== 'ALL' &&
        (p.vendorName || p.supplier || '') !== supplierFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        (p.purchaseNo || '').toLowerCase().includes(q) ||
        (p.vendorName || '').toLowerCase().includes(q) ||
        (p.invoiceNo || '').toLowerCase().includes(q) ||
        (p.items || []).some((it) =>
          (it.targetName || '').toLowerCase().includes(q)
        )
      );
    });

    const itemMap = new Map<
      string,
      {
        id: string;
        name: string;
        itemType: string;
        frequency: number;
        totalBuyQty: number;
        buyUnit: string;
        totalStockAdded: number;
        stockUnit: string;
        totalSubtotal: number;
      }
    >();

    for (const p of periodPurchases) {
      for (const it of p.items || []) {
        if (
          purchaseItemTypeFilter !== 'ALL' &&
          it.itemType !== purchaseItemTypeFilter
        ) {
          continue;
        }
        if (q && !(it.targetName || '').toLowerCase().includes(q)) {
          continue;
        }
        const key = it.targetId || it.targetName;
        const cur = itemMap.get(key) || {
          id: key,
          name: it.targetName,
          itemType: it.itemType || 'BAHAN_BAKU',
          frequency: 0,
          totalBuyQty: 0,
          buyUnit: it.purchaseUnit || it.unit || 'pcs',
          totalStockAdded: 0,
          stockUnit: it.stockUnit || it.unit || 'pcs',
          totalSubtotal: 0,
        };
        cur.frequency += 1;
        cur.totalBuyQty += it.quantity || 0;
        cur.totalStockAdded +=
          it.stockQuantityAdded ||
          (it.quantity || 0) * (it.conversionFactor || 1);
        cur.totalSubtotal += it.subtotal || 0;
        itemMap.set(key, cur);
      }
    }

    const supplierMap = new Map<
      string,
      {
        vendorName: string;
        phone: string;
        poCount: number;
        totalAmount: number;
        paidAmount: number;
        remainingAmount: number;
      }
    >();

    for (const p of periodPurchases) {
      const vName = p.vendorName || p.supplier || 'Supplier Umum';
      if (q && !vName.toLowerCase().includes(q)) continue;
      const vendorDoc = vendors.find(
        (v) => v.id === p.vendorId || v.name === vName
      );
      const cur = supplierMap.get(vName) || {
        vendorName: vName,
        phone: vendorDoc?.phone || vendorDoc?.contactName || '-',
        poCount: 0,
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
      };
      cur.poCount += 1;
      cur.totalAmount += p.totalAmount || 0;
      cur.paidAmount += p.paidAmount || 0;
      cur.remainingAmount += Math.max(0, p.remainingAmount || 0);
      supplierMap.set(vName, cur);
    }

    const unpaidPurchases = activePurchases
      .filter((p) => (p.remainingAmount || 0) > 0)
      .filter((p) => {
        if (
          supplierFilter !== 'ALL' &&
          (p.vendorName || p.supplier || '') !== supplierFilter
        ) {
          return false;
        }
        if (!q) return true;
        return (
          (p.purchaseNo || '').toLowerCase().includes(q) ||
          (p.vendorName || '').toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          new Date(a.dueDate || a.date || a.createdAt).getTime() -
          new Date(b.dueDate || b.date || b.createdAt).getTime()
      );

    return {
      purchaseMutations,
      totalPurchasePayment,
      periodPurchases,
      filteredPurchases,
      purchasesByProduct: Array.from(itemMap.values()).sort(
        (a, b) => b.totalSubtotal - a.totalSubtotal
      ),
      purchasesBySupplier: Array.from(supplierMap.values()).sort(
        (a, b) => b.totalAmount - a.totalAmount
      ),
      unpaidPurchases,
      periodTotalPO: periodPurchases.reduce(
        (s, p) => s + (p.totalAmount || 0),
        0
      ),
      periodPaidPO: periodPurchases.reduce(
        (s, p) => s + (p.paidAmount || 0),
        0
      ),
      periodUnpaidDebt: periodPurchases.reduce(
        (s, p) => s + Math.max(0, p.remainingAmount || 0),
        0
      ),
      allTimeUnpaidDebt: activePurchases.reduce(
        (s, p) => s + Math.max(0, p.remainingAmount || 0),
        0
      ),
    };
  }, [
    purchases,
    cashMutations,
    vendors,
    isDateInPeriod,
    searchQuery,
    purchaseStatusFilter,
    supplierFilter,
    purchaseItemTypeFilter,
  ]);

  // 6. Operational Expenses (Standalone, excluding auto-generated PO expenses)
  const expenseData = useMemo(() => {
    const standalone = filterStandaloneExpenses(expenses)
      .filter((e) => isDateInPeriod(e.createdAt, e.date))
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.date).getTime() -
          new Date(a.createdAt || a.date).getTime()
      );

    const totalOperationalExpense = standalone.reduce(
      (sum, e) => sum + (e.amount || 0),
      0
    );

    const byCategory: Record<string, { count: number; amount: number }> = {};
    for (const e of standalone) {
      const cat = e.category || 'lainnya';
      if (!byCategory[cat]) byCategory[cat] = { count: 0, amount: 0 };
      byCategory[cat].count += 1;
      byCategory[cat].amount += e.amount || 0;
    }

    const q = searchQuery.trim().toLowerCase();
    const filteredExpenses = standalone.filter((e) => {
      if (
        expenseCategoryFilter !== 'ALL' &&
        e.category !== expenseCategoryFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        (e.note || '').toLowerCase().includes(q) ||
        (e.category || '').toLowerCase().includes(q) ||
        (e.createdBy || '').toLowerCase().includes(q)
      );
    });

    return {
      standaloneExpenses: standalone,
      filteredExpenses,
      totalOperationalExpense,
      byCategory,
    };
  }, [expenses, isDateInPeriod, searchQuery, expenseCategoryFilter]);

  // 7. Owner Withdrawal & Internal Settlements/Transfers
  const transferAndOwnerSummary = useMemo(() => {
    let totalOwnerWithdrawal = 0;
    let ownerWithdrawalCount = 0;
    let platformSettlementTotal = 0;
    let qrisSettlementTotal = 0;
    let internalTransferTotal = 0;

    const periodMutations = cashMutations.filter((m) =>
      isDateInPeriod(m.createdAt, m.date)
    );

    for (const m of periodMutations) {
      if (m.flow !== 'OUT') continue;
      const fromAcc = normalizeCashAccount(
        m.account,
        `${m.title || ''} ${m.notes || ''}`
      );
      const toAcc = m.relatedAccount
        ? normalizeCashAccount(m.relatedAccount)
        : null;

      if (
        fromAcc !== 'KAS_OWNER' &&
        (m.type === 'SETOR_OWNER' || toAcc === 'KAS_OWNER')
      ) {
        totalOwnerWithdrawal += m.amount || 0;
        ownerWithdrawalCount += 1;
        continue;
      }

      if (
        (fromAcc === 'WALLET_GOFOOD' ||
          fromAcc === 'WALLET_GRABFOOD' ||
          fromAcc === 'WALLET_SHOPEEFOOD') &&
        (m.type === 'PENCAIRAN_PLATFORM' || m.type === 'TRANSFER_DANA')
      ) {
        platformSettlementTotal += m.amount || 0;
        continue;
      }

      if (
        fromAcc === 'KAS_QRIS' &&
        (m.type === 'PENCAIRAN_QRIS' || m.type === 'TRANSFER_DANA')
      ) {
        qrisSettlementTotal += m.amount || 0;
        continue;
      }

      if (m.type === 'TRANSFER_DANA') {
        internalTransferTotal += m.amount || 0;
      }
    }

    return {
      totalOwnerWithdrawal,
      ownerWithdrawalCount,
      platformSettlementTotal,
      qrisSettlementTotal,
      internalTransferTotal,
    };
  }, [cashMutations, isDateInPeriod]);

  // 8. Inventory & Stock Reports Data
  const inventoryData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const getStockStatus = (
      stock: number,
      minStock: number,
      critStock: number
    ): 'AMAN' | 'MENIPIS' | 'KRITIS' | 'HABIS' => {
      if (stock <= 0) return 'HABIS';
      if (stock <= critStock) return 'KRITIS';
      if (stock <= minStock) return 'MENIPIS';
      return 'AMAN';
    };

    const allStockRows: Array<{
      id: string;
      code: string;
      name: string;
      categoryType: 'BAHAN_BAKU' | 'KEMASAN' | 'BARANG_SIAP_JUAL';
      categoryLabel: string;
      stock: number;
      unit: string;
      minStock: number;
      costPerUnit: number;
      valuation: number;
      openingQty: number;
      openingValue: number;
      purchaseQty: number;
      purchaseValue: number;
      usageQty: number;
      usageValue: number;
      adjustmentQty: number;
      adjustmentValue: number;
      closingQty: number;
      closingValue: number;
      status: 'AMAN' | 'MENIPIS' | 'KRITIS' | 'HABIS';
    }> = [];

    const computeItemMovementBreakdown = (
      itemId: string,
      currentStock: number,
      costPerUnit: number
    ) => {
      const itemMovs = stockMovements.filter(
        (m) => (m.entityId || m.ingredientId || m.productId) === itemId
      );
      let netAfterPeriod = 0;
      let purchaseQty = 0;
      let usageQty = 0;
      let adjustmentQty = 0;

      for (const m of itemMovs) {
        const ts = m.createdAt ? new Date(m.createdAt).getTime() : 0;
        if (period !== 'ALL' && ts > endMs) {
          netAfterPeriod += Number(m.changeAmount || 0);
          continue;
        }
        if (!isDateInPeriod(m.createdAt)) continue;

        const chg = Number(m.changeAmount || 0);
        if (m.type === 'PURCHASE' && chg > 0) {
          purchaseQty += chg;
        } else if (
          (m.type === 'PRODUCTION' || m.type === 'SALE' || m.type === 'WASTE') &&
          chg < 0
        ) {
          usageQty += Math.abs(chg);
        } else if (
          (m.type === 'ADJUSTMENT' || m.type === 'RETURN') &&
          !isInitialStockMovement(m)
        ) {
          const isCancelReturn =
            m.type === 'RETURN' &&
            ((m.notes || '').toLowerCase().includes('batal') ||
              (m.notes || '').toLowerCase().includes('cancel'));
          if (isCancelReturn && chg > 0) {
            usageQty = Math.max(0, usageQty - chg);
          } else {
            adjustmentQty += chg;
          }
        }
      }

      const closingQty = Math.max(0, currentStock - netAfterPeriod);
      const openingQty = Math.max(
        0,
        closingQty - purchaseQty + usageQty - adjustmentQty
      );

      return {
        openingQty,
        openingValue: Math.round(openingQty * costPerUnit),
        purchaseQty,
        purchaseValue: Math.round(purchaseQty * costPerUnit),
        usageQty,
        usageValue: Math.round(usageQty * costPerUnit),
        adjustmentQty,
        adjustmentValue: Math.round(adjustmentQty * costPerUnit),
        closingQty,
        closingValue: Math.round(closingQty * costPerUnit),
      };
    };

    for (const ing of ingredients) {
      if (ing.type === 'PREPARED') continue;
      const catType =
        ing.type === 'PACKAGING' ? 'KEMASAN' : 'BAHAN_BAKU';
      const stock = Number(ing.stock || 0);
      const cost = Number(ing.costPerUnit || 0);
      const min = Number(ing.minimumStock || 5);
      const crit = Number(ing.criticalStock || Math.max(1, min / 2));
      const status = getStockStatus(stock, min, crit);
      const breakdown = computeItemMovementBreakdown(ing.id, stock, cost);

      allStockRows.push({
        id: ing.id,
        code: ing.code || '-',
        name: ing.name,
        categoryType: catType,
        categoryLabel: catType === 'KEMASAN' ? 'Kemasan' : 'Bahan Baku',
        stock,
        unit: ing.stockUnit || ing.unit || 'pcs',
        minStock: min,
        costPerUnit: cost,
        valuation: Math.max(0, stock * cost),
        ...breakdown,
        status,
      });
    }

    for (const prod of products) {
      if (prod.stockSource === 'READY_TO_SELL') {
        const stock = Number(prod.stock || 0);
        const cost = Number(prod.costPerUnit || 0);
        const min = Number(prod.minStock || 5);
        const crit = Number(prod.criticalStock || 2);
        const status = getStockStatus(stock, min, crit);
        const breakdown = computeItemMovementBreakdown(prod.id, stock, cost);

        allStockRows.push({
          id: prod.id,
          code: prod.sku || '-',
          name: prod.name,
          categoryType: 'BARANG_SIAP_JUAL',
          categoryLabel: 'Barang Siap Jual',
          stock,
          unit: prod.stockUnit || 'pcs',
          minStock: min,
          costPerUnit: cost,
          valuation: Math.max(0, stock * cost),
          ...breakdown,
          status,
        });
      }
    }

    const filteredStockRows = allStockRows
      .filter((r) => {
        if (stockTypeFilter !== 'ALL' && r.categoryType !== stockTypeFilter) {
          return false;
        }
        if (stockStatusFilter !== 'ALL' && r.status !== stockStatusFilter) {
          return false;
        }
        if (!q) return true;
        return (
          r.name.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.valuation - a.valuation);

    const productionProducts = products
      .filter(
        (p) => p.isProduction === true || p.stockSource === 'PRODUCTION'
      )
      .map((p) => {
        const recipe = recipes.find(
          (r) => r.id === p.recipeId || r.productId === p.id
        );
        const stock = Number(p.stock || 0);
        const hpp = getProductRecipeHpp(
          p.id,
          productsMap,
          recipesMap,
          ingredientsMap
        );
        const min = Number(p.minStock || 5);
        const crit = Number(p.criticalStock || 2);
        return {
          id: p.id,
          name: p.name,
          sku: p.sku || '-',
          unit: p.stockUnit || recipe?.yieldUnit || 'porsi',
          yieldQty: recipe?.yieldQty || 1,
          stock,
          hppPerUnit: hpp,
          valuation: Math.max(0, stock * hpp),
          status: getStockStatus(stock, min, crit),
        };
      })
      .filter((p) => !q || p.name.toLowerCase().includes(q));

    const periodProductions = productions
      .filter((pr) => isDateInPeriod(pr.createdAt, pr.date))
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.date).getTime() -
          new Date(a.createdAt || a.date).getTime()
      );

    const periodMovements = stockMovements
      .filter((m) => isDateInPeriod(m.createdAt))
      .filter((m) => {
        if (movementTypeFilter !== 'ALL' && m.type !== movementTypeFilter) {
          return false;
        }
        if (!q) return true;
        const entityName =
          m.entityName || m.ingredientName || m.productName || '';
        return (
          entityName.toLowerCase().includes(q) ||
          (m.referenceId || '').toLowerCase().includes(q) ||
          (m.notes || '').toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    const consumptionMap = new Map<
      string,
      {
        id: string;
        name: string;
        categoryLabel: string;
        unit: string;
        usedInProduction: number;
        usedInSales: number;
        usedInWaste: number;
        totalUsed: number;
        costPerUnit: number;
        estimatedCost: number;
      }
    >();

    const periodStockMovements = stockMovements.filter((m) =>
      isDateInPeriod(m.createdAt)
    );

    for (const m of periodStockMovements) {
      const id = m.entityId || m.ingredientId || m.productId || m.id;
      const ing = ingredients.find((i) => i.id === id);
      const prod = products.find((p) => p.id === id);
      const name =
        m.entityName ||
        m.ingredientName ||
        m.productName ||
        ing?.name ||
        prod?.name ||
        'Item';
      if (q && !name.toLowerCase().includes(q)) continue;

      const chg = Number(m.changeAmount || 0);
      const absQty = Math.abs(chg);
      const costPerUnit = Number(ing?.costPerUnit || prod?.costPerUnit || 0);
      const unit =
        m.stockUnit ||
        m.unit ||
        ing?.stockUnit ||
        ing?.unit ||
        prod?.stockUnit ||
        'pcs';
      const catLabel =
        ing?.type === 'PACKAGING'
          ? 'Kemasan'
          : prod
          ? 'Produk Stok'
          : 'Bahan Baku';

      const cur = consumptionMap.get(id) || {
        id,
        name,
        categoryLabel: catLabel,
        unit,
        usedInProduction: 0,
        usedInSales: 0,
        usedInWaste: 0,
        totalUsed: 0,
        costPerUnit,
        estimatedCost: 0,
      };

      const isCancelReturn =
        m.type === 'RETURN' &&
        ((m.notes || '').toLowerCase().includes('batal') ||
          (m.notes || '').toLowerCase().includes('cancel'));

      if (m.type === 'PRODUCTION' && chg < 0) {
        cur.usedInProduction += absQty;
      } else if (isCancelReturn && chg > 0) {
        cur.usedInProduction = Math.max(0, cur.usedInProduction - chg);
      } else if (m.type === 'SALE') {
        if (chg < 0) cur.usedInSales += absQty;
        else if (chg > 0) cur.usedInSales = Math.max(0, cur.usedInSales - chg);
      } else if (m.type === 'WASTE' && chg < 0) {
        cur.usedInWaste += absQty;
      }

      cur.totalUsed = Math.max(
        0,
        cur.usedInProduction + cur.usedInSales + cur.usedInWaste
      );
      cur.estimatedCost = cur.totalUsed * cur.costPerUnit;
      consumptionMap.set(id, cur);
    }

    return {
      allStockRows,
      filteredStockRows,
      productionProducts,
      periodProductions,
      periodStockProductions: stockProductions.filter((sp) =>
        isDateInPeriod(sp.createdAt, sp.date)
      ),
      periodMovements,
      materialConsumptions: Array.from(consumptionMap.values()).sort(
        (a, b) => b.estimatedCost - a.estimatedCost
      ),
      totalRawPackagingValuation: allStockRows
        .filter((r) => r.categoryType !== 'BARANG_SIAP_JUAL')
        .reduce((s, r) => s + r.valuation, 0),
      totalReadyToSellValuation: allStockRows
        .filter((r) => r.categoryType === 'BARANG_SIAP_JUAL')
        .reduce((s, r) => s + r.valuation, 0),
      totalProductionValuation: productionProducts.reduce(
        (s, p) => s + p.valuation,
        0
      ),
      totalOpeningValuation: allStockRows.reduce(
        (s, r) => s + r.openingValue,
        0
      ),
      totalPurchaseValuation: allStockRows.reduce(
        (s, r) => s + r.purchaseValue,
        0
      ),
      totalUsageValuation: allStockRows.reduce(
        (s, r) => s + r.usageValue,
        0
      ),
      totalAdjustmentValuation: allStockRows.reduce(
        (s, r) => s + r.adjustmentValue,
        0
      ),
      totalClosingValuation: allStockRows.reduce(
        (s, r) => s + r.closingValue,
        0
      ),
    };
  }, [
    ingredients,
    products,
    recipes,
    productsMap,
    recipesMap,
    ingredientsMap,
    productions,
    stockProductions,
    stockMovements,
    period,
    endMs,
    isDateInPeriod,
    searchQuery,
    stockTypeFilter,
    stockStatusFilter,
    movementTypeFilter,
  ]);

  // 9. Cash & Bank Accounts Report Data
  const cashAccountsReport = useMemo(() => {
    const periodMutations = cashMutations
      .filter((m) => isDateInPeriod(m.createdAt, m.date))
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.date).getTime() -
          new Date(a.createdAt || a.date).getTime()
      );

    const accountStats = CANONICAL_CASH_ACCOUNTS.map((acc) => {
      const salesIn = salesSummary.inflowByAccount[acc.id] || 0;
      let mutIn = 0;
      let mutOut = 0;

      for (const m of periodMutations) {
        if (m.type === 'PENJUALAN') continue;
        const normAcc = normalizeCashAccount(
          m.account,
          `${m.title || ''} ${m.notes || ''}`
        );
        if (normAcc !== acc.id) continue;
        if (m.flow === 'IN') mutIn += m.amount || 0;
        else if (m.flow === 'OUT') mutOut += m.amount || 0;
      }

      let currentBalance = 0;
      if (acc.id === 'KAS_KASIR') currentBalance = cashBalanceSummary.kasKasir;
      else if (acc.id === 'KAS_QRIS') currentBalance = cashBalanceSummary.kasQris;
      else if (acc.id === 'KAS_OWNER') currentBalance = cashBalanceSummary.kasOwner;
      else if (acc.id === 'BANK_BCA') currentBalance = cashBalanceSummary.bankBca;
      else if (acc.id === 'BANK_JAGO') currentBalance = cashBalanceSummary.bankJago;
      else if (acc.id === 'BANK_MANDIRI') currentBalance = cashBalanceSummary.bankMandiri;
      else if (acc.id === 'WALLET_GOFOOD') currentBalance = cashBalanceSummary.walletGofood;
      else if (acc.id === 'WALLET_GRABFOOD') currentBalance = cashBalanceSummary.walletGrabfood;
      else if (acc.id === 'WALLET_SHOPEEFOOD') currentBalance = cashBalanceSummary.walletShopeefood;

      const totalIn = salesIn + mutIn;
      const totalOut = mutOut;

      return {
        ...acc,
        salesIn,
        mutIn,
        totalIn,
        totalOut,
        netPeriodChange: totalIn - totalOut,
        currentBalance,
      };
    });

    const q = searchQuery.trim().toLowerCase();
    const filteredMutations = periodMutations.filter((m) => {
      const normAcc = normalizeCashAccount(
        m.account,
        `${m.title || ''} ${m.notes || ''}`
      );
      if (cashAccountFilter !== 'ALL' && normAcc !== cashAccountFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (m.title || '').toLowerCase().includes(q) ||
        (m.notes || '').toLowerCase().includes(q) ||
        (m.type || '').toLowerCase().includes(q)
      );
    });

    return {
      accountStats,
      filteredMutations,
    };
  }, [
    cashMutations,
    isDateInPeriod,
    salesSummary.inflowByAccount,
    cashBalanceSummary,
    cashAccountFilter,
    searchQuery,
  ]);

  // Core Cash Basis Figures (for Arus Kas)
  const netSalesInflow = salesSummary.netSalesInflow;
  const totalPurchasePayment = purchaseData.totalPurchasePayment;
  const totalOperationalExpense = expenseData.totalOperationalExpense;
  const netOperationalCash =
    netSalesInflow - totalPurchasePayment - totalOperationalExpense;
  const totalOwnerWithdrawal = transferAndOwnerSummary.totalOwnerWithdrawal;
  const remainingBusinessCash = netOperationalCash - totalOwnerWithdrawal;

  // Core Accrual / Profit & Loss Figures (from profitLoss snapshot)
  const grossProfit = profitLoss.grossProfit;
  const netProfitAccrual = profitLoss.netProfit;

  // Build Export Payload for any active report
  const buildExportPayload = (reportId: ReportId): ExportReportPayload => {
    const safePeriod = period.toLowerCase();

    if (reportId === 'laba_rugi') {
      const pl = profitLoss;
      const comp = comparisonProfitLoss;
      const fmtParen = (val: number) =>
        val > 0 ? `(${formatRupiah(val)})` : formatRupiah(0);
      const fmtSigned = (val: number) =>
        val < 0 ? `(${formatRupiah(Math.abs(val))})` : formatRupiah(val);

      const makeRow = (
        label: string,
        curVal: number,
        compVal?: number,
        isNegative = false,
        isHeaderOnly = false
      ): Array<string | number> => {
        if (isHeaderOnly) {
          return comp ? [label, '', '', ''] : [label, ''];
        }
        const curStr = isNegative ? fmtParen(curVal) : fmtSigned(curVal);
        if (!comp) return [label, curStr];
        const compStr =
          compVal !== undefined
            ? isNegative
              ? fmtParen(compVal)
              : fmtSigned(compVal)
            : '-';
        const pctStr = formatPctChange(curVal, compVal);
        return [label, curStr, compStr, pctStr];
      };

      const statementHeaders = comp
        ? [
            'Akun / Keterangan',
            pl.shortHeaderLabel,
            comp.shortHeaderLabel,
            'Perubahan',
          ]
        : ['Akun / Keterangan', 'Nominal (Rp)'];

      // Table 1: LABA RUGI (Berdasarkan HPP Produk yang Terjual)
      const labaRugiRows: Array<Array<string | number>> = [
        makeRow('PENDAPATAN', 0, undefined, false, true),
        makeRow(
          '  Penjualan Offline',
          pl.grossByChannel.OFFLINE,
          comp?.grossByChannel.OFFLINE
        ),
        makeRow(
          '  Penjualan GoFood',
          pl.grossByChannel.GOFOOD,
          comp?.grossByChannel.GOFOOD
        ),
        makeRow(
          '  Penjualan GrabFood',
          pl.grossByChannel.GRABFOOD,
          comp?.grossByChannel.GRABFOOD
        ),
        makeRow(
          '  Penjualan ShopeeFood',
          pl.grossByChannel.SHOPEEFOOD,
          comp?.grossByChannel.SHOPEEFOOD
        ),
        makeRow(
          '  Diskon Penjualan',
          pl.salesDiscount,
          comp?.salesDiscount,
          true
        ),
        makeRow(
          'TOTAL PENDAPATAN / PENJUALAN BERSIH',
          pl.netSales,
          comp?.netSales
        ),
        makeRow('HARGA POKOK PENJUALAN', 0, undefined, false, true),
        makeRow(
          '  HPP Produk Terjual',
          pl.totalHpp,
          comp?.totalHpp,
          true
        ),
        makeRow('TOTAL HPP', pl.totalHpp, comp?.totalHpp, true),
        makeRow('LABA KOTOR', pl.grossProfit, comp?.grossProfit),
        makeRow('BEBAN PENJUALAN', 0, undefined, false, true),
        makeRow(
          '  Biaya Admin / Platform',
          pl.totalPlatformFee,
          comp?.totalPlatformFee,
          true
        ),
        makeRow(
          'TOTAL BEBAN PENJUALAN',
          pl.totalSellingExpense,
          comp?.totalSellingExpense,
          true
        ),
        makeRow('BEBAN OPERASIONAL', 0, undefined, false, true),
        ...ORDERED_OPERATIONAL_EXPENSE_KEYS.map((cat) =>
          makeRow(
            `  ${EXPENSE_CATEGORY_LABELS[cat] || cat}`,
            pl.operatingExpensesByCategory[cat] || 0,
            comp?.operatingExpensesByCategory[cat] || 0,
            true
          )
        ),
        makeRow(
          'TOTAL BEBAN OPERASIONAL',
          pl.totalOperatingExpense,
          comp?.totalOperatingExpense,
          true
        ),
        makeRow(
          'LABA OPERASIONAL',
          pl.operatingProfit,
          comp?.operatingProfit
        ),
        makeRow(
          'PENDAPATAN / BEBAN LAIN-LAIN',
          0,
          undefined,
          false,
          true
        ),
        makeRow('  Pendapatan Lain', pl.otherIncome, comp?.otherIncome),
        makeRow('  Beban Lain', pl.otherExpense, comp?.otherExpense, true),
        makeRow(
          'LABA SEBELUM PAJAK',
          pl.profitBeforeTax,
          comp?.profitBeforeTax
        ),
        makeRow('  Pajak', pl.taxExpense, comp?.taxExpense, true),
      ];

      const labaRugiFooter = makeRow(
        'LABA BERSIH',
        pl.netProfit,
        comp?.netProfit
      );

      // Table 2: REALISASI KAS OPERASIONAL (ARUS KAS OPERASIONAL)
      const arusKasOperasionalRows: Array<Array<string | number>> = [
        makeRow('Kas Masuk dari Penjualan (Penjualan Bersih)', pl.netSales, comp?.netSales),
        makeRow(
          `Pembayaran Pembelian (PO Periode: ${formatRupiah(pl.actualPurchaseTotal)} | Dibayar: ${formatRupiah(pl.purchasePaymentTotal)} | Hutang PO: ${formatRupiah(pl.actualPurchaseUnpaidDebt)})`,
          pl.purchasePaymentTotal,
          comp?.purchasePaymentTotal,
          true
        ),
        makeRow(
          'Biaya Admin / Platform',
          pl.totalSellingExpense,
          comp?.totalSellingExpense,
          true
        ),
        makeRow(
          'Pengeluaran Operasional Aktual',
          pl.totalOperatingExpense,
          comp?.totalOperatingExpense,
          true
        ),
        makeRow(
          'Beban Lain-lain Aktual',
          pl.otherExpense,
          comp?.otherExpense,
          true
        ),
      ];

      const arusKasOperasionalFooter = makeRow(
        'ARUS KAS BERSIH OPERASIONAL',
        pl.operatingCashFlow,
        comp?.operatingCashFlow
      );

      // Table 3: REKONSILIASI LABA DAN ARUS KAS
      const rekonsiliasiRows: Array<Array<string | number>> = [
        makeRow(
          'Laba Bersih (Berdasarkan HPP Produk Terjual)',
          pl.netProfit,
          comp?.netProfit
        ),
        makeRow(
          'Arus Kas Bersih Operasional (Realisasi Kas Operasional)',
          pl.operatingCashFlow,
          comp?.operatingCashFlow
        ),
      ];

      const rekonsiliasiFooter = makeRow(
        'SELISIH REKONSILIASI (Arus Kas Bersih Operasional - Laba Bersih)',
        pl.reconciliationDifference,
        comp?.reconciliationDifference
      );

      // Table 4: PERSEDIAAN
      const persediaanRows: Array<Array<string | number>> = [
        makeRow(
          'Saldo Awal Persediaan',
          pl.inventorySummary.openingInventoryValue,
          comp?.inventorySummary.openingInventoryValue
        ),
        makeRow(
          'Pembelian Periode Berjalan',
          pl.actualPurchaseTotal,
          comp?.actualPurchaseTotal
        ),
        makeRow(
          'Pemakaian Bahan / HPP',
          pl.inventorySummary.usageInventoryValue,
          comp?.inventorySummary.usageInventoryValue,
          true
        ),
        makeRow(
          'Penyesuaian Stok',
          pl.inventorySummary.adjustmentInventoryValue,
          comp?.inventorySummary.adjustmentInventoryValue
        ),
      ];

      const persediaanFooter = makeRow(
        'SALDO AKHIR PERSEDIAAN',
        pl.inventorySummary.closingInventoryValue,
        comp?.inventorySummary.closingInventoryValue
      );

      return {
        filename: `Laporan_Laba_Rugi_Dan_Arus_Kas_Operasional_ARY_${safePeriod}`,
        reportTitle: 'LAPORAN LABA RUGI & ARUS KAS OPERASIONAL',
        subtitle:
          '1. Laba Rugi berdasarkan HPP produk terjual | 2. Realisasi Kas Operasional | 3. Rekonsiliasi Laba & Arus Kas | 4. Persediaan',
        periodLabel,
        summaryItems: [
          {
            label: 'Pendapatan Bersih',
            value: formatRupiah(pl.netSales),
            sublabel: 'Total penjualan kotor dikurangi diskon penjualan',
          },
          {
            label: 'HPP Produk Terjual',
            value: fmtParen(pl.totalHpp),
            sublabel: 'HPP produk yang terjual pada periode laporan',
          },
          {
            label: 'Laba Kotor',
            value: fmtSigned(pl.grossProfit),
            sublabel: 'Pendapatan Bersih dikurangi HPP Produk Terjual',
          },
          {
            label: 'Laba Bersih',
            value: fmtSigned(pl.netProfit),
            sublabel: 'Perhitungan berdasarkan HPP produk yang terjual',
          },
          {
            label: 'Pembelian Aktual',
            value: formatRupiah(pl.actualPurchaseTotal),
            sublabel: `Dibayar: ${formatRupiah(pl.purchasePaymentTotal)} | Hutang PO: ${formatRupiah(pl.actualPurchaseUnpaidDebt)}`,
          },
          {
            label: 'Arus Kas Operasional',
            value: fmtSigned(pl.operatingCashFlow),
            sublabel: 'Realisasi kas masuk penjualan dikurangi kas keluar operasional',
          },
        ],
        tables: [
          {
            sectionTitle:
              '1. LABA RUGI — Perhitungan berdasarkan HPP produk yang terjual',
            isAccountingStatement: true,
            headers: statementHeaders,
            rows: labaRugiRows,
            footerRow: labaRugiFooter,
          },
          {
            sectionTitle:
              '2. REALISASI KAS OPERASIONAL (ARUS KAS OPERASIONAL) — Perhitungan arus kas masuk dan keluar operasional aktual',
            isAccountingStatement: true,
            headers: statementHeaders,
            rows: arusKasOperasionalRows,
            footerRow: arusKasOperasionalFooter,
          },
          {
            sectionTitle:
              '3. REKONSILIASI LABA DAN ARUS KAS — Perbedaan terutama berasal dari HPP produk terjual yang menggunakan persediaan yang telah tersedia sebelumnya dan tidak merupakan pembayaran pembelian pada periode berjalan',
            isAccountingStatement: true,
            headers: statementHeaders,
            rows: rekonsiliasiRows,
            footerRow: rekonsiliasiFooter,
          },
          {
            sectionTitle:
              '4. PERSEDIAAN — Saldo Akhir = Saldo Awal + Pembelian - Pemakaian +/- Penyesuaian',
            isAccountingStatement: true,
            headers: statementHeaders,
            rows: persediaanRows,
            footerRow: persediaanFooter,
          },
        ],
      };
    }

    switch (reportId) {
      case 'ringkasan_usaha':
        return {
          filename: `Laporan_Ringkasan_Usaha_ARY_${safePeriod}`,
          reportTitle: 'Laporan Ringkasan Usaha',
          subtitle:
            'Ikhtisar Laba Rugi, Arus Kas, Penjualan, Pembelian, Persediaan & Saldo Kas',
          periodLabel,
          summaryItems: [
            {
              label: 'Pendapatan (Penjualan Bersih)',
              value: formatRupiah(profitLoss.netSales),
              sublabel: `${salesSummary.transactionCount} transaksi selesai`,
            },
            {
              label: 'Laba Kotor (Pendapatan - HPP)',
              value: formatRupiah(profitLoss.grossProfit),
              sublabel: `HPP Produk Terjual: ${formatRupiah(profitLoss.totalHpp)}`,
            },
            {
              label: 'Laba Bersih Usaha',
              value: formatRupiah(profitLoss.netProfit),
              sublabel: `Setelah Beban Penjualan & Operasional`,
            },
            {
              label: 'Kas Operasional Bersih (Cash Basis)',
              value: formatRupiah(netOperationalCash),
              sublabel: `Kas Usaha Tersisa: ${formatRupiah(remainingBusinessCash)}`,
            },
          ],
          tables: [
            {
              sectionTitle: 'Ringkasan Laba Rugi (Profit & Loss)',
              headers: ['Komponen Laba Rugi', 'Keterangan', 'Nominal (Rp)'],
              rows: [
                [
                  'Total Pendapatan / Penjualan Bersih',
                  'Penjualan kotor dikurangi diskon penjualan',
                  formatRupiah(profitLoss.netSales),
                ],
                [
                  'Total HPP Produk Terjual',
                  'Berdasarkan produk/menu yang terjual',
                  `(${formatRupiah(profitLoss.totalHpp)})`,
                ],
                [
                  'LABA KOTOR',
                  'Pendapatan Bersih - HPP',
                  formatRupiah(profitLoss.grossProfit),
                ],
                [
                  'Total Beban Penjualan (Biaya Platform)',
                  'GoFood, GrabFood, ShopeeFood',
                  `(${formatRupiah(profitLoss.totalSellingExpense)})`,
                ],
                [
                  'Total Beban Operasional',
                  'Gaji, listrik, gas, transportasi, dll',
                  `(${formatRupiah(profitLoss.totalOperatingExpense)})`,
                ],
                [
                  'LABA BERSIH',
                  'Laba bersih operasional periode ini',
                  formatRupiah(profitLoss.netProfit),
                ],
              ],
            },
            {
              sectionTitle: 'Ringkasan Arus Kas Nyata (Cash Basis)',
              headers: ['Komponen Arus Kas', 'Keterangan', 'Nominal (Rp)'],
              rows: [
                [
                  'Penjualan Bersih Masuk',
                  'Inflow penjualan Offline & Wallet Online',
                  formatRupiah(netSalesInflow),
                ],
                [
                  'Pembayaran Pembelian (PO)',
                  'Kas keluar nyata pembayaran supplier',
                  `(${formatRupiah(totalPurchasePayment)})`,
                ],
                [
                  'Biaya Operasional Dibayar',
                  'Beban operasional toko di luar PO',
                  `(${formatRupiah(totalOperationalExpense)})`,
                ],
                [
                  'KAS OPERASIONAL BERSIH',
                  'Arus kas bersih operasional usaha',
                  formatRupiah(netOperationalCash),
                ],
                [
                  'Pengambilan Owner',
                  'Setoran / penarikan ke Kas Owner (Non-Biaya)',
                  `(${formatRupiah(totalOwnerWithdrawal)})`,
                ],
                [
                  'KAS USAHA TERSISA',
                  'Surplus kas usaha periode ini',
                  formatRupiah(remainingBusinessCash),
                ],
              ],
            },
          ],
        };

      case 'detail_penjualan':
        return {
          filename: `Laporan_Detail_Penjualan_ARY_${safePeriod}`,
          reportTitle: 'Laporan Detail Penjualan',
          periodLabel,
          tables: [
            {
              headers: [
                'Waktu',
                'No. Transaksi',
                'Channel',
                'Rincian Menu',
                'Harga Kotor',
                'Diskon',
                'Penjualan Bersih',
                'Biaya Platform',
                'Kas/Wallet Masuk',
                'Akun Masuk',
              ],
              rows: filteredSales.map((s) => {
                const fin = normalizeSaleFinancials(s);
                const inflow = getSaleLedgerInflow(s);
                return [
                  new Date(s.createdAt).toLocaleString('id-ID'),
                  s.transactionNo,
                  fin.orderType,
                  s.items
                    .map((i) => `${i.quantity}x ${i.productName}`)
                    .join('; '),
                  formatRupiah(fin.subtotal),
                  formatRupiah(fin.totalFoodDiscount),
                  formatRupiah(fin.foodTotal),
                  formatRupiah(fin.platformServiceFee),
                  formatRupiah(inflow.amount),
                  getCashAccountShortLabel(inflow.account),
                ];
              }),
              footerRow: [
                'TOTAL',
                `${filteredSales.length} Transaksi`,
                '',
                `${salesSummary.totalItemsQty} Porsi`,
                formatRupiah(salesSummary.grossFoodSales),
                formatRupiah(salesSummary.totalFoodDiscount),
                formatRupiah(salesSummary.foodOmzet),
                formatRupiah(salesSummary.platformServiceFeeTotal),
                formatRupiah(netSalesInflow),
                '',
              ],
            },
          ],
        };

      case 'penjualan_per_menu': {
        const totQty = salesByMenu.reduce((s, m) => s + m.qty, 0);
        const totGross = salesByMenu.reduce((s, m) => s + m.grossAmount, 0);
        const totDisc = salesByMenu.reduce((s, m) => s + m.discountAmount, 0);
        const totNet = salesByMenu.reduce((s, m) => s + m.netOmzet, 0);
        const totHpp = salesByMenu.reduce((s, m) => s + m.totalHpp, 0);
        const totMargin = salesByMenu.reduce((s, m) => s + m.margin, 0);
        return {
          filename: `Laporan_Penjualan_Per_Menu_ARY_${safePeriod}`,
          reportTitle: 'Laporan Penjualan per Menu',
          periodLabel,
          tables: [
            {
              headers: [
                'Nama Menu',
                'SKU',
                'Qty Terjual',
                'Penjualan Kotor',
                'Diskon Item',
                'Penjualan Bersih',
                'HPP Terjual',
                'Laba Kotor',
                '% Margin',
              ],
              rows: salesByMenu.map((m) => [
                m.name,
                m.sku,
                formatNumber(m.qty),
                formatRupiah(m.grossAmount),
                formatRupiah(m.discountAmount),
                formatRupiah(m.netOmzet),
                formatRupiah(m.totalHpp),
                formatRupiah(m.margin),
                `${
                  m.netOmzet > 0
                    ? ((m.margin / m.netOmzet) * 100).toFixed(1)
                    : '0.0'
                }%`,
              ]),
              footerRow: [
                'TOTAL',
                '',
                formatNumber(totQty),
                formatRupiah(totGross),
                formatRupiah(totDisc),
                formatRupiah(totNet),
                formatRupiah(totHpp),
                formatRupiah(totMargin),
                `${
                  totNet > 0 ? ((totMargin / totNet) * 100).toFixed(1) : '0.0'
                }%`,
              ],
            },
          ],
        };
      }

      case 'penjualan_per_channel':
        return {
          filename: `Laporan_Penjualan_Per_Channel_ARY_${safePeriod}`,
          reportTitle: 'Laporan Penjualan per Channel',
          periodLabel,
          tables: [
            {
              headers: [
                'Channel',
                'Transaksi',
                'Porsi',
                'Penjualan Kotor',
                'Diskon',
                'Penjualan Bersih',
                'Biaya Platform',
                'Net Settlement / Masuk',
                'Kontribusi',
              ],
              rows: ORDER_TYPE_OPTIONS.map((ch) => {
                const st = salesSummary.byChannel[ch.id];
                const pct =
                  salesSummary.foodOmzet > 0
                    ? ((st.foodOmzet / salesSummary.foodOmzet) * 100).toFixed(1)
                    : '0.0';
                return [
                  ch.label,
                  formatNumber(st.count),
                  formatNumber(st.qty),
                  formatRupiah(st.grossFood),
                  formatRupiah(st.foodDiscount),
                  formatRupiah(st.foodOmzet),
                  formatRupiah(st.platformFee),
                  formatRupiah(st.ledgerInflow),
                  `${pct}%`,
                ];
              }),
              footerRow: [
                'TOTAL',
                formatNumber(salesSummary.transactionCount),
                formatNumber(salesSummary.totalItemsQty),
                formatRupiah(salesSummary.grossFoodSales),
                formatRupiah(salesSummary.totalFoodDiscount),
                formatRupiah(salesSummary.foodOmzet),
                formatRupiah(salesSummary.platformServiceFeeTotal),
                formatRupiah(netSalesInflow),
                '100%',
              ],
            },
          ],
        };

      case 'penjualan_per_periode':
        return {
          filename: `Laporan_Penjualan_Per_Periode_ARY_${safePeriod}`,
          reportTitle: 'Laporan Penjualan per Periode',
          periodLabel,
          tables: [
            {
              headers: [
                'Periode',
                'Transaksi',
                'Porsi Terjual',
                'Penjualan Kotor',
                'Diskon',
                'Penjualan Bersih',
                'Biaya Platform',
                'HPP Terjual',
                'Laba Kotor',
              ],
              rows: salesByPeriod.map((p) => [
                p.periodLabel,
                formatNumber(p.txCount),
                formatNumber(p.qty),
                formatRupiah(p.grossFood),
                formatRupiah(p.discount),
                formatRupiah(p.foodOmzet),
                formatRupiah(p.platformFee),
                formatRupiah(p.hpp),
                formatRupiah(p.margin),
              ]),
              footerRow: [
                'TOTAL',
                formatNumber(salesSummary.transactionCount),
                formatNumber(salesSummary.totalItemsQty),
                formatRupiah(salesSummary.grossFoodSales),
                formatRupiah(salesSummary.totalFoodDiscount),
                formatRupiah(salesSummary.foodOmzet),
                formatRupiah(salesSummary.platformServiceFeeTotal),
                formatRupiah(salesSummary.totalHpp),
                formatRupiah(salesSummary.grossProfitAccrual),
              ],
            },
          ],
        };

      case 'detail_pembelian':
        return {
          filename: `Laporan_Detail_Pembelian_ARY_${safePeriod}`,
          reportTitle: 'Laporan Detail Pembelian',
          periodLabel,
          tables: [
            {
              headers: [
                'Tanggal',
                'No. PO',
                'Supplier',
                'Rincian Item',
                'Total Faktur',
                'Sudah Dibayar',
                'Sisa Hutang',
                'Status',
              ],
              rows: purchaseData.filteredPurchases.map((p) => [
                p.date || new Date(p.createdAt).toLocaleDateString('id-ID'),
                p.purchaseNo,
                p.vendorName || p.supplier || '-',
                (p.items || [])
                  .map((it) => `${it.quantity} ${it.unit} ${it.targetName}`)
                  .join('; '),
                formatRupiah(p.totalAmount),
                formatRupiah(p.paidAmount),
                formatRupiah(p.remainingAmount),
                p.paymentStatus,
              ]),
              footerRow: [
                'TOTAL',
                `${purchaseData.filteredPurchases.length} PO`,
                '',
                '',
                formatRupiah(
                  purchaseData.filteredPurchases.reduce(
                    (s, p) => s + (p.totalAmount || 0),
                    0
                  )
                ),
                formatRupiah(
                  purchaseData.filteredPurchases.reduce(
                    (s, p) => s + (p.paidAmount || 0),
                    0
                  )
                ),
                formatRupiah(
                  purchaseData.filteredPurchases.reduce(
                    (s, p) => s + (p.remainingAmount || 0),
                    0
                  )
                ),
                '',
              ],
            },
          ],
        };

      case 'pembelian_per_produk':
        return {
          filename: `Laporan_Pembelian_Per_Produk_ARY_${safePeriod}`,
          reportTitle: 'Laporan Pembelian per Produk & Bahan',
          periodLabel,
          tables: [
            {
              headers: [
                'Nama Bahan / Produk',
                'Jenis',
                'Frekuensi PO',
                'Total Qty Beli',
                'Total Masuk Stok',
                'Rata-rata Harga Beli',
                'Total Nilai Belanja',
              ],
              rows: purchaseData.purchasesByProduct.map((it) => [
                it.name,
                it.itemType,
                `${it.frequency}x`,
                `${formatNumber(it.totalBuyQty)} ${it.buyUnit}`,
                `${formatNumber(it.totalStockAdded)} ${it.stockUnit}`,
                formatRupiah(
                  it.totalBuyQty > 0
                    ? Math.round(it.totalSubtotal / it.totalBuyQty)
                    : 0
                ),
                formatRupiah(it.totalSubtotal),
              ]),
              footerRow: [
                'TOTAL',
                '',
                '',
                '',
                '',
                '',
                formatRupiah(
                  purchaseData.purchasesByProduct.reduce(
                    (s, i) => s + i.totalSubtotal,
                    0
                  )
                ),
              ],
            },
          ],
        };

      case 'pembelian_per_supplier':
        return {
          filename: `Laporan_Pembelian_Per_Supplier_ARY_${safePeriod}`,
          reportTitle: 'Laporan Pembelian per Supplier',
          periodLabel,
          tables: [
            {
              headers: [
                'Nama Supplier',
                'Kontak',
                'Jumlah PO',
                'Total Pembelian',
                'Total Dibayar',
                'Sisa Hutang',
              ],
              rows: purchaseData.purchasesBySupplier.map((s) => [
                s.vendorName,
                s.phone,
                formatNumber(s.poCount),
                formatRupiah(s.totalAmount),
                formatRupiah(s.paidAmount),
                formatRupiah(s.remainingAmount),
              ]),
              footerRow: [
                'TOTAL',
                '',
                formatNumber(
                  purchaseData.purchasesBySupplier.reduce(
                    (a, b) => a + b.poCount,
                    0
                  )
                ),
                formatRupiah(
                  purchaseData.purchasesBySupplier.reduce(
                    (a, b) => a + b.totalAmount,
                    0
                  )
                ),
                formatRupiah(
                  purchaseData.purchasesBySupplier.reduce(
                    (a, b) => a + b.paidAmount,
                    0
                  )
                ),
                formatRupiah(
                  purchaseData.purchasesBySupplier.reduce(
                    (a, b) => a + b.remainingAmount,
                    0
                  )
                ),
              ],
            },
          ],
        };

      case 'hutang_supplier':
        return {
          filename: `Laporan_Hutang_Supplier_ARY_${safePeriod}`,
          reportTitle: 'Laporan Hutang Supplier',
          periodLabel,
          tables: [
            {
              headers: [
                'Tanggal PO',
                'Jatuh Tempo',
                'No. PO',
                'Supplier',
                'Total Faktur',
                'Sudah Dibayar',
                'Sisa Hutang',
                'Status',
              ],
              rows: purchaseData.unpaidPurchases.map((p) => [
                p.date || '-',
                p.dueDate || '-',
                p.purchaseNo,
                p.vendorName || p.supplier || '-',
                formatRupiah(p.totalAmount),
                formatRupiah(p.paidAmount),
                formatRupiah(p.remainingAmount),
                p.paymentStatus,
              ]),
              footerRow: [
                'TOTAL HUTANG',
                '',
                `${purchaseData.unpaidPurchases.length} Faktur`,
                '',
                formatRupiah(
                  purchaseData.unpaidPurchases.reduce(
                    (s, p) => s + p.totalAmount,
                    0
                  )
                ),
                formatRupiah(
                  purchaseData.unpaidPurchases.reduce(
                    (s, p) => s + p.paidAmount,
                    0
                  )
                ),
                formatRupiah(
                  purchaseData.unpaidPurchases.reduce(
                    (s, p) => s + p.remainingAmount,
                    0
                  )
                ),
                '',
              ],
            },
          ],
        };

      case 'ringkasan_stok':
        return {
          filename: `Laporan_Ringkasan_Stok_ARY_${safePeriod}`,
          reportTitle: 'Laporan Ringkasan Stok Persediaan',
          periodLabel,
          tables: [
            {
              headers: [
                'Kode',
                'Nama Item',
                'Kategori',
                'Stok Saat Ini',
                'Satuan',
                'Stok Min',
                'HPP / Unit',
                'Nilai Persediaan',
                'Status',
              ],
              rows: inventoryData.filteredStockRows.map((r) => [
                r.code,
                r.name,
                r.categoryLabel,
                formatNumber(r.stock),
                r.unit,
                formatNumber(r.minStock),
                formatRupiah(r.costPerUnit),
                formatRupiah(r.valuation),
                r.status,
              ]),
              footerRow: [
                'TOTAL',
                `${inventoryData.filteredStockRows.length} Item`,
                '',
                '',
                '',
                '',
                '',
                formatRupiah(
                  inventoryData.filteredStockRows.reduce(
                    (s, r) => s + r.valuation,
                    0
                  )
                ),
                '',
              ],
            },
          ],
        };

      case 'pergerakan_stok':
        return {
          filename: `Laporan_Pergerakan_Stok_ARY_${safePeriod}`,
          reportTitle: 'Laporan Pergerakan Stok (Mutasi)',
          periodLabel,
          tables: [
            {
              headers: [
                'Waktu',
                'Nama Item',
                'Jenis Mutasi',
                'Referensi',
                'Perubahan',
                'Saldo Akhir',
                'Satuan',
                'Keterangan',
              ],
              rows: inventoryData.periodMovements.map((m) => [
                new Date(m.createdAt).toLocaleString('id-ID'),
                m.entityName || m.ingredientName || m.productName || '-',
                isInitialStockMovement(m)
                  ? 'SALDO AWAL (ADJUSTMENT)'
                  : m.type,
                m.referenceId || '-',
                `${m.changeAmount > 0 ? '+' : ''}${formatNumber(
                  m.changeAmount
                )}`,
                formatNumber(m.balanceAfter),
                m.stockUnit || m.unit || 'pcs',
                m.notes || '-',
              ]),
            },
          ],
        };

      case 'stok_produk_produksi':
        return {
          filename: `Laporan_Stok_Produk_Produksi_ARY_${safePeriod}`,
          reportTitle: 'Laporan Stok Produk Hasil Produksi',
          periodLabel,
          tables: [
            {
              sectionTitle: 'Posisi Stok Produk Hasil Produksi Saat Ini',
              headers: [
                'SKU',
                'Produk Hasil Produksi',
                'Stok Saat Ini',
                'Satuan',
                'HPP / Unit',
                'Nilai Stok',
                'Status',
              ],
              rows: inventoryData.productionProducts.map((p) => [
                p.sku,
                p.name,
                formatNumber(p.stock),
                p.unit,
                formatRupiah(p.hppPerUnit),
                formatRupiah(p.valuation),
                p.status,
              ]),
              footerRow: [
                'TOTAL',
                `${inventoryData.productionProducts.length} Produk`,
                '',
                '',
                '',
                formatRupiah(inventoryData.totalProductionValuation),
                '',
              ],
            },
            {
              sectionTitle: 'Riwayat Batch Produksi pada Periode Ini',
              headers: [
                'Tanggal',
                'Produk',
                'Batch',
                'Total Hasil',
                'HPP / Unit',
                'Total Biaya Produksi',
                'Petugas',
              ],
              rows: inventoryData.periodProductions.map((pr) => [
                pr.date || new Date(pr.createdAt).toLocaleDateString('id-ID'),
                pr.productName,
                `${pr.batchQty} batch`,
                `${formatNumber(pr.totalProduced)} ${pr.yieldUnit || 'porsi'}`,
                formatRupiah(pr.hppPerUnit),
                formatRupiah(pr.totalHpp),
                pr.createdByName || pr.userName || pr.createdBy || '-',
              ]),
            },
          ],
        };

      case 'pemakaian_bahan':
        return {
          filename: `Laporan_Pemakaian_Bahan_ARY_${safePeriod}`,
          reportTitle: 'Laporan Pemakaian Bahan Baku & Kemasan',
          periodLabel,
          tables: [
            {
              headers: [
                'Nama Bahan / Kemasan',
                'Kategori',
                'Terpakai Produksi',
                'Terpakai Penjualan',
                'Waste / Opname',
                'Total Terpakai',
                'Satuan',
                'HPP / Unit',
                'Estimasi Nilai',
              ],
              rows: inventoryData.materialConsumptions.map((c) => [
                c.name,
                c.categoryLabel,
                formatNumber(c.usedInProduction),
                formatNumber(c.usedInSales),
                formatNumber(c.usedInWaste),
                formatNumber(c.totalUsed),
                c.unit,
                formatRupiah(c.costPerUnit),
                formatRupiah(c.estimatedCost),
              ]),
              footerRow: [
                'TOTAL',
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                formatRupiah(
                  inventoryData.materialConsumptions.reduce(
                    (s, c) => s + c.estimatedCost,
                    0
                  )
                ),
              ],
            },
          ],
        };

      case 'arus_kas':
        return {
          filename: `Laporan_Arus_Kas_CashBasis_ARY_${safePeriod}`,
          reportTitle: 'Laporan Arus Kas (Cash Basis)',
          subtitle:
            'Arus Uang Masuk Nyata dikurangi Pembayaran Pembelian & Biaya Operasional',
          periodLabel,
          tables: [
            {
              isAccountingStatement: true,
              headers: ['Komponen Arus Kas (Cash Basis)', 'Nominal (Rp)'],
              rows: [
                ['ARUS KAS MASUK DARI PENJUALAN', ''],
                [
                  '  Penjualan Offline Masuk (Kas / QRIS / Bank)',
                  formatRupiah(salesSummary.offlineSalesInflow),
                ],
                [
                  '  Penjualan Online Masuk Wallet (GoFood / GrabFood / ShopeeFood)',
                  formatRupiah(salesSummary.onlineWalletSalesInflow),
                ],
                ['TOTAL PENJUALAN BERSIH MASUK', formatRupiah(netSalesInflow)],
                ['ARUS KAS KELUAR UNTUK PEMBELIAN', ''],
                [
                  '  Pembayaran Pembelian (PO & Pelunasan Hutang)',
                  `(${formatRupiah(totalPurchasePayment)})`,
                ],
                ['ARUS KAS KELUAR BIAYA OPERASIONAL', ''],
                ...Object.entries(expenseData.byCategory).map(([cat, info]) => [
                  `  Biaya ${EXPENSE_CATEGORY_LABELS[cat] || cat}`,
                  `(${formatRupiah(info.amount)})`,
                ]),
                [
                  'TOTAL BIAYA OPERASIONAL DIBAYAR',
                  `(${formatRupiah(totalOperationalExpense)})`,
                ],
                [
                  'KAS OPERASIONAL BERSIH',
                  formatRupiah(netOperationalCash),
                ],
                [
                  '  Pengambilan Owner (Perpindahan Kas ke Kas Owner)',
                  `(${formatRupiah(totalOwnerWithdrawal)})`,
                ],
              ],
              footerRow: [
                'KAS USAHA TERSISA PERIODE INI',
                formatRupiah(remainingBusinessCash),
              ],
            },
          ],
        };

      case 'pengeluaran':
        return {
          filename: `Laporan_Pengeluaran_Operasional_ARY_${safePeriod}`,
          reportTitle: 'Laporan Pengeluaran Operasional',
          periodLabel,
          tables: [
            {
              headers: [
                'Tanggal',
                'Kategori',
                'Keterangan / Catatan',
                'Sumber Kas/Rekening',
                'Dicatat Oleh',
                'Nominal (Rp)',
              ],
              rows: expenseData.filteredExpenses.map((e) => [
                e.date || new Date(e.createdAt).toLocaleDateString('id-ID'),
                EXPENSE_CATEGORY_LABELS[e.category] || e.category,
                e.note || '-',
                getCashAccountShortLabel(e.paymentSource),
                e.createdBy || '-',
                formatRupiah(e.amount),
              ]),
              footerRow: [
                'TOTAL PENGELUARAN',
                `${expenseData.filteredExpenses.length} Catatan`,
                '',
                '',
                '',
                formatRupiah(
                  expenseData.filteredExpenses.reduce(
                    (s, e) => s + (e.amount || 0),
                    0
                  )
                ),
              ],
            },
          ],
        };

      case 'kas_rekening':
        return {
          filename: `Laporan_Kas_Dan_Rekening_ARY_${safePeriod}`,
          reportTitle: 'Laporan Kas & Rekening',
          periodLabel,
          tables: [
            {
              sectionTitle: 'Ringkasan Posisi Saldo & Mutasi per Akun',
              headers: [
                'Akun Kas / Rekening',
                'Keterangan',
                'Uang Masuk (Periode)',
                'Uang Keluar (Periode)',
                'Perubahan Bersih',
                'Saldo Saat Ini',
              ],
              rows: cashAccountsReport.accountStats.map((a) => [
                a.label,
                a.subtitle,
                formatRupiah(a.totalIn),
                formatRupiah(a.totalOut),
                formatRupiah(a.netPeriodChange),
                formatRupiah(a.currentBalance),
              ]),
              footerRow: [
                'TOTAL LIKUIDITAS (KAS + BANK + WALLET)',
                '',
                formatRupiah(
                  cashAccountsReport.accountStats.reduce(
                    (s, a) => s + a.totalIn,
                    0
                  )
                ),
                formatRupiah(
                  cashAccountsReport.accountStats.reduce(
                    (s, a) => s + a.totalOut,
                    0
                  )
                ),
                '',
                formatRupiah(cashBalanceSummary.totalSaldoDanPlatform),
              ],
            },
          ],
        };
    }
  };

  return {
    periodLabel,
    shortPeriodHeader,
    compPeriodLabel,
    compShortHeader,
    profitLoss,
    comparisonProfitLoss,
    filteredSales,
    salesSummary,
    salesByMenu,
    salesByPeriod,
    purchaseData,
    expenseData,
    transferAndOwnerSummary,
    inventoryData,
    cashAccountsReport,
    cashBalanceSummary,
    vendors,
    netSalesInflow,
    totalPurchasePayment,
    totalOperationalExpense,
    netOperationalCash,
    totalOwnerWithdrawal,
    remainingBusinessCash,
    grossProfit,
    netProfitAccrual,
    buildExportPayload,
  };
}
