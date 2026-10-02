import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { LoginView } from './components/auth/LoginView';
import { Header } from './components/common/Header';
import { MobileHeader } from './components/common/MobileHeader';
import { DesktopSidebar } from './components/common/DesktopSidebar';
import { BottomNav } from './components/common/BottomNav';
import { POSView } from './components/pos/POSView';
import { OrdersView } from './components/orders/OrdersView';
import { InventoryView } from './components/inventory/InventoryView';
import { OwnerDashboardView } from './components/dashboard/OwnerDashboardView';
import { MoreView } from './components/more/MoreView';
import { ProductionView } from './components/production/ProductionView';
import { MenuRecipeView } from './components/menu/MenuRecipeView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { EmployeesView } from './components/employees/EmployeesView';
import { ReportsView } from './components/reports/ReportsView';
import { AuditLogsView } from './components/audit/AuditLogsView';
import { CashAndQrisView } from './components/cash/CashAndQrisView';
import { PurchaseView } from './components/purchase/PurchaseView';
import { VendorView } from './components/vendor/VendorView';
import { AssemblyView } from './components/assembly/AssemblyView';
import { RecipeManagementView } from './components/recipe/RecipeManagementView';
import { PromoPricingView } from './components/promo/PromoPricingView';
import { PlatformFeeSettingsView } from './components/promo/PlatformFeeSettingsView';
import { OpeningCashModal } from './components/cash/OpeningCashModal';
import { PWAUpdateToast } from './components/common/PWAUpdateToast';
import { useApp } from './context/AppContext';
import { ArrowLeft, Monitor, Smartphone, Loader2, ShieldAlert } from 'lucide-react';
import { isTabAllowedForRole, DEFAULT_ROLE_TAB } from './utils/permissions';

