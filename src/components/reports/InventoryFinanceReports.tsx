import React from 'react';
import { CanonicalCashAccount, MovementType } from '../../types';
import { formatNumber, formatRupiah } from '../../utils/formatters';
import {
  CANONICAL_CASH_ACCOUNTS,
  getCashAccountShortLabel,
} from '../../utils/cashLedger';
import { EXPENSE_CATEGORY_LABELS, ReportId } from './reportTypes';
import { isInitialStockMovement, useReportData } from './useReportData';
import { ProfitLossReport } from './ProfitLossReport';
import {
  ArrowRightLeft,
  Search,
  UserCheck,
  Wallet,
} from 'lucide-react';

interface InventoryFinanceReportsProps {
  activeReport: ReportId;
  data: ReturnType<typeof useReportData>;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  stockTypeFilter: 'ALL' | 'BAHAN_BAKU' | 'KEMASAN' | 'BARANG_SIAP_JUAL';
  setStockTypeFilter: (
    v: 'ALL' | 'BAHAN_BAKU' | 'KEMASAN' | 'BARANG_SIAP_JUAL'
  ) => void;
  stockStatusFilter: 'ALL' | 'AMAN' | 'MENIPIS' | 'KRITIS' | 'HABIS';
  setStockStatusFilter: (
    v: 'ALL' | 'AMAN' | 'MENIPIS' | 'KRITIS' | 'HABIS'
  ) => void;
  movementTypeFilter: 'ALL' | MovementType;
  setMovementTypeFilter: (v: 'ALL' | MovementType) => void;
  expenseCategoryFilter: string;
  setExpenseCategoryFilter: (v: string) => void;
  cashAccountFilter: 'ALL' | CanonicalCashAccount;
  setCashAccountFilter: (v: 'ALL' | CanonicalCashAccount) => void;
}

