import { state } from './modules/admin-state.js';
import { showPremiumDialog, closePremiumDialog } from './modules/admin-dialog.js';
import {
  handleAuth,
  loadProducts,
  loadTenants,
  loadAllData,
  loadActivityLogs,
  loadSupabaseTenants,
  manuallyPayInvoice,
  approveLicense,
  deleteLicense,
  generateLicense,
  loadPackagesConfig,
  updatePackage,
  createPackage,
  deletePackage,
  loadSystemSettings,
  saveSystemSettings,
  uploadQris,
  uploadInvoiceProof,
  forceRestartSystem,
  loadWAStatus,
  loadWAQR,
  reconnectWA,
  sendTestWA
} from './modules/admin-api.js';
import {
  renderAllCachedTables,
  renderPackagesConfig,
  printInvoice,
  switchTab,
  updateRevenueStats,
  renderSidebarMenu
} from './modules/admin-render.js?v=1.0.4';

// Setup global functions for legacy inline HTML handlers
let waPollInterval = null;

function loadWAStatusUI() {
  window.checkWAStatus();
  if (waPollInterval) clearInterval(waPollInterval);
  waPollInterval = setInterval(window.checkWAStatus, 5000);
}

window.switchTab = (tabId) => {
  switchTab(tabId);
  if (tabId !== 'tab-wa' && waPollInterval) {
    clearInterval(waPollInterval);
    waPollInterval = null;
  }

  if (tabId === 'tab-logs') {
    loadActivityLogs(renderAllCachedTables);
  } else if (tabId === 'tab-tenants') {
    loadSupabaseTenants(renderAllCachedTables);
  } else if (tabId === 'tab-settings') {
    loadSettingsUI();
  } else if (tabId === 'tab-wa') {
    loadWAStatusUI();
  }
};

window.checkWAStatus = () => {
  if (!state.ADMIN_SECRET) return;
  loadWAStatus((data) => {
    const badge = document.getElementById('waStatusBadge');
    const numContainer = document.getElementById('waConnectedNumberContainer');
    const botNum = document.getElementById('waConnectedNumber');
    const qrContainer = document.getElementById('waQrContainer');
    const reconnectBtn = document.getElementById('waReconnectBtn');
    
    if (!badge) return;

    if (data.status === 'connected') {
      badge.className = "px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      badge.textContent = "● TERHUBUNG";
      
      if (numContainer && botNum) {
        numContainer.classList.remove('hidden');
        botNum.textContent = data.number || 'N/A';
      }
      
      if (qrContainer) {
        qrContainer.innerHTML = '<div class="text-xs text-emerald-500 font-bold uppercase">WhatsApp Terhubung!</div>';
      }
      if (reconnectBtn) {
        reconnectBtn.textContent = "🔌 Putuskan Sesi (Logout)";
        reconnectBtn.className = "w-full bg-rose-600 hover:bg-rose-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider transition-all duration-300 shadow-md shadow-rose-500/20 cursor-pointer";
      }
    } else if (data.status === 'connecting') {
      badge.className = "px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-center bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse";
      badge.textContent = "● MENGHUBUNGKAN...";
      
      if (numContainer) numContainer.classList.add('hidden');
      
      if (data.has_qr) {
        // Load QR Code
        loadWAQR((qrData) => {
          if (qrData.success && qrData.qr && qrContainer) {
            qrContainer.innerHTML = `<img src="${qrData.qr}" class="w-full h-full object-contain" alt="WA QR">`;
          }
        });
      } else {
        if (qrContainer) {
          qrContainer.innerHTML = '<div class="text-xs text-slate-500 font-bold uppercase animate-pulse">Menghasilkan QR...</div>';
        }
      }
      if (reconnectBtn) {
        reconnectBtn.textContent = "🔌 Hubungkan Ulang (Scan Ulang)";
        reconnectBtn.className = "w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider transition-all duration-300 shadow-md shadow-blue-500/20 cursor-pointer";
      }
    } else {
      badge.className = "px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-center bg-rose-500/10 text-rose-400 border border-rose-500/20";
      badge.textContent = "● TERPUTUS";
      
      if (numContainer) numContainer.classList.add('hidden');
      if (qrContainer) {
        qrContainer.innerHTML = '<div class="text-xs text-slate-500 font-bold uppercase">QR Code Tidak Tersedia. Silakan Reconnect.</div>';
      }
      if (reconnectBtn) {
        reconnectBtn.textContent = "🔌 Hubungkan Ulang (Scan Ulang)";
        reconnectBtn.className = "w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider transition-all duration-300 shadow-md shadow-blue-500/20 cursor-pointer";
      }
    }
  });
};

window.runWAReconnect = () => {
  const btn = document.getElementById('waReconnectBtn');
  if (btn) btn.disabled = true;
  reconnectWA((res) => {
    if (btn) btn.disabled = false;
    if (res.success) {
      showPremiumDialog({
        type: 'success',
        title: 'Koneksi Direset',
        message: 'WhatsApp Gateway berhasil direset. Silakan scan QR Code baru.'
      });
      window.checkWAStatus();
    } else {
      showPremiumDialog({
        type: 'error',
        title: 'Reset Gagal',
        message: res.message
      });
    }
  });
};

