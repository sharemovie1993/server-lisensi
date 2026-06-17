import { state } from './admin-state.js';
import { showPremiumDialog } from './admin-dialog.js';
import { renderAllCachedTables, loadQrisPreview } from './admin-render.js';

export function handleAuth(pin, code, authErrorMsg, authModal, onAuthSuccess) {
  if (!pin || !code) {
    authErrorMsg.textContent = '⚠️ PIN Admin dan Kode 2FA wajib diisi!';
    authErrorMsg.classList.remove('hidden');
    return;
  }
  authErrorMsg.classList.add('hidden');
  
  fetch(`${state.API_BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: pin, totp_code: code })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success && data.token) {
      state.ADMIN_SECRET = data.token;
      localStorage.setItem('@license_admin_secret', data.token);
      authModal.classList.add('hidden');
      if (onAuthSuccess) onAuthSuccess();
    } else {
      authErrorMsg.textContent = data.message || '⚠️ PIN Admin atau Kode 2FA tidak valid!';
      authErrorMsg.classList.remove('hidden');
    }
  })
  .catch(() => {
    authErrorMsg.textContent = '⚠️ Gagal terhubung ke API!';
    authErrorMsg.classList.remove('hidden');
  });
}

export function loadProducts(productFilterSelect, genProductId) {
  if (!state.ADMIN_SECRET) return Promise.resolve();

  return fetch(`${state.API_BASE}/api/admin/products`, {
    headers: { 'x-admin-secret': state.ADMIN_SECRET }
  })
  .then(res => res.json())
  .then(data => {
    if (data.success && data.data) {
      state.productsList = data.data;
      
      const filterVal = productFilterSelect.value;
      const genVal = genProductId.value;

      // Populate filter dropdown
      productFilterSelect.innerHTML = '<option value="all">🌐 SEMUA PRODUK / APLIKASI</option>';
      state.productsList.forEach(prod => {
        const icon = prod.id === 'absenta' ? '📅' : '🔒';
        const opt = document.createElement('option');
        opt.value = prod.id;
        opt.textContent = `${icon} ${prod.name}`;
        productFilterSelect.appendChild(opt);
      });
      if (filterVal && Array.from(productFilterSelect.options).some(o => o.value === filterVal)) {
        productFilterSelect.value = filterVal;
      } else {
        productFilterSelect.value = 'all';
      }

      // Populate generate form dropdown
      genProductId.innerHTML = '';
      state.productsList.forEach(prod => {
        const icon = prod.id === 'absenta' ? '📅' : '🔒';
        const opt = document.createElement('option');
        opt.value = prod.id;
        opt.textContent = `${icon} ${prod.name}`;
        genProductId.appendChild(opt);
      });
      if (genVal && Array.from(genProductId.options).some(o => o.value === genVal)) {
        genProductId.value = genVal;
      } else if (state.productsList.length > 0) {
        genProductId.value = state.productsList[0].id;
      }
    }
  })
  .catch(err => {
    console.error('Failed to load products from database:', err);
  });
}

export function loadTenants(genTenantId) {
  if (!state.ADMIN_SECRET) return Promise.resolve();
  if (!genTenantId) return Promise.resolve();

  genTenantId.innerHTML = '<option value="">⏳ Memuat tenant...</option>';

  return fetch(`${state.API_BASE}/api/admin/tenants`, {
    headers: { 'x-admin-secret': state.ADMIN_SECRET }
  })
  .then(res => res.json())
  .then(data => {
    if (data.success && data.data) {
      state.tenantsList = data.data;
      genTenantId.innerHTML = '<option value="">-- Hubungkan dengan Tenant Baru / Tidak Ada --</option>';
      state.tenantsList.forEach(tenant => {
        const opt = document.createElement('option');
        opt.value = tenant.id;
        opt.dataset.name = tenant.name;
        opt.textContent = `${tenant.name} (${tenant.domain_or_slug})`;
        genTenantId.appendChild(opt);
      });
    } else {
      genTenantId.innerHTML = '<option value="">⚠️ Gagal memuat tenant</option>';
    }
  })
  .catch(err => {
    console.error('Failed to load tenants:', err);
    genTenantId.innerHTML = '<option value="">⚠️ Kesalahan memuat tenant</option>';
  });
}

export function loadAllData(renderAllCachedTables, loadPackagesConfig, updateRevenueStats, logoutCallback) {
  if (!state.ADMIN_SECRET) return;

  fetch(`${state.API_BASE}/api/license/list`, {
    headers: { 'x-admin-secret': state.ADMIN_SECRET }
  })
  .then(res => {
    if (res.status === 401) {
      if (logoutCallback) logoutCallback();
      throw new Error('Sesi login telah berakhir');
    }
    return res.json();
  })
  .then(data => {
    if (!data.success) {
      console.warn('[LICENSES API ERROR]', data.message);
      return;
    }
    state.activeLicensesCache = data.data || [];
    renderAllCachedTables();
    loadPackagesConfig();
  })
  .catch(err => console.error('[LICENSES FETCH ERROR]', err));

  // 2. Fetch SaaS Revenue Analytics
  fetch(`${state.API_BASE}/api/admin/revenue`, {
    headers: { 'x-admin-secret': state.ADMIN_SECRET }
  })
  .then(res => res.json())
  .then(revRes => {
    if (revRes.success && revRes.data) {
      state.revenueCache = revRes.data;
      updateRevenueStats();
    }
  })
  .catch(e => console.error('[REVENUE FETCH ERROR]', e));

  // 3. Fetch Subscriptions List
  fetch(`${state.API_BASE}/api/admin/subscriptions`, {
    headers: { 'x-admin-secret': state.ADMIN_SECRET }
  })
  .then(res => res.json())
  .then(subRes => {
    if (subRes.success && subRes.data) {
      state.subscriptionsCache = subRes.data;
      renderAllCachedTables();
    }
  })
  .catch(e => console.error('[SUBSCRIPTIONS FETCH ERROR]', e));

  // 4. Fetch Invoices List
  fetch(`${state.API_BASE}/api/admin/invoices`, {
    headers: { 'x-admin-secret': state.ADMIN_SECRET }
  })
  .then(res => res.json())
  .then(invRes => {
    if (invRes.success && invRes.data) {
      state.invoicesCache = invRes.data;
      renderAllCachedTables();
    }
  })
  .catch(e => console.error('[INVOICES FETCH ERROR]', e));

  // 5. Fetch Supabase Tenants List
  loadSupabaseTenants();
}

export function loadSupabaseTenants(onComplete) {
  if (!state.ADMIN_SECRET) return;

  const tenantsTableBody = document.getElementById('tenantsTableBody');
  if (state.tenantsDataCache.length === 0 && tenantsTableBody) {
    tenantsTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-slate-500 font-medium">Menghubungkan & Mensinkronkan Database Supabase...</td>
      </tr>
    `;
  }

  fetch(`${state.API_BASE}/api/admin/tenants`, {
    headers: { 'x-admin-secret': state.ADMIN_SECRET }
  })
  .then(res => res.json())
  .then(data => {
    if (data.success && data.data) {
      state.tenantsDataCache = data.data;
      renderAllCachedTables();
      if (onComplete) onComplete();
    }
  })
  .catch(err => {
    console.error('Failed to load Supabase tenants:', err);
    if (tenantsTableBody) {
      tenantsTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="p-8 text-center text-red-500 font-bold text-xs uppercase">
            ⚠️ Gagal tersambung dengan Supabase Cloud.
          </td>
        </tr>
      `;
    }
  });
}

export function loadActivityLogs(renderAllCachedTables) {
  if (!state.ADMIN_SECRET) return;
  
  const logsTableBody = document.getElementById('logsTableBody');
  if (state.logsCache.length === 0 && logsTableBody) {
    logsTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-slate-500 font-medium">Memuat log aktivitas...</td>
      </tr>
    `;
  }

  fetch(`${state.API_BASE}/api/admin/logs`, {
    headers: { 'x-admin-secret': state.ADMIN_SECRET }
  })
  .then(res => res.json())
  .then(data => {
    if (data.success && data.data) {
      state.logsCache = data.data;
      renderAllCachedTables();
    }
  })
  .catch(err => {
    console.error('Failed to load logs:', err);
    if (logsTableBody) {
      logsTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="p-8 text-center text-red-500 font-bold text-xs uppercase">
            ⚠️ Gagal mengambil log dari server.
          </td>
        </tr>
      `;
    }
  });
}

export function manuallyPayInvoice(invoiceId, onComplete) {
  showPremiumDialog({
    type: 'confirm',
    title: 'Konfirmasi Pembayaran',
    message: 'Apakah Anda yakin ingin memproses persetujuan pembayaran tagihan ini secara manual? Masa aktif lisensi akan langsung diaktifkan.',
    onConfirm: () => {
      fetch(`${state.API_BASE}/api/admin/invoices/pay/${invoiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': state.ADMIN_SECRET
        }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showPremiumDialog({
            type: 'success',
            title: 'Pembayaran Diterima',
            message: data.message
          });
          if (onComplete) onComplete();
        } else {
          showPremiumDialog({
            type: 'error',
            title: 'Pembayaran Gagal',
            message: data.message
          });
        }
      })
      .catch(e => {
        console.error(e);
        showPremiumDialog({
          type: 'error',
          title: 'Kesalahan Sistem',
          message: 'Gagal terhubung dengan server lisensi.'
        });
      });
    }
  });
}

