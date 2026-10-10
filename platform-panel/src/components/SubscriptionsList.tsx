import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { Calendar, ShieldAlert, CheckCircle, RefreshCw, Search, ChevronRight, Server, ExternalLink, Building, Copy, Check, Zap } from 'lucide-react';

interface Subscription {
  id: string;
  tenantId: string;
  licenseId: string;
  startDate: string;
  endDate: string;
  status: string;
  productId?: string;
  planId?: string;
  planName?: string;
  productName?: string;
  slug?: string;
  licenseKey?: string;
  serverName?: string;
  serverLastHeartbeatAt?: string | null;
  isTrial?: boolean;
}

const getCleanModuleName = (productId?: string, planId?: string, productName?: string) => {
  const pId = (planId || '').toLowerCase();
  if (pId.includes('whatsapp') || pId.includes('wa')) return 'WhatsApp';
  if (pId.includes('hubin') || pId.includes('hubungan')) return 'Hubin';
  if (pId.includes('sarpras') || pId.includes('sarana')) return 'Sarpras';
  if (pId.includes('coop') || pId.includes('koperasi')) return 'Koperasi';
  if (pId.includes('kantin')) return 'Kantin';
  if (pId.includes('tunnel') || pId.includes('vpn')) return 'Tunnel';

  if (productName) return productName;
  if (!productId) return 'Modul';
  const cleanId = productId.toLowerCase().replace('platform-', '');
  return cleanId.charAt(0).toUpperCase() + cleanId.slice(1);
};