window.runWASendTest = () => {
  const numberInput = document.getElementById('waTestNumber');
  const messageInput = document.getElementById('waTestMessage');
  const btn = document.getElementById('waSendTestBtn');
  
  if (!numberInput || !messageInput) return;
  
  const nomor = numberInput.value.trim();
  const pesan = messageInput.value.trim();
  
  if (!nomor || !pesan) {
    showPremiumDialog({
      type: 'error',
      title: 'Validasi Gagal',
      message: 'Nomor tujuan dan pesan wajib diisi!'
    });
    return;
  }
  
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Mengirim...';
  }
  
  sendTestWA(nomor, pesan, (res) => {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✉️ Kirim Pesan Test';
    }
    
    if (res.success) {
      showPremiumDialog({
        type: 'success',
        title: 'Pesan Terkirim',
        message: res.message
      });
      messageInput.value = '';
    } else {
      showPremiumDialog({
        type: 'error',
        title: 'Gagal Kirim',
        message: res.message
      });
    }
  });
};

function loadSettingsUI() {
  loadSystemSettings((settings) => {
    if (document.getElementById('setactive_gateway')) {
      document.getElementById('setactive_gateway').value = settings.active_gateway || 'tripay';
      document.getElementById('setmanual_payment_enabled').value = settings.manual_payment_enabled || '1';
      document.getElementById('setmanual_bank_name').value = settings.manual_bank_name || '';
      document.getElementById('setmanual_account_number').value = settings.manual_account_number || '';
      document.getElementById('setmanual_account_name').value = settings.manual_account_name || '';
      document.getElementById('setwhatsapp_number').value = settings.whatsapp_number || '';
      
      const adminQrisPreview = document.getElementById('adminQrisPreview');
      if (adminQrisPreview) {
        adminQrisPreview.src = `/qris.png?t=${Date.now()}`;
      }
    }
  });
}

window.loadActivityLogs = () => loadActivityLogs(renderAllCachedTables);
window.loadSupabaseTenants = () => loadSupabaseTenants(renderAllCachedTables);
window.manuallyPayInvoice = (invoiceId) => {
  const productFilterSelect = document.getElementById('productFilterSelect');
  manuallyPayInvoice(invoiceId, () => {
    loadAllData(renderAllCachedTables, () => loadPackagesConfig(productFilterSelect, renderPackagesConfig), updateRevenueStats, logout);
  });
};
window.approveLicense = (id) => {
  const productFilterSelect = document.getElementById('productFilterSelect');
  approveLicense(id, () => {
    loadAllData(renderAllCachedTables, () => loadPackagesConfig(productFilterSelect, renderPackagesConfig), updateRevenueStats, logout);
  });
};
window.deleteLicense = (id) => {
  const productFilterSelect = document.getElementById('productFilterSelect');
  deleteLicense(id, () => {
    loadAllData(renderAllCachedTables, () => loadPackagesConfig(productFilterSelect, renderPackagesConfig), updateRevenueStats, logout);
  });
};
window.printInvoice = printInvoice;
window.openEditPackageModal = (id) => {
  const pkg = state.packagesDataCache.find(p => p.id === id);
  if (!pkg) return;

  document.getElementById('editPkgId').value = pkg.id;
  document.getElementById('editPkgTitle').value = pkg.title;
  document.getElementById('editPkgBadge').value = pkg.badge || '';
  document.getElementById('editPkgPrice').value = pkg.price;
  document.getElementById('editPkgDuration').value = pkg.duration;
  document.getElementById('editPkgDeviceLimit').value = pkg.device_limit;
  document.getElementById('editPkgProductId').value = pkg.product_id || '';
  document.getElementById('editPkgIsUnlimited').checked = !!pkg.is_unlimited;

  document.getElementById('editPackageModal').classList.remove('hidden');
};
window.deletePackage = (id, title) => {
  const productFilterSelect = document.getElementById('productFilterSelect');
  deletePackage(id, () => {
    loadPackagesConfig(productFilterSelect, renderPackagesConfig);
  });
};

function logout() {
  localStorage.removeItem('@license_admin_secret');
  state.ADMIN_SECRET = '';
  document.getElementById('adminPinInput').value = '';
  document.getElementById('admin2faInput').value = '';
  document.getElementById('authModal').classList.remove('hidden');
  if (state.dataPollInterval) {
    clearInterval(state.dataPollInterval);
    state.dataPollInterval = null;
  }
}

