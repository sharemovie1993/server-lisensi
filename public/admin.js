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
  uploadInvoiceProof
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
window.switchTab = (tabId) => {
  switchTab(tabId);
  if (tabId === 'tab-logs') {
    loadActivityLogs(renderAllCachedTables);
  } else if (tabId === 'tab-tenants') {
    loadSupabaseTenants(renderAllCachedTables);
  } else if (tabId === 'tab-settings') {
    loadSettingsUI();
  }
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