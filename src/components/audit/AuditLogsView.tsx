import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatDateTimeIndonesian, formatNumber } from '../../utils/formatters';
import { PageContainer } from '../common/PageContainer';
import { PageHeader } from '../common/PageHeader';
import { ShieldAlert, User } from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const { stockMovements, sales } = useApp();

  // Combine important audit events: voided sales and manual adjustments / waste
  const voidSales = sales
    .filter(s => s.status === 'VOID')
    .map(s => ({
      id: `void_${s.id}`,
      createdAt: s.updatedAt || s.createdAt,
      type: 'VOID_TRANSACTION',
      title: `Pembatalan Transaksi ${s.transactionNo}`,
      actor: s.cashierName || 'Admin',
      notes: `Alasan: ${s.voidReason || 'Tidak ada keterangan'} (Kembalikan stok)`,
      severity: 'high',
    }));

  const adjustments = stockMovements
    .filter(m => m.type === 'ADJUSTMENT' || m.type === 'WASTE')
    .map(m => ({
      id: `m_${m.id}`,
      createdAt: m.createdAt,
      type: m.type,
      title: `Penyesuaian Fisik Stok ${m.ingredientName}`,
      actor: 'Admin/Dapur',
      notes: `${m.notes || 'Penyesuaian stok'} (Perubahan: ${m.changeAmount > 0 ? '+' : ''}${formatNumber(m.changeAmount)})`,
      severity: 'medium',
    }));

  const allLogs = [...voidSales, ...adjustments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <PageContainer className="pb-24 lg:pb-8">
      <PageHeader
        title="Audit Log Keamanan & Pembatalan"
        description="Rekaman jejak aktivitas sensitif seperti pembatalan pesanan (VOID) dan koreksi selisih stok fisik."
      />

      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <div className="space-y-3">
          {allLogs.length === 0 ? (
            <div className="text-center py-14 text-[#667085]">
              <ShieldAlert className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-semibold text-[#172033]">
                Belum ada catatan aktivitas sensitif.
              </p>
              <p className="text-[11px] text-[#667085] mt-1">
                Aktivitas pembatalan kasir dan selisih stok opname akan tercatat di sini secara permanen.
              </p>
            </div>
          ) : (
            allLogs.map(log => (
              <div
                key={log.id}
                className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] text-xs flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.severity === 'high'
                          ? 'bg-[#FEF3F2] text-[#D92D20] border border-[#FECDCA]'
                          : 'bg-[#FFFAEB] text-[#B54708] border border-[#FEDF89]'
                      }`}
                    >
                      {log.type}
                    </span>
                    <span className="text-[11px] text-[#667085]">
                      {formatDateTimeIndonesian(log.createdAt)}
                    </span>
                  </div>

                  <h4 className="font-bold text-[#172033]">{log.title}</h4>
                  <p className="text-[#475467] font-medium">{log.notes}</p>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-[#667085] shrink-0">
                  <User className="w-3.5 h-3.5" />
                  <span>{log.actor}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageContainer>
  );
};
