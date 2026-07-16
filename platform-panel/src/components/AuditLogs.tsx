import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { ShieldAlert, RefreshCw, FileText, CheckCircle2, Users, Search } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  productId: string;
  licenseKey: string;
  ipAddress: string | null;
  createdAt: string;
  license?: {
    schoolName: string;
    requestedSlug: string | null;
  } | null;
}

const getHumanReadableAction = (action: string) => {
  switch (action) {
    case 'ACTIVATE_SUCCESS':
      return {
        label: 'Aktivasi Berhasil',
        desc: 'Perangkat/server sekolah baru berhasil didaftarkan dan diaktifkan.',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/15'
      };
    case 'ACTIVATE_RESTORED':
      return {
        label: 'Aktivasi Dipulihkan',
        desc: 'Perangkat terdaftar meminta token ulang (lisensi dipulihkan kembali).',
        color: 'text-sky-400 bg-sky-500/10 border-sky-500/15'
      };
    case 'ACTIVATE_FAILED_LIMIT_REACHED':
      return {
        label: 'Aktivasi Gagal (Kuota Habis)',
        desc: 'Batas kuota perangkat untuk lisensi ini sudah penuh.',
        color: 'text-amber-450 bg-amber-500/10 border-amber-500/15'
      };
    case 'ACTIVATE_FAILED_EXPIRED':
      return {
        label: 'Aktivasi Gagal (Kedaluwarsa)',
        desc: 'Kunci lisensi sudah habis masa berlakunya.',
        color: 'text-rose-400 bg-rose-500/10 border-rose-500/15'
      };
    case 'ACTIVATE_FAILED_NOT_FOUND':
      return {
        label: 'Aktivasi Gagal (Tidak Terdaftar)',
        desc: 'Kunci lisensi tidak valid atau tidak terdaftar di database.',
        color: 'text-rose-400 bg-rose-500/10 border-rose-500/15'
      };
    case 'ACTIVATE_FAILED_PRODUCT_MISMATCH':
      return {
        label: 'Aktivasi Gagal (Produk Beda)',
        desc: 'Kunci lisensi ini tidak diperuntukkan bagi produk ini.',
        color: 'text-amber-450 bg-amber-500/10 border-amber-500/15'
      };
    case 'ACTIVATE_MISSING_PRODUCT_ID':
      return {
        label: 'Aktivasi Ditolak (Parameter Salah)',
        desc: 'Request ditolak karena Product ID tidak disertakan.',
        color: 'text-slate-400 bg-slate-500/10 border-slate-500/15'
      };
    case 'VERIFY_ONLINE_SUCCESS':
      return {
        label: 'Verifikasi Online Berhasil',
        desc: 'Klien berhasil memverifikasi status keaktifan lisensi secara berkala.',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/15'
      };
    case 'VERIFY_FAILED_DEVICE_UNAUTHORIZED':
      return {
        label: 'Verifikasi Gagal (Beda Perangkat)',
        desc: 'Verifikasi ditolak karena sidik jari perangkat (HWID) tidak cocok.',
        color: 'text-rose-400 bg-rose-500/10 border-rose-500/15'
      };
    case 'VERIFY_FAILED_EXPIRED':
      return {
        label: 'Verifikasi Gagal (Kedaluwarsa)',
        desc: 'Verifikasi ditolak karena lisensi telah kedaluwarsa.',
        color: 'text-rose-400 bg-rose-500/10 border-rose-500/15'
      };
    case 'VERIFY_FAILED_REVOKED':
      return {
        label: 'Verifikasi Gagal (Lisensi Dicabut)',
        desc: 'Verifikasi ditolak karena lisensi telah dinonaktifkan admin.',
        color: 'text-rose-400 bg-rose-500/10 border-rose-500/15'
      };
    case 'RECEIPT_UPLOAD_SUCCESS':
      return {
        label: 'Unggah Bukti Bayar Berhasil',
        desc: 'Operator sekolah mengunggah berkas bukti pembayaran invoice.',
        color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/15'
      };
    case 'CRON_EXPIRED':
      return {
        label: 'Lisensi Dicabut Otomatis (Cron)',
        desc: 'Lisensi dihentikan otomatis oleh cron job harian karena kedaluwarsa.',
        color: 'text-rose-400 bg-rose-500/10 border-rose-500/15'
      };
    case 'WA_RESEND_LICENSE_SUCCESS':
      return {
        label: 'Kirim Ulang Lisensi (WA)',
        desc: 'Admin mengirim ulang detail lisensi ke WhatsApp operator sekolah.',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/15'
      };
    case 'WA_LOCAL_FREE_ACTIVATION_SENT':
      return {
        label: 'Kirim Lisensi Gratis (WA)',
        desc: 'Lisensi uji coba gratis dikirim otomatis oleh WA Bot.',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/15'
      };
    case 'REQUEST_UNKNOWN_PRODUCT_ID':
      return {
        label: 'Request Ditolak (Produk Asing)',
        desc: 'Request masuk menggunakan kode produk yang tidak terdaftar.',
        color: 'text-amber-450 bg-amber-500/10 border-amber-500/15'
      };
    case 'REQUEST_PLAN_PRODUCT_MISMATCH':
      return {
        label: 'Request Ditolak (Paket Beda)',
        desc: 'Paket langganan yang dipilih tidak cocok dengan produk.',
        color: 'text-amber-450 bg-amber-500/10 border-amber-500/15'
      };
    default:
      return {
        label: action,
        desc: 'Aktivitas sistem yang terekam.',
        color: 'text-slate-300 bg-slate-800 border-slate-700/60'
      };
  }
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  
  // New states for search and advanced filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [eventFilter, setEventFilter] = useState('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsRes, productsRes] = await Promise.all([
        apiClient.get('/api/admin/logs'),
        apiClient.get('/api/admin/products')
      ]);
      setLogs(logsRes.data?.data || logsRes.data || []);
      setProducts(productsRes.data?.data || []);
    } catch (e) {
      console.error('Failed to load audit logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredLogs = logs.filter(log => {
    // 1. Filter by Product
    const normalId = (log.productId === 'platform-absenta' || log.productId === 'absenta')
      ? 'cakola' : log.productId;
    const matchProduct = selectedProductId === 'all' || normalId === selectedProductId;

    // 2. Filter by Event Type
    let matchEvent = true;
    if (eventFilter === 'success') {
      matchEvent = 
        log.action === 'ACTIVATE_SUCCESS' || 
        log.action === 'ACTIVATE_RESTORED' || 
        log.action === 'VERIFY_ONLINE_SUCCESS' || 
        log.action === 'RECEIPT_UPLOAD_SUCCESS' ||
        log.action === 'WA_RESEND_LICENSE_SUCCESS' ||
        log.action === 'WA_LOCAL_FREE_ACTIVATION_SENT';
    } else if (eventFilter === 'failed') {
      matchEvent = 
        log.action.includes('FAILED') || 
        log.action.includes('MISSING') ||
        log.action.includes('UNKNOWN') ||
        log.action.includes('MISMATCH');
    } else if (eventFilter !== 'all') {
      matchEvent = log.action === eventFilter;
    }

    // 3. Filter by Search Query
    const searchLower = searchQuery.toLowerCase();
    const matchSearch = 
      !searchQuery ||
      log.licenseKey.toLowerCase().includes(searchLower) ||
      (log.ipAddress && log.ipAddress.toLowerCase().includes(searchLower)) ||
      (log.license && log.license.schoolName.toLowerCase().includes(searchLower)) ||
      (log.license && log.license.requestedSlug && log.license.requestedSlug.toLowerCase().includes(searchLower)) ||
      log.action.toLowerCase().includes(searchLower);

    return matchProduct && matchEvent && matchSearch;
  });

  // Calculate dynamic analytics from currently filtered logs
  const totalLogs = filteredLogs.length;

  const successCount = filteredLogs.filter(log => 
    log.action === 'ACTIVATE_SUCCESS' || 
    log.action === 'ACTIVATE_RESTORED' || 
    log.action === 'VERIFY_ONLINE_SUCCESS' || 
    log.action === 'RECEIPT_UPLOAD_SUCCESS' ||
    log.action === 'WA_RESEND_LICENSE_SUCCESS' ||
    log.action === 'WA_LOCAL_FREE_ACTIVATION_SENT'
  ).length;

  const failedCount = filteredLogs.filter(log => 
    log.action.includes('FAILED') || 
    log.action.includes('MISSING') ||
    log.action.includes('UNKNOWN') ||
    log.action.includes('MISMATCH')
  ).length;

  const uniqueIps = new Set(filteredLogs.map(log => log.ipAddress).filter(Boolean)).size;

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-white text-2xl font-bold">Log Audit Trail</h2>
          <p className="text-slate-400 text-sm">Rekaman audit aktivitas check-in lisensi, validasi perangkat, dan tindakan administrasi.</p>
        </div>
        <button
          onClick={loadData}
          className="p-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-755 text-slate-300 rounded-xl transition"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ANALYTICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Activity */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Aktivitas</span>
            <div className="text-2xl font-black text-white">{totalLogs}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* Success Activities */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Sukses</span>
            <div className="text-2xl font-black text-emerald-400">{successCount}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Failed Activities */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Gagal / Ditolak</span>
            <div className="text-2xl font-black text-rose-400">{failedCount}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-450">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        {/* Unique IP Addresses */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">IP Unik Klien</span>
            <div className="text-2xl font-black text-sky-400">{uniqueIps} IP</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Cari Sekolah, License Key, atau IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-sm text-slate-200 placeholder-slate-500 transition"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3">
            {/* Event Filter */}
            <div className="w-full sm:w-56">
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-sm text-slate-300 font-medium cursor-pointer transition"
              >
                <option value="all">⚡ Semua Aktivitas</option>
                <option value="success">🟢 Hanya Berhasil/Sukses</option>
                <option value="failed">🔴 Hanya Gagal/Ditolak</option>
                <option value="ACTIVATE_RESTORED">🔄 Pemulihan Sesi (Restored)</option>
                <option value="ACTIVATE_SUCCESS">🆕 Aktivasi Perangkat Baru</option>
                <option value="VERIFY_ONLINE_SUCCESS">📡 Verifikasi Online</option>
                <option value="CRON_EXPIRED">🕒 Dicabut otomatis (Cron)</option>
              </select>
            </div>

            {/* Product Filter */}
            <div className="w-full sm:w-56">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-sm text-indigo-400 font-bold cursor-pointer transition"
              >
                <option value="all">🌐 Semua Produk</option>
                {products.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    📦 {pkg.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-4">Waktu</th>
                <th className="px-6 py-4">Produk</th>
                <th className="px-6 py-4">Sekolah / Instansi</th>
                <th className="px-6 py-4">License Key</th>
                <th className="px-6 py-4">Aktivitas / Event</th>
                <th className="px-6 py-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300 text-sm">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500 font-sans">
                    {loading ? 'Memuat data...' : 'Tidak ada log aktivitas terdaftar.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const actionData = getHumanReadableAction(log.action);
                  return (
                    <tr key={log.id} className="hover:bg-slate-850/50 transition">
                      <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap font-mono">
                        {new Date(log.createdAt).toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-xs text-indigo-400 uppercase font-bold whitespace-nowrap font-mono">
                        {log.productId}
                      </td>
                      <td className="px-6 py-4 text-xs font-sans whitespace-nowrap">
                        {log.license ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-white font-bold">{log.license.schoolName}</span>
                            {log.license.requestedSlug && (
                              <span className="text-[10px] text-indigo-400 font-mono">@{log.license.requestedSlug}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Sistem / Terhapus</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                        {log.licenseKey}
                      </td>
                      <td className="px-6 py-4 font-sans">
                        <div className="flex flex-col gap-1 py-1">
                          <span className={`inline-flex items-center w-fit px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${actionData.color}`}>
                            {actionData.label}
                          </span>
                          <span className="text-[9px] text-slate-600 font-mono mt-0.5">{log.action}</span>
                          <p className="text-slate-400 text-xs mt-0.5 font-normal max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl break-words">
                            {actionData.desc}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                        {log.ipAddress || '-'}
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
