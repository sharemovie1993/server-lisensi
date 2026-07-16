import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Zap, 
  Info,
  Database,
  Calendar
} from 'lucide-react';

interface CronLog {
  id: string;
  jobName: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  message: string | null;
  meta: {
    durationMs?: number;
    expiredRevoked?: number;
    warningsSent?: number;
    deletedLicensesFromTrials?: number;
    markedExpiredInvoices?: number;
    deletedInvoicesCount?: number;
    deletedLicensesFromInvoices?: number;
  } | null;
}

interface CronSummary {
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  runningJobs: number;
  lastRunTime: string | null;
  lastSuccessTime: string | null;
}

export default function CronJobMonitor() {
  const [logs, setLogs] = useState<CronLog[]>([]);
  const [summary, setSummary] = useState<CronSummary>({
    totalRuns: 0,
    successRuns: 0,
    failedRuns: 0,
    runningJobs: 0,
    lastRunTime: null,
    lastSuccessTime: null
  });
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiClient.get('/api/admin/cron/logs');
      if (response.data?.success) {
        setLogs(response.data.data || []);
        setSummary(response.data.summary);
      } else {
        setErrorMessage(response.data?.message || 'Gagal memuat data log cron.');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Terjadi kesalahan koneksi saat memuat log.');
    } finally {
      setLoading(false);
    }
  };

  const triggerCronManual = async () => {
    if (triggering) return;
    setTriggering(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await apiClient.post('/api/admin/cron/trigger');
      if (response.data?.success) {
        setSuccessMessage(response.data.message || 'Cron job berhasil dipicu di background!');
        // Refresh data setelah delay singkat agar log RUNNING terdaftar
        setTimeout(() => {
          fetchLogs();
        }, 1500);
      } else {
        setErrorMessage(response.data?.message || 'Gagal memicu cron job.');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Gagal memicu eksekusi cron job.');
    } finally {
      setTriggering(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getDuration = (started: string, finished: string | null, metaDuration?: number) => {
    if (metaDuration !== undefined) return `${(metaDuration / 1000).toFixed(2)}s`;
    if (!finished) return 'Running...';
    const diff = new Date(finished).getTime() - new Date(started).getTime();
    return `${(diff / 1000).toFixed(2)}s`;
  };

  return (
    <div className="space-y-6 text-slate-350">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Monitoring Cron & Background Jobs</h1>
          <p className="text-slate-400 text-sm mt-1">Pantau dan kendalikan status penjadwalan pembersihan lisensi & subskripsi sistem pusat.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 rounded-2xl font-bold text-sm tracking-wide transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Muat Ulang
          </button>
          <button
            onClick={triggerCronManual}
            disabled={triggering}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
          >
            <Play className={`w-4 h-4 ${triggering ? 'animate-pulse' : ''}`} />
            {triggering ? 'Memicu...' : 'Jalankan Sekarang'}
          </button>
        </div>
      </div>

      {/* ALERT MESSAGE */}
      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-3 text-rose-400">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span className="text-sm font-semibold">{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-3 text-emerald-400">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <span className="text-sm font-semibold">{successMessage}</span>
        </div>
      )}

      {/* SUMMARY STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Runs */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Eksekusi</span>
            <div className="text-2xl font-black text-white">{summary.totalRuns} kali</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Zap className="w-6 h-6" />
          </div>
        </div>

        {/* Success vs Failed */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Berhasil / Gagal</span>
            <div className="flex items-center gap-2 text-2xl font-black">
              <span className="text-emerald-400">{summary.successRuns}</span>
              <span className="text-slate-650 font-normal">/</span>
              <span className="text-rose-450">{summary.failedRuns}</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Last Run Time */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Terakhir Berjalan</span>
            <div className="text-sm font-bold text-white mt-1">
              {summary.lastRunTime ? formatDateTime(summary.lastRunTime) : 'Belum Pernah'}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* System Active Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Status Penjadwal</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-bold text-white">Aktif (Daily 01:00 AM)</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* LOG HISTORY TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-white text-base font-black tracking-tight">Riwayat Log Pekerjaan Background</h2>
          <span className="text-xs text-slate-400 bg-slate-850 px-3 py-1 rounded-full font-bold">50 Item Terbaru</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 font-bold text-xs uppercase tracking-wider bg-slate-950/20">
                <th className="px-6 py-4">Waktu Mulai</th>
                <th className="px-6 py-4">Durasi</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Metrik / Statistik Detail</th>
                <th className="px-6 py-4">Hasil / Pesan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                    Belum ada riwayat eksekusi terdaftar di database.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-850/20 transition">
                    <td className="px-6 py-4 text-white font-bold">
                      {formatDateTime(log.startedAt)}
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {getDuration(log.startedAt, log.finishedAt, log.meta?.durationMs)}
                    </td>
                    <td className="px-6 py-4">
                      {log.status === 'SUCCESS' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          SUCCESS
                        </span>
                      )}
                      {log.status === 'FAILED' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-450 border border-rose-500/15">
                          <XCircle className="w-3.5 h-3.5" />
                          FAILED
                        </span>
                      )}
                      {log.status === 'RUNNING' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 animate-pulse">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          RUNNING
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {log.status === 'SUCCESS' && log.meta ? (
                        <div className="flex flex-wrap gap-2">
                          {log.meta.expiredRevoked !== undefined && log.meta.expiredRevoked > 0 && (
                            <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded-md text-xs font-semibold border border-rose-500/10">
                              Expired Revoked: {log.meta.expiredRevoked}
                            </span>
                          )}
                          {log.meta.warningsSent !== undefined && log.meta.warningsSent > 0 && (
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-md text-xs font-semibold border border-amber-500/10">
                              WA Warnings: {log.meta.warningsSent}
                            </span>
                          )}
                          {log.meta.deletedLicensesFromTrials !== undefined && log.meta.deletedLicensesFromTrials > 0 && (
                            <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded-md text-xs font-semibold">
                              Trials Cleared: {log.meta.deletedLicensesFromTrials}
                            </span>
                          )}
                          {log.meta.markedExpiredInvoices !== undefined && log.meta.markedExpiredInvoices > 0 && (
                            <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-md text-xs font-semibold border border-indigo-500/10">
                              Invoices Expired: {log.meta.markedExpiredInvoices}
                            </span>
                          )}
                          {log.meta.deletedInvoicesCount !== undefined && log.meta.deletedInvoicesCount > 0 && (
                            <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded-md text-xs font-semibold">
                              Invoices Purged: {log.meta.deletedInvoicesCount}
                            </span>
                          )}
                          {(!log.meta.expiredRevoked && !log.meta.warningsSent && !log.meta.deletedLicensesFromTrials && !log.meta.markedExpiredInvoices) ? (
                            <span className="text-slate-500 italic text-xs">Sistem bersih, tidak ada tindakan diperlukan</span>
                          ) : null}
                        </div>
                      ) : log.status === 'RUNNING' ? (
                        <span className="text-slate-500 italic text-xs">Sedang memproses...</span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {log.status === 'FAILED' ? (
                        <span className="text-rose-400 font-medium text-xs break-all">{log.message}</span>
                      ) : log.status === 'SUCCESS' ? (
                        <span className="text-slate-400 flex items-center gap-1 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          Selesai dengan bersih
                        </span>
                      ) : (
                        <span className="text-indigo-400 flex items-center gap-1 text-xs">
                          <Info className="w-3.5 h-3.5 animate-pulse" />
                          Sedang berjalan...
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