const formatPlanTitle = (nameOrId?: string) => {
  if (!nameOrId) return 'Standard';
  let title = nameOrId;
  if (title.toLowerCase() === 'saas-node') return 'Akses Portal Utama';
  if (title.includes('_')) {
    title = title
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return title;
};

const getRemainingDays = (endDate?: string) => {
  if (!endDate) return null;
  const end = new Date(endDate).getTime();
  if (isNaN(end)) return null;
  const now = Date.now();
  const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return diffDays;
};

export default function SubscriptionsList() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedSchools, setExpandedSchools] = useState<Record<string, boolean>>({});
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyKey = (key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Migrate server states
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [selectedMigrateSchool, setSelectedMigrateSchool] = useState('');
  const [currentLicenseId, setCurrentLicenseId] = useState('');
  const [targetLicenseId, setTargetLicenseId] = useState('');
  const [nodes, setNodes] = useState<any[]>([]);

  const fetchNodes = async () => {
    try {
      const res = await apiClient.get('/api/admin/nodes');
      if (res.data?.success) {
        // Hanya tampilkan server yang valid untuk Cakola (SaaS / On-Premise)
        const filteredNodes = (res.data.data || []).filter((n: any) => 
          n.productId === 'cakola' || n.productId === 'platform-absenta'
        );
        setNodes(filteredNodes);
      }
    } catch (e) {
      console.error('Failed to fetch server nodes', e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [subsRes, productsRes] = await Promise.all([
        apiClient.get('/api/admin/subscriptions'),
        apiClient.get('/api/admin/products')
      ]);
      setSubs(subsRes.data?.data || []);
      setProducts(productsRes.data?.data || []);
      await fetchNodes();
    } catch (e) {
      console.error('Failed to load subscriptions', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatDateRange = (start?: string, end?: string) => {
    const format = (dateStr?: string) => {
      if (!dateStr || dateStr.trim() === '') return null;
      const parsed = Date.parse(dateStr);
      if (isNaN(parsed)) return null;
      return new Date(parsed).toLocaleDateString('id-ID', { dateStyle: 'medium' });
    };
    const s = format(start);
    const e = format(end);
    if (!s && !e) return 'Selamanya / N/A';
    return `${s || '?'} - ${e || '?'}`;
  };

  const toggleExpand = (schoolName: string) => {
    setExpandedSchools(prev => ({
      ...prev,
      [schoolName]: !prev[schoolName]
    }));
  };

  // Get unique list of schools/tenants from subscriptions
  const uniqueTenants = Array.from(new Set(subs.map(s => s.tenantId || 'Sekolah Tidak Dikenal').filter(Boolean))).sort();

  const filteredSubs = subs.filter(s => {
    const matchesProduct = selectedProductId === 'all' || s.productId === selectedProductId;
    const matchesTenant = selectedTenantId === 'all' || s.tenantId === selectedTenantId;
    const matchesSearch = !searchQuery || 
                          s.tenantId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.planName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.licenseId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.slug?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProduct && matchesTenant && matchesSearch;
  });

  // Group subscriptions by school/tenant
  const groupedSubs = filteredSubs.reduce((acc: Record<string, Subscription[]>, curr) => {
    const key = curr.tenantId || 'Sekolah Tidak Dikenal';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(curr);
    return acc;
  }, {});

  // Checkbox interactions
  const handleToggleSelectSub = (id: string) => {
    setSelectedSubIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const isGroupFullySelected = (group: Subscription[]) => {
    return group.every(s => selectedSubIds.includes(s.id));
  };

  const handleToggleSelectGroup = (group: Subscription[]) => {
    const allIds = group.map(s => s.id);
    const isAllSelected = allIds.every(id => selectedSubIds.includes(id));
    if (isAllSelected) {
      setSelectedSubIds(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setSelectedSubIds(prev => Array.from(new Set([...prev, ...allIds])));
    }
  };

  const handleToggleSelectAll = () => {
    const allFilteredIds = filteredSubs.map(s => s.id);
    const isAllSelected = allFilteredIds.every(id => selectedSubIds.includes(id));
    if (isAllSelected) {
      setSelectedSubIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedSubIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleMigrateServer = async () => {
    if (!targetLicenseId) {
      alert('Pilih server tujuan terlebih dahulu.');
      return;
    }
    
    setLoading(true);
    try {
      const res = await apiClient.post('/api/admin/subscriptions/migrate', {
        schoolName: selectedMigrateSchool,
        targetLicenseId
      });
      if (res.data?.success) {
        alert(`Sukses memindahkan server instansi ${selectedMigrateSchool}!`);
        setShowMigrateModal(false);
        setTargetLicenseId('');
        loadData();
      } else {
        alert(res.data?.message || 'Gagal memindahkan server.');
      }
    } catch (err: any) {
      alert('Gagal memindahkan server: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedSubIds.length} langganan terpilih secara permanen? Tindakan ini tidak dapat dibatalkan.`)) return;
    setLoading(true);
    try {
      await apiClient.post('/api/admin/subscriptions/bulk-delete', { ids: selectedSubIds });
      alert('Langganan terpilih berhasil dihapus.');
      setSelectedSubIds([]);
      loadData();
    } catch (e) {
      console.error('Failed to bulk delete subscriptions', e);
      alert('Gagal menghapus langganan terpilih.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-white text-2xl font-bold">Daftar Sekolah / Tenant</h2>
          <p className="text-slate-400 text-sm">Informasi detail tenant sekolah terdaftar dan modul langganan.</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedSubIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold transition shadow-lg flex items-center gap-1.5"
            >
              🗑️ Hapus Terpilih ({selectedSubIds.length})
            </button>
          )}
          <button
            onClick={loadData}
            className="p-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 rounded-xl transition"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
        <div className="relative">
          <input
            type="text"
            placeholder="Cari nama sekolah, paket plan, atau subdomain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-white placeholder-slate-500 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
        </div>
        
        <div>
          <select
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-emerald-400 font-bold text-sm focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="all">🏫 Semua Sekolah / Tenant</option>
            {uniqueTenants.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-indigo-400 font-bold text-sm focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="all">🌐 Semua Produk / Aplikasi</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                📦 {p.name} ({p.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* EXPANDABLE TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="px-4 py-4 w-10 text-center"></th>
                <th className="px-4 py-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredSubs.length > 0 && filteredSubs.every(s => selectedSubIds.includes(s.id))}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded border-slate-850 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4">Sekolah / Instansi</th>
                <th className="px-6 py-4">Domain Portal</th>
                <th className="px-6 py-4">Langganan Aktif</th>
                <th className="px-6 py-4 text-right">Server Node Host</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300 text-sm">
              {Object.entries(groupedSubs).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                    {loading ? 'Memuat data...' : 'Tidak ada langganan yang cocok dengan pencarian / filter.'}
                  </td>
                </tr>
              ) : (
                Object.entries(groupedSubs).map(([schoolName, rawGroup]) => {
                  const isExpanded = !!expandedSchools[schoolName];
                  
                  // Extract server node details
                  const sampleItem = rawGroup[0];
                  const slug = rawGroup.find(s => s.slug)?.slug || sampleItem?.slug || '-';
                  const serverName = sampleItem?.serverName || 'Server Induk';
                  const licenseKey = rawGroup.find(s => s.licenseKey)?.licenseKey || sampleItem?.licenseKey || '';

                  // Pisahkan kategori modul
                  const coreServerSub = rawGroup.find(s => s.planId === 'saas-node');
                  const commercialSubs = rawGroup.filter(s => s.planId !== 'saas-node');
                  const activeSubs = commercialSubs.filter(s => s.status === 'ACTIVE');
                  const inactiveSubs = commercialSubs.filter(s => s.status !== 'ACTIVE');

                  // Evaluasi status sekolah secara akurat
                  const hasActivePaid = activeSubs.some(s => !s.isTrial);
                  const hasActiveTrial = activeSubs.some(s => s.isTrial);
                  const isExpiredAll = commercialSubs.length > 0 && activeSubs.length === 0;
                  
                  // Dapatkan heartbeat terbaru dari seluruh modul di grup sekolah ini
                  const getGroupHeartbeat = () => {
                    const validHeartbeats = rawGroup
                      .map(s => s.serverLastHeartbeatAt)
                      .filter(Boolean) as string[];
                    if (validHeartbeats.length === 0) return null;
                    const times = validHeartbeats.map(h => new Date(h).getTime());
                    return new Date(Math.max(...times)).toISOString();
                  };
                  const latestHeartbeat = getGroupHeartbeat();
                  const isServerOnline = latestHeartbeat 
                    ? (Date.now() - new Date(latestHeartbeat).getTime() < 5 * 60 * 1000) 
                    : false;

                  return (
                    <React.Fragment key={schoolName}>
                      <tr 
                        className="hover:bg-slate-850/50 cursor-pointer transition border-b border-slate-850"
                        onClick={() => toggleExpand(schoolName)}
                      >
                        <td className="px-4 py-4 text-center w-10">
                          <ChevronRight className={`w-4 h-4 mx-auto text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-indigo-400' : ''}`} />
                        </td>
                        <td className="px-4 py-4 text-center w-10" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isGroupFullySelected(rawGroup)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleSelectGroup(rawGroup);
                            }}
                            className="w-4 h-4 rounded border-slate-855 bg-slate-955 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1 text-left">
                            <span className="font-bold text-white text-sm block">
                              {schoolName}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {hasActivePaid ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[8.5px] font-extrabold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 uppercase tracking-wider">
                                  BERLANGGANAN AKTIF
                                </span>
                              ) : hasActiveTrial ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[8.5px] font-extrabold bg-amber-500/15 border border-amber-500/30 text-amber-400 uppercase tracking-wider">
                                  TRIAL
                                </span>
                              ) : isExpiredAll ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[8.5px] font-extrabold bg-rose-500/15 border border-rose-500/30 text-rose-400 uppercase tracking-wider">
                                  KEDALUWARSA
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[8.5px] font-extrabold bg-slate-800 border border-slate-700 text-slate-400 uppercase tracking-wider">
                                  STANDAR
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          {slug !== '-' ? (
                            <a 
                              href={`https://${slug}.absenta.id`}
                              target="_blank" 
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-[10.5px] font-mono text-indigo-400 rounded-lg border border-indigo-500/20 transition cursor-pointer flex items-center gap-1 w-fit group"
                              title="Buka portal sekolah online"
                            >
                              <span>{slug}.absenta.id</span>
                              <ExternalLink className="w-2.5 h-2.5 text-indigo-500/70 group-hover:text-indigo-400 transition" />
                            </a>
                          ) : (
                            <span className="text-slate-500 font-mono text-xs">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1.5 text-left">
                            {activeSubs.length > 0 ? (
                              activeSubs.map(s => {
                                const isBundled = (s.planId || '').toLowerCase().includes('lengkap') || (s.planName || '').toLowerCase().includes('lengkap');
                                return (
                                  <div key={s.id} className="flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 font-semibold shadow-sm">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                                      <span>{formatPlanTitle(s.planName || s.planId)}</span>
                                    </span>
                                    {isBundled && (
                                      <span className="px-1.5 py-0.5 bg-purple-500/15 border border-purple-500/30 text-purple-300 rounded text-[9.5px] font-mono font-bold flex items-center gap-1" title="Termasuk lisensi Easy Tunnel VPN">
                                        ⚡ +Easy Tunnel
                                      </span>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <span className="text-slate-400 text-xs italic">
                                {coreServerSub ? 'Akses Portal Dasar (Tanpa Add-on)' : 'Belum ada paket aktif'}
                              </span>
                            )}
                            
                            {inactiveSubs.length > 0 && (
                              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                <span>• {inactiveSubs.length} riwayat paket kedaluwarsa/nonaktif</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex justify-end items-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearchQuery(serverName);
                              }}
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] rounded border font-mono transition hover:scale-105 active:scale-95 cursor-pointer ${
                                isServerOnline 
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold' 
                                  : 'bg-slate-800 border-slate-750 text-slate-400'
                              }`}
                              title={isServerOnline ? `Server: ${serverName} (ONLINE) | Klik untuk memfilter` : `Server: ${serverName} (OFFLINE) | Klik untuk memfilter`}
                            >
                              <Server className="w-3 h-3 flex-shrink-0" />
                              <span>{serverName}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-950/60 border-b border-slate-800">
                          <td colSpan={6} className="px-8 py-6 border-l-4 border-indigo-500">
                            <div className="space-y-5">
                              {/* HEADER BAR EXPAND */}
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-800/80">
                                <div>
                                  <h4 className="text-white text-sm font-bold flex items-center gap-2">
                                    <Building className="w-4 h-4 text-indigo-400" />
                                    <span>Manajemen Langganan & Node Infrastruktur: <span className="text-indigo-400">{schoolName}</span></span>
                                  </h4>
                                  <p className="text-xs text-slate-400 mt-0.5">Informasi lisensi portal, masa aktif paket, dan server appliance yang menaungi sekolah.</p>
                                </div>
                                <button
                                  onClick={() => {
                                    setSelectedMigrateSchool(schoolName);
                                    setCurrentLicenseId(sampleItem?.licenseId || '');
                                    setShowMigrateModal(true);
                                  }}
                                  className="px-3.5 py-1.5 bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600 text-indigo-300 hover:text-white transition rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  Pindahkan Server (Migrasi)
                                </button>
                              </div>

                              {/* BLOK 1: LISENSI DASAR PORTAL & INFRASTRUKTUR */}
                              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 grid grid-cols-1 md:grid-cols-3 gap-4 shadow-inner">
                                <div>
                                  <span className="text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider block">Domain Portal Sekolah</span>
                                  <div className="mt-1 flex items-center gap-2">
                                    <span className="text-white font-semibold text-sm font-mono">{slug}.absenta.id</span>
                                    <a 
                                      href={`https://${slug}.absenta.id`}
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="text-indigo-400 hover:text-indigo-300 transition"
                                      title="Buka portal sekolah"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  </div>
                                  <span className="text-[11px] text-slate-400 mt-0.5 block">Subdomain aktif terkoneksi</span>
                                </div>

                                <div>
                                  <span className="text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider block">Server Node Appliance</span>
                                  <div className="mt-1 flex items-center gap-2">
                                    <span className="text-white font-semibold text-sm">{serverName}</span>
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${isServerOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                                      {isServerOnline ? 'ONLINE' : 'OFFLINE'}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-slate-400 mt-0.5 block">Target eksekusi database sekolah</span>
                                </div>

                                <div>
                                  <span className="text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider block">License Key Host</span>
                                  <div className="mt-1 flex items-center gap-2">
                                    <code className="text-amber-400 text-xs font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                      {licenseKey || 'N/A'}
                                    </code>
                                    {licenseKey && (
                                      <button
                                        onClick={(e) => handleCopyKey(licenseKey, e)}
                                        className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition"
                                        title="Salin License Key"
                                      >
                                        {copiedKey === licenseKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                      </button>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                                    {coreServerSub ? `Portal Dasar: ${formatDateRange(coreServerSub.startDate, coreServerSub.endDate)}` : 'Lisensi dasar portal'}
                                  </span>
                                </div>
                              </div>

                              {/* BLOK 2: DAFTAR PAKET & MODUL LANGGANAN AKTIF */}
                              <div className="space-y-3">
                                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                                  <span>✨ Paket / Modul Berlangganan Aktif ({activeSubs.length})</span>
                                </h5>

                                {activeSubs.length === 0 ? (
                                  <div className="p-4 bg-slate-900/40 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-xs">
                                    Sekolah ini belum memiliki modul langganan komersial yang aktif. Hanya lisensi portal dasar.
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {activeSubs.map((s) => {
                                      const remaining = getRemainingDays(s.endDate);
                                      const isBundled = (s.planId || '').toLowerCase().includes('lengkap') || (s.planName || '').toLowerCase().includes('lengkap');

                                      return (
                                        <div key={s.id} className="bg-slate-900/90 border border-emerald-500/30 p-4.5 rounded-2xl space-y-3 relative hover:border-emerald-500/50 transition shadow-lg shadow-emerald-500/5 flex flex-col justify-between">
                                          <div className="space-y-2">
                                            <div className="flex justify-between items-start gap-2">
                                              <div>
                                                <span className="text-xs font-bold text-white block">
                                                  {formatPlanTitle(s.planName || s.planId)}
                                                </span>
                                                <span className="text-[10px] text-indigo-400 font-mono tracking-wider uppercase font-semibold">
                                                  {s.productName || 'Platform Cakola'}
                                                </span>
                                              </div>
                                              <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 rounded-full flex items-center gap-1 flex-shrink-0">
                                                <CheckCircle className="w-3 h-3" />
                                                Aktif
                                              </span>
                                            </div>

                                            {isBundled && (
                                              <div className="px-2.5 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-[10.5px] font-medium text-purple-300 flex items-center gap-1.5">
                                                <Zap className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                                                <span>Termasuk Easy Tunnel Gateway</span>
                                              </div>
                                            )}
                                          </div>

                                          <div className="border-t border-slate-800/80 pt-2.5 space-y-2 text-xs text-slate-400">
                                            <div className="flex justify-between items-center">
                                              <span className="text-slate-500">Masa Berlaku:</span>
                                              <span className="text-slate-200 font-mono text-[11px] flex items-center gap-1 font-medium">
                                                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                                {formatDateRange(s.startDate, s.endDate)}
                                              </span>
                                            </div>

                                            {remaining !== null && (
                                              <div className="flex justify-between items-center text-[11px]">
                                                <span className="text-slate-500">Sisa Durasi:</span>
                                                <span className={`font-mono font-bold ${remaining <= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                  {remaining > 0 ? `${remaining} hari tersisa` : 'Berakhir hari ini'}
                                                </span>
                                              </div>
                                            )}

                                            <div className="flex justify-between items-center pt-1 border-t border-slate-850">
                                              <span className="text-slate-500 text-[11px]">Pilih Hapus:</span>
                                              <input
                                                type="checkbox"
                                                checked={selectedSubIds.includes(s.id)}
                                                onChange={() => handleToggleSelectSub(s.id)}
                                                className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* BLOK 3: RIWAYAT NONAKTIF / EXPIRED (JIKA ADA) */}
                              {inactiveSubs.length > 0 && (
                                <div className="space-y-3 pt-2">
                                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                    <span>📜 Riwayat Paket Sebelumnya ({inactiveSubs.length})</span>
                                  </h5>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {inactiveSubs.map((s) => (
                                      <div key={s.id} className="bg-slate-950/40 border border-slate-850 p-3.5 rounded-xl space-y-2 opacity-75 hover:opacity-100 transition">
                                        <div className="flex justify-between items-start gap-2">
                                          <div>
                                            <span className="text-xs font-semibold text-slate-300 block">
                                              {formatPlanTitle(s.planName || s.planId)}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-mono">
                                              {s.productName || 'Platform Cakola'}
                                            </span>
                                          </div>
                                          <span className="px-1.5 py-0.2 bg-slate-800 text-[9.5px] font-bold text-slate-400 rounded">
                                            Nonaktif
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-850 text-slate-500">
                                          <span>{formatDateRange(s.startDate, s.endDate)}</span>
                                          <input
                                            type="checkbox"
                                            checked={selectedSubIds.includes(s.id)}
                                            onChange={() => handleToggleSelectSub(s.id)}
                                            className="w-3.5 h-3.5 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL MIGRASI SERVER (SAAS -> ONPREMISE) */}
      {showMigrateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative text-left">
            <h3 className="text-white text-xl font-bold mb-1 flex items-center gap-2">
              <RefreshCw className="w-6 h-6 text-indigo-400" />
              Migrasi / Pindahkan Server
            </h3>
            <p className="text-slate-400 text-xs mb-6">
              Pindahkan seluruh modul langganan sekolah *{selectedMigrateSchool}* ke lisensi server fisik tujuan.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5">Server Saat Ini (ID)</label>
                <input
                  type="text"
                  disabled
                  value={currentLicenseId || 'VPS SaaS Induk'}
                  className="w-full px-4 py-2.5 bg-slate-950/50 border border-slate-850 rounded-xl text-slate-500 text-sm focus:outline-none cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5">Pilih Server Tujuan</label>
                <select
                  value={targetLicenseId}
                  onChange={(e) => setTargetLicenseId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-indigo-400 font-bold text-sm focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Pilih Server Node Tujuan --</option>
                  {nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      🖥️ {node.schoolName} ({node.deployMode?.toUpperCase()} | {node.requestedSlug || 'N/A'})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                  * Catatan: Setelah dipindahkan, traffic domain sekolah akan otomatis dialihkan ke IP node server baru saat heartbeat berikutnya.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowMigrateModal(false);
                    setTargetLicenseId('');
                  }}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-bold text-sm transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleMigrateServer}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/25 transition"
                >
                  Proses Migrasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