function startDataPolling() {
  if (state.dataPollInterval) clearInterval(state.dataPollInterval);
  
  const productFilterSelect = document.getElementById('productFilterSelect');
  
  loadAllData(renderAllCachedTables, () => loadPackagesConfig(productFilterSelect, renderPackagesConfig), updateRevenueStats, logout);
  
  state.dataPollInterval = setInterval(() => {
    if (state.ADMIN_SECRET) {
      loadAllData(renderAllCachedTables, () => loadPackagesConfig(productFilterSelect, renderPackagesConfig), updateRevenueStats, logout);
    }
  }, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
  renderSidebarMenu();
  const productFilterSelect = document.getElementById('productFilterSelect');
  const genProductId = document.getElementById('genProductId');
  const globalSearchInput = document.getElementById('globalSearchInput');
  const genTenantId = document.getElementById('genTenantId');
  const genSchoolName = document.getElementById('genSchoolName');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const adminPinInput = document.getElementById('adminPinInput');
  const admin2faInput = document.getElementById('admin2faInput');
  const authModal = document.getElementById('authModal');
  const authErrorMsg = document.getElementById('authErrorMsg');
  const logoutBtn = document.getElementById('logoutBtn');
  const openGenerateModalBtn = document.getElementById('openGenerateModalBtn');
  const generateModal = document.getElementById('generateModal');
  const closeGenerateModalBtn = document.getElementById('closeGenerateModalBtn');
  const generateForm = document.getElementById('generateForm');
  const editPackageModal = document.getElementById('editPackageModal');
  const closeEditPackageModalBtn = document.getElementById('closeEditPackageModalBtn');
  const editPackageForm = document.getElementById('editPackageForm');
  const addPackageModal = document.getElementById('addPackageModal');
  const openAddPackageModalBtn = document.getElementById('openAddPackageModalBtn');
  const closeAddPackageModalBtn = document.getElementById('closeAddPackageModalBtn');
  const addPackageForm = document.getElementById('addPackageForm');
  const forceRestartBtn = document.getElementById('forceRestartBtn');

  // Event Listeners
  productFilterSelect.addEventListener('change', () => {
    loadAllData(renderAllCachedTables, () => loadPackagesConfig(productFilterSelect, renderPackagesConfig), updateRevenueStats, logout);
    if (!document.getElementById('tab-logs').classList.contains('hidden')) {
      loadActivityLogs(renderAllCachedTables);
    }
  });

  globalSearchInput.addEventListener('input', () => {
    renderAllCachedTables();
  });

  if (genTenantId && genSchoolName) {
    genTenantId.addEventListener('change', () => {
      const selectedOption = genTenantId.options[genTenantId.selectedIndex];
      if (genTenantId.value) {
        genSchoolName.value = selectedOption.dataset.name || '';
      } else {
        genSchoolName.value = '';
      }
    });
  }

  if (forceRestartBtn) {
    forceRestartBtn.addEventListener('click', async () => {
      const confirmed = window.confirm(
        '⚠️ PERINGATAN: Apakah Anda yakin ingin merestart Server Lisensi?\n\n' +
        'Koneksi API akan terputus selama beberapa detik. Pastikan tidak ada transaksi penting yang sedang berjalan.'
      );
      if (!confirmed) return;

      forceRestartBtn.disabled = true;
      forceRestartBtn.textContent = '⏳ Merestart...';

      try {
        const res = await forceRestartSystem();
        if (res.success) {
          alert('✅ Perintah terkirim. Halaman akan disegarkan dalam 5 detik.');
          setTimeout(() => {
            window.location.reload();
          }, 5000);
        } else {
          alert('❌ Gagal: ' + res.message);
          forceRestartBtn.disabled = false;
          forceRestartBtn.textContent = '⚡ Paksa Restart Server';
        }
      } catch (err) {
        alert('❌ Terjadi kesalahan: ' + err.message);
        forceRestartBtn.disabled = false;
        forceRestartBtn.textContent = '⚡ Paksa Restart Server';
      }
    });
  }

  // Auth actions
  const attemptAuth = () => {
    handleAuth(
      adminPinInput.value.trim(),
      admin2faInput.value.trim(),
      authErrorMsg,
      authModal,
      () => {
        adminPinInput.value = '';
        admin2faInput.value = '';
        loadProducts(productFilterSelect, genProductId).then(() => {
          startDataPolling();
          loadPackagesConfig(productFilterSelect, renderPackagesConfig);
        });
      }
    );
  };

  authSubmitBtn.addEventListener('click', attemptAuth);
  adminPinInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') admin2faInput.focus(); });
  admin2faInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') attemptAuth(); });

  logoutBtn.addEventListener('click', logout);

  // Modal UI handling
  openGenerateModalBtn.addEventListener('click', () => {
    loadTenants(genTenantId);
    generateModal.classList.remove('hidden');
  });
  closeGenerateModalBtn.addEventListener('click', () => generateModal.classList.add('hidden'));
  window.addEventListener('click', (e) => { if (e.target === generateModal) generateModal.classList.add('hidden'); });

  // Generate Manual Form submission
  generateForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const payload = {
      school_name: document.getElementById('genSchoolName').value.trim(),
      device_limit: document.getElementById('genDeviceLimit').value,
      duration_days: document.getElementById('genDurationDays').value,
      product_id: document.getElementById('genProductId').value,
      tenant_id: document.getElementById('genTenantId').value || null
    };
    generateLicense(payload, generateModal, generateForm, () => {
      loadAllData(renderAllCachedTables, () => loadPackagesConfig(productFilterSelect, renderPackagesConfig), updateRevenueStats, logout);
    });
  });

  // Package Edit UI Modal Close
  closeEditPackageModalBtn.addEventListener('click', () => editPackageModal.classList.add('hidden'));
  window.addEventListener('click', (e) => { if (e.target === editPackageModal) editPackageModal.classList.add('hidden'); });

  // Submit Edited Package Form
  editPackageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('editPkgId').value;
    const payload = {
      title: document.getElementById('editPkgTitle').value.trim(),
      badge: document.getElementById('editPkgBadge').value.trim() || null,
      price: document.getElementById('editPkgPrice').value.trim(),
      duration: document.getElementById('editPkgDuration').value.trim(),
      device_limit: document.getElementById('editPkgDeviceLimit').value,
      product_id: document.getElementById('editPkgProductId').value,
      is_unlimited: document.getElementById('editPkgIsUnlimited').checked ? 1 : 0
    };
    updatePackage(id, payload, editPackageModal, () => {
      loadPackagesConfig(productFilterSelect, renderPackagesConfig);
    });
  });

  // Add Package Modal
  if (openAddPackageModalBtn && addPackageModal && closeAddPackageModalBtn && addPackageForm) {
    openAddPackageModalBtn.addEventListener('click', () => addPackageModal.classList.remove('hidden'));
    closeAddPackageModalBtn.addEventListener('click', () => {
      addPackageModal.classList.add('hidden');
      addPackageForm.reset();
    });
    window.addEventListener('click', (e) => { if (e.target === addPackageModal) { addPackageModal.classList.add('hidden'); addPackageForm.reset(); } });

    addPackageForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const payload = {
        product_id: document.getElementById('addPkgProductId').value,
        title: document.getElementById('addPkgTitle').value.trim(),
        badge: document.getElementById('addPkgBadge').value.trim() || null,
        price: document.getElementById('addPkgPrice').value.trim(),
        duration: document.getElementById('addPkgDuration').value.trim(),
        device_limit: parseInt(document.getElementById('addPkgDeviceLimit').value) || 1,
        is_unlimited: document.getElementById('addPkgIsUnlimited').checked ? 1 : 0,
        sort_order: parseInt(document.getElementById('addPkgSortOrder').value) || 0
      };
      createPackage(payload, addPackageModal, addPackageForm, () => {
        loadPackagesConfig(productFilterSelect, renderPackagesConfig);
      });
    });
  }

  // System Settings Form
  const systemSettingsForm = document.getElementById('systemSettingsForm');
  if (systemSettingsForm) {
    systemSettingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const payload = {
        active_gateway: document.getElementById('setactive_gateway').value,
        manual_payment_enabled: document.getElementById('setmanual_payment_enabled').value,
        manual_bank_name: document.getElementById('setmanual_bank_name').value.trim(),
        manual_account_number: document.getElementById('setmanual_account_number').value.trim(),
        manual_account_name: document.getElementById('setmanual_account_name').value.trim(),
        whatsapp_number: document.getElementById('setwhatsapp_number').value.trim()
      };
      saveSystemSettings(payload);
    });
  }

  // QRIS File Upload handling
  const qrisFileInput = document.getElementById('qrisFileInput');
  const uploadQrisBtn = document.getElementById('uploadQrisBtn');
  const adminQrisPreview = document.getElementById('adminQrisPreview');
  const qrisStatusOverlay = document.getElementById('qrisStatusOverlay');

  if (qrisFileInput && uploadQrisBtn) {
    qrisFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          state.selectedQrisBase64 = event.target.result;
          if (adminQrisPreview) adminQrisPreview.src = event.target.result;
          
          uploadQrisBtn.disabled = false;
          uploadQrisBtn.className = "w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl text-xs tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer";
        };
        reader.readAsDataURL(file);
      }
    });

    uploadQrisBtn.addEventListener('click', () => {
      uploadQris(
        state.selectedQrisBase64,
        uploadQrisBtn,
        qrisStatusOverlay,
        () => {
          if (adminQrisPreview) adminQrisPreview.src = `/qris.png?t=${Date.now()}`;
          uploadQrisBtn.disabled = true;
          uploadQrisBtn.className = "w-full bg-blue-600/50 cursor-not-allowed text-slate-400 font-bold py-3.5 rounded-xl text-xs tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 mt-4";
        }
      );
    });
  }

  // Check auth on load
  if (state.ADMIN_SECRET) {
    authModal.classList.add('hidden');
    loadProducts(productFilterSelect, genProductId).then(() => {
      startDataPolling();
      loadPackagesConfig(productFilterSelect, renderPackagesConfig);
    });
  }
});

