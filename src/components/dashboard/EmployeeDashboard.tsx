import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatRupiah, formatNumber } from '../../utils/formatters';
import {
  GreetingHeader,
  StatCard,
  SectionCard,
  QuickAction,
  StockAlertsCard,
  FloatingPOSButton,
} from './DashboardComponents';
import {
  UserCheck,
  Factory,
  Boxes,
  Clock,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  Flame,
  ShoppingBag,
} from 'lucide-react';

interface EmployeeDashboardProps {
  onNavigateTab: (tab: string) => void;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ onNavigateTab }) => {
  const { productions, ingredients } = useApp();
  const { currentEmployee, todayAttendance } = useAuth();

  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat pagi';
    if (hour < 15) return 'Selamat siang';
    if (hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  }, []);

  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date());
  }, []);

  const todayStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }, []);

  // Today's Productions
  const todayProductions = useMemo(() => {
    return productions.filter(
      (p) => new Date(p.createdAt || Date.now()).getTime() >= todayStart
    );
  }, [productions, todayStart]);

  const totalProducedItems = useMemo(
    () => todayProductions.reduce((sum, p) => sum + p.totalProduced, 0),
    [todayProductions]
  );

  // Raw Ingredients Summary
  const rawIngredients = useMemo(() => {
    return ingredients
      .filter((ing) => ing.type === 'RAW' || ing.type === 'PREPARED' || !ing.type)
      .slice(0, 6);
  }, [ingredients]);

  // Critical Ingredients
  const criticalRawStock = useMemo(() => {
    return ingredients
      .filter((ing) => ing.stock <= (ing.minimumStock || 5))
      .map((ing) => ({
        id: `ing-${ing.id}`,
        name: ing.name,
        currentStock: ing.stock,
        unit: ing.unit || 'pcs',
        minStock: ing.minimumStock || 5,
        isCritical: ing.stock <= (ing.criticalStock || 2),
      }))
      .slice(0, 5);
  }, [ingredients]);

  const employeeName = currentEmployee?.name || 'Karyawan ARY';
  const checkInTime = todayAttendance?.checkInAt
    ? new Date(todayAttendance.checkInAt).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="pb-24 lg:pb-12 bg-[#F7F8FA] min-h-screen w-full max-w-none">
      {/* Header */}
      <GreetingHeader
        dateText={todayFormatted}
        greetingText={greetingText}
        userName={employeeName}
        roleBadge="STAF OPERASIONAL"
        showTimeRange={false}
      />

      <div className="w-full max-w-none px-4 lg:px-6 space-y-5">
        {/* Attendance Banner */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl ${
                  todayAttendance ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}
              >
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 block">
                  Status Kehadiran Hari Ini
                </span>
                <p className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>{todayAttendance ? 'SUDAH ABSEN HADIR' : 'BELUM ABSEN'}</span>
                  {checkInTime && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                      Jam {checkInTime} WIB
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upah Harian: {formatRupiah(currentEmployee?.dailyWage || 80000)} / shift
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('karyawan')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#FF641F] hover:bg-orange-600 text-white font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>{todayAttendance ? 'Lihat Detail Absensi' : 'Absen Sekarang'}</span>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Status Absensi"
            value={todayAttendance ? 'HADIR' : 'BELUM'}
            subtext={checkInTime ? `Masuk jam ${checkInTime}` : 'Klik untuk absen'}
            icon={UserCheck}
            iconBgColor={todayAttendance ? 'bg-emerald-50' : 'bg-amber-50'}
            iconColor={todayAttendance ? 'text-emerald-600' : 'text-amber-600'}
            accentColor={todayAttendance ? 'bg-emerald-500' : 'bg-amber-500'}
          />
          <StatCard
            label="Shift Kerja"
            value={currentEmployee?.position || 'Staf Operasional'}
            subtext={todayFormatted}
            icon={Calendar}
            iconBgColor="bg-blue-50"
            iconColor="text-blue-600"
            accentColor="bg-blue-500"
          />
          <StatCard
            label="Hasil Produksi Dapur"
            value={`${formatNumber(totalPortionsSoldOrProduced(todayProductions))} porsi`}
            subtext={`${todayProductions.length} Sesi Hari Ini`}
            icon={Factory}
            iconBgColor="bg-amber-50"
            iconColor="text-amber-600"
            accentColor="bg-amber-500"
          />
          <StatCard
            label="Bahan Kritis"
            value={`${criticalRawStock.length} Item`}
            subtext="Perlu perhatian dapur"
            icon={Boxes}
            iconBgColor={criticalRawStock.length > 0 ? 'bg-rose-50' : 'bg-slate-50'}
            iconColor={criticalRawStock.length > 0 ? 'text-rose-600' : 'text-slate-500'}
            accentColor={criticalRawStock.length > 0 ? 'bg-rose-500' : 'bg-slate-300'}
          />
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#FF641F]" />
            <span>Tugas & Akses Kerja Staf</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickAction
              title="Buka Kasir POS"
              description="Melayani transaksi POS"
              icon={ShoppingBag}
              onClick={() => onNavigateTab('kasir')}
              badge="POS"
            />
            <QuickAction
              title="Absensi & Kehadiran"
              description="Catat jam masuk & pulang"
              icon={UserCheck}
              onClick={() => onNavigateTab('karyawan')}
            />
            <QuickAction
              title="Catat Produksi Dapur"
              description="Input hasil potong & olahan"
              icon={Factory}
              onClick={() => onNavigateTab('produksi')}
            />
            <QuickAction
              title="Cek Stok Bahan Baku"
              description="Periksa ketersediaan bahan"
              icon={Boxes}
              onClick={() => onNavigateTab('stok')}
            />
          </div>
        </div>

        {/* Raw Ingredients Stock Summary */}
        <SectionCard
          title="STOK BAHAN UTAMA DAPUR"
          subtitle="Ketersediaan bahan baku untuk olahan menu"
          actionText="Lihat Stok Full →"
          onActionClick={() => onNavigateTab('stok')}
          icon={Boxes}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {rawIngredients.map((ing) => (
              <div
                key={ing.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900 line-clamp-1 block mb-0.5">
                    {ing.name}
                  </span>
                  <span className="text-[10px] text-slate-500 capitalize">
                    {ing.type || 'Bahan Baku'}
                  </span>
                </div>
                <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Stok:</span>
                  <span
                    className={`font-bold ${
                      ing.stock > (ing.minimumStock || 5)
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {formatNumber(ing.stock)} {ing.unit || 'pcs'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Critical Stock Alerts */}
        <StockAlertsCard
          alerts={criticalRawStock}
          onManageStock={() => onNavigateTab('stok')}
        />
      </div>

      {/* Floating Action Button */}
      <FloatingPOSButton
        onClick={() => onNavigateTab('kasir')}
        label="Buka Kasir"
      />
    </div>
  );
};

function totalPortionsSoldOrProduced(productions: any[]): number {
  return productions.reduce((acc, p) => acc + (p.totalProduced || 0), 0);
}