const MainLayout: React.FC = () => {
  const { currentEmployee, currentRole, loading, logout } = useAuth();
  const { shifts, openShift } = useApp();

  const [activeTab, setActiveTabState] = useState<string>(() => {
    return DEFAULT_ROLE_TAB[currentRole] || 'beranda';
  });

  // Active shift belonging to current logged in user
  const activeShift = React.useMemo(() => {
    if (!currentEmployee) return undefined;
    return shifts.find(
      (s) =>
        s.status === 'OPEN' &&
        Boolean(s.staffId) &&
        ((Boolean(currentEmployee.id) && s.staffId === currentEmployee.id) ||
          (Boolean(currentEmployee.uid) && s.staffId === currentEmployee.uid) ||
          (Boolean(currentEmployee.username) &&
            s.staffId === currentEmployee.username))
    );
  }, [shifts, currentEmployee]);

  const isCashierNeedsOpeningCash = currentRole === 'KASIR' && !activeShift;

  const [deviceMode, setDeviceModeState] = useState<'desktop' | 'mobile'>(() => {
    const saved = localStorage.getItem('ary_device_mode');
    if (saved === 'desktop' || saved === 'mobile') return saved;
    return typeof window !== 'undefined' && window.innerWidth >= 1024
      ? 'desktop'
      : 'mobile';
  });

  const setDeviceMode = (mode: 'desktop' | 'mobile') => {
    setDeviceModeState(mode);
    localStorage.setItem('ary_device_mode', mode);
  };

  // Safe tab switcher enforcing role permissions
  const setActiveTab = (tab: string) => {
    if (isTabAllowedForRole(tab, currentRole)) {
      setActiveTabState(tab);
    } else {
      alert(`Akses Ditolak: Peran ${currentRole} tidak memiliki izin untuk membuka modul '${tab}'.`);
      setActiveTabState(DEFAULT_ROLE_TAB[currentRole] || 'kasir');
    }
  };

  // Redirect to role's default dashboard on login and keep activeTab aligned with role permissions
  useEffect(() => {
    if (currentEmployee) {
      sessionStorage.removeItem('ary_closing_shift');
      setActiveTabState(DEFAULT_ROLE_TAB[currentEmployee.role] || 'beranda');
    } else {
      sessionStorage.removeItem('ary_closing_shift');
    }
  }, [currentEmployee?.id, currentEmployee?.role]);

  // If session is loading
  if (loading) {
    return (
      <div className="h-[100dvh] bg-white flex flex-col items-center justify-center text-[#172033] p-4">
        <Loader2 className="w-7 h-7 text-[#FF641F] animate-spin mb-2.5" />
        <p className="text-xs font-semibold text-[#8E8E93]">Memuat aplikasi...</p>
      </div>
    );
  }

  // If no employee session is logged in, show unified Login View
  if (!currentEmployee) {
    return <LoginView />;
  }

  const isSubView =
    isTabAllowedForRole('lainnya', currentRole) &&
    [
      'menu',
      'diskon_promo',
      'biaya_platform',
      'perakitan',
      'pembelian',
      'vendor',
      'pengeluaran',
      'karyawan',
      'audit',
      'laporan_lengkap',
      'kas_saldo',
    ].includes(activeTab);

  // Desktop Mode Layout
  if (deviceMode === 'desktop') {
    return (
      <div className="min-h-screen bg-[#F7F8FA] text-[#172033] flex selection:bg-[#FF641F] selection:text-white">
        {/* Desktop Left Navigation Sidebar */}
        <div className="hidden lg:block shrink-0">
          <DesktopSidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            deviceMode={deviceMode}
            setDeviceMode={setDeviceMode}
          />
        </div>

        {/* Main Workspace Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          {/* Desktop Top Bar */}
          <Header
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            deviceMode={deviceMode}
            setDeviceMode={setDeviceMode}
          />

          {/* Main View Area with Role Guard */}
          <main className="flex-1 w-full min-w-0">
            {!isTabAllowedForRole(activeTab, currentRole) ? (
              <div className="p-8 text-center max-w-md mx-auto my-12 bg-white rounded-3xl border border-rose-200 p-6 space-y-3">
                <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
                <h3 className="font-bold text-base text-slate-900">Akses Ditolak</h3>
                <p className="text-xs text-slate-500">
                  Peran akun Anda ({currentRole}) tidak memiliki izin mengakses modul ini.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab(DEFAULT_ROLE_TAB[currentRole])}
                  className="px-4 py-2 rounded-xl bg-[#FF641F] text-white text-xs font-bold"
                >
                  Kembali ke Halaman Utama
                </button>
              </div>
            ) : (
              <>
                {(activeTab === 'beranda' || activeTab === 'laporan') && (
                  <OwnerDashboardView
                    onNavigateTab={setActiveTab}
                    isDesktopWide={true}
                  />
                )}
                {activeTab === 'kasir' && (
                  <POSView onNavigateTab={setActiveTab} isDesktopWide={true} />
                )}
                {activeTab === 'pesanan' && <OrdersView isDesktopWide={true} />}
                {activeTab === 'stok' && <InventoryView isDesktopWide={true} />}
                {activeTab === 'lainnya' && (
                  <MoreView onNavigateTab={setActiveTab} />
                )}

                {/* Subviews */}
                {activeTab === 'menu' && <MenuRecipeView />}
                {activeTab === 'diskon_promo' && <PromoPricingView />}
                {activeTab === 'biaya_platform' && <PlatformFeeSettingsView onNavigateTab={setActiveTab} />}
                {activeTab === 'resep' && <ProductionView initialTab="recipes" />}
                {activeTab === 'perakitan' && <AssemblyView />}
                {activeTab === 'pembelian' && (
                  <PurchaseView onNavigateTab={setActiveTab} isDesktopWide={true} />
                )}
                {activeTab === 'vendor' && (
                  <VendorView onNavigateTab={setActiveTab} isDesktopWide={true} />
                )}
                {activeTab === 'produksi' && <ProductionView initialTab="products" />}
                {activeTab === 'produksi_ayam' && <ProductionView initialTab="chicken" />}
                {activeTab === 'pengeluaran' && <ExpensesView isDesktopWide={true} />}
                {activeTab === 'karyawan' && <EmployeesView />}
                {activeTab === 'laporan_lengkap' && <ReportsView />}
                {activeTab === 'audit' && <AuditLogsView />}
                {activeTab === 'kas_saldo' && <CashAndQrisView isDesktopWide={true} />}
              </>
            )}
          </main>
        </div>

        {/* Mobile Navigation for narrow viewports when resized */}
        <div className="lg:hidden">
          <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>

        {/* MANDATORY OPENING CASH MODAL (BLOCKING GATE UPON CASHIER LOGIN) */}
        {isCashierNeedsOpeningCash && (
          <OpeningCashModal
            isOpen={true}
            onClose={() => {}}
            isMandatory={true}
            shifts={shifts}
            currentStaffName={currentEmployee.name || 'Kasir ARY'}
            currentStaffId={currentEmployee.id || currentEmployee.uid || ''}
            onCancelLogout={async () => {
              await logout();
            }}
            onConfirmStartShift={async (openingCashConfirmedAmount, details) => {
              await openShift(
                currentEmployee.id || currentEmployee.uid || 'kasir',
                currentEmployee.name || 'Kasir ARY',
                openingCashConfirmedAmount,
                details
              );
            }}
          />
        )}
      </div>
    );
  }

  // Mobile Mode Layout (Natural on phone, clean simulation frame on desktop)
  return (
    <div className="min-h-screen bg-[#111827] lg:bg-[#1E293B] text-[#172033] selection:bg-[#FF641F] selection:text-white flex flex-col items-center">
      {/* Top Desktop Helper Banner (Shown on large screens when previewing Mobile Mode) */}
      <div className="hidden lg:flex w-full bg-[#172033] text-white px-6 py-2.5 items-center justify-between border-b border-slate-700 shadow-md">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Smartphone className="w-4 h-4 text-[#1570EF]" />
          <span>
            Mode HP (Mobile) Aktif &bull; Tampilan simulasi smartphone.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDeviceMode('desktop')}
          className="px-3 py-1 rounded-xl bg-[#FF641F] hover:bg-[#F45116] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Kembali ke Mode Desktop Penuh</span>
        </button>
      </div>

      {/* Smartphone Frame Container */}
      <div className="w-full max-w-[430px] min-h-screen bg-[#F7F8FA] shadow-2xl relative flex flex-col border-x border-[#E8ECF2] app-mobile-shell overflow-x-hidden">
        {/* Mobile Header Bar */}
        <MobileHeader
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          deviceMode={deviceMode}
          setDeviceMode={setDeviceMode}
        />

        {/* Subview Back Header */}
        {isSubView && (
          <div className="sticky top-[52px] z-20 bg-white/95 backdrop-blur-md border-b border-[#E8ECF2] px-4 py-2.5 flex items-center gap-3 subview-sticky-header">
            <button
              type="button"
              onClick={() => setActiveTab('lainnya')}
              className="p-1 rounded-xl text-[#667085] hover:bg-[#F1F4F8] hover:text-[#172033] transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#FF641F]" />
              <span>Kembali ke Menu Lainnya</span>
            </button>
          </div>
        )}

        {/* Main Mobile Content Area with Role Guard */}
        <main className="flex-1 w-full pb-20">
          {!isTabAllowedForRole(activeTab, currentRole) ? (
            <div className="p-6 text-center m-4 bg-white rounded-3xl border border-rose-200 space-y-3">
              <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto" />
              <h3 className="font-bold text-sm text-slate-900">Akses Ditolak</h3>
              <p className="text-xs text-slate-500">
                Peran akun ({currentRole}) tidak memiliki izin mengakses modul ini.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab(DEFAULT_ROLE_TAB[currentRole])}
                className="px-4 py-2 rounded-xl bg-[#FF641F] text-white text-xs font-bold"
              >
                Kembali
              </button>
            </div>
          ) : (
            <>
              {(activeTab === 'beranda' || activeTab === 'laporan') && (
                <OwnerDashboardView
                  onNavigateTab={setActiveTab}
                  isDesktopWide={false}
                />
              )}
              {activeTab === 'kasir' && (
                <POSView onNavigateTab={setActiveTab} isDesktopWide={false} />
              )}
              {activeTab === 'pesanan' && <OrdersView isDesktopWide={false} />}
              {activeTab === 'stok' && <InventoryView isDesktopWide={false} />}
              {activeTab === 'lainnya' && <MoreView onNavigateTab={setActiveTab} />}

              {/* Subviews */}
              {activeTab === 'menu' && <MenuRecipeView />}
              {activeTab === 'diskon_promo' && <PromoPricingView />}
              {activeTab === 'biaya_platform' && <PlatformFeeSettingsView onNavigateTab={setActiveTab} />}
              {activeTab === 'resep' && <ProductionView initialTab="recipes" />}
              {activeTab === 'perakitan' && <AssemblyView />}
              {activeTab === 'pembelian' && (
                <PurchaseView onNavigateTab={setActiveTab} isDesktopWide={false} />
              )}
              {activeTab === 'vendor' && (
                <VendorView onNavigateTab={setActiveTab} isDesktopWide={false} />
              )}
              {activeTab === 'produksi' && <ProductionView initialTab="products" />}
              {activeTab === 'produksi_ayam' && <ProductionView initialTab="chicken" />}
              {activeTab === 'pengeluaran' && <ExpensesView isDesktopWide={false} />}
              {activeTab === 'karyawan' && <EmployeesView />}
              {activeTab === 'laporan_lengkap' && <ReportsView />}
              {activeTab === 'audit' && <AuditLogsView />}
              {activeTab === 'kas_saldo' && <CashAndQrisView isDesktopWide={false} />}
            </>
          )}
        </main>

        {/* Mobile Bottom Navigation (Sticky bottom 5 tabs) */}
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* MANDATORY OPENING CASH MODAL (BLOCKING GATE UPON CASHIER LOGIN) */}
        {isCashierNeedsOpeningCash && (
          <OpeningCashModal
            isOpen={true}
            onClose={() => {}}
            isMandatory={true}
            shifts={shifts}
            currentStaffName={currentEmployee.name || 'Kasir ARY'}
            currentStaffId={currentEmployee.id || currentEmployee.uid || ''}
            onCancelLogout={async () => {
              await logout();
            }}
            onConfirmStartShift={async (openingCashConfirmedAmount, details) => {
              await openShift(
                currentEmployee.id || currentEmployee.uid || 'kasir',
                currentEmployee.name || 'Kasir ARY',
                openingCashConfirmedAmount,
                details
              );
            }}
          />
        )}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <MainLayout />
        <PWAUpdateToast />
      </AppProvider>
    </AuthProvider>
  );
}