window.provisionVpsServer = () => {
  const btn = document.getElementById('provisionVpsBtn');
  const consoleLog = document.getElementById('provisionLogConsole');
  
  if (!confirm('Apakah Anda yakin ingin memulai inisialisasi infrastruktur VPS? Proses ini akan menimpa/memperbarui konfigurasi WireGuard, Nginx, Certbot, dan firewall.')) {
    return;
  }
  
  btn.disabled = true;
  btn.textContent = '⚡ SEDANG DIINISIALISASI...';
  btn.className = "bg-slate-700 text-slate-400 font-black px-6 py-4 rounded-xl text-xs uppercase cursor-not-allowed whitespace-nowrap";
  
  consoleLog.classList.remove('hidden');
  consoleLog.innerHTML = '<div class="text-blue-400 font-bold">[SYSTEM] Menghubungkan ke API stream...</div>';
  
  // Use EventSource to receive SSE stream
  const secret = localStorage.getItem('@license_admin_secret') || '';
  const source = new EventSource(`/api/admin/system/provision?secret=${encodeURIComponent(secret)}`);
  
  source.onmessage = (event) => {
    if (event.data === '[DONE]') {
      source.close();
      btn.disabled = false;
      btn.textContent = '⚡ INISIALISASI VPS SEKARANG';
      btn.className = "bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black px-6 py-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-300 shadow-lg shadow-emerald-600/15 whitespace-nowrap cursor-pointer";
      
      const doneDiv = document.createElement('div');
      doneDiv.className = 'text-emerald-400 font-black mt-2 uppercase';
      doneDiv.textContent = '🏆 INISIALISASI SELESAI! VPS SIAP DIGUNAKAN.';
      consoleLog.appendChild(doneDiv);
      consoleLog.scrollTop = consoleLog.scrollHeight;
      return;
    }
    
    try {
      const data = JSON.parse(event.data);
      const logLine = document.createElement('div');
      
      if (data.type === 'status') {
        logLine.className = 'text-blue-400 font-bold';
      } else if (data.type === 'step') {
        logLine.className = 'text-amber-400 font-bold mt-2';
      } else if (data.type === 'success') {
        logLine.className = 'text-emerald-400 font-semibold';
      } else if (data.type === 'error') {
        logLine.className = 'text-red-400 font-black';
      } else if (data.type === 'warning') {
        logLine.className = 'text-yellow-500 font-bold';
      } else if (data.type === 'cmd') {
        logLine.className = 'text-slate-500 font-semibold italic';
      } else {
        logLine.className = 'text-slate-300';
      }
      
      logLine.textContent = data.msg;
      consoleLog.appendChild(logLine);
      consoleLog.scrollTop = consoleLog.scrollHeight;
    } catch (e) {
      console.error(e);
    }
  };
  
  source.onerror = (err) => {
    source.close();
    btn.disabled = false;
    btn.textContent = '⚡ INISIALISASI VPS SEKARANG';
    btn.className = "bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black px-6 py-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-300 shadow-lg shadow-emerald-600/15 whitespace-nowrap cursor-pointer";
    
    const errDiv = document.createElement('div');
    errDiv.className = 'text-red-500 font-black';
    errDiv.textContent = '❌ KONEKSI DENGAN SERVER TERPUTUS ATAU AKSES DITOLAK.';
    consoleLog.appendChild(errDiv);
    consoleLog.scrollTop = consoleLog.scrollHeight;
  };
};

