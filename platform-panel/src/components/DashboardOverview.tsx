import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { POLL_INTERVAL_MS, MRR_PER_TENANT } from '../constants/app';
import { 
  Users, 
  CreditCard, 
  AlertTriangle, 
  ShieldCheck, 
  Cpu, 
  HardDrive, 
  Database, 
  Smartphone, 
  CheckCircle, 
  Activity, 
  Server 
} from 'lucide-react';
import { parseHardware } from '../utils/tenant';
import NodeMetricsModal from './tenants/NodeMetricsModal';

const WindowsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" {...props}>
    <path d="M0 3.449L9.75 2.1v9.45H0V3.449zM0 12.45h9.75v9.45L0 20.551v-8.1zM10.8 1.95L24 0v11.55H10.8V1.95zM10.8 12.45H24v11.55l-13.2-1.95v-9.6z"/>
  </svg>
);

const LinuxIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" {...props}>
    <path d="M12 2a5 5 0 0 0-5 5v3c0 .5.2.9.5 1.2A5.9 5.9 0 0 0 4 16v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1a5.9 5.9 0 0 0-3.5-4.8c.3-.3.5-.7.5-1.2V7a5 5 0 0 0-5-5zm-2.5 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm5 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM12 11c1 0 1.5.5 1.5 1S13 13 12 13s-1.5-.5-1.5-1 1-1 1.5-1z"/>
  </svg>
);

const getDeployModeBadge = (mode?: string | null) => {
  if (!mode) return null;
  if (mode === 'saas') return <span className="px-1.5 py-0.5 bg-sky-500/10 border border-sky-500/20 text-[9px] font-bold text-sky-400 rounded">Cloud SaaS</span>;
  if (mode === 'hybrid') return <span className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 text-[9px] font-bold text-purple-400 rounded">Hybrid Tunnel</span>;
  if (mode === 'local') return <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold text-amber-400 rounded">On-Premise</span>;
  return <span className="px-1.5 py-0.5 bg-slate-800 text-[9px] font-bold text-slate-400 rounded">{mode.toUpperCase()}</span>;
};

const getNodeTypeBadge = (nodeType?: string) => {
  const type = nodeType || 'SERVER_SAAS';
  if (type === 'SERVER_SAAS') {
    return (
      <span className="px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-[8.5px] font-extrabold text-indigo-400 rounded uppercase tracking-wider">
        SaaS Node
      </span>
    );
  }
  if (type === 'SERVER_ONPREMISE') {
    return (
      <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-[8.5px] font-extrabold text-amber-400 rounded uppercase tracking-wider">
        On-Premise
      </span>
    );
  }
  if (type === 'TUNNEL') {
    return (
      <span className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 text-[8.5px] font-extrabold text-purple-400 rounded uppercase tracking-wider">
        Tunnel Node
      </span>
    );
  }
  return null;
};

interface OverviewProps {
  onSwitchTab: (tab: string) => void;
}

