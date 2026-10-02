import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatDateTimeIndonesian, formatNumber } from '../../utils/formatters';
import { Flame, ArrowRight, History, AlertCircle, CheckCircle2, TrendingUp, RotateCcw, X } from 'lucide-react';
import { StockProduction } from '../../types';

export const ChickenProductionView: React.FC = () => {
  const {
    ingredientsMap,
    stockProductions,
    submitChickenProduction,
    cancelChickenProduction,
  } = useApp();
  const { currentRole } = useAuth();
  const isOwner = currentRole === 'OWNER';

  const rawChicken = ingredientsMap.get('ing_ayam_raw');
  const prepChicken = ingredientsMap.get('ing_ayam_ready');

  const [rawKg, setRawKg] = useState<number>(20);
  const [preparedPcs, setPreparedPcs] = useState<number>(157);
  const [notes, setNotes] = useState<string>('Potong standar geprek 1 ekor jadi 8-9 potong');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cancellation modal state
  const [cancellingBatch, setCancellingBatch] = useState<StockProduction | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute live yield ratio: pcs / kg
  const liveRatio = rawKg > 0 ? Number((preparedPcs / rawKg).toFixed(2)) : 0;

  // Benchmark analysis
  const getBenchmarkText = (ratio: number) => {
    if (ratio === 0) return { text: '-', color: 'text-slate-400' };
    if (ratio >= 7.5 && ratio <= 8.5) {
      return {
        text: 'Normal / Ideal (Standar 7.8 - 8.0 potong/kg)',
        color: 'text-emerald-600 dark:text-emerald-400',
      };
    }
    if (ratio < 7.5) {
      return {
        text: 'Rendah (Potongan terlalu besar / susut tinggi)',
        color: 'text-amber-600 dark:text-amber-400',
      };
    }
    return {
      text: 'Tinggi (Potongan agak kecil / ekor kecil)',
      color: 'text-blue-600 dark:text-blue-400',
    };
  };

  const benchmark = getBenchmarkText(liveRatio);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rawKg <= 0 || preparedPcs <= 0) {
      alert('Jumlah kg ayam mentah dan jumlah potong harus lebih dari 0.');
      return;
    }

    if (rawChicken && rawKg > rawChicken.stock) {
      alert(`Stok Ayam Mentah tidak cukup. Tersedia: ${rawChicken.stock} kg, diminta: ${rawKg} kg.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await submitChickenProduction(rawKg, preparedPcs, notes);
      setSuccessMessage(`Produksi ayam berhasil dicatat! Menghasilkan ${preparedPcs} potong ayam siap jual (Yield: ${liveRatio} pcs/kg).`);
      setNotes('Potong standar geprek');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal memproses produksi ayam');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelBatch = async () => {
    if (!cancellingBatch) return;
    setIsCancelling(true);
    try {
      await cancelChickenProduction(cancellingBatch.id, cancelReasonInput);
      setSuccessMessage(
        `Batch pemotongan ayam (${cancellingBatch.rawQuantity} kg) berhasil dibatalkan. Stok ayam mentah telah dikembalikan.`
      );
      setCancellingBatch(null);
      setCancelReasonInput('');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal membatalkan pemotongan ayam');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 py-3 pb-24 lg:pb-8">
      {/* Title */}
      <div className="mb-4">
        <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-600" />
          <span>Produksi & Pemotongan Ayam</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Konversi Ayam Mentah (kg) menjadi Ayam Siap Jual (potong) beserta audit rasio susut (Yield Ratio)
        </p>
      </div>

      {/* Overview Cards: Current Raw Stock vs Current Prepared Stock */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Stok Ayam Mentah
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {rawChicken ? formatNumber(rawChicken.stock) : 0}
            </span>
            <span className="text-xs font-bold text-slate-500">kg</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Siap untuk dipotong</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Stok Ayam Siap Jual
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-orange-600 dark:text-orange-400">
              {prepChicken ? formatNumber(prepChicken.stock) : 0}
            </span>
            <span className="text-xs font-bold text-slate-500">potong</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Tersedia di etalase/dapur</span>
        </div>

        <div className="col-span-2 md:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Rata-rata Yield Terakhir
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {stockProductions.length > 0 ? stockProductions[0].yieldRatio : 7.85}
            </span>
            <span className="text-xs font-bold text-slate-500">potong / kg</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Audit efisiensi pemotongan</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Form Input Produksi */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white mb-1 flex items-center gap-2">
            <span>Catat Batch Pemotongan Baru</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Masukkan jumlah kg mentah yang dikeluarkan dan potong ayam yang dihasilkan
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Visual Conversion Arrow */}
            <div className="p-3 bg-orange-50/60 dark:bg-orange-950/30 rounded-2xl border border-orange-100 dark:border-orange-900/60 flex items-center justify-between text-center">
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">Ayam Mentah</span>
                <span className="text-base font-black text-slate-900 dark:text-white">{rawKg} kg</span>
              </div>
              <ArrowRight className="w-5 h-5 text-orange-500 mx-2" />
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">Ayam Siap Jual</span>
                <span className="text-base font-black text-orange-600">{preparedPcs} potong</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Ayam Mentah (kg) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={rawKg === 0 ? '' : rawKg}
                  onChange={e => setRawKg(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white"
                  placeholder="20"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Hasil Potongan (Pcs) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={preparedPcs === 0 ? '' : preparedPcs}
                  onChange={e => setPreparedPcs(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white"
                  placeholder="157"
                />
              </div>
            </div>

            {/* Live Yield Ratio Calculator */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-400">
                  Rasio Hasil (Yield Ratio):
                </span>
                <span className="font-black text-sm text-slate-900 dark:text-white">
                  {liveRatio} potong / kg
                </span>
              </div>
              <p className={`text-[11px] font-bold ${benchmark.color}`}>{benchmark.text}</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Catatan Batch / Shift (Opsional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Contoh: Shift pagi, potongan dada & sayap pas"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || rawKg <= 0 || preparedPcs <= 0}
              className="w-full py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Memproses Batch...' : 'Proses & Mutasi Stok Sekarang'}
            </button>
          </form>
        </div>

        {/* Riwayat Batch Pemotongan */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <History className="w-4 h-4 text-orange-600" />
              <span>Riwayat Batch Produksi Ayam</span>
            </h3>
            <span className="text-[11px] text-slate-400">
              Total {formatNumber(stockProductions.length)} batch
            </span>
          </div>

          <div className="space-y-2.5 max-h-[48vh] overflow-y-auto">
            {stockProductions.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Flame className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Belum ada riwayat batch produksi ayam.</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Input batch pertama di samping untuk mulai tracking susut potong.
                </p>
              </div>
            ) : (
              stockProductions.map(prod => (
                <div
                  key={prod.id}
                  className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs space-y-1.5"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatNumber(prod.rawQuantity)} kg Mentah → {formatNumber(prod.preparedQuantity)} Potong Siap Jual
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400">
                      {prod.yieldRatio} pcs/kg
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{formatDateTimeIndonesian(prod.createdAt)}</span>
                    <span className="italic">{prod.notes || 'Standar'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