let updateInterval = null;

window.checkServerUpdate = async () => {
  const statusInfo = document.getElementById('updateStatusInfo');
  const commitsContainer = document.getElementById('updateCommitsContainer');
  const commitsList = document.getElementById('updateCommitsList');
  const executeBtn = document.getElementById('executeUpdateBtn');
  const checkBtn = document.getElementById('checkUpdateBtn');

  if (!statusInfo || !checkBtn) return;

  statusInfo.innerHTML = '<span class="text-blue-400 animate-pulse">🔄 Menghubungi server dan memeriksa repositori GitHub...</span>';
  checkBtn.disabled = true;
  checkBtn.textContent = 'Mengecek...';

  try {
    const secret = localStorage.getItem('@license_admin_secret') || '';
    const res = await fetch(`/api/admin/update/check?secret=${encodeURIComponent(secret)}`, {
      headers: { 'x-admin-secret': secret }
    });
    const result = await res.json();
    
    checkBtn.disabled = false;
    checkBtn.textContent = '🔍 Periksa Pembaruan';

    if (result.success) {
      if (result.isBehind) {
        statusInfo.innerHTML = `<span class="text-amber-500 font-bold">⚠️ Ditemukan ${result.commits.length} pembaruan baru di GitHub!</span> Silakan klik "Jalankan Pembaruan" di bawah ini.`;
        
        if (commitsContainer && commitsList) {
          commitsContainer.classList.remove('hidden');
          commitsList.innerHTML = result.commits.map(c => `
            <div class="border-b border-slate-800/80 pb-1.5 flex gap-2">
              <span class="text-blue-400 font-bold">${c.hash}</span>
              <span class="text-slate-300">&mdash; ${c.message}</span>
            </div>
          `).join('');
        }

        if (executeBtn) {
          executeBtn.disabled = false;
          executeBtn.className = "bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black px-6 py-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-300 shadow-lg shadow-blue-600/15 whitespace-nowrap cursor-pointer";
        }
      } else {
        statusInfo.innerHTML = '<span class="text-emerald-400 font-bold">✓ Server Lisensi Anda sudah menggunakan versi terbaru!</span>';
        if (commitsContainer) commitsContainer.classList.add('hidden');
        if (executeBtn) {
          executeBtn.disabled = true;
          executeBtn.className = "bg-blue-600/50 cursor-not-allowed text-slate-400 font-black px-6 py-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-300 shadow-lg whitespace-nowrap";
        }
      }
    } else {
      statusInfo.innerHTML = `<span class="text-red-400 font-bold">❌ Gagal memeriksa pembaruan: ${result.error || 'Unknown error'}</span>`;
    }
  } catch (err) {
    checkBtn.disabled = false;
    checkBtn.textContent = '🔍 Periksa Pembaruan';
    statusInfo.innerHTML = `<span class="text-red-400 font-bold">❌ Gagal terhubung ke API server: ${err.message}</span>`;
  }
};

