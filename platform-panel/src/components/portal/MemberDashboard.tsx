import React, { useState, useEffect } from 'react';
import {
  Sun,
  Moon,
  LogOut,
  KeyRound,
  Heart,
  Receipt,
  Server,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Building,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import portalClient from '../../api/portalClient';

interface MemberDashboardProps {
  onLogout: () => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
}

interface CapacityStats {
  used_slots: number;
  total_slots: number;
  available_slots: number;
}

interface LicenseItem {
  id: string;
  license_key: string;
  school_name: string;
  requested_slug: string | null;
  domain: string | null;
  deploy_mode: string;
  node_type: string;
  status: string;
  is_active: boolean;
  is_permanent: boolean;
  expires_at: string;
  created_at: string;
  last_heartbeat_at: string | null;
  wireguard_ip: string | null;
}

export default function MemberDashboard({
  onLogout,
  theme,
  setTheme
}: MemberDashboardProps) {
  const [userProfile, setUserProfile] = useState<any>(() => {
    try {
      const stored = localStorage.getItem('portal_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [capacity, setCapacity] = useState<CapacityStats>({
    used_slots: 0,
    total_slots: 4,
    available_slots: 4
  });

  const [licenses, setLicenses] = useState<LicenseItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreatingKey, setIsCreatingKey] = useState<boolean>(false);
  const [selectedDuration, setSelectedDuration] = useState<'1_week' | '1_month' | '3_months'>('1_month');
  const [customNodeName, setCustomNodeName] = useState<string>('');
  
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [activeNav, setActiveNav] = useState<'lisensi' | 'donasi' | 'transaksi' | 'mesin'>('lisensi');

  const fetchLicenses = async () => {
    try {
      const res = await portalClient.get('/api/portal/licenses');
      if (res.data.success) {
        setLicenses(res.data.licenses || []);
        if (res.data.capacity) {
          setCapacity(res.data.capacity);
        }
      }
    } catch (err: any) {
      console.error('[Fetch Licenses Error]', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await portalClient.get('/api/portal/auth/me');
      if (res.data.success && res.data.user) {
        setUserProfile(res.data.user);
        if (res.data.user.capacity) {
          setCapacity(res.data.user.capacity);
        }
        localStorage.setItem('portal_user', JSON.stringify(res.data.user));
      }
    } catch (err: any) {
      console.error('[Fetch Profile Error]', err);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchLicenses();
  }, []);

  const handleCreateLicense = async () => {
    if (capacity.available_slots <= 0) {
      setFeedbackMsg({
        type: 'error',
        text: `Kapasitas kuota lisensi Anda telah penuh (${capacity.used_slots}/${capacity.total_slots} slot terpakai).`
      });
      return;
    }

    setIsCreatingKey(true);
    setFeedbackMsg(null);

    try {
      const res = await portalClient.post('/api/portal/licenses/create', {
        duration: selectedDuration,
        school_name: customNodeName.trim() || undefined
      });

      if (res.data.success) {
        setFeedbackMsg({
          type: 'success',
          text: `Kunci lisensi ${res.data.license.license_key} berhasil diterbitkan!`
        });
        setCustomNodeName('');
        await fetchLicenses();
        await fetchProfile();
      } else {
        setFeedbackMsg({
          type: 'error',
          text: res.data.message || 'Gagal membuat kunci lisensi.'
        });
      }
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.message || 'Terjadi kesalahan sistem saat membuat lisensi.'
      });
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const userEmail = userProfile?.email || 'member@absenta.id';
  const displayEmail = userEmail.length > 22 ? userEmail.slice(0, 20) + '...' : userEmail;

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0b1324] text-slate-100' : 'bg-slate-50 text-slate-800'} transition-colors duration-200 pb-16`}>
      {/* 1. TOP NAVBAR */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          
          {/* Left Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-indigo-600/30">
              A
            </div>
            <div>
              <div className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase leading-none">
                ABSENTA
              </div>
              <div className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                Ecosystem
              </div>
            </div>
          </div>

          {/* Center Navigation Tabs (Clone of screenshot nav pills) */}
          <nav className="hidden md:flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950/60 rounded-full border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveNav('lisensi')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition ${
                activeNav === 'lisensi'
                  ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Lisensi</span>
            </button>

            <button
              onClick={() => setActiveNav('donasi')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition ${
                activeNav === 'donasi'
                  ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span>Donasi</span>
            </button>

            <button
              onClick={() => setActiveNav('transaksi')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition ${
                activeNav === 'transaksi'
                  ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Transaksi</span>
            </button>

            <button
              onClick={() => setActiveNav('mesin')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition ${
                activeNav === 'mesin'
                  ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>Kelola Mesin</span>
            </button>
          </nav>

          {/* Right Action Icons & Profile */}
          <div className="flex items-center gap-2.5">
            {/* User Profile Badge */}
            <div className="flex items-center gap-2.5 pl-2 pr-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700">
              <div className="w-6 h-6 rounded-full bg-slate-900 dark:bg-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase">
                {userEmail.charAt(0)}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-none truncate max-w-[130px]">
                  {displayEmail}
                </p>
                <p className="text-[10px] text-slate-400 leading-none mt-0.5 font-medium">
                  {userProfile?.role || 'Member'}
                </p>
              </div>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-sm"
              title="Ganti Tema"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            </button>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:text-rose-500 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-900/50 transition text-xs font-bold shadow-sm"
              title="Keluar Akun"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>

        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        
        {/* Feedback Alert if any */}
        {feedbackMsg && (
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-xs font-bold hover:underline opacity-80"
            >
              Tutup
            </button>
          </div>
        )}

        {/* 2. TOP BANNER / HEADER CARD (Faithful clone of Screenshot 1) */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            
            {/* Left Header Description */}
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold tracking-wider uppercase">
                  ETALASE OTORISASI
                </span>
                <span className="px-3 py-1 bg-blue-50 dark:bg-indigo-950/50 text-blue-600 dark:text-indigo-400 border border-blue-200/50 dark:border-indigo-800/40 rounded-full text-xs font-bold">
                  {capacity.used_slots} / {capacity.total_slots} Lisensi Digunakan
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Manajemen Lisensi Mesin CBT
              </h1>

              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Otorisasi resmi untuk mengaktifkan server ujian Extraordinary CBT. Setiap kunci lisensi terkunci permanen pada 1 mesin server hingga masa aktif berakhir.
              </p>
            </div>

            {/* Right Card: Kapasitas Lisensi Widget */}
            <div className="w-full lg:w-72 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-300">Kapasitas Lisensi</span>
                <span className="text-slate-900 dark:text-white font-extrabold">{capacity.used_slots}/{capacity.total_slots}</span>
              </div>

              {/* 4 Segment Progress Bars */}
              <div className="grid grid-cols-4 gap-1.5 h-2.5">
                {[0, 1, 2, 3].map((slotIdx) => {
                  const isFilled = slotIdx < capacity.used_slots;
                  return (
                    <div
                      key={slotIdx}
                      className={`h-full rounded-full transition-all ${
                        isFilled
                          ? 'bg-indigo-600 dark:bg-indigo-500 shadow-sm'
                          : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                    />
                  );
                })}
              </div>

              <p className="text-right text-[11px] font-semibold text-slate-400">
                {capacity.available_slots} slot tersedia
              </p>
            </div>

          </div>
        </section>

        {/* 3. TWO-COLUMN INTERACTIVE ROW (Faithful clone of Screenshot 1) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: Buat Kunci Lisensi Baru (lg:col-span-7) */}
          <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
            
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-xs font-bold tracking-wider uppercase">
                PEMBUATAN KUNCI
              </span>
              <span className="px-3 py-1 bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-200/50 dark:border-sky-800/40 rounded-full text-xs font-bold">
                {capacity.available_slots} slot tersisa
              </span>
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Buat Kunci Lisensi Baru
              </h2>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-3">
                Pilih Durasi Lisensi
              </p>
            </div>

            {/* 3 Duration Selection Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option 1: 1 Minggu */}
              <button
                type="button"
                onClick={() => setSelectedDuration('1_week')}
                className={`text-left p-4 rounded-2xl border transition-all ${
                  selectedDuration === '1_week'
                    ? 'border-slate-900 dark:border-indigo-500 bg-slate-50 dark:bg-slate-800/90 ring-1 ring-slate-900 dark:ring-indigo-500 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                    1 Minggu
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                    Try Out / Uji Coba
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Simulasi singkat. Slot cepat terbuka kembali pasca-ujian.
                </p>
              </button>

              {/* Option 2: 1 Bulan */}
              <button
                type="button"
                onClick={() => setSelectedDuration('1_month')}
                className={`text-left p-4 rounded-2xl border transition-all ${
                  selectedDuration === '1_month'
                    ? 'border-slate-900 dark:border-indigo-500 bg-slate-50 dark:bg-slate-800/90 ring-1 ring-slate-900 dark:ring-indigo-500 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                    1 Bulan
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                    Ujian Standar
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Periode PTS / PAS. Kunci terkunci pada mesin selama 30 hari.
                </p>
              </button>

              {/* Option 3: 3 Bulan */}
              <button
                type="button"
                onClick={() => setSelectedDuration('3_months')}
                className={`text-left p-4 rounded-2xl border transition-all ${
                  selectedDuration === '3_months'
                    ? 'border-slate-900 dark:border-indigo-500 bg-slate-50 dark:bg-slate-800/90 ring-1 ring-slate-900 dark:ring-indigo-500 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                    3 Bulan
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                    Satu Semester Penuh
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Server utama sekolah. Terkunci pada mesin selama 1 semester.
                </p>
              </button>
            </div>

            {/* Optional Custom Server Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Nama Server / Label Opsional (misal: Server Lab 1, CBT Utama)
              </label>
              <input
                type="text"
                value={customNodeName}
                onChange={(e) => setCustomNodeName(e.target.value)}
                placeholder={`Default: ${userProfile?.school_name || userProfile?.name || 'Server Utama'}`}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Warning Callout Box (yellow/amber) */}
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Aturan Penguncian Mesin:</span> Sekali kunci lisensi dimasukkan ke server CBT, kunci terkunci permanen pada mesin tersebut. Slot baru akan terbuka otomatis oleh sistem setelah masa aktif kunci kedaluwarsa.
              </div>
            </div>

            {/* Full-width Action Button */}
            <button
              onClick={handleCreateLicense}
              disabled={isCreatingKey || capacity.available_slots <= 0}
              className="w-full py-4 bg-[#111827] dark:bg-indigo-600 hover:bg-[#1f2937] dark:hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreatingKey ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menerbitkan Kunci Lisensi...</span>
                </>
              ) : (
                'Buat Kunci Lisensi Sekarang'
              )}
            </button>

          </section>

          {/* RIGHT COLUMN: Ketentuan Lisensi CBT (lg:col-span-5) */}
          <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6 flex flex-col justify-between">
            
            <div className="space-y-4">
              <div>
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-xs font-bold tracking-wider uppercase">
                  ATURAN SISTEM
                </span>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-3">
                  Ketentuan Lisensi CBT
                </h2>
              </div>

              {/* Bullet Points with Blue Dots */}
              <div className="space-y-4 pt-1">
                
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-indigo-400 mt-1.5 flex-shrink-0" />
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    <span className="font-bold text-slate-900 dark:text-white">1 Kunci = 1 Dedicated Server:</span> Sekali kunci dipasang ke suatu mesin server CBT, kunci terkunci permanen pada mesin tersebut dan tidak dapat dipindahkan ke server lain.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-indigo-400 mt-1.5 flex-shrink-0" />
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    <span className="font-bold text-slate-900 dark:text-white">Server Lain Wajib Kunci Baru:</span> Jika sekolah memerlukan mesin ujian tambahan (lab 2 atau server cadangan), silakan buat kunci lisensi baru.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-indigo-400 mt-1.5 flex-shrink-0" />
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    <span className="font-bold text-slate-900 dark:text-white">Pelepasan Slot Otomatis:</span> Slot lisensi yang terpakai akan otomatis terbuka kembali oleh sistem setelah masa aktif kunci kedaluwarsa.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-indigo-400 mt-1.5 flex-shrink-0" />
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    <span className="font-bold text-slate-900 dark:text-white">Maksimal 4 Kunci Aktif:</span> Setiap akun sekolah dibatasi kuota maksimal 4 kunci aktif secara bersamaan.
                  </p>
                </div>

              </div>
            </div>

            {/* School Info Footer in Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 mt-4">
              <div className="flex items-center gap-2.5">
                <Building className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {userProfile?.school_name || userProfile?.name || 'Institusi Terdaftar'}
                </span>
              </div>
              {userProfile?.npsn && (
                <p className="text-[11px] text-slate-400 mt-1 pl-6.5">
                  NPSN: <span className="font-mono text-slate-700 dark:text-slate-300">{userProfile.npsn}</span>
                </p>
              )}
            </div>

          </section>

        </div>

        {/* 4. BOTTOM SECTION: Kunci Lisensi Terdaftar */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Kunci Lisensi Terdaftar
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kunci lisensi aktif untuk disalin dan dimasukkan pada form setup server CBT / Absenta.
              </p>
            </div>

            <button
              onClick={fetchLicenses}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Muat Ulang</span>
            </button>
          </div>

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-xs">Memuat daftar lisensi...</span>
            </div>
          ) : licenses.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <KeyRound className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Belum ada kunci lisensi</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Pilih durasi dan klik tombol "Buat Kunci Lisensi Sekarang" di atas untuk menerbitkan kunci perdana Anda.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {licenses.map((lic) => {
                const isCopied = copiedKey === lic.license_key;
                return (
                  <div
                    key={lic.id}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700 transition space-y-4"
                  >
                    {/* Header License Card */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          lic.is_active
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300/40 dark:border-emerald-800/40'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {lic.is_active ? '● Aktif' : '○ Kedaluwarsa'}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                          {lic.school_name || 'Server CBT Sekolah'}
                        </h4>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-semibold text-slate-400 block">
                          Kedaluwarsa:
                        </span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {lic.is_permanent ? 'Permanen' : lic.expires_at}
                        </span>
                      </div>
                    </div>

                    {/* License Key Box with Copy Button */}
                    <div className="flex items-center justify-between gap-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="font-mono font-black text-sm sm:text-base text-slate-900 dark:text-indigo-300 tracking-wider">
                        {lic.license_key}
                      </span>
                      <button
                        onClick={() => handleCopy(lic.license_key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          isCopied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                        title="Salin Kunci Lisensi"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCopied ? 'Tersalin' : 'Salin'}</span>
                      </button>
                    </div>

                    {/* Footer Meta */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-850">
                      <span>Node: {lic.node_type}</span>
                      <span>Dibuat: {lic.created_at}</span>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </section>

      </main>
    </div>
  );
}
