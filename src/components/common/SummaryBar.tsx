import React from 'react';

export interface SummaryBarItem {
  label: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  valueClassName?: string;
}

interface SummaryBarProps {
  items: SummaryBarItem[];
  className?: string;
}

/**
 * Global SummaryBar for AYAM GEPREK ARY POS
 * Compact horizontal summary bar instead of 4-6 oversized stat cards.
 */
export const SummaryBar: React.FC<SummaryBarProps> = ({
  items,
  className = '',
}) => {
  if (!items || items.length === 0) return null;

  const gridColsClass =
    items.length === 1
      ? 'grid-cols-1'
      : items.length === 2
      ? 'grid-cols-2'
      : items.length === 3
      ? 'grid-cols-3'
      : items.length === 4
      ? 'grid-cols-2 sm:grid-cols-4'
      : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5';

  return (
    <div
      className={`bg-white rounded-xl border border-[#E8ECF2] px-4 py-3 ${className}`}
    >
      <div
        className={`grid ${gridColsClass} gap-y-3 divide-x divide-[#E8ECF2] text-left tabular-nums`}
      >
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`${idx === 0 ? 'pr-3 sm:pr-5' : 'px-3 sm:px-5'} min-w-0`}
          >
            <span className="text-[11px] font-medium text-[#667085] block truncate">
              {item.label}
            </span>
            <div
              className={`text-sm sm:text-base font-bold mt-0.5 truncate ${
                item.valueClassName || 'text-[#172033]'
              }`}
            >
              {item.value}
            </div>
            {item.subValue && (
              <div className="text-[11px] text-[#667085] mt-0.5 truncate">
                {item.subValue}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