window.runServerUpdate = async () => {
  if (!confirm('Apakah Anda yakin ingin memperbarui Server Lisensi sekarang? Layanan server akan tidak dapat diakses selama beberapa detik saat proses restart.')) {
    return;
  }

  const statusInfo = document.getElementById('updateStatusInfo');
  const executeBtn = document.getElementById('executeUpdateBtn');
  const checkBtn = document.getElementById('checkUpdateBtn');
  const logConsole = document.getElementById('updateLogConsole');

  if (executeBtn) {
    executeBtn.disabled = true;
    executeBtn.className = "bg-blue-600/50 cursor-not-allowed text-slate-400 font-black px-6 py-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-300 shadow-lg whitespace-nowrap";
  }
  if (checkBtn) checkBtn.disabled = true;

  if (logConsole) {
    logConsole.classList.remove('hidden');
    logConsole.innerHTML = '<div class="text-blue-400 font-bold">[UPDATE] Mengirim perintah pembaruan ke server...</div>';
  }

  try {
    const secret = localStorage.getItem('@license_admin_secret') || '';
    const res = await fetch(`/api/admin/update/execute`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-admin-secret': secret 
      }
    });
    const result = await res.json();

    if (result.success) {
      if (logConsole) logConsole.innerHTML += `<div class="text-emerald-400">[SYSTEM] ${result.message}</div>`;
      
      // Start polling status
      if (updateInterval) clearInterval(updateInterval);
      updateInterval = setInterval(pollUpdateStatus, 2000);
    } else {
      if (logConsole) logConsole.innerHTML += `<div class="text-red-500 font-bold">❌ Gagal memicu pembaruan: ${result.error || 'Unknown error'}</div>`;
      if (executeBtn) {
        executeBtn.disabled = false;
        executeBtn.className = "bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black px-6 py-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-300 shadow-lg shadow-blue-600/15 whitespace-nowrap cursor-pointer";
      }
      if (checkBtn) checkBtn.disabled = false;
    }
  } catch (err) {
    if (logConsole) logConsole.innerHTML += `<div class="text-red-500 font-bold">❌ Error: ${err.message}</div>`;
    if (checkBtn) checkBtn.disabled = false;
  }
};

async function pollUpdateStatus() {
  const logConsole = document.getElementById('updateLogConsole');
  const statusInfo = document.getElementById('updateStatusInfo');
  const executeBtn = document.getElementById('executeUpdateBtn');
  const checkBtn = document.getElementById('checkUpdateBtn');

  try {
    const secret = localStorage.getItem('@license_admin_secret') || '';
    const res = await fetch(`/api/admin/update/status?secret=${encodeURIComponent(secret)}`, {
      headers: { 'x-admin-secret': secret }
    });
    const result = await res.json();

    if (result.success && result.data) {
      const p = result.data;
      
      const logLine = document.createElement('div');
      if (p.status === 'running') {
        logLine.className = 'text-amber-400';
        logLine.innerHTML = `[${p.step.toUpperCase()}] ${p.message}`;
        if (statusInfo) statusInfo.innerHTML = `<span class="text-amber-500 font-bold animate-pulse">🔄 Sedang memperbarui: ${p.message}</span>`;
      } else if (p.status === 'success') {
        logLine.className = 'text-emerald-400 font-bold mt-2';
        logLine.innerHTML = `✓ ${p.message}`;
        if (statusInfo) statusInfo.innerHTML = '<span class="text-emerald-400 font-bold">✓ Server Lisensi berhasil diperbarui!</span>';
        
        clearInterval(updateInterval);
        
        if (logConsole) {
          const reloadLine = document.createElement('div');
          reloadLine.className = 'text-blue-400 font-bold mt-2 animate-pulse';
          reloadLine.textContent = '[RELOAD] Server sedang dimuat ulang. Halaman akan disegarkan dalam 5 detik...';
          logConsole.appendChild(reloadLine);
          logConsole.scrollTop = logConsole.scrollHeight;
        }

        setTimeout(() => {
          window.location.reload();
        }, 5000);
        return;
      } else if (p.status === 'failed') {
        logLine.className = 'text-red-500 font-black mt-2';
        logLine.innerHTML = `❌ ${p.message} ${p.error ? `<br>Error: ${p.error}` : ''}`;
        if (statusInfo) statusInfo.innerHTML = `<span class="text-red-400 font-bold">❌ Pembaruan gagal: ${p.message}</span>`;
        
        clearInterval(updateInterval);
        if (checkBtn) checkBtn.disabled = false;
        if (executeBtn) {
          executeBtn.disabled = false;
          executeBtn.className = "bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black px-6 py-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-300 shadow-lg shadow-blue-600/15 whitespace-nowrap cursor-pointer";
        }
      }

      if (logConsole) {
        logConsole.appendChild(logLine);
        logConsole.scrollTop = logConsole.scrollHeight;
      }
    }
  } catch (err) {
    console.error('Failed to poll update status:', err);
  }
}

