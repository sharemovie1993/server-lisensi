import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import {
  ShieldCheck,
  Plus,
  RefreshCw,
  Search,
  Copy,
  Check,
  Trash2,
  Edit2,
  Lock,
  Wifi,
  WifiOff,
  Terminal,
  X,
  Key,
  Server,
  Info
} from 'lucide-react';

interface SstpAccount {
  id: string;
  username: string;
  password: string;
  ipAddress: string;
  comment?: string | null;
  isActive: boolean;
  isOnline?: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SstpVpnManager() {
  const [accounts, setAccounts] = useState<SstpAccount[]>([]);
  const [suggestedIp, setSuggestedIp] = useState<string>('10.0.1.10');
  const [loading, setLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState<boolean>(false);
  const [selectedAccount, setSelectedAccount] = useState<SstpAccount | null>(null);

  // Form states for Add / Edit
  const [formUsername, setFormUsername] = useState<string>('');
  const [formPassword, setFormPassword] = useState<string>('');
  const [formIpAddress, setFormIpAddress] = useState<string>('');
  const [formComment, setFormComment] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Script Modal state
  const [scriptText, setScriptText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/admin/sstp/accounts');
      if (res.data?.success) {
        setAccounts(res.data.data || []);
        if (res.data.suggestedNextIp) {
          setSuggestedIp(res.data.suggestedNextIp);
        }
      }
    } catch (err: any) {
      console.error('Failed to load SSTP accounts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789#@!';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormPassword(pass);
  };

  const handleOpenAddModal = () => {
    setFormUsername('');
    generateRandomPassword();
    setFormIpAddress(suggestedIp);
    setFormComment('');
    setFormIsActive(true);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim() || !formPassword.trim()) {
      setFormError('Username dan Password tidak boleh kosong!');
      return;
    }

    setFormError(null);
    try {
      const res = await apiClient.post('/api/admin/sstp/accounts', {
        username: formUsername,
        password: formPassword,
        ipAddress: formIpAddress,
        comment: formComment
      });

      if (res.data?.success) {
        setIsAddModalOpen(false);
        loadData();
      } else {
        setFormError(res.data?.message || 'Gagal membuat akun SSTP.');
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Gagal terhubung ke API SSTP.');
    }
  };

  const handleOpenEditModal = (acc: SstpAccount) => {
    setSelectedAccount(acc);
    setFormPassword(''); // Empty password means unchanged
    setFormComment(acc.comment || '');
    setFormIsActive(acc.isActive);
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;

    setFormError(null);
    try {
      const res = await apiClient.put(`/api/admin/sstp/accounts/${selectedAccount.id}`, {
        password: formPassword || undefined,
        comment: formComment,
        isActive: formIsActive
      });

      if (res.data?.success) {
        setIsEditModalOpen(false);
        loadData();
      } else {
        setFormError(res.data?.message || 'Gagal memperbarui akun SSTP.');
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Gagal memperbarui akun SSTP.');
    }
  };

  const handleDeleteAccount = async (acc: SstpAccount) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus akun SSTP '${acc.username}'?`)) return;

    try {
      const res = await apiClient.delete(`/api/admin/sstp/accounts/${acc.id}`);
      if (res.data?.success) {
        loadData();
      } else {
        alert(res.data?.message || 'Gagal menghapus akun.');
      }
    } catch (err: any) {
      alert('Gagal menghapus akun SSTP.');
    }
  };

  const handleOpenScriptModal = async (acc: SstpAccount) => {
    setSelectedAccount(acc);
    setCopied(false);
    try {
      const res = await apiClient.get(`/api/admin/sstp/accounts/${acc.id}/script`);
      if (res.data?.success && res.data.data?.script) {
        setScriptText(res.data.data.script);
      } else {
        setScriptText(`# Gagal mengambil skrip.`);
      }
    } catch (err) {
      setScriptText(`# Gagal terhubung ke API.`);
    }
    setIsScriptModalOpen(true);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const filteredAccounts = accounts.filter(acc => {
    const q = search.toLowerCase();
    return (
      acc.username.toLowerCase().includes(q) ||
      acc.ipAddress.toLowerCase().includes(q) ||
      (acc.comment && acc.comment.toLowerCase().includes(q))
    );
  });

  const onlineCount = accounts.filter(a => a.isOnline).length;

  return (
    <div className="space-y-6 text-left">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-white text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-indigo-400" />
            SSTP VPN Manager (MikroTik RouterOS v6)
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Pengelolaan terowongan SSL VPN SSTP internal untuk perangkat MikroTik RouterOS v6 tanpa WireGuard.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 rounded-xl transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            Tambah Akun SSTP
          </button>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Akun SSTP</p>
            <h3 className="text-white text-2xl font-extrabold mt-0.5">{accounts.length}</h3>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Wifi className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Sesi Active / Online</p>
            <h3 className="text-emerald-400 text-2xl font-extrabold mt-0.5">{onlineCount}</h3>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Server Endpoint</p>
            <h3 className="text-amber-300 text-lg font-mono font-bold mt-0.5">absenta.id:4443</h3>
          </div>
        </div>
      </div>

      {/* SEARCH BAR & TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Cari username, IP, atau nama sekolah..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Menampilkan {filteredAccounts.length} dari {accounts.length} akun
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs font-semibold uppercase">
                <th className="px-5 py-3.5">Username SSTP</th>
                <th className="px-5 py-3.5">Alokasi IP Address</th>
                <th className="px-5 py-3.5">Keterangan / Sekolah</th>
                <th className="px-5 py-3.5">Koneksi Live</th>
                <th className="px-5 py-3.5">Status Akun</th>
                <th className="px-5 py-3.5 text-right">Aksi & Skrip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Belum ada akun SSTP yang dibuat. Klik <strong>"Tambah Akun SSTP"</strong> untuk membuat akun baru.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map(acc => (
                  <tr key={acc.id} className="hover:bg-slate-850/40 transition">
                    <td className="px-5 py-4 font-bold text-white font-mono flex items-center gap-2">
                      <Key className="w-4 h-4 text-indigo-400" />
                      <span>{acc.username}</span>
                    </td>
                    <td className="px-5 py-4 font-mono text-emerald-400 font-semibold">
                      {acc.ipAddress}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {acc.comment || <span className="text-slate-600 font-italic">- Tidak ada -</span>}
                    </td>
                    <td className="px-5 py-4">
                      {acc.isOnline ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Wifi className="w-3.5 h-3.5" />
                          ONLINE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800/40 text-slate-500 border border-slate-800">
                          <WifiOff className="w-3.5 h-3.5" />
                          OFFLINE
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {acc.isActive ? (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          AKTIF
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          NONAKTIF
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenScriptModal(acc)}
                        className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition"
                        title="Dapatkan Skrip MikroTik v6"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        Skrip MikroTik
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(acc)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                        title="Edit Password / Komentar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteAccount(acc)}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition"
                        title="Hapus Akun SSTP"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL TAMBAH AKUN */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <h3 className="text-white text-lg font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                Buat Akun SSTP MikroTik Baru
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold">
                  ⚠️ {formError}
                </div>
              )}

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1.5">Username SSTP</label>
                <input
                  type="text"
                  required
                  placeholder="misal: smk6jkt-sstp"
                  value={formUsername}
                  onChange={e => setFormUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-slate-300 text-xs font-semibold">Password SSTP</label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    🎲 Generate Acak
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Password SSTP"
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1.5">IP Address Internal VPN</label>
                <input
                  type="text"
                  required
                  placeholder="10.0.1.X"
                  value={formIpAddress}
                  onChange={e => setFormIpAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-mono text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1.5">Keterangan / Instansi (Opsional)</label>
                <input
                  type="text"
                  placeholder="misal: SMKN 6 Jakarta - MikroTik Core Router"
                  value={formComment}
                  onChange={e => setFormComment(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-bold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition"
                >
                  Simpan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT AKUN */}
      {isEditModalOpen && selectedAccount && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <h3 className="text-white text-lg font-bold flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-400" />
                Edit Akun SSTP: {selectedAccount.username}
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAccount} className="space-y-4">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold">
                  ⚠️ {formError}
                </div>
              )}

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1.5">Password Baru (Biarkan kosong jika tidak diubah)</label>
                <input
                  type="text"
                  placeholder="Kosongkan jika tidak ubah password"
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1.5">Keterangan / Instansi</label>
                <input
                  type="text"
                  placeholder="Keterangan"
                  value={formComment}
                  onChange={e => setFormComment(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkIsActive"
                  checked={formIsActive}
                  onChange={e => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 rounded accent-indigo-600"
                />
                <label htmlFor="chkIsActive" className="text-white text-sm font-semibold cursor-pointer">
                  Akun VPN Aktif
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-bold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition"
                >
                  Perbarui Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SKRIP MIKROTIK v6 */}
      {isScriptModalOpen && selectedAccount && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-5">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-white text-lg font-bold flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-indigo-400" />
                  Skrip MikroTik RouterOS v6 CLI
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">Akun: <strong className="text-white">{selectedAccount.username}</strong> ({selectedAccount.comment || 'Client MikroTik'})</p>
              </div>
              <button
                onClick={() => setIsScriptModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-300 text-xs flex items-center gap-2">
              <Info className="w-4 h-4 flex-shrink-0 text-indigo-400" />
              <span>
                Salin skrip di bawah lalu tempel (*paste*) langsung ke menu <strong>Terminal</strong> pada aplikasi Winbox atau SSH MikroTik RouterOS v6.
              </span>
            </div>

            <div className="relative">
              <pre className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-emerald-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {scriptText}
              </pre>

              <button
                onClick={handleCopyScript}
                className={`absolute top-3 right-3 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
                  copied
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Tersalin!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Salin Skrip MikroTik
                  </>
                )}
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsScriptModalOpen(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-bold transition"
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
