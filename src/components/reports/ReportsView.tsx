import React, { useState, useMemo } from 'react';
import {
  CanonicalCashAccount,
  MovementType,
  OrderType,
  PaymentStatus,
} from '../../types';
import { formatNumber, formatRupiah } from '../../utils/formatters';
import { ORDER_TYPE_OPTIONS } from '../../utils/saleChannel';
import {
  COMPARE_OPTIONS,
  ComparePeriodMode,
  PERIOD_OPTIONS,
  PeriodPreset,
  REPORT_CATEGORIES,
  REPORT_DEFINITIONS,
  ReportCategoryId,
  ReportId,
} from './reportTypes';
import { useReportData } from './useReportData';
import {
  exportReportToCSV,
  exportReportToPDF,
} from './reportExportUtils';
import { SalesPurchasesReports } from './SalesPurchasesReports';
import { InventoryFinanceReports } from './InventoryFinanceReports';
import { PageContainer } from '../common/PageContainer';
import { PageHeader } from '../common/PageHeader';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  FileSpreadsheet,
  FileText,
  GitCompare,
  Printer,
  Search,
  Store,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  // Active report state (null = Kledo-style Report Center Landing List)
  const [activeReport, setActiveReport] = useState<ReportId | null>(null);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<
    'ALL' | ReportCategoryId
  >('ALL');
  const [catalogSearch, setCatalogSearch] = useState('');

  // Shared & Report-Specific Filters
  const todayIso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const firstOfMonthIso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      '0'
    )}-01`;
  }, []);

  const [period, setPeriod] = useState<PeriodPreset>('THIS_MONTH');
  const [customStartDate, setCustomStartDate] =
    useState<string>(firstOfMonthIso);
  const [customEndDate, setCustomEndDate] = useState<string>(todayIso);
  const [compareMode, setCompareMode] = useState<ComparePeriodMode>('NONE');

  const [channelFilter, setChannelFilter] = useState<'ALL' | OrderType>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [periodGroupMode, setPeriodGroupMode] = useState<'DAILY' | 'MONTHLY'>(
    'DAILY'
  );
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState<
    'ALL' | PaymentStatus
  >('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [purchaseItemTypeFilter, setPurchaseItemTypeFilter] = useState<
    'ALL' | 'BAHAN_BAKU' | 'KEMASAN' | 'BARANG_SIAP_JUAL'
  >('ALL');
  const [stockTypeFilter, setStockTypeFilter] = useState<
    'ALL' | 'BAHAN_BAKU' | 'KEMASAN' | 'BARANG_SIAP_JUAL'
  >('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<
    'ALL' | 'AMAN' | 'MENIPIS' | 'KRITIS' | 'HABIS'
  >('ALL');
  const [movementTypeFilter, setMovementTypeFilter] = useState<
    'ALL' | MovementType
  >('ALL');
  const [expenseCategoryFilter, setExpenseCategoryFilter] =
    useState<string>('ALL');
  const [cashAccountFilter, setCashAccountFilter] = useState<
    'ALL' | CanonicalCashAccount
  >('ALL');

  const reportData = useReportData({
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
  });

  const activeReportMeta = useMemo(
    () => REPORT_DEFINITIONS.find((r) => r.id === activeReport) || null,
    [activeReport]
  );

  // Subtle live metric preview on the landing list
  const getReportPreviewText = (id: ReportId): string => {
    switch (id) {
      case 'ringkasan_usaha':
        return `Kas Bersih: ${formatRupiah(reportData.netOperationalCash)}`;
      case 'detail_penjualan':
        return `${formatNumber(reportData.salesSummary.transactionCount)} transaksi · ${formatRupiah(reportData.netSalesInflow)}`;
      case 'penjualan_per_menu':
        return `${formatNumber(reportData.salesByMenu.length)} menu terjual`;
      case 'penjualan_per_channel':
        return `4 channel · ${formatRupiah(reportData.netSalesInflow)}`;
      case 'penjualan_per_periode':
        return `${formatNumber(reportData.salesByPeriod.length)} periode aktif`;
      case 'detail_pembelian':
        return `${formatNumber(reportData.purchaseData.periodPurchases.length)} PO · ${formatRupiah(reportData.purchaseData.periodTotalPO)}`;
      case 'pembelian_per_produk':
        return `${formatNumber(reportData.purchaseData.purchasesByProduct.length)} item dibeli`;
      case 'pembelian_per_supplier':
        return `${formatNumber(reportData.purchaseData.purchasesBySupplier.length)} supplier`;
      case 'hutang_supplier':
        return `${formatNumber(reportData.purchaseData.unpaidPurchases.length)} faktur · ${formatRupiah(reportData.purchaseData.allTimeUnpaidDebt)}`;
      case 'ringkasan_stok':
        return `${formatNumber(reportData.inventoryData.allStockRows.length)} item · ${formatRupiah(reportData.inventoryData.totalRawPackagingValuation + reportData.inventoryData.totalReadyToSellValuation)}`;
      case 'pergerakan_stok':
        return `${formatNumber(reportData.inventoryData.periodMovements.length)} mutasi stok`;
      case 'stok_produk_produksi':
        return `${formatNumber(reportData.inventoryData.productionProducts.length)} produk produksi`;
      case 'pemakaian_bahan':
        return `${formatNumber(reportData.inventoryData.materialConsumptions.length)} bahan terpakai`;
      case 'laba_rugi':
        return `Laba (HPP): ${formatRupiah(reportData.profitLoss.netProfit)} · Arus Kas: ${formatRupiah(reportData.profitLoss.operatingCashFlow)}`;
      case 'arus_kas':
        return `Kas Bersih: ${formatRupiah(reportData.netOperationalCash)}`;
      case 'pengeluaran':
        return `${formatNumber(reportData.expenseData.standaloneExpenses.length)} catatan · ${formatRupiah(reportData.totalOperationalExpense)}`;
      case 'kas_rekening':
        return `Total Saldo: ${formatRupiah(reportData.cashBalanceSummary.totalSaldoDanPlatform)}`;
    }
  };

  const handleOpenReport = (id: ReportId) => {
    setSearchQuery('');
    setActiveReport(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    if (!activeReport) return;
    const payload = reportData.buildExportPayload(activeReport);
    exportReportToPDF(payload);
  };

  const handleExportCSV = () => {
    if (!activeReport) return;
    const payload = reportData.buildExportPayload(activeReport);
    exportReportToCSV(payload);
  };

  // Period Selector Bar Component (with Compare & Channel filters when on Laba Rugi)
  const renderPeriodFilterBar = () => (
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5 print:hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200 text-xs font-bold text-slate-600 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-[#FF641F]" />
            <span>Periode:</span>
          </div>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPeriod(opt.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                period === opt.id
                  ? 'bg-[#FF641F] text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {period === 'CUSTOM' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-800"
            />
            <span className="text-slate-400">s/d</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-800"
            />
          </div>
        )}
      </div>

      {/* Kledo-style Laba Rugi Comparison & Channel Filters */}
      {activeReport === 'laba_rugi' && (
        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Bandingkan Dengan */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 font-bold text-slate-600">
                <GitCompare className="w-3.5 h-3.5 text-[#FF641F]" />
                <span>Bandingkan Dengan:</span>
              </span>
              <select
                value={compareMode}
                onChange={(e) =>
                  setCompareMode(e.target.value as ComparePeriodMode)
                }
                disabled={period === 'ALL'}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:border-[#FF641F] disabled:opacity-50"
              >
                {COMPARE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Channel */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 font-bold text-slate-600">
                <Store className="w-3.5 h-3.5 text-[#FF641F]" />
                <span>Channel:</span>
              </span>
              <select
                value={channelFilter}
                onChange={(e) =>
                  setChannelFilter(e.target.value as 'ALL' | OrderType)
                }
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:border-[#FF641F]"
              >
                <option value="ALL">Semua Channel</option>
                {ORDER_TYPE_OPTIONS.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {reportData.comparisonProfitLoss && (
            <div className="text-[11px] text-slate-500">
              Pembanding:{' '}
              <strong className="text-slate-800">
                {reportData.compPeriodLabel}
              </strong>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ============================================================================
  // VIEW 1: HALAMAN LANDING "LAPORAN" (KLEDO-STYLE REPORT CENTER LIST)
  // ============================================================================
  if (!activeReport) {
    const q = catalogSearch.trim().toLowerCase();

    return (
      <PageContainer className="pb-24 lg:pb-10">
        {/* Main Header */}
        <PageHeader
          title="Laporan"
          description="Pantau penjualan, pembelian, persediaan dan kondisi keuangan AYAM GEPREK ARY."
          actions={
            <div className="text-xs text-[#667085] font-medium">
              Periode Aktif:{' '}
              <strong className="text-[#172033]">{reportData.periodLabel}</strong>
            </div>
          }
        />

        {/* Period Filter */}
        {renderPeriodFilterBar()}

        {/* Category Tabs & Search Report Input */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-slate-200/70 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setSelectedCategoryTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                selectedCategoryTab === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Laporan
            </button>
            {REPORT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryTab(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  selectedCategoryTab === cat.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Cari jenis laporan..."
              className="w-full pl-8 pr-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#FF641F]"
            />
          </div>
        </div>

        {/* Grouped Compact Report List (Kledo Reference) */}
        <div className="space-y-5">
          {REPORT_CATEGORIES.filter(
            (cat) =>
              selectedCategoryTab === 'ALL' || selectedCategoryTab === cat.id
          ).map((cat) => {
            const items = REPORT_DEFINITIONS.filter(
              (r) =>
                r.category === cat.id &&
                (!q ||
                  r.title.toLowerCase().includes(q) ||
                  r.description.toLowerCase().includes(q))
            );
            if (items.length === 0) return null;

            return (
              <section key={cat.id} className="space-y-2">
                {/* Category Header with Divider */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 px-1">
                  <div>
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      {cat.label}
                    </h2>
                    <p className="text-[11px] text-slate-500">{cat.subtitle}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {items.length} laporan
                  </span>
                </div>

                {/* Compact List Container */}
                <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {items.map((rep) => (
                    <button
                      key={rep.id}
                      type="button"
                      onClick={() => handleOpenReport(rep.id)}
                      className="w-full px-4 py-3 flex items-center justify-between gap-4 text-left hover:bg-slate-50 transition group cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#FF641F] transition-colors">
                          {rep.title}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {rep.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="hidden sm:inline-block text-[11px] font-semibold text-slate-500">
                          {getReportPreviewText(rep.id)}
                        </span>
                        <span className="text-xs font-bold text-[#FF641F] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          <span>Lihat</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </PageContainer>
    );
  }

  // ============================================================================
  // VIEW 2: HALAMAN LAPORAN KHUSUS (DEDICATED REPORT VIEWER)
  // ============================================================================
  return (
    <PageContainer className="pb-24 lg:pb-10 print:p-0 print:max-w-none">
      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
          }
          header, nav, aside, .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Navigation & Export Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveReport(null)}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#FF641F]" />
            <span>Daftar Laporan</span>
          </button>

          {/* Quick Jump Report Selector */}
          <select
            value={activeReport}
            onChange={(e) => handleOpenReport(e.target.value as ReportId)}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#FF641F]"
          >
            {REPORT_CATEGORIES.map((cat) => (
              <optgroup key={cat.id} label={cat.label}>
                {REPORT_DEFINITIONS.filter((r) => r.category === cat.id).map(
                  (r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  )
                )}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Action Buttons: Print, Download PDF, Export CSV */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPDF}
            className="px-3 py-1.5 rounded-xl bg-[#FF641F] hover:bg-[#F45116] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Period & Comparison Filter Bar */}
      {renderPeriodFilterBar()}

      {/* Formal Accounting Report Title Banner (for reports other than Laba Rugi, which has its own formal statement header) */}
      {activeReport !== 'laba_rugi' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#FF641F] block">
              AYAM GEPREK ARY &middot; {activeReportMeta?.category}
            </span>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
              {activeReportMeta?.formalTitle || 'Laporan'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeReportMeta?.description}
            </p>
          </div>
          <div className="sm:text-right text-xs text-slate-600 shrink-0">
            <span className="text-[11px] text-slate-400 block">
              Periode Laporan
            </span>
            <span className="font-bold text-slate-900">
              {reportData.periodLabel}
            </span>
          </div>
        </div>
      )}

      {/* Render Dedicated Report Content */}
      <SalesPurchasesReports
        activeReport={activeReport}
        onSelectReport={handleOpenReport}
        data={reportData}
        channelFilter={channelFilter}
        setChannelFilter={setChannelFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        periodGroupMode={periodGroupMode}
        setPeriodGroupMode={setPeriodGroupMode}
        purchaseStatusFilter={purchaseStatusFilter}
        setPurchaseStatusFilter={setPurchaseStatusFilter}
        supplierFilter={supplierFilter}
        setSupplierFilter={setSupplierFilter}
        purchaseItemTypeFilter={purchaseItemTypeFilter}
        setPurchaseItemTypeFilter={setPurchaseItemTypeFilter}
      />

      <InventoryFinanceReports
        activeReport={activeReport}
        data={reportData}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        stockTypeFilter={stockTypeFilter}
        setStockTypeFilter={setStockTypeFilter}
        stockStatusFilter={stockStatusFilter}
        setStockStatusFilter={setStockStatusFilter}
        movementTypeFilter={movementTypeFilter}
        setMovementTypeFilter={setMovementTypeFilter}
        expenseCategoryFilter={expenseCategoryFilter}
        setExpenseCategoryFilter={setExpenseCategoryFilter}
        cashAccountFilter={cashAccountFilter}
        setCashAccountFilter={setCashAccountFilter}
      />
    </PageContainer>
  );
};
