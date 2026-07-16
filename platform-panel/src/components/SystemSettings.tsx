import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { Settings, Save, Power, RefreshCw } from 'lucide-react';

export default function SystemSettings() {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(false);

  // General Settings inputs
  const [mainDomain, setMainDomain] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [waSessionName, setWaSessionName] = useState('');
  const [ownerWaNumber, setOwnerWaNumber] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/admin/settings');
      setSettings(res.data?.data || {});
      setMainDomain(res.data?.data?.mainDomain || '');
      setSupportEmail(res.data?.data?.supportEmail || '');
      setWaSessionName(res.data?.data?.waSessionName || '');
      setOwnerWaNumber(res.data?.data?.OWNER_WA_NUMBER || '');
    } catch (e) {
      console.error('Failed to load settings data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/api/admin/settings', {
        mainDomain,
        supportEmail,
        waSessionName,
        OWNER_WA_NUMBER: ownerWaNumber,
      });
      alert('Pengaturan umum berhasil disimpan.');
      loadData();
    } catch (e) {
      alert('Gagal menyimpan pengaturan umum.');
    }
  };

  const handleForceRestart = async () => {
    if (!confirm('Peringatan: Lakukan force restart pada Server Lisensi sekarang?')) return;
    try {
      await apiClient.post('/api/admin/settings/force-restart');
      alert('Perintah restart telah dikirim.');
    } catch (e) {
      alert('Gagal mengirimkan perintah restart.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto text-left space-y-6">
      {/* General Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-white text-lg font-bold">Pengaturan Umum Server</h3>
            <p className="text-slate-500 text-xs">Atur domain platform dan WhatsApp Session</p>
          </div>
          <button
            onClick={loadData}
            className="p-2 bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-300 rounded-xl transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs font-semibold uppercase mb-1">Domain Utama Platform</label>
            <input
              type="text"
              required
              placeholder="Contoh: cakola.id"
              value={mainDomain}
              onChange={(e) => setMainDomain(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs font-semibold uppercase mb-1">Email Dukungan Bantuan</label>
            <input
              type="email"
              required
              placeholder="Contoh: support@cakola.id"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs font-semibold uppercase mb-1">Nama Sesi WhatsApp Gateway</label>
            <input
              type="text"
              required
              placeholder="Contoh: cakola-whatsapp-session"
              value={waSessionName}
              onChange={(e) => setWaSessionName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs font-semibold uppercase mb-1">Nomor WhatsApp Owner (Notifikasi Order/Lunas)</label>
            <input
              type="text"
              required
              placeholder="Contoh: 6287779937341"
              value={ownerWaNumber}
              onChange={(e) => setOwnerWaNumber(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20 transition w-full"
          >
            <Save className="w-4 h-4" />
            Simpan Pengaturan
          </button>
        </form>

        <div className="pt-6 border-t border-slate-800 space-y-4">
          <h4 className="text-white text-sm font-bold">Tindakan Sistem Darurat</h4>
          <button
            onClick={handleForceRestart}
            className="px-4 py-2.5 bg-rose-600/10 border border-rose-500/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition w-full"
          >
            <Power className="w-4 h-4" />
            Restart Paksa Server Lisensi
          </button>
        </div>
      </div>
    </div>
  );
}
