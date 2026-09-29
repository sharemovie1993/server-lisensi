import React, { useState } from 'react';
import {
  ArrowLeft,
  Sun,
  Moon,
  Info,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  GraduationCap
} from 'lucide-react';
import portalClient from '../../api/portalClient';

interface MemberRegisterProps {
  onNavigateLogin: () => void;
  onRegisterSuccess: (user: any, token: string) => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
}

export default function MemberRegister({
  onNavigateLogin,
  onRegisterSuccess,
  theme,
  setTheme
}: MemberRegisterProps) {
  const [hasNpsn, setHasNpsn] = useState<boolean>(true);
  const [npsn, setNpsn] = useState<string>('');
  const [schoolName, setSchoolName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [agreement, setAgreement] = useState<boolean>(true);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [otpSentMsg, setOtpSentMsg] = useState<string | null>(null);
  const [otpCooldown, setOtpCooldown] = useState<number>(0);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSendOtp = async () => {
    if (!email.trim() && !phone.trim()) {
      setErrorMsg('Masukkan email atau nomor WhatsApp terlebih dahulu untuk menerima kode OTP.');
      return;
    }

    setIsSendingOtp(true);
    setErrorMsg(null);
    setOtpSentMsg(null);

    try {
      const res = await portalClient.post('/api/portal/auth/send-otp', {
        email: email.trim(),
        phone: phone.trim()
      });

      if (res.data.success) {
        setOtpSentMsg(res.data.message);
        if (res.data.test_code) {
          setOtpCode(res.data.test_code);
        }
        setOtpCooldown(60);
        const timer = setInterval(() => {
          setOtpCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Gagal mengirim kode OTP.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Email dan kata sandi wajib diisi.');
      return;
    }
    if (!agreement) {
      setErrorMsg('Anda harus menyetujui pernyataan penggunaan non-komersial.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await portalClient.post('/api/portal/auth/register', {
        has_npsn: hasNpsn,
        npsn: hasNpsn ? npsn.trim() : null,
        school_name: schoolName.trim() || (hasNpsn && npsn ? `Sekolah NPSN ${npsn}` : undefined),
        email: email.trim(),
        phone: phone.trim(),
        password: password.trim(),
        otp_code: otpCode.trim() || undefined
      });

      if (res.data.success && res.data.token) {
        localStorage.setItem('portal_token', res.data.token);
        localStorage.setItem('portal_user', JSON.stringify(res.data.user));
        setSuccessMsg(res.data.message);
        setTimeout(() => {
          onRegisterSuccess(res.data.user, res.data.token);
        }, 800);
      } else {
        setErrorMsg(res.data.message || 'Pendaftaran gagal.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Terjadi kesalahan sistem saat mendaftar.');
    } finally {
      setIsLoading(false);
    }
  };

  const isOfficialDomain = email.trim().toLowerCase().endsWith('.sch.id');

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0f172a] text-slate-100' : 'bg-slate-50 text-slate-800'} py-10 px-4 flex flex-col items-center justify-center transition-colors duration-200`}>
      {/* Top Controls Bar */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-4">
        <button
          onClick={onNavigateLogin}
          type="button"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Halaman Masuk</span>
        </button>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          type="button"
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-sm"
          title="Ganti Tema"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
        </button>
      </div>

      {/* Main Registration Card */}
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl space-y-7">
        
        {/* Header */}
        <div>
          <span className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-xs font-bold tracking-wider uppercase mb-3">
            Pendaftaran
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Pendaftaran Akun Institusi
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Lengkapi data institusi Anda. Pengajuan akan diverifikasi oleh tim admin maksimal 2 hari kerja.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3 text-rose-700 dark:text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-3 text-emerald-700 dark:text-emerald-300 text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-6">
          {/* Status NPSN Institusi */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Status NPSN Institusi
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Has NPSN */}
              <button
                type="button"
                onClick={() => setHasNpsn(true)}
                className={`text-left p-4 rounded-2xl border transition-all ${
                  hasNpsn
                    ? 'border-slate-900 dark:border-indigo-500 bg-slate-50 dark:bg-slate-800/80 shadow-sm ring-1 ring-slate-900 dark:ring-indigo-500'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <GraduationCap className={`w-4 h-4 ${hasNpsn ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    Institusi Memiliki NPSN
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verifikasi otomatis melalui basis data Kemendikbud.
                </p>
              </button>

              {/* Option 2: No NPSN */}
              <button
                type="button"
                onClick={() => setHasNpsn(false)}
                className={`text-left p-4 rounded-2xl border transition-all ${
                  !hasNpsn
                    ? 'border-slate-900 dark:border-indigo-500 bg-slate-50 dark:bg-slate-800/80 shadow-sm ring-1 ring-slate-900 dark:ring-indigo-500'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className={`w-4 h-4 ${!hasNpsn ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    Tidak / Belum Memiliki NPSN
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lembaga kursus, PKBM, atau institusi non-formal.
                </p>
              </button>
            </div>
          </div>

          {/* Conditional Input based on NPSN Status */}
          {hasNpsn ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nomor Pokok Sekolah Nasional (NPSN)
              </label>
              <input
                type="text"
                value={npsn}
                onChange={(e) => setNpsn(e.target.value)}
                placeholder="Contoh: 20123456"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:border-slate-900 dark:focus:border-indigo-500 focus:outline-none transition"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nama Lembaga / Institusi / Kursus
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Contoh: PKBM Harapan Bangsa"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:border-slate-900 dark:focus:border-indigo-500 focus:outline-none transition"
              />
            </div>
          )}

          {/* Email Kontak Utama + Kirim OTP */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Email Kontak Utama
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user.smkn1pld@gmail.com"
                className="flex-1 px-4 py-3 bg-blue-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:border-slate-900 dark:focus:border-indigo-500 focus:outline-none transition"
              />
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={isSendingOtp || otpCooldown > 0}
                className="px-5 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-800 dark:text-white font-bold text-sm rounded-2xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]"
              >
                {isSendingOtp ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : otpCooldown > 0 ? (
                  `${otpCooldown}s`
                ) : (
                  'Kirim OTP'
                )}
              </button>
            </div>
            {otpSentMsg && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1.5">
                ✓ {otpSentMsg}
              </p>
            )}
          </div>

          {/* Catatan Penting Email Sekolah Callout Box */}
          <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 flex items-start gap-3 text-sky-900 dark:text-sky-200 text-xs leading-relaxed">
            <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Catatan Penting Email Sekolah:</span>
              <p className="mt-0.5 text-sky-800/90 dark:text-sky-300/80">
                Jika Anda menggunakan <span className="font-bold">email resmi sekolah</span> (misal: domain <em>.sch.id</em> atau domain resmi sekolah), email tersebut menjadi <span className="font-bold">bukti langsung</span> identitas sekolah dan pengajuan Anda akan <span className="font-bold">langsung diapprove</span> (file bukti dokumen yang diupload akan dihiraukan).
              </p>
            </div>
          </div>

          {/* Row: OTP & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Kode Verifikasi (OTP)
              </label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="6 digit"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:border-slate-900 dark:focus:border-indigo-500 focus:outline-none transition text-center tracking-widest font-mono"
              />
              <span className="block text-[11px] text-slate-400 mt-1">
                Klik tombol Kirim OTP setelah mengisi email.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nomor Telepon / WhatsApp
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:border-slate-900 dark:focus:border-indigo-500 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Kata Sandi */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Kata Sandi Akun Baru
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-blue-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:border-slate-900 dark:focus:border-indigo-500 focus:outline-none transition"
            />
          </div>

          {/* Upload Bukti Surat Tugas */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Bukti Surat Tugas / Identitas Lembaga
            </label>
            <div className="relative border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:border-slate-300 dark:hover:border-slate-700 transition cursor-pointer bg-slate-50/50 dark:bg-slate-950/50">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {uploadedFile ? uploadedFile.name : 'Pilih dokumen bukti identitas'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Format: PDF, PNG, atau JPG (maksimal 2MB).
              </p>
              <p className="text-[10px] text-slate-400/80 italic mt-1 max-w-md">
                *Jika mendaftar dengan email resmi sekolah, dokumen ini akan dihiraukan karena email sudah menjadi bukti langsung.
              </p>
            </div>
          </div>

          {/* Pernyataan Non-Komersial */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-start gap-3">
            <input
              type="checkbox"
              id="agreement"
              checked={agreement}
              onChange={(e) => setAgreement(e.target.checked)}
              className="w-4 h-4 rounded text-slate-900 border-slate-300 focus:ring-0 mt-0.5 cursor-pointer"
            />
            <label htmlFor="agreement" className="text-xs text-slate-600 dark:text-slate-300 cursor-pointer leading-relaxed">
              <span className="font-bold text-slate-900 dark:text-white">Pernyataan Penggunaan Non-Komersial:</span> Saya menyetujui bahwa akun dan layanan ini digunakan khusus untuk <span className="font-bold">keperluan sekolah</span> dan <span className="font-bold">bukan untuk kepentingan komersial</span>.
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-[#111827] dark:bg-indigo-600 hover:bg-[#1f2937] dark:hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg transition duration-150 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses Pendaftaran...</span>
              </>
            ) : (
              'Kirim Pendaftaran Institusi'
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-xs text-slate-400">
            Sudah memiliki akun institusi?{' '}
            <button
              onClick={onNavigateLogin}
              type="button"
              className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Masuk Sekarang
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}
