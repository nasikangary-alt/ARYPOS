import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { OwnerDashboard } from './OwnerDashboard';
import { AdminDashboard } from './AdminDashboard';
import { CashierDashboard } from './CashierDashboard';
import { EmployeeDashboard } from './EmployeeDashboard';

interface OwnerDashboardViewProps {
  onNavigateTab?: (tab: string) => void;
  isDesktopWide?: boolean;
}

export const OwnerDashboardView: React.FC<OwnerDashboardViewProps> = ({
  onNavigateTab = () => {},
}) => {
  const { currentRole, userProfile, currentEmployee } = useAuth();

  // Normalize role and check if employee is a cashier by role or position
  const rawRole = String(userProfile?.role || currentEmployee?.role || currentRole || 'KASIR').toUpperCase();
  const isMainOwner =
    currentEmployee?.id === 'emp_owner_1' ||
    currentEmployee?.username?.toLowerCase() === 'owner' ||
    currentEmployee?.email?.toLowerCase() === 'nasikangary@gmail.com';

  const isCashierAccount =
    !isMainOwner &&
    (rawRole === 'KASIR' ||
      Boolean(currentEmployee?.position && currentEmployee.position.toLowerCase().includes('kasir')));

  const effectiveRole = isCashierAccount ? 'KASIR' : rawRole;

  switch (effectiveRole) {
    case 'OWNER':
      return <OwnerDashboard onNavigateTab={onNavigateTab} />;
    case 'ADMIN':
      return <AdminDashboard onNavigateTab={onNavigateTab} />;
    case 'KASIR':
      return <CashierDashboard onNavigateTab={onNavigateTab} />;
    case 'KARYAWAN':
      return <EmployeeDashboard onNavigateTab={onNavigateTab} />;
    default:
      return <CashierDashboard onNavigateTab={onNavigateTab} />;
  }
};