export function approveLicense(id, onComplete) {
  showPremiumDialog({
    type: 'confirm',
    title: 'Setujui Lisensi',
    message: 'Apakah Anda yakin ingin menyetujui lisensi sekolah ini? Status akan diaktifkan secara instan.',
    onConfirm: () => {
      fetch(`${state.API_BASE}/api/license/approve/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': state.ADMIN_SECRET
        }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (onComplete) onComplete();
          showPremiumDialog({
            type: 'success',
            title: 'Aktivasi Berhasil',
            message: data.message
          });
        } else {
          showPremiumDialog({
            type: 'error',
            title: 'Gagal Menyetujui',
            message: data.message
          });
        }
      })
      .catch(() => {
        showPremiumDialog({
          type: 'error',
          title: 'Kesalahan Jaringan',
          message: 'Terjadi kesalahan saat menghubungi server.'
        });
      });
    }
  });
}

export function deleteLicense(id, onComplete) {
  showPremiumDialog({
    type: 'confirm',
    title: 'Hapus Lisensi',
    message: 'Apakah Anda yakin ingin menghapus lisensi ini secara permanen? Perangkat yang terhubung akan langsung terblokir.',
    onConfirm: () => {
      fetch(`${state.API_BASE}/api/license/delete/${id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-secret': state.ADMIN_SECRET
        }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (onComplete) onComplete();
          showPremiumDialog({
            type: 'success',
            title: 'Berhasil Dihapus',
            message: data.message
          });
        } else {
          showPremiumDialog({
            type: 'error',
            title: 'Gagal Menghapus',
            message: data.message
          });
        }
      })
      .catch(() => {
        showPremiumDialog({
          type: 'error',
          title: 'Kesalahan Jaringan',
          message: 'Terjadi kesalahan saat menghubungi server.'
        });
      });
    }
  });
}

