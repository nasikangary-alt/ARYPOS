import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatRupiah, formatNumber, getMenuHpp, getProductRecipeHpp } from '../../utils/formatters';
import { filterStandaloneExpenses } from '../../utils/cashLedger';
import { normalizeSaleFinancials, getOrderTypeMeta } from '../../utils/saleChannel';
import { resolveProductReference } from '../../services/stockEngine';

import { OwnerSalesChart } from './OwnerSalesChart';
import { OwnerMoneyPosition } from './OwnerMoneyPosition';
import { OwnerAlerts } from './OwnerAlerts';
import { OwnerTopProducts } from './OwnerTopProducts';
import { OwnerHourlySales } from './OwnerHourlySales';
import { OwnerExpenseSummary } from './OwnerExpenseSummary';

import {
  TrendingUp,
  BarChart2,
  ShoppingBag,
  Receipt,
  Clock,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  X,
  Factory,
  Package,
} from 'lucide-react';

interface OwnerDashboardProps {
  onNavigateTab: (tab: string) => void;
}

export type OwnerTimeRange = 'today' | 'yesterday' | 'week' | 'month30' | 'month' | 'custom';

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ onNavigateTab }) => {
  const {
    sales,
    ingredients,
    ingredientsMap,
    products,
    productsMap,
    recipesMap,
    assembliesMap,
    productions,
    purchases,
    expenses,
    cashBalanceSummary,
  } = useApp();
  const { userProfile, currentEmployee } = useAuth();

  const [timeRange, setTimeRange] = useState<OwnerTimeRange>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [showCustomModal, setShowCustomModal] = useState(false);

  // Compute Active & Comparison Time Boundaries (Ms)
  const timeBoundaries = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    let startMs = todayStart;
    let endMs = todayEnd;

    // Comparison boundaries for % change calculation
    let compStartMs = todayStart - 86400000; // default yesterday
    let compEndMs = todayStart - 1;

    if (timeRange === 'today') {
      startMs = todayStart;
      endMs = todayEnd;
      compStartMs = todayStart - 86400000;
      compEndMs = todayStart - 1;
    } else if (timeRange === 'yesterday') {
      startMs = todayStart - 86400000;
      endMs = todayStart - 1;
      compStartMs = startMs - 86400000;
      compEndMs = startMs - 1;
    } else if (timeRange === 'week') {
      startMs = todayStart - 6 * 86400000; // 7 days
      endMs = todayEnd;
      compStartMs = startMs - 7 * 86400000;
      compEndMs = startMs - 1;
    } else if (timeRange === 'month30') {
      startMs = todayStart - 29 * 86400000; // 30 days
      endMs = todayEnd;
      compStartMs = startMs - 30 * 86400000;
      compEndMs = startMs - 1;
    } else if (timeRange === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      startMs = monthStart.getTime();
      endMs = todayEnd;

      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      compStartMs = prevMonthStart.getTime();
      compEndMs = prevMonthEnd.getTime();
    } else if (timeRange === 'custom') {
      const parsedS = customStartDate ? new Date(`${customStartDate}T00:00:00`).getTime() : todayStart;
      const parsedE = customEndDate ? new Date(`${customEndDate}T23:59:59.999`).getTime() : todayEnd;
      startMs = isNaN(parsedS) ? todayStart : parsedS;
      endMs = isNaN(parsedE) ? todayEnd : parsedE;

      const duration = Math.max(86400000, endMs - startMs);
      compStartMs = startMs - duration;
      compEndMs = startMs - 1;
    }

    return { startMs, endMs, compStartMs, compEndMs };
  }, [timeRange, customStartDate, customEndDate]);

  // Helper to resolve unit HPP of an item sold
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

  // Compute Active Period & Comparison Period Sales Financial Metrics
  const activeMetrics = useMemo(() => {
    const { startMs, endMs, compStartMs, compEndMs } = timeBoundaries;
    const completedSales = sales.filter((s) => s.status === 'COMPLETED');
    const inRange = (ts: number, sMs: number, eMs: number) => ts >= sMs && ts <= eMs;

    const periodSales = completedSales.filter((s) =>
      inRange(new Date(s.createdAt).getTime(), startMs, endMs)
    );
    const compSales = completedSales.filter((s) =>
      inRange(new Date(s.createdAt).getTime(), compStartMs, compEndMs)
    );

    const computeMetricsForList = (list: typeof sales) => {
      let omzet = 0;
      let totalHpp = 0;

      for (const s of list) {
        const fin = normalizeSaleFinancials(s);
        omzet += fin.foodTotal;

        let saleHpp = 0;
        for (const it of s.items || []) {
          saleHpp +=
            resolveSoldItemUnitHpp(it.productId, it.productName, it.hppPerItem) *
            (it.quantity || 0);
        }
        if (saleHpp === 0 && (s.totalHpp || 0) > 0) {
          saleHpp = s.totalHpp || 0;
        }
        totalHpp += saleHpp;
      }

      const grossProfit = omzet - totalHpp;
      const margin = omzet > 0 ? (grossProfit / omzet) * 100 : 0;
      const txCount = list.length;
      const avgTx = txCount > 0 ? omzet / txCount : 0;

      return { omzet, totalHpp, grossProfit, margin, txCount, avgTx };
    };

    const current = computeMetricsForList(periodSales);
    const previous = computeMetricsForList(compSales);

    // Compute Expenses for Active & Comparison Period
    const computeExpensesForRange = (sMs: number, eMs: number) => {
      const standaloneExp = filterStandaloneExpenses(expenses)
        .filter((e) => {
          const ts = new Date(e.date || e.createdAt).getTime();
          return inRange(ts, sMs, eMs);
        })
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      const periodPurchases = purchases
        .filter((p) => p.status !== 'VOID')
        .filter((p) => {
          const ts = new Date(p.date || p.createdAt).getTime();
          return inRange(ts, sMs, eMs);
        })
        .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

      return standaloneExp + periodPurchases;
    };

    const currentExpense = computeExpensesForRange(startMs, endMs);
    const previousExpense = computeExpensesForRange(compStartMs, compEndMs);

    // Percentage changes
    const calcPct = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return ((cur - prev) / prev) * 100;
    };

    const omzetChange = calcPct(current.omzet, previous.omzet);
    const profitChange = calcPct(current.grossProfit, previous.grossProfit);
    const txChange = calcPct(current.txCount, previous.txCount);
    const expenseChange = calcPct(currentExpense, previousExpense);

    return {
      periodSales,
      current,
      previous,
      currentExpense,
      previousExpense,
      omzetChange,
      profitChange,
      txChange,
      expenseChange,
    };
  }, [sales, purchases, expenses, timeBoundaries, resolveSoldItemUnitHpp]);

  // Recent Activities (One Horizontal Row, Max 5 Cards)
  const recentActivities = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      subtitle: string;
      timeAgo: string;
      type: 'sale' | 'production' | 'purchase' | 'expense';
      amountStr: string;
      timestamp: number;
    }> = [];

    // Sales
    activeMetrics.periodSales.slice(0, 3).forEach((s) => {
      const fin = normalizeSaleFinancials(s);
      const firstItem = s.items?.[0]?.productName || 'Penjualan POS';
      const extraItems = (s.items?.length || 1) - 1;
      list.push({
        id: `sale-${s.id}`,
        title: extraItems > 0 ? `${firstItem} +${extraItems}` : firstItem,
        subtitle: `Kasir POS • ${s.paymentMethod || 'CASH'}`,
        timeAgo: new Date(s.createdAt).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        type: 'sale',
        amountStr: formatRupiah(fin.foodTotal),
        timestamp: new Date(s.createdAt).getTime(),
      });
    });

    // Purchases
    purchases
      .filter((p) => p.status !== 'VOID')
      .slice(0, 2)
      .forEach((p) => {
        list.push({
          id: `purch-${p.id}`,
          title: p.vendorName || p.supplier || 'Pembelian Bahan',
          subtitle: `${p.items?.length || 1} jenis bahan`,
          timeAgo: new Date(p.date || p.createdAt || Date.now()).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          type: 'purchase',
          amountStr: formatRupiah(p.totalAmount || 0),
          timestamp: new Date(p.date || p.createdAt || 0).getTime(),
        });
      });

    // Productions
    productions.slice(0, 2).forEach((p) => {
      list.push({
        id: `prod-${p.id}`,
        title: p.productName || 'Produksi',
        subtitle: `${p.totalProduced} ${p.yieldUnit || 'porsi'} jadi`,
        timeAgo: new Date(p.createdAt || Date.now()).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        type: 'production',
        amountStr: `${p.totalProduced} ${p.yieldUnit || 'porsi'}`,
        timestamp: new Date(p.createdAt || 0).getTime(),
      });
    });

    // Standalone Expenses
    filterStandaloneExpenses(expenses)
      .slice(0, 2)
      .forEach((e) => {
        list.push({
          id: `exp-${e.id}`,
          title: e.note || e.category || 'Biaya Operasional',
          subtitle: e.category || 'Operasional',
          timeAgo: new Date(e.date || e.createdAt || Date.now()).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          type: 'expense',
          amountStr: formatRupiah(e.amount || 0),
          timestamp: new Date(e.date || e.createdAt || 0).getTime(),
        });
      });

    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  }, [activeMetrics.periodSales, purchases, productions, expenses]);

  // Helper renderer for KPI trends
  const renderTrendBadge = (pct: number, inverse = false) => {
    const isPositive = pct >= 0;
    const isGood = inverse ? !isPositive : isPositive;
    const absVal = Math.abs(pct).toFixed(1).replace('.', ',');

    return (
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-bold ${
          isGood
            ? 'bg-emerald-50 text-[#12B76A] border border-emerald-200/60'
            : 'bg-rose-50 text-[#F04438] border border-rose-200/60'
        }`}
      >
        {isPositive ? (
          <ArrowUpRight className="w-3 h-3" />
        ) : (
          <ArrowDownRight className="w-3 h-3" />
        )}
        <span>{absVal}%</span>
      </span>
    );
  };

  return (
    <div className="pb-16 bg-[#F7F8FA] min-h-screen w-full text-[#172033]">
      {/* ========================================================================= */}
      {/* 1. HEADER (STRICT SPEC: NO GREETING, CLEAN TITLE "BERANDA")               */}
      {/* ========================================================================= */}
      <div className="bg-white border-b border-[#E8ECF2] px-4 lg:px-6 py-3.5 mb-5 shadow-2xs">
        <div className="w-full flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-[28px] font-black text-[#172033] tracking-tight leading-none">
              BERANDA
            </h1>
            <p className="text-xs sm:text-[13px] text-[#667085] mt-1 font-medium">
              Ringkasan performa usaha dan posisi keuangan
            </p>
          </div>

          {/* Time Range Selector Dropdown */}
          <div className="shrink-0 flex items-center gap-2">
            <div className="relative inline-block text-left">
              <select
                value={timeRange}
                onChange={(e) => {
                  const val = e.target.value as OwnerTimeRange;
                  if (val === 'custom') {
                    setShowCustomModal(true);
                  } else {
                    setTimeRange(val);
                  }
                }}
                className="bg-[#F7F8FA] hover:bg-[#F1F4F8] text-[#172033] text-xs font-bold rounded-xl h-9 px-3 pr-8 border border-[#E8ECF2] cursor-pointer focus:outline-none focus:border-[#FF641F] transition-all appearance-none shadow-2xs"
              >
                <option value="today">Hari ini</option>
                <option value="yesterday">Kemarin</option>
                <option value="week">7 Hari</option>
                <option value="month30">30 Hari</option>
                <option value="month">Bulan Ini</option>
                <option value="custom">Custom...</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[#667085]">
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 lg:px-6 space-y-4">
        {/* ========================================================================= */}
        {/* 2. KPI ROW (EXACTLY 4 CARDS, 16px GAP, COMPACT HEIGHT)                    */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: OMZET PENJUALAN */}
          <div className="bg-white rounded-2xl p-4 border border-[#E8ECF2] shadow-2xs relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#12B76A]" />
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] sm:text-xs font-bold text-[#667085] tracking-wider uppercase">
                  OMZET PENJUALAN
                </span>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-[#12B76A] shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#172033] tracking-tight my-1">
                {formatRupiah(activeMetrics.current.omzet)}
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-[#E8ECF2] flex items-center justify-between text-xs">
              {renderTrendBadge(activeMetrics.omzetChange)}
              <span className="text-[11px] text-[#667085] truncate font-medium ml-1">
                vs {timeRange === 'today' ? 'kemarin' : 'periode lalu'} {formatRupiah(activeMetrics.previous.omzet)}
              </span>
            </div>
          </div>

          {/* KPI 2: LABA KOTOR */}
          <div className="bg-white rounded-2xl p-4 border border-[#E8ECF2] shadow-2xs relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#FF641F]" />
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] sm:text-xs font-bold text-[#FF641F] tracking-wider uppercase">
                  LABA KOTOR
                </span>
                <div className="p-1.5 rounded-lg bg-orange-50 text-[#FF641F] shrink-0">
                  <BarChart2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#172033] tracking-tight my-1">
                {formatRupiah(activeMetrics.current.grossProfit)}
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-[#E8ECF2] flex items-center justify-between text-xs">
              {renderTrendBadge(activeMetrics.profitChange)}
              <span className="text-[11px] font-black text-[#FF641F] bg-[#FFF3ED] px-2 py-0.5 rounded-md border border-[#FF641F]/30">
                Margin {activeMetrics.current.margin.toFixed(1).replace('.', ',')}%
              </span>
            </div>
          </div>

          {/* KPI 3: JUMLAH TRANSAKSI */}
          <div className="bg-white rounded-2xl p-4 border border-[#E8ECF2] shadow-2xs relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#2F80ED]" />
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] sm:text-xs font-bold text-[#667085] tracking-wider uppercase">
                  JUMLAH TRANSAKSI
                </span>
                <div className="p-1.5 rounded-lg bg-blue-50 text-[#2F80ED] shrink-0">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#172033] tracking-tight my-1">
                {formatNumber(activeMetrics.current.txCount)}
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-[#E8ECF2] flex items-center justify-between text-xs">
              {renderTrendBadge(activeMetrics.txChange)}
              <span className="text-[11px] text-[#667085] truncate font-medium">
                Rata-rata {formatRupiah(activeMetrics.current.avgTx)}
              </span>
            </div>
          </div>

          {/* KPI 4: PENGELUARAN */}
          <div className="bg-white rounded-2xl p-4 border border-[#E8ECF2] shadow-2xs relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#F04438]" />
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] sm:text-xs font-bold text-[#667085] tracking-wider uppercase">
                  PENGELUARAN
                </span>
                <div className="p-1.5 rounded-lg bg-rose-50 text-[#F04438] shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#172033] tracking-tight my-1">
                {formatRupiah(activeMetrics.currentExpense)}
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-[#E8ECF2] flex items-center justify-between text-xs">
              {renderTrendBadge(activeMetrics.expenseChange, true)}
              <span className="text-[11px] text-[#667085] truncate font-medium">
                Operasional + Pembelian
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. MAIN ANALYTICS ROW — ASYMMETRIC GRID (SALES CHART 46%, MONEY 22%, ALERTS 23%) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.15fr)_minmax(240px,0.85fr)_minmax(260px,1fr)] gap-4 items-start">
          {/* LEFT: SALES CHART (LARGEST COLUMN) */}
          <div>
            <OwnerSalesChart
              sales={sales}
              resolveSoldItemUnitHpp={resolveSoldItemUnitHpp}
            />
          </div>

          {/* CENTER: MONEY POSITION (COMPACT SUMMARY) */}
          <div>
            <OwnerMoneyPosition
              totalSaldo={cashBalanceSummary.totalSaldo}
              cashPhysical={cashBalanceSummary.kasKasir}
              qrisBalance={cashBalanceSummary.kasQris}
              kasOwner={cashBalanceSummary.kasOwner}
              bankBca={cashBalanceSummary.bankBca}
              bankJago={cashBalanceSummary.bankJago}
              bankMandiri={cashBalanceSummary.bankMandiri}
              walletGofood={cashBalanceSummary.walletGofood}
              walletGrabfood={cashBalanceSummary.walletGrabfood}
              walletShopeefood={cashBalanceSummary.walletShopeefood}
              totalPlatformWallet={cashBalanceSummary.totalPlatformWallet}
              totalLiquidity={cashBalanceSummary.totalSaldoDanPlatform}
              onManageCash={() => onNavigateTab('kas_saldo')}
            />
          </div>

          {/* RIGHT: ALERTS (COMPACT OPERATIONAL WARNINGS) */}
          <div>
            <OwnerAlerts
              ingredients={ingredients}
              products={products}
              purchases={purchases}
              walletGofood={cashBalanceSummary.walletGofood}
              walletGrabfood={cashBalanceSummary.walletGrabfood}
              walletShopeefood={cashBalanceSummary.walletShopeefood}
              onNavigateTab={onNavigateTab}
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. SECOND ANALYTICS ROW (PRODUK TERLARIS, PENJUALAN PER JAM, PENGELUARAN)  */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.95fr_1fr] gap-4 items-start">
          {/* LEFT: TOP PRODUCTS TABLE */}
          <div>
            <OwnerTopProducts
              sales={activeMetrics.periodSales}
              onNavigateTab={onNavigateTab}
            />
          </div>

          {/* CENTER: HOURLY SALES BAR CHART */}
          <div>
            <OwnerHourlySales sales={sales} />
          </div>

          {/* RIGHT: EXPENSE DONUT SUMMARY */}
          <div>
            <OwnerExpenseSummary
              expenses={expenses}
              purchases={purchases}
              onNavigateTab={onNavigateTab}
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. RECENT ACTIVITY — ONE HORIZONTAL ROW OF COMPACT ACTIVITY CARDS         */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl border border-[#E8ECF2] shadow-2xs p-4 sm:p-5">
          <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-orange-50 text-[#FF641F]">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-[#172033] tracking-tight">
                  Aktivitas Terbaru
                </h3>
                <p className="text-[11px] text-[#667085]">
                  Catatan transaksi kasir, pembelian, dan produksi terkini
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('pesanan')}
              className="text-xs font-bold text-[#FF641F] hover:text-orange-700 flex items-center gap-0.5 cursor-pointer hover:underline"
            >
              <span>Lihat Semua</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentActivities.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              Belum ada aktivitas terbaru pada periode ini.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {recentActivities.map((act) => (
                <div
                  key={act.id}
                  className="p-3 rounded-xl bg-[#F7F8FA] border border-[#E8ECF2] hover:border-slate-300 transition-colors flex flex-col justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                          act.type === 'sale'
                            ? 'bg-emerald-100 text-[#12B76A]'
                            : act.type === 'purchase'
                            ? 'bg-blue-100 text-[#2F80ED]'
                            : act.type === 'production'
                            ? 'bg-amber-100 text-[#F79009]'
                            : 'bg-rose-100 text-[#F04438]'
                        }`}
                      >
                        {act.type === 'sale'
                          ? 'Penjualan'
                          : act.type === 'purchase'
                          ? 'Pembelian'
                          : act.type === 'production'
                          ? 'Produksi'
                          : 'Pengeluaran'}
                      </span>
                      <span className="text-[10px] text-[#667085] font-semibold">
                        {act.timeAgo}
                      </span>
                    </div>

                    <h4 className="font-bold text-[#172033] text-xs truncate mb-0.5">
                      {act.title}
                    </h4>
                    <p className="text-[10px] text-[#667085] truncate">
                      {act.subtitle}
                    </p>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-slate-200/70 font-extrabold text-[#172033] text-xs">
                    {act.amountStr}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom Date Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 border border-[#E8ECF2] shadow-2xl w-full max-w-sm space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-[#172033] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#FF641F]" />
                <span>Pilih Periode Custom</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#172033] block mb-1">Tanggal Mulai</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-[#172033] font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-[#172033] block mb-1">Tanggal Selesai</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-[#172033] font-semibold"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="flex-1 py-2 rounded-xl border border-[#E8ECF2] font-bold text-xs text-[#667085] hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimeRange('custom');
                  setShowCustomModal(false);
                }}
                className="flex-1 py-2 rounded-xl bg-[#FF641F] hover:bg-orange-600 font-extrabold text-xs text-white shadow-2xs cursor-pointer"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
