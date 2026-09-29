import React, { useState } from 'react';
import {
  Sun,
  Moon,
  AlertCircle,
  Loader2,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  Building
} from 'lucide-react';
import portalClient from '../../api/portalClient';

interface MemberLoginProps {
  onNavigateRegister: () => void;
  onNavigateAdmin: () => void;
  onLoginSuccess: (user: any, token: string) => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
}

export default function MemberLogin({
  onNavigateRegister,
  onNavigateAdmin,
  onLoginSuccess,
  theme,
  setTheme
}: MemberLoginProps) {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Email dan kata sandi wajib diisi.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await portalClient.post('/api/portal/auth/login', {
        email: email.trim(),
        password: password.trim()
      });

      if (res.data.success && res.data.token) {
        localStorage.setItem('portal_token', res.data.token);
        localStorage.setItem('portal_user', JSON.stringify(res.data.user));
        onLoginSuccess(res.data.user, res.data.token);
      } else {
        setErrorMsg(res.data.message || 'Login gagal.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Email atau kata sandi tidak valid.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0f172a] text-slate-100' : 'bg-slate-50 text-slate-800'} py-12 px-4 flex flex-col items-center justify-center transition-colors duration-200`}>
      {/* Top right theme toggle */}
      <div className="w-full max-w-md flex justify-end mb-4">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          type="button"
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-sm"
          title="Ganti Tema"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
        </button>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 shadow-xl space-y-7">
        
        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-indigo-600/25 mb-4">
            A
          </div>
          <span className="inline-block px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 rounded-full text-xs font-bold tracking-wider uppercase mb-2">
            Portal Institusi
          </span>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            ABSENTA Ecosystem
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Masuk untuk mengelola kunci lisensi & server CBT sekolah Anda.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3 text-rose-700 dark:text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Email Institusi / Kontak
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user.smkn1pld@gmail.com"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:border-slate-900 dark:focus:border-indigo-500 focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Kata Sandi
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:border-slate-900 dark:focus:border-indigo-500 focus:outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-[#111827] dark:bg-indigo-600 hover:bg-[#1f2937] dark:hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg transition duration-150 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memverifikasi Akun...</span>
              </>
            ) : (
              <>
                <span>Masuk ke Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Belum memiliki akun institusi?{' '}
            <button
              onClick={onNavigateRegister}
              type="button"
              className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Daftar Akun Baru
            </button>
          </p>

          <p className="text-[11px] text-slate-400">
            Administrator Pusat?{' '}
            <button
              onClick={onNavigateAdmin}
              type="button"
              className="font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
            >
              Masuk Console Admin
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}
