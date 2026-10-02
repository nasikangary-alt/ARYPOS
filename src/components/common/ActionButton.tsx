import React from 'react';

export type ActionButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ActionButtonSize = 'sm' | 'md';

interface ActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Global ActionButton for AYAM GEPREK ARY POS
 * Standard:
 * - Primary: bg-[#FF641F] text-white rounded-xl
 * - Secondary: bg-white border-[#E8ECF2] text-[#172033]
 * - Danger: bg-[#FEF3F2] text-[#D92D20] border-[#FECDCA]
 * - Height: 36-40px, font 12-13px, icon 14-16px
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  type = 'button',
  ...props
}) => {
  const variantClasses: Record<ActionButtonVariant, string> = {
    primary:
      'bg-[#FF641F] hover:bg-[#E05315] text-white border border-[#FF641F]',
    secondary:
      'bg-white hover:bg-[#F9FAFB] text-[#172033] border border-[#E8ECF2]',
    danger:
      'bg-[#FEF3F2] hover:bg-[#FEE4E2] text-[#D92D20] border border-[#FECDCA]',
    ghost:
      'bg-transparent hover:bg-[#F1F4F8] text-[#667085] hover:text-[#172033] border border-transparent',
  };

  const sizeClasses: Record<ActionButtonSize, string> = {
    sm: 'h-8 px-2.5 text-xs gap-1.5 rounded-lg',
    md: 'h-9 px-3.5 text-xs gap-1.5 rounded-xl',
  };

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center font-semibold transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0 whitespace-nowrap ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      {children && <span>{children}</span>}
    </button>
  );
};