export const InventoryFinanceReports: React.FC<InventoryFinanceReportsProps> = ({
  activeReport,
  data,
  searchQuery,
  setSearchQuery,
  stockTypeFilter,
  setStockTypeFilter,
  stockStatusFilter,
  setStockStatusFilter,
  movementTypeFilter,
  setMovementTypeFilter,
  expenseCategoryFilter,
  setExpenseCategoryFilter,
  cashAccountFilter,
  setCashAccountFilter,
}) => {
  const {
    salesSummary,
    purchaseData,
    expenseData,
    transferAndOwnerSummary,
    inventoryData,
    cashAccountsReport,
    cashBalanceSummary,
    netSalesInflow,
    totalPurchasePayment,
    totalOperationalExpense,
    netOperationalCash,
    totalOwnerWithdrawal,
    remainingBusinessCash,
    grossProfit,
    netProfitAccrual,
  } = data;

  // 10. RINGKASAN STOK (PERSEDIAAN)
  if (activeReport === 'ringkasan_stok') {
    const rows = inventoryData.filteredStockRows;
    const totalVal = rows.reduce((s, r) => s + r.valuation, 0);
    const totalOpeningVal = rows.reduce((s, r) => s + r.openingValue, 0);
    const totalPurchaseVal = rows.reduce((s, r) => s + r.purchaseValue, 0);
    const totalUsageVal = rows.reduce((s, r) => s + r.usageValue, 0);
    const totalAdjVal = rows.reduce((s, r) => s + r.adjustmentValue, 0);
    const totalClosingVal = rows.reduce((s, r) => s + r.closingValue, 0);
    const critCount = rows.filter(
      (r) => r.status === 'KRITIS' || r.status === 'HABIS'
    ).length;

    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={stockTypeFilter}
              onChange={(e) => setStockTypeFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white text-slate-800"
            >
              <option value="ALL">Semua Jenis Item</option>
              <option value="BAHAN_BAKU">Bahan Baku</option>
              <option value="KEMASAN">Kemasan</option>
              <option value="BARANG_SIAP_JUAL">Barang Siap Jual</option>
            </select>

            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white text-slate-800"
            >
              <option value="ALL">Semua Status Stok</option>
              <option value="AMAN">Aman</option>
              <option value="MENIPIS">Menipis</option>
              <option value="KRITIS">Kritis</option>
              <option value="HABIS">Habis</option>
            </select>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode atau nama item..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs"
            />
          </div>
        </div>

        {/* Ringkasan Mutasi Nilai Persediaan (Saldo Awal + Pembelian - Pemakaian +/- Penyesuaian = Saldo Akhir) */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">
              RINGKASAN PERSEDIAAN ({rows.length} Item &middot; {critCount} Kritis/Habis)
            </span>
            <span className="text-[11px] text-slate-500 font-semibold">
              Saldo Akhir = Saldo Awal + Pembelian &minus; Pemakaian &plusmn; Penyesuaian
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
            <div className="p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">
                Saldo Awal Persediaan
              </span>
              <span className="text-sm sm:text-base font-black text-slate-900 mt-0.5 block">
                {formatRupiah(totalOpeningVal)}
              </span>
              <span className="text-[10px] text-slate-400">
                Stok awal &times; cost/unit
              </span>
            </div>
            <div className="p-3">
              <span className="text-[10px] font-bold text-emerald-700 uppercase block">
                + Pembelian
              </span>
              <span className="text-sm sm:text-base font-black text-emerald-700 mt-0.5 block">
                {formatRupiah(totalPurchaseVal)}
              </span>
              <span className="text-[10px] text-slate-400">
                Pembelian PO periode ini
              </span>
            </div>
            <div className="p-3">
              <span className="text-[10px] font-bold text-amber-700 uppercase block">
                &minus; Pemakaian Bahan / HPP
              </span>
              <span className="text-sm sm:text-base font-black text-amber-700 mt-0.5 block">
                ({formatRupiah(totalUsageVal)})
              </span>
              <span className="text-[10px] text-slate-400">
                Produksi &amp; penjualan
              </span>
            </div>
            <div className="p-3">
              <span className="text-[10px] font-bold text-slate-600 uppercase block">
                &plusmn; Penyesuaian Stok
              </span>
              <span className="text-sm sm:text-base font-black text-slate-800 mt-0.5 block">
                {formatRupiah(totalAdjVal)}
              </span>
              <span className="text-[10px] text-slate-400">
                Opname / koreksi manual
              </span>
            </div>
            <div className="p-3 bg-slate-50/60">
              <span className="text-[10px] font-bold text-slate-900 uppercase block">
                = Saldo Akhir Persediaan
              </span>
              <span className="text-sm sm:text-base font-black text-emerald-700 mt-0.5 block">
                {formatRupiah(totalClosingVal)}
              </span>
              <span className="text-[10px] text-slate-500">
                Nilai stok tersisa saat ini
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Kode</th>
                  <th className="py-2.5 px-3">Nama Bahan / Produk</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3 text-right">Saldo Awal</th>
                  <th className="py-2.5 px-3 text-right">+ Pembelian</th>
                  <th className="py-2.5 px-3 text-right">&minus; Pemakaian</th>
                  <th className="py-2.5 px-3 text-right">&plusmn; Penyesuaian</th>
                  <th className="py-2.5 px-3 text-right">Saldo Akhir</th>
                  <th className="py-2.5 px-3">Satuan</th>
                  <th className="py-2.5 px-3 text-right">Cost / Unit</th>
                  <th className="py-2.5 px-3 text-right">Nilai Persediaan</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400">
                      Tidak ada item stok yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-500">{r.code}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {r.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {r.categoryLabel}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                        {formatNumber(r.openingQty)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">
                        {r.purchaseQty > 0 ? `+${formatNumber(r.purchaseQty)}` : '0'}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-amber-700">
                        {r.usageQty > 0 ? `-${formatNumber(r.usageQty)}` : '0'}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">
                        {r.adjustmentQty > 0
                          ? `+${formatNumber(r.adjustmentQty)}`
                          : formatNumber(r.adjustmentQty)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold tabular-nums text-slate-900">
                        {formatNumber(r.stock)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{r.unit}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                        {formatRupiah(r.costPerUnit)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums text-emerald-700">
                        {formatRupiah(r.valuation)}
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        <span
                          className={
                            r.status === 'AMAN'
                              ? 'text-emerald-700'
                              : r.status === 'MENIPIS'
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                    <td colSpan={10} className="py-3 px-3">
                      TOTAL NILAI PERSEDIAAN AKHIR ({rows.length} Item)
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700">
                      {formatRupiah(totalVal)}
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

  // 11. PERGERAKAN STOK
  if (activeReport === 'pergerakan_stok') {
    const movs = inventoryData.periodMovements;

    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 print:hidden">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: 'Semua Mutasi' },
              { id: 'PURCHASE', label: 'Pembelian (+)' },
              { id: 'PRODUCTION', label: 'Produksi' },
              { id: 'SALE', label: 'Penjualan (-)' },
              { id: 'ADJUSTMENT', label: 'Penyesuaian' },
              { id: 'WASTE', label: 'Waste / Rusak' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMovementTypeFilter(t.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  movementTypeFilter === t.id
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
              placeholder="Cari item, referensi, catatan..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs"
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Nama Bahan / Produk</th>
                  <th className="py-2.5 px-3">Jenis Mutasi</th>
                  <th className="py-2.5 px-3">Referensi</th>
                  <th className="py-2.5 px-3 text-right">Perubahan Qty</th>
                  <th className="py-2.5 px-3 text-right">Saldo Akhir</th>
                  <th className="py-2.5 px-3">Satuan</th>
                  <th className="py-2.5 px-3">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Tidak ada pergerakan stok pada periode ini.
                    </td>
                  </tr>
                ) : (
                  movs.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                        {new Date(m.createdAt).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {m.entityName || m.ingredientName || m.productName || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">
                        {isInitialStockMovement(m) ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">
                            SALDO AWAL (ADJUSTMENT)
                          </span>
                        ) : (
                          m.type
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {m.referenceId || '-'}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-extrabold ${
                          m.changeAmount >= 0
                            ? 'text-emerald-700'
                            : 'text-rose-600'
                        }`}
                      >
                        {m.changeAmount > 0 ? '+' : ''}
                        {formatNumber(m.changeAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                        {formatNumber(m.balanceAfter)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {m.stockUnit || m.unit || 'pcs'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                        {m.notes || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 12. STOK PRODUK HASIL PRODUKSI
  if (activeReport === 'stok_produk_produksi') {
    const prods = inventoryData.productionProducts;
    const batches = inventoryData.periodProductions;
    const activeBatches = batches.filter((b) => b.status !== 'CANCELLED');
    const totalBatchCost = activeBatches.reduce((s, b) => s + (b.totalHpp || 0), 0);

    return (
      <div className="space-y-5">
        {/* Table 1: Posisi Stok Produk Hasil Produksi Saat Ini */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
              1. Posisi Stok Produk Hasil Produksi Saat Ini
            </h3>
            <span className="text-xs font-bold text-emerald-700">
              Total Nilai: {formatRupiah(inventoryData.totalProductionValuation)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Produk Hasil Produksi</th>
                  <th className="py-2.5 px-3 text-right">Stok Saat Ini</th>
                  <th className="py-2.5 px-3">Satuan</th>
                  <th className="py-2.5 px-3 text-right">HPP / Unit</th>
                  <th className="py-2.5 px-3 text-right">Nilai Stok</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prods.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      Belum ada produk hasil produksi.
                    </td>
                  </tr>
                ) : (
                  prods.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-500">{p.sku}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {p.name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                        {formatNumber(p.stock)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{p.unit}</td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        {formatRupiah(p.hppPerUnit)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                        {formatRupiah(p.valuation)}
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        <span
                          className={
                            p.status === 'AMAN'
                              ? 'text-emerald-700'
                              : p.status === 'MENIPIS'
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Riwayat Batch Produksi pada Periode Ini */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
              2. Riwayat Batch Produksi Dapur (Periode Terpilih)
            </h3>
            <span className="text-xs font-bold text-slate-700">
              {activeBatches.length} Aktif ({batches.length - activeBatches.length} Dibatalkan) &middot; Total Biaya:{' '}
              {formatRupiah(totalBatchCost)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Produk</th>
                  <th className="py-2.5 px-3 text-right">Jml Batch</th>
                  <th className="py-2.5 px-3 text-right">Total Hasil</th>
                  <th className="py-2.5 px-3 text-right">HPP / Unit</th>
                  <th className="py-2.5 px-3 text-right">
                    Total Biaya Produksi
                  </th>
                  <th className="py-2.5 px-3">Petugas / Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      Tidak ada eksekusi batch produksi pada periode ini.
                    </td>
                  </tr>
                ) : (
                  batches.map((pr) => {
                    const isCancelled = pr.status === 'CANCELLED';
                    return (
                      <tr
                        key={pr.id}
                        className={`hover:bg-slate-50 ${
                          isCancelled ? 'bg-rose-50/40 text-slate-400' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-slate-600">
                          {pr.date ||
                            new Date(pr.createdAt).toLocaleDateString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          <span className={isCancelled ? 'line-through text-slate-400' : ''}>
                            {pr.productName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold">
                          {formatNumber(pr.batchQty)} batch
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                          <span className={isCancelled ? 'line-through text-slate-400' : ''}>
                            {formatNumber(pr.totalProduced)}{' '}
                            {pr.yieldUnit || 'porsi'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700">
                          {formatRupiah(pr.hppPerUnit)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          <span className={isCancelled ? 'line-through text-rose-500' : ''}>
                            {formatRupiah(pr.totalHpp)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {isCancelled ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700">
                              DIBATALKAN
                            </span>
                          ) : (
                            pr.createdByName || pr.userName || pr.createdBy || '-'
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 13. PEMAKAIAN BAHAN
  if (activeReport === 'pemakaian_bahan') {
    const list = inventoryData.materialConsumptions;
    const totalVal = list.reduce((s, c) => s + c.estimatedCost, 0);

    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Nama Bahan / Kemasan</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3 text-right">Terpakai Produksi</th>
                  <th className="py-2.5 px-3 text-right">Terpakai Penjualan</th>
                  <th className="py-2.5 px-3 text-right">Waste / Opname</th>
                  <th className="py-2.5 px-3 text-right">Total Terpakai</th>
                  <th className="py-2.5 px-3">Satuan</th>
                  <th className="py-2.5 px-3 text-right">HPP / Unit</th>
                  <th className="py-2.5 px-3 text-right">
                    Estimasi Nilai Pemakaian
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-8 text-center text-slate-400"
                    >
                      Belum ada catatan pemakaian bahan pada periode ini.
                    </td>
                  </tr>
                ) : (
                  list.map((c, idx) => (
                    <tr key={c.id || idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-400 font-bold">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {c.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {c.categoryLabel}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        {formatNumber(c.usedInProduction)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        {formatNumber(c.usedInSales)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-600">
                        {formatNumber(c.usedInWaste)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                        {formatNumber(c.totalUsed)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{c.unit}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {formatRupiah(c.costPerUnit)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-700">
                        {formatRupiah(c.estimatedCost)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {list.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                    <td colSpan={9} className="py-3 px-3">
                      TOTAL ESTIMASI NILAI PEMAKAIAN BAHAN ({list.length} Item)
                    </td>
                    <td className="py-3 px-3 text-right text-amber-700">
                      {formatRupiah(totalVal)}
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

  // 14. LAPORAN LABA RUGI (PROFIT & LOSS STATEMENT - KLEDO FORMAT)
  if (activeReport === 'laba_rugi') {
    return (
      <ProfitLossReport
        profitLoss={data.profitLoss}
        comparisonProfitLoss={data.comparisonProfitLoss}
        periodLabel={data.periodLabel}
      />
    );
  }

  // 15. LAPORAN ARUS KAS (CASH BASIS - ARUS UANG NYATA)
  if (activeReport === 'arus_kas') {
    return (
      <div className="space-y-4">
        {/* Top Cash Basis KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5">
            <span className="text-[11px] font-bold text-emerald-700 uppercase block">
              Penjualan Bersih Masuk
            </span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">
              {formatRupiah(netSalesInflow)}
            </span>
            <span className="text-[10px] text-slate-400">
              {salesSummary.transactionCount} transaksi selesai
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5">
            <span className="text-[11px] font-bold text-amber-700 uppercase block">
              Pembayaran Pembelian
            </span>
            <span className="text-lg font-black text-amber-700 mt-0.5 block">
              -{formatRupiah(totalPurchasePayment)}
            </span>
            <span className="text-[10px] text-slate-400">
              {purchaseData.purchaseMutations.length} pembayaran PO nyata
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5">
            <span className="text-[11px] font-bold text-rose-600 uppercase block">
              Biaya Operasional
            </span>
            <span className="text-lg font-black text-rose-600 mt-0.5 block">
              -{formatRupiah(totalOperationalExpense)}
            </span>
            <span className="text-[10px] text-slate-400">
              {expenseData.standaloneExpenses.length} pengeluaran operasional
            </span>
          </div>

          <div className="bg-slate-900 text-white rounded-xl p-3.5">
            <span className="text-[11px] font-bold text-orange-400 uppercase block">
              Kas Operasional Bersih
            </span>
            <span className="text-lg font-black text-white mt-0.5 block">
              {formatRupiah(netOperationalCash)}
            </span>
            <span className="text-[10px] text-slate-300">
              Kas Usaha Tersisa: {formatRupiah(remainingBusinessCash)}
            </span>
          </div>
        </div>

        {/* Main Cash Basis Statement */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between text-xs font-bold uppercase tracking-wider">
            <span>Komponen Arus Kas Nyata (Cash Basis &middot; Tanpa HPP)</span>
            <span>Arus Uang (Rp)</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {/* 1. Inflow Penjualan */}
            <div className="px-5 py-2.5 bg-slate-50 font-extrabold text-slate-800 uppercase">
              1. Arus Kas Masuk dari Penjualan (Penjualan Bersih Masuk)
            </div>
            <div className="px-5 py-2.5 flex justify-between pl-8">
              <span className="text-slate-600">
                Penjualan Offline (Masuk ke Kas Kasir / Kas QRIS / Bank)
              </span>
              <span className="font-bold text-slate-900">
                {formatRupiah(salesSummary.offlineSalesInflow)}
              </span>
            </div>
            <div className="px-5 py-2.5 flex justify-between pl-8">
              <span className="text-slate-600">
                Penjualan Online Marketplace (Masuk ke Wallet GoFood / GrabFood
                / ShopeeFood - Net)
              </span>
              <span className="font-bold text-slate-900">
                {formatRupiah(salesSummary.onlineWalletSalesInflow)}
              </span>
            </div>
            <div className="px-5 py-3 flex justify-between bg-emerald-50/70 font-extrabold text-emerald-900">
              <span>TOTAL PENJUALAN BERSIH MASUK</span>
              <span className="text-sm">{formatRupiah(netSalesInflow)}</span>
            </div>

            {/* 2. Pembayaran Pembelian */}
            <div className="px-5 py-2.5 bg-slate-50 font-extrabold text-slate-800 uppercase">
              2. Arus Kas Keluar untuk Pembelian (Cash Basis)
            </div>
            <div className="px-5 py-2.5 flex justify-between pl-8">
              <div>
                <span className="text-slate-700 font-semibold block">
                  Pembayaran Pembelian Bahan &amp; Produk (PO Dibayar &amp;
                  Pelunasan Hutang)
                </span>
                <span className="text-[11px] text-slate-400">
                  Nilai PO periode ini:{' '}
                  {formatRupiah(purchaseData.periodTotalPO)} &middot; Sisa
                  hutang belum dibayar:{' '}
                  {formatRupiah(purchaseData.periodUnpaidDebt)} (tidak dihitung
                  kas keluar)
                </span>
              </div>
              <span className="font-bold text-amber-700">
                -{formatRupiah(totalPurchasePayment)}
              </span>
            </div>

            {/* 3. Biaya Operasional */}
            <div className="px-5 py-2.5 bg-slate-50 font-extrabold text-slate-800 uppercase">
              3. Arus Kas Keluar untuk Biaya Operasional
            </div>
            {Object.keys(expenseData.byCategory).length === 0 ? (
              <div className="px-5 py-2.5 pl-8 text-slate-400">
                Tidak ada pengeluaran operasional pada periode ini.
              </div>
            ) : (
              Object.entries(expenseData.byCategory)
                .sort((a, b) => b[1].amount - a[1].amount)
                .map(([cat, info]) => (
                  <div
                    key={cat}
                    className="px-5 py-2.5 flex justify-between pl-8"
                  >
                    <span className="text-slate-600">
                      {EXPENSE_CATEGORY_LABELS[cat] || cat} ({info.count}x)
                    </span>
                    <span className="font-semibold text-rose-600">
                      -{formatRupiah(info.amount)}
                    </span>
                  </div>
                ))
            )}
            <div className="px-5 py-2.5 flex justify-between bg-rose-50/40 font-extrabold text-rose-800">
              <span>TOTAL BIAYA OPERASIONAL DIBAYAR</span>
              <span>-{formatRupiah(totalOperationalExpense)}</span>
            </div>

            {/* HASIL UTAMA: KAS OPERASIONAL BERSIH */}
            <div className="px-5 py-3.5 flex items-center justify-between bg-slate-900 text-white font-black">
              <div>
                <span className="text-xs uppercase tracking-wider text-orange-400 block">
                  KAS OPERASIONAL BERSIH
                </span>
                <span className="text-[11px] font-normal text-slate-300">
                  Penjualan Bersih Masuk &minus; Pembayaran Pembelian &minus;
                  Biaya Operasional (Tanpa Dikurangi HPP)
                </span>
              </div>
              <span className="text-base">
                {formatRupiah(netOperationalCash)}
              </span>
            </div>

            {/* 4. Pengambilan Owner */}
            <div className="px-5 py-3 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <div>
                  <span className="font-bold text-slate-800 block">
                    Pengambilan Owner (Owner Withdrawal)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Setor/tarik kas ke Kas Owner (
                    {transferAndOwnerSummary.ownerWithdrawalCount}x) &middot;
                    Bukan biaya operasional
                  </span>
                </div>
              </div>
              <span className="font-extrabold text-indigo-700">
                -{formatRupiah(totalOwnerWithdrawal)}
              </span>
            </div>

            {/* KAS USAHA TERSISA */}
            <div className="px-5 py-3.5 flex items-center justify-between bg-orange-50 font-black text-slate-900">
              <div>
                <span className="text-xs uppercase tracking-wider text-[#FF641F] block">
                  KAS USAHA TERSISA PERIODE INI
                </span>
                <span className="text-[11px] font-normal text-slate-500">
                  Kas Operasional Bersih dikurangi Pengambilan Owner
                </span>
              </div>
              <span className="text-base text-[#FF641F]">
                {formatRupiah(remainingBusinessCash)}
              </span>
            </div>
          </div>
        </div>

        {/* Non-Revenue Settlement & Internal Transfer Info */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
          <div className="flex items-center gap-2 font-extrabold text-slate-900">
            <ArrowRightLeft className="w-4 h-4 text-blue-600" />
            <span>
              Informasi Mutasi Settlement &amp; Transfer Internal (Anti
              Double-Count)
            </span>
          </div>
          <p className="text-slate-500">
            Perpindahan dana antar rekening milik perusahaan berikut{' '}
            <strong>tidak dihitung ulang</strong> sebagai penjualan baru maupun
            pengeluaran:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex justify-between">
              <span className="text-slate-600">Settlement Wallet &rarr; Bank</span>
              <span className="font-bold text-slate-900">
                {formatRupiah(transferAndOwnerSummary.platformSettlementTotal)}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex justify-between">
              <span className="text-slate-600">Pencairan QRIS &rarr; Bank</span>
              <span className="font-bold text-slate-900">
                {formatRupiah(transferAndOwnerSummary.qrisSettlementTotal)}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex justify-between">
              <span className="text-slate-600">Transfer Antar Kas/Bank</span>
              <span className="font-bold text-slate-900">
                {formatRupiah(transferAndOwnerSummary.internalTransferTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 16. PENGELUARAN OPERASIONAL
  if (activeReport === 'pengeluaran') {
    const list = expenseData.filteredExpenses;
    const totalFiltered = list.reduce((s, e) => s + (e.amount || 0), 0);

    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 print:hidden">
          <select
            value={expenseCategoryFilter}
            onChange={(e) => setExpenseCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white text-slate-800"
          >
            <option value="ALL">Semua Kategori Pengeluaran</option>
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>

          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari keterangan pengeluaran..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs"
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3">Keterangan / Catatan</th>
                  <th className="py-2.5 px-3">Sumber Kas/Rekening</th>
                  <th className="py-2.5 px-3">Dicatat Oleh</th>
                  <th className="py-2.5 px-3 text-right">Nominal (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Tidak ada catatan pengeluaran operasional pada periode ini.
                    </td>
                  </tr>
                ) : (
                  list.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {e.date ||
                          new Date(e.createdAt).toLocaleDateString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {EXPENSE_CATEGORY_LABELS[e.category] || e.category}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {e.note || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {getCashAccountShortLabel(e.paymentSource)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {e.createdBy || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-rose-600 whitespace-nowrap">
                        {formatRupiah(e.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {list.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                    <td colSpan={5} className="py-3 px-3">
                      TOTAL PENGELUARAN OPERASIONAL ({list.length} Catatan)
                    </td>
                    <td className="py-3 px-3 text-right text-rose-600">
                      {formatRupiah(totalFiltered)}
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

  // 17. KAS & REKENING
  if (activeReport === 'kas_rekening') {
    const { accountStats, filteredMutations } = cashAccountsReport;

    return (
      <div className="space-y-5">
        {/* Table 1: Ringkasan Saldo & Mutasi 9 Rekening/Wallet */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                1. Posisi Saldo &amp; Arus Kas per Rekening / Wallet
              </h3>
            </div>
            <span className="text-xs font-bold text-emerald-700">
              Total Likuiditas:{' '}
              {formatRupiah(cashBalanceSummary.totalSaldoDanPlatform)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Nama Akun / Rekening</th>
                  <th className="py-2.5 px-3">Keterangan</th>
                  <th className="py-2.5 px-3 text-right">
                    Uang Masuk (Periode)
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    Uang Keluar (Periode)
                  </th>
                  <th className="py-2.5 px-3 text-right">Perubahan Bersih</th>
                  <th className="py-2.5 px-3 text-right">Saldo Saat Ini</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accountStats.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {acc.label}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {acc.subtitle}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                      +{formatRupiah(acc.totalIn)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-rose-600">
                      -{formatRupiah(acc.totalOut)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-bold ${
                        acc.netPeriodChange >= 0
                          ? 'text-slate-900'
                          : 'text-rose-600'
                      }`}
                    >
                      {formatRupiah(acc.netPeriodChange)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                      {formatRupiah(acc.currentBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                  <td colSpan={2} className="py-3 px-3">
                    TOTAL SELURUH KAS, BANK &amp; WALLET PLATFORM
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-700">
                    +
                    {formatRupiah(
                      accountStats.reduce((s, a) => s + a.totalIn, 0)
                    )}
                  </td>
                  <td className="py-3 px-3 text-right text-rose-600">
                    -
                    {formatRupiah(
                      accountStats.reduce((s, a) => s + a.totalOut, 0)
                    )}
                  </td>
                  <td className="py-3 px-3"></td>
                  <td className="py-3 px-3 text-right text-emerald-700">
                    {formatRupiah(cashBalanceSummary.totalSaldoDanPlatform)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Table 2: Riwayat Mutasi Kas & Rekening */}
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 print:hidden">
            <select
              value={cashAccountFilter}
              onChange={(e) => setCashAccountFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white text-slate-800"
            >
              <option value="ALL">Semua Akun Kas &amp; Rekening</option>
              {CANONICAL_CASH_ACCOUNTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>

            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari mutasi kas..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70">
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                2. Riwayat Mutasi Kas &amp; Rekening ({filteredMutations.length}{' '}
                Catatan)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Waktu</th>
                    <th className="py-2.5 px-3">Akun</th>
                    <th className="py-2.5 px-3">Jenis</th>
                    <th className="py-2.5 px-3">Judul &amp; Catatan</th>
                    <th className="py-2.5 px-3">Arus</th>
                    <th className="py-2.5 px-3 text-right">Nominal (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMutations.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-6 text-center text-slate-400"
                      >
                        Tidak ada mutasi kas pada periode dan filter ini.
                      </td>
                    </tr>
                  ) : (
                    filteredMutations.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                          {new Date(m.createdAt || m.date).toLocaleString(
                            'id-ID',
                            {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            }
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {getCashAccountShortLabel(
                            m.account,
                            `${m.title || ''} ${m.notes || ''}`
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-600">
                          {m.type}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          <span className="font-semibold block">{m.title}</span>
                          {m.notes && (
                            <span className="text-[11px] text-slate-400">
                              {m.notes}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold">
                          <span
                            className={
                              m.flow === 'IN'
                                ? 'text-emerald-700'
                                : 'text-rose-600'
                            }
                          >
                            {m.flow === 'IN' ? 'MASUK' : 'KELUAR'}
                          </span>
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-extrabold whitespace-nowrap ${
                            m.flow === 'IN'
                              ? 'text-emerald-700'
                              : 'text-rose-600'
                          }`}
                        >
                          {m.flow === 'IN' ? '+' : '-'}
                          {formatRupiah(m.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
