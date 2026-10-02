import React from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Factory,
  Boxes,
  ArrowRight,
  Wallet2,
  Banknote,
  QrCode,
  Clock,
  PackageCheck,
  AlertTriangle,
  Receipt,
  UserCheck,
  Plus,
  ChevronRight,
  Sparkles,
  Building2,
} from 'lucide-react';
import { formatRupiah, formatNumber } from '../../utils/formatters';

// --------------------------------------------------------
// 1. GREETING HEADER COMPONENT
// --------------------------------------------------------
interface GreetingHeaderProps {
  dateText: string;
  greetingText: string;
  userName: string;
  roleBadge: string;
  timeRange?: 'today' | 'week' | 'month';
  setTimeRange?: (range: 'today' | 'week' | 'month') => void;
  showTimeRange?: boolean;
}

export const GreetingHeader: React.FC<GreetingHeaderProps> = ({
  dateText,
  greetingText,
  userName,
  roleBadge,
  timeRange = 'today',
  setTimeRange,
  showTimeRange = true,
}) => {
  return (
    <div className="bg-white border-b border-[#E5E7EB] px-4 lg:px-6 py-3.5 mb-5">
      <div className="w-full max-w-none flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] sm:text-xs font-semibold text-[#667085] uppercase tracking-wider mb-0.5">
            {dateText}
          </p>
          <h1 className="text-base sm:text-xl font-bold text-[#172033] tracking-tight flex items-center gap-1.5 flex-wrap">
            <span>{greetingText},</span>
            <span className="text-[#FF5A1F] font-extrabold">{userName}</span>
            <span className="ml-1 px-2 py-0.5 text-[10px] sm:text-xs font-bold rounded-full bg-[#FFF3ED] text-[#FF5A1F] border border-[#FF5A1F]/20 uppercase tracking-wider">
              {roleBadge}
            </span>
          </h1>
        </div>

        {showTimeRange && setTimeRange && (
          <div className="shrink-0">
            <div className="relative inline-block text-left">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as 'today' | 'week' | 'month')}
                className="bg-[#F7F8FA] hover:bg-[#F1F4F8] text-[#172033] text-xs font-semibold rounded-lg h-9 px-3 pr-8 border border-[#E5E7EB] cursor-pointer focus:outline-none focus:border-[#FF5A1F] transition-all appearance-none"
              >
                <option value="today">Hari ini</option>
                <option value="week">7 Hari Terakhir</option>
                <option value="month">Bulan Ini</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#667085]">
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --------------------------------------------------------
// 2. STAT CARD COMPONENT
// --------------------------------------------------------
interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconBgColor?: string;
  iconColor?: string;
  accentColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  trend,
  icon: Icon,
  iconBgColor = 'bg-orange-50',
  iconColor = 'text-[#FF641F]',
  accentColor,
}) => {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden flex flex-col justify-between">
      {accentColor && (
        <div className={`absolute top-0 left-0 right-0 h-1 ${accentColor}`} />
      )}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs sm:text-sm font-medium text-slate-500 line-clamp-1">
            {label}
          </span>
          {Icon && (
            <div className={`p-2 rounded-xl ${iconBgColor} ${iconColor} shrink-0`}>
              <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          )}
        </div>
        <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight my-1">
          {value}
        </div>
      </div>
      {(subtext || trend) && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          {subtext && <span className="line-clamp-1">{subtext}</span>}
          {trend && (
            <span className="font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md text-[11px]">
              {trend}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// --------------------------------------------------------
// 3. SECTION CARD CONTAINER
// --------------------------------------------------------
interface SectionCardProps {
  title: string;
  subtitle?: string;
  actionText?: string;
  onActionClick?: () => void;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  actionText,
  onActionClick,
  children,
  icon: Icon,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 mb-5">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF641F]" />}
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-slate-500 font-normal">{subtitle}</p>
            )}
          </div>
        </div>
        {actionText && onActionClick && (
          <button
            type="button"
            onClick={onActionClick}
            className="text-xs font-semibold text-[#FF641F] hover:text-orange-700 flex items-center gap-1 cursor-pointer hover:underline"
          >
            <span>{actionText}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
};

// --------------------------------------------------------
// 4. QUICK ACTION BUTTON
// --------------------------------------------------------
interface QuickActionProps {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  bgGradient?: string;
  badge?: string;
}

export const QuickAction: React.FC<QuickActionProps> = ({
  title,
  description,
  icon: Icon,
  onClick,
  bgGradient = 'from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 text-slate-800 border-orange-200/80',
  badge,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full text-left p-3.5 sm:p-4 rounded-2xl border bg-gradient-to-br ${bgGradient} transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs group flex items-start gap-3`}
    >
      <div className="p-2.5 rounded-xl bg-white shadow-2xs text-[#FF641F] group-hover:scale-105 transition-transform shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
            {title}
          </span>
          {badge && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-orange-500 text-white shrink-0">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-[11px] sm:text-xs text-slate-600 line-clamp-1 mt-0.5">
            {description}
          </p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#FF641F] group-hover:translate-x-0.5 transition-all self-center shrink-0" />
    </button>
  );
};

// --------------------------------------------------------
// 5. CASH OVERVIEW CARD
// --------------------------------------------------------
interface CashOverviewProps {
  totalCash: number;
  cashPhysical: number;
  qrisBalance: number;
  kasOwner?: number;
  bankBca?: number;
  bankJago?: number;
  bankMandiri?: number;
  walletGofood?: number;
  walletGrabfood?: number;
  walletShopeefood?: number;
  totalPlatformWallet?: number;
  totalLiquidity?: number;
  onManageCash?: () => void;
}

export const CashOverviewCard: React.FC<CashOverviewProps> = ({
  totalCash,
  cashPhysical,
  qrisBalance,
  kasOwner = 0,
  bankBca = 0,
  bankJago = 0,
  bankMandiri = 0,
  walletGofood = 0,
  walletGrabfood = 0,
  walletShopeefood = 0,
  totalPlatformWallet = 0,
  totalLiquidity,
  onManageCash,
}) => {
  const allLiquidity = totalLiquidity ?? totalCash + totalPlatformWallet;
  const bankTotal = bankBca + bankJago + bankMandiri;
  const kasTotal = cashPhysical + qrisBalance + kasOwner;

  return (
    <SectionCard
      title="SALDO KAS, DOMPET ONLINE & REKENING BANK"
      subtitle="Monitoring Posisi Keuangan & Dompet Platform Realtime"
      actionText={onManageCash ? 'Kelola Kas & Settlement →' : undefined}
      onActionClick={onManageCash}
      icon={Wallet2}
    >
      {/* Top Banner Total */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div>
          <span className="text-xs text-slate-400 font-bold block mb-0.5 uppercase tracking-wider">
            Total Aset Likuiditas (Kas + Bank + Dompet Online)
          </span>
          <span className="text-2xl sm:text-3xl font-black tracking-tight text-orange-400">
            {formatRupiah(allLiquidity)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-300">
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold">Kas &amp; Bank:</span>
            <span className="font-bold text-white">{formatRupiah(totalCash)}</span>
          </div>
          <div className="h-6 w-px bg-slate-700" />
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold">Dompet Online:</span>
            <span className="font-bold text-amber-400">{formatRupiah(totalPlatformWallet)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* 1. SALDO KAS */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
              <span>SALDO KAS ({formatRupiah(kasTotal)})</span>
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="bg-emerald-50/70 border border-emerald-200/80 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-900 block">Kas Kasir (Laci)</span>
                <span className="text-xs font-medium text-emerald-700">Uang fisik laci</span>
              </div>
              <span className="text-sm font-black text-emerald-800">{formatRupiah(cashPhysical)}</span>
            </div>

            <div className="bg-purple-50/70 border border-purple-200/80 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-purple-900 block">Kas QRIS</span>
                <span className="text-xs font-medium text-purple-700">Non-tunai digital</span>
              </div>
              <span className="text-sm font-black text-purple-800">{formatRupiah(qrisBalance)}</span>
            </div>

            <div className="bg-amber-50/70 border border-amber-200/80 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-900 block">Kas Owner</span>
                <span className="text-xs font-medium text-amber-700">Diambil Owner</span>
              </div>
              <span className="text-sm font-black text-amber-800">{formatRupiah(kasOwner)}</span>
            </div>
          </div>
        </div>

        {/* 2. DOMPET ONLINE */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Wallet2 className="w-3.5 h-3.5 text-[#FF641F]" />
              <span>DOMPET ONLINE ({formatRupiah(totalPlatformWallet)})</span>
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Saldo tertahan platform</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="bg-red-50/70 border border-red-200/80 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-red-900 block">GoFood</span>
                <span className="text-xs font-medium text-red-700">WALLET_GOFOOD</span>
              </div>
              <span className="text-sm font-black text-red-800">{formatRupiah(walletGofood)}</span>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200/80 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-900 block">GrabFood</span>
                <span className="text-xs font-medium text-emerald-700">WALLET_GRABFOOD</span>
              </div>
              <span className="text-sm font-black text-emerald-800">{formatRupiah(walletGrabfood)}</span>
            </div>

            <div className="bg-orange-50/70 border border-orange-200/80 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-orange-900 block">ShopeeFood</span>
                <span className="text-xs font-medium text-orange-700">WALLET_SHOPEEFOOD</span>
              </div>
              <span className="text-sm font-black text-[#FF641F]">{formatRupiah(walletShopeefood)}</span>
            </div>
          </div>
        </div>

        {/* 3. BANK */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>BANK ({formatRupiah(bankTotal)})</span>
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="bg-blue-50/70 border border-blue-200/80 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-blue-900 block">BCA</span>
                <span className="text-xs font-medium text-blue-700">Rekening Bank</span>
              </div>
              <span className="text-sm font-black text-blue-800">{formatRupiah(bankBca)}</span>
            </div>

            <div className="bg-sky-50/70 border border-sky-200/80 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-sky-900 block">Jago</span>
                <span className="text-xs font-medium text-sky-700">Rekening Bank</span>
              </div>
              <span className="text-sm font-black text-sky-800">{formatRupiah(bankJago)}</span>
            </div>

            <div className="bg-indigo-50/70 border border-indigo-200/80 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-indigo-900 block">Mandiri</span>
                <span className="text-xs font-medium text-indigo-700">Rekening Bank</span>
              </div>
              <span className="text-sm font-black text-indigo-800">{formatRupiah(bankMandiri)}</span>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
};

// --------------------------------------------------------
// 6. RECENT ACTIVITY FEED
// --------------------------------------------------------
interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  timeAgo: string;
  type: 'sale' | 'production' | 'purchase';
  amount?: number;
}

interface RecentActivityFeedProps {
  activities: ActivityItem[];
  onViewAll?: () => void;
}

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({
  activities,
  onViewAll,
}) => {
  return (
    <SectionCard
      title="AKTIVITAS TERBARU"
      subtitle="Transaksi & Produksi Terkini"
      actionText={onViewAll ? 'Lihat Semua' : undefined}
      onActionClick={onViewAll}
      icon={Clock}
    >
      {activities.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">
          Belum ada aktivitas baru hari ini
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {activities.map((act) => {
            const IconComponent =
              act.type === 'sale'
                ? ShoppingBag
                : act.type === 'production'
                ? Factory
                : PackageCheck;
            const bgClass =
              act.type === 'sale'
                ? 'bg-emerald-50 text-emerald-600'
                : act.type === 'production'
                ? 'bg-amber-50 text-amber-600'
                : 'bg-blue-50 text-blue-600';

            return (
              <div
                key={act.id}
                className="py-2.5 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-2 rounded-xl ${bgClass} shrink-0`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">
                      {act.title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {act.subtitle}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {act.amount !== undefined && (
                    <p className="font-bold text-slate-900">
                      {formatRupiah(act.amount)}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400">{act.timeAgo}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
};

// --------------------------------------------------------
// 7. STOCK ALERTS CARD
// --------------------------------------------------------
interface StockAlertItem {
  id: string;
  name: string;
  currentStock: number;
  unit: string;
  minStock: number;
  isCritical?: boolean;
}

interface StockAlertsCardProps {
  alerts: StockAlertItem[];
  onManageStock?: () => void;
}

export const StockAlertsCard: React.FC<StockAlertsCardProps> = ({
  alerts,
  onManageStock,
}) => {
  return (
    <SectionCard
      title="PERINGATAN STOK MENIPIS"
      subtitle="Bahan & Produk Perlu Restock"
      actionText={onManageStock ? 'Kelola Stok →' : undefined}
      onActionClick={onManageStock}
      icon={AlertTriangle}
    >
      {alerts.length === 0 ? (
        <div className="py-3 px-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-2 text-xs text-emerald-700">
          <PackageCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Semua stok bahan baku & produk dalam kondisi aman.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((item) => (
            <div
              key={item.id}
              className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                item.isCritical
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle
                  className={`w-4 h-4 shrink-0 ${
                    item.isCritical ? 'text-rose-600' : 'text-amber-600'
                  }`}
                />
                <span className="font-semibold truncate">{item.name}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-extrabold text-sm">
                  {formatNumber(item.currentStock)} {item.unit}
                </span>
                <span className="text-[10px] block opacity-75">
                  Min: {formatNumber(item.minStock)} {item.unit}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
};

// --------------------------------------------------------
// 8. FLOATING POS BUTTON FOR MOBILE
// --------------------------------------------------------
interface FloatingPOSButtonProps {
  onClick: () => void;
  label?: string;
}

export const FloatingPOSButton: React.FC<FloatingPOSButtonProps> = ({
  onClick,
  label = 'Buka Kasir',
}) => {
  return (
    <div className="lg:hidden fixed bottom-18 left-0 right-0 z-30 flex justify-center pointer-events-none px-4">
      <button
        type="button"
        onClick={onClick}
        className="pointer-events-auto w-[200px] h-[52px] sm:h-[58px] rounded-full bg-gradient-to-r from-[#FF641F] to-orange-600 text-white font-bold text-sm shadow-xl shadow-orange-500/30 active:scale-95 hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/20"
      >
        <ShoppingBag className="w-5 h-5" />
        <span>{label}</span>
        <ArrowRight className="w-4 h-4 ml-0.5" />
      </button>
    </div>
  );
};
