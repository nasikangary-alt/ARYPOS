import React from 'react';

interface DataTableProps {
  children: React.ReactNode;
  emptyState?: React.ReactNode;
  isEmpty?: boolean;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Global DataTable wrapper for AYAM GEPREK ARY POS
 * Standard:
 * - Container: bg-white border border-[#E8ECF2] rounded-xl overflow-hidden
 * - Header: bg-[#F9FAFB]
 * - Row: white with hover:bg-[#F9FAFB]
 * - Border: #E8ECF2
 */
export const DataTable: React.FC<DataTableProps> = ({
  children,
  emptyState,
  isEmpty = false,
  footer,
  className = '',
}) => {
  return (
    <div
      className={`bg-white rounded-xl border border-[#E8ECF2] overflow-hidden w-full ${className}`}
    >
      {isEmpty && emptyState ? (
        <div className="py-12 px-4 text-center">{emptyState}</div>
      ) : (
        <>
          <div className="w-full overflow-x-auto">{children}</div>
          {footer && (
            <div className="px-4 py-3 border-t border-[#E8ECF2] bg-white">
              {footer}
            </div>
          )}
        </>
      )}
    </div>
  );
};
