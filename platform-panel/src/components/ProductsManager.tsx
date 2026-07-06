import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { 
  Layers, 
  Plus, 
  Edit3, 
  Trash2, 
  Save, 
  FolderPlus, 
  Check, 
  X, 
  AlertCircle,
  FileText,
  DollarSign,
  Smartphone,
  ChevronDown
} from 'lucide-react';

export default function ProductsManager() {
  const [products, setProducts] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active form view: 'list', 'product-form', 'plan-form'
  const [view, setView] = useState<'list' | 'product-form' | 'plan-form'>('list');
  
  // Selection filter
  const [filterProductId, setFilterProductId] = useState<string>('all');

  // Product Form states
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [productId, setProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [productPrefix, setProductPrefix] = useState('');

  // Plan Form states
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [planId, setPlanId] = useState('');
  const [planProductId, setPlanProductId] = useState('');
  const [planName, setPlanName] = useState('');
  const [planPriceMonthly, setPlanPriceMonthly] = useState<number>(0);
  const [planPriceYearly, setPlanPriceYearly] = useState<number>(0);
  const [planDeviceLimit, setPlanDeviceLimit] = useState<number>(0);
  const [planBillingPeriod, setPlanBillingPeriod] = useState<string>('MONTH');
  const [planIsActive, setPlanIsActive] = useState<boolean>(true);
  const [planModuleId, setPlanModuleId] = useState<string>('');
  const [planServiceCode, setPlanServiceCode] = useState<string>('');
  const [planFeatures, setPlanFeatures] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, planRes] = await Promise.all([
        apiClient.get('/api/admin/products'),
        apiClient.get('/api/admin/plans')
      ]);
      setProducts(prodRes.data?.data || []);
      setPlans(planRes.data?.data || []);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Gagal memuat data produk & paket.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Product Actions
  const handleOpenNewProduct = () => {
    setIsEditingProduct(false);
    setProductId('');
    setProductName('');
    setProductPrefix('');
    setView('product-form');
  };

  const handleOpenEditProduct = (prod: any) => {
    setIsEditingProduct(true);
    setProductId(prod.id);
    setProductName(prod.name);
    setProductPrefix(prod.prefix);
    setView('product-form');
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId.trim() || !productName.trim() || !productPrefix.trim()) return;

    try {
      if (isEditingProduct) {
        await apiClient.put(`/api/admin/products/${productId}`, {
          name: productName,
          prefix: productPrefix
        });
      } else {
        await apiClient.post('/api/admin/products', {
          id: productId,
          name: productName,
          prefix: productPrefix
        });
      }
      setView('list');
      loadData();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal menyimpan produk.');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Peringatan: Menghapus produk akan menghapus seluruh data terkait. Lanjutkan?')) return;
    try {
      await apiClient.delete(`/api/admin/products/${id}`);
      loadData();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal menghapus produk.');
    }
  };

  // Plan Actions
  const handleOpenNewPlan = () => {
    setIsEditingPlan(false);
    setPlanId('');
    setPlanProductId(products[0]?.id || '');
    setPlanName('');
    setPlanPriceMonthly(0);
    setPlanPriceYearly(0);
    setPlanDeviceLimit(100);
    setPlanBillingPeriod('MONTH');
    setPlanIsActive(true);
    setPlanModuleId('');
    setPlanServiceCode('');
    setPlanFeatures('');
    setView('plan-form');
  };

  const handleOpenEditPlan = (plan: any) => {
    setIsEditingPlan(true);
    setPlanId(plan.id);
    setPlanProductId(plan.productId);
    setPlanName(plan.name);
    setPlanPriceMonthly(plan.priceMonthly);
    setPlanPriceYearly(plan.priceYearly);
    setPlanDeviceLimit(plan.deviceLimit);
    setPlanBillingPeriod(plan.billingPeriod);
    setPlanIsActive(plan.isActive);
    setPlanModuleId(plan.moduleId || '');
    setPlanServiceCode(plan.serviceCode || '');
    
    // Convert features array back to newline separated string
    const featuresArr = Array.isArray(plan.featuresJson) 
      ? plan.featuresJson 
      : [];
    setPlanFeatures(featuresArr.join('\n'));
    setView('plan-form');
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planId.trim() || !planName.trim() || !planProductId.trim()) return;

    // Parse features into string array
    const featuresList = planFeatures
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);

    const payload = {
      id: planId,
      productId: planProductId,
      name: planName,
      priceMonthly: Number(planPriceMonthly),
      priceYearly: Number(planPriceYearly),
      deviceLimit: Number(planDeviceLimit),
      featuresJson: featuresList,
      billingPeriod: planBillingPeriod,
      isActive: planIsActive,
      moduleId: planModuleId || null,
      serviceCode: planServiceCode || null
    };

    try {
      if (isEditingPlan) {
        await apiClient.put(`/api/admin/plans/${planId}`, payload);
      } else {
        await apiClient.post('/api/admin/plans', payload);
      }
      setView('list');
      loadData();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal menyimpan paket plan.');
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Hapus paket plan ini secara permanen?')) return;
    try {
      await apiClient.delete(`/api/admin/plans/${id}`);
      loadData();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal menghapus paket plan.');
    }
  };

  // Filtered plans list
  const filteredPlans = plans.filter(p => filterProductId === 'all' || p.productId === filterProductId);

  return (
    <div className="space-y-6 text-left">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Kelola Produk & Paket</h1>
          <p className="text-slate-450 text-xs mt-1">Konfigurasi produk modular dan skema harga berlangganan.</p>
        </div>
        {view === 'list' && (
          <div className="flex gap-2">
            <button
              onClick={handleOpenNewProduct}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 border border-slate-700/50 shadow-md transition"
            >
              <FolderPlus className="w-4 h-4 text-indigo-400" />
              Tambah Produk
            </button>
            <button
              onClick={handleOpenNewPlan}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-655/20 transition"
            >
              <Plus className="w-4 h-4" />
              Tambah Paket (Plan)
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl flex items-center gap-2.5 text-xs">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Side: Products list card */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl h-fit">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-sm font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Daftar Produk ({products.length})
              </h3>
            </div>
            
            <div className="space-y-2">
              {products.length === 0 ? (
                <p className="text-slate-500 text-xs py-8 text-center">Belum ada produk terdaftar.</p>
              ) : (
                products.map((prod) => (
                  <div 
                    key={prod.id} 
                    className="p-3 bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-xl flex items-center justify-between group transition-all"
                  >
                    <div>
                      <div className="font-bold text-xs text-white">{prod.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {prod.id} | Prefix: {prod.prefix}</div>
                    </div>
                    <div className="flex gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEditProduct(prod)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                        title="Edit Produk"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(prod.id)}
                        className="p-1.5 bg-rose-650/10 hover:bg-rose-600 text-rose-450 hover:text-white rounded-lg transition"
                        title="Hapus Produk"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Side: Plans list card */}
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h3 className="text-white text-sm font-bold flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-indigo-400" />
                Daftar Paket Plan ({filteredPlans.length})
              </h3>
              
              {/* Product Filter dropdown */}
              <div className="relative w-full sm:w-48">
                <select
                  value={filterProductId}
                  onChange={(e) => setFilterProductId(e.target.value)}
                  className="w-full pl-3 pr-8 py-1.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl text-xs focus:outline-none cursor-pointer appearance-none font-semibold"
                >
                  <option value="all">Semua Produk</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
              </div>
            </div>

            {loading ? (
              <div className="py-20 text-center text-slate-500 font-bold uppercase tracking-widest text-xs animate-pulse">
                Memuat paket plan...
              </div>
            ) : filteredPlans.length === 0 ? (
              <p className="text-slate-500 text-xs py-20 text-center italic">Tidak ada paket plan terdaftar untuk filter ini.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950/80 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Nama Paket / ID</th>
                      <th className="px-4 py-3">Produk</th>
                      <th className="px-4 py-3">Harga (Bln/Thn)</th>
                      <th className="px-4 py-3">Limit Device</th>
                      <th className="px-4 py-3">Siklus</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredPlans.map((plan) => (
                      <tr key={plan.id} className="hover:bg-slate-950/40 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-white">{plan.name}</div>
                          <div className="text-[10px] text-slate-550 font-mono mt-0.5">{plan.id}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded-md text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                            {plan.product?.name || plan.productId}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-200">
                          <div>Rp {plan.priceMonthly.toLocaleString('id-ID')} / bln</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">Rp {plan.priceYearly.toLocaleString('id-ID')} / thn</div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-300 font-medium">
                          {plan.deviceLimit === 0 || plan.deviceLimit === 9999 ? (
                            <span className="text-indigo-400 font-bold">Unlimited</span>
                          ) : (
                            `${plan.deviceLimit} Device`
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                            plan.billingPeriod === 'YEAR' 
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {plan.billingPeriod === 'YEAR' ? 'Tahunan' : 'Bulanan'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`w-2 h-2 rounded-full inline-block mr-1.5 ${plan.isActive ? 'bg-green-500' : 'bg-slate-600'}`} />
                          <span className={plan.isActive ? 'text-green-550 font-semibold' : 'text-slate-500'}>
                            {plan.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditPlan(plan)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                              title="Edit Paket"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePlan(plan.id)}
                              className="p-1.5 bg-rose-650/10 hover:bg-rose-600 text-rose-450 hover:text-white rounded-lg transition"
                              title="Hapus Paket"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PRODUCT FORM VIEW ── */}
      {view === 'product-form' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl max-w-xl mx-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <h3 className="text-white text-sm font-bold flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-indigo-400" />
              {isEditingProduct ? 'Edit Data Produk' : 'Tambah Produk Baru'}
            </h3>
            <button 
              onClick={() => setView('list')}
              className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-850 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveProduct} className="space-y-5">
            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">ID Produk (Unique Code)</label>
              <input
                type="text"
                required
                disabled={isEditingProduct}
                placeholder="misal: platform-absenta, easy-tunnel"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Nama Produk</label>
              <input
                type="text"
                required
                placeholder="misal: Absenta Attendance, Easy Tunnel"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Prefix Lisensi</label>
              <input
                type="text"
                required
                placeholder="misal: ABS, EST, VPN"
                value={productPrefix}
                onChange={(e) => setProductPrefix(e.target.value)}
                className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none font-mono uppercase"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setView('list')}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-350 rounded-xl font-bold text-xs transition"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition"
              >
                <Save className="w-4 h-4" />
                Simpan Produk
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── PLAN FORM VIEW ── */}
      {view === 'plan-form' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl max-w-2xl mx-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <h3 className="text-white text-sm font-bold flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-400" />
              {isEditingPlan ? 'Edit Paket Plan' : 'Tambah Paket Plan Baru'}
            </h3>
            <button 
              onClick={() => setView('list')}
              className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-850 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSavePlan} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">ID Paket (Unique Code)</label>
                <input
                  type="text"
                  required
                  disabled={isEditingPlan}
                  placeholder="misal: HUBIN_MEDIUM_BULANAN"
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Produk Induk</label>
                <div className="relative">
                  <select
                    required
                    value={planProductId}
                    onChange={(e) => setPlanProductId(e.target.value)}
                    className="w-full h-11 pl-4 pr-10 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs focus:border-indigo-500 focus:outline-none appearance-none cursor-pointer"
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-3.5 text-slate-500 pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Nama Paket</label>
              <input
                type="text"
                required
                placeholder="misal: Hubungan Industri (Medium) - Bulanan"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Harga Bulanan (Rp)</label>
                <input
                  type="number"
                  required
                  min={0}
                  placeholder="0"
                  value={planPriceMonthly}
                  onChange={(e) => setPlanPriceMonthly(Number(e.target.value))}
                  className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Harga Tahunan (Rp)</label>
                <input
                  type="number"
                  required
                  min={0}
                  placeholder="0"
                  value={planPriceYearly}
                  onChange={(e) => setPlanPriceYearly(Number(e.target.value))}
                  className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Limit Device / Users</label>
                <input
                  type="number"
                  required
                  min={0}
                  placeholder="0"
                  value={planDeviceLimit}
                  onChange={(e) => setPlanDeviceLimit(Number(e.target.value))}
                  className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Set 0 untuk Unlimited</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Siklus Default</label>
                <div className="relative">
                  <select
                    value={planBillingPeriod}
                    onChange={(e) => setPlanBillingPeriod(e.target.value)}
                    className="w-full h-11 pl-4 pr-10 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs focus:border-indigo-500 focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="MONTH">Bulanan (MONTH)</option>
                    <option value="YEAR">Tahunan (YEAR)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-3.5 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Module ID Klien (Optional)</label>
                <input
                  type="text"
                  placeholder="misal: HUBIN, SARPRAS"
                  value={planModuleId}
                  onChange={(e) => setPlanModuleId(e.target.value)}
                  className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Service Code Klien (Optional)</label>
                <input
                  type="text"
                  placeholder="misal: HUBIN, SARPRAS"
                  value={planServiceCode}
                  onChange={(e) => setPlanServiceCode(e.target.value)}
                  className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Daftar Fitur (Satu fitur per baris)</label>
              <textarea
                rows={5}
                placeholder="misal:&#10;Manajemen Kemitraan DU/DI&#10;Jurnal Digital PKL&#10;Absensi PKL GPS Geofencing"
                value={planFeatures}
                onChange={(e) => setPlanFeatures(e.target.value)}
                className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none font-medium leading-relaxed"
              />
            </div>

            <div className="flex items-center gap-3 bg-slate-950/45 p-4 rounded-xl border border-slate-800/80">
              <input
                type="checkbox"
                id="plan_is_active"
                checked={planIsActive}
                onChange={(e) => setPlanIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-650 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="plan_is_active" className="text-slate-300 text-xs font-bold cursor-pointer select-none">
                Paket ini Aktif dan Dapat Ditampilkan ke Klien
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setView('list')}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-350 rounded-xl font-bold text-xs transition"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition"
              >
                <Save className="w-4 h-4" />
                Simpan Paket
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
