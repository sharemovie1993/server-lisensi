import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import { useProducts } from '../hooks/useProducts';
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
  ChevronDown,
  ShieldCheck,
  FlaskConical,
  RefreshCw
} from 'lucide-react';

export default function ProductsManager() {
  const queryClient = useQueryClient();
  const { data: products = [] } = useProducts();
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
  const [productPaymentMode, setProductPaymentMode] = useState<'PRODUCTION' | 'SANDBOX'>('SANDBOX');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Plan Form states
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [planId, setPlanId] = useState('');
  const [planProductId, setPlanProductId] = useState('');
  const [planName, setPlanName] = useState('');
  const [planPriceMonthly, setPlanPriceMonthly] = useState<number>(0);
  const [planPriceYearly, setPlanPriceYearly] = useState<number>(0);
  const [planPriceOnetime, setPlanPriceOnetime] = useState<number>(0);
  const [planWeightGrams, setPlanWeightGrams] = useState<number>(0);
  const [planImageUrl, setPlanImageUrl] = useState<string>('');
  const [planDeviceLimit, setPlanDeviceLimit] = useState<number>(0);
  const [planBillingPeriod, setPlanBillingPeriod] = useState<string>('MONTH');
  const [planIsActive, setPlanIsActive] = useState<boolean>(true);
  const [planModuleId, setPlanModuleId] = useState<string>('');
  const [planServiceCode, setPlanServiceCode] = useState<string>('');
  const [planFeatures, setPlanFeatures] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const planRes = await apiClient.get('/api/admin/plans');
      setPlans(planRes.data?.data || []);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (e: any) {
      setError(e.response?.data?.message || 'Gagal memuat data produk & paket.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Upload handler for product image
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB');
      return;
    }

    setIsUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const res = await apiClient.post('/api/admin/upload-product-image', {
          fileName: file.name,
          base64Data
        });
        if (res.data?.success && res.data?.imageUrl) {
          setPlanImageUrl(res.data.imageUrl);
        } else {
          alert(res.data?.message || 'Gagal mengunggah gambar');
        }
        setIsUploadingImage(false);
      };
      reader.onerror = () => {
        alert('Gagal membaca file gambar');
        setIsUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengunggah gambar');
      setIsUploadingImage(false);
    }
  };

  // Product Actions
  const handleOpenNewProduct = () => {
    setIsEditingProduct(false);
    setProductId('');
    setProductName('');
    setProductPrefix('');
    setProductPaymentMode('SANDBOX');
    setView('product-form');
  };

  const handleOpenEditProduct = (prod: any) => {
    setIsEditingProduct(true);
    setProductId(prod.id);
    setProductName(prod.name);
    setProductPrefix(prod.prefix);
    setProductPaymentMode((prod.paymentMode as any) || 'SANDBOX');
    setView('product-form');
  };

  const handleTogglePaymentMode = async (prod: any) => {
    const nextMode = prod.paymentMode === 'PRODUCTION' ? 'SANDBOX' : 'PRODUCTION';
    const isTargetProd = nextMode === 'PRODUCTION';
    const confirmMsg = isTargetProd
      ? `Aktifkan mode LIVE PRODUCTION untuk ${prod.name}?\n\nSemua transaksi checkout lisensi/order untuk produk ini akan menggunakan uang asli dan diteruskan langsung ke Tripay Live (Merchant T35097).`
      : `Kembalikan mode SANDBOX untuk ${prod.name}?\n\nTransaksi checkout untuk produk ini akan kembali ke simulasi testing (Tripay Sandbox).`;

    if (!confirm(confirmMsg)) return;

    setTogglingId(prod.id);
    try {
      await apiClient.patch(`/api/admin/products/${prod.id}/payment-mode`, {
        paymentMode: nextMode
      });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal mengubah mode pembayaran.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId.trim() || !productName.trim() || !productPrefix.trim()) return;

    try {
      if (isEditingProduct) {
        await apiClient.put(`/api/admin/products/${productId}`, {
          name: productName,
          prefix: productPrefix,
          paymentMode: productPaymentMode
        });
      } else {
        await apiClient.post('/api/admin/products', {
          id: productId,
          name: productName,
          prefix: productPrefix,
          paymentMode: productPaymentMode
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
    setPlanPriceOnetime(0);
    setPlanWeightGrams(0);
    setPlanImageUrl('');
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
    setPlanPriceMonthly(plan.priceMonthly || 0);
    setPlanPriceYearly(plan.priceYearly || 0);
    setPlanPriceOnetime(plan.priceOnetime || 0);
    setPlanWeightGrams(plan.weightGrams || 0);
    setPlanImageUrl(plan.imageUrl || '');
    setPlanDeviceLimit(plan.deviceLimit || 0);
    setPlanBillingPeriod(plan.billingPeriod || 'MONTH');
    setPlanIsActive(plan.isActive !== false);
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
      priceOnetime: Number(planPriceOnetime),
      weightGrams: Number(planWeightGrams),
      imageUrl: planImageUrl || null,
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
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" /> Produk Master ({products.length})
              </h3>
            </div>
            <div className="space-y-2.5">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2.5 hover:border-slate-700 transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-xs text-white">{p.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {p.id} | Prefix: {p.prefix}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditProduct(p)}
                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
                        title="Edit Produk"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className="p-1.5 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 rounded-lg transition"
                        title="Hapus Produk"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Payment Gateway Mode Toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                    <span className="text-[10px] text-slate-400 font-medium">Gateway Mode:</span>
                    <button
                      type="button"
                      onClick={() => handleTogglePaymentMode(p)}
                      disabled={togglingId === p.id}
                      title="Klik untuk switch antara Live Production dan Sandbox"
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition ${
                        p.paymentMode === 'PRODUCTION'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 shadow-sm shadow-emerald-500/10'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
                      }`}
                    >
                      {togglingId === p.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : p.paymentMode === 'PRODUCTION' ? (
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <FlaskConical className="w-3 h-3 text-amber-400" />
                      )}
                      {p.paymentMode === 'PRODUCTION' ? 'LIVE PROD' : 'SANDBOX'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side: Plans Table */}
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="font-bold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" /> Katalog Paket (Plan) ({filteredPlans.length})
              </h3>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-[11px] text-slate-400 font-bold whitespace-nowrap">Filter Produk:</span>
                <select
                  value={filterProductId}
                  onChange={(e) => setFilterProductId(e.target.value)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">Semua Produk</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Info Paket</th>
                    <th className="py-3 px-4">Harga Unit / Bulanan / Tahunan</th>
                    <th className="py-3 px-4">Siklus</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredPlans.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">Belum ada paket plan terdaftar.</td>
                    </tr>
                  ) : (
                    filteredPlans.map(p => (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-10 h-10 object-contain rounded-lg bg-slate-950 border border-slate-800 p-1" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 font-bold text-[10px]">NO IMG</div>
                            )}
                            <div>
                              <div className="font-bold text-white text-xs">{p.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">ID: {p.id} | Module: {p.moduleId || '-'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {p.priceOnetime > 0 ? (
                            <div className="font-bold text-indigo-400">Rp {p.priceOnetime.toLocaleString('id-ID')} (Unit)</div>
                          ) : (
                            <div>
                              <span className="font-bold text-emerald-400">Rp {p.priceMonthly.toLocaleString('id-ID')}</span> <span className="text-[10px] text-slate-500">/bln</span>
                              <br />
                              <span className="text-[10px] text-slate-400">Rp {p.priceYearly.toLocaleString('id-ID')} /thn</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">{p.billingPeriod || 'MONTH'}</td>
                        <td className="py-3 px-4">
                          {p.isActive ? (
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[10px] font-bold">Aktif</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md text-[10px] font-bold">Nonaktif</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditPlan(p)}
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
                              title="Edit Plan"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePlan(p.id)}
                              className="p-1.5 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 rounded-lg transition"
                              title="Hapus Plan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── PRODUCT FORM VIEW ── */}
      {view === 'product-form' && (
        <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <h2 className="text-base font-bold text-white uppercase tracking-wider">
              {isEditingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
            </h2>
            <button onClick={() => setView('list')} className="text-slate-500 hover:text-slate-300">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSaveProduct} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">ID Produk (Kode Unik)</label>
              <input
                type="text"
                required
                disabled={isEditingProduct}
                placeholder="misal: cakola, absenta"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Nama Produk</label>
              <input
                type="text"
                required
                placeholder="misal: Cakola SaaS Platform"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Prefix Lisensi (2-3 Karakter)</label>
              <input
                type="text"
                required
                placeholder="misal: CKL, ABS"
                value={productPrefix}
                onChange={(e) => setProductPrefix(e.target.value.toUpperCase())}
                className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Payment Gateway Environment (Tripay)</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setProductPaymentMode('SANDBOX')}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition ${
                    productPaymentMode === 'SANDBOX'
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <FlaskConical className="w-4 h-4 mt-0.5 text-amber-400 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-white">SANDBOX (Test)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Simulasi pembayaran uji coba via Tripay Sandbox (Merchant T35062)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setProductPaymentMode('PRODUCTION')}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition ${
                    productPaymentMode === 'PRODUCTION'
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-white">LIVE PRODUCTION</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Transaksi pembayaran uang asli via Tripay Live (Merchant T35097)</div>
                  </div>
                </button>
              </div>
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
        <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <h2 className="text-base font-bold text-white uppercase tracking-wider">
              {isEditingPlan ? 'Edit Paket (Plan)' : 'Tambah Paket Baru'}
            </h2>
            <button onClick={() => setView('list')} className="text-slate-500 hover:text-slate-300">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSavePlan} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">ID Paket (Kode Unik Plan)</label>
                <input
                  type="text"
                  required
                  disabled={isEditingPlan}
                  placeholder="misal: HW_SERVER_NODE_SMALL"
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
                placeholder="misal: Absenta Node Server - Small (s/d 300 Siswa)"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* FOTO PRODUK UPLOAD / URL SECTION */}
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider">Foto / Gambar Produk</label>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {planImageUrl ? (
                  <div className="relative group w-20 h-20 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                    <img src={planImageUrl} alt="Preview" className="w-full h-full object-contain p-1" />
                    <button
                      type="button"
                      onClick={() => setPlanImageUrl('')}
                      className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                      title="Hapus Foto"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-slate-900 border border-dashed border-slate-700 rounded-xl shrink-0 flex flex-col items-center justify-center text-slate-500 text-[10px]">
                    <span>Belum ada</span>
                    <span>foto</span>
                  </div>
                )}

                <div className="flex-1 space-y-2 w-full">
                  <div className="flex items-center gap-2">
                    <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition inline-flex items-center gap-2">
                      <span>{isUploadingImage ? 'Mengunggah...' : '📷 Unggah Foto File'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        disabled={isUploadingImage}
                        className="hidden"
                      />
                    </label>
                    <span className="text-[10px] text-slate-500">Disimpan lokal di VPS (max 5MB)</span>
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="Atau masukkan URL Foto (https://...)"
                      value={planImageUrl}
                      onChange={(e) => setPlanImageUrl(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Harga Sekali Beli (Rp)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0 (isi untuk hardware)"
                  value={planPriceOnetime}
                  onChange={(e) => setPlanPriceOnetime(Number(e.target.value))}
                  className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Harga Bulanan (Rp)</label>
                <input
                  type="number"
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
                  min={0}
                  placeholder="0"
                  value={planPriceYearly}
                  onChange={(e) => setPlanPriceYearly(Number(e.target.value))}
                  className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Berat (Gram)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0 (misal: 1500)"
                  value={planWeightGrams}
                  onChange={(e) => setPlanWeightGrams(Number(e.target.value))}
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
                    <option value="ONETIME">Sekali Beli (ONETIME)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-3.5 text-slate-500 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Module ID Klien (Optional)</label>
                <input
                  type="text"
                  placeholder="misal: SERVER_HARDWARE, ABSENSI"
                  value={planModuleId}
                  onChange={(e) => setPlanModuleId(e.target.value)}
                  className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Service Code Klien (Optional)</label>
                <input
                  type="text"
                  placeholder="misal: SERVER_HARDWARE, ABSENSI"
                  value={planServiceCode}
                  onChange={(e) => setPlanServiceCode(e.target.value)}
                  className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Daftar Fitur / Spesifikasi (Satu per baris)</label>
              <textarea
                rows={5}
                placeholder="misal:&#10;Mini PC Industrial High-Efficiency&#10;Memory 8GB RAM + 128GB SSD&#10;Dual Gigabit LAN 24/7"
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
