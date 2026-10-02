import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

/**
 * Global PageContainer for AYAM GEPREK ARY POS
 * Standard:
 * - width: 100%
 * - max-width: none
 * - margin: 0
 * - padding: 24px (p-6 on desktop, p-4 on mobile)
 * - section gap: 20-24px (space-y-5)
 * - background: #F7F8FA
 * - text: #172033
 */
export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className = '',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`w-full max-w-none m-0 p-4 lg:p-6 box-border min-h-[calc(100vh-56px)] bg-[#F7F8FA] text-[#172033] space-y-5 ${className}`}
    >
      {children}
    </div>
  );
};
