import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/apiClient';
import {
  Shield,
  Plus,
  RefreshCw,
  Search,
  Copy,
  Check,
  Trash2,
  Download,
  Wifi,
  WifiOff,
  Globe,
  Radio,
  Server,
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  X,
  Key,
  ExternalLink,
  Layers,
  AlertCircle,
  Laptop,
  Monitor,
  Cpu
} from 'lucide-react';

interface WireguardPeer {
  publicKey: string;
  presharedKey?: string;
  endpoint: string;
  allowedIps: string;
  latestHandshake: number;
  latestHandshakeHuman: string;
  transferRx: number;
  transferTx: number;
  transferRxHuman: string;
  transferTxHuman: string;
  persistentKeepalive: number;
  status: 'active' | 'stale' | 'offline';
  name: string;
  appName?: string;
  subdomain?: string;
  localPort?: number;
  licenseKey?: string;
  hostname?: string;
  osType?: string;
  isRegisteredDb: boolean;
}

interface WireguardStatus {
  interface: string;
  publicKey: string;
  listenPort: number;
  totalPeers: number;
  activePeers: number;
  stalePeers: number;
  offlinePeers: number;
  totalRxHuman: string;
  totalTxHuman: string;
  isOnline: boolean;
}

export default function WireguardManager() {
  const [peers, setPeers] = useState<WireguardPeer[]>([]);
  const [serverStatus, setServerStatus] = useState<WireguardStatus | null>(null);
  const [suggestedIp, setSuggestedIp] = useState<string>('10.0.0.10');
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'stale' | 'offline'>('all');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [activeConfig, setActiveConfig] = useState<{ name: string; config: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Form states for Add Peer
  const [formName, setFormName] = useState<string>('');
  const [formAppName, setFormAppName] = useState<string>('EasyTunnel');
  const [formIpAddress, setFormIpAddress] = useState<string>('');
  const [formSubdomain, setFormSubdomain] = useState<string>('');
  const [formLocalPort, setFormLocalPort] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [peersRes, statusRes] = await Promise.all([
        apiClient.get('/api/admin/wireguard/peers'),
        apiClient.get('/api/admin/wireguard/status')
      ]);

      if (peersRes.data?.success) {
        setPeers(peersRes.data.data || []);
        if (peersRes.data.suggestedNextIp) {
          setSuggestedIp(peersRes.data.suggestedNextIp);
        }
      }

      if (statusRes.data?.success) {
        setServerStatus(statusRes.data.data);
      }
    } catch (err: any) {
      console.error('[WG Load Error]', err.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live Auto Polling every 8 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData(false);
    }, 8000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await apiClient.post('/api/admin/wireguard/sync');
      if (res.data?.success) {
        await loadData(false);
      }
    } catch (err: any) {
      alert('Gagal sync WireGuard: ' + (err.response?.data?.message || err.message));
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenAddModal = () => {
    setFormName('');
    setFormAppName('EasyTunnel');
    setFormIpAddress(suggestedIp);
    setFormSubdomain('');
    setFormLocalPort('');
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleCreatePeer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Nama Peer/Klien wajib diisi.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const portNum = formLocalPort ? parseInt(formLocalPort, 10) : undefined;
      const res = await apiClient.post('/api/admin/wireguard/peers', {
        name: formName.trim(),
        appName: formAppName.trim(),
        ipAddress: formIpAddress.trim(),
        subdomainSlug: formSubdomain.trim() || undefined,
        localPort: portNum
      });

      if (res.data?.success) {
        setIsAddModalOpen(false);
        await loadData(false);

        // Open config preview immediately
        if (res.data.data?.clientConfig) {
          setActiveConfig({
            name: formName.trim(),
            config: res.data.data.clientConfig
          });
          setIsConfigModalOpen(true);
        }
      } else {
        setFormError(res.data?.message || 'Gagal membuat peer.');
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePeer = async (peer: WireguardPeer) => {
    const confirm = window.confirm(
      `Apakah Anda yakin ingin menghapus peer '${peer.name}' (${peer.allowedIps})?\n\nKoneksi klien ini akan seketika terputus dari VPN.`
    );
    if (!confirm) return;

    try {
      const res = await apiClient.delete(`/api/admin/wireguard/peers/${encodeURIComponent(peer.publicKey)}`);
      if (res.data?.success) {
        await loadData(false);
      } else {
        alert(res.data?.message || 'Gagal menghapus peer.');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Gagal menghapus peer.');
    }
  };

  const handleDownloadConfig = (name: string, content: string) => {
    const safeName = name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wg-${safeName}.conf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyConfig = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShowConfigForExisting = (peer: WireguardPeer) => {
    const cleanIp = peer.allowedIps.split('/')[0].trim();
    const serverPubKey = serverStatus?.publicKey || 'SP47bTGqXxN4Qqe2DewpONtYEOh2qcXPTj7dt1g1x2o=';
    const config = `[Interface]
PrivateKey = <MASUKKAN_PRIVATE_KEY_KLIEN>
Address = ${cleanIp}/32
DNS = 1.1.1.1
MTU = 1360

[Peer]
PublicKey = ${serverPubKey}
Endpoint = 103.196.155.87:${serverStatus?.listenPort || 51821}
AllowedIPs = 10.0.0.1/32, 10.0.2.1/32
PersistentKeepalive = 25
`;

    setActiveConfig({
      name: peer.name,
      config
    });
    setIsConfigModalOpen(true);
  };

  const renderOsBadge = (osType?: string) => {
    if (!osType) return null;
    const lower = osType.toLowerCase();
    if (lower.includes('win')) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          🪟 {osType}
        </span>
      );
    }
    if (lower.includes('linux') || lower.includes('ubuntu') || lower.includes('debian')) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          🐧 {osType}
        </span>
      );
    }
    if (lower.includes('mac') || lower.includes('darwin')) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-500/10 text-slate-300 border border-slate-500/20">
          🍎 {osType}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
        💻 {osType}
      </span>
    );
  };

  // Filter peers
  const filteredPeers = peers.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.allowedIps.toLowerCase().includes(search.toLowerCase()) ||
      p.endpoint.toLowerCase().includes(search.toLowerCase()) ||
      (p.hostname && p.hostname.toLowerCase().includes(search.toLowerCase())) ||
      (p.osType && p.osType.toLowerCase().includes(search.toLowerCase())) ||
      (p.subdomain && p.subdomain.toLowerCase().includes(search.toLowerCase())) ||
      (p.appName && p.appName.toLowerCase().includes(search.toLowerCase())) ||
      p.publicKey.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* ── HEADER & STATS ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">WireGuard Server Manager</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Radio className="w-3 h-3 mr-1 animate-pulse" /> wg0 (Port {serverStatus?.listenPort || 51821})
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Live kernel peer monitor, dynamic roaming endpoint tracking, dan auto-provisioning config klien.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all flex items-center space-x-2 ${
              autoRefresh
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Auto refresh live data setiap 8 detik"
          >
            <Activity className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Auto Polling: {autoRefresh ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition-all flex items-center space-x-1.5 disabled:opacity-50"
            title="Sync runtime kernel tanpa reboot service"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync WG'}</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Peer Baru</span>
          </button>
        </div>
      </div>

      {/* ── METRIC CARDS ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Terdaftar</p>
            <h3 className="text-2xl font-bold text-white mt-1">{serverStatus?.totalPeers ?? peers.length}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Semua peer di kernel wg0</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Server className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Peer Aktif (Live)</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">
              {serverStatus?.activePeers ?? peers.filter(p => p.status === 'active').length}
            </h3>
            <p className="text-[11px] text-emerald-500/80 mt-0.5">Handshake &lt; 3 menit lalu</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Wifi className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Stale / Offline</p>
            <h3 className="text-2xl font-bold text-rose-400 mt-1">
              {(serverStatus?.stalePeers || 0) + (serverStatus?.offlinePeers || 0)}
            </h3>
            <p className="text-[11px] text-rose-500/80 mt-0.5">Tidak ada transmisi aktif</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <WifiOff className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Bandwidth</p>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-xs font-semibold text-emerald-400 flex items-center">
                <ArrowDownCircle className="w-3 h-3 mr-1" /> {serverStatus?.totalRxHuman || '0 B'}
              </span>
              <span className="text-xs font-semibold text-blue-400 flex items-center">
                <ArrowUpCircle className="w-3 h-3 mr-1" /> {serverStatus?.totalTxHuman || '0 B'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Akumulasi Rx / Tx server</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH BAR ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama klien, IP (10.0.0.x), subdomain, atau endpoint publik..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
          />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'active', 'stale', 'offline'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all whitespace-nowrap ${
                statusFilter === tab
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {tab === 'all' ? 'Semua Peer' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── PEERS TABLE ─────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Klien / Instansi</th>
                <th className="py-3 px-4">Perangkat & OS</th>
                <th className="py-3 px-4">Virtual IP (VPN)</th>
                <th className="py-3 px-4">Realtime Endpoint (ISP)</th>
                <th className="py-3 px-4">Handshake Terakhir</th>
                <th className="py-3 px-4">Transfer (Rx / Tx)</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && peers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    Memuat data WireGuard peers...
                  </td>
                </tr>
              ) : filteredPeers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    Tidak ada peer yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredPeers.map(peer => (
                  <tr key={peer.publicKey} className="hover:bg-slate-800/40 transition-colors">
                    {/* Name & Subdomain */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white flex items-center">
                          {peer.name}
                          {peer.appName && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              {peer.appName}
                            </span>
                          )}
                        </span>
                        {peer.subdomain ? (
                          <a
                            href={`https://${peer.subdomain}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-teal-400 hover:underline flex items-center mt-0.5"
                          >
                            <ExternalLink className="w-3 h-3 mr-1 inline" /> {peer.subdomain}
                            {peer.localPort && <span className="text-slate-500 ml-1">(:{peer.localPort})</span>}
                          </a>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-500 truncate max-w-[180px] mt-0.5">
                            key: {peer.publicKey.slice(0, 16)}...
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Device & OS */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col space-y-1">
                        {peer.hostname ? (
                          <span className="font-mono text-xs text-slate-200 flex items-center font-medium">
                            <Laptop className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                            {peer.hostname}
                          </span>
                        ) : (
                          <span className="text-slate-600 italic text-[11px]">-</span>
                        )}
                        {renderOsBadge(peer.osType)}
                      </div>
                    </td>

                    {/* Virtual IP */}
                    <td className="py-3.5 px-4 font-mono">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-bold">
                        {peer.allowedIps || '-'}
                      </span>
                    </td>

                    {/* Dynamic Realtime Endpoint */}
                    <td className="py-3.5 px-4 font-mono">
                      {peer.endpoint && peer.endpoint !== '(none)' ? (
                        <div className="flex items-center space-x-1.5">
                          <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-emerald-300 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            {peer.endpoint}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic flex items-center">
                          <Globe className="w-3.5 h-3.5 mr-1 text-slate-600" /> Menunggu paket klien...
                        </span>
                      )}
                    </td>

                    {/* Handshake Status Pill */}
                    <td className="py-3.5 px-4">
                      {peer.status === 'active' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-ping" />
                          {peer.latestHandshakeHuman}
                        </span>
                      ) : peer.status === 'stale' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <Clock className="w-3 h-3 mr-1 text-amber-400" />
                          {peer.latestHandshakeHuman}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          <WifiOff className="w-3 h-3 mr-1 text-slate-500" />
                          Offline
                        </span>
                      )}
                    </td>

                    {/* Transfer Tx/Rx */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col text-[11px]">
                        <span className="text-emerald-400 font-mono">↓ {peer.transferRxHuman}</span>
                        <span className="text-blue-400 font-mono">↑ {peer.transferTxHuman}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleShowConfigForExisting(peer)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-all"
                          title="Lihat & Download Template Config Klien (.conf)"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePeer(peer)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 hover:border-rose-800 transition-all"
                          title="Hapus Peer dari Server"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: TAMBAH PEER BARU ──────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-5">
              <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Tambah Peer WireGuard Baru</h3>
                <p className="text-xs text-slate-400">Otomatis generate keypair dan file konfigurasi klien.</p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePeer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Klien / Instansi *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: SMKN 1 Plered, Supabase Local, Studio Undangan"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Aplikasi</label>
                  <input
                    type="text"
                    placeholder="EasyTunnel / Absenta / Undangan"
                    value={formAppName}
                    onChange={e => setFormAppName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Virtual IP VPN *</label>
                  <input
                    type="text"
                    required
                    placeholder="10.0.0.12"
                    value={formIpAddress}
                    onChange={e => setFormIpAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Opsional: Reverse Proxy Subdomain
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Slug Subdomain</label>
                    <input
                      type="text"
                      placeholder="contoh: myschool"
                      value={formSubdomain}
                      onChange={e => setFormSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                    {formSubdomain && (
                      <span className="text-[10px] text-teal-400 mt-1 block">
                        👉 https://{formSubdomain}.absenta.id
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Port Lokal Klien</label>
                    <input
                      type="number"
                      placeholder="Contoh: 3000, 4001, 8080"
                      value={formLocalPort}
                      onChange={e => setFormLocalPort(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl text-[11px] text-slate-400 space-y-1">
                <p className="text-emerald-400 font-semibold flex items-center">
                  <Check className="w-3.5 h-3.5 mr-1" /> Dynamic Roaming Enabled
                </p>
                <p>
                  Server tidak akan menuliskan <code>Endpoint</code> kaku di server, sehingga klien bebas berubah IP publik tanpa pernah terputus.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-medium shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center space-x-2"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{submitting ? 'Menyimpan...' : 'Simpan & Generate .conf'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: VIEW & DOWNLOAD CONFIG ────────────────────────────────── */}
      {isConfigModalOpen && activeConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsConfigModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-teal-500/10 border border-teal-500/20 rounded-xl flex items-center justify-center text-teal-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Konfigurasi WireGuard Klien</h3>
                <p className="text-xs text-slate-400">{activeConfig.name} (.conf siap pakai)</p>
              </div>
            </div>

            <div className="relative mb-4">
              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400 overflow-x-auto max-h-72">
                {activeConfig.config}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500">
                Import file ini ke WireGuard Windows / Linux / Mikrotik.
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleCopyConfig(activeConfig.config)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition-all flex items-center space-x-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin!' : 'Salin Teks'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadConfig(activeConfig.name, activeConfig.config)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .conf</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
