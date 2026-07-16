import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import apiClient from './api/apiClient';
import { SocketContext } from './hooks/useSocket';

// Components
import DashboardOverview from './components/DashboardOverview';
import TenantManager from './components/TenantManager';
import RiskIntelligence from './components/RiskIntelligence';
import RevenueAnalytics from './components/RevenueAnalytics';
import UpgradeIntelligence from './components/UpgradeIntelligence';
import SupportTicketsDesk from './components/SupportTicketsDesk';
import WhatsAppGateway from './components/WhatsAppGateway';
import SystemSettings from './components/SystemSettings';
import SubscriptionsList from './components/SubscriptionsList';
import InvoicesList from './components/InvoicesList';
import ProductsManager from './components/ProductsManager';
import AuditLogs from './components/AuditLogs';
import CaddyGateway from './components/CaddyGateway';

// Icons
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  MessageSquare,
  Smartphone,
  Settings,
  LogOut,
  ShieldAlert,
  Loader,
  Layers,
  DollarSign,
  FileText,
  Server,
  Network,
  Sun,
  Moon
} from 'lucide-react';

const queryClient = new QueryClient();

const dummySocket = {
  socket: null,
  isConnected: false,
  subscribe: () => {},
  unsubscribe: () => {},
  emit: () => {},
};

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('hq-theme') as 'dark' | 'light') || 'dark');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [adminSecretInput, setAdminSecretInput] = useState<string>('');
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Overview states
  const [overviewStats, setOverviewStats] = useState({
    totalTenants: 0,
    activeTenants: 0,
    totalMRR: 0,
    activeTickets: 0,
    waConnected: false,
  });

  const [telemetry, setTelemetry] = useState({
    cpu: 0,
    ram: 0,
    ramTotal: '0',
    ramUsed: '0',
    disk: 0,
    diskTotal: '0',
    diskUsed: '0',
  });

  const [activity, setActivity] = useState({
    activeStudents: 0,
    activityToday: 0,
    activeDevices: 0,
    whatsapp: {
      status: 'disconnected',
      number: null as string | null,
      sentToday: 0,
      failedToday: 0
    }
  });

  const checkAuth = async () => {
    const token = localStorage.getItem('x-admin-secret');
    if (!token) {
      setIsLoggedIn(false);
      setCheckingAuth(false);
      return;
    }
    
    try {
      // Validate token against basic settings endpoint
      const res = await apiClient.get('/api/admin/settings');
      if (res.status === 200) {
        setIsLoggedIn(true);
        loadOverviewStats();
      }
    } catch (e) {
      localStorage.removeItem('x-admin-secret');
      setIsLoggedIn(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  const loadOverviewStats = async () => {
    try {
      const [tenantsRes, ticketsRes, waRes, telemetryRes, activityRes] = await Promise.all([
        apiClient.get('/api/admin/tenants'),
        apiClient.get('/api/admin/tickets'),
        apiClient.get('/api/admin/wa/status'),
        apiClient.get('/api/admin/system/telemetry'),
        apiClient.get('/api/admin/system/activity'),
      ]);

      const tenantsList = tenantsRes.data?.data || [];
      const activeCount = tenantsList.filter((t: any) => t.status === 'ACTIVE').length;
      const totalMRR = activeCount * 150000;
      const openTicketsCount = (ticketsRes.data?.data || []).filter((t: any) => t.status === 'OPEN').length;
      const waConnected = waRes.data?.data?.state === 'connected' || waRes.data?.data?.status === 'connected';

      setOverviewStats({
        totalTenants: tenantsList.length,
        activeTenants: activeCount,
        totalMRR,
        activeTickets: openTicketsCount,
        waConnected,
      });

      if (telemetryRes.data?.success) {
        setTelemetry(telemetryRes.data.data);
      }
      if (activityRes.data?.success) {
        setActivity(activityRes.data.data);
      }
    } catch (e) {
      console.error('Failed to load overview stats', e);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(() => {
      loadOverviewStats();
    }, 10000); // Polling telemetry & stats every 10 seconds
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  useEffect(() => {
    localStorage.setItem('hq-theme', theme);
  }, [theme]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminSecretInput.trim()) return;

    setCheckingAuth(true);
    setLoginError(null);
    try {
      const res = await apiClient.post('/api/admin/login', {
        secret: adminSecretInput
      });
      if (res.data && res.data.success && res.data.token) {
        localStorage.setItem('x-admin-secret', res.data.token);
        setIsLoggedIn(true);
        loadOverviewStats();
      } else {
        setLoginError(res.data.message || 'PIN Admin tidak valid!');
        setIsLoggedIn(false);
      }
    } catch (err: any) {
      setLoginError(err.response?.data?.message || 'Gagal terhubung ke API login!');
      setIsLoggedIn(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('x-admin-secret');
    setIsLoggedIn(false);
  };

  if (checkingAuth) {
    return (
      <div className={`min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 ${theme === 'light' ? 'theme-light' : ''}`}>
        <Loader className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
        <span>Memverifikasi Sesi Admin...</span>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!isLoggedIn) {
    return (
      <div className={`min-h-screen bg-slate-950 flex items-center justify-center p-4 ${theme === 'light' ? 'theme-light' : ''}`}>
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-600/10">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-white text-2xl font-black tracking-tight">Console Platform Cakola</h2>
            <p className="text-slate-400 text-sm mt-1.5">Akses terbatas untuk administrator sistem pusat.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                required
                placeholder="Masukkan Admin Secret Token"
                value={adminSecretInput}
                onChange={(e) => {
                  setAdminSecretInput(e.target.value);
                  setLoginError(null);
                }}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-white placeholder-slate-650 text-sm text-center focus:border-indigo-500 focus:outline-none"
              />
              {loginError && (
                <p className="text-rose-500 text-xs font-bold mt-2 tracking-wide uppercase">
                  ⚠️ {loginError}
                </p>
              )}
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold tracking-wide shadow-lg shadow-indigo-600/25 transition"
            >
              Masuk ke Console
            </button>
          </form>
        </div>
      </div>
    );
  }

  // SIDEBAR ITEMS
  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tenants', label: 'Daftar Server', icon: Server },
    { id: 'subscriptions', label: 'Daftar Sekolah', icon: Users },
    { id: 'invoices', label: 'Invoice', icon: DollarSign },
    { id: 'products', label: 'Produk & Plan', icon: Layers },
    { id: 'risk', label: 'Churn Risk', icon: AlertTriangle },
    { id: 'revenue', label: 'Proyeksi Pendapatan', icon: TrendingUp },
    { id: 'upgrade', label: 'Minat Upgrade', icon: Sparkles },
    { id: 'tickets', label: 'Tiket Bantuan CS', icon: MessageSquare },
    { id: 'whatsapp', label: 'WhatsApp Gateway', icon: Smartphone },
    { id: 'logs', label: 'Log Audit Trail', icon: FileText },
    { id: 'caddy', label: 'Caddy Gateway', icon: Network },
    { id: 'settings', label: 'Konfigurasi Sistem', icon: Settings },
  ];

  return (
    <QueryClientProvider client={queryClient}>
      <SocketContext.Provider value={dummySocket}>
        <div className={`min-h-screen bg-slate-950 flex ${theme === 'light' ? 'theme-light' : ''}`}>
          {/* SIDEBAR */}
          <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0">
            <div className="p-6 border-b border-slate-800 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-extrabold shadow-lg shadow-indigo-600/20">
                A
              </div>
              <span className="text-white font-extrabold tracking-wide text-lg">Cakola HQ</span>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      loadOverviewStats();
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                        : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-800 space-y-2">
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:bg-slate-850 hover:text-slate-200 transition"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-5 h-5 text-amber-400" />
                    <span>Tema Terang</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-5 h-5 text-indigo-400" />
                    <span>Tema Gelap</span>
                  </>
                )}
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-rose-450 hover:bg-rose-500/10 text-rose-400 transition"
              >
                <LogOut className="w-5 h-5" />
                Keluar Sesi
              </button>
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className="flex-1 p-8 overflow-y-auto h-screen">
            {activeTab === 'dashboard' && (
              <DashboardOverview 
                stats={overviewStats} 
                telemetry={telemetry}
                activity={activity}
                onSwitchTab={setActiveTab} 
              />
            )}
            {activeTab === 'tenants' && <TenantManager />}
            {activeTab === 'subscriptions' && <SubscriptionsList />}
            {activeTab === 'invoices' && <InvoicesList />}
            {activeTab === 'products' && <ProductsManager />}
            {activeTab === 'risk' && <RiskIntelligence />}
            {activeTab === 'revenue' && <RevenueAnalytics />}
            {activeTab === 'upgrade' && <UpgradeIntelligence />}
            {activeTab === 'tickets' && <SupportTicketsDesk />}
            {activeTab === 'whatsapp' && <WhatsAppGateway />}
            {activeTab === 'logs' && <AuditLogs />}
            {activeTab === 'caddy' && <CaddyGateway />}
            {activeTab === 'settings' && <SystemSettings />}
          </main>
        </div>
      </SocketContext.Provider>
    </QueryClientProvider>
  );
}
