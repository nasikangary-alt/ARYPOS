import React, { useState } from 'react';
import { OrderType, PaymentStatus } from '../../types';
import { formatNumber, formatRupiah } from '../../utils/formatters';
import {
  getCashAccountShortLabel,
  getSaleLedgerInflow,
} from '../../utils/cashLedger';
import {
  getOrderTypeMeta,
  normalizeSaleFinancials,
  ORDER_TYPE_OPTIONS,
} from '../../utils/saleChannel';
import { ReportId } from './reportTypes';
import { useReportData } from './useReportData';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Search,
  Store,
  TrendingUp,
  Wallet,
  ShoppingBag,
  Boxes,
  FileText,
} from 'lucide-react';

interface SalesPurchasesReportsProps {
  activeReport: ReportId;
  onSelectReport: (id: ReportId) => void;
  data: ReturnType<typeof useReportData>;
  channelFilter: 'ALL' | OrderType;
  setChannelFilter: (v: 'ALL' | OrderType) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  periodGroupMode: 'DAILY' | 'MONTHLY';
  setPeriodGroupMode: (v: 'DAILY' | 'MONTHLY') => void;
  purchaseStatusFilter: 'ALL' | PaymentStatus;
  setPurchaseStatusFilter: (v: 'ALL' | PaymentStatus) => void;
  supplierFilter: string;
  setSupplierFilter: (v: string) => void;
  purchaseItemTypeFilter: 'ALL' | 'BAHAN_BAKU' | 'KEMASAN' | 'BARANG_SIAP_JUAL';
  setPurchaseItemTypeFilter: (
    v: 'ALL' | 'BAHAN_BAKU' | 'KEMASAN' | 'BARANG_SIAP_JUAL'
  ) => void;
}

