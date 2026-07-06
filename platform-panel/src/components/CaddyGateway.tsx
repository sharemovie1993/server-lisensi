import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { Server, RefreshCw, CheckCircle, XCircle, Code, Lock, Unlock, ExternalLink, Folder } from 'lucide-react';

interface CaddyRoute {
  domain: string;
  type: string;
  target: string;
}

function parseCaddyfile(caddyfileText: string): CaddyRoute[] {
  if (!caddyfileText) return [];
  const lines = caddyfileText.split('\n');
  const routes: CaddyRoute[] = [];
  let currentTenant: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# Tenant:')) {
      currentTenant = line.replace('# Tenant:', '').trim();
    }
    
    // Check if line defines a site block (ends with {)
    if (line.endsWith('{')) {
      const domainsStr = line.slice(0, -1).trim();
      // Ignore main global/config blocks or proxy inline blocks
      if (
        domainsStr === '' || 
        domainsStr.startsWith('email') || 
        domainsStr.startsWith('on_demand_tls') || 
        domainsStr.includes('reverse_proxy') ||
        domainsStr === '{' || 
        domainsStr === '#' ||
        domainsStr.startsWith('{')
      ) {
        continue;
      }
      
      const domains = domainsStr.split(',').map(d => d.trim()).filter(Boolean);
      if (domains.length === 0) continue;
      
      // Look inside the block for reverse_proxy IP
      let targetIp = '-';
      let blockDepth = 1;
      let j = i + 1;
      while (j < lines.length && blockDepth > 0) {
        const subLine = lines[j].trim();
        if (subLine.endsWith('{')) blockDepth++;
        if (subLine === '}') blockDepth--;
        
        if (subLine.startsWith('reverse_proxy')) {
          let cleanLine = subLine.replace(/^reverse_proxy\s+(\*\s+)?/, '').trim();
          if (cleanLine.endsWith('{')) {
            cleanLine = cleanLine.slice(0, -1).trim();
          }
          targetIp = cleanLine;
        }
        j++;
      }
      
      domains.forEach(domain => {
        const type = currentTenant ? `Tenant (${currentTenant})` : 'Global Platform';
        routes.push({
          domain,
          type,
          target: targetIp
        });
      });
    }
  }
  return routes;
}

export default function CaddyGateway() {
  const [status, setStatus] = useState<'online' | 'offline' | 'unknown'>('unknown');
  const [caddyfile, setCaddyfile] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/admin/caddy/status');
      if (res.data?.success) {
        setStatus(res.data.status);
        setCaddyfile(res.data.caddyfile || '');
      }
    } catch (e) {
      console.error('Failed to load Caddy status', e);
      setStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSyncCaddy = async () => {
    setSyncing(true);
    try {
      const res = await apiClient.post('/api/admin/caddy/sync');
      alert(res.data?.message || 'Caddy sync completed successfully.');
      loadData();
    } catch (e) {
      alert('Gagal menyinkronkan Caddy.');
    } finally {
      setSyncing(false);
    }
  };

  const routes = parseCaddyfile(caddyfile);

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-white text-2xl font-bold">Caddy Gateway SSL</h2>
          <p className="text-slate-400 text-sm">Kelola sertifikat SSL otomatis, dynamic routing reverse proxy, dan status server Caddy.</p>
        </div>
        <button
          onClick={loadData}
          className="p-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-755 text-slate-300 rounded-xl transition"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 lg:col-span-1">
          <h3 className="text-white text-lg font-bold pb-3 border-b border-slate-800">Status Caddy Service</h3>
          
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-2xl ${status === 'online' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              <Server className="w-8 h-8" />
            </div>
            <div>
              <p className="text-slate-400 text-sm font-medium">Kondisi Caddy</p>
              <h4 className="text-white text-xl font-bold mt-0.5">
                {status === 'online' ? 'AKTIF / ONLINE' : 'TIDAK AKTIF / OFFLINE'}
              </h4>
            </div>
          </div>

          {status === 'online' ? (
            <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/10 text-green-400 text-sm flex items-center gap-2">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              Reverse proxy Caddy berjalan lancar dan siap memproses SSL domain tenant secara otomatis.
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 text-red-400 text-sm flex items-center gap-2">
              <XCircle className="w-5 h-5 flex-shrink-0" />
              Caddy service tidak aktif di sistem operasi Linux VPS. Silakan periksa via terminal.
            </div>
          )}

          <button
            onClick={handleSyncCaddy}
            disabled={syncing || status === 'offline'}
            className="w-full py-3 bg-indigo-650 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/20"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sinkronkan Ulang Rute Caddy
          </button>
        </div>

        {/* Caddyfile text area */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 lg:col-span-2 flex flex-col h-[320px]">
          <h3 className="text-white text-lg font-bold flex items-center gap-2">
            <Code className="w-5 h-5 text-indigo-400" />
            Caddyfile Konfigurasi Terkini
          </h3>
          <div className="flex-1 bg-slate-950 border border-slate-850 rounded-xl p-4 font-mono text-xs text-slate-300 overflow-y-auto whitespace-pre">
            {caddyfile || '# Tidak ada konfigurasi Caddyfile yang ditemukan.'}
          </div>
        </div>
      </div>

      {/* RUTE TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
        <h3 className="text-white text-lg font-bold flex items-center gap-2">
          <Server className="w-5 h-5 text-indigo-400" />
          Daftar Rute Caddy (Custom Domains)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-850 bg-slate-950 text-slate-400 text-xs font-semibold uppercase">
                <th className="px-6 py-4">Domain / URL</th>
                <th className="px-6 py-4">Tipe Rute</th>
                <th className="px-6 py-4">Target Proxy Server</th>
                <th className="px-6 py-4">Status SSL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-slate-350">
              {routes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    Tidak ada rute Caddy terkonfigurasi.
                  </td>
                </tr>
              ) : (
                routes.map((r, idx) => {
                  const isTenant = r.type.startsWith('Tenant');
                  const isSSLAuto = r.domain !== 'api.absenta.id' && r.domain !== 'absenta.id' && !r.domain.includes('localhost');
                  return (
                    <tr key={idx} className="hover:bg-slate-850/30 transition">
                      <td className="px-6 py-4 font-bold text-white">
                        <a
                          href={`https://${r.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1.5 font-medium cursor-pointer"
                        >
                          <span>{r.domain}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-emerald-500/80" />
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${
                          isTenant 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}>
                          {r.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-400 font-semibold text-xs">
                        {r.target !== '-' ? (
                          <span className="flex items-center gap-1.5 text-slate-300">
                            <Server className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{r.target}</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <Folder className="w-3.5 h-3.5 text-slate-600" />
                            <span>Berkas Lokal</span>
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isSSLAuto ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/5 px-2.5 py-1 border border-emerald-500/15 rounded-lg">
                            <Lock className="w-3.5 h-3.5 text-emerald-500" />
                            <span>SSL Aktif (Auto)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-800/10 px-2.5 py-1 border border-slate-800 rounded-lg">
                            <Unlock className="w-3.5 h-3.5 text-slate-600" />
                            <span>SSL Manual</span>
                          </span>
                        )}
                      </td>
                    </tr>
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
