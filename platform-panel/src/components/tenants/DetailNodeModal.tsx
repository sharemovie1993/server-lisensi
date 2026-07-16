import React from 'react';
import apiClient from '../../api/apiClient';
import type { Tenant } from '../../types/tenant';
import { 
  Activity, 
  Database, 
  Users, 
  Key, 
  Cpu, 
  RefreshCw 
} from 'lucide-react';

interface DetailNodeModalProps {
  show: boolean;
  tenant: Tenant | null;
  onClose: () => void;
  onResetSuccess: () => void;
}

export default function DetailNodeModal({ show, tenant, onClose, onResetSuccess }: DetailNodeModalProps) {
  if (!show || !tenant) return null;

  const handleResetDeviceLock = async () => {
    if (!confirm('Apakah Anda yakin ingin melepas kunci perangkat (Reset Device Lock) untuk server ini?')) return;
    try {
      const res = await apiClient.post(`/api/admin/license/reset-devices/${tenant.id}`);
      if (res.data?.success) {
        alert('Kunci perangkat berhasil dilepas!');
        onResetSuccess();
        onClose();
      } else {
        alert(res.data?.message || 'Gagal melepas kunci perangkat');
      }
    } catch (e: any) {
      alert('Gagal melepas kunci perangkat: ' + (e.response?.data?.message || e.message));
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-left">
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <h3 className="text-white text-lg font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" /> Detail Node: {tenant.schoolName}
          </h3>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white text-2xl font-bold transition focus:outline-none"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 text-slate-300 text-sm">
          <div className="bg-slate-950/65 border border-slate-850 p-4 rounded-xl space-y-2.5">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Nama Instansi / Sekolah</span>
                <span className="text-white font-bold text-base">{tenant.schoolName}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Tanggal Daftar</span>
                <span className="text-xs text-slate-350 font-semibold font-mono">
                  {new Date(tenant.createdAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                </span>
              </div>
            </div>
            
            <div className="pt-2.5 border-t border-slate-800/85 space-y-2">
              {tenant.licenseKey && (
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500 font-sans">App Key (Lisensi):</span>
                  <span className="text-slate-300 font-bold select-all bg-slate-900 border border-slate-850 px-2.5 py-1 rounded">{tenant.licenseKey}</span>
                </div>
              )}
              {(tenant as any).tunnelLicenseKey && (
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500 font-sans">Tunnel Key (VPN):</span>
                  <span className="text-slate-300 font-bold select-all bg-slate-900 border border-slate-850 px-2.5 py-1 rounded">{(tenant as any).tunnelLicenseKey}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-slate-950/50 border border-slate-850 p-3.5 rounded-xl flex items-center space-x-3">
              <Database className="w-5 h-5 text-indigo-400 flex-shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-semibold">Basis Data (Size)</span>
                <span className="text-sm font-bold text-white font-mono">{tenant.dbSize ? `${tenant.dbSize.toFixed(1)} MB` : 'N/A'}</span>
              </div>
            </div>
            
            <div className="bg-slate-950/50 border border-slate-850 p-3.5 rounded-xl flex items-center space-x-3">
              <Users className="w-5 h-5 text-sky-400 flex-shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-semibold">Total Pengguna</span>
                <span className="text-sm font-bold text-white font-mono">{tenant.activeUsers ?? 0} User</span>
              </div>
            </div>

            <div className="bg-slate-950/50 border border-slate-850 p-3.5 rounded-xl flex items-center space-x-3">
              <Key className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-semibold">Total Perangkat HWID</span>
                <span className="text-sm font-bold text-white font-mono">{(tenant as any).activeDevices ?? 0} Perangkat</span>
              </div>
            </div>

            <div className="bg-slate-950/50 border border-slate-850 p-3.5 rounded-xl col-span-1 sm:col-span-3 space-y-1.5">
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">Penggunaan Memori (RAM)</span>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      tenant.memoryUsage && tenant.memoryUsage > 0.85 ? 'bg-rose-500' :
                      tenant.memoryUsage && tenant.memoryUsage > 0.65 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} 
                    style={{ width: `${(tenant.memoryUsage || 0) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-350 font-mono">
                  {tenant.memoryUsage ? `${(tenant.memoryUsage * 100).toFixed(0)}%` : 'N/A'}
                </span>
              </div>
            </div>

            {(tenant.hostname || tenant.osType || tenant.lastHeartbeatAt) && (
              <div className="bg-slate-950/50 border border-slate-850 p-3.5 rounded-xl col-span-1 sm:col-span-3 space-y-2 text-xs font-mono text-slate-400">
                {tenant.hostname && <div className="flex justify-between"><span className="text-slate-500">Host:</span><span className="text-white font-bold flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-indigo-400" /> {tenant.hostname}</span></div>}
                {tenant.osType && (() => {
                  const osStr = tenant.osType;
                  if (osStr.includes('|')) {
                    const parts = osStr.split('|').map(p => p.trim());
                    const osName = parts[0];
                    const cpu = parts.find(p => p.startsWith('CPU:'))?.replace('CPU:', '').trim();
                    const ram = parts.find(p => p.startsWith('RAM:'))?.replace('RAM:', '').trim();
                    const storage = parts.find(p => p.startsWith('Storage:'))?.replace('Storage:', '').trim();
                    return (
                      <>
                        <div className="flex justify-between"><span className="text-slate-500">Sistem Operasi:</span><span className="text-slate-300">{osName}</span></div>
                        {cpu && <div className="flex justify-between"><span className="text-slate-500">CPU (Processor):</span><span className="text-slate-300 text-right truncate max-w-[200px] sm:max-w-none" title={cpu}>{cpu}</span></div>}
                        {ram && <div className="flex justify-between"><span className="text-slate-500">Kapasitas RAM:</span><span className="text-slate-300">{ram}</span></div>}
                        {storage && <div className="flex justify-between"><span className="text-slate-500">Kapasitas Disk:</span><span className="text-slate-300">{storage}</span></div>}
                      </>
                    );
                  }
                  return <div className="flex justify-between"><span className="text-slate-500">Sistem Operasi:</span><span className="text-slate-300">{osStr}</span></div>;
                })()}
                {tenant.lastHeartbeatAt && <div className="flex justify-between"><span className="text-slate-500">Heartbeat Terakhir:</span><span className="text-indigo-300">{new Date(tenant.lastHeartbeatAt).toLocaleTimeString('id-ID')} ({new Date(tenant.lastHeartbeatAt).toLocaleDateString('id-ID')})</span></div>}
                
                {/* HWID Fingerprints List */}
                {tenant.activatedDevices && tenant.activatedDevices.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-850 text-left animate-fade-in col-span-1 sm:col-span-3">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-2 tracking-wider font-sans">Daftar HWID Fingerprint Terdaftar:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {tenant.activatedDevices.map((dev) => (
                        <div key={dev.id} className="bg-slate-900 border border-slate-800/80 px-2.5 py-1.5 rounded-lg flex flex-col gap-0.5">
                          <span className="text-indigo-355 font-bold text-[10px] truncate select-all" title={dev.deviceId}>{dev.deviceId}</span>
                          <span className="text-[9px] text-slate-500 font-sans">Aktif: {new Date(dev.activatedAt).toLocaleDateString('id-ID')} {new Date(dev.activatedAt).toLocaleTimeString('id-ID')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-850 flex justify-end col-span-1 sm:col-span-3">
                  <button
                    onClick={handleResetDeviceLock}
                    className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-400 font-bold font-sans text-[11px] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reset Device Lock / HWID Fingerprint</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-350 rounded-xl text-sm font-semibold transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