window.checkCaddyStatus = async () => {
  const badge = document.getElementById('caddyServiceBadge');
  const view = document.getElementById('caddyfileView');
  const tbody = document.getElementById('caddyRoutesTableBody');
  if (!badge || !view) return;

  badge.className = "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-800 text-slate-400";
  badge.textContent = "Checking...";
  view.textContent = "Loading configuration...";
  if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="px-5 py-8 text-center text-slate-500 font-medium">Memuat daftar rute...</td></tr>';

  try {
    const secret = localStorage.getItem('@license_admin_secret') || '';
    const res = await fetch(`/api/admin/caddy/status?secret=${encodeURIComponent(secret)}`, {
      headers: { 'x-admin-secret': secret }
    });
    const result = await res.json();

    if (result.success) {
      if (result.status === 'online') {
        badge.className = "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
        badge.textContent = "● ONLINE";
      } else {
        badge.className = "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse";
        badge.textContent = "● OFFLINE";
      }
      view.textContent = result.caddyfile || '# Caddyfile kosong atau tidak ditemukan.';

      // Render Caddy routes table
      if (tbody) {
        tbody.innerHTML = '';
        const routes = parseCaddyfile(result.caddyfile || '');
        if (routes.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4" class="px-5 py-8 text-center text-slate-500 font-medium">Tidak ada rute Caddy terkonfigurasi.</td></tr>';
        } else {
          routes.forEach(r => {
            const isTenant = r.type.startsWith('Tenant');
            const badgeColor = isTenant 
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
            const isSSLAuto = r.domain !== state.MAIN_DOMAIN && r.domain !== `www.${state.MAIN_DOMAIN}`;
            
            tbody.innerHTML += `
              <tr class="border-b border-slate-900 hover:bg-slate-900/40 transition-colors duration-150">
                <td class="px-5 py-4 font-bold text-slate-200">
                  <a href="https://${r.domain}" target="_blank" class="hover:underline text-emerald-400 flex items-center gap-1.5 font-bold">
                    ${r.domain} <span class="text-[10px]">🔗</span>
                  </a>
                </td>
                <td class="px-5 py-4">
                  <span class="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${badgeColor}">
                    ${r.type}
                  </span>
                </td>
                <td class="px-5 py-4 font-mono text-slate-400 font-bold">
                  ${r.target !== '-' ? `📡 ${r.target}` : '📂 Berkas Lokal'}
                </td>
                <td class="px-5 py-4">
                  <span class="inline-flex items-center gap-1.5 text-[11px] font-bold ${isSSLAuto ? 'text-emerald-400' : 'text-slate-500'}">
                    <span class="w-1.5 h-1.5 rounded-full ${isSSLAuto ? 'bg-emerald-400' : 'bg-slate-500'}"></span>
                    ${isSSLAuto ? 'SSL Aktif (Auto)' : 'SSL Manual'}
                  </span>
                </td>
              </tr>
            `;
          });
        }
      }
    } else {
      badge.className = "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20";
      badge.textContent = "● ERROR";
      view.textContent = `Gagal memuat status: ${result.error || 'Unknown error'}`;
      if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="px-5 py-8 text-center text-rose-400 font-medium">Gagal memuat: ${result.error || 'Unknown error'}</td></tr>`;
    }
  } catch (err) {
    badge.className = "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20";
    badge.textContent = "● ERROR";
    view.textContent = `Gagal terhubung ke API: ${err.message}`;
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="px-5 py-8 text-center text-rose-400 font-medium">Gagal terhubung ke API: ${err.message}</td></tr>`;
  }
};

// Helper function to parse Caddyfile lines into structured route objects
function parseCaddyfile(caddyfileText) {
  if (!caddyfileText) return [];
  const lines = caddyfileText.split('\n');
  const routes = [];
  let currentTenant = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# Tenant:')) {
      currentTenant = line.replace('# Tenant:', '').trim();
    }
    
    // Check if line defines a site block (ends with {)
    if (line.endsWith('{')) {
      const domainsStr = line.slice(0, -1).trim();
      // Ignore main global/config blocks
      if (domainsStr === '' || domainsStr.startsWith('email') || domainsStr.startsWith('on_demand_tls') || domainsStr === '{' || domainsStr === '#') {
        continue;
      }
      
      const domains = domainsStr.split(',').map(d => d.trim()).filter(Boolean);
      
      // Look inside the block for reverse_proxy IP
      let targetIp = '-';
      let blockDepth = 1;
      let j = i + 1;
      while (j < lines.length && blockDepth > 0) {
        const subLine = lines[j].trim();
        if (subLine.endsWith('{')) blockDepth++;
        if (subLine === '}') blockDepth--;
        
        if (subLine.startsWith('reverse_proxy')) {
          const proxyParts = subLine.split(/\s+/);
          const lastPart = proxyParts[proxyParts.length - 1];
          if (lastPart.includes('10.0.0.') || lastPart.includes('127.0.0.1') || lastPart.includes('10.0.0.2') || lastPart.includes('10.0.0.3')) {
            targetIp = lastPart.replace('http://', '');
          }
        }
        j++;
      }
      
      domains.forEach(domain => {
        routes.push({
          domain,
          type: currentTenant ? `Tenant (${currentTenant})` : 'Sistem Utama',
          target: targetIp
        });
      });
      
      // Fast-forward outer loop index
      i = j - 1;
    }
    
    if (line === '') {
      currentTenant = null;
    }
  }
  return routes;
}

