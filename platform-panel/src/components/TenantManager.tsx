import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import type { Tenant } from '../types/tenant';
import { useProducts } from '../hooks/useProducts';
import { parseHardware, isTenantOnline } from '../utils/tenant';
import DetailNodeModal from './tenants/DetailNodeModal';
import AddNodeModal from './tenants/AddNodeModal';
import TelemetryStatusIcon from './tenants/TelemetryStatusIcon';
import { BadgeCheck, ShieldAlert, Key, Plus, Trash2, Check, RefreshCw, Search, ChevronDown, ChevronUp, Database, Users, Activity, Cpu, Building, Eye, ExternalLink, Send } from 'lucide-react';

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


export default function TenantManager() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedNodeType, setSelectedNodeType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedTenants, setExpandedTenants] = useState<Record<string, boolean>>({});
  
  // States for Detail Node Modal Popup
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetailTenant, setSelectedDetailTenant] = useState<Tenant | null>(null);

  const toggleTenant = (id: string) => {
    setExpandedTenants(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const { data: packages = [] } = useProducts();

  const loadData = async () => {
    setLoading(true);
    try {
      const tenantsRes = await apiClient.get('/api/admin/nodes');
      setTenants(tenantsRes.data?.data || []);
    } catch (e) {
      console.error('Failed to load tenants data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateLicense = async (tenantId: string) => {
    if (!confirm('Hasilkan key lisensi baru untuk sekolah ini?')) return;
    try {
      await apiClient.post('/api/admin/tenants/generate-license', { tenantId });
      loadData();
    } catch (e) {
      alert('Gagal menghasilkan lisensi');
    }
  };

  const handleApproveLicense = async (tenantId: string) => {
    if (!confirm('Setujui lisensi sekolah ini?')) return;
    try {
      await apiClient.post(`/api/license/approve/${tenantId}`);
      loadData();
    } catch (e) {
      alert('Gagal menyetujui lisensi');
    }
  };

  const handleDeleteTenant = async (tenantId: string) => {
    if (!confirm('PERINGATAN: Hapus permanen sekolah ini dan seluruh data lisensinya?')) return;
    try {
      await apiClient.delete(`/api/license/delete/${tenantId}`);
      loadData();
    } catch (e) {
      alert('Gagal menghapus sekolah');
    }
  };


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

  // AGREGASI / MERGER LISENSI UNTUK MODE HYBRID TUNNEL
  const getAggregatedTenants = (): (Tenant & { tunnelLicenseKey?: string; tunnelStatus?: string })[] => {
    const tunnels = tenants.filter(t => t.productId === 'easy-tunnel');
    const mainLicenses = tenants.filter(t => t.productId !== 'easy-tunnel');
    const mergedTunnelIds = new Set<string>();

    const merged = mainLicenses.map(main => {
      if (main.deployMode?.toLowerCase() === 'hybrid' || main.requestedSlug) {
        // Cari tunnel yang memiliki requestedSlug atau schoolName yang sama
        const matchTunnel = tunnels.find(tun => 
          (tun.requestedSlug && main.requestedSlug && tun.requestedSlug === main.requestedSlug) ||
          (tun.schoolName && main.schoolName && tun.schoolName === main.schoolName)
        );

        if (matchTunnel) {
          mergedTunnelIds.add(matchTunnel.id);
          return {
            ...main,
            wireguardIp: matchTunnel.wireguardIp || main.wireguardIp,
            tunnelLicenseKey: matchTunnel.licenseKey,
            tunnelStatus: matchTunnel.status
          };
        }
      }
      return main;
    });

    // Tetap tampilkan tunnel yang tidak memiliki server utama (orphan tunnels)
    const orphanTunnels = tunnels.filter(tun => !mergedTunnelIds.has(tun.id));
    return [...merged, ...orphanTunnels];
  };

  const aggregatedTenants = getAggregatedTenants();

  // CALCULATE STATS FOR ANALYTICS CARDS
  const totalServers = aggregatedTenants.length;
  const onlineServers = aggregatedTenants.filter(t => isTenantOnline(t.lastHeartbeatAt)).length;
  const offlineServers = totalServers - onlineServers;
  const activeTunnelsCount = tenants.filter(t => t.productId === 'easy-tunnel' && t.status === 'active').length;

  const filteredTenants = aggregatedTenants.filter(t => {
    const matchesProduct = selectedProductId === 'all' || t.productId === selectedProductId;
    const matchesSearch = !searchQuery || 
                          t.schoolName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.requestedSlug?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.licenseKey?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (t as any).tunnelLicenseKey?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const isOnline = isTenantOnline(t.lastHeartbeatAt);
    const matchesStatus = selectedStatus === 'all' || 
                          (selectedStatus === 'online' && isOnline) || 
                          (selectedStatus === 'offline' && !isOnline);

    const matchesNodeType = selectedNodeType === 'all' || 
                            (selectedNodeType === t.nodeType);

    return matchesProduct && matchesSearch && matchesStatus && matchesNodeType;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-white text-2xl font-bold">Kelola Server & Tunnel</h2>
          <p className="text-slate-400 text-sm">Daftar infrastruktur server node (SaaS, On-Premise) dan Easy Tunnel.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={loadData}
            className="p-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 rounded-xl transition"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition flex-1 md:flex-none"
          >
            <Plus className="w-5 h-5" />
            Daftar Server Baru
          </button>
        </div>
      </div>

      {/* ANALYTICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Server */}
        <div 
          onClick={() => {
            setSelectedStatus('all');
            setSelectedNodeType('all');
            setSelectedProductId('all');
          }}
          className={`bg-slate-900/50 backdrop-blur-md border p-5 rounded-2xl flex items-center justify-between shadow-xl cursor-pointer hover:scale-[1.01] transition-all duration-300 group ${
            selectedStatus === 'all' && selectedNodeType === 'all' && selectedProductId === 'all'
              ? 'border-indigo-500/80 shadow-indigo-500/10 ring-1 ring-indigo-500/30'
              : 'border-slate-800/80 hover:border-slate-700/60 hover:shadow-indigo-500/5'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider font-mono">Total Server / Node</span>
            <div className="text-2xl font-bold text-white font-mono">{totalServers}</div>
            <span className="text-[10.5px] text-slate-400 font-sans block">Terdaftar di platform</span>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl group-hover:scale-110 transition-transform duration-300">
            <Building className="w-6 h-6" />
          </div>
        </div>

        {/* Server Online */}
        <div 
          onClick={() => {
            setSelectedStatus('online');
            // Reset nodeType to all when status-focused to avoid empty filter states
            if (selectedNodeType === 'TUNNEL') setSelectedNodeType('all');
          }}
          className={`bg-slate-900/50 backdrop-blur-md border p-5 rounded-2xl flex items-center justify-between shadow-xl cursor-pointer hover:scale-[1.01] transition-all duration-300 group ${
            selectedStatus === 'online'
              ? 'border-emerald-500/80 shadow-emerald-500/10 ring-1 ring-emerald-500/30'
              : 'border-slate-800/80 hover:border-slate-700/60 hover:shadow-emerald-500/5'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider font-mono">Server Online</span>
            <div className="text-2xl font-bold text-white font-mono flex items-baseline gap-2">
              <span>{onlineServers}</span>
              {onlineServers > 0 && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />}
            </div>
            <span className="text-[10.5px] text-emerald-450 font-sans block font-semibold">Aktif mengirim heartbeat</span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl group-hover:scale-110 transition-transform duration-300">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        {/* Server Offline */}
        <div 
          onClick={() => {
            setSelectedStatus('offline');
            if (selectedNodeType === 'TUNNEL') setSelectedNodeType('all');
          }}
          className={`bg-slate-900/50 backdrop-blur-md border p-5 rounded-2xl flex items-center justify-between shadow-xl cursor-pointer hover:scale-[1.01] transition-all duration-300 group ${
            selectedStatus === 'offline'
              ? 'border-rose-500/80 shadow-rose-500/10 ring-1 ring-rose-500/30'
              : 'border-slate-800/80 hover:border-slate-700/60 hover:shadow-rose-500/5'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider font-mono">Server Offline</span>
            <div className="text-2xl font-bold text-white font-mono">{offlineServers}</div>
            <span className="text-[10.5px] text-rose-450 font-sans block font-semibold">Tidak terdeteksi / terputus</span>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl group-hover:scale-110 transition-transform duration-300">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        {/* Easy Tunnel Aktif */}
        <div 
          onClick={() => {
            setSelectedNodeType('TUNNEL');
            // Reset status filter to all to show both online/offline tunnels
            setSelectedStatus('all');
          }}
          className={`bg-slate-900/50 backdrop-blur-md border p-5 rounded-2xl flex items-center justify-between shadow-xl cursor-pointer hover:scale-[1.01] transition-all duration-300 group ${
            selectedNodeType === 'TUNNEL'
              ? 'border-purple-500/80 shadow-purple-500/10 ring-1 ring-purple-500/30'
              : 'border-slate-800/80 hover:border-slate-700/60 hover:shadow-purple-500/5'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider font-mono">Easy Tunnel Aktif</span>
            <div className="text-2xl font-bold text-white font-mono">{activeTunnelsCount}</div>
            <span className="text-[10.5px] text-purple-450 font-sans block font-semibold">Koneksi VPN WireGuard aktif</span>
          </div>
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl group-hover:scale-110 transition-transform duration-300">
            <Cpu className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 p-4.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
        <div className="md:col-span-4.5 relative">
          <input
            type="text"
            placeholder="Cari nama sekolah, slug, atau license key..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-white placeholder-slate-500 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
        </div>
        <div className="md:col-span-3">
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-indigo-400 font-bold text-sm focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="all">🌐 Semua Produk / Aplikasi</option>
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                📦 {pkg.name} ({pkg.id})
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2.25 sm:col-span-1">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-300 font-bold text-sm focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="all">⚡ Semua Status</option>
            <option value="online">🟢 Online</option>
            <option value="offline">💤 Offline</option>
          </select>
        </div>
        <div className="md:col-span-2.25 sm:col-span-1">
          <select
            value={selectedNodeType}
            onChange={(e) => setSelectedNodeType(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-300 font-bold text-sm focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="all">🖥️ Semua Tipe</option>
            <option value="SERVER_SAAS">☁️ SaaS Node</option>
            <option value="SERVER_ONPREMISE">🏫 On-Premise</option>
            <option value="TUNNEL">🔑 Tunnel Node</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-4">Server / Node</th>
                <th className="px-6 py-4">Status & Tunnel</th>
                <th className="px-6 py-4">Spesifikasi Perangkat Keras</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300 text-sm">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                    {loading ? 'Memuat data...' : 'Tidak ada server yang cocok dengan pencarian / filter.'}
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => (
                  <React.Fragment key={t.id}>
                    <tr className="hover:bg-slate-850/50 transition border-b border-slate-850">
                      {/* Server / Node */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <TelemetryStatusIcon tenant={t} />
                          <div className="flex flex-col">
                            <span className="font-semibold text-white text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
                              <span>{t.schoolName}</span>
                              {getNodeTypeBadge(t.nodeType)}
                              {t.is_trial && (
                                <span className="inline-flex items-center px-1.5 py-0.25 rounded text-[8.5px] font-extrabold bg-amber-500/10 border border-amber-500/30 text-amber-400 uppercase tracking-wider">
                                  Trial
                                </span>
                              )}
                            </span>
                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                              <a 
                                href={`https://${t.requestedSlug || t.id}.absenta.id`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-xs text-indigo-400 hover:text-indigo-300 font-mono inline-flex items-center gap-1 group"
                                title="Buka portal sekolah online"
                              >
                                <span>{t.requestedSlug || t.id}.absenta.id</span>
                                <ExternalLink className="w-2.5 h-2.5 text-indigo-500/70 group-hover:text-indigo-400 transition" />
                              </a>
                              {getDeployModeBadge(t.deployMode)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status & Tunnel */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-1.5">
                          <div className="flex items-center gap-2">
                            {isTenantOnline(t.lastHeartbeatAt) ? (
                              <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                ⚡ Online
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500 bg-slate-950/60 border border-slate-800 px-2 py-0.5 rounded-full">
                                💤 Offline
                              </span>
                            )}
                            
                            {/* Lisensi Status */}
                            {(() => {
                              const statusUpper = t.status?.toUpperCase() || '';
                              if (statusUpper === 'ACTIVE') {
                                return (
                                  <span className="text-[10px] font-bold text-emerald-450 uppercase">
                                    • Aktif
                                  </span>
                                );
                              } else if (statusUpper === 'EXPIRED' || statusUpper === 'INACTIVE') {
                                return (
                                  <span className="text-[10px] font-bold text-rose-450 uppercase">
                                    • Expired
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="text-[10px] font-bold text-amber-450 uppercase">
                                    • Pending
                                  </span>
                                );
                              }
                            })()}
                          </div>

                          {/* Metrik Real-time */}
                          {isTenantOnline(t.lastHeartbeatAt) ? (
                            <div className="text-[10.5px] text-slate-400 font-mono space-x-1.5 flex items-center">
                              <span className={t.memoryUsage && t.memoryUsage > 0.8 ? 'text-rose-450 font-bold' : 'text-slate-400'}>
                                RAM: {t.memoryUsage ? `${(t.memoryUsage * 100).toFixed(0)}%` : 'N/A'}
                              </span>
                              <span className="text-slate-700">|</span>
                              <span>DB: {t.dbSize ? `${t.dbSize.toFixed(1)}MB` : 'N/A'}</span>
                              <span className="text-slate-700">|</span>
                              <span>{t.activeUsers ?? 0} Users</span>
                            </div>
                          ) : (
                            <span className="text-[10.5px] text-slate-500 font-mono">
                              {t.lastHeartbeatAt 
                                ? `Sejak ${new Date(t.lastHeartbeatAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} (${new Date(t.lastHeartbeatAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })})` 
                                : 'Belum pernah online'}
                            </span>
                          )}

                          {/* Tunnel IP */}
                          {t.wireguardIp ? (
                            <span className="text-[9.5px] font-bold text-purple-400 bg-purple-950/30 border border-purple-900/30 px-1.5 py-0.5 rounded">
                              🔑 Tunnel: {t.wireguardIp}
                            </span>
                          ) : (
                            <span className="text-[9.5px] font-medium text-slate-500 bg-slate-950/40 border border-slate-900/80 px-1.5 py-0.5 rounded">
                              ☁️ No Tunnel (SaaS)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Spesifikasi Perangkat Keras */}
                      <td className="px-6 py-4">
                        {(() => {
                          const hw = parseHardware(t.osType);
                          if (hw.os === 'N/A' && hw.cpu === 'N/A') {
                            return <span className="text-xs text-slate-500 font-mono">-</span>;
                          }
                          return (
                            <div className="flex flex-col gap-1 text-xs">
                              {/* OS */}
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
                                {t.hostname && (
                                  <span className="text-slate-500 font-sans text-[10px] truncate max-w-[120px]" title={t.hostname}>
                                    ({t.hostname})
                                  </span>
                                )}
                              </div>

                              {/* CPU */}
                              {hw.cpu !== 'N/A' && (
                                <div className="text-[10px] text-slate-400 truncate max-w-[200px]" title={hw.cpu}>
                                  <span className="text-slate-500">CPU:</span> {hw.cpu}
                                </div>
                              )}

                              {/* RAM & Disk */}
                              {(hw.ram !== 'N/A' || hw.disk !== 'N/A') && (
                                <div className="text-[10px] font-mono text-indigo-350">
                                  {hw.ram !== 'N/A' && <span>{hw.ram} RAM</span>}
                                  {hw.ram !== 'N/A' && hw.disk !== 'N/A' && <span className="mx-1 text-slate-700">|</span>}
                                  {hw.disk !== 'N/A' && <span>{hw.disk} Disk</span>}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Aksi */}
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        {!t.licenseKey && (
                          <button
                            onClick={() => handleGenerateLicense(t.id)}
                            className="px-2.5 py-1.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition text-xs font-semibold"
                          >
                            Hasilkan Key
                          </button>
                        )}
                        {t.status?.toUpperCase() !== 'ACTIVE' && t.licenseKey && (
                          <button
                            onClick={() => handleApproveLicense(t.id)}
                            className="px-2.5 py-1.5 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-600 hover:text-white transition text-xs font-semibold"
                          >
                            Setujui
                          </button>
                        )}
                        {t.activatedDevices && t.activatedDevices.length > 0 && (
                          <button
                            onClick={async () => {
                              if (!confirm(`Apakah Anda yakin ingin melepas seluruh kunci perangkat (Reset Device Lock) untuk server ${t.schoolName}?`)) return;
                              try {
                                const res = await apiClient.post(`/api/admin/license/reset-devices/${t.id}`);
                                if (res.data?.success) {
                                  alert('Seluruh kunci perangkat berhasil dilepas!');
                                  loadData();
                                } else {
                                  alert(res.data?.message || 'Gagal melepas kunci perangkat');
                                }
                              } catch (e: any) {
                                alert('Gagal melepas kunci perangkat: ' + (e.response?.data?.message || e.message));
                              }
                            }}
                            className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500 hover:text-slate-950 transition inline-flex"
                            title="Reset Device Lock / HWID"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        {t.licenseKey && (
                          <button
                            onClick={async () => {
                              if (!confirm(`Kirim ulang data lisensi ke nomor WhatsApp operator untuk server ${t.schoolName}?`)) return;
                              try {
                                const res = await apiClient.post(`/api/admin/license/resend-wa/${t.id}`);
                                if (res.data?.success) {
                                  alert('Data lisensi berhasil dikirim ulang via WhatsApp!');
                                } else {
                                  alert(res.data?.message || 'Gagal mengirim ulang data lisensi');
                                }
                              } catch (e: any) {
                                alert('Gagal mengirim ulang data lisensi: ' + (e.response?.data?.message || e.message));
                              }
                            }}
                            className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-600 hover:text-white transition inline-flex"
                            title="Kirim Ulang Lisensi via WA"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedDetailTenant(t);
                            setShowDetailModal(true);
                          }}
                          className="p-1.5 bg-indigo-650/15 border border-indigo-500/25 text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition inline-flex"
                          title="Detail Telemetri Node"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTenant(t.id)}
                          className="p-1.5 bg-rose-600/10 border border-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-600 hover:text-white transition inline-flex"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <AddNodeModal
        show={showAddModal}
        packages={packages}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadData}
      />

      <DetailNodeModal
        show={showDetailModal}
        tenant={selectedDetailTenant}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedDetailTenant(null);
        }}
        onResetSuccess={loadData}
      />
    </div>
  );
}