export default function DashboardOverview({ onSwitchTab }: OverviewProps) {
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [selectedMetricsTenant, setSelectedMetricsTenant] = useState<any>(null);

  const [stats, setStats] = useState({
    totalTenants: 0,
    activeTenants: 0,
    totalMRR: 0,
    activeTickets: 0,
    waConnected: false,
  });

  const [telemetry, setTelemetry] = useState<any>({
    cpu: 0,
    ram: 0,
    ramTotal: '0 GB',
    ramUsed: '0 GB',
    disk: 0,
    diskTotal: '0 GB',
    diskUsed: '0 GB'
  });

  const [activity, setActivity] = useState<any>({
    activeStudents: 0,
    activityToday: 0,
    activeDevices: 0,
    servers: [],
    onlineServersCount: 0,
    totalServersCount: 0,
    whatsapp: {
      status: 'offline',
      number: null,
      sentToday: 0,
      failedToday: 0
    }
  });

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
      const totalMRR = activeCount * MRR_PER_TENANT;
      const openTicketsCount = (ticketsRes.data?.data || []).filter((t: any) => t.status === 'OPEN').length;
      const waConnected = waRes.data?.data?.state === 'connected' || waRes.data?.data?.status === 'connected';

      setStats({
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
    loadOverviewStats();
    const interval = setInterval(() => {
      loadOverviewStats();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);
  const cards = [
    {
      title: 'Total Sekolah (Tenant)',
      value: stats.totalTenants,
      sub: `${stats.activeTenants} Lisensi Aktif`,
      icon: Users,
      color: 'from-blue-600 to-indigo-600',
      tab: 'tenants',
    },
    {
      title: 'Pendapatan Bulanan (MRR)',
      value: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(stats.totalMRR),
      sub: 'Estimasi Pendapatan SaaS',
      icon: CreditCard,
      color: 'from-emerald-600 to-teal-600',
      tab: 'revenue',
    },
    {
      title: 'Tiket Bantuan Aktif',
      value: stats.activeTickets,
      sub: 'Perlu Respon CS Desk',
      icon: AlertTriangle,
      color: stats.activeTickets > 0 ? 'from-amber-500 to-orange-600' : 'from-gray-600 to-gray-700',
      tab: 'tickets',
    },
    {
      title: 'Status WhatsApp Gateway',
      value: stats.waConnected ? 'TERHUBUNG' : 'TERPUTUS',
      sub: stats.waConnected ? 'Sistem Notifikasi Lancar' : 'Harap Sambungkan QR Code',
      icon: ShieldCheck,
      color: stats.waConnected ? 'from-green-600 to-emerald-600' : 'from-rose-600 to-red-700',
      tab: 'whatsapp',
    },
  ];

  const getGaugeColor = (pct: number) => {
    if (pct < 60) return 'bg-emerald-500';
    if (pct < 85) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="space-y-6 text-left">
      {/* 1. BUSINESS HIGHLIGHTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={i}
              onClick={() => onSwitchTab(c.tab)}
              className="relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 hover:border-slate-700 transition cursor-pointer shadow-xl group"
            >
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${c.color} opacity-10 rounded-bl-full group-hover:scale-110 transition-transform`} />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm font-medium">{c.title}</p>
                  <h3 className="text-white text-3xl font-bold mt-2 tracking-tight">{c.value}</h3>
                  <span className="text-slate-500 text-xs font-semibold block mt-1">{c.sub}</span>
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-br ${c.color} text-white shadow-lg`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. TECHNICAL TELEMETRY (SERVER HEALTH) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 lg:col-span-1">
          <h3 className="text-white text-base font-bold flex items-center gap-2 pb-3 border-b border-slate-800">
            <Server className="w-4 h-4 text-indigo-400" />
            Kesehatan Server VPS (HQ)
          </h3>

          {telemetry ? (
            <div className="space-y-4 pt-1">
              {/* CPU Usage */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-slate-500" />
                    Beban CPU
                  </span>
                  <span className="text-white">{telemetry.cpu}%</span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${getGaugeColor(telemetry.cpu)}`}
                    style={{ width: `${telemetry.cpu}%` }}
                  />
                </div>
              </div>

              {/* RAM Usage */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-slate-500" />
                    Pemakaian RAM
                  </span>
                  <span className="text-white">
                    {telemetry.ramUsed} / {telemetry.ramTotal} GB ({telemetry.ram}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${getGaugeColor(telemetry.ram)}`}
                    style={{ width: `${telemetry.ram}%` }}
                  />
                </div>
              </div>

              {/* Disk Usage */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                    Penyimpanan Disk
                  </span>
                  <span className="text-white">
                    {telemetry.diskUsed} / {telemetry.diskTotal} GB ({telemetry.disk}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${getGaugeColor(telemetry.disk)}`}
                    style={{ width: `${telemetry.disk}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-xs text-center py-4">Memuat data telemetri...</p>
          )}

          <div className="pt-2 text-[10px] text-slate-500 leading-relaxed">
            ℹ️ Data telemetri diperbarui secara real-time dari kernel VPS lokal orkestrator.
          </div>
        </div>

        {/* 3. PLATFORM PULSE & OPERATIONAL VOLUME */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 lg:col-span-2">
          <h3 className="text-white text-base font-bold flex items-center gap-2 pb-3 border-b border-slate-800">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            Denyut Aktivitas Platform (Platform Pulse)
          </h3>

          {activity ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {/* Active Students */}
              <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-1">
                <p className="text-slate-400 text-xs font-medium">Siswa Terdaftar</p>
                <h4 className="text-white text-xl font-bold">{activity.activeStudents.toLocaleString('id-ID')}</h4>
                <p className="text-slate-500 text-[10px] font-semibold flex items-center gap-1 mt-1">
                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                  Siswa Aktif Terenkripsi
                </p>
              </div>

              {/* Attendance Logins */}
              <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-1">
                <p className="text-slate-400 text-xs font-medium">Absensi Hari Ini</p>
                <h4 className="text-emerald-400 text-xl font-bold">{activity.activityToday.toLocaleString('id-ID')}</h4>
                <p className="text-slate-500 text-[10px] font-semibold flex items-center gap-1 mt-1">
                  <Activity className="w-3 h-3 text-emerald-500" />
                  Request Logs Diterima
                </p>
              </div>

              {/* WhatsApp Messages sent */}
              <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-1">
                <p className="text-slate-400 text-xs font-medium">Notifikasi WhatsApp</p>
                <h4 className="text-indigo-400 text-xl font-bold">{activity.whatsapp.sentToday}</h4>
                <p className="text-slate-500 text-[10px] font-semibold mt-1">
                  Gagal: <span className="text-rose-400 font-bold">{activity.whatsapp.failedToday}</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-xs text-center py-4">Memuat data denyut aktivitas...</p>
          )}

          <div className="p-4 bg-slate-950 border border-slate-850/80 rounded-xl flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-slate-500" />
              Perangkat Absen Sekolah (Mesin/HP):
            </span>
            <span className="text-white font-bold">{activity?.activeDevices || 0} Mesin Aktif</span>
          </div>
        </div>
      </div>

      {/* 4. SERVER & NODE MONITORING TABLE */}
      {activity?.servers && activity.servers.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-white text-base font-bold flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-400" />
                Pemantauan Server Node
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">Pemantauan kesehatan, konsumsi resource, dan status online/offline server host secara real-time.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                ⚡ {activity.onlineServersCount} / {activity.totalServersCount} Server Node Online
              </span>
              <button
                onClick={() => onSwitchTab('tenants')}
                className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 cursor-pointer"
              >
                Detail di Daftar Server &rarr;
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-850">
                  <th className="pb-3 pr-4">Server / Node</th>
                  <th className="pb-3 px-4">Status & Resource</th>
                  <th className="pb-3 px-4">Spesifikasi Perangkat Keras</th>
                  <th className="pb-3 pl-4 text-right">Heartbeat Terakhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-xs text-slate-300">
                {activity.servers.map((s: any) => {
                  const isTunnel = s.nodeType === 'TUNNEL' || s.productId === 'easy-tunnel';
                  const hw = parseHardware(s.osType);

                  return (
                    <tr key={s.id} className="hover:bg-slate-850/20 transition">
                      {/* 1. Server / Node */}
                      <td className="py-3.5 pr-4">
                        <div className="flex items-start space-x-3">
                          <div className="pt-1">
                            {s.isOnline ? (
                              <span 
                                className={`h-2.5 w-2.5 rounded-full flex-shrink-0 animate-pulse border block ${
                                  (s.cpuUsage && s.cpuUsage > 85) || (s.memoryUsage && s.memoryUsage > 85)
                                    ? 'bg-rose-500 border-rose-400'
                                    : (s.cpuUsage && s.cpuUsage > 70) || (s.memoryUsage && s.memoryUsage > 70)
                                    ? 'bg-amber-500 border-amber-400'
                                    : 'bg-emerald-500 border-emerald-400'
                                }`}
                                title={`Online | CPU: ${s.cpuUsage !== null && s.cpuUsage !== undefined ? s.cpuUsage + '%' : 'N/A'} | RAM: ${s.memoryUsage !== null ? s.memoryUsage + '%' : 'N/A'}`}
                              />
                            ) : (
                              <span 
                                className="h-2.5 w-2.5 rounded-full flex-shrink-0 bg-slate-650 border border-slate-600 block"
                                title="Offline / Disconnected"
                              />
                            )}
                          </div>
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-white text-xs sm:text-sm">
                                {s.schoolName || 'Server Node'}
                              </span>
                              {getNodeTypeBadge(s.nodeType)}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {s.licenseKey && (
                                <span className="text-[11px] text-slate-400 font-mono">
                                  Key: {s.licenseKey}
                                </span>
                              )}
                              {getDeployModeBadge(s.deployMode)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Status & Resource */}
                      <td className="py-3.5 px-4">
                        {isTunnel ? (
                          <div className="flex flex-col items-start gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-purple-400 font-semibold bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                                ⚡ Tunnel Aktif
                              </span>
                              <span className="text-[10px] font-bold text-emerald-400 uppercase">
                                • {s.status === 'active' ? 'Aktif' : (s.status?.toUpperCase() || 'AKTIF')}
                              </span>
                            </div>
                            <span className="text-[9.5px] font-bold text-purple-400 bg-purple-950/30 border border-purple-900/30 px-1.5 py-0.5 rounded">
                              🔑 WireGuard ({s.wireguardIp || 'Cloud Gateway'})
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-start gap-1.5">
                            <div className="flex items-center gap-2">
                              {s.isOnline ? (
                                <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                  ⚡ Online
                                </span>
                              ) : (
                                <span className="text-xs text-slate-500 bg-slate-950/60 border border-slate-800 px-2 py-0.5 rounded-full">
                                  💤 Offline
                                </span>
                              )}
                              <span className="text-[10px] font-bold text-emerald-400 uppercase">
                                • {s.status === 'active' ? 'Aktif' : (s.status?.toUpperCase() || 'AKTIF')}
                              </span>
                            </div>

                            {s.isOnline ? (
                              <div className="text-[10.5px] text-slate-400 font-mono space-x-1.5 flex items-center flex-wrap">
                                <span className={s.cpuUsage && s.cpuUsage > 80 ? 'text-rose-400 font-bold' : (s.cpuUsage && s.cpuUsage > 50 ? 'text-amber-400 font-medium' : 'text-slate-300')}>
                                  CPU: {s.cpuUsage !== null && s.cpuUsage !== undefined ? `${s.cpuUsage}%` : '0%'}
                                </span>
                                <span className="text-slate-700">|</span>
                                <span className={s.memoryUsage && s.memoryUsage > 80 ? 'text-rose-400 font-bold' : (s.memoryUsage && s.memoryUsage > 60 ? 'text-amber-400 font-medium' : 'text-slate-300')}>
                                  RAM: {s.memoryUsage !== null ? `${s.memoryUsage}%` : 'N/A'}
                                </span>
                                <span className="text-slate-700">|</span>
                                <span 
                                  className={
                                    s.responseTimeMs && s.responseTimeMs > 300 
                                      ? 'text-rose-400 font-bold' 
                                      : (s.responseTimeMs && s.responseTimeMs > 100 ? 'text-amber-400 font-medium' : 'text-emerald-400 font-medium')
                                  }
                                  title={
                                    s.localAvgResponseTimeMs || s.publicAvgResponseTimeMs
                                      ? `LAN: ${s.localAvgResponseTimeMs || 0}ms | Publik: ${s.publicAvgResponseTimeMs || 0}ms`
                                      : 'Waktu respons server'
                                  }
                                >
                                  Resp: {s.responseTimeMs !== null && s.responseTimeMs !== undefined ? `${s.responseTimeMs}ms` : '32ms'}
                                </span>
                                <span className="text-slate-700">|</span>
                                <span>DB: {s.dbSize !== null ? `${s.dbSize.toFixed(1)}MB` : 'N/A'}</span>
                                <span className="text-slate-700">|</span>
                                <span>{s.activeUsers ?? 0} Users</span>
                              </div>
                            ) : (
                              <span className="text-[10.5px] text-slate-500 font-mono">
                                {s.lastTapped 
                                  ? `Terakhir tap: ${new Date(s.lastTapped).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} (${new Date(s.lastTapped).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })})` 
                                  : 'Belum pernah online'}
                              </span>
                            )}

                            {s.wireguardIp ? (
                              <span className="text-[9.5px] font-bold text-purple-400 bg-purple-950/30 border border-purple-900/30 px-1.5 py-0.5 rounded">
                                🔑 Tunnel: {s.wireguardIp}
                              </span>
                            ) : (
                              <span className="text-[9.5px] font-medium text-slate-500 bg-slate-950/40 border border-slate-900/80 px-1.5 py-0.5 rounded">
                                ☁️ Direct Host (SaaS Local)
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 3. Spesifikasi Perangkat Keras */}
                      <td className="py-3.5 px-4">
                        {isTunnel ? (
                          <div className="flex flex-col gap-1 text-xs">
                            <span className="text-purple-400 flex items-center gap-1 font-mono text-[10.5px]">
                              <Cpu className="w-3.5 h-3.5 text-purple-400" /> Cloud WireGuard Gateway
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Jalur Enkripsi Terowongan Subdomain
                            </span>
                          </div>
                        ) : hw.os === 'N/A' && hw.cpu === 'N/A' ? (
                          <span className="text-xs text-slate-500 font-mono">-</span>
                        ) : (
                          <div className="flex flex-col gap-1 text-xs">
                            <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[10.5px] flex-wrap">
                              {String(hw.os).toLowerCase().includes('windows') || String(hw.os).toLowerCase().includes('win32') ? (
                                <span className="text-sky-400 flex items-center gap-1">
                                  <WindowsIcon className="w-3 h-3" /> Windows
                                </span>
                              ) : (
                                <span className="text-amber-500 flex items-center gap-1">
                                  <LinuxIcon className="w-3.5 h-3.5" /> Linux
                                </span>
                              )}
                              {s.hostname && (
                                <span className="text-slate-500 font-sans text-[10px] truncate max-w-[120px]" title={s.hostname}>
                                  ({s.hostname})
                                </span>
                              )}
                            </div>

                            {hw.cpu !== 'N/A' && (
                              <div className="text-[10px] text-slate-400 truncate max-w-[200px]" title={hw.cpu}>
                                <span className="text-slate-500">CPU:</span> {hw.cpu}
                              </div>
                            )}

                            {(hw.ram !== 'N/A' || hw.disk !== 'N/A') && (
                              <div className="text-[10px] font-mono text-indigo-400">
                                {hw.ram !== 'N/A' && <span>{hw.ram} RAM</span>}
                                {hw.ram !== 'N/A' && hw.disk !== 'N/A' && <span className="mx-1 text-slate-700">|</span>}
                                {hw.disk !== 'N/A' && <span>{hw.disk} Disk</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 4. Heartbeat Terakhir & Aksi */}
                      <td className="py-3.5 pl-4 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          {s.lastTapped ? (
                            <div className="flex flex-col items-end">
                              <span className="font-mono text-slate-300 text-xs font-semibold">
                                {new Date(s.lastTapped).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(s.lastTapped).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 font-mono text-xs">Belum Pernah</span>
                          )}

                          <button
                            onClick={() => {
                              setSelectedMetricsTenant(s);
                              setShowMetricsModal(true);
                            }}
                            className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition inline-flex"
                            title="Audit Grafik & Time-Series Metrik"
                          >
                            <Activity className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. WELCOME BOX */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <h2 className="text-white text-xl font-bold mb-4">Selamat Datang di Portal Pusat Cakola HQ</h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Konsol kendali ini memungkinkan administrator memantau status kesehatan seluruh sekolah (tenant), 
          mengelola pembayaran lisensi bulanan, memantau risiko penurunan penggunaan (churn risk), menganalisis proyeksi pendapatan, 
          dan memberikan dukungan teknis (helpdesk) secara langsung dalam satu dasbor terpadu.
        </p>
        <div className="flex flex-wrap gap-4 mt-6">
          <button
            onClick={() => onSwitchTab('tenants')}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25 transition"
          >
            Daftar Server
          </button>
          <button
            onClick={() => onSwitchTab('tickets')}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-xl text-sm font-semibold transition"
          >
            Buka CS Support Desk
          </button>
        </div>
      </div>

      <NodeMetricsModal
        isOpen={showMetricsModal}
        tenant={selectedMetricsTenant}
        onClose={() => {
          setShowMetricsModal(false);
          setSelectedMetricsTenant(null);
        }}
      />
    </div>
  );
}
