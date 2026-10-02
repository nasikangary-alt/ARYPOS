import React from 'react';
import { Search, X } from 'lucide-react';

interface PageToolbarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  bottomSlot?: React.ReactNode;
  className?: string;
}

/**
 * Global PageToolbar for AYAM GEPREK ARY POS
 * Standard structure:
 * [ Search........................ ] [Filter] [Filter] [Periode] [Action]
 */
export const PageToolbar: React.FC<PageToolbarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Cari data...',
  filters,
  actions,
  children,
  bottomSlot,
  className = '',
}) => {
  return (
    <div
      className={`bg-white rounded-xl border border-[#E8ECF2] p-3 space-y-2.5 ${className}`}
    >
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
        {onSearchChange !== undefined && (
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-[#667085] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-9 pl-9 pr-8 rounded-lg border border-[#E8ECF2] bg-white text-xs text-[#172033] placeholder:text-[#667085] focus:outline-none focus:border-[#FF641F] transition"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#172033] p-0.5 cursor-pointer"
                title="Bersihkan pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {filters && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {filters}
          </div>
        )}

        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 md:ml-auto">
            {actions}
          </div>
        )}

        {children}
      </div>

      {bottomSlot && (
        <div className="pt-2 border-t border-[#E8ECF2]">{bottomSlot}</div>
      )}
    </div>
  );
};
