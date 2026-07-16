import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { Users, History, Plus, Search, RefreshCw, Phone, ShieldCheck, AlertCircle, Coins, CreditCard } from 'lucide-react';

interface StudentCredit {
  id: string;
  phone: string;
  balance: number;
  studentName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TopUpTx {
  id: string;
  phone: string;
  studentName: string;
  amount: number;
  pricePaid: number;
  invoiceNumber: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

export default function PrivateerTransactions() {
  const [activeSubTab, setActiveSubTab] = useState<'credits' | 'history'>('credits');
  const [credits, setCredits] = useState<StudentCredit[]>([]);
  const [transactions, setTransactions] = useState<TopUpTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal Top-up Manual
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualSessions, setManualSessions] = useState(10);
  const [manualPrice, setManualPrice] = useState(30000);
  const [submittingManual, setSubmittingManual] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/admin/privateer/topups');
      if (res.data?.success) {
        setCredits(res.data.data.credits || []);
        setTransactions(res.data.data.transactions || []);
      }
    } catch (e) {
      console.error('Gagal mengambil data Privateer', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleManualTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhone || !manualName || manualSessions <= 0) {
      alert('Mohon isi nomor HP, nama siswa, dan jumlah sesi dengan benar.');
      return;
    }

    setSubmittingManual(true);
    try {
      // Manual top-up endpoint on admin panel
      const res = await apiClient.post('/api/admin/privateer/manual-topup', {
        phone: manualPhone,
        studentName: manualName,
        sessions: Number(manualSessions),
        price: Number(manualPrice)
      });

      if (res.data?.success) {
        alert('Top-up sesi belajar berhasil diproses!');
        setShowManualModal(false);
        setManualPhone('');
        setManualName('');
        setManualSessions(10);
        setManualPrice(30000);
        loadData();
      } else {
        alert(res.data?.message || 'Gagal memproses top-up.');
      }
    } catch (err: any) {
      alert('Gagal memproses top-up manual: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingManual(false);
    }
  };

  const filteredCredits = credits.filter(c => 
    c.phone.includes(searchQuery) || 
    (c.studentName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTransactions = transactions.filter(t => 
    t.phone.includes(searchQuery) || 
    t.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-white text-2xl font-bold flex items-center gap-2">
            <Coins className="w-7 h-7 text-indigo-400" />
            Kelola Kuota Privateer
          </h2>
          <p className="text-slate-400 text-sm">Pemantauan saldo belajar siswa dan riwayat transaksi top-up.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={loadData}
            className="p-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 rounded-xl transition"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowManualModal(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition flex-1 md:flex-none"
          >
            <Plus className="w-5 h-5" />
            Top-up Manual
          </button>
        </div>
      </div>

      {/* SUB-TABS */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveSubTab('credits')}
          className={`px-5 py-3 border-b-2 font-semibold text-sm transition flex items-center gap-2 ${
            activeSubTab === 'credits'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Saldo Belajar Siswa
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-5 py-3 border-b-2 font-semibold text-sm transition flex items-center gap-2 ${
            activeSubTab === 'history'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          Riwayat Transaksi Top-up
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex items-center relative">
        <input
          type="text"
          placeholder={activeSubTab === 'credits' ? "Cari nama siswa atau nomor HP..." : "Cari nomor HP, nama, atau no invoice..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-white placeholder-slate-500 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <Search className="absolute left-7 top-7 w-4 h-4 text-slate-500" />
      </div>

      {/* DATA TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          {activeSubTab === 'credits' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-4">Nama Siswa</th>
                  <th className="px-6 py-4">Nomor WhatsApp</th>
                  <th className="px-6 py-4">Sisa Saldo Sesi</th>
                  <th className="px-6 py-4">Tanggal Daftar</th>
                  <th className="px-6 py-4">Terakhir Diperbarui</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 text-sm">
                {filteredCredits.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                      {loading ? 'Memuat data...' : 'Tidak ada saldo belajar yang ditemukan.'}
                    </td>
                  </tr>
                ) : (
                  filteredCredits.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-850/50 transition border-b border-slate-850">
                      <td className="px-6 py-4 font-semibold text-white">
                        {c.studentName || 'Siswa Tanpa Nama'}
                      </td>
                      <td className="px-6 py-4">
                        <a
                          href={`https://wa.me/${c.phone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{c.phone}</span>
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs ${
                          c.balance > 5 
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                            : c.balance > 0 
                            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                            : 'bg-rose-500/10 border border-rose-500/20 text-rose-450'
                        }`}>
                          {c.balance} Sesi Belajar
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                        {new Date(c.createdAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                        {new Date(c.updatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-4">No. Invoice</th>
                  <th className="px-6 py-4">Nama Siswa</th>
                  <th className="px-6 py-4">Nomor WhatsApp</th>
                  <th className="px-6 py-4 text-center">Jumlah Sesi</th>
                  <th className="px-6 py-4 text-right">Harga Dibayar</th>
                  <th className="px-6 py-4">Tanggal Konfirmasi</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 text-sm">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                      {loading ? 'Memuat data...' : 'Tidak ada riwayat transaksi top-up.'}
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-850/50 transition border-b border-slate-850">
                      <td className="px-6 py-4 font-mono font-bold text-slate-350 select-all">
                        {t.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 font-semibold text-white">
                        {t.studentName}
                      </td>
                      <td className="px-6 py-4">
                        <a
                          href={`https://wa.me/${t.phone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-indigo-450 hover:text-indigo-350 transition"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{t.phone}</span>
                        </a>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-white">
                        +{t.amount}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-semibold text-emerald-450">
                        Rp {t.pricePaid.toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-450 font-mono">
                        {t.paidAt 
                          ? new Date(t.paidAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
                          : '-'
                        }
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          t.status === 'PAID'
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                            : t.status === 'PENDING'
                            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                            : 'bg-slate-800 border border-slate-700 text-slate-450'
                        }`}>
                          {t.status === 'PAID' ? <ShieldCheck className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL MANUAL TOPUP */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <h3 className="text-white text-xl font-bold mb-1 flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-indigo-400" />
              Top-up Sesi Manual
            </h3>
            <p className="text-slate-400 text-xs mb-6">Tambahkan saldo sesi belajar siswa secara langsung (pembayaran tunai).</p>

            <form onSubmit={handleManualTopup} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5">Nomor WhatsApp Siswa / Wali</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 08123456789"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-white placeholder-slate-650 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5">Nama Siswa</label>
                <input
                  type="text"
                  required
                  placeholder="Nama Lengkap Siswa"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-white placeholder-slate-650 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1.5">Jumlah Sesi</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={manualSessions}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setManualSessions(val);
                      setManualPrice(val * 3000); // Estimasi harga Rp 3.000 per sesi
                    }}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1.5">Uang Diterima (Rp)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={manualPrice}
                    onChange={(e) => setManualPrice(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-bold text-sm transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingManual}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/25 transition disabled:opacity-50"
                >
                  {submittingManual ? 'Memproses...' : 'Konfirmasi Top-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
