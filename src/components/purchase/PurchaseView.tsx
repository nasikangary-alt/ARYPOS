import React, { useState } from 'react';
import { Purchase } from '../../types';
import { useApp } from '../../context/AppContext';
import { PageContainer } from '../common/PageContainer';
import { PurchaseList } from './PurchaseList';
import { PurchaseForm } from './PurchaseForm';
import { PurchaseDetail } from './PurchaseDetail';

interface PurchaseViewProps {
  onNavigateTab?: (tab: string) => void;
  isDesktopWide?: boolean;
}

export type PurchaseViewMode = 'list' | 'create' | 'edit' | 'detail';

export const PurchaseView: React.FC<PurchaseViewProps> = ({
  onNavigateTab,
  isDesktopWide = false,
}) => {
  const { purchases } = useApp();

  // Internal Navigation State
  const [viewMode, setViewMode] = useState<PurchaseViewMode>('list');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>('');
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);

  // Transition Handlers
  const handleOpenCreate = () => {
    setEditingPurchase(null);
    setViewMode('create');
  };

  const handleOpenDetail = (purchaseId: string) => {
    setSelectedPurchaseId(purchaseId);
    setViewMode('detail');
  };

  const handleOpenEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setSelectedPurchaseId(purchase.id);
    setViewMode('edit');
  };

  const handleSaved = (savedPurchaseId: string) => {
    setSelectedPurchaseId(savedPurchaseId);
    setEditingPurchase(null);
    setViewMode('detail');
  };

  const handleBackToList = () => {
    setSelectedPurchaseId('');
    setEditingPurchase(null);
    setViewMode('list');
  };

  return (
    <PageContainer>
      {viewMode === 'list' && (
        <PurchaseList
          onCreatePurchase={handleOpenCreate}
          onSelectPurchase={handleOpenDetail}
          onEditPurchase={handleOpenEdit}
          isDesktopWide={isDesktopWide}
        />
      )}

      {(viewMode === 'create' || viewMode === 'edit') && (
        <PurchaseForm
          initialPurchase={viewMode === 'edit' ? editingPurchase : null}
          onCancel={handleBackToList}
          onSaved={handleSaved}
          isDesktopWide={isDesktopWide}
        />
      )}

      {viewMode === 'detail' && (
        <PurchaseDetail
          purchaseId={selectedPurchaseId}
          onBack={handleBackToList}
          onEdit={handleOpenEdit}
          onDeleted={handleBackToList}
          isDesktopWide={isDesktopWide}
        />
      )}
    </PageContainer>
  );
};
