import React from 'react';

export interface AryBrandLogoProps {
  variant?: 'full' | 'icon' | 'badge';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  className?: string;
  alt?: string;
}

const SIZE_MAP_FULL = {
  xs: 'h-8 w-auto',
  sm: 'h-12 w-auto',
  md: 'h-20 w-auto',
  lg: 'h-28 w-auto',
  xl: 'h-36 w-auto',
  custom: '',
};

const SIZE_MAP_ICON = {
  xs: 'w-7 h-7 rounded-lg',
  sm: 'w-9 h-9 rounded-xl',
  md: 'w-12 h-12 rounded-2xl',
  lg: 'w-16 h-16 rounded-2xl',
  xl: 'w-24 h-24 rounded-3xl',
  custom: '',
};

export const AryBrandLogo: React.FC<AryBrandLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  alt = 'Ayam Geprek ARY',
}) => {
  if (variant === 'icon') {
    return (
      <img
        src="/ary-logo-icon.svg"
        alt={alt}
        className={`object-contain shadow-xs select-none ${SIZE_MAP_ICON[size]} ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }

  if (variant === 'badge') {
    return (
      <div className={`relative inline-flex items-center justify-center select-none ${SIZE_MAP_ICON[size]} ${className}`}>
        <img
          src="/ary-logo-icon.svg"
          alt={alt}
          className="w-full h-full object-contain rounded-2xl shadow-sm"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // Master Full Logo (Transparent background)
  return (
    <img
      src="/ary-logo-full.svg"
      alt={alt}
      className={`object-contain select-none ${SIZE_MAP_FULL[size]} ${className}`}
      referrerPolicy="no-referrer"
    />
  );
};
