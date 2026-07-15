import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { Smartphone, RefreshCw, Send, CheckCircle, XCircle } from 'lucide-react';

export default function WhatsAppGateway() {
  const [status, setStatus] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  
  // Test message form
  const [targetNumber, setTargetNumber] = useState('');
  const [testMessage, setTestMessage] = useState('Halo, ini adalah pesan uji coba dari sistem WhatsApp Gateway Cakola HQ.');
  const [sending, setSending] = useState(false);

  // WhatsApp logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [resendingLogId, setResendingLogId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState('ALL');

  const filteredLogs = logs.filter(log => {
    if (selectedProduct === 'ALL') return true;
    if (selectedProduct === 'SYSTEM') return !log.productId || log.productId === 'SYSTEM';
    return log.productId?.toLowerCase() === selectedProduct.toLowerCase();
  });

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/admin/wa/status');
      if (res.data?.success) {
        const waData = res.data.data;
        setStatus(waData);
        
        const isWaConnected = waData?.status === 'connected' || waData?.state === 'connected';
        if (!isWaConnected && waData?.has_qr) {
          loadQR();
        } else {
          setQrCode(null);
        }
      }
    } catch (e) {
      console.error('Failed to load WA status', e);
    } finally {
      setLoading(false);
    }
  };

  const loadQR = async () => {
    try {
      const res = await apiClient.get('/api/admin/wa/qr');
      if (res.data?.success && res.data.qr) {
        setQrCode(res.data.qr);
      }
    } catch (e) {
      console.error('Failed to load QR code', e);
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await apiClient.get('/api/admin/whatsapp/logs');
      if (res.data?.success) {
        setLogs(res.data.data || []);
      }
    } catch (e) {
      console.error('Failed to load WA outbox logs', e);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleResendLog = async (id: string) => {
    if (!confirm('Kirim ulang pesan WhatsApp ini ke pelanggan?')) return;
    setResendingLogId(id);
    try {
      const res = await apiClient.post(`/api/admin/whatsapp/resend/${id}`);
      if (res.data?.success) {
        alert('Pesan berhasil dikirim ulang!');
        loadLogs();
      }
    } catch (e: any) {
      alert('Gagal mengirim ulang pesan: ' + (e.response?.data?.message || e.message));
    } finally {
      setResendingLogId(null);
    }
  };

  useEffect(() => {
    loadStatus();
    loadLogs();
    const interval = setInterval(() => {
      loadStatus();
      loadLogs();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      const res = await apiClient.post('/api/admin/wa/reconnect');
      alert(res.data?.message || 'Menghubungkan kembali...');
      loadStatus();
    } catch (e) {
      alert('Gagal menghubungkan kembali');
    } finally {
      setReconnecting(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetNumber.trim()) return;

    setSending(true);
    try {
      const res = await apiClient.post('/api/admin/wa/send-test', {
        number: targetNumber,
        message: testMessage,
      });
      alert(res.data?.message || 'Pesan terkirim!');
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal mengirimkan pesan test');
    } finally {
      setSending(false);
    }
  };

  const isConnected = status?.state === 'connected' || status?.state === 'READY' || status?.status === 'connected';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Status Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 text-left">
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-white text-lg font-bold">WhatsApp Connection Status</h3>
            <p className="text-slate-500 text-xs">Kelola gerbang pengiriman notifikasi WhatsApp</p>
          </div>
          <button
            onClick={loadStatus}
            className="p-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-300 rounded-xl transition"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-2xl ${isConnected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
            <Smartphone className="w-8 h-8" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Status Koneksi</p>
            <h4 className="text-white text-xl font-bold mt-0.5">
              {isConnected ? 'TERHUBUNG' : 'TIDAK TERHUBUNG'}
            </h4>
            <span className="text-slate-500 text-xs block mt-1">
              State: {status?.state || status?.status || 'unknown'}
            </span>
          </div>
        </div>

        {isConnected ? (
          <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/10 text-green-400 text-sm flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Notifikasi WhatsApp siap digunakan dan dalam keadaan online.
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 text-red-400 text-sm flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            Gerbang WhatsApp terputus. Silakan hubungkan kembali atau pindai QR Code.
          </div>
        )}

        <div className="pt-4 border-t border-slate-800 flex gap-4">
          <button
            onClick={handleReconnect}
            disabled={reconnecting}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition"
          >
            Hubungkan Ulang / Reconnect
          </button>
        </div>
      </div>

      {/* QR Code and Send Test Message Panel */}
      <div className="space-y-6">
        {/* QR Code Scanner (only if not connected) */}
        {!isConnected && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4">
            <h3 className="text-white text-lg font-bold">Pindai QR Code WhatsApp</h3>
            <p className="text-slate-400 text-sm max-w-sm">
              Gunakan perangkat telepon Anda untuk memindai QR Code di bawah melalui fitur Linked Devices pada WhatsApp.
            </p>
            <div className="p-4 bg-white rounded-2xl shadow-inner w-56 h-56 flex items-center justify-center">
              {qrCode ? (
                <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
              ) : (
                <div className="text-slate-400 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                  Membuat QR Code baru...
                </div>
              )}
            </div>
            <span className="text-slate-500 text-xs">Pindai kode untuk mengaktifkan notifikasi sekolah.</span>
          </div>
        )}

        {/* Dispatcher Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-left space-y-4">
          <h3 className="text-white text-lg font-bold">Uji Coba Pengiriman Pesan</h3>
          <form onSubmit={handleSendTest} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-xs font-semibold uppercase mb-1">Nomor WhatsApp Tujuan</label>
              <input
                type="text"
                required
                placeholder="Contoh: 628123456789"
                value={targetNumber}
                onChange={(e) => setTargetNumber(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs font-semibold uppercase mb-1">Pesan</label>
              <textarea
                required
                rows={3}
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={sending || !isConnected}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition w-full shadow-lg shadow-emerald-600/20"
            >
              <Send className="w-4 h-4" />
              Kirim Uji Coba
            </button>
          </form>
        </div>
      </div>

      {/* Outbox Monitoring Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-left lg:col-span-2 mt-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-800 gap-4">
          <div>
            <h3 className="text-white text-lg font-bold">WhatsApp Outbox Logs</h3>
            <p className="text-slate-500 text-xs">Pantau status pengiriman pesan, log aktivitas, dan lakukan kirim ulang pesan yang gagal</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-350 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 transition w-full sm:w-auto"
            >
              <option value="ALL">Semua Produk</option>
              <option value="cakola">Cakola</option>
              <option value="easy-tunnel">Easy Tunnel</option>
              <option value="privateer">Privateer</option>
              <option value="SYSTEM">System/Lainnya</option>
            </select>
            <button
              onClick={loadLogs}
              className="p-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-300 rounded-xl transition"
            >
              <RefreshCw className={`w-5 h-5 ${logsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-4 w-40">Tanggal & Waktu</th>
                <th className="px-6 py-4 w-32">Penerima</th>
                <th className="px-6 py-4 w-28">Produk</th>
                <th className="px-6 py-4">Isi Pesan</th>
                <th className="px-6 py-4 w-28">Trigger</th>
                <th className="px-6 py-4 w-28 text-center">Status</th>
                <th className="px-6 py-4 w-24 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-350 text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    {logsLoading ? 'Memuat data log...' : 'Belum ada data log pengiriman WhatsApp.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-850/40 transition">
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-6 py-4 font-semibold text-white whitespace-nowrap">
                      {log.recipient}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono border uppercase tracking-wider ${
                        log.productId === 'cakola' 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450' 
                          : log.productId === 'easy-tunnel' 
                          ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-450' 
                          : log.productId === 'privateer' 
                          ? 'bg-purple-500/10 border-purple-500/20 text-purple-450' 
                          : 'bg-slate-850 border-slate-750 text-slate-450'
                      }`}>
                        {log.productId || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-xs sm:max-w-md break-words select-all" title={log.message}>
                      <div className="bg-slate-950/40 border border-slate-850/50 p-2 rounded-lg font-mono text-[11px] leading-relaxed max-h-24 overflow-y-auto whitespace-pre-wrap">
                        {log.message}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-indigo-300">
                        {log.triggerType || 'SYSTEM'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      {log.status === 'SENT' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
                          Terkirim
                        </span>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-450 uppercase tracking-wide" title={log.errorMessage || 'Unknown Error'}>
                            Gagal
                          </span>
                          {log.errorMessage && (
                            <span className="text-[9px] text-rose-450 font-mono block max-w-[120px] truncate" title={log.errorMessage}>
                              {log.errorMessage}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleResendLog(log.id)}
                        disabled={resendingLogId === log.id}
                        className={`p-1.5 rounded-lg border transition ${
                          log.status === 'SENT'
                            ? 'bg-slate-800 border-slate-700 hover:bg-slate-750 text-slate-400'
                            : 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-600 text-emerald-450 hover:text-white'
                        }`}
                        title="Kirim ulang pesan ini"
                      >
                        <Send className={`w-3.5 h-3.5 ${resendingLogId === log.id ? 'animate-pulse' : ''}`} />
                      </button>
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
