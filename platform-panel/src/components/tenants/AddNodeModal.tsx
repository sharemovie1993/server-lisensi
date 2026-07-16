import React, { useState } from 'react';
import apiClient from '../../api/apiClient';
import type { Product } from '../../types/product';

interface AddNodeModalProps {
  show: boolean;
  packages: Product[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddNodeModal({ show, packages, onClose, onSuccess }: AddNodeModalProps) {
  const [schoolName, setSchoolName] = useState('');
  const [requestedSlug, setRequestedSlug] = useState('');
  const [packageId, setPackageId] = useState('');

  if (!show) return null;

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/api/admin/tenants', {
        schoolName,
        requestedSlug,
        packageId,
      });
      if (res.status === 201 || res.status === 200) {
        setSchoolName('');
        setRequestedSlug('');
        setPackageId('');
        onSuccess();
        onClose();
      }
    } catch (e) {
      alert('Gagal menambahkan sekolah baru');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <h3 className="text-white text-lg font-bold">Daftarkan Sekolah Baru</h3>
        <form onSubmit={handleAddTenant} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs font-semibold uppercase mb-1">Nama Sekolah</label>
            <input
              type="text"
              required
              placeholder="Contoh: SMK Negeri 1 Jakarta"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs font-semibold uppercase mb-1">Requested Slug / Subdomain</label>
            <input
              type="text"
              required
              placeholder="Contoh: smkn1jakarta"
              value={requestedSlug}
              onChange={(e) => setRequestedSlug(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs font-semibold uppercase mb-1">Pilih Produk</label>
            <select
              required
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Pilih Produk...</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  📦 {pkg.name} ({pkg.id})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-300 rounded-xl text-sm font-semibold transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25 transition"
            >
              Simpan Sekolah
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
