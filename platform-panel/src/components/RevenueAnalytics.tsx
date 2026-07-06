import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { DollarSign, BarChart3, TrendingUp, RefreshCw } from 'lucide-react';

interface ForecastData {
  current_mrr: number;
  risk_loss: number;
  forecast_mrr: number;
  forecast_arr: number;
}

interface CohortData {
  cohort_month: string;
  active_count: number;
  retained_after_1_month: number;
  retained_after_3_month: number;
  retained_after_6_month: number;
  retained_after_12_month: number;
  revenue_generated: number;
}

export default function RevenueAnalytics() {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [cohorts, setCohorts] = useState<CohortData[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = async (productId = selectedProductId) => {
    setLoading(true);
    try {
      const [forecastRes, cohortRes, productsRes] = await Promise.all([
        apiClient.get(`/api/admin/analytics/revenue-forecast?productId=${productId}`),
        apiClient.get(`/api/admin/analytics/cohort?productId=${productId}`),
        apiClient.get('/api/admin/products')
      ]);
      
      if (forecastRes.data?.success) {
        setForecast(forecastRes.data.data);
      }
      if (cohortRes.data?.success) {
        setCohorts(cohortRes.data.data || []);
      }
      setProducts(productsRes.data?.data || []);
    } catch (e) {
      console.error('Failed to load revenue analytics', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedProductId);
  }, [selectedProductId]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const getPercentage = (val: number) => {
    return val ? `${(val * 100).toFixed(1)}%` : '0%';
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-white text-2xl font-bold">Analisis Pendapatan & Cohort (Revenue Analytics)</h2>
          <p className="text-slate-400 text-sm">Dashboard proyeksi MRR, ARR, dan tingkat retensi sekolah secara bulanan.</p>
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-600 to-indigo-700 opacity-10 rounded-bl-full" />
          <span className="text-slate-400 text-sm font-medium">Current MRR</span>
          <h3 className="text-white text-2xl font-bold mt-2">{formatCurrency(forecast?.current_mrr ?? 0)}</h3>
          <p className="text-slate-500 text-xs mt-1">Pendapatan bulanan saat ini</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-red-600 to-orange-650 opacity-10 rounded-bl-full" />
          <span className="text-slate-400 text-sm font-medium">Risk Adjustment Loss</span>
          <h3 className="text-rose-450 text-2xl font-bold mt-2">{formatCurrency(forecast?.risk_loss ?? 0)}</h3>
          <p className="text-slate-500 text-xs mt-1">Potensi rugi churn (resiko)</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-600 to-teal-700 opacity-10 rounded-bl-full" />
          <span className="text-slate-400 text-sm font-medium">Projected MRR</span>
          <h3 className="text-emerald-400 text-2xl font-bold mt-2">{formatCurrency(forecast?.forecast_mrr ?? 0)}</h3>
          <p className="text-slate-500 text-xs mt-1">Estimasi MRR bulan depan</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-700 opacity-10 rounded-bl-full" />
          <span className="text-slate-400 text-sm font-medium">Projected ARR</span>
          <h3 className="text-indigo-400 text-2xl font-bold mt-2">{formatCurrency(forecast?.forecast_arr ?? 0)}</h3>
          <p className="text-slate-500 text-xs mt-1">Estimasi ARR tahunan</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
        <h3 className="text-white text-lg font-bold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-400" />
          Cohort Retensi Lisensi Bulanan
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs font-semibold uppercase">
                <th className="px-4 py-3">Bulan Cohort</th>
                <th className="px-4 py-3">Sekolah Aktif</th>
                <th className="px-4 py-3 text-right">Retensi 1 Bln</th>
                <th className="px-4 py-3 text-right">Retensi 3 Bln</th>
                <th className="px-4 py-3 text-right">Retensi 6 Bln</th>
                <th className="px-4 py-3 text-right">Retensi 12 Bln</th>
                <th className="px-4 py-3 text-right">Pendapatan Terkumpul</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-350">
              {cohorts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada data kohort untuk produk ini.
                  </td>
                </tr>
              ) : (
                cohorts.map((c, idx) => (
                  <tr key={idx} className="hover:bg-slate-850/30">
                    <td className="px-4 py-3 font-semibold text-white">
                      {new Date(c.cohort_month).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' })}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-300">{c.active_count} Sekolah</td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-medium">{getPercentage(c.retained_after_1_month)}</td>
                    <td className="px-4 py-3 text-right text-emerald-450 font-medium">{getPercentage(c.retained_after_3_month)}</td>
                    <td className="px-4 py-3 text-right text-teal-400 font-medium">{getPercentage(c.retained_after_6_month)}</td>
                    <td className="px-4 py-3 text-right text-teal-450 font-medium">{getPercentage(c.retained_after_12_month)}</td>
                    <td className="px-4 py-3 text-right font-bold text-white">{formatCurrency(c.revenue_generated)}</td>
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
