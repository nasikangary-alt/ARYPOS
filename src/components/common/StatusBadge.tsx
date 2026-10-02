import React from 'react';

export type StatusBadgeVariant =
  | 'selesai'
  | 'void'
  | 'aman'
  | 'kritis'
  | 'menipis'
  | 'aktif'
  | 'nonaktif'
  | 'offline'
  | 'gofood'
  | 'grabfood'
  | 'shopeefood'
  | 'lunas'
  | 'sebagian'
  | 'belum_dibayar'
  | 'info'
  | 'neutral';

interface StatusBadgeProps {
  variant?: StatusBadgeVariant;
  status?: string;
  label?: string;
  className?: string;
}

const VARIANT_STYLES: Record<
  StatusBadgeVariant,
  { defaultLabel: string; className: string }
> = {
  selesai: {
    defaultLabel: 'Selesai',
    className: 'bg-[#ECFDF3] text-[#12B76A] border-[#ABEFC6]',
  },
  lunas: {
    defaultLabel: 'Lunas',
    className: 'bg-[#ECFDF3] text-[#12B76A] border-[#ABEFC6]',
  },
  aman: {
    defaultLabel: 'Aman',
    className: 'bg-[#ECFDF3] text-[#12B76A] border-[#ABEFC6]',
  },
  aktif: {
    defaultLabel: 'Aktif',
    className: 'bg-[#ECFDF3] text-[#12B76A] border-[#ABEFC6]',
  },
  void: {
    defaultLabel: 'Void',
    className: 'bg-[#FEF3F2] text-[#D92D20] border-[#FECDCA]',
  },
  kritis: {
    defaultLabel: 'Kritis',
    className: 'bg-[#FEF3F2] text-[#D92D20] border-[#FECDCA]',
  },
  belum_dibayar: {
    defaultLabel: 'Belum Dibayar',
    className: 'bg-[#FEF3F2] text-[#D92D20] border-[#FECDCA]',
  },
  menipis: {
    defaultLabel: 'Menipis',
    className: 'bg-[#FFFAEB] text-[#F79009] border-[#FEDF89]',
  },
  sebagian: {
    defaultLabel: 'Sebagian',
    className: 'bg-[#FFFAEB] text-[#F79009] border-[#FEDF89]',
  },
  nonaktif: {
    defaultLabel: 'Nonaktif',
    className: 'bg-[#F2F4F7] text-[#667085] border-[#E8ECF2]',
  },
  offline: {
    defaultLabel: 'OFFLINE',
    className: 'bg-[#F2F4F7] text-[#172033] border-[#E8ECF2]',
  },
  gofood: {
    defaultLabel: 'GOFOOD',
    className: 'bg-[#ECFDF3] text-[#12B76A] border-[#ABEFC6]',
  },
  grabfood: {
    defaultLabel: 'GRABFOOD',
    className: 'bg-[#ECFDF3] text-[#12B76A] border-[#ABEFC6]',
  },
  shopeefood: {
    defaultLabel: 'SHOPEEFOOD',
    className: 'bg-[#FFF4ED] text-[#FF641F] border-[#F9DBAF]',
  },
  info: {
    defaultLabel: 'Info',
    className: 'bg-[#EFF8FF] text-[#1570EF] border-[#B2DDFF]',
  },
  neutral: {
    defaultLabel: '-',
    className: 'bg-[#F2F4F7] text-[#667085] border-[#E8ECF2]',
  },
};

function resolveVariant(
  variant?: StatusBadgeVariant,
  status?: string
): StatusBadgeVariant {
  if (variant) return variant;
  const s = (status || '').trim().toLowerCase();
  if (s === 'completed' || s === 'selesai') return 'selesai';
  if (s === 'void' || s === 'dibatalkan' || s === 'batal') return 'void';
  if (s === 'aman' || s === 'normal' || s === 'ok') return 'aman';
  if (s === 'kritis' || s === 'habis' || s === 'critical') return 'kritis';
  if (s === 'menipis' || s === 'low' || s === 'warning') return 'menipis';
  if (s === 'aktif' || s === 'active' || s === 'open') return 'aktif';
  if (s === 'nonaktif' || s === 'inactive' || s === 'closed') return 'nonaktif';
  if (s === 'offline') return 'offline';
  if (s === 'gofood') return 'gofood';
  if (s === 'grabfood') return 'grabfood';
  if (s === 'shopeefood') return 'shopeefood';
  if (s === 'lunas') return 'lunas';
  if (s === 'sebagian') return 'sebagian';
  if (s === 'belum_dibayar' || s === 'hutang') return 'belum_dibayar';
  return 'neutral';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  variant,
  status,
  label,
  className = '',
}) => {
  const resolved = resolveVariant(variant, status);
  const style = VARIANT_STYLES[resolved] || VARIANT_STYLES.neutral;
  const displayText = label ?? status ?? style.defaultLabel;

  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md border text-[11px] font-semibold leading-tight whitespace-nowrap ${style.className} ${className}`}
    >
      {displayText}
    </span>
  );
};