export function generateLicense(payload, generateModal, generateForm, onComplete) {
  fetch(`${state.API_BASE}/api/license/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': state.ADMIN_SECRET
    },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      generateModal.classList.add('hidden');
      generateForm.reset();
      if (onComplete) onComplete();
      showPremiumDialog({
        type: 'success',
        title: 'Lisensi Dibuat',
        message: `Kunci lisensi manual berhasil dibuat:\n${data.data.license_key}`
      });
    } else {
      showPremiumDialog({
        type: 'error',
        title: 'Gagal Membuat',
        message: data.message
      });
    }
  })
  .catch(() => {
    showPremiumDialog({
      type: 'error',
      title: 'Kesalahan Jaringan',
      message: 'Gagal menghubungi server untuk membuat lisensi.'
    });
  });
}

export function loadPackagesConfig(productFilterSelect, renderPackagesConfig) {
  if (!state.ADMIN_SECRET) return;

  const selectedProd = productFilterSelect.value;
  const reqProd = selectedProd === 'all' ? 'gform-orkestrator' : selectedProd;

  fetch(`${state.API_BASE}/api/license/packages?product_id=${reqProd}`)
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      state.packagesDataCache = data.data || [];
      renderPackagesConfig(state.packagesDataCache);
    }
  })
  .catch(err => console.error('Gagal memuat paket harga:', err));
}

export function updatePackage(id, payload, editPackageModal, onComplete) {
  fetch(`${state.API_BASE}/api/admin/packages/${id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': state.ADMIN_SECRET
    },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      editPackageModal.classList.add('hidden');
      if (onComplete) onComplete();
      showPremiumDialog({
        type: 'success',
        title: 'Paket Diperbarui',
        message: data.message
      });
    } else {
      showPremiumDialog({
        type: 'error',
        title: 'Gagal Menyimpan',
        message: data.message
      });
    }
  })
  .catch(() => {
    showPremiumDialog({
      type: 'error',
      title: 'Kesalahan Jaringan',
      message: 'Gagal menghubungi server untuk memperbarui paket harga.'
    });
  });
}

