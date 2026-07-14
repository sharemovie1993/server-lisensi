import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { BadgeCheck, ShieldAlert, Key, Plus, Trash2, Check, RefreshCw, Search, ChevronDown, ChevronUp, Database, Users, Activity, Cpu, Building, Eye, ExternalLink, Send } from 'lucide-react';

interface Tenant {
  id: string;
  schoolName: string;
  requestedSlug: string;
  licenseKey: string;
  status: string;
  createdAt: string;
  productId?: string;
  lastHeartbeatAt?: string | null;
  deployMode?: string | null;
  activeUsers?: number | null;
  dbSize?: number | null;
  memoryUsage?: number | null;
  lastTapped?: string | null;
  modules?: string[];
  schools?: Array<{ name: string; subdomain: string | null } | string>;
  hostname?: string | null;
  osType?: string | null;
  activeDevices?: number | null;
  activatedDevices?: Array<{ id: number; deviceId: string; activatedAt: string }>;
  wireguardIp?: string | null;
}

export default function TenantManager() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedTenants, setExpandedTenants] = useState<Record<string, boolean>>({});
  
  // States for Detail Node Modal Popup
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetailTenant, setSelectedDetailTenant] = useState<Tenant | null>(null);

  const toggleTenant = (id: string) => {
    setExpandedTenants(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getOnlineStatusDot = (t: Tenant) => {
    if (!t.lastHeartbeatAt || !isTenantOnline(t.lastHeartbeatAt)) {
      return (
        <span 
          className="h-2.5 w-2.5 rounded-full flex-shrink-0 bg-slate-700" 
          title="Offline" 
        />
      );
    }
    
    // RAM kritis (> 85%) -> Merah Berkedip Cepat (animate-ping)
    if (t.memoryUsage && t.memoryUsage > 0.85) {
      return (
        <span 
          className="h-2.5 w-2.5 rounded-full flex-shrink-0 bg-rose-500 animate-pulse border border-rose-400" 
          title={`Online | RAM Kritis: ${(t.memoryUsage * 100).toFixed(0)}%`} 
        />
      );
    }

    // RAM tinggi (> 70%) -> Kuning Berkedip Lambat (animate-pulse)
    if (t.memoryUsage && t.memoryUsage > 0.70) {
      return (
        <span 
          className="h-2.5 w-2.5 rounded-full flex-shrink-0 bg-amber-500 animate-pulse border border-amber-400" 
          title={`Online | RAM Tinggi: ${(t.memoryUsage * 100).toFixed(0)}%`} 
        />
      );
    }

    // RAM normal -> Hijau Sehat (animate-pulse)
    return (
      <span 
        className="h-2.5 w-2.5 rounded-full flex-shrink-0 bg-emerald-500 animate-pulse" 
        title="Online | Sehat" 
      />
    );
  };
  
  // Form fields
  const [schoolName, setSchoolName] = useState('');
  const [requestedSlug, setRequestedSlug] = useState('');
  const [packageId, setPackageId] = useState('');
  const [packages, setPackages] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tenantsRes, packagesRes] = await Promise.all([
        apiClient.get('/api/admin/tenants'),
        apiClient.get('/api/admin/products')
      ]);
      setTenants(tenantsRes.data?.data || []);
      setPackages(packagesRes.data?.data || []);
    } catch (e) {
      console.error('Failed to load tenants data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/api/admin/tenants', {
        schoolName,
        requestedSlug,
        packageId,
      });
      if (res.status === 201 || res.status === 200) {
        setShowAddModal(false);
        setSchoolName('');
        setRequestedSlug('');
        loadData();
      }
    } catch (e) {
      alert('Gagal menambahkan sekolah baru');
    }
  };

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

  const isTenantOnline = (lastHeartbeatAt?: string | null) => {
    if (!lastHeartbeatAt) return false;
    return Date.now() - new Date(lastHeartbeatAt).getTime() < 5 * 60 * 1000;
  };

  const getDeployModeBadge = (mode?: string | null) => {
    if (!mode) return null;
    if (mode === 'saas') return <span className="px-1.5 py-0.5 bg-sky-500/10 border border-sky-500/20 text-[9px] font-bold text-sky-400 rounded">Cloud SaaS</span>;
    if (mode === 'hybrid') return <span className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 text-[9px] font-bold text-purple-400 rounded">Hybrid Tunnel</span>;
    if (mode === 'local') return <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold text-amber-400 rounded">On-Premise</span>;
    return <span className="px-1.5 py-0.5 bg-slate-800 text-[9px] font-bold text-slate-400 rounded">{mode.toUpperCase()}</span>;
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

  const filteredTenants = aggregatedTenants.filter(t => {
    const matchesProduct = selectedProductId === 'all' || t.productId === selectedProductId;
    const matchesSearch = !searchQuery || 
                          t.schoolName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.requestedSlug?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.licenseKey?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (t as any).tunnelLicenseKey?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProduct && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-white text-2xl font-bold">Kelola Server / Node</h2>
          <p className="text-slate-400 text-sm">Daftar server node dan lisensi aktif.</p>
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

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Cari nama sekolah, slug, atau license key..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-white placeholder-slate-500 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
        </div>
        <div className="w-full sm:w-72">
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-indigo-400 font-bold text-sm focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="all">🌐 Semua Produk / Aplikasi</option>
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                📦 {pkg.name} ({pkg.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-4">Server / Node</th>
                <th className="px-6 py-4">Subdomain / SLUG</th>
                <th className="px-6 py-4">Status Lisensi</th>
                <th className="px-6 py-4">License Key</th>
                <th className="px-6 py-4">Tanggal Daftar</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300 text-sm">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                    {loading ? 'Memuat data...' : 'Tidak ada server yang cocok dengan pencarian / filter.'}
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => (
                  <React.Fragment key={t.id}>
                    <tr className="hover:bg-slate-850/50 transition border-b border-slate-850">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          {getOnlineStatusDot(t)}
                          <div className="flex flex-col">
                            <span className="font-semibold text-white text-xs sm:text-sm">
                              {t.schoolName}
                            </span>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
                              {isTenantOnline(t.lastHeartbeatAt) ? (
                                <>
                                  <span className={t.memoryUsage && t.memoryUsage > 0.8 ? 'text-rose-450 font-bold' : 'text-slate-400'}>
                                    RAM: {t.memoryUsage ? `${(t.memoryUsage * 100).toFixed(0)}%` : 'N/A'}
                                  </span>
                                  <span className="text-slate-700">|</span>
                                  <span className="text-slate-400">
                                    DB: {t.dbSize ? `${t.dbSize.toFixed(1)}MB` : 'N/A'}
                                  </span>
                                  <span className="text-slate-700">|</span>
                                  <span className="text-slate-400">
                                    {t.activeUsers ?? 0} Users
                                  </span>
                                </>
                              ) : (
                                <span className="text-rose-500/85">
                                  {t.lastHeartbeatAt 
                                    ? `Offline sejak ${new Date(t.lastHeartbeatAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` 
                                    : 'Belum pernah online'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-1">
                          <a 
                            href={`https://${t.requestedSlug || t.id}.absenta.id`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs font-mono text-indigo-400 hover:bg-indigo-650/20 hover:text-indigo-300 hover:border-indigo-500/40 transition flex items-center gap-1 group"
                            title="Buka portal sekolah online"
                          >
                            <span>{t.requestedSlug || t.id}</span>
                            <ExternalLink className="w-2.5 h-2.5 text-indigo-500/70 group-hover:text-indigo-400 transition" />
                          </a>
                          {getDeployModeBadge(t.deployMode)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-1.5">
                          {t.status?.toUpperCase() === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
                              <BadgeCheck className="w-3.5 h-3.5" />
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-400 uppercase tracking-wide">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Pending
                            </span>
                          )}
                          {t.wireguardIp ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-950/40 border border-indigo-900/30 text-[9px] font-semibold text-indigo-350">
                              🟢 Tunnel Active ({t.wireguardIp})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[9px] font-semibold text-slate-400">
                              ⚪ No Tunnel (Cloud)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] text-slate-400 select-all leading-relaxed">
                        <div className="flex flex-col gap-1 text-left">
                          <div>
                            <span className="text-[9px] text-indigo-400/80 font-bold block uppercase tracking-wider font-sans mb-0.5">App Key</span>
                            <span className="bg-slate-950/40 px-2 py-0.5 rounded border border-slate-800/80">{t.licenseKey || '(Belum Dibuat)'}</span>
                          </div>
                          {(t as any).tunnelLicenseKey && (
                            <div className="mt-1.5 pt-1.5 border-t border-slate-800/60">
                              <span className="text-[9px] text-purple-400/80 font-bold block uppercase tracking-wider font-sans mb-0.5">Tunnel Key</span>
                              <span className="bg-slate-950/40 px-2 py-0.5 rounded border border-slate-800/80">{(t as any).tunnelLicenseKey}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(t.createdAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
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
                            className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500 hover:text-slate-950 transition"
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
                            className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-600 hover:text-white transition"
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
                          className="p-1.5 bg-indigo-650/15 border border-indigo-500/25 text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition"
                          title="Detail Telemetri Node"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTenant(t.id)}
                          className="p-1.5 bg-rose-600/10 border border-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-600 hover:text-white transition"
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

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-white text-lg font-bold">Daftarkan Sekolah Baru</h3>
            <form onSubmit={handleAddTenant} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase mb-1">Nama Sekolah</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: SMK Negeri 1 Jakarta"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase mb-1">Requested Slug / Subdomain</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: smkn1jakarta"
                  value={requestedSlug}
                  onChange={(e) => setRequestedSlug(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase mb-1">Pilih Produk</label>
                <select
                  required
                  value={packageId}
                  onChange={(e) => setPackageId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Pilih Produk...</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      📦 {pkg.name} ({pkg.id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-300 rounded-xl text-sm font-semibold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25 transition"
                >
                  Simpan Sekolah
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETAIL NODE TELEMETRY & SYSTEM HEALTH */}
      {showDetailModal && selectedDetailTenant && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-left">
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-white text-lg font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" /> Detail Node: {selectedDetailTenant.schoolName}
              </h3>
              <button 
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedDetailTenant(null);
                }} 
                className="text-slate-400 hover:text-white text-2xl font-bold transition focus:outline-none"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4 text-slate-300 text-sm">
              <div className="bg-slate-950/65 border border-slate-850 p-4 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Nama Instansi / Sekolah</span>
                <span className="text-white font-bold text-base">{selectedDetailTenant.schoolName}</span>
                <span className="text-xs text-slate-400 block font-mono">License Key: {selectedDetailTenant.licenseKey || 'N/A'}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="bg-slate-950/50 border border-slate-850 p-3.5 rounded-xl flex items-center space-x-3">
                  <Database className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Basis Data (Size)</span>
                    <span className="text-sm font-bold text-white font-mono">{selectedDetailTenant.dbSize ? `${selectedDetailTenant.dbSize.toFixed(1)} MB` : 'N/A'}</span>
                  </div>
                </div>
                
                <div className="bg-slate-950/50 border border-slate-850 p-3.5 rounded-xl flex items-center space-x-3">
                  <Users className="w-5 h-5 text-sky-400 flex-shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Total Pengguna</span>
                    <span className="text-sm font-bold text-white font-mono">{selectedDetailTenant.activeUsers ?? 0} User</span>
                  </div>
                </div>

                <div className="bg-slate-950/50 border border-slate-850 p-3.5 rounded-xl flex items-center space-x-3">
                  <Key className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Total Perangkat HWID</span>
                    <span className="text-sm font-bold text-white font-mono">{(selectedDetailTenant as any).activeDevices ?? 0} Perangkat</span>
                  </div>
                </div>

                <div className="bg-slate-950/50 border border-slate-850 p-3.5 rounded-xl col-span-1 sm:col-span-3 space-y-1.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Penggunaan Memori (RAM)</span>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          selectedDetailTenant.memoryUsage && selectedDetailTenant.memoryUsage > 0.85 ? 'bg-rose-500' :
                          selectedDetailTenant.memoryUsage && selectedDetailTenant.memoryUsage > 0.65 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`} 
                        style={{ width: `${(selectedDetailTenant.memoryUsage || 0) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-350 font-mono">
                      {selectedDetailTenant.memoryUsage ? `${(selectedDetailTenant.memoryUsage * 100).toFixed(0)}%` : 'N/A'}
                    </span>
                  </div>
                </div>

                {(selectedDetailTenant.hostname || selectedDetailTenant.osType || selectedDetailTenant.lastHeartbeatAt) && (
                  <div className="bg-slate-950/50 border border-slate-850 p-3.5 rounded-xl col-span-1 sm:col-span-3 space-y-2 text-xs font-mono text-slate-400">
                    {selectedDetailTenant.hostname && <div className="flex justify-between"><span className="text-slate-500">Host:</span><span className="text-white font-bold flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-indigo-400" /> {selectedDetailTenant.hostname}</span></div>}
                    {selectedDetailTenant.osType && <div className="flex justify-between"><span className="text-slate-500">Sistem Operasi:</span><span className="text-slate-300">{selectedDetailTenant.osType}</span></div>}
                    {selectedDetailTenant.lastHeartbeatAt && <div className="flex justify-between"><span className="text-slate-500">Heartbeat Terakhir:</span><span className="text-indigo-300">{new Date(selectedDetailTenant.lastHeartbeatAt).toLocaleTimeString('id-ID')} ({new Date(selectedDetailTenant.lastHeartbeatAt).toLocaleDateString('id-ID')})</span></div>}
                    
                    {/* HWID Fingerprints List */}
                    {selectedDetailTenant.activatedDevices && selectedDetailTenant.activatedDevices.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-850 text-left animate-fade-in col-span-1 sm:col-span-3">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-2 tracking-wider font-sans">Daftar HWID Fingerprint Terdaftar:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedDetailTenant.activatedDevices.map((dev) => (
                            <div key={dev.id} className="bg-slate-900 border border-slate-800/80 px-2.5 py-1.5 rounded-lg flex flex-col gap-0.5">
                              <span className="text-indigo-350 font-bold text-[10px] truncate select-all" title={dev.deviceId}>{dev.deviceId}</span>
                              <span className="text-[9px] text-slate-500 font-sans">Aktif: {new Date(dev.activatedAt).toLocaleDateString('id-ID')} {new Date(dev.activatedAt).toLocaleTimeString('id-ID')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-3 border-t border-slate-850 flex justify-end col-span-1 sm:col-span-3">
                      <button
                        onClick={async () => {
                          if (!confirm('Apakah Anda yakin ingin melepas kunci perangkat (Reset Device Lock) untuk server ini?')) return;
                          try {
                            const res = await apiClient.post(`/api/admin/license/reset-devices/${selectedDetailTenant.id}`);
                            if (res.data?.success) {
                              alert('Kunci perangkat berhasil dilepas!');
                              loadData();
                              setShowDetailModal(false);
                            } else {
                              alert(res.data?.message || 'Gagal melepas kunci perangkat');
                            }
                          } catch (e: any) {
                            alert('Gagal melepas kunci perangkat: ' + (e.response?.data?.message || e.message));
                          }
                        }}
                        className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-400 font-bold font-sans text-[11px] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reset Device Lock / HWID Fingerprint</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button 
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedDetailTenant(null);
                }} 
                className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-350 rounded-xl text-sm font-semibold transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