window.runCaddySync = async () => {
  if (!confirm('Apakah Anda yakin ingin menyinkronkan ulang konfigurasi rute Caddy? Tindakan ini akan memperbarui berkas Caddyfile dan memuat ulang service Caddy.')) {
    return;
  }

  const badge = document.getElementById('caddyServiceBadge');
  const view = document.getElementById('caddyfileView');
  if (!badge || !view) return;

  view.textContent = "Running sync and reloading Caddy... Please wait...";

  try {
    const secret = localStorage.getItem('@license_admin_secret') || '';
    const res = await fetch(`/api/admin/caddy/sync`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-admin-secret': secret 
      }
    });
    const result = await res.json();

    if (result.success) {
      alert(result.message || 'Sinkronisasi Caddy berhasil!');
      checkCaddyStatus();
    } else {
      alert(`Gagal sinkronisasi: ${result.error || 'Unknown error'}`);
      checkCaddyStatus();
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
    checkCaddyStatus();
  }
};

// Auto check Caddy & Fail2Ban status on loading tab
const originalSwitchTab = window.switchTab;
window.switchTab = (tabId) => {
  if (originalSwitchTab) originalSwitchTab(tabId);
  if (tabId === 'tab-caddy') {
    checkCaddyStatus();
    checkFail2BanStatus();
  }
};

// ── FAIL2BAN MANAGEMENT ──
window.checkFail2BanStatus = async () => {
  const badge = document.getElementById('f2bStatusBadge');
  const tFailed = document.getElementById('f2bTotalFailed');
  const tBanned = document.getElementById('f2bTotalBanned');
  const tbody = document.getElementById('f2bBannedTableBody');
  
  if (!badge) return;

  badge.className = "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-800 text-slate-400";
  badge.textContent = "Checking...";
  if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="px-5 py-8 text-center text-slate-500 font-medium">Memuat data...</td></tr>';

  try {
    const secret = localStorage.getItem('@license_admin_secret') || '';
    const res = await fetch(`/api/fail2ban/status?secret=${encodeURIComponent(secret)}`, {
      headers: { 'x-admin-secret': secret }
    });
    const result = await res.json();

    if (result.success && result.is_active) {
      badge.className = "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      badge.textContent = "Aktif (Melindungi)";
      
      tFailed.textContent = result.total_failed || 0;
      tBanned.textContent = result.total_banned || 0;
      
      if (tbody) {
        tbody.innerHTML = '';
        if (result.banned_ips && result.banned_ips.length > 0) {
          result.banned_ips.forEach((item, index) => {
            const ip = typeof item === 'string' ? item : item.ip;
            const time = typeof item === 'string' ? 'Tidak diketahui' : item.timestamp;
            const port = typeof item === 'string' ? '22 (SSH)' : item.port;
            const location = typeof item === 'string' ? '-' : (item.location || '-');
            
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors";
            tr.innerHTML = `
              <td class="px-5 py-4 text-center font-bold text-slate-500">${index + 1}</td>
              <td class="px-5 py-4">
                <div class="font-mono font-bold text-rose-400">${ip}</div>
                <div class="text-[10px] text-slate-500 mt-1">Waktu: <span class="text-slate-400">${time}</span></div>
              </td>
              <td class="px-5 py-4 text-center font-mono text-xs text-amber-400/80 font-bold">${port}</td>
              <td class="px-5 py-4 font-mono text-xs text-slate-400">${location}</td>
              <td class="px-5 py-4 text-right">
                <button onclick="unbanFail2BanIP('${ip}')" class="bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                  Bebaskan (Unban)
                </button>
              </td>
            `;
            tbody.appendChild(tr);
          });
        } else {
          tbody.innerHTML = '<tr><td colspan="5" class="px-5 py-8 text-center text-emerald-500 font-medium font-bold">✨ Aman. Tidak ada IP yang dipenjara saat ini.</td></tr>';
        }
      }
    } else {
      badge.className = "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20";
      badge.textContent = "Tidak Aktif / Gagal";
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="px-5 py-8 text-center text-rose-500 font-medium">Gagal memuat atau Fail2Ban tidak terpasang.</td></tr>';
    }
  } catch (err) {
    badge.className = "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20";
    badge.textContent = "Error";
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-8 text-center text-rose-500 font-medium">Koneksi Error: ${err.message}</td></tr>`;
  }
};

window.unbanFail2BanIP = async (ip) => {
  if (!confirm(`Anda yakin ingin menghapus blokir untuk IP ${ip}?\nIP ini sebelumnya terdeteksi mencoba meretas server.`)) {
    return;
  }
  
  try {
    const secret = localStorage.getItem('@license_admin_secret') || '';
    const res = await fetch('/api/fail2ban/unban', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': secret
      },
      body: JSON.stringify({ ip })
    });
    const result = await res.json();
    
    if (result.success) {
      alert(`Sukses: ${result.message}`);
      checkFail2BanStatus(); // Reload the table
    } else {
      alert(`Gagal: ${result.message}`);
    }
  } catch (err) {
    alert(`Terjadi kesalahan sistem: ${err.message}`);
  }
};