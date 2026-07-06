import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { AlertTriangle, TrendingDown, CheckCircle, Flame, RefreshCw } from 'lucide-react';

interface RiskData {
  total_tenant: number;
  uncalculated_tenant: number;
  HEALTHY: number;
  WARNING: number;
  HIGH_RISK: number;
  CRITICAL: number;
  top_10: Array<{
    tenant_id: string;
    tenant_name: string;
    risk_score: number;
    risk_level: string;
    last_calculated_at: string;
  }>;
}

export default function RiskIntelligence() {
  const [data, setData] = useState<RiskData | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = async (productId = selectedProductId) => {
    setLoading(true);
    try {
      const [riskRes, productsRes] = await Promise.all([
        apiClient.get(`/api/admin/risk/overview?productId=${productId}`),
        apiClient.get('/api/admin/products')
      ]);
      if (riskRes.data?.success) {
        setData(riskRes.data.data);
      }
      setProducts(productsRes.data?.data || []);
    } catch (e) {
      console.error('Failed to load risk data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedProductId);
  }, [selectedProductId]);

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center py-20 bg-slate-950 min-h-screen">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const riskLevels = [
    { title: 'Sehat (HEALTHY)', count: data?.HEALTHY ?? 0, color: 'text-green-400 border-green-500/20 bg-green-500/5', icon: CheckCircle },
    { title: 'Waspada (WARNING)', count: data?.WARNING ?? 0, color: 'text-amber-400 border-amber-500/20 bg-amber-500/5', icon: AlertTriangle },
    { title: 'Resiko Tinggi (HIGH RISK)', count: data?.HIGH_RISK ?? 0, color: 'text-orange-400 border-orange-500/20 bg-orange-500/5', icon: TrendingDown },
    { title: 'Kritis (CRITICAL)', count: data?.CRITICAL ?? 0, color: 'text-red-400 border-red-500/20 bg-red-500/5', icon: Flame },
  ];

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-white text-2xl font-bold">Analisis Risiko Churn (Risk Intelligence)</h2>
          <p className="text-slate-400 text-sm">Pemantauan kesehatan relasi tenant sekolah berdasarkan intensitas tapping kehadiran.</p>
        </div>
        <button
          onClick={() => loadData(selectedProductId)}
          className="p-2.5 bg-slate-800 hover:bg-slate-755 border border-slate-700 text-slate-300 rounded-xl transition"
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {riskLevels.map((lvl, idx) => {
          const Icon = lvl.icon;
          return (
            <div key={idx} className={`border rounded-2xl p-6 ${lvl.color}`}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold">{lvl.title}</span>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-white text-3xl font-extrabold mt-4">{lvl.count}</h3>
              <p className="text-slate-500 text-xs mt-1">Tenant terdeteksi</p>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <h3 className="text-white text-lg font-bold mb-4">Top 10 Sekolah dengan Risiko Churn Tertinggi</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-4">Nama Sekolah</th>
                <th className="px-6 py-4">Tingkat Risiko</th>
                <th className="px-6 py-4">Skor Risiko (0-100)</th>
                <th className="px-6 py-4">Terakhir Dihitung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300 text-sm">
              {!data?.top_10 || data.top_10.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                    Tidak ada data risiko tenant terdeteksi untuk produk ini.
                  </td>
                </tr>
              ) : (
                data.top_10.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-850/50 transition">
                    <td className="px-6 py-4 font-semibold text-white">{r.tenant_name}</td>
                    <td className="px-6 py-4">
                      {r.risk_level === 'CRITICAL' && (
                        <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400">
                          Kritis
                        </span>
                      )}
                      {r.risk_level === 'HIGH_RISK' && (
                        <span className="px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs font-semibold text-orange-400">
                          Resiko Tinggi
                        </span>
                      )}
                      {r.risk_level === 'WARNING' && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400">
                          Waspada
                        </span>
                      )}
                      {r.risk_level === 'HEALTHY' && (
                        <span className="px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-xs font-semibold text-green-400">
                          Sehat
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-400">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full ${r.risk_score > 70 ? 'bg-red-500' : r.risk_score > 40 ? 'bg-amber-500' : 'bg-green-500'}`}
                            style={{ width: `${r.risk_score}%` }}
                          />
                        </div>
                        {r.risk_score.toFixed(1)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(r.last_calculated_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
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
