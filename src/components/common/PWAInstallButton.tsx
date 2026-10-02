import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Smartphone, X, Check } from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'sidebar' | 'modal' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running as an installed standalone PWA, suppress the button
  if (isInstalled) return null;

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    if (variant === 'sidebar') {
      return (
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={isInstalling}
          className={`w-full py-2 px-3 rounded-xl text-left text-xs font-bold text-white bg-[#FF641F] hover:bg-orange-600 transition flex items-center justify-between shadow-xs cursor-pointer ${className}`}
          title="Install aplikasi ARY POS ke perangkat"
        >
          <span className="flex items-center gap-2">
            <Download className="w-4 h-4 shrink-0" />
            <span>Install ARY POS</span>
          </span>
          <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-white/20">
            PWA
          </span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleInstallClick}
        disabled={isInstalling}
        className={`h-8 px-2.5 rounded-lg bg-[#FFF3ED] hover:bg-orange-100 text-[#FF641F] border border-[#FF641F]/30 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${className}`}
        title="Pasang aplikasi ARY POS ke layar utama"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Install PWA</span>
        <span className="sm:hidden">Install</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not natively supported by WebKit)
  if (isIOS) {
    return (
      <>
        {variant === 'sidebar' ? (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className={`w-full py-2 px-3 rounded-xl text-left text-xs font-bold text-slate-300 bg-[#131F37] hover:bg-[#1E293B] border border-[#1E293B] transition flex items-center justify-between cursor-pointer ${className}`}
          >
            <span className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#FF641F]" />
              <span>Install di iPhone</span>
            </span>
            <span className="text-[10px] text-slate-400 font-bold">iOS</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className={`h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-200 ${className}`}
            title="Cara install ARY POS di iPhone/iPad"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#FF641F]" />
            <span className="hidden sm:inline">Install di iOS</span>
            <span className="sm:hidden">iOS</span>
          </button>
        )}

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-[#E8ECF2] space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-orange-50 text-[#FF641F]">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#172033]">
                      Install di iPhone / iPad
                    </h3>
                    <p className="text-[11px] text-[#667085]">
                      Jadikan ARY POS aplikasi mandiri
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-[#172033]">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#F7F8FA] border border-[#E8ECF2]">
                  <span className="w-5 h-5 rounded-full bg-[#FF641F] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                    1
                  </span>
                  <p>
                    Buka situs ini di browser <strong>Safari</strong> pada iPhone atau iPad Anda.
                  </p>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#F7F8FA] border border-[#E8ECF2]">
                  <span className="w-5 h-5 rounded-full bg-[#FF641F] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                    2
                  </span>
                  <p>
                    Tekan tombol <strong>Share / Bagikan</strong> (ikon kotak dengan panah ke atas) di bilah bawah Safari.
                  </p>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#F7F8FA] border border-[#E8ECF2]">
                  <span className="w-5 h-5 rounded-full bg-[#FF641F] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                    3
                  </span>
                  <p>
                    Gulir ke bawah dan pilih <strong>"Tambahkan ke Layar Utama" (Add to Home Screen)</strong>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-[#FF641F] hover:bg-orange-600 font-extrabold text-xs text-white shadow-2xs cursor-pointer transition"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
