import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, ArrowRight, Delete, AlertCircle, Loader2 } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { loginWithCredentials } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDial = useCallback((digit: string) => {
    setErrorMessage(null);
    setPin((prev) => (prev.length < 6 ? prev + digit : prev));
  }, []);

  const handleBackspace = useCallback(() => {
    setErrorMessage(null);
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setErrorMessage(null);
    setPin('');
  }, []);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (isLoading) return;

      if (!identifier.trim() || !pin.trim()) {
        setErrorMessage('Username atau PIN salah.');
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        await loginWithCredentials(identifier, pin);
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Username atau PIN salah.'
        );
        setIsLoading(false);
      }
    },
    [identifier, pin, isLoading, loginWithCredentials]
  );

  // Support physical numeric keypad when not typing inside the username input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') {
        if (e.key === 'Enter') {
          e.preventDefault();
          (document.activeElement as HTMLElement)?.blur();
        }
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDial(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleDial, handleBackspace, handleClear, handleSubmit]);

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-white text-[#172033] flex flex-col items-center justify-center px-5 py-4 select-none app-login-container">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[360px] h-full max-h-[680px] flex flex-col justify-between py-1"
      >
        {/* 1. Master Brand & Logo Header */}
        <div className="flex flex-col items-center text-center pt-1">
          <img
            src="/ary-logo-full.svg"
            alt="Ayam Geprek ARY"
            className="w-auto h-[92px] max-w-[290px] object-contain mb-1 drop-shadow-xs select-none"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* 2. Username Input & Error Feedback */}
        <div className="space-y-2">
          <div>
            <label
              htmlFor="ary-login-username"
              className="block text-[12px] font-semibold text-[#172033] mb-1.5"
            >
              Username / ID Karyawan
            </label>
            <div className="relative flex items-center">
              <User className="w-[18px] h-[18px] text-[#8E8E93] absolute left-4 pointer-events-none" />
              <input
                id="ary-login-username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={identifier}
                onChange={(e) => {
                  setErrorMessage(null);
                  setIdentifier(e.target.value);
                }}
                placeholder="Masukkan username"
                className="w-full h-[52px] pl-11 pr-4 rounded-[16px] bg-[#F7F7F8] border border-[#E5E5EA] text-[15px] font-semibold text-[#172033] placeholder:text-[#8E8E93] placeholder:font-normal focus:outline-none focus:border-[#FF641F] focus:bg-white transition-colors"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="px-3.5 py-2 rounded-[14px] bg-[#FEF3F2] border border-[#FECDCA] text-[#D92D20] text-[12px] font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#D92D20] shrink-0" />
              <span className="truncate">{errorMessage}</span>
            </div>
          )}
        </div>

        {/* 3. PIN Indicator & Compact iOS Keypad */}
        <div className="space-y-3">
          <div className="text-center space-y-2">
            <span className="block text-[12px] font-semibold text-[#8E8E93]">
              PIN Keamanan
            </span>
            <div className="flex items-center justify-center gap-3.5 py-0.5">
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const isFilled = pin.length > index;
                return (
                  <div
                    key={index}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                      isFilled
                        ? 'bg-[#FF641F] border border-[#FF641F] scale-110'
                        : 'bg-transparent border-[1.75px] border-[#C7C7CC]'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Numeric Keypad */}
          <div className="grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDial(digit)}
                className="h-[52px] rounded-[16px] bg-[#F7F7F8] hover:bg-[#EFEFF4] active:bg-[#E5E5EA] active:scale-[0.97] border border-[#E5E5EA]/80 text-[20px] font-bold text-[#172033] flex items-center justify-center transition-all cursor-pointer"
              >
                {digit}
              </button>
            ))}

            <button
              type="button"
              onClick={handleClear}
              className="h-[52px] rounded-[16px] bg-[#F7F7F8] hover:bg-[#EFEFF4] active:bg-[#E5E5EA] active:scale-[0.97] border border-[#E5E5EA]/80 text-[13px] font-semibold text-[#8E8E93] hover:text-[#172033] flex items-center justify-center transition-all cursor-pointer"
            >
              Hapus
            </button>

            <button
              type="button"
              onClick={() => handleDial('0')}
              className="h-[52px] rounded-[16px] bg-[#F7F7F8] hover:bg-[#EFEFF4] active:bg-[#E5E5EA] active:scale-[0.97] border border-[#E5E5EA]/80 text-[20px] font-bold text-[#172033] flex items-center justify-center transition-all cursor-pointer"
            >
              0
            </button>

            <button
              type="button"
              onClick={handleBackspace}
              aria-label="Hapus satu digit"
              className="h-[52px] rounded-[16px] bg-[#F7F7F8] hover:bg-[#EFEFF4] active:bg-[#E5E5EA] active:scale-[0.97] border border-[#E5E5EA]/80 text-[#172033] flex items-center justify-center transition-all cursor-pointer"
            >
              <Delete className="w-5 h-5 text-[#172033]" />
            </button>
          </div>
        </div>

        {/* 4. Primary Action Button */}
        <div className="pt-1">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-[54px] rounded-[17px] bg-[#FF641F] hover:bg-[#F45116] active:scale-[0.99] text-white font-bold text-[15px] tracking-tight shadow-[0_8px_20px_rgba(255,100,31,0.25)] flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <ArrowRight className="w-5 h-5" />
                <span>MASUK KE POS</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
