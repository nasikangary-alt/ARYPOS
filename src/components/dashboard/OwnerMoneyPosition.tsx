import React from 'react';
import { formatRupiah } from '../../utils/formatters';
import { Wallet, ChevronRight, AlertTriangle } from 'lucide-react';

interface OwnerMoneyPositionProps {
  totalSaldo: number;
  cashPhysical: number;
  qrisBalance: number;
  kasOwner: number;
  bankBca: number;
  bankJago: number;
  bankMandiri: number;
  walletGofood: number;
  walletGrabfood: number;
  walletShopeefood: number;
  totalPlatformWallet: number;
  totalLiquidity: number;
  onManageCash: () => void;
}

export const OwnerMoneyPosition: React.FC<OwnerMoneyPositionProps> = ({
  totalSaldo,
  cashPhysical,
  qrisBalance,
  kasOwner,
  bankBca,
  bankJago,
  bankMandiri,
  walletGofood,
  walletGrabfood,
  walletShopeefood,
  totalPlatformWallet,
  totalLiquidity,
  onManageCash,
}) => {
  // Grouped balances
  const totalKasPhysical = cashPhysical + kasOwner;
  const totalBankAccounts = bankBca + bankJago + bankMandiri + qrisBalance;
  const totalOnlineWallets = walletGofood + walletGrabfood + walletShopeefood;

  return (
    <div className="bg-white rounded-2xl border border-[#E8ECF2] shadow-2xs p-4 sm:p-5 flex flex-col justify-between">
      <div>
        {/* Header Row */}
        <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 text-[#12B76A]">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[#172033] tracking-tight">
                POSISI UANG
              </h3>
              <p className="text-[11px] sm:text-xs text-[#667085]">
                Sebaran saldo &amp; likuiditas kas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onManageCash}
            className="text-xs font-bold text-[#FF641F] hover:text-orange-700 flex items-center gap-0.5 cursor-pointer hover:underline"
          >
            <span>Kelola</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* TOTAL SALDO LIKUIDITAS */}
        <div className="mb-3.5 bg-[#F7F8FA] border border-[#E8ECF2] p-3 rounded-xl">
          <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block mb-0.5">
            TOTAL SALDO LIKUIDITAS
          </span>
          <span className="text-2xl font-black text-[#172033] block tracking-tight">
            {formatRupiah(totalLiquidity)}
          </span>
        </div>

        {/* 3 Compact Rows: Kas, Dompet Online, Rekening Bank */}
        <div className="space-y-1.5 text-xs">
          {/* Row 1: Kas */}
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
            <span className="font-semibold text-[#172033]">Kas</span>
            <span className="font-extrabold text-[#172033]">
              {formatRupiah(totalKasPhysical)}
            </span>
          </div>

          {/* Row 2: Dompet Online */}
          <div className="py-1.5 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#172033]">Dompet Online</span>
              <span className="font-extrabold text-[#172033]">
                {formatRupiah(totalOnlineWallets)}
              </span>
            </div>
            {totalOnlineWallets > 0 && (
              <div className="flex items-center gap-1 text-[10px] font-bold text-[#F79009] mt-0.5">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>⚠ {formatRupiah(totalOnlineWallets)} belum settlement</span>
              </div>
            )}
          </div>

          {/* Row 3: Rekening Bank */}
          <div className="flex items-center justify-between py-1.5">
            <span className="font-semibold text-[#172033]">Rekening Bank</span>
            <span className="font-extrabold text-[#172033]">
              {formatRupiah(totalBankAccounts)}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Action Button */}
      <div className="mt-3.5 pt-2.5 border-t border-[#E8ECF2]">
        <button
          type="button"
          onClick={onManageCash}
          className="w-full py-2 px-3 rounded-xl bg-[#F7F8FA] hover:bg-[#F1F4F8] text-[#172033] font-bold text-xs flex items-center justify-center gap-1 border border-[#E8ECF2] transition-all cursor-pointer"
        >
          <span>Lihat Detail Rekening</span>
          <ChevronRight className="w-3.5 h-3.5 text-[#667085]" />
        </button>
      </div>
    </div>
  );
};
