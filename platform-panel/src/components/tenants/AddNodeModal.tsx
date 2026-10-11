import React, { useState } from 'react';
import apiClient from '../../api/apiClient';
import type { Product } from '../../types/product';
import { Server, Key, ShieldCheck, Calendar, Users, Globe, Copy, Check, Sparkles, RefreshCw, X } from 'lucide-react';

interface AddNodeModalProps {
  show: boolean;
  packages: Product[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddNodeModal({ show, packages, onClose, onSuccess }: AddNodeModalProps) {
  const [schoolName, setSchoolName] = useState('');
  const [requestedSlug, setRequestedSlug] = useState('');
  const [packageId, setPackageId] = useState('cakola');
  const [nodeType, setNodeType] = useState<'SERVER_ONPREMISE' | 'SERVER_SAAS'>('SERVER_ONPREMISE');
  const [deployMode, setDeployMode] = useState<'local' | 'hybrid' | 'saas'>('local');
  
  // Custom or auto license key
  const [isManualKey, setIsManualKey] = useState(false);
  const [customKey, setCustomKey] = useState('');
  
  // Quota & Expired
  const [deviceLimit, setDeviceLimit] = useState(1200);
  const [expiresPreset, setExpiresPreset] = useState<'1Y' | '3Y' | '5Y' | 'LIFETIME' | 'CUSTOM'>('1Y');
  const [customExpiresDate, setCustomExpiresDate] = useState('');

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdLicense, setCreatedLicense] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  if (!show) return null;

  const generateRandomKeyPreview = () => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const segment = (len = 4) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `ABS-${segment(4)}-${segment(4)}-${segment(4)}`;
  };

  const calculateExpiresDate = (): string => {
    const now = new Date();
    if (expiresPreset === '1Y') {
      now.setFullYear(now.getFullYear() + 1);
      return now.toISOString().slice(0, 10);
    }
    if (expiresPreset === '3Y') {
      now.setFullYear(now.getFullYear() + 3);
      return now.toISOString().slice(0, 10);
    }
    if (expiresPreset === '5Y') {
      now.setFullYear(now.getFullYear() + 5);
      return now.toISOString().slice(0, 10);
    }
    if (expiresPreset === 'LIFETIME') {
      return '2099-12-31';
    }
    return customExpiresDate || now.toISOString().slice(0, 10);
  };

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    const effectiveExpires = calculateExpiresDate();

