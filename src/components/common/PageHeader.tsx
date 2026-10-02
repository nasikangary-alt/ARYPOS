import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Global PageHeader for AYAM GEPREK ARY POS
 * Standard structure:
 * - Left: optional breadcrumb, h1 page title, p short description
 * - Right: primary actions
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumb,
  actions,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${className}`}
    >
      <div className="min-w-0">
        {breadcrumb && <div className="mb-1">{breadcrumb}</div>}
        <h1 className="text-lg sm:text-xl font-bold text-[#172033] tracking-tight leading-snug">
          {title}
        </h1>
        {description && (
          <p className="text-xs text-[#667085] mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};