export const SalesPurchasesReports: React.FC<SalesPurchasesReportsProps> = ({
  activeReport,
  onSelectReport,
  data,
  channelFilter,
  setChannelFilter,
  searchQuery,
  setSearchQuery,
  periodGroupMode,
  setPeriodGroupMode,
  purchaseStatusFilter,
  setPurchaseStatusFilter,
  supplierFilter,
  setSupplierFilter,
  purchaseItemTypeFilter,
  setPurchaseItemTypeFilter,
}) => {
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  const {
    filteredSales,
    salesSummary,
    salesByMenu,
    salesByPeriod,
    purchaseData,
    inventoryData,
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
  } = data;

  // 1. RINGKASAN USAHA
  if (activeReport === 'ringkasan_usaha') {
    const totalInventoryAsset =
      inventoryData.totalRawPackagingValuation +
      inventoryData.totalReadyToSellValuation +
      inventoryData.totalProductionValuation;

    return (
      <div className="space-y-5">
        {/* Top KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5">
            <span className="text-[11px] font-semibold text-slate-500 block">
              Penjualan Bersih Masuk
            </span>
            <span className="text-lg font-black text-emerald-700 mt-0.5 block">
              {formatRupiah(netSalesInflow)}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              {formatNumber(salesSummary.transactionCount)} transaksi &middot;{' '}
              {formatNumber(salesSummary.totalItemsQty)} porsi
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5">
            <span className="text-[11px] font-semibold text-slate-500 block">
              Kas Operasional Bersih
            </span>
            <span
              className={`text-lg font-black mt-0.5 block ${
                netOperationalCash >= 0 ? 'text-slate-900' : 'text-rose-600'
              }`}
            >
              {formatRupiah(netOperationalCash)}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Kas Tersisa: {formatRupiah(remainingBusinessCash)}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5">
            <span className="text-[11px] font-semibold text-slate-500 block">
              Laba Bersih (Basis HPP)
            </span>
            <span
              className={`text-lg font-black mt-0.5 block ${
                netProfitAccrual >= 0 ? 'text-indigo-700' : 'text-rose-600'
              }`}
            >
              {formatRupiah(netProfitAccrual)}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              HPP Terjual: {formatRupiah(salesSummary.totalHpp)}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5">
            <span className="text-[11px] font-semibold text-slate-500 block">
              Total Kas &amp; Wallet Saat Ini
            </span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">
              {formatRupiah(cashBalanceSummary.totalSaldoDanPlatform)}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Kas/Bank: {formatRupiah(cashBalanceSummary.totalSaldo)}
            </span>
          </div>
        </div>

        {/* Two-Column Executive Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Ringkasan Arus Kas Nyata (Cash Basis) */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                  1. Ringkasan Arus Kas (Cash Basis)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onSelectReport('arus_kas')}
                className="text-xs font-bold text-[#FF641F] hover:underline flex items-center gap-1 cursor-pointer print:hidden"
              >
                <span>Buka Laporan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">
                  Penjualan Bersih Masuk (Kas/Bank/Wallet)
                </span>
                <span className="font-bold text-emerald-700">
                  {formatRupiah(netSalesInflow)}
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">
                  Dikurangi: Pembayaran Pembelian (PO Dibayar)
                </span>
                <span className="font-bold text-amber-700">
                  -{formatRupiah(totalPurchasePayment)}
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">
                  Dikurangi: Biaya Operasional Dibayar
                </span>
                <span className="font-bold text-rose-600">
                  -{formatRupiah(totalOperationalExpense)}
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between bg-slate-50 font-extrabold text-slate-900">
                <span>KAS OPERASIONAL BERSIH</span>
                <span>{formatRupiah(netOperationalCash)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">
                  Dikurangi: Pengambilan Owner (Non-Biaya)
                </span>
                <span className="font-bold text-indigo-600">
                  -{formatRupiah(totalOwnerWithdrawal)}
                </span>
              </div>
              <div className="px-4 py-3 flex justify-between bg-orange-50/60 font-black text-slate-900">
                <span>KAS USAHA TERSISA</span>
                <span className="text-[#FF641F]">
                  {formatRupiah(remainingBusinessCash)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Ringkasan Laba Rugi (Profitabilitas HPP) */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                  2. Ringkasan Laba Rugi (Basis HPP)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onSelectReport('laba_rugi')}
                className="text-xs font-bold text-[#FF641F] hover:underline flex items-center gap-1 cursor-pointer print:hidden"
              >
                <span>Buka Laporan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="px-4 py-2.5 flex justify-between font-bold text-slate-900">
                <span>Total Pendapatan / Penjualan Bersih</span>
                <span>{formatRupiah(data.profitLoss.netSales)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">
                  Dikurangi: Total HPP Produk Terjual
                </span>
                <span className="font-bold text-amber-700">
                  ({formatRupiah(data.profitLoss.totalHpp)})
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between bg-slate-50 font-extrabold text-slate-900">
                <span>LABA KOTOR</span>
                <span>{formatRupiah(data.profitLoss.grossProfit)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">
                  Dikurangi: Total Beban Penjualan (Platform)
                </span>
                <span className="font-bold text-rose-600">
                  ({formatRupiah(data.profitLoss.totalSellingExpense)})
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">
                  Dikurangi: Total Beban Operasional
                </span>
                <span className="font-bold text-rose-600">
                  ({formatRupiah(data.profitLoss.totalOperatingExpense)})
                </span>
              </div>
              <div className="px-4 py-3 flex justify-between bg-indigo-50/50 font-black text-slate-900">
                <span>LABA BERSIH</span>
                <span className="text-indigo-700">
                  {formatRupiah(data.profitLoss.netProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Left: Pembelian & Hutang Supplier */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                  3. Pembelian &amp; Hutang Supplier
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onSelectReport('detail_pembelian')}
                className="text-xs font-bold text-[#FF641F] hover:underline flex items-center gap-1 cursor-pointer print:hidden"
              >
                <span>Detail PO</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">
                  Total Faktur Pembelian (PO Periode Ini)
                </span>
                <span className="font-bold text-slate-900">
                  {formatNumber(purchaseData.periodPurchases.length)} Faktur &middot;{' '}
                  {formatRupiah(purchaseData.periodTotalPO)}
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">
                  Kas Keluar Pembayaran Pembelian
                </span>
                <span className="font-bold text-amber-700">
                  {formatRupiah(totalPurchasePayment)}
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">
                  Sisa Hutang PO Periode Ini
                </span>
                <span className="font-bold text-rose-600">
                  {formatRupiah(purchaseData.periodUnpaidDebt)}
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between bg-slate-50 font-extrabold text-slate-900">
                <span>Total Sisa Hutang Supplier (Semua Periode)</span>
                <span className="text-rose-600">
                  {formatRupiah(purchaseData.allTimeUnpaidDebt)}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Right: Persediaan & Stok */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                  4. Posisi Nilai Persediaan Stok
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onSelectReport('ringkasan_stok')}
                className="text-xs font-bold text-[#FF641F] hover:underline flex items-center gap-1 cursor-pointer print:hidden"
              >
                <span>Ringkasan Stok</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">
                  Nilai Stok Bahan Baku &amp; Kemasan
                </span>
                <span className="font-bold text-slate-900">
                  {formatRupiah(inventoryData.totalRawPackagingValuation)}
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">
                  Nilai Stok Produk Hasil Produksi
                </span>
                <span className="font-bold text-slate-900">
                  {formatRupiah(inventoryData.totalProductionValuation)}
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">
                  Nilai Stok Barang Siap Jual
                </span>
                <span className="font-bold text-slate-900">
                  {formatRupiah(inventoryData.totalReadyToSellValuation)}
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between bg-slate-50 font-extrabold text-slate-900">
                <span>TOTAL NILAI ASET PERSEDIAAN</span>
                <span className="text-emerald-700">
                  {formatRupiah(totalInventoryAsset)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Common Sales Filter Bar (Channel + Search)
  const renderSalesFilterBar = (showGroupToggle = false) => (
    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 print:hidden">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setChannelFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
            channelFilter === 'ALL'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          Semua Channel
        </button>
        {ORDER_TYPE_OPTIONS.map((ch) => (
          <button
            key={ch.id}
            type="button"
            onClick={() => setChannelFilter(ch.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              channelFilter === ch.id
                ? 'bg-[#FF641F] text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            {ch.shortLabel}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        {showGroupToggle && (
          <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
            <button
              type="button"
              onClick={() => setPeriodGroupMode('DAILY')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                periodGroupMode === 'DAILY'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              Per Hari
            </button>
            <button
              type="button"
              onClick={() => setPeriodGroupMode('MONTHLY')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                periodGroupMode === 'MONTHLY'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              Per Bulan
            </button>
          </div>
        )}
        <div className="relative flex-1 sm:w-60">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari no nota, menu, kasir..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-[#FF641F]"
          />
        </div>
      </div>
    </div>
  );

  // 2. DETAIL PENJUALAN
  if (activeReport === 'detail_penjualan') {
    return (
      <div className="space-y-4">
        {renderSalesFilterBar()}

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] text-slate-500 block">
              Jumlah Transaksi
            </span>
            <span className="text-base font-black text-slate-900">
              {formatNumber(salesSummary.transactionCount)} Nota
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] text-slate-500 block">
              Harga Normal Makanan
            </span>
            <span className="text-base font-black text-slate-900">
              {formatRupiah(salesSummary.grossFoodSales)}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] text-slate-500 block">
              Total Diskon Promo
            </span>
            <span className="text-base font-black text-amber-600">
              -{formatRupiah(salesSummary.totalFoodDiscount)}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] text-slate-500 block">
              Biaya Admin Platform
            </span>
            <span className="text-base font-black text-rose-600">
              -{formatRupiah(salesSummary.platformServiceFeeTotal)}
            </span>
          </div>
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 col-span-2 lg:col-span-1">
            <span className="text-[11px] font-bold text-emerald-800 block">
              Penjualan Bersih Masuk
            </span>
            <span className="text-base font-black text-emerald-700">
              {formatRupiah(netSalesInflow)}
            </span>
          </div>
        </div>

        {/* Accounting Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">No. Transaksi</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3">Rincian Item</th>
                  <th className="py-2.5 px-3 text-right">Harga Normal</th>
                  <th className="py-2.5 px-3 text-right">Diskon</th>
                  <th className="py-2.5 px-3 text-right">Omzet Makanan</th>
                  <th className="py-2.5 px-3 text-right">Fee Platform</th>
                  <th className="py-2.5 px-3 text-right">Penjualan Masuk</th>
                  <th className="py-2.5 px-3">Akun Masuk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-8 text-center text-slate-400"
                    >
                      Tidak ada transaksi penjualan pada periode dan filter ini.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((s) => {
                    const fin = normalizeSaleFinancials(s);
                    const inflow = getSaleLedgerInflow(s);
                    const isExpanded = expandedSaleId === s.id;
                    const disc = fin.itemDiscountTotal + fin.orderDiscount;
                    return (
                      <React.Fragment key={s.id}>
                        <tr
                          onClick={() =>
                            setExpandedSaleId(isExpanded ? null : s.id)
                          }
                          className="hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                            {new Date(s.createdAt).toLocaleString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <span>{s.transactionNo}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-slate-400 print:hidden" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 print:hidden" />
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                            {getOrderTypeMeta(fin.orderType).shortLabel}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                            {s.items
                              .map((it) => `${it.quantity}x ${it.productName}`)
                              .join(', ')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                            {formatRupiah(fin.subtotal)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-amber-600 whitespace-nowrap">
                            {disc > 0 ? `-${formatRupiah(disc)}` : 'Rp 0'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                            {formatRupiah(fin.foodTotal)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-rose-600 whitespace-nowrap">
                            {fin.platformServiceFee > 0
                              ? `-${formatRupiah(fin.platformServiceFee)}`
                              : 'Rp 0'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-emerald-700 whitespace-nowrap">
                            {formatRupiah(inflow.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                            {getCashAccountShortLabel(inflow.account)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50/80 print:hidden">
                            <td colSpan={10} className="px-4 py-3">
                              <div className="text-[11px] space-y-1.5">
                                <div className="flex items-center justify-between font-bold text-slate-700 border-b border-slate-200 pb-1">
                                  <span>
                                    Detail Nota #{s.transactionNo} &middot; Kasir:{' '}
                                    {s.cashierName || '-'} &middot; Metode:{' '}
                                    {s.paymentMethod}
                                  </span>
                                  <span>
                                    Estimasi HPP Nota:{' '}
                                    {formatRupiah(s.totalHpp || 0)}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                  {s.items.map((item, idx) => (
                                    <div
                                      key={idx}
                                      className="flex justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200"
                                    >
                                      <span>
                                        {item.quantity}x {item.productName} (@{' '}
                                        {formatRupiah(item.sellingPrice)})
                                      </span>
                                      <span className="font-bold text-slate-900">
                                        {formatRupiah(item.subtotal)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              {filteredSales.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                    <td colSpan={4} className="py-3 px-3">
                      TOTAL ({formatNumber(filteredSales.length)} Transaksi &middot;{' '}
                      {formatNumber(salesSummary.totalItemsQty)} Porsi)
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {formatRupiah(salesSummary.grossFoodSales)}
                    </td>
                    <td className="py-3 px-3 text-right text-amber-700 whitespace-nowrap">
                      -{formatRupiah(salesSummary.totalFoodDiscount)}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {formatRupiah(salesSummary.foodOmzet)}
                    </td>
                    <td className="py-3 px-3 text-right text-rose-600 whitespace-nowrap">
                      -{formatRupiah(salesSummary.platformServiceFeeTotal)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700 whitespace-nowrap">
                      {formatRupiah(netSalesInflow)}
                    </td>
                    <td className="py-3 px-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 3. PENJUALAN PER MENU
  if (activeReport === 'penjualan_per_menu') {
    const totQty = salesByMenu.reduce((s, m) => s + m.qty, 0);
    const totGross = salesByMenu.reduce((s, m) => s + m.grossAmount, 0);
    const totDisc = salesByMenu.reduce((s, m) => s + m.discountAmount, 0);
    const totNet = salesByMenu.reduce((s, m) => s + m.netOmzet, 0);
    const totHpp = salesByMenu.reduce((s, m) => s + m.totalHpp, 0);
    const totMargin = salesByMenu.reduce((s, m) => s + m.margin, 0);

    return (
      <div className="space-y-4">
        {renderSalesFilterBar()}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] text-slate-500 block">
              Total Porsi Terjual
            </span>
            <span className="text-base font-black text-slate-900">
              {formatNumber(totQty)} Porsi ({salesByMenu.length} Menu)
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] text-slate-500 block">
              Omzet Bersih Menu
            </span>
            <span className="text-base font-black text-emerald-700">
              {formatRupiah(totNet)}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] text-slate-500 block">
              Total Estimasi HPP Menu
            </span>
            <span className="text-base font-black text-amber-700">
              {formatRupiah(totHpp)}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] text-slate-500 block">
              Total Margin Kotor Menu
            </span>
            <span className="text-base font-black text-indigo-700">
              {formatRupiah(totMargin)}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Nama Menu</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3 text-right">Qty Terjual</th>
                  <th className="py-2.5 px-3 text-right">Penjualan Kotor</th>
                  <th className="py-2.5 px-3 text-right">Diskon Item</th>
                  <th className="py-2.5 px-3 text-right">Omzet Bersih</th>
                  <th className="py-2.5 px-3 text-right">Estimasi HPP</th>
                  <th className="py-2.5 px-3 text-right">Margin Kotor</th>
                  <th className="py-2.5 px-3 text-right">% Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesByMenu.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Belum ada menu terjual pada periode ini.
                    </td>
                  </tr>
                ) : (
                  salesByMenu.map((m, idx) => {
                    const pct =
                      m.netOmzet > 0
                        ? ((m.margin / m.netOmzet) * 100).toFixed(1)
                        : '0.0';
                    return (
                      <tr key={m.productId || idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-slate-400 font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {m.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{m.sku}</td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                          {formatNumber(m.qty)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700">
                          {formatRupiah(m.grossAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-amber-600">
                          {m.discountAmount > 0
                            ? `-${formatRupiah(m.discountAmount)}`
                            : 'Rp 0'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                          {formatRupiah(m.netOmzet)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {formatRupiah(m.totalHpp)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-indigo-700">
                          {formatRupiah(m.margin)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                          {pct}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {salesByMenu.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                    <td colSpan={3} className="py-3 px-3">
                      TOTAL ({salesByMenu.length} Menu)
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatNumber(totQty)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatRupiah(totGross)}
                    </td>
                    <td className="py-3 px-3 text-right text-amber-700">
                      -{formatRupiah(totDisc)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700">
                      {formatRupiah(totNet)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatRupiah(totHpp)}
                    </td>
                    <td className="py-3 px-3 text-right text-indigo-700">
                      {formatRupiah(totMargin)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {totNet > 0
                        ? ((totMargin / totNet) * 100).toFixed(1)
                        : '0.0'}
                      %
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 4. PENJUALAN PER CHANNEL
  if (activeReport === 'penjualan_per_channel') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] text-slate-500 block">
              Penjualan Offline Masuk
            </span>
            <span className="text-base font-black text-slate-900">
              {formatRupiah(salesSummary.offlineSalesInflow)}
            </span>
            <span className="text-[10px] text-slate-400">
              Masuk Kas Kasir / QRIS / Bank
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] text-slate-500 block">
              Penjualan Online (Wallet)
            </span>
            <span className="text-base font-black text-emerald-700">
              {formatRupiah(salesSummary.onlineWalletSalesInflow)}
            </span>
            <span className="text-[10px] text-slate-400">
              Net Settlement GoFood/Grab/Shopee
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] text-slate-500 block">
              Total Potongan Biaya Platform
            </span>
            <span className="text-base font-black text-rose-600">
              -{formatRupiah(salesSummary.platformServiceFeeTotal)}
            </span>
            <span className="text-[10px] text-slate-400">
              Komisi &amp; layanan aplikasi
            </span>
          </div>
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
            <span className="text-[11px] font-bold text-emerald-800 block">
              Total Penjualan Bersih Masuk
            </span>
            <span className="text-base font-black text-emerald-700">
              {formatRupiah(netSalesInflow)}
            </span>
            <span className="text-[10px] text-emerald-700">
              100% Inflow Penjualan
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Channel Penjualan</th>
                  <th className="py-2.5 px-3 text-right">Jml Transaksi</th>
                  <th className="py-2.5 px-3 text-right">Porsi Terjual</th>
                  <th className="py-2.5 px-3 text-right">Harga Normal</th>
                  <th className="py-2.5 px-3 text-right">Diskon</th>
                  <th className="py-2.5 px-3 text-right">Omzet Makanan</th>
                  <th className="py-2.5 px-3 text-right">Biaya Platform</th>
                  <th className="py-2.5 px-3 text-right">
                    Penjualan Bersih Masuk
                  </th>
                  <th className="py-2.5 px-3">Akun Tujuan</th>
                  <th className="py-2.5 px-3 text-right">Porsi (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ORDER_TYPE_OPTIONS.map((ch) => {
                  const st = salesSummary.byChannel[ch.id];
                  const pct =
                    netSalesInflow > 0
                      ? ((st.ledgerInflow / netSalesInflow) * 100).toFixed(1)
                      : '0.0';
                  return (
                    <tr key={ch.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {ch.label}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-800">
                        {formatNumber(st.count)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        {formatNumber(st.qty)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700">
                        {formatRupiah(st.grossFood)}
                      </td>
                      <td className="py-3 px-3 text-right text-amber-600">
                        {st.foodDiscount > 0
                          ? `-${formatRupiah(st.foodDiscount)}`
                          : 'Rp 0'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {formatRupiah(st.foodOmzet)}
                      </td>
                      <td className="py-3 px-3 text-right text-rose-600">
                        {st.platformFee > 0
                          ? `-${formatRupiah(st.platformFee)}`
                          : 'Rp 0'}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-emerald-700">
                        {formatRupiah(st.ledgerInflow)}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {ch.isMarketplace
                          ? `Wallet ${ch.shortLabel}`
                          : 'Kas / QRIS / Bank'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-700">
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                  <td className="py-3 px-3">TOTAL SELURUH CHANNEL</td>
                  <td className="py-3 px-3 text-right">
                    {formatNumber(salesSummary.transactionCount)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {formatNumber(salesSummary.totalItemsQty)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {formatRupiah(salesSummary.grossFoodSales)}
                  </td>
                  <td className="py-3 px-3 text-right text-amber-700">
                    -{formatRupiah(salesSummary.totalFoodDiscount)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {formatRupiah(salesSummary.foodOmzet)}
                  </td>
                  <td className="py-3 px-3 text-right text-rose-600">
                    -{formatRupiah(salesSummary.platformServiceFeeTotal)}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-700">
                    {formatRupiah(netSalesInflow)}
                  </td>
                  <td className="py-3 px-3"></td>
                  <td className="py-3 px-3 text-right">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 5. PENJUALAN PER PERIODE
  if (activeReport === 'penjualan_per_periode') {
    return (
      <div className="space-y-4">
        {renderSalesFilterBar(true)}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">
                    Periode ({periodGroupMode === 'MONTHLY' ? 'Bulan' : 'Tanggal'})
                  </th>
                  <th className="py-2.5 px-3 text-right">Transaksi</th>
                  <th className="py-2.5 px-3 text-right">Porsi</th>
                  <th className="py-2.5 px-3 text-right">Harga Normal</th>
                  <th className="py-2.5 px-3 text-right">Diskon</th>
                  <th className="py-2.5 px-3 text-right">Omzet Makanan</th>
                  <th className="py-2.5 px-3 text-right">Fee Platform</th>
                  <th className="py-2.5 px-3 text-right">Penjualan Masuk</th>
                  <th className="py-2.5 px-3 text-right">Estimasi HPP</th>
                  <th className="py-2.5 px-3 text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesByPeriod.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Tidak ada data penjualan pada periode ini.
                    </td>
                  </tr>
                ) : (
                  salesByPeriod.map((p) => (
                    <tr key={p.periodKey} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {p.periodLabel}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold">
                        {formatNumber(p.txCount)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {formatNumber(p.qty)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {formatRupiah(p.grossFood)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-amber-600">
                        {p.discount > 0 ? `-${formatRupiah(p.discount)}` : 'Rp 0'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {formatRupiah(p.foodOmzet)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-600">
                        {p.platformFee > 0
                          ? `-${formatRupiah(p.platformFee)}`
                          : 'Rp 0'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-emerald-700">
                        {formatRupiah(p.netInflow)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {formatRupiah(p.hpp)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-indigo-700">
                        {formatRupiah(p.margin)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {salesByPeriod.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                    <td className="py-3 px-3">
                      TOTAL ({salesByPeriod.length}{' '}
                      {periodGroupMode === 'MONTHLY' ? 'Bulan' : 'Hari'})
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatNumber(salesSummary.transactionCount)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatNumber(salesSummary.totalItemsQty)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatRupiah(salesSummary.grossFoodSales)}
                    </td>
                    <td className="py-3 px-3 text-right text-amber-700">
                      -{formatRupiah(salesSummary.totalFoodDiscount)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatRupiah(salesSummary.foodOmzet)}
                    </td>
                    <td className="py-3 px-3 text-right text-rose-600">
                      -{formatRupiah(salesSummary.platformServiceFeeTotal)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700">
                      {formatRupiah(netSalesInflow)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatRupiah(salesSummary.totalHpp)}
                    </td>
                    <td className="py-3 px-3 text-right text-indigo-700">
                      {formatRupiah(salesSummary.grossProfitAccrual)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 6. DETAIL PEMBELIAN
  if (activeReport === 'detail_pembelian') {
    const totPO = purchaseData.filteredPurchases.reduce(
      (s, p) => s + (p.totalAmount || 0),
      0
    );
    const totPaid = purchaseData.filteredPurchases.reduce(
      (s, p) => s + (p.paidAmount || 0),
      0
    );
    const totRem = purchaseData.filteredPurchases.reduce(
      (s, p) => s + Math.max(0, p.remainingAmount || 0),
      0
    );

    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={purchaseStatusFilter}
              onChange={(e) => setPurchaseStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white text-slate-800"
            >
              <option value="ALL">Semua Status Bayar</option>
              <option value="LUNAS">Lunas</option>
              <option value="SEBAGIAN">Dibayar Sebagian</option>
              <option value="BELUM_DIBAYAR">Belum Dibayar (Hutang)</option>
            </select>

            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white text-slate-800"
            >
              <option value="ALL">Semua Supplier</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari no PO, supplier, barang..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] text-slate-500 block">
              Total Faktur Pembelian
            </span>
            <span className="text-base font-black text-slate-900">
              {formatRupiah(totPO)}
            </span>
            <span className="text-[10px] text-slate-400">
              {purchaseData.filteredPurchases.length} Faktur PO
            </span>
          </div>
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
            <span className="text-[11px] font-bold text-amber-900 block">
              Kas Keluar Pembelian (Cash Basis)
            </span>
            <span className="text-base font-black text-amber-700">
              {formatRupiah(totalPurchasePayment)}
            </span>
            <span className="text-[10px] text-amber-700">
              {purchaseData.purchaseMutations.length} transaksi pembayaran PO
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] text-slate-500 block">
              Terbayar pada Faktur Ini
            </span>
            <span className="text-base font-black text-emerald-700">
              {formatRupiah(totPaid)}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] text-slate-500 block">
              Sisa Hutang Faktur
            </span>
            <span className="text-base font-black text-rose-600">
              {formatRupiah(totRem)}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">No. PO / Invoice</th>
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3">Rincian Item</th>
                  <th className="py-2.5 px-3 text-right">Total Faktur</th>
                  <th className="py-2.5 px-3 text-right">Sudah Dibayar</th>
                  <th className="py-2.5 px-3 text-right">Sisa Hutang</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseData.filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Tidak ada transaksi pembelian pada periode ini.
                    </td>
                  </tr>
                ) : (
                  purchaseData.filteredPurchases.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                        {p.date ||
                          new Date(p.createdAt).toLocaleDateString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                        {p.purchaseNo}
                        {p.invoiceNo ? ` (${p.invoiceNo})` : ''}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {p.vendorName || p.supplier || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                        {(p.items || [])
                          .map(
                            (it) =>
                              `${it.quantity} ${it.unit} ${it.targetName}`
                          )
                          .join(', ')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatRupiah(p.totalAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                        {formatRupiah(p.paidAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-600 whitespace-nowrap">
                        {formatRupiah(p.remainingAmount)}
                      </td>
                      <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                        <span
                          className={
                            p.paymentStatus === 'LUNAS'
                              ? 'text-emerald-700'
                              : p.paymentStatus === 'SEBAGIAN'
                              ? 'text-amber-700'
                              : 'text-rose-600'
                          }
                        >
                          {p.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {purchaseData.filteredPurchases.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                    <td colSpan={4} className="py-3 px-3">
                      TOTAL ({purchaseData.filteredPurchases.length} Faktur PO)
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatRupiah(totPO)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700">
                      {formatRupiah(totPaid)}
                    </td>
                    <td className="py-3 px-3 text-right text-rose-600">
                      {formatRupiah(totRem)}
                    </td>
                    <td className="py-3 px-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 7. PEMBELIAN PER PRODUK / BAHAN
  if (activeReport === 'pembelian_per_produk') {
    const totalSpent = purchaseData.purchasesByProduct.reduce(
      (s, i) => s + i.totalSubtotal,
      0
    );

    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 print:hidden">
          <div className="flex items-center gap-1.5">
            {[
              { id: 'ALL', label: 'Semua Jenis' },
              { id: 'BAHAN_BAKU', label: 'Bahan Baku' },
              { id: 'KEMASAN', label: 'Kemasan' },
              { id: 'BARANG_SIAP_JUAL', label: 'Barang Siap Jual' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPurchaseItemTypeFilter(t.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  purchaseItemTypeFilter === t.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama bahan / produk..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs"
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Nama Bahan / Produk</th>
                  <th className="py-2.5 px-3">Jenis</th>
                  <th className="py-2.5 px-3 text-right">Frekuensi Beli</th>
                  <th className="py-2.5 px-3 text-right">Total Qty Beli</th>
                  <th className="py-2.5 px-3 text-right">Total Masuk Stok</th>
                  <th className="py-2.5 px-3 text-right">
                    Harga Beli Rata-rata
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    Total Nilai Pembelian
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseData.purchasesByProduct.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Tidak ada item pembelian pada periode ini.
                    </td>
                  </tr>
                ) : (
                  purchaseData.purchasesByProduct.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-400 font-bold">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {it.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {it.itemType}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold">
                        {it.frequency}x
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                        {formatNumber(it.totalBuyQty)} {it.buyUnit}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {formatNumber(it.totalStockAdded)} {it.stockUnit}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        {formatRupiah(
                          it.totalBuyQty > 0
                            ? Math.round(it.totalSubtotal / it.totalBuyQty)
                            : 0
                        )}{' '}
                        / {it.buyUnit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                        {formatRupiah(it.totalSubtotal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {purchaseData.purchasesByProduct.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                    <td colSpan={7} className="py-3 px-3">
                      TOTAL NILAI BELANJA ITEM ({purchaseData.purchasesByProduct.length}{' '}
                      Item)
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatRupiah(totalSpent)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 8. PEMBELIAN PER SUPPLIER
  if (activeReport === 'pembelian_per_supplier') {
    const list = purchaseData.purchasesBySupplier;
    const totPO = list.reduce((s, x) => s + x.poCount, 0);
    const totAmt = list.reduce((s, x) => s + x.totalAmount, 0);
    const totPaid = list.reduce((s, x) => s + x.paidAmount, 0);
    const totRem = list.reduce((s, x) => s + x.remainingAmount, 0);

    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Nama Supplier / Vendor</th>
                  <th className="py-2.5 px-3">Kontak</th>
                  <th className="py-2.5 px-3 text-right">Jumlah PO</th>
                  <th className="py-2.5 px-3 text-right">Total Pembelian</th>
                  <th className="py-2.5 px-3 text-right">Sudah Dibayar</th>
                  <th className="py-2.5 px-3 text-right">Sisa Hutang</th>
                  <th className="py-2.5 px-3">Status Kewajiban</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Belum ada transaksi pembelian per supplier pada periode ini.
                    </td>
                  </tr>
                ) : (
                  list.map((s, idx) => (
                    <tr key={s.vendorName} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-400 font-bold">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {s.vendorName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{s.phone}</td>
                      <td className="py-2.5 px-3 text-right font-semibold">
                        {formatNumber(s.poCount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {formatRupiah(s.totalAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                        {formatRupiah(s.paidAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                        {formatRupiah(s.remainingAmount)}
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        <span
                          className={
                            s.remainingAmount <= 0
                              ? 'text-emerald-700'
                              : 'text-rose-600'
                          }
                        >
                          {s.remainingAmount <= 0 ? 'LUNAS' : 'ADA HUTANG'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {list.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                    <td colSpan={3} className="py-3 px-3">
                      TOTAL ({list.length} Supplier)
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatNumber(totPO)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatRupiah(totAmt)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700">
                      {formatRupiah(totPaid)}
                    </td>
                    <td className="py-3 px-3 text-right text-rose-600">
                      {formatRupiah(totRem)}
                    </td>
                    <td className="py-3 px-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 9. HUTANG SUPPLIER
  if (activeReport === 'hutang_supplier') {
    const list = purchaseData.unpaidPurchases;
    const totFaktur = list.reduce((s, p) => s + (p.totalAmount || 0), 0);
    const totPaid = list.reduce((s, p) => s + (p.paidAmount || 0), 0);
    const totDebt = list.reduce(
      (s, p) => s + Math.max(0, p.remainingAmount || 0),
      0
    );

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5">
            <span className="text-[11px] text-slate-500 block">
              Faktur Belum Lunas
            </span>
            <span className="text-lg font-black text-slate-900">
              {formatNumber(list.length)} Faktur PO
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3.5">
            <span className="text-[11px] text-slate-500 block">
              Total Sudah Dicicil / Dibayar
            </span>
            <span className="text-lg font-black text-emerald-700">
              {formatRupiah(totPaid)}
            </span>
          </div>
          <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5">
            <span className="text-[11px] font-bold text-rose-800 block">
              Total Sisa Hutang Supplier
            </span>
            <span className="text-lg font-black text-rose-600">
              {formatRupiah(totDebt)}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Tanggal PO</th>
                  <th className="py-2.5 px-3">Jatuh Tempo</th>
                  <th className="py-2.5 px-3">No. PO</th>
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3 text-right">Total Faktur</th>
                  <th className="py-2.5 px-3 text-right">Sudah Dibayar</th>
                  <th className="py-2.5 px-3 text-right">Sisa Hutang</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Tidak ada hutang supplier yang belum lunas. Semua PO sudah lunas!
                    </td>
                  </tr>
                ) : (
                  list.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-600">
                        {p.date ||
                          new Date(p.createdAt).toLocaleDateString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-amber-700">
                        {p.dueDate || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {p.purchaseNo}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {p.vendorName || p.supplier || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        {formatRupiah(p.totalAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-700">
                        {formatRupiah(p.paidAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-rose-600">
                        {formatRupiah(p.remainingAmount)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-rose-600">
                        {p.paymentStatus}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {list.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                    <td colSpan={4} className="py-3 px-3">
                      TOTAL KEWAJIBAN HUTANG ({list.length} Faktur)
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatRupiah(totFaktur)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700">
                      {formatRupiah(totPaid)}
                    </td>
                    <td className="py-3 px-3 text-right text-rose-600">
                      {formatRupiah(totDebt)}
                    </td>
                    <td className="py-3 px-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