export function createPackage(payload, addPackageModal, addPackageForm, onComplete) {
  fetch(`${state.API_BASE}/api/admin/packages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': state.ADMIN_SECRET
    },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      addPackageModal.classList.add('hidden');
      addPackageForm.reset();
      if (onComplete) onComplete();
      showPremiumDialog({
        type: 'success',
        title: 'Paket Ditambahkan',
        message: data.message
      });
    } else {
      showPremiumDialog({
        type: 'error',
        title: 'Gagal Membuat Paket',
        message: data.message
      });
    }
  })
  .catch(() => {
    showPremiumDialog({
      type: 'error',
      title: 'Kesalahan Jaringan',
      message: 'Gagal menghubungi server untuk membuat paket baru.'
    });
  });
}

export function deletePackage(id, onComplete) {
  showPremiumDialog({
    type: 'confirm',
    title: 'Hapus Paket Harga',
    message: 'Apakah Anda yakin ingin menghapus paket harga ini secara permanen? Aksi ini tidak dapat dibatalkan.',
    onConfirm: () => {
      fetch(`${state.API_BASE}/api/admin/packages/${id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-secret': state.ADMIN_SECRET
        }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (onComplete) onComplete();
          showPremiumDialog({
            type: 'success',
            title: 'Paket Dihapus',
            message: data.message
          });
        } else {
          showPremiumDialog({
            type: 'error',
            title: 'Gagal Menghapus',
            message: data.message
          });
        }
      })
      .catch(() => {
        showPremiumDialog({
          type: 'error',
          title: 'Kesalahan Jaringan',
          message: 'Terjadi kesalahan saat menghubungi server.'
        });
      });
    }
  });
}

