import React from 'react';
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

interface OverviewProps {
  stats: {
    totalTenants: number;
    activeTenants: number;
    totalMRR: number;
    activeTickets: number;
    waConnected: boolean;
  };
  telemetry?: {
    cpu: number;
    ram: number;
    ramTotal: string;
    ramUsed: string;
    disk: number;
    diskTotal: string;
    diskUsed: string;
  };
  activity?: {
    activeStudents: number;
    activityToday: number;
    activeDevices: number;
    servers?: Array<{
      id: string;
      schoolName: string;
      isOnline: boolean;
      memoryUsage: number | null;
      dbSize: number | null;
      lastTapped: string | null;
      activeUsers: number;
      osType?: string | null;
      hostname?: string | null;
    }>;
    onlineServersCount?: number;
    totalServersCount?: number;
    whatsapp: {
      status: string;
      number: string | null;
      sentToday: number;
      failedToday: number;
    };
  };
  onSwitchTab: (tab: string) => void;
}

export default function DashboardOverview({ stats, telemetry, activity, onSwitchTab }: OverviewProps) {
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

      {/* 4. CLIENT SCHOOL SERVERS TABLE */}
      {activity?.servers && activity.servers.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-white text-base font-bold flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-400" />
                Pemantauan Server Klien Sekolah
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">Pemantauan online/offline dan konsumsi resource server lokal masing-masing sekolah.</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              ⚡ {activity.onlineServersCount} / {activity.totalServersCount} Server Online
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-850">
                  <th className="pb-3 pr-4">Nama Sekolah</th>
                  <th className="pb-3 px-4">Status Server</th>
                  <th className="pb-3 px-4 text-right">RAM Usage</th>
                  <th className="pb-3 px-4 text-right">DB Size</th>
                  <th className="pb-3 pl-4 text-right">Heartbeat Terakhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-xs text-slate-300">
                {activity.servers.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-850/20 transition">
                    <td className="py-3.5 pr-4 font-semibold text-white">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                        <span className="truncate max-w-[200px] sm:max-w-none">{s.schoolName}</span>
                        {s.isOnline && s.osType && (
                          <div className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-normal px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800">
                            {String(s.osType).toLowerCase().includes('windows') || String(s.osType).toLowerCase().includes('win32') ? (
                              <span className="text-sky-400 flex items-center gap-1" title={s.osType}>
                                <WindowsIcon className="w-3 h-3" /> Win
                              </span>
                            ) : (
                              <span className="text-amber-500 flex items-center gap-1" title={s.osType}>
                                <LinuxIcon className="w-3 h-3" /> Linux
                              </span>
                            )}
                            {s.hostname && (
                              <>
                                <span className="text-slate-800">|</span>
                                <span className="text-slate-400 font-mono text-[9px] truncate max-w-[100px] sm:max-w-none" title={s.hostname}>{s.hostname}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {s.isOnline ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400">
                          <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                          ONLINE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400">
                          <span className="w-1 h-1 rounded-full bg-red-500"></span>
                          OFFLINE / DISCONNECTED
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                      {s.memoryUsage !== null ? `${s.memoryUsage.toFixed(0)} MB` : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                      {s.dbSize !== null ? `${s.dbSize.toFixed(1)} MB` : '-'}
                    </td>
                    <td className="py-3.5 pl-4 text-right text-slate-500 font-mono">
                      {s.lastTapped ? new Date(s.lastTapped).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Belum Pernah'}
                    </td>
                  </tr>
                ))}
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
            Kelola Lisensi Sekolah
          </button>
          <button
            onClick={() => onSwitchTab('tickets')}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-xl text-sm font-semibold transition"
          >
            Buka CS Support Desk
          </button>
        </div>
      </div>
    </div>
  );
}
