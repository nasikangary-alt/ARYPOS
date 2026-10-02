import React from 'react';

interface AyamLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const AyamLogo: React.FC<AyamLogoProps> = ({ size = 'md', className = '' }) => {
  const sizeMap = {
    sm: 'w-8 h-8 text-base',
    md: 'w-10 h-10 text-xl',
    lg: 'w-14 h-14 text-2xl',
  };

  return (
    <div
      className={`relative shrink-0 rounded-full bg-gradient-to-br from-red-600 via-orange-600 to-amber-500 flex items-center justify-center text-white shadow-sm ring-2 ring-red-100 dark:ring-red-950 select-none ${sizeMap[size]} ${className}`}
    >
      {/* Stylized Chicken Avatar */}
      <span role="img" aria-label="Ayam Geprek ARY">
        🍗
      </span>
      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-black text-red-700">
        ★
      </span>
    </div>
  );
};