export function uploadInvoiceProof(invoiceId, imageBase64, onComplete) {
  if (!invoiceId || !imageBase64) {
    console.error('Missing invoiceId or image data');
    return;
  }
  fetch(`${state.API_BASE}/api/admin/invoices/upload-proof/${invoiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': state.ADMIN_SECRET
    },
    body: JSON.stringify({ image: imageBase64 })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showPremiumDialog({
          type: 'success',
          title: 'Bukti Pembayaran Diunggah',
          message: data.message
        });
        if (onComplete) onComplete(data);
      } else {
        showPremiumDialog({
          type: 'error',
          title: 'Gagal Unggah Bukti',
          message: data.message || 'Tidak dapat mengunggah bukti pembayaran.'
        });
      }
    })
    .catch(() => {
      showPremiumDialog({
        type: 'error',
        title: 'Kesalahan Jaringan',
        message: 'Gagal menghubungi server untuk mengunggah bukti.'
      });
    });
}

export function uploadQris(selectedQrisBase64, uploadQrisBtn, qrisStatusOverlay, onComplete) {
  if (!selectedQrisBase64 || !state.ADMIN_SECRET) return;

  qrisStatusOverlay.classList.remove('opacity-0', 'pointer-events-none');
  uploadQrisBtn.disabled = true;
  uploadQrisBtn.className = "w-full bg-blue-600/50 cursor-not-allowed text-slate-400 font-bold py-3 rounded-xl text-xs tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2";

  fetch(`${state.API_BASE}/api/admin/qris`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': state.ADMIN_SECRET
    },
    body: JSON.stringify({ image: selectedQrisBase64 })
  })
  .then(res => res.json())
  .then(data => {
    qrisStatusOverlay.classList.add('opacity-0', 'pointer-events-none');
    
    if (data.success) {
      showPremiumDialog({
        type: 'success',
        title: 'QRIS Diperbarui',
        message: 'Gambar QRIS Merchant Anda berhasil diunggah dan disimpan ke server secara dinamis!'
      });
      loadQrisPreview();
      if (onComplete) onComplete();
    } else {
      showPremiumDialog({
        type: 'error',
        title: 'Gagal Mengunggah',
        message: data.message
      });
      uploadQrisBtn.disabled = false;
      uploadQrisBtn.className = "w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-xs tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer";
    }
  })
  .catch(() => {
    qrisStatusOverlay.classList.add('opacity-0', 'pointer-events-none');
    showPremiumDialog({
      type: 'error',
      title: 'Kesalahan Jaringan',
      message: 'Gagal mengunggah gambar QRIS. Pastikan server aktif.'
    });
    uploadQrisBtn.disabled = false;
    uploadQrisBtn.className = "w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-xs tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer";
  });
}

export function loadSystemSettings(onComplete) {
  if (!state.ADMIN_SECRET) return;

  fetch(`${state.API_BASE}/api/admin/settings`, {
    headers: { 'x-admin-secret': state.ADMIN_SECRET }
  })
  .then(res => res.json())
  .then(data => {
    if (data.success && data.data) {
      state.systemSettingsCache = data.data;
      if (onComplete) onComplete(data.data);
    }
  })
  .catch(err => console.error('Failed to load system settings:', err));
}

export function saveSystemSettings(payload, onComplete) {
  if (!state.ADMIN_SECRET) return;

  fetch(`${state.API_BASE}/api/admin/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': state.ADMIN_SECRET
    },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showPremiumDialog({
        type: 'success',
        title: 'Pengaturan Disimpan',
        message: data.message || 'Konfigurasi sistem pembayaran berhasil diperbarui!'
      });
      if (onComplete) onComplete();
    } else {
      showPremiumDialog({
        type: 'error',
        title: 'Gagal Menyimpan',
        message: data.message
      });
    }
  })
  .catch(() => {
    showPremiumDialog({
      type: 'error',
      title: 'Kesalahan Jaringan',
      message: 'Gagal terhubung dengan server lisensi.'
    });
  });
}

export async function forceRestartSystem() {
  if (!state.ADMIN_SECRET) return;
  
  try {
    const res = await fetch(`${state.API_BASE}/api/admin/restart`, {
      method: 'POST',
      headers: { 'x-admin-secret': state.ADMIN_SECRET }
    });
    const data = await res.json();
    return data;
  } catch (err) {
    throw new Error('Gagal menghubungi server: ' + err.message);
  }
}
