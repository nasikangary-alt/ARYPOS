import React from 'react';
import { PaymentStatus } from '../../types';
import { CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';

interface PurchaseStatusBadgeProps {
  status: PaymentStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

export const PurchaseStatusBadge: React.FC<PurchaseStatusBadgeProps> = ({
  status,
  size = 'md',
}) => {
  const normalized = (status || 'BELUM_DIBAYAR').toUpperCase();

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-[11px] gap-1.5',
    lg: 'px-3 py-1.5 text-xs gap-2',
  }[size];

  if (normalized === 'LUNAS') {
    return (
      <span
        className={`inline-flex items-center rounded-full font-bold bg-[#ECFDF3] text-[#12B76A] border border-[#A6F4C5]/60 ${sizeClasses}`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
        <span>Lunas</span>
      </span>
    );
  }

  if (normalized === 'SEBAGIAN') {
    return (
      <span
        className={`inline-flex items-center rounded-full font-bold bg-[#FFFAEB] text-[#B54708] border border-[#FEDF89]/70 ${sizeClasses}`}
      >
        <Clock className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
        <span>Dibayar Sebagian</span>
      </span>
    );
  }

  if (normalized === 'VOID') {
    return (
      <span
        className={`inline-flex items-center rounded-full font-bold bg-[#F2F4F7] text-[#667085] border border-[#E4E7EC] ${sizeClasses}`}
      >
        <XCircle className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
        <span>Dibatalkan (Void)</span>
      </span>
    );
  }

  // Default: BELUM_DIBAYAR
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold bg-[#FEF3F2] text-[#D92D20] border border-[#FECDCA]/70 ${sizeClasses}`}
    >
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
      <span>Belum Dibayar</span>
    </span>
  );
};
