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

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 15000);
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
    </div>
  );
}
