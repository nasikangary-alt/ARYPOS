import React, { useState } from 'react';
import { OrderType } from '../../types';
import { formatNumber, formatRupiah } from '../../utils/formatters';
import { getCashAccountShortLabel } from '../../utils/cashLedger';
import {
  EXPENSE_CATEGORY_LABELS,
  ORDERED_OPERATIONAL_EXPENSE_KEYS,
} from './reportTypes';
import {
  formatPctChange,
  ProfitLossSnapshot,
} from './useReportData';
import { X, ExternalLink, Info } from 'lucide-react';

type DrillDownTarget =
  | { type: 'SALES'; channel?: OrderType; discountOnly?: boolean; title: string }
  | { type: 'HPP'; title: string }
  | { type: 'PURCHASE'; title: string }
  | { type: 'PLATFORM_FEE'; platform?: OrderType; title: string }
  | { type: 'EXPENSE'; category?: string; title: string };

interface ProfitLossReportProps {
  profitLoss: ProfitLossSnapshot;
  comparisonProfitLoss: ProfitLossSnapshot | null;
  periodLabel: string;
}

export const ProfitLossReport: React.FC<ProfitLossReportProps> = ({
  profitLoss: pl,
  comparisonProfitLoss: comp,
  periodLabel,
}) => {
  const [drillDown, setDrillDown] = useState<DrillDownTarget | null>(null);

  const hasComp = Boolean(comp);

  const fmtAccounting = (val: number, isDeduction = false): string => {
    if (isDeduction) {
      return val > 0 ? `(${formatRupiah(val)})` : formatRupiah(0);
    }
    if (val < 0) {
      return `(${formatRupiah(Math.abs(val))})`;
    }
    return formatRupiah(val);
  };

  const renderChangeCell = (cur: number, prev?: number) => {
    if (!hasComp) return null;
    const pctStr = formatPctChange(cur, prev);
    const isPositive = pctStr.startsWith('+');
    const isNegative = pctStr.startsWith('-') && pctStr !== '-';
    return (
      <td
        className={`py-2 px-4 text-right font-semibold tabular-nums whitespace-nowrap ${
          isPositive
            ? 'text-emerald-700'
            : isNegative
            ? 'text-rose-600'
            : 'text-slate-400'
        }`}
      >
        {pctStr}
      </td>
    );
  };

  const renderClickableRow = (params: {
    label: string;
    sublabel?: string;
    indent?: number;
    currentValue: number;
    compValue?: number;
    isDeduction?: boolean;
    isTotalRow?: boolean;
    isHighlightRow?: boolean;
    onClick?: () => void;
  }) => {
    const {
      label,
      sublabel,
      indent = 0,
      currentValue,
      compValue,
      isDeduction = false,
      isTotalRow = false,
      isHighlightRow = false,
      onClick,
    } = params;

    const padLeft =
      indent === 2 ? 'pl-10' : indent === 1 ? 'pl-6' : 'pl-4';

    const rowClass = isHighlightRow
      ? 'bg-slate-100 border-y border-slate-300 font-bold text-slate-900'
      : isTotalRow
      ? 'bg-slate-50/80 border-t border-slate-200 font-bold text-slate-900'
      : 'text-slate-700 hover:bg-slate-50/90';

    return (
      <tr
        onClick={onClick}
        className={`${rowClass} ${
          onClick ? 'cursor-pointer group transition-colors' : ''
        }`}
      >
        <td className={`py-2 pr-4 ${padLeft}`}>
          <div className="flex flex-col">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={
                  onClick
                    ? 'group-hover:text-[#FF641F] group-hover:underline decoration-dotted underline-offset-2'
                    : ''
                }
              >
                {label}
              </span>
              {onClick && (
                <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-[#FF641F] opacity-0 group-hover:opacity-100 transition-opacity print:hidden" />
              )}
            </span>
            {sublabel && (
              <span className="text-[11px] font-normal text-slate-400 mt-0.5">
                {sublabel}
              </span>
            )}
          </div>
        </td>
        <td
          className={`py-2 px-4 text-right tabular-nums whitespace-nowrap align-top ${
            isTotalRow || isHighlightRow
              ? 'font-bold text-slate-900'
              : 'font-medium'
          } ${isDeduction && currentValue > 0 ? 'text-slate-700' : ''}`}
        >
          {fmtAccounting(currentValue, isDeduction)}
        </td>
        {hasComp && (
          <td className="py-2 px-4 text-right tabular-nums whitespace-nowrap text-slate-600 align-top">
            {compValue !== undefined
              ? fmtAccounting(compValue, isDeduction)
              : '-'}
          </td>
        )}
        {renderChangeCell(currentValue, compValue)}
      </tr>
    );
  };

  const colSpanAll = hasComp ? 4 : 2;

  return (
    <div className="space-y-5">
      {/* Formal Report Title Banner */}
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold text-[#FF641F] uppercase tracking-widest">
            AYAM GEPREK ARY
          </div>
          <h1 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
            LAPORAN LABA RUGI &amp; ARUS KAS OPERASIONAL
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Periode: <strong className="text-slate-800">{periodLabel}</strong>
          </p>
        </div>
        <div className="text-[11px] text-slate-400 print:hidden sm:text-right">
          Klik pada angka / baris akun untuk melihat rincian transaksi (drill-down)
        </div>
      </div>

      {/* ===================================================================== */}
      {/* BAGIAN RINGKASAN (6 METRIK UTAMA)                                     */}
      {/* ===================================================================== */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">
            RINGKASAN
          </span>
          <span className="text-[11px] text-slate-500">
            Laba Rugi (Basis HPP) &middot; Arus Kas Operasional &middot; Persediaan
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          {/* 1. Pendapatan Bersih */}
          <button
            type="button"
            onClick={() =>
              setDrillDown({
                type: 'SALES',
                title: 'Detail Pendapatan / Penjualan Bersih',
              })
            }
            className="p-3.5 text-left hover:bg-slate-50 transition cursor-pointer"
          >
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Penjualan Bersih
            </span>
            <span className="text-sm sm:text-base font-bold text-slate-900 tabular-nums mt-1 block">
              {formatRupiah(pl.netSales)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {pl.salesDrillDownRows.length} transaksi
            </span>
          </button>

          {/* 2. HPP */}
          <button
            type="button"
            onClick={() =>
              setDrillDown({
                type: 'HPP',
                title: 'Detail HPP Produk Terjual',
              })
            }
            className="p-3.5 text-left hover:bg-slate-50 transition cursor-pointer"
          >
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              HPP
            </span>
            <span className="text-sm sm:text-base font-bold text-slate-900 tabular-nums mt-1 block">
              {formatRupiah(pl.totalHpp)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              HPP produk terjual
            </span>
          </button>

          {/* 3. Laba Kotor */}
          <div className="p-3.5 text-left">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Laba Kotor
            </span>
            <span className="text-sm sm:text-base font-bold text-slate-900 tabular-nums mt-1 block">
              {fmtAccounting(pl.grossProfit)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Penjualan Bersih &minus; HPP
            </span>
          </div>

          {/* 4. Laba Bersih */}
          <div className="p-3.5 text-left bg-slate-50/50">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
              Laba Bersih
            </span>
            <span
              className={`text-sm sm:text-base font-bold tabular-nums mt-1 block ${
                pl.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {fmtAccounting(pl.netProfit)}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Berdasarkan HPP
            </span>
          </div>

          {/* 5. Pembelian Aktual */}
          <button
            type="button"
            onClick={() =>
              setDrillDown({
                type: 'PURCHASE',
                title: 'Detail Pembelian Aktual Periode Berjalan',
              })
            }
            className="p-3.5 text-left hover:bg-slate-50 transition cursor-pointer"
          >
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Pembelian Aktual
            </span>
            <span className="text-sm sm:text-base font-bold text-slate-900 tabular-nums mt-1 block">
              {formatRupiah(pl.actualPurchaseTotal)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {pl.purchaseDrillDownRows.length} faktur PO (Dibayar: {formatRupiah(pl.purchasePaymentTotal)})
            </span>
          </button>

          {/* 6. Arus Kas Operasional */}
          <div className="p-3.5 text-left bg-slate-50/50">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
              Arus Kas Operasional
            </span>
            <span
              className={`text-sm sm:text-base font-bold tabular-nums mt-1 block ${
                pl.operatingCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {fmtAccounting(pl.operatingCashFlow)}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Realisasi Kas Operasional
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* BAGIAN 1: LABA RUGI (BERDASARKAN HPP PRODUK YANG TERJUAL)             */}
      {/* ===================================================================== */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
              1. LABA RUGI
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Perhitungan berdasarkan HPP produk yang terjual
            </p>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            Pendapatan &minus; HPP &minus; Beban = Laba Bersih
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-bold uppercase text-[11px] tracking-wider">
                <th className="py-2.5 px-4">Akun / Komponen Laba Rugi</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">
                  {hasComp ? pl.shortHeaderLabel : 'Nominal (Rp)'}
                </th>
                {hasComp && comp && (
                  <>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">
                      {comp.shortHeaderLabel}
                    </th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">
                      Perubahan
                    </th>
                  </>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {/* SECTION: PENDAPATAN */}
              <tr className="bg-slate-50/60">
                <td
                  colSpan={colSpanAll}
                  className="py-2 px-4 font-bold text-slate-900 uppercase tracking-wider text-[11px]"
                >
                  PENDAPATAN
                </td>
              </tr>
              <tr>
                <td
                  colSpan={colSpanAll}
                  className="py-1.5 pl-6 pr-4 font-semibold text-slate-800"
                >
                  Penjualan
                </td>
              </tr>
              {renderClickableRow({
                label: 'Penjualan Offline',
                indent: 2,
                currentValue: pl.grossByChannel.OFFLINE,
                compValue: comp?.grossByChannel.OFFLINE,
                onClick: () =>
                  setDrillDown({
                    type: 'SALES',
                    channel: 'OFFLINE',
                    title: 'Detail Penjualan Offline',
                  }),
              })}
              {renderClickableRow({
                label: 'Penjualan GoFood',
                indent: 2,
                currentValue: pl.grossByChannel.GOFOOD,
                compValue: comp?.grossByChannel.GOFOOD,
                onClick: () =>
                  setDrillDown({
                    type: 'SALES',
                    channel: 'GOFOOD',
                    title: 'Detail Penjualan GoFood',
                  }),
              })}
              {renderClickableRow({
                label: 'Penjualan GrabFood',
                indent: 2,
                currentValue: pl.grossByChannel.GRABFOOD,
                compValue: comp?.grossByChannel.GRABFOOD,
                onClick: () =>
                  setDrillDown({
                    type: 'SALES',
                    channel: 'GRABFOOD',
                    title: 'Detail Penjualan GrabFood',
                  }),
              })}
              {renderClickableRow({
                label: 'Penjualan ShopeeFood',
                indent: 2,
                currentValue: pl.grossByChannel.SHOPEEFOOD,
                compValue: comp?.grossByChannel.SHOPEEFOOD,
                onClick: () =>
                  setDrillDown({
                    type: 'SALES',
                    channel: 'SHOPEEFOOD',
                    title: 'Detail Penjualan ShopeeFood',
                  }),
              })}
              {renderClickableRow({
                label: 'Diskon Penjualan',
                indent: 1,
                currentValue: pl.salesDiscount,
                compValue: comp?.salesDiscount,
                isDeduction: true,
                onClick: () =>
                  setDrillDown({
                    type: 'SALES',
                    discountOnly: true,
                    title: 'Detail Diskon Penjualan',
                  }),
              })}
              {renderClickableRow({
                label: 'TOTAL PENDAPATAN / PENJUALAN BERSIH',
                indent: 0,
                currentValue: pl.netSales,
                compValue: comp?.netSales,
                isTotalRow: true,
                onClick: () =>
                  setDrillDown({
                    type: 'SALES',
                    title: 'Detail Seluruh Penjualan Bersih',
                  }),
              })}

              {/* SECTION: HARGA POKOK PENJUALAN */}
              <tr className="bg-slate-50/60">
                <td
                  colSpan={colSpanAll}
                  className="py-2 px-4 font-bold text-slate-900 uppercase tracking-wider text-[11px]"
                >
                  HARGA POKOK PENJUALAN
                </td>
              </tr>
              {renderClickableRow({
                label: 'HPP Produk Terjual',
                indent: 1,
                currentValue: pl.totalHpp,
                compValue: comp?.totalHpp,
                isDeduction: true,
                onClick: () =>
                  setDrillDown({
                    type: 'HPP',
                    title: 'Detail HPP Produk Terjual',
                  }),
              })}
              {renderClickableRow({
                label: 'TOTAL HPP',
                indent: 0,
                currentValue: pl.totalHpp,
                compValue: comp?.totalHpp,
                isDeduction: true,
                isTotalRow: true,
                onClick: () =>
                  setDrillDown({
                    type: 'HPP',
                    title: 'Detail HPP Produk Terjual',
                  }),
              })}

              {/* LABA KOTOR */}
              {renderClickableRow({
                label: 'LABA KOTOR',
                indent: 0,
                currentValue: pl.grossProfit,
                compValue: comp?.grossProfit,
                isHighlightRow: true,
              })}

              {/* SECTION: BEBAN PENJUALAN */}
              <tr className="bg-slate-50/60">
                <td
                  colSpan={colSpanAll}
                  className="py-2 px-4 font-bold text-slate-900 uppercase tracking-wider text-[11px]"
                >
                  BEBAN PENJUALAN
                </td>
              </tr>
              {renderClickableRow({
                label: 'Biaya Admin / Platform (GoFood, GrabFood, ShopeeFood)',
                indent: 1,
                currentValue: pl.totalPlatformFee,
                compValue: comp?.totalPlatformFee,
                isDeduction: true,
                onClick: () =>
                  setDrillDown({
                    type: 'PLATFORM_FEE',
                    title: 'Detail Biaya Admin / Platform',
                  }),
              })}
              {renderClickableRow({
                label: 'Biaya Transaksi Lainnya',
                indent: 1,
                currentValue: pl.otherSellingExpense,
                compValue: comp?.otherSellingExpense,
                isDeduction: true,
              })}
              {renderClickableRow({
                label: 'TOTAL BEBAN PENJUALAN',
                indent: 0,
                currentValue: pl.totalSellingExpense,
                compValue: comp?.totalSellingExpense,
                isDeduction: true,
                isTotalRow: true,
                onClick: () =>
                  setDrillDown({
                    type: 'PLATFORM_FEE',
                    title: 'Detail Beban Penjualan & Biaya Platform',
                  }),
              })}

              {/* SECTION: BEBAN OPERASIONAL */}
              <tr className="bg-slate-50/60">
                <td
                  colSpan={colSpanAll}
                  className="py-2 px-4 font-bold text-slate-900 uppercase tracking-wider text-[11px]"
                >
                  BEBAN OPERASIONAL
                </td>
              </tr>
              {ORDERED_OPERATIONAL_EXPENSE_KEYS.map((catKey) =>
                renderClickableRow({
                  key: catKey,
                  label: EXPENSE_CATEGORY_LABELS[catKey] || catKey,
                  indent: 1,
                  currentValue: pl.operatingExpensesByCategory[catKey] || 0,
                  compValue: comp?.operatingExpensesByCategory[catKey] || 0,
                  isDeduction: true,
                  onClick: () =>
                    setDrillDown({
                      type: 'EXPENSE',
                      category: catKey,
                      title: `Detail Beban: ${
                        EXPENSE_CATEGORY_LABELS[catKey] || catKey
                      }`,
                    }),
                } as any)
              )}
              {renderClickableRow({
                label: 'TOTAL BEBAN OPERASIONAL',
                indent: 0,
                currentValue: pl.totalOperatingExpense,
                compValue: comp?.totalOperatingExpense,
                isDeduction: true,
                isTotalRow: true,
                onClick: () =>
                  setDrillDown({
                    type: 'EXPENSE',
                    title: 'Detail Seluruh Beban Operasional',
                  }),
              })}

              {/* LABA OPERASIONAL */}
              {renderClickableRow({
                label: 'LABA OPERASIONAL',
                indent: 0,
                currentValue: pl.operatingProfit,
                compValue: comp?.operatingProfit,
                isHighlightRow: true,
              })}

              {/* SECTION: PENDAPATAN / BEBAN LAIN-LAIN */}
              <tr className="bg-slate-50/60">
                <td
                  colSpan={colSpanAll}
                  className="py-2 px-4 font-bold text-slate-900 uppercase tracking-wider text-[11px]"
                >
                  PENDAPATAN / BEBAN LAIN-LAIN
                </td>
              </tr>
              {renderClickableRow({
                label: 'Pendapatan Lain',
                indent: 1,
                currentValue: pl.otherIncome,
                compValue: comp?.otherIncome,
              })}
              {renderClickableRow({
                label: 'Beban Lain',
                indent: 1,
                currentValue: pl.otherExpense,
                compValue: comp?.otherExpense,
                isDeduction: true,
              })}
              {renderClickableRow({
                label: 'LABA SEBELUM PAJAK',
                indent: 0,
                currentValue: pl.profitBeforeTax,
                compValue: comp?.profitBeforeTax,
                isTotalRow: true,
              })}
              {renderClickableRow({
                label: 'Pajak',
                indent: 1,
                currentValue: pl.taxExpense,
                compValue: comp?.taxExpense,
                isDeduction: true,
              })}
            </tbody>

            <tfoot>
              <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-900 text-xs sm:text-sm">
                <td className="py-3 px-4 uppercase tracking-wider">
                  LABA BERSIH
                </td>
                <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap">
                  {fmtAccounting(pl.netProfit)}
                </td>
                {hasComp && comp && (
                  <>
                    <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap text-slate-300">
                      {fmtAccounting(comp.netProfit)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap text-orange-300">
                      {formatPctChange(pl.netProfit, comp.netProfit)}
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* BAGIAN 2: ARUS KAS OPERASIONAL (REALISASI KAS OPERASIONAL)            */}
      {/* ===================================================================== */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
              2. REALISASI KAS OPERASIONAL (ARUS KAS OPERASIONAL)
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Perhitungan uang kas yang benar-benar masuk dan keluar dari aktivitas operasional pada periode berjalan
            </p>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            Kas Masuk Penjualan &minus; Pembayaran Pembelian &minus; Biaya Platform &minus; Pengeluaran Operasional
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-bold uppercase text-[11px] tracking-wider">
                <th className="py-2.5 px-4">Komponen Arus Kas Operasional</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">
                  {hasComp ? pl.shortHeaderLabel : 'Nominal (Rp)'}
                </th>
                {hasComp && comp && (
                  <>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">
                      {comp.shortHeaderLabel}
                    </th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">
                      Perubahan
                    </th>
                  </>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {renderClickableRow({
                label: 'Kas Masuk dari Penjualan',
                sublabel:
                  'Total penjualan bersih (penjualan kotor dikurangi diskon penjualan)',
                indent: 0,
                currentValue: pl.netSales,
                compValue: comp?.netSales,
                onClick: () =>
                  setDrillDown({
                    type: 'SALES',
                    title: 'Detail Kas Masuk dari Penjualan',
                  }),
              })}
              {renderClickableRow({
                label: 'Pembayaran Pembelian',
                sublabel: `Pembelian Aktual PO: ${formatRupiah(
                  pl.actualPurchaseTotal
                )} (${pl.purchaseDrillDownRows.length} Faktur) · Dibayar: ${formatRupiah(
                  pl.purchasePaymentTotal
                )} · Hutang PO Belum Dibayar: ${formatRupiah(
                  pl.actualPurchaseUnpaidDebt
                )} (hutang tidak dihitung kas keluar)`,
                indent: 0,
                currentValue: pl.purchasePaymentTotal,
                compValue: comp?.purchasePaymentTotal,
                isDeduction: true,
                onClick: () =>
                  setDrillDown({
                    type: 'PURCHASE',
                    title: 'Detail Pembelian Aktual & Status Pembayaran PO',
                  }),
              })}
              {renderClickableRow({
                label: 'Biaya Admin / Platform',
                sublabel: 'Potongan GoFood, GrabFood, dan ShopeeFood',
                indent: 0,
                currentValue: pl.totalSellingExpense,
                compValue: comp?.totalSellingExpense,
                isDeduction: true,
                onClick: () =>
                  setDrillDown({
                    type: 'PLATFORM_FEE',
                    title: 'Detail Biaya Admin / Platform',
                  }),
              })}
              {renderClickableRow({
                label: 'Pengeluaran Operasional Aktual',
                sublabel:
                  'Gaji, listrik, gas, transportasi, sewa, perlengkapan, dan operasional lainnya',
                indent: 0,
                currentValue: pl.totalOperatingExpense,
                compValue: comp?.totalOperatingExpense,
                isDeduction: true,
                onClick: () =>
                  setDrillDown({
                    type: 'EXPENSE',
                    title: 'Detail Pengeluaran Operasional Aktual',
                  }),
              })}
              {renderClickableRow({
                label: 'Beban Lain-lain Aktual',
                indent: 0,
                currentValue: pl.otherExpense,
                compValue: comp?.otherExpense,
                isDeduction: true,
              })}
            </tbody>

            <tfoot>
              <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-900 text-xs sm:text-sm">
                <td className="py-3 px-4 uppercase tracking-wider">
                  ARUS KAS BERSIH OPERASIONAL
                </td>
                <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap">
                  {fmtAccounting(pl.operatingCashFlow)}
                </td>
                {hasComp && comp && (
                  <>
                    <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap text-slate-300">
                      {fmtAccounting(comp.operatingCashFlow)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap text-orange-300">
                      {formatPctChange(
                        pl.operatingCashFlow,
                        comp.operatingCashFlow
                      )}
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* BAGIAN 3: REKONSILIASI LABA DAN ARUS KAS                              */}
      {/* ===================================================================== */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
              3. REKONSILIASI LABA DAN ARUS KAS
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Penjelasan perbedaan antara Laba Bersih (berdasarkan HPP) dan Arus Kas Bersih Operasional
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                <th className="py-2.5 px-4">Komponen Rekonsiliasi</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">
                  {hasComp ? pl.shortHeaderLabel : 'Nominal (Rp)'}
                </th>
                {hasComp && comp && (
                  <>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">
                      {comp.shortHeaderLabel}
                    </th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">
                      Perubahan
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {renderClickableRow({
                label: 'Laba Bersih (Berdasarkan HPP)',
                sublabel: `Pendapatan Bersih dikurangi HPP Produk Terjual (${formatRupiah(
                  pl.totalHpp
                )}) dan beban periode berjalan`,
                indent: 0,
                currentValue: pl.netProfit,
                compValue: comp?.netProfit,
              })}
              {renderClickableRow({
                label: 'Arus Kas Bersih Operasional',
                sublabel: `Kas Masuk Penjualan dikurangi Pembayaran Pembelian (${formatRupiah(
                  pl.purchasePaymentTotal
                )}) dan pengeluaran kas operasional`,
                indent: 0,
                currentValue: pl.operatingCashFlow,
                compValue: comp?.operatingCashFlow,
              })}
              {renderClickableRow({
                label: 'Selisih Rekonsiliasi (Arus Kas vs Laba Bersih)',
                sublabel:
                  'Perbedaan waktu pengakuan beban HPP dan aliran kas keluar (bukan laba tambahan)',
                indent: 0,
                currentValue: pl.reconciliationDifference,
                compValue: comp?.reconciliationDifference,
                isHighlightRow: true,
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 space-y-2 text-xs text-slate-600">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#FF641F] shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-semibold text-slate-800">
                Perbedaan terutama berasal dari HPP produk terjual yang menggunakan persediaan yang telah tersedia sebelumnya dan tidak merupakan pembayaran pembelian pada periode berjalan.
              </p>
              <p>
                Selisih sebesar{' '}
                <strong>{formatRupiah(Math.abs(pl.reconciliationDifference))}</strong>{' '}
                <strong>bukan merupakan laba tambahan</strong>, melainkan perbedaan antara pengakuan laba berbasis HPP (<strong>{formatRupiah(pl.totalHpp)}</strong>) dan pembayaran pembelian aktual (<strong>{formatRupiah(pl.purchasePaymentTotal)}</strong>) yang dapat berasal dari:
              </p>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-slate-600">
                <li>
                  <strong>HPP dari Persediaan Tersedia:</strong> Produk yang terjual menggunakan bahan baku dari Saldo Awal Persediaan atau stok periode sebelumnya tanpa adanya pembayaran pembelian baru.
                </li>
                <li>
                  <strong>Pembelian Belum Dibayar / Hutang PO:</strong> Transaksi pembelian secara tempo (Hutang PO periode ini: <strong>{formatRupiah(pl.actualPurchaseUnpaidDebt)}</strong>) belum mengurangi arus kas keluar.
                </li>
                <li>
                  <strong>Pembelian untuk Stok:</strong> Pembayaran pembelian bahan baku pada periode berjalan yang masih tersimpan sebagai persediaan akhir dan belum terjual menjadi HPP.
                </li>
                <li>
                  <strong>Perbedaan Waktu Pengakuan:</strong> Perbedaan waktu antara pengakuan beban akuntansi (Laba Rugi) dan realisasi kas keluar (Arus Kas Operasional).
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* BAGIAN 4: PERSEDIAAN                                                  */}
      {/* ===================================================================== */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
              4. PERSEDIAAN
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Mutasi nilai persediaan bahan baku, kemasan, dan barang siap jual berdasarkan pergerakan stok
            </p>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            Saldo Awal + Pembelian &minus; Pemakaian &plusmn; Penyesuaian = Saldo Akhir
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-bold uppercase text-[11px] tracking-wider">
                <th className="py-2.5 px-4">Komponen Persediaan</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">
                  {hasComp ? pl.shortHeaderLabel : 'Nominal (Rp)'}
                </th>
                {hasComp && comp && (
                  <>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">
                      {comp.shortHeaderLabel}
                    </th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">
                      Perubahan
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {renderClickableRow({
                label: 'Saldo Awal Persediaan',
                sublabel:
                  'Nilai persediaan awal (stok awal × cost per unit); bukan pembelian dan bukan pengeluaran kas',
                indent: 0,
                currentValue: pl.inventorySummary.openingInventoryValue,
                compValue: comp?.inventorySummary.openingInventoryValue,
              })}
              {renderClickableRow({
                label: 'Pembelian',
                sublabel:
                  'Penambahan persediaan dari transaksi pembelian/PO aktual pada periode laporan',
                indent: 0,
                currentValue: pl.actualPurchaseTotal,
                compValue: comp?.actualPurchaseTotal,
                onClick: () =>
                  setDrillDown({
                    type: 'PURCHASE',
                    title: 'Detail Pembelian Persediaan Periode Berjalan',
                  }),
              })}
              {renderClickableRow({
                label: 'Pemakaian Bahan / HPP',
                sublabel:
                  'Pengurangan persediaan untuk produksi maupun HPP produk yang terjual',
                indent: 0,
                currentValue: pl.inventorySummary.usageInventoryValue,
                compValue: comp?.inventorySummary.usageInventoryValue,
                isDeduction: true,
                onClick: () =>
                  setDrillDown({
                    type: 'HPP',
                    title: 'Detail HPP & Pemakaian Produk Terjual',
                  }),
              })}
              {renderClickableRow({
                label: 'Penyesuaian Stok',
                sublabel:
                  'Koreksi stok opname / penyesuaian manual di luar stok awal',
                indent: 0,
                currentValue: pl.inventorySummary.adjustmentInventoryValue,
                compValue: comp?.inventorySummary.adjustmentInventoryValue,
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-900 text-xs sm:text-sm">
                <td className="py-3 px-4 uppercase tracking-wider">
                  SALDO AKHIR PERSEDIAAN
                </td>
                <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap">
                  {fmtAccounting(pl.inventorySummary.closingInventoryValue)}
                </td>
                {hasComp && comp && (
                  <>
                    <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap text-slate-300">
                      {fmtAccounting(comp.inventorySummary.closingInventoryValue)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap text-orange-300">
                      {formatPctChange(
                        pl.inventorySummary.closingInventoryValue,
                        comp.inventorySummary.closingInventoryValue
                      )}
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* DRILL-DOWN MODAL (READ-ONLY)                                          */}
      {/* ===================================================================== */}
      {drillDown && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-6 print:hidden"
          onClick={() => setDrillDown(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl max-w-5xl w-full max-h-[85vh] flex flex-col shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF641F] block">
                  DRILL-DOWN LAPORAN LABA RUGI &amp; ARUS KAS OPERASIONAL &middot;{' '}
                  {periodLabel}
                </span>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {drillDown.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDrillDown(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Table Body */}
            <div className="flex-1 overflow-auto p-4">
              {drillDown.type === 'SALES' &&
                (() => {
                  const rows = pl.salesDrillDownRows.filter((r) => {
                    if (drillDown.channel && r.channel !== drillDown.channel) {
                      return false;
                    }
                    if (drillDown.discountOnly && r.discount <= 0) {
                      return false;
                    }
                    return true;
                  });
                  const totQty = rows.reduce((s, r) => s + r.qty, 0);
                  const totGross = rows.reduce((s, r) => s + r.grossSales, 0);
                  const totDisc = rows.reduce((s, r) => s + r.discount, 0);
                  const totNet = rows.reduce((s, r) => s + r.netSales, 0);

                  return (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                          <th className="py-2 px-3">Tanggal</th>
                          <th className="py-2 px-3">No Transaksi</th>
                          <th className="py-2 px-3">Channel</th>
                          <th className="py-2 px-3">Menu</th>
                          <th className="py-2 px-3 text-right">Qty</th>
                          <th className="py-2 px-3 text-right">
                            Harga (Gross)
                          </th>
                          <th className="py-2 px-3 text-right">Diskon</th>
                          <th className="py-2 px-3 text-right">Net Sales</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={8}
                              className="py-8 text-center text-slate-400"
                            >
                              Tidak ada transaksi penjualan untuk kategori ini.
                            </td>
                          </tr>
                        ) : (
                          rows.map((r) => (
                            <tr key={r.saleId} className="hover:bg-slate-50">
                              <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                                {new Date(r.createdAt).toLocaleString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                                {r.transactionNo}
                              </td>
                              <td className="py-2 px-3 text-slate-700">
                                {r.channel}
                              </td>
                              <td className="py-2 px-3 text-slate-600 max-w-xs truncate">
                                {r.menuSummary}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums">
                                {formatNumber(r.qty)}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums">
                                {formatRupiah(r.grossSales)}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums text-amber-700">
                                {r.discount > 0
                                  ? `(${formatRupiah(r.discount)})`
                                  : 'Rp 0'}
                              </td>
                              <td className="py-2 px-3 text-right font-bold tabular-nums text-slate-900">
                                {formatRupiah(r.netSales)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {rows.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                            <td colSpan={4} className="py-2.5 px-3">
                              TOTAL ({rows.length} Transaksi)
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums">
                              {formatNumber(totQty)}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums">
                              {formatRupiah(totGross)}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-amber-700">
                              ({formatRupiah(totDisc)})
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums">
                              {formatRupiah(totNet)}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  );
                })()}

              {drillDown.type === 'HPP' &&
                (() => {
                  const rows = pl.hppDrillDownRows;
                  const totQty = rows.reduce((s, r) => s + r.qty, 0);
                  const totHpp = rows.reduce((s, r) => s + r.totalHpp, 0);

                  return (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                          <th className="py-2 px-3">Tanggal</th>
                          <th className="py-2 px-3">Transaksi</th>
                          <th className="py-2 px-3">Menu</th>
                          <th className="py-2 px-3 text-right">Qty</th>
                          <th className="py-2 px-3 text-right">HPP / Unit</th>
                          <th className="py-2 px-3 text-right">Total HPP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="py-8 text-center text-slate-400"
                            >
                              Tidak ada data HPP produk terjual pada periode
                              ini.
                            </td>
                          </tr>
                        ) : (
                          rows.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                                {new Date(r.createdAt).toLocaleString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                                {r.transactionNo}
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-800">
                                {r.menuName}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums">
                                {formatNumber(r.qty)}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums text-slate-600">
                                {formatRupiah(r.unitHpp)}
                              </td>
                              <td className="py-2 px-3 text-right font-bold tabular-nums text-slate-900">
                                {formatRupiah(r.totalHpp)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {rows.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                            <td colSpan={3} className="py-2.5 px-3">
                              TOTAL HPP PRODUK TERJUAL ({rows.length} Baris
                              Item)
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums">
                              {formatNumber(totQty)}
                            </td>
                            <td className="py-2.5 px-3"></td>
                            <td className="py-2.5 px-3 text-right tabular-nums">
                              {formatRupiah(totHpp)}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  );
                })()}

              {drillDown.type === 'PURCHASE' &&
                (() => {
                  const rows = pl.purchaseDrillDownRows;
                  const totAmount = rows.reduce((s, r) => s + r.totalAmount, 0);
                  const totPaid = rows.reduce((s, r) => s + r.paidAmount, 0);
                  const totRem = rows.reduce(
                    (s, r) => s + r.remainingAmount,
                    0
                  );

                  return (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                          <th className="py-2 px-3">Tanggal</th>
                          <th className="py-2 px-3">Nomor PO</th>
                          <th className="py-2 px-3">Supplier</th>
                          <th className="py-2 px-3">Produk / Bahan</th>
                          <th className="py-2 px-3">Qty</th>
                          <th className="py-2 px-3 text-right">Total</th>
                          <th className="py-2 px-3 text-right">Dibayar</th>
                          <th className="py-2 px-3 text-right">Hutang PO</th>
                          <th className="py-2 px-3">Status Pembayaran</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={9}
                              className="py-8 text-center text-slate-400"
                            >
                              Tidak ada transaksi pembelian aktual pada periode
                              ini.
                            </td>
                          </tr>
                        ) : (
                          rows.map((r) => (
                            <tr
                              key={r.purchaseId}
                              className="hover:bg-slate-50"
                            >
                              <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                                {r.date}
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                                {r.purchaseNo}
                              </td>
                              <td className="py-2 px-3 text-slate-700">
                                {r.supplier}
                              </td>
                              <td className="py-2 px-3 text-slate-700 max-w-xs truncate">
                                {r.itemSummary}
                              </td>
                              <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                                {r.qtySummary}
                              </td>
                              <td className="py-2 px-3 text-right font-bold tabular-nums text-slate-900">
                                {formatRupiah(r.totalAmount)}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums text-emerald-700">
                                {formatRupiah(r.paidAmount)}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums text-rose-600">
                                {formatRupiah(r.remainingAmount)}
                              </td>
                              <td className="py-2 px-3 font-bold">
                                <span
                                  className={
                                    r.paymentStatus === 'LUNAS'
                                      ? 'text-emerald-700'
                                      : r.paymentStatus === 'SEBAGIAN'
                                      ? 'text-amber-600'
                                      : 'text-rose-600'
                                  }
                                >
                                  {r.paymentStatus}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {rows.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                            <td colSpan={5} className="py-2.5 px-3">
                              TOTAL PEMBELIAN AKTUAL ({rows.length} Faktur PO)
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums">
                              {formatRupiah(totAmount)}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">
                              {formatRupiah(totPaid)}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-rose-600">
                              {formatRupiah(totRem)}
                            </td>
                            <td className="py-2.5 px-3"></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  );
                })()}

              {drillDown.type === 'PLATFORM_FEE' &&
                (() => {
                  const rows = pl.platformFeeDrillDownRows.filter(
                    (r) =>
                      !drillDown.platform || r.platform === drillDown.platform
                  );
                  const totGross = rows.reduce((s, r) => s + r.grossAmount, 0);
                  const totDisc = rows.reduce(
                    (s, r) => s + r.discountAmount,
                    0
                  );
                  const totFixed = rows.reduce((s, r) => s + r.fixedFee, 0);
                  const totShipDisc = rows.reduce(
                    (s, r) => s + r.shippingDiscount,
                    0
                  );
                  const totFee = rows.reduce(
                    (s, r) => s + r.totalPlatformFee,
                    0
                  );
                  const totNetSettle = rows.reduce(
                    (s, r) => s + r.netSettlement,
                    0
                  );

                  return (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                          <th className="py-2 px-3">Tanggal</th>
                          <th className="py-2 px-3">Order</th>
                          <th className="py-2 px-3">Platform</th>
                          <th className="py-2 px-3 text-right">Gross</th>
                          <th className="py-2 px-3 text-right">Discount</th>
                          <th className="py-2 px-3 text-right">Fee %</th>
                          <th className="py-2 px-3 text-right">Fixed Fee</th>
                          <th className="py-2 px-3 text-right">
                            Shipping Discount
                          </th>
                          <th className="py-2 px-3 text-right">
                            Total Platform Fee
                          </th>
                          <th className="py-2 px-3 text-right">
                            Net Settlement
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={10}
                              className="py-8 text-center text-slate-400"
                            >
                              Tidak ada potongan biaya platform pada periode
                              ini.
                            </td>
                          </tr>
                        ) : (
                          rows.map((r) => (
                            <tr key={r.saleId} className="hover:bg-slate-50">
                              <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                                {new Date(r.createdAt).toLocaleString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                                {r.transactionNo}
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-800">
                                {r.platform}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums">
                                {formatRupiah(r.grossAmount)}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums text-amber-700">
                                {r.discountAmount > 0
                                  ? `(${formatRupiah(r.discountAmount)})`
                                  : 'Rp 0'}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums">
                                {r.feePercent > 0 ? `${r.feePercent}%` : '-'}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums">
                                {formatRupiah(r.fixedFee)}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums">
                                {formatRupiah(r.shippingDiscount)}
                              </td>
                              <td className="py-2 px-3 text-right font-bold tabular-nums text-rose-600">
                                {formatRupiah(r.totalPlatformFee)}
                              </td>
                              <td className="py-2 px-3 text-right font-bold tabular-nums text-emerald-700">
                                {formatRupiah(r.netSettlement)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {rows.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                            <td colSpan={3} className="py-2.5 px-3">
                              TOTAL ({rows.length} Order)
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums">
                              {formatRupiah(totGross)}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-amber-700">
                              ({formatRupiah(totDisc)})
                            </td>
                            <td className="py-2.5 px-3"></td>
                            <td className="py-2.5 px-3 text-right tabular-nums">
                              {formatRupiah(totFixed)}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums">
                              {formatRupiah(totShipDisc)}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-rose-600">
                              {formatRupiah(totFee)}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">
                              {formatRupiah(totNetSettle)}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  );
                })()}

              {drillDown.type === 'EXPENSE' &&
                (() => {
                  const rows = pl.expenseDrillDownRows.filter((e) => {
                    if (!drillDown.category) return true;
                    const normCat = (e.category || 'lainnya')
                      .toLowerCase()
                      .trim();
                    const mappedCat = ORDERED_OPERATIONAL_EXPENSE_KEYS.includes(
                      normCat
                    )
                      ? normCat
                      : 'lainnya';
                    return mappedCat === drillDown.category;
                  });
                  const totExp = rows.reduce((s, e) => s + (e.amount || 0), 0);

                  return (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                          <th className="py-2 px-3">Tanggal</th>
                          <th className="py-2 px-3">Kategori</th>
                          <th className="py-2 px-3">Keterangan</th>
                          <th className="py-2 px-3">Sumber Dana</th>
                          <th className="py-2 px-3">Dicatat Oleh</th>
                          <th className="py-2 px-3 text-right">Nominal (Rp)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="py-8 text-center text-slate-400"
                            >
                              Tidak ada transaksi beban operasional untuk
                              kategori ini.
                            </td>
                          </tr>
                        ) : (
                          rows.map((e) => (
                            <tr key={e.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                                {e.date ||
                                  new Date(e.createdAt).toLocaleDateString(
                                    'id-ID'
                                  )}
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-800">
                                {EXPENSE_CATEGORY_LABELS[e.category] ||
                                  e.category}
                              </td>
                              <td className="py-2 px-3 text-slate-700">
                                {e.note || '-'}
                              </td>
                              <td className="py-2 px-3 text-slate-600">
                                {getCashAccountShortLabel(e.paymentSource)}
                              </td>
                              <td className="py-2 px-3 text-slate-500">
                                {e.createdBy || '-'}
                              </td>
                              <td className="py-2 px-3 text-right font-bold tabular-nums text-slate-900">
                                {formatRupiah(e.amount)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {rows.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                            <td colSpan={5} className="py-2.5 px-3">
                              TOTAL BEBAN ({rows.length} Transaksi)
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums">
                              {formatRupiah(totExp)}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  );
                })()}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span>
                Data ini hanya membaca transaksi existing (read-only) dan sesuai
                dengan angka pada Laporan Laba Rugi &amp; Arus Kas Operasional.
              </span>
              <button
                type="button"
                onClick={() => setDrillDown(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
