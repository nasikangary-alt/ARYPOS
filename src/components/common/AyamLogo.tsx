import React from 'react';

interface AyamLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const AyamLogo: React.FC<AyamLogoProps> = ({ size = 'md', className = '' }) => {
  const sizeMap = {
    sm: 'w-8 h-8 rounded-xl',
    md: 'w-10 h-10 rounded-2xl',
    lg: 'w-14 h-14 rounded-2xl',
  };

  return (
    <img
      src="/ary-logo-icon.svg"
      alt="Ayam Geprek ARY"
      className={`shrink-0 object-contain shadow-xs select-none ${sizeMap[size]} ${className}`}
      referrerPolicy="no-referrer"
    />
  );
};
