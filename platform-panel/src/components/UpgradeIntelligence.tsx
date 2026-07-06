import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { Sparkles, TrendingUp, RefreshCw, Flame } from 'lucide-react';

interface UpgradeData {
  funnels: Array<{
    month: string;
    intent_count: number;
    invoice_created_count: number;
    invoice_paid_count: number;
    upgrade_applied_count: number;
    conversion_rate: number;
  }>;
  intent_distribution: Array<{
    intent_level: string;
    _count: { _all: number };
  }>;
  top_hot_tenants: Array<{
    tenant_id: string;
    tenant_name?: string;
    intent_score: number;
    intent_level: string;
    usage_growth_percent?: number | null;
  }>;
}

export default function UpgradeIntelligence() {
  const [data, setData] = useState<UpgradeData | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = async (productId = selectedProductId) => {
    setLoading(true);
    try {
      const [upgradeRes, productsRes] = await Promise.all([
        apiClient.get(`/api/admin/upgrade-intelligence/overview?productId=${productId}`),
        apiClient.get('/api/admin/products')
      ]);
      if (upgradeRes.data?.success) {
        setData(upgradeRes.data.data);
      }
      setProducts(productsRes.data?.data || []);
    } catch (e) {
      console.error('Failed to load upgrade intelligence data', e);
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

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-white text-2xl font-bold">Analisis Minat Upgrade (Upgrade Intelligence)</h2>
          <p className="text-slate-400 text-sm">Mendeteksi minat sekolah untuk melakukan upgrade paket lisensi berdasarkan intensitas pertumbuhan penggunaan fitur.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
          <h3 className="text-white text-lg font-bold flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Top Sekolah Sangat Tertarik (HOT Potentials)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs font-semibold uppercase">
                  <th className="px-4 py-3">Nama Sekolah</th>
                  <th className="px-4 py-3">Skor Minat</th>
                  <th className="px-4 py-3">Tingkat Minat</th>
                  <th className="px-4 py-3 text-right">Pertumbuhan Penggunaan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {!data?.top_hot_tenants || data.top_hot_tenants.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      Tidak ada sekolah potensial upgrade saat ini untuk produk terpilih.
                    </td>
                  </tr>
                ) : (
                  data.top_hot_tenants.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-850/30">
                      <td className="px-4 py-3 font-semibold text-white">
                        {t.tenant_name || t.tenant_id.substring(0, 8)}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-400">{t.intent_score}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-xs font-semibold text-orange-400">
                          {t.intent_level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-semibold">
                        +{t.usage_growth_percent ? `${t.usage_growth_percent}%` : '0%'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
          <h3 className="text-white text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            Distribusi Tingkat Minat Platform
          </h3>
          <div className="space-y-4">
            {!data?.intent_distribution || data.intent_distribution.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">Belum ada data distribusi terkumpul.</p>
            ) : (
              data.intent_distribution.map((dist, idx) => {
                const count = dist._count?._all ?? 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-400">
                      <span>{dist.intent_level}</span>
                      <span>{count} Sekolah</span>
                    </div>
                    <div className="w-full bg-slate-950 border border-slate-850 h-3 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${dist.intent_level === 'HOT' ? 'bg-orange-500' : dist.intent_level === 'HIGH' ? 'bg-amber-500' : 'bg-indigo-500'}`}
                        style={{ width: `${Math.min(100, (count / 10) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
        <h3 className="text-white text-lg font-bold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-400" />
          Funnel Konversi Upgrade Bulanan
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs font-semibold uppercase">
                <th className="px-6 py-4">Bulan</th>
                <th className="px-6 py-4">Jumlah Minat (Intent)</th>
                <th className="px-6 py-4">Invoice Dibuat</th>
                <th className="px-6 py-4">Invoice Dibayar</th>
                <th className="px-6 py-4">Penerapan Upgrade</th>
                <th className="px-6 py-4 text-right">Rasio Konversi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300 text-sm">
              {!data?.funnels || data.funnels.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                    Belum ada data funnel terkumpul.
                  </td>
                </tr>
              ) : (
                data.funnels.map((f, i) => (
                  <tr key={i} className="hover:bg-slate-850/50 transition">
                    <td className="px-6 py-4 font-semibold text-white">{f.month}</td>
                    <td className="px-6 py-4 font-mono">{f.intent_count}</td>
                    <td className="px-6 py-4 font-mono">{f.invoice_created_count}</td>
                    <td className="px-6 py-4 font-mono text-amber-400">{f.invoice_paid_count}</td>
                    <td className="px-6 py-4 font-mono text-emerald-400">{f.upgrade_applied_count}</td>
                    <td className="px-6 py-4 text-right font-bold text-white">
                      {(f.conversion_rate * 100).toFixed(1)}%
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
