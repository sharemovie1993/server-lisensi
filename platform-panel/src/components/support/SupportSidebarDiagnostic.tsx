import React, { useState } from 'react';
import apiClient from '../../api/apiClient';
import { 
  Laptop, 
  AlertTriangle, 
  CreditCard, 
  AlertCircle, 
  Activity, 
  ExternalLink,
  Star
} from 'lucide-react';

interface SupportTicket {
  id: string;
  tenantId: string;
  schoolName?: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  productId?: string;
  attachments?: string[] | any;
  rating?: number | null;
  ratingComment?: string | null;
  requestedSlug?: string;
  licenseKey?: string;
  planId?: string;
  licenseStatus?: string;
  lastHeartbeatAt?: string | null;
  deployMode?: string | null;
  activeUsers?: number | null;
  dbSize?: number | null;
  memoryUsage?: number | null;
  lastTapped?: string | null;
  modules?: string[] | null;
}

export interface SupportSidebarDiagnosticProps {
  selectedTicket: SupportTicket | null;
}

export default function SupportSidebarDiagnostic({
  selectedTicket
}: SupportSidebarDiagnosticProps) {
  const renderRatingStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`w-3 h-3 ${i <= rating ? 'text-amber-500 fill-amber-500' : 'text-slate-700'}`}
        />
      );
    }
    return <div className="flex gap-0.5">{stars}</div>;
  };

  const isOnline = (() => {
    if (!selectedTicket?.lastHeartbeatAt) return false;
    const lastHb = new Date(selectedTicket.lastHeartbeatAt).getTime();
    const now = Date.now();
    return now - lastHb < 5 * 60 * 1000; // 5 minutes threshold
  })();

  const getDeployModeText = (mode?: string | null) => {
    if (!mode) return 'Tidak Diketahui';
    if (mode === 'saas') return '☁️ Cloud SaaS (Multi-Tenant)';
    if (mode === 'hybrid') return '🖥️ Hybrid (Lokal + Tunnel)';
    if (mode === 'local') return '🏠 Lokal Sekolah (On-Premise)';
    return mode.toUpperCase();
  };

  const activeModules = selectedTicket?.modules || [];

  return (
    <div className="flex flex-col space-y-4 h-full min-h-0 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl overflow-hidden text-left">
      <div className="pb-2 border-b border-slate-800 flex items-center space-x-1.5">
        <Activity className="text-indigo-400 animate-pulse" size={15} />
        <h3 className="text-white text-xs font-bold uppercase tracking-wider">🛠️ Diagnostik & Live Telemetri</h3>
      </div>

      {!selectedTicket ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-10 text-center">
          <Laptop size={24} className="mb-2 text-slate-750" />
          <p className="text-[10px] leading-relaxed">Pilih tiket bantuan untuk memuat telemetri & info teknis sekolah.</p>
        </div>
      ) : (
        <div className="space-y-4 text-xs flex-1 overflow-y-auto pr-1">
          {/* School Name & ID */}
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Nama Sekolah / Tenant</span>
            <span className="font-extrabold text-white text-xs leading-tight block">
              {selectedTicket.schoolName || 'Tidak Diketahui'}
            </span>
            <span className="text-[9px] text-indigo-400 font-mono block bg-slate-950/60 p-1.5 rounded border border-slate-850 truncate select-all">
              ID: {selectedTicket.tenantId}
            </span>
          </div>

          {/* Status Server & Lisensi */}
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Status Server & Lisensi</span>
            <div className="flex items-center gap-2 pt-0.5">
              <span
                className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                  selectedTicket.licenseStatus === 'active' || selectedTicket.licenseStatus === 'ACTIVE'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                }`}
              >
                Lisensi: {selectedTicket.licenseStatus === 'active' || selectedTicket.licenseStatus === 'ACTIVE' ? 'ACTIVE' : 'PENDING'}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[9px] font-black uppercase flex items-center gap-1 ${
                  isOnline
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-450'}`} />
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>

          {/* Lokasi / Deploy Mode */}
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Lokasi / Deploy Mode</span>
            <span className="font-semibold text-slate-350 text-[10px] block">
              {getDeployModeText(selectedTicket.deployMode)}
            </span>
          </div>

          {/* CSAT Evaluasi */}
          {selectedTicket.rating && (
            <div className="space-y-1 bg-amber-950/20 p-3 rounded-xl border border-amber-900/30">
              <div className="flex items-center space-x-1.5 pb-1.5 border-b border-amber-900/20 text-[10px] font-bold text-amber-400">
                <Star size={11} className="text-amber-400 fill-amber-400" />
                <span>EVALUASI LAYANAN (CSAT)</span>
              </div>
              <div className="pt-1.5 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-450">Nilai Kepuasan</span>
                  {renderRatingStars(selectedTicket.rating)}
                </div>
                {selectedTicket.ratingComment && (
                  <div className="pt-1">
                    <span className="text-[8px] uppercase font-bold text-slate-500 block">Ulasan Sekolah:</span>
                    <p className="text-[9px] text-amber-300 italic font-medium leading-relaxed mt-0.5 whitespace-pre-wrap">
                      "{selectedTicket.ratingComment}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Subscription Info Card */}
          <div className="space-y-3 bg-slate-950/50 p-3 rounded-xl border border-slate-850/80">
            <div className="space-y-1">
              <span className="text-[8px] uppercase font-black text-indigo-400 block">Produk / Aplikasi</span>
              <span className="text-white font-extrabold text-xs block">
                {selectedTicket.productId === 'absenta' ? '📅 Absenta (SaaS Absensi)' : '🔒 G-Form Orkestrator'}
              </span>
            </div>
            
            <div className="space-y-1">
              <span className="text-[8px] uppercase font-black text-indigo-400 block">Kunci Lisensi (Key)</span>
              <span className="text-indigo-300 font-mono text-[10px] font-bold block select-all tracking-wider">
                {selectedTicket.licenseKey || 'N/A'}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[8px] uppercase font-black text-indigo-400 block">Paket Langganan</span>
              <span className="text-white font-extrabold text-[10px] block truncate">
                🏷️ {selectedTicket.planId || 'Standard/Custom'}
              </span>
            </div>

            {/* Purchased Modules List */}
            <div className="space-y-1.5 pt-1.5 border-t border-slate-800/80">
              <span className="text-[8px] uppercase font-black text-indigo-400 block">Modul Aktif Sekolah</span>
              {activeModules.length === 0 ? (
                <span className="text-slate-550 text-[9px] italic block">Belum ada modul aktif</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {activeModules.map((m: string) => (
                    <span key={m} className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-[8px] font-mono font-bold uppercase rounded text-indigo-300">
                      📦 {m.replace('platform-', '')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Technical Telemetry */}
          <div className="space-y-2 pb-2">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Metrik Operasional (Live)</span>
            
            <div className="space-y-1 bg-slate-950/30 p-2.5 rounded-lg border border-slate-850/50">
              <div className="flex justify-between text-[9px] text-slate-450">
                <span>Ukuran Database</span>
                <span className="text-slate-300 font-mono">
                  {selectedTicket.dbSize ? `${selectedTicket.dbSize.toFixed(1)} MB` : 'N/A'}
                </span>
              </div>
              <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full" style={{ width: selectedTicket.dbSize ? `${Math.min(100, (selectedTicket.dbSize / 2048) * 100)}%` : '0%' }} />
              </div>
            </div>

            <div className="space-y-1 bg-slate-950/30 p-2.5 rounded-lg border border-slate-850/50">
              <div className="flex justify-between text-[9px] text-slate-455">
                <span>Pengguna Aktif</span>
                <span className="text-slate-300 font-mono">
                  {selectedTicket.activeUsers !== null && selectedTicket.activeUsers !== undefined ? `${selectedTicket.activeUsers} user` : 'N/A'}
                </span>
              </div>
              <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full" style={{ width: selectedTicket.activeUsers ? `${Math.min(100, (selectedTicket.activeUsers / 500) * 100)}%` : '0%' }} />
              </div>
            </div>

            <div className="space-y-1 bg-slate-950/30 p-2.5 rounded-lg border border-slate-850/50">
              <div className="flex justify-between text-[9px] text-slate-455">
                <span>Penggunaan Memori</span>
                <span className="text-slate-300 font-mono">
                  {selectedTicket.memoryUsage ? `${(selectedTicket.memoryUsage * 100).toFixed(1)}%` : 'N/A'}
                </span>
              </div>
              <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full" style={{ width: selectedTicket.memoryUsage ? `${selectedTicket.memoryUsage * 100}%` : '0%' }} />
              </div>
            </div>
          </div>

          {/* Impersonate Link (Assist Login) */}
          {selectedTicket.requestedSlug && (
            <div className="pt-2 border-t border-slate-800">
              <SupportAssistButton selectedTicket={selectedTicket} />
              <span className="text-[8px] text-slate-500 block mt-1.5 text-center leading-relaxed">
                Buka instansi klien untuk melakukan diagnosis atau assist login.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SupportAssistButton({ selectedTicket }: { selectedTicket: SupportTicket }) {
  const [generating, setGenerating] = useState(false);

  const handleAssistClick = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await apiClient.get(`/api/admin/tickets/${selectedTicket.id}/assist-token`);
      if (res.data?.success && res.data?.token) {
        // Redirect to remote school url with token query parameter
        const targetUrl = `https://${selectedTicket.requestedSlug}.absenta.id/?support_token=${res.data.token}`;
        window.open(targetUrl, '_blank');
      } else {
        alert('Gagal mendapatkan token assist login');
      }
    } catch (e: any) {
      console.error(e);
      alert('Gagal memproses remote assist login: ' + (e.response?.data?.message || e.message));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={handleAssistClick}
      disabled={generating}
      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-lg shadow-indigo-600/20 disabled:opacity-55 cursor-pointer"
    >
      <Laptop size={11} />
      {generating ? 'Menyiapkan Akses...' : 'Buka Aplikasi Sekolah'}
      <ExternalLink size={10} className="opacity-80" />
    </button>
  );
}
