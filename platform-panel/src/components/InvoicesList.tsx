import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { DollarSign, CheckCircle2, ShieldAlert, CreditCard, RefreshCw, Eye, X, ExternalLink, Calendar, Info, Printer } from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string;
  license_id: string;
  school_name: string;
  product_id: string;
  plan_title: string;
  amount: number;
  status: string;
  payment_method: string;
  paid_at: string | null;
  created_at: string;
  payment_instructions?: any;
  payment_proof?: string | null;
  expired_time?: string;
}

export default function InvoicesList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invoicesRes, productsRes] = await Promise.all([
        apiClient.get('/api/admin/invoices'),
        apiClient.get('/api/admin/products')
      ]);
      setInvoices(invoicesRes.data?.data || invoicesRes.data || []);
      setProducts(productsRes.data?.data || []);
    } catch (e) {
      console.error('Failed to load invoices', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprovePayment = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin memproses persetujuan pembayaran tagihan ini secara manual?')) return;
    try {
      const res = await apiClient.post(`/api/admin/invoices/pay/${id}`);
      alert(res.data?.message || 'Invoice ditandai lunas.');
      loadData();
    } catch (e) {
      alert('Gagal menyetujui pembayaran.');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const filteredInvoices = invoices.filter(inv => {
    // Normalisasi alias lama: platform-absenta dan absenta → cakola
    const normalId = (inv.product_id === 'platform-absenta' || inv.product_id === 'absenta')
      ? 'cakola' : inv.product_id;
    return selectedProductId === 'all' || normalId === selectedProductId;
  });

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-white text-2xl font-bold">Tagihan & Keuangan (Invoices)</h2>
          <p className="text-slate-400 text-sm">Riwayat tagihan lisensi, status pembayaran, dan persetujuan manual.</p>
        </div>
        <button
          onClick={loadData}
          className="p-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-755 text-slate-300 rounded-xl transition"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* FILTER BY PRODUCT */}
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
                <th className="px-6 py-4">Nomor Invoice / Sekolah</th>
                <th className="px-6 py-4">Paket / Produk</th>
                <th className="px-6 py-4">Total Biaya</th>
                <th className="px-6 py-4">Metode Bayar</th>
                <th className="px-6 py-4">Tanggal Bayar</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300 text-sm">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    {loading ? 'Memuat data...' : 'Tidak ada tagihan terdaftar.'}
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-850/50 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{inv.invoice_number}</div>
                      <div className="text-slate-500 text-xs mt-0.5">{inv.school_name || inv.license_id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-300">{inv.plan_title}</div>
                      <div className="text-indigo-400 text-xs font-mono mt-0.5 uppercase">{inv.product_id}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-white">{formatCurrency(inv.amount)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs text-slate-400 font-medium">
                        <CreditCard className="w-3 h-3" />
                        {inv.payment_method || 'Gateway'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {inv.paid_at 
                        ? new Date(inv.paid_at).toLocaleDateString('id-ID', { dateStyle: 'medium' }) 
                        : 'Belum dibayar'}
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const statusLower = inv.status.toLowerCase();
                        if (statusLower === 'paid' || statusLower === 'lunas') {
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Lunas
                            </span>
                          );
                        } else if (statusLower === 'expired' || statusLower === 'cancelled') {
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-450 opacity-60">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Kedaluwarsa
                            </span>
                          );
                        } else {
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Pending
                            </span>
                          );
                        }
                      })()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 flex justify-end items-center">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="p-1.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
                        title="Lihat Detail Invoice"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Lihat Detail</span>
                      </button>
                      <a
                        href={`/api/license/print-invoice/${inv.invoice_number}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-slate-800 border border-slate-700 text-slate-350 rounded-lg hover:bg-slate-700 hover:text-white transition"
                        title="Cetak / Unduh PDF Invoice"
                      >
                        <Printer className="w-4 h-4" />
                      </a>
                      {inv.status !== 'paid' && inv.status !== 'PAID' && (inv.payment_method?.toLowerCase() === 'manual') && (
                        <button
                          onClick={() => handleApprovePayment(inv.id)}
                          className="px-2.5 py-1.5 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-600 hover:text-white transition text-xs font-semibold"
                        >
                          Setujui Manual
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in text-left">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative">
            <button 
              onClick={() => setSelectedInvoice(null)}
              className="absolute top-4 right-4 p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex justify-between items-start pt-2">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wide">Rincian Tagihan</span>
                <h3 className="text-white text-lg font-bold">{selectedInvoice.invoice_number}</h3>
              </div>
              
              {(() => {
                const statusLower = selectedInvoice.status.toLowerCase();
                if (statusLower === 'paid' || statusLower === 'lunas') {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Lunas
                    </span>
                  );
                } else if (statusLower === 'expired' || statusLower === 'cancelled') {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-400 opacity-70">
                      <ShieldAlert className="w-4 h-4 text-rose-550" /> Kedaluwarsa
                    </span>
                  );
                } else {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-400">
                      <ShieldAlert className="w-4 h-4 text-amber-500" /> Pending
                    </span>
                  );
                }
              })()}
            </div>

            <div className="bg-slate-955 p-4 rounded-xl border border-slate-850 space-y-3 bg-slate-950">
              <div className="grid grid-cols-2 gap-4 text-xs font-mono text-slate-400">
                <div>
                  <span className="text-slate-500 block text-[9.5px] uppercase font-sans font-bold">Sekolah / Tenant</span>
                  <span className="text-white text-sm font-semibold font-sans mt-0.5 block">{selectedInvoice.school_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px] uppercase font-sans font-bold">Metode Pembayaran</span>
                  <span className="text-slate-200 mt-0.5 block font-sans font-medium">{selectedInvoice.payment_method || 'Virtual Account / Transfer'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px] uppercase font-sans font-bold">Produk / Paket</span>
                  <span className="text-indigo-400 mt-0.5 block font-semibold">{selectedInvoice.plan_title} ({selectedInvoice.product_id?.toUpperCase()})</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px] uppercase font-sans font-bold">Total Pembayaran</span>
                  <span className="text-emerald-400 text-sm font-bold block mt-0.5">{formatCurrency(selectedInvoice.amount)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px] uppercase font-sans font-bold">Tanggal Tagihan</span>
                  <span className="text-slate-300 mt-0.5 block">{new Date(selectedInvoice.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
                {selectedInvoice.paid_at && (
                  <div>
                    <span className="text-slate-500 block text-[9.5px] uppercase font-sans font-bold">Tanggal Pembayaran</span>
                    <span className="text-slate-300 mt-0.5 block">{new Date(selectedInvoice.paid_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Instruction or Proof Section */}
            {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'PAID' ? (
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
                <span className="text-white font-bold block flex items-center gap-1.5 text-indigo-400">
                  <Info className="w-4 h-4" /> Petunjuk Pembayaran
                </span>
                
                {(() => {
                  let payInfo: any = null;
                  if (selectedInvoice.payment_instructions) {
                    try {
                      payInfo = typeof selectedInvoice.payment_instructions === 'string'
                        ? JSON.parse(selectedInvoice.payment_instructions)
                        : selectedInvoice.payment_instructions;
                    } catch (e) {
                      console.warn('Failed to parse payment instructions JSON', e);
                    }
                  }

                  const isManual = selectedInvoice.payment_method?.toLowerCase() === 'manual';

                  if (isManual) {
                    return (
                      <div className="space-y-3 text-left">
                        <p className="text-slate-400 leading-relaxed font-sans">
                          Silakan lakukan transfer manual sebesar <strong className="text-white font-mono">{formatCurrency(selectedInvoice.amount)}</strong> ke rekening pengelola berikut:
                        </p>
                        {payInfo ? (
                          <div className="p-3 bg-slate-950 rounded-lg border border-slate-850 space-y-1 font-mono text-[11.5px] text-slate-300">
                            {payInfo.bank_name && <div>Bank: <strong className="text-white">{payInfo.bank_name}</strong></div>}
                            {payInfo.account_number && (
                              <div className="flex justify-between items-center">
                                <span>No. Rekening: <strong className="text-emerald-400 font-bold select-all">{payInfo.account_number}</strong></span>
                              </div>
                            )}
                            {payInfo.account_holder && <div>Atas Nama: <strong className="text-white">{payInfo.account_holder}</strong></div>}
                          </div>
                        ) : (
                          <div className="p-3 bg-slate-950 rounded-lg border border-slate-850 text-slate-500 italic">
                            Detail rekening transfer tidak terlampir. Silakan hubungi admin.
                          </div>
                        )}
                        <p className="text-slate-500 text-[10.5px]">
                          Setelah transfer, kirimkan bukti pembayaran kepada operator/admin agar dapat disetujui secara manual.
                        </p>
                      </div>
                    );
                  }

                  if (payInfo) {
                    return (
                      <div className="space-y-3 text-left">
                        {payInfo.qr_url ? (
                          <div className="text-center py-2 bg-slate-950 rounded-lg border border-slate-850">
                            <span className="text-[10px] text-slate-500 block mb-1">SCAN QR CODE</span>
                            <img src={payInfo.qr_url} alt="QR Code" className="max-w-[150px] mx-auto rounded border border-white p-1 bg-white" />
                          </div>
                        ) : payInfo.pay_code ? (
                          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-850 text-center font-mono">
                            <span className="text-[9.5px] text-slate-500 block font-sans">KODE BAYAR / VIRTUAL ACCOUNT</span>
                            <span className="text-emerald-400 text-lg font-bold select-all tracking-wide mt-0.5 block">{payInfo.pay_code}</span>
                          </div>
                        ) : null}

                        {payInfo.instructions && payInfo.instructions.length > 0 && (
                          <div className="max-h-[150px] overflow-y-auto border border-slate-850 p-2.5 rounded-lg bg-slate-950 font-sans text-slate-450 leading-relaxed space-y-2">
                            {payInfo.instructions.map((inst: any, idx: number) => (
                              <div key={idx}>
                                <strong className="text-indigo-400 block mb-0.5">{idx + 1}. {inst.title}</strong>
                                <ol className="list-decimal pl-4 text-slate-400 space-y-0.5">
                                  {inst.steps.map((step: string, sIdx: number) => (
                                    <li key={sIdx} dangerouslySetInnerHTML={{ __html: step }}></li>
                                  ))}
                                </ol>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <p className="text-slate-400 leading-relaxed font-sans">
                      Lakukan pembayaran sesuai instruksi metode {selectedInvoice.payment_method || 'Gateway'}. Klik tombol di bawah untuk melunasi secara manual.
                    </p>
                  );
                })()}
              </div>
            ) : (
              selectedInvoice.payment_proof && (
                <div className="space-y-2">
                  <span className="text-slate-505 text-[10px] uppercase font-bold tracking-wide block">Bukti Pembayaran</span>
                  <a 
                    href={selectedInvoice.payment_proof} 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-4 py-2.5 bg-indigo-650/15 border border-indigo-500/25 hover:bg-indigo-650/30 text-indigo-300 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Buka Bukti Transfer Pembayaran</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <a
                href={`/api/license/print-invoice/${selectedInvoice.invoice_number}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak / PDF</span>
              </a>
              {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'PAID' && (() => {
                const isExpired = selectedInvoice.status.toLowerCase() === 'expired' || selectedInvoice.status.toLowerCase() === 'cancelled';
                return (
                  <button
                    onClick={() => {
                      handleApprovePayment(selectedInvoice.id);
                      setSelectedInvoice(null);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition ${
                      isExpired 
                        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20' 
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                    }`}
                  >
                    {isExpired ? 'Setujui & Aktifkan Ulang (Paksa)' : 'Setujui & Lunasi Sekarang'}
                  </button>
                );
              })()}
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}
      </div>
    </div>
  );
}
