import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import WhatsAppChatCenter from './WhatsAppChatCenter';
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
  const [showTestForm, setShowTestForm] = useState(false);

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
    const interval = setInterval(() => {
      loadStatus();
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
      setShowTestForm(false);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal mengirimkan pesan test');
    } finally {
      setSending(false);
    }
  };

  const isConnected = status?.state === 'connected' || status?.state === 'READY' || status?.status === 'connected';

  return (
    <div className="space-y-6 text-left">
      
      {/* ── STATUS HEADER BAR & AKSI CEPAT ──────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        <div className="flex items-center gap-4">
          <div className={`p-3.5 rounded-2xl shrink-0 ${isConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white text-base font-bold">WhatsApp Gateway Status</h3>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                isConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {isConnected ? 'TERHUBUNG' : 'DISCONNECTED'}
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">
              {isConnected ? 'Gerbang WhatsApp online & siap mengirim notifikasi.' : 'WhatsApp terputus. Pindai QR Code untuk menghubungkan.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            onClick={() => setShowTestForm(!showTestForm)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
          >
            <Send className="w-3.5 h-3.5 text-indigo-400" />
            {showTestForm ? 'Tutup Tes Kirim' : 'Uji Coba Kirim WA'}
          </button>

          <button
            onClick={handleReconnect}
            disabled={reconnecting}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition shadow-lg shadow-indigo-600/20"
          >
            {reconnecting ? 'Reconnecting...' : 'Reconnect WA'}
          </button>

          <button
            onClick={loadStatus}
            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl transition"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── FORM UJI COBA KIRIM (COLLAPSIBLE) ────────────────────────────────── */}
      {showTestForm && (
        <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
          <h4 className="text-white font-bold text-sm flex items-center gap-2">
            <Send className="w-4 h-4 text-indigo-400" />
            Uji Coba Pengiriman Pesan WhatsApp
          </h4>
          <form onSubmit={handleSendTest} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-400 text-[11px] font-semibold uppercase mb-1">Nomor WhatsApp Tujuan</label>
              <input
                type="text"
                required
                placeholder="Contoh: 628123456789"
                value={targetNumber}
                onChange={(e) => setTargetNumber(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-slate-400 text-[11px] font-semibold uppercase mb-1">Pesan</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !isConnected}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shrink-0 shadow-lg shadow-emerald-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  Kirim
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ── QR CODE SCANNER (IF DISCONNECTED) ───────────────────────────────── */}
      {!isConnected && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4">
          <h3 className="text-white text-base font-bold">Pindai QR Code WhatsApp</h3>
          <p className="text-slate-400 text-xs max-w-md">
            Buka aplikasi WhatsApp di HP Anda &gt; Perangkat Tertaut (Linked Devices) &gt; Pindai QR Code di bawah.
          </p>
          <div className="p-3 bg-white rounded-2xl shadow-inner w-52 h-52 flex items-center justify-center">
            {qrCode ? (
              <img src={qrCode} alt="WhatsApp QR Code" className="w-44 h-44" />
            ) : (
              <div className="text-slate-500 text-xs flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                Memuat QR Code...
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── UTAMA: WHATSAPP CHAT CENTER 2-PANEL (OBROLAN CHATBOT) ───────────── */}
      <div className="space-y-2">
        <h3 className="text-white text-sm font-bold flex items-center gap-2 px-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Riwayat Percakapan Chatbot (WhatsApp Center)
        </h3>
        <WhatsAppChatCenter />
      </div>

    </div>
  );
}
