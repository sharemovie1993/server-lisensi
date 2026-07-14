import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { Calendar, ShieldAlert, CheckCircle, RefreshCw, Search, ChevronRight, Server, ExternalLink } from 'lucide-react';

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

export default function SubscriptionsList() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedSchools, setExpandedSchools] = useState<Record<string, boolean>>({});
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [subsRes, productsRes] = await Promise.all([
        apiClient.get('/api/admin/subscriptions'),
        apiClient.get('/api/admin/products')
      ]);
      setSubs(subsRes.data?.data || []);
      setProducts(productsRes.data?.data || []);
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
                <th className="px-6 py-4">Sekolah</th>
                <th className="px-6 py-4">Domain Akses</th>
                <th className="px-6 py-4">Ringkasan Paket</th>
                <th className="px-6 py-4 text-right">Server / Node</th>
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
 
                  const activeCount = rawGroup.filter(s => s.status === 'ACTIVE').length;
 
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
                          <span className="font-bold text-white text-sm text-left block">{schoolName}</span>
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
                          <div className="flex flex-col gap-1 text-left">
                            {rawGroup.map(s => {
                              const isAct = s.status === 'ACTIVE';
                              const moduleName = getCleanModuleName(s.productId, s.planId, s.productName);
                              const planLabel = s.planName || 'Standard';
                              return (
                                <span key={s.id} className="text-xs font-semibold flex items-center gap-1.5 flex-wrap">
                                  <span className={`w-1.5 h-1.5 rounded-full ${isAct ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                                  <span className="text-slate-200">
                                    {moduleName} <span className="text-slate-500 font-normal">- {planLabel}</span>
                                  </span>
                                  <span className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded leading-none ${isAct ? 'text-emerald-400 bg-emerald-950/20 border border-emerald-900/10' : 'text-slate-500 bg-slate-950/30'}`}>
                                    ({isAct ? 'Aktif' : 'Nonaktif'})
                                  </span>
                                </span>
                              );
                            })}
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
                        <tr className="bg-slate-950/45 border-b border-slate-800">
                          <td colSpan={6} className="px-8 py-6 border-l-4 border-indigo-500">
                            <div className="space-y-4">
                              <h4 className="text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 text-indigo-400 text-left">
                                📦 Rincian Paket & Langganan Sekolah ({rawGroup.length})
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
                                {rawGroup.map((s) => (
                                  <div key={s.id} className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-3 relative hover:border-slate-700 transition shadow-inner">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <span className="text-xs font-bold text-white block">
                                          {getCleanModuleName(s.productId, s.planId, s.productName)}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">
                                          Produk: {s.productId}
                                        </span>
                                      </div>
                                      
                                      {s.planId === 'saas-node' ? (
                                        <span className="px-2 py-0.5 bg-indigo-500/25 border border-indigo-500/30 text-[10px] font-bold text-indigo-300 rounded-md">
                                          Core Server
                                        </span>
                                      ) : s.status === 'ACTIVE' ? (
                                        <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 rounded-md">
                                          Aktif
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-400 rounded-md">
                                          Nonaktif
                                        </span>
                                      )}
                                    </div>
                                    
                                    <div className="border-t border-slate-850 pt-2.5 space-y-1.5 text-xs text-slate-400">
                                      <div className="flex justify-between">
                                        <span className="text-slate-500">Edisi / Plan:</span>
                                        <span className="text-slate-200 font-semibold">{s.planName || 'Standard'}</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-slate-500">Masa Berlaku:</span>
                                        <span className="text-slate-300 font-mono text-[11px] flex items-center gap-1.5">
                                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                          {formatDateRange(s.startDate, s.endDate)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center pt-1">
                                        <span className="text-slate-500">Pilih Hapus:</span>
                                        <input
                                          type="checkbox"
                                          checked={selectedSubIds.includes(s.id)}
                                          onChange={() => handleToggleSelectSub(s.id)}
                                          className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
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
    </div>
  );
}