    try {
      const res = await apiClient.post('/api/admin/tenants', {
        schoolName: schoolName.trim(),
        requestedSlug: requestedSlug.trim() || undefined,
        packageId: packageId || 'cakola',
        licenseKey: isManualKey && customKey ? customKey.trim().toUpperCase() : undefined,
        nodeType,
        deployMode,
        deviceLimit: Number(deviceLimit),
        isUnlimited: deviceLimit >= 99999 ? 1 : 0,
        expiresAt: effectiveExpires,
      });

      if (res.data?.success && res.data?.data) {
        setCreatedLicense(res.data.data);
        onSuccess();
      } else {
        setErrorMsg(res.data?.message || 'Gagal mendaftarkan server node.');
      }
    } catch (e: any) {
      setErrorMsg(e.response?.data?.message || e.message || 'Terjadi kesalahan sistem saat membuat lisensi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyKey = () => {
    if (!createdLicense?.licenseKey) return;
    navigator.clipboard.writeText(createdLicense.licenseKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetAndClose = () => {
    setCreatedLicense(null);
    setSchoolName('');
    setRequestedSlug('');
    setCustomKey('');
    setIsManualKey(false);
    setErrorMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[92vh] flex flex-col justify-between">
        
        {/* HEADER */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white text-lg font-bold">Daftarkan Server / Node Appliance Baru</h3>
              <p className="text-slate-400 text-xs">Membuat lisensi root untuk server fisik on-premise atau server platform SaaS.</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={handleResetAndClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* JIKA SUDAH SUKSES DIBUAT */}
        {createdLicense ? (
          <div className="space-y-4 py-2">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="text-emerald-300 font-bold text-base">Lisensi Server Berhasil Didaftarkan!</h4>
              <p className="text-slate-300 text-xs max-w-sm mx-auto">
                Server <strong>{createdLicense.schoolName}</strong> siap dioperasikan dengan status aktif.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">License Key Anda:</span>
                <div className="flex items-center justify-between gap-2 mt-1 p-2.5 bg-slate-900 border border-indigo-500/30 rounded-lg">
                  <span className="font-mono text-sm sm:text-base font-bold text-indigo-300 select-all">
                    {createdLicense.licenseKey}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Disalin' : 'Salin Key'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-2 border-t border-slate-850">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Tipe Node</span>
                  <span className="text-slate-200 font-medium">{createdLicense.nodeType}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Masa Berlaku</span>
                  <span className="text-slate-200 font-medium">{createdLicense.expiresAt}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Kapasitas Siswa</span>
                  <span className="text-slate-200 font-medium">{createdLicense.deviceLimit >= 99999 ? 'Unlimited' : `${createdLicense.deviceLimit} Siswa`}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Deploy Mode</span>
                  <span className="text-slate-200 font-medium uppercase">{createdLicense.deployMode || 'LOCAL'}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
              <span className="font-bold">Langkah Selanjutnya:</span> Masukkan key di atas ke file <code>.env</code> server Absenta Anda:
              <pre className="mt-1.5 p-2 bg-slate-950 rounded text-[11px] font-mono text-slate-200 overflow-x-auto">
                LICENSE_KEY={createdLicense.licenseKey}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition"
              >
                Selesai &amp; Tutup
              </button>
            </div>
          </div>
        ) : (
          /* FORM PEMBUATAN LISENSI BARU */
          <form onSubmit={handleAddTenant} className="space-y-4 overflow-y-auto pr-1">
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. NAMA SERVER / APPLIANCE */}
            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-1">
                Nama Server / Sekolah / Node Appliance <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Server Dev Dell - Absenta atau SMKN 1 PLD"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 text-sm focus:border-indigo-500 focus:outline-none transition"
              />
            </div>

            {/* 2. TIPE NODE & DEPLOY MODE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Tipe Appliance Node</label>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => { setNodeType('SERVER_ONPREMISE'); setDeployMode('local'); }}
                    className={`py-1.5 text-xs font-bold rounded-lg transition ${
                      nodeType === 'SERVER_ONPREMISE'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    On-Premise
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNodeType('SERVER_SAAS'); setDeployMode('saas'); }}
                    className={`py-1.5 text-xs font-bold rounded-lg transition ${
                      nodeType === 'SERVER_SAAS'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Cloud SaaS
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Mode Deployment</label>
                <select
                  value={deployMode}
                  onChange={(e) => setDeployMode(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="local">Local On-Premise (Offline Server)</option>
                  <option value="hybrid">Hybrid (Easy Tunnel WireGuard)</option>
                  <option value="saas">SaaS Cloud Host (Multi-Tenant)</option>
                </select>
              </div>
            </div>

            {/* 3. LICENSE KEY: AUTO VS MANUAL */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Kustomisasi License Key</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-slate-200">
                  <input
                    type="checkbox"
                    checked={isManualKey}
                    onChange={(e) => {
                      setIsManualKey(e.target.checked);
                      if (e.target.checked && !customKey) {
                        setCustomKey('ABS-H2OT-VYNZ-NV0G');
                      }
                    }}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-0 w-3.5 h-3.5 bg-slate-900"
                  />
                  <span>Input Manual Key</span>
                </label>
              </div>

              {isManualKey ? (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Contoh: ABS-H2OT-VYNZ-NV0G"
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value.toUpperCase())}
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-750 rounded-lg text-white font-mono text-xs focus:border-indigo-500 focus:outline-none uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => setCustomKey(generateRandomKeyPreview())}
                      title="Generate Acak"
                      className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Acak</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Masukkan key yang sudah terpasang di <code>.env</code> server dev Anda.
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Sistem akan meng-generate format resmi secara otomatis (<code>ABS-XXXX-XXXX-XXXX</code>).</span>
                </p>
              )}
            </div>

            {/* 4. KAPASITAS SISWA & MASA AKTIF */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Device Limit */}
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Kapasitas Siswa (Device Limit)</label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { label: '300', val: 300 },
                    { label: '600', val: 600 },
                    { label: '1.200', val: 1200 },
                    { label: '2.500', val: 2500 },
                    { label: '5.000', val: 5000 },
                    { label: 'Unlimited', val: 99999 }
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setDeviceLimit(preset.val)}
                      className={`py-1.5 text-[11px] font-bold rounded-lg border transition ${
                        deviceLimit === preset.val
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Expired Preset */}
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Masa Berlaku (Expired)</label>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { label: '1 Tahun', val: '1Y' },
                    { label: '3 Tahun', val: '3Y' },
                    { label: '5 Tahun', val: '5Y' },
                    { label: 'Permanen 2099', val: 'LIFETIME' }
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setExpiresPreset(preset.val as any)}
                      className={`py-1.5 text-[11px] font-bold rounded-lg border transition ${
                        expiresPreset === preset.val
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 5. SLUG OPSIONAL */}
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1">
                Requested Slug / Subdomain (Opsional)
              </label>
              <input
                type="text"
                placeholder="Contoh: smkn1pld atau dev-server"
                value={requestedSlug}
                onChange={(e) => setRequestedSlug(e.target.value.toLowerCase())}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* FOOTER ACTIONS */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-4 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/25 transition flex items-center gap-1.5"
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{submitting ? 'Menyimpan...' : 'Simpan & Daftarkan Lisensi Appliance'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
