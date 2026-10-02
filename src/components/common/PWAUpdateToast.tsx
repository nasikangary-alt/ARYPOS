import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const PWAUpdateToast: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Check for service worker updates periodically (e.g. every 60 minutes)
        setInterval(() => {
          r.update().catch((err) => console.error('SW update check error:', err));
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('SW registration failed:', error);
    },
  });

  const isOnline = useOnlineStatus();

  return (
    <>
      {/* 1. Offline Connectivity Notice */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#F79009] text-white py-1 px-4 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-md animate-in slide-in-from-top duration-200">
          <WifiOff className="w-3.5 h-3.5 shrink-0 animate-pulse" />
          <span>
            Mode Offline — Terputus dari internet. Tampilan aplikasi aktif dari cache, sinkronisasi data online ditangguhkan.
          </span>
        </div>
      )}

      {/* 2. New Version Available Update Prompt */}
      {needRefresh && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] bg-white rounded-2xl p-4 border border-[#E8ECF2] shadow-2xl space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-orange-50 text-[#FF641F]">
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-[#172033]">
                  Pembaruan ARY POS Tersedia
                </h4>
                <p className="text-[11px] text-[#667085] mt-0.5">
                  Versi terbaru siap digunakan. Perbarui sekarang untuk fitur &amp; perbaikan terkini.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              className="flex-1 py-2 px-3 rounded-xl border border-[#E8ECF2] text-xs font-bold text-[#667085] hover:bg-slate-50 cursor-pointer transition"
            >
              Nanti
            </button>
            <button
              type="button"
              onClick={() => updateServiceWorker(true)}
              className="flex-1 py-2 px-3 rounded-xl bg-[#FF641F] hover:bg-orange-600 text-xs font-extrabold text-white shadow-2xs cursor-pointer transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Update Sekarang</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
