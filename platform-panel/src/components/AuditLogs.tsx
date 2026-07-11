import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { ShieldAlert, RefreshCw, FileText } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  productId: string;
  licenseKey: string;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsRes, productsRes] = await Promise.all([
        apiClient.get('/api/admin/logs'),
        apiClient.get('/api/admin/products')
      ]);
      setLogs(logsRes.data?.data || logsRes.data || []);
      setProducts(productsRes.data?.data || []);
    } catch (e) {
      console.error('Failed to load audit logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredLogs = logs.filter(log => {
    // Normalisasi alias lama: platform-absenta dan absenta → cakola
    const normalId = (log.productId === 'platform-absenta' || log.productId === 'absenta')
      ? 'cakola' : log.productId;
    return selectedProductId === 'all' || normalId === selectedProductId;
  });

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-white text-2xl font-bold">Log Audit Trail</h2>
          <p className="text-slate-400 text-sm">Rekaman audit aktivitas check-in lisensi, validasi perangkat, dan tindakan administrasi.</p>
        </div>
        <button
          onClick={loadData}
          className="p-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-755 text-slate-300 rounded-xl transition"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* PRODUCT FILTER SELECT */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex justify-end">
        <div className="w-full sm:w-72">
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-indigo-400 font-bold text-sm focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="all">🌐 Semua Produk / Aplikasi</option>
            {products.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                📦 {pkg.name} ({pkg.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-4">Waktu</th>
                <th className="px-6 py-4">Produk</th>
                <th className="px-6 py-4">License Key</th>
                <th className="px-6 py-4">Aktivitas / Event</th>
                <th className="px-6 py-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300 text-sm font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500 font-sans">
                    {loading ? 'Memuat data...' : 'Tidak ada log aktivitas terdaftar.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-850/50 transition">
                    <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-xs text-indigo-400 uppercase font-bold whitespace-nowrap">
                      {log.productId}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                      {log.licenseKey}
                    </td>
                    <td className="px-6 py-4 text-white text-xs font-sans font-semibold">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {log.ipAddress || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
