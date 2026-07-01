import { state } from './admin-state.js';
import { formatIndonesianDate, formatIndonesianDateTime } from './admin-utils.js';
import { showPremiumDialog } from './admin-dialog.js';

// Cache DOM elements
let statActiveKeys, statPendingKeys, statActiveDevices, statTotalRevenue;
let pendingContainer, pendingCountBadge, pendingEmptyState;
let licenseTableBody, subscriptionTableBody, invoiceTableBody, logsTableBody;
let packagesConfigContainer, productFilterSelect, globalSearchInput;

function initElements() {
  statActiveKeys = document.getElementById('statActiveKeys');
  statPendingKeys = document.getElementById('statPendingKeys');
  statActiveDevices = document.getElementById('statActiveDevices');
  statTotalRevenue = document.getElementById('statTotalRevenue');
  pendingContainer = document.getElementById('pendingContainer');
  pendingCountBadge = document.getElementById('pendingCountBadge');
  pendingEmptyState = document.getElementById('pendingEmptyState');
  licenseTableBody = document.getElementById('licenseTableBody');
  subscriptionTableBody = document.getElementById('subscriptionTableBody');
  invoiceTableBody = document.getElementById('invoiceTableBody');
  logsTableBody = document.getElementById('logsTableBody');
  packagesConfigContainer = document.getElementById('packagesConfigContainer');
  productFilterSelect = document.getElementById('productFilterSelect');
  globalSearchInput = document.getElementById('globalSearchInput');
}

// Call on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initElements);
} else {
  initElements();
}

export function updateRevenueStats() {
  if (state.revenueCache && statTotalRevenue) {
    statTotalRevenue.textContent = `Rp ${(state.revenueCache.total_revenue || 0).toLocaleString('id-ID')}`;
  }
}

export function loadQrisPreview() {
  if (qrisImgPreview) {
    qrisImgPreview.src = `${state.API_BASE}/qris.png?t=${Date.now()}`;
  }
}

export function renderAllCachedTables() {
  const selectedProd = productFilterSelect ? productFilterSelect.value : 'all';
  const query = globalSearchInput ? (globalSearchInput.value || '').trim().toLowerCase() : '';

  // 1. Render Licenses
  if (state.activeLicensesCache) {
    let items = [...state.activeLicensesCache];
    if (selectedProd !== 'all') {
      items = items.filter(x => x.product_id === selectedProd);
    }
    if (query) {
      items = items.filter(x => 
        (x.school_name || '').toLowerCase().includes(query) ||
        (x.license_key || '').toLowerCase().includes(query)
      );
    }
    
    const activeItems = items.filter(x => x.status === 'active');
    const pendingItems = items.filter(x => x.status === 'pending');
    
    let countItems = [...state.activeLicensesCache];
    if (selectedProd !== 'all') {
      countItems = countItems.filter(x => x.product_id === selectedProd);
    }
    const totalDevices = countItems.reduce((acc, curr) => acc + (curr.active_devices_count || 0), 0);
    
    if (statActiveKeys) statActiveKeys.textContent = countItems.filter(x => x.status === 'active').length;
    if (statPendingKeys) statPendingKeys.textContent = countItems.filter(x => x.status === 'pending').length;
    if (statActiveDevices) statActiveDevices.textContent = totalDevices;

    renderPendingList(pendingItems);
    renderLicenseTable(activeItems);
  }

  // 2. Render Subscriptions
  if (state.subscriptionsCache) {
    let list = [...state.subscriptionsCache];
    if (selectedProd !== 'all') {
      list = list.filter(x => x.product_id === selectedProd);
    }
    if (query) {
      list = list.filter(x => 
        (x.school_name || '').toLowerCase().includes(query) ||
        (x.license_key || '').toLowerCase().includes(query)
      );
    }
    renderSubscriptionTable(list);
  }

  // 3. Render Invoices
  if (state.invoicesCache) {
    let list = [...state.invoicesCache];
    if (selectedProd !== 'all') {
      list = list.filter(x => x.product_id === selectedProd);
    }
    if (query) {
      list = list.filter(x => 
        (x.school_name || '').toLowerCase().includes(query) ||
        (x.invoice_number || '').toLowerCase().includes(query) ||
        (x.payment_method || '').toLowerCase().includes(query) ||
        (x.status || '').toLowerCase().includes(query)
      );
    }
    renderInvoiceTable(list);
  }

  // 4. Render Logs
  if (state.logsCache) {
    let list = [...state.logsCache];
    if (selectedProd !== 'all') {
      list = list.filter(x => x.product_id === selectedProd);
    }
    if (query) {
      list = list.filter(x => 
        (x.license_key || '').toLowerCase().includes(query) ||
        (x.device_id || '').toLowerCase().includes(query) ||
        (x.ip_address || '').toLowerCase().includes(query) ||
        (x.status || '').toLowerCase().includes(query)
      );
    }
    renderLogsTable(list);
  }

  // 5. Render Supabase Tenants
  if (state.tenantsDataCache) {
    let list = [...state.tenantsDataCache];
    if (query) {
      list = list.filter(x => 
        (x.name || '').toLowerCase().includes(query) ||
        (x.domain_or_slug || '').toLowerCase().includes(query) ||
        (x.license_key || '').toLowerCase().includes(query) ||
        (x.license_status || '').toLowerCase().includes(query)
      );
    }
    renderTenantsTable(list);
  }
}

export function renderPendingList(items) {
  if (!pendingContainer) return;
  pendingContainer.innerHTML = '';
  if (pendingCountBadge) pendingCountBadge.textContent = `${items.length} Permintaan`;

  if (items.length === 0) {
    if (pendingEmptyState) pendingEmptyState.classList.remove('hidden');
    return;
  }
  if (pendingEmptyState) pendingEmptyState.classList.add('hidden');

  items.forEach(item => {
    const productBadge = item.product_id === 'absenta' 
      ? `<span class="bg-purple-500/10 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-500/20 uppercase tracking-widest">Absenta</span>`
      : `<span class="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/20 uppercase tracking-widest">G-Form</span>`;

    const methodBadge = item.payment_method 
      ? `<span class="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/20 uppercase tracking-widest">${item.payment_method}</span>`
      : '';

    const card = document.createElement('div');
    card.className = "bg-slate-800 border border-amber-500/30 rounded-2xl p-6 space-y-4 shadow-lg";
    const hasProof = item.payment_proof ? true : false;
    const isManualPay = (item.payment_method === 'Manual' || item.payment_method === 'manual');
    
    let approveBtnHtml = '';
    let noteText = '';
    let proofHtml = '';
    
    if (isManualPay) {
      if (hasProof) {
        proofHtml = `
          <div class="p-3 rounded-xl bg-slate-900/50 border border-slate-700/50 flex justify-between items-center mb-1">
            <span class="text-xs font-semibold text-slate-300">📄 Bukti Transfer Tersedia</span>
            <a href="${item.payment_proof}" target="_blank" class="bg-blue-600 hover:bg-blue-500 text-white font-extrabold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition-all shadow-md text-center no-underline">
              👁️ Lihat Bukti
            </a>
          </div>
        `;
        approveBtnHtml = `
          <button onclick="approveLicense('${item.id}')" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-2.5 rounded-xl text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95">
            ✅ SETUJUI PEMBAYARAN MANUAL
          </button>
        `;
        noteText = `ℹ️ Bukti transfer telah diunggah. Silakan klik "Lihat Bukti" untuk verifikasi kesesuaian sebelum menyetujui.`;
      } else {
        proofHtml = `
          <div class="p-3 rounded-xl bg-slate-900/50 border border-amber-500/20 flex flex-col gap-2">
            <input type="file" id="file-${item.id}" class="text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-amber-500/10 file:text-amber-500 hover:file:bg-amber-500/20">
            <button onclick="uploadProof('${item.id}')" class="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-wider transition-all">
              📤 Upload Bukti Bayar
            </button>
          </div>
        `;
        approveBtnHtml = `
          <button disabled class="w-full bg-slate-700/50 text-slate-500 border border-slate-600/25 font-bold py-2.5 rounded-xl text-xs tracking-wider uppercase cursor-not-allowed flex items-center justify-center gap-1.5">
            ⏳ MENUNGGU BUKTI BAYAR DIUNGGAH
          </button>
        `;
        noteText = `⚠️ Pelanggan belum mengunggah bukti transfer ke sistem. Tombol persetujuan akan aktif setelah bukti bayar diunggah.`;
      }
    } else {
      approveBtnHtml = `
        <button disabled class="w-full bg-slate-700/50 text-slate-500 border border-slate-600/25 font-bold py-2.5 rounded-xl text-xs tracking-wider uppercase cursor-not-allowed flex items-center justify-center gap-1.5">
          🔒 OTOMATISASI GATEWAY AKTIF
        </button>
      `;
      noteText = `ℹ️ Lisensi ini akan aktif secara otomatis sesaat setelah pelanggan menyelesaikan pembayaran di ${item.payment_method || 'Tripay'}.`;
    }

    const typeBadge = item.is_recovery === 1
      ? `<span class="bg-cyan-500/10 text-cyan-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-cyan-500/20 uppercase tracking-widest">RECOVERY / PERPANJANGAN</span>`
      : `<span class="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-widest">REGISTRASI BARU</span>`;

    card.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <div class="flex flex-wrap items-center gap-1.5">${productBadge} <span class="bg-amber-500/10 text-amber-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-widest">PENDING</span> ${methodBadge} ${typeBadge}</div>
          <h4 class="text-base font-black text-white mt-1.5">${item.school_name}</h4>
          <p class="text-xs text-slate-400 mt-0.5">Key: <code class="bg-slate-900 px-1.5 py-0.5 rounded text-blue-400 text-[11px] font-bold">${item.license_key}</code></p>
          ${item.requested_slug ? `<p class="text-xs text-slate-400 mt-1">Subdomain: <a href="https://${item.requested_slug}.${state.MAIN_DOMAIN}" target="_blank" class="text-emerald-400 hover:underline font-bold">${item.requested_slug}.${state.MAIN_DOMAIN}</a></p>` : ''}
        </div>
        <div class="text-right">
          <p class="text-xs text-slate-400">Kuota Perangkat</p>
          <h5 class="text-lg font-black text-white">${(item.device_limit >= 9999 || item.is_unlimited === 1 || !item.device_limit || item.device_limit === 0) ? 'Unlimited HP' : item.device_limit + ' HP'}</h5>
        </div>
      </div>
      <div class="border-t border-slate-700/50 pt-4 flex flex-col gap-2.5">
        ${proofHtml}
        ${approveBtnHtml}
        <div class="flex gap-3">
          <span class="text-[10px] text-slate-500 font-semibold leading-relaxed flex items-center">
            ${noteText}
          </span>
          <button onclick="deleteLicense('${item.id}')" class="bg-slate-700 hover:bg-red-600 hover:text-white text-slate-300 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap">
            🗑️ Batalkan
          </button>
        </div>
      </div>
    `;
    pendingContainer.appendChild(card);
  });
}

export function renderLicenseTable(items) {
  if (!licenseTableBody) return;
  licenseTableBody.innerHTML = '';
  if (items.length === 0) {
    licenseTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-slate-500 font-bold text-xs uppercase">
          Tidak ada lisensi aktif yang terdaftar.
        </td>
      </tr>
    `;
    return;
  }

  items.forEach(item => {
    const productBadge = item.product_id === 'project-yatim'
      ? `<span class="ml-2 bg-emerald-500/10 text-emerald-400 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-widest">MUSTAHIQ CARE</span>`
      : (item.product_id === 'absenta'
         ? `<span class="ml-2 bg-purple-500/10 text-purple-400 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border border-purple-500/20 uppercase tracking-widest">ABSENTA</span>`
         : `<span class="ml-2 bg-blue-500/10 text-blue-400 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border border-blue-500/20 uppercase tracking-widest">G-FORM</span>`);
      
    let vpnInfo = `<div class="text-[11px] text-slate-500 mt-1">🌐 VPN Tunnel: Belum Dikonfigurasi</div>`;
    
    if (item.requested_slug) {
      const vpn = item.vpn_status || { is_online: false, rx: 0, tx: 0 };
      
      const statusBadge = vpn.is_online 
        ? `<span class="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-widest">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> ONLINE
           </span>`
        : `<span class="inline-flex items-center bg-red-500/10 text-red-400 text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-red-500/20 uppercase tracking-widest">OFFLINE</span>`;
        
      const formatTraffic = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
      };

      const trafficInfo = vpn.rx > 0 || vpn.tx > 0
        ? `<span class="text-[10px] text-slate-500 font-semibold">(Tx: ${formatTraffic(vpn.tx)} | Rx: ${formatTraffic(vpn.rx)})</span>`
        : '';

      vpnInfo = `
        <div class="text-[11px] text-slate-400 font-bold mt-1.5 flex items-center gap-2 flex-wrap">
          <span class="text-slate-500 font-normal">🌐 VPN:</span>
          <a href="http://${item.requested_slug}.${state.MAIN_DOMAIN}" target="_blank" class="hover:underline text-blue-400 font-extrabold">${item.requested_slug}.${state.MAIN_DOMAIN}</a>
          <span class="bg-slate-900/60 px-1.5 py-0.5 rounded text-slate-300 font-semibold text-[10px]">${item.wireguard_ip || 'No IP'}</span>
          ${statusBadge}
          ${trafficInfo}
        </div>
      `;
    }

    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-800/20 transition-all duration-200";
    tr.innerHTML = `
      <td class="p-4">
        <div class="font-bold text-white flex items-center flex-wrap gap-1.5">${item.school_name} ${productBadge}</div>
        ${vpnInfo}
      </td>
      <td class="p-4"><code class="bg-slate-900/60 px-2 py-0.5 rounded text-blue-400 font-bold text-xs">${item.license_key}</code></td>
      <td class="p-4 font-semibold text-slate-400">${item.active_devices_count || 0} / ${item.device_limit >= 9999 ? 'Unlimited' : item.device_limit} HP</td>
      <td class="p-4 font-semibold text-slate-400">${formatIndonesianDate(item.expires_at)}</td>
      <td class="p-4">
        <span class="bg-emerald-500/10 text-emerald-500 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-widest">AKTIF</span>
      </td>
      <td class="p-4 text-right">
        <div class="flex items-center justify-end gap-1.5">
          <button onclick="printInvoice('${item.id}')" class="bg-slate-800 border border-slate-700/50 hover:border-blue-500/50 hover:bg-blue-600/10 text-blue-400 hover:text-blue-300 p-2 rounded-lg transition-all duration-300" title="Cetak Invoice Resmi (BOS)">
            📄
          </button>
          <button onclick="deleteLicense('${item.id}')" class="bg-slate-800 border border-slate-700/50 hover:border-red-500/50 hover:bg-red-600/10 text-slate-400 hover:text-red-500 p-2 rounded-lg transition-all duration-300" title="Hapus Lisensi">
            🗑️
          </button>
        </div>
      </td>
    `;
    licenseTableBody.appendChild(tr);
  });
}

export function renderLogsTable(list) {
  if (!logsTableBody) return;
  logsTableBody.innerHTML = '';
  if (list.length === 0) {
    logsTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-slate-500 font-bold text-xs uppercase">
          Tidak ada log aktivitas tercatat.
        </td>
      </tr>
    `;
    return;
  }

  list.forEach(log => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-800/20 transition-all duration-200";
    
    const productBadge = log.product_id === 'absenta' 
      ? `<span class="bg-purple-500/10 text-purple-400 text-[9px] font-extrabold px-2 py-0.5 rounded border border-purple-500/20 uppercase tracking-widest">ABSENTA</span>`
      : `<span class="bg-blue-500/10 text-blue-400 text-[9px] font-extrabold px-2 py-0.5 rounded border border-blue-500/20 uppercase tracking-widest">G-FORM</span>`;
      
    const statusClass = (log.status || '').includes('ERR') || (log.status || '').includes('BLOCKED') || (log.status || '').includes('FAIL')
      ? 'text-red-400 font-bold'
      : ((log.status || '').includes('OK') || (log.status || '').includes('SUCCESS') || (log.status || '').includes('ACTIVE') || (log.status || '').includes('PAID')
         ? 'text-emerald-400 font-bold'
         : 'text-slate-300 font-semibold');
         
    tr.innerHTML = `
      <td class="p-4 font-mono text-xs text-slate-400">${formatIndonesianDateTime(log.timestamp)}</td>
      <td class="p-4">${productBadge}</td>
      <td class="p-4"><code class="bg-slate-900/60 px-2 py-0.5 rounded text-slate-300 font-mono text-xs">${log.license_key || '-'}</code></td>
      <td class="p-4 font-mono text-xs text-slate-500">${log.device_id || '-'}</td>
      <td class="p-4 font-mono text-xs text-slate-400">${log.ip_address || '-'}</td>
      <td class="p-4 text-xs ${statusClass}">${log.status}</td>
    `;
    logsTableBody.appendChild(tr);
  });
}

export function renderSubscriptionTable(list) {
  if (!subscriptionTableBody) return;
  subscriptionTableBody.innerHTML = '';
  if (list.length === 0) {
    subscriptionTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="p-8 text-center text-slate-500 font-medium">Tidak ada data langganan sekolah aktif.</td>
      </tr>
    `;
    return;
  }

  list.forEach(sub => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-900/30 transition-colors duration-200";

    const productBadge = sub.product_id === 'absenta'
      ? `<span class="bg-purple-500/10 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-500/20 uppercase tracking-widest">Absenta</span>`
      : `<span class="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/20 uppercase tracking-widest">G-Form</span>`;

    let statusBadge = '';
    if (sub.status === 'active') {
      statusBadge = `<span class="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-widest">Aktif / Active</span>`;
    } else if (sub.status === 'expired') {
      statusBadge = `<span class="bg-red-500/10 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/20 uppercase tracking-widest">Kedaluwarsa</span>`;
    } else {
      statusBadge = `<span class="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-widest">Menunggu</span>`;
    }

    const startStr = sub.start_date ? formatIndonesianDate(sub.start_date) : '';
    const endStr = sub.end_date ? formatIndonesianDate(sub.end_date) : '';
    
    // Combine date range into one single elegant column
    const durationStr = (startStr && endStr) 
      ? `${startStr} s/d ${endStr}`
      : (startStr ? `${startStr} (Pending)` : 'Belum Aktif (Menunggu Pembayaran)');

    tr.innerHTML = `
      <td class="p-4 font-semibold text-white">${sub.school_name}</td>
      <td class="p-4">${productBadge}</td>
      <td class="p-4 font-medium text-slate-300">${sub.plan_id.toUpperCase()}</td>
      <td class="p-4 text-slate-400 font-medium text-xs">${durationStr}</td>
      <td class="p-4">${statusBadge}</td>
    `;
    subscriptionTableBody.appendChild(tr);
  });
}

export function renderInvoiceTable(list) {
  if (!invoiceTableBody) return;
  invoiceTableBody.innerHTML = '';
  if (list.length === 0) {
    invoiceTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center text-slate-500 font-medium">Tidak ada data tagihan terkumpul.</td>
      </tr>
    `;
    return;
  }

  list.forEach(inv => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-900/30 transition-colors duration-200";

    const productBadge = inv.product_id === 'absenta'
      ? `<span class="bg-purple-500/10 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-500/20 uppercase tracking-widest">Absenta</span>`
      : `<span class="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/20 uppercase tracking-widest">G-Form</span>`;

    let statusBadge = '';
    let payAction = '';
    if (inv.status === 'paid') {
      statusBadge = `<span class="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-widest">Lunas</span>`;
    } else {
      statusBadge = `<span class="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-widest">Belum Bayar</span>`;
      payAction = `
        <button onclick="manuallyPayInvoice('${inv.id}')" class="bg-slate-800 border border-slate-700/50 hover:border-emerald-500/50 hover:bg-emerald-600/10 text-emerald-400 hover:text-emerald-300 p-2 rounded-lg transition-all duration-300 cursor-pointer" title="Persetujuan Manual Keuangan">
          💰
        </button>
      `;
    }

    tr.innerHTML = `
      <td class="p-4 font-mono font-bold text-slate-300 text-xs">${inv.invoice_number}</td>
      <td class="p-4 font-semibold text-white">${inv.school_name}</td>
      <td class="p-4">${productBadge}</td>
      <td class="p-4 text-slate-300 font-medium">${inv.plan_title}</td>
      <td class="p-4 font-bold text-white">Rp ${inv.amount.toLocaleString('id-ID')}</td>
      <td class="p-4 font-medium text-slate-400">${inv.payment_method}</td>
      <td class="p-4">${statusBadge}</td>
      <td class="p-4 text-right">
        <div class="flex justify-end gap-1.5">
          ${payAction}
          <button onclick="printInvoice('${inv.id}')" class="bg-slate-800 border border-slate-700/50 hover:border-blue-500/50 hover:bg-blue-600/10 text-blue-400 hover:text-blue-300 p-2 rounded-lg transition-all duration-300 cursor-pointer" title="Cetak SPJ BOS A4">
            📄
          </button>
        </div>
      </td>
    `;
    invoiceTableBody.appendChild(tr);
  });
}

export function renderPackagesConfig(items) {
  if (!packagesConfigContainer) return;
  packagesConfigContainer.innerHTML = '';
  if (items.length === 0) {
    packagesConfigContainer.innerHTML = `
      <div class="col-span-3 text-center p-8 text-slate-500 font-bold text-xs uppercase">
        Tidak ada paket harga terdaftar di database.
      </div>
    `;
    return;
  }

  items.forEach(pkg => {
    const card = document.createElement('div');
    card.className = "bg-slate-900/60 border border-slate-700/60 rounded-2xl p-5 flex flex-col justify-between space-y-4 relative mt-2";
    card.innerHTML = `
      ${pkg.badge ? `
        <span class="absolute -top-3 left-4 bg-blue-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full border border-blue-500 shadow-md uppercase tracking-wider">${pkg.badge}</span>
      ` : ''}

      <div class="absolute top-3 right-3">
        <button onclick="window.deletePackage('${pkg.id}', '${pkg.title.replace(/'/g, "\\'")}')"
          class="text-slate-600 hover:text-red-400 transition-colors duration-200 text-sm p-1 rounded-lg hover:bg-red-400/10" title="Hapus Paket">
          🗑️
        </button>
      </div>
      
      <div>
        <p class="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">${pkg.product_id === 'absenta' ? '📅 Absenta' : '🔒 G-Form Orkestrator'}</p>
        <h4 class="text-sm font-black text-white uppercase tracking-wider">${pkg.title}</h4>
        <p class="text-2xl font-black text-blue-500 mt-2">${pkg.price}</p>
        <p class="text-slate-400 text-xs mt-2">Durasi: <span class="font-bold text-slate-300">${pkg.duration}</span></p>
        <p class="text-slate-400 text-xs mt-0.5">Kapasitas HP: <span class="font-bold text-slate-300">${pkg.device_limit >= 9999 || pkg.is_unlimited === 1 ? 'Unlimited HP' : pkg.device_limit + ' HP'}</span></p>
      </div>

      <button onclick="openEditPackageModal('${pkg.id}')" class="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold py-2.5 rounded-xl text-[11px] tracking-wider uppercase transition-all duration-300 border border-slate-700 shadow-sm">
        ✏️ Edit Konfigurasi
      </button>
    `;
    packagesConfigContainer.appendChild(card);
  });
}

export function printInvoice(id) {
  const inv = state.invoicesCache.find(x => x.id === id) || state.invoicesCache.find(x => x.license_id === id);
  if (!inv) {
    showPremiumDialog({ type: 'error', title: 'Invoice Error', message: 'Data invoice tidak ditemukan di database.' });
    return;
  }

  const license = state.activeLicensesCache.find(x => x.id === inv.license_id) || { license_key: 'Manual Generation' };
  const cleanSchoolName = inv.school_name.replace(/\(([^)]+)\)/g, '').trim();
  const planTitle = inv.plan_title;
  const rawAmount = inv.amount || 0;
  const planPrice = `Rp ${rawAmount.toLocaleString('id-ID')}`;
  const planDuration = planTitle.toLowerCase().includes('bulan') ? '30 Hari' : (planTitle.toLowerCase().includes('sem') ? '180 Hari' : '365 Hari');

  const dateStr = inv.paid_at
    ? formatIndonesianDate(inv.paid_at.slice(0, 10))
    : formatIndonesianDate(inv.created_at.slice(0, 10));

  const productName = inv.product_id === 'absenta' ? 'Absenta Premium (AI Absensi)' : 'G-Form Orkestrator Premium';
  const productDesc = inv.product_id === 'absenta'
    ? 'Sistem absensi sekolah berbasis AI wajah & pembatasan radius lokasi'
    : 'Sistem pengunci & pengaman ujian terintegrasi Google Forms';
  const capacityStr = inv.product_id === 'absenta' ? 'Multi Device HP' : 'Unlimited HP';

  const invoiceWindow = window.open('', '_blank');
  if (!invoiceWindow) {
    alert('Popup diblokir oleh browser! Harap izinkan popup untuk mencetak invoice.');
    return;
  }

  const isPaid = inv.status === 'paid';
  const statusLabel = isPaid ? 'LUNAS' : 'BELUM BAYAR';
  const payMethodLabel = inv.payment_method || 'N/A';

  // Generate verification hash from invoice data
  const verifyHash = btoa(`${inv.invoice_number}:${inv.id}:${rawAmount}`).slice(0, 16).toUpperCase();

  invoiceWindow.document.write(`
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${inv.invoice_number} - ${cleanSchoolName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --primary: #1e40af;
      --primary-light: #3b82f6;
      --primary-lighter: #dbeafe;
      --accent: #0ea5e9;
      --success: #059669;
      --success-bg: #d1fae5;
      --warning: #d97706;
      --warning-bg: #fef3c7;
      --text-dark: #0f172a;
      --text-body: #334155;
      --text-muted: #64748b;
      --text-light: #94a3b8;
      --border: #e2e8f0;
      --border-light: #f1f5f9;
      --bg-subtle: #f8fafc;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: var(--text-body);
      margin: 0;
      padding: 15px 30px;
      line-height: 1.5;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .invoice-page {
      max-width: 780px;
      margin: 0 auto;
      position: relative;
      overflow: hidden;
    }

    /* ── Watermark ── */
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      font-size: 120px;
      font-weight: 900;
      letter-spacing: 20px;
      opacity: 0.04;
      color: ${isPaid ? 'var(--success)' : 'var(--warning)'};
      pointer-events: none;
      z-index: 0;
      white-space: nowrap;
      user-select: none;
    }

    /* ── Header Band ── */
    .header-band {
      background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
      border-radius: 12px;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      position: relative;
      z-index: 1;
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .header-brand svg {
      width: 52px;
      height: 52px;
      flex-shrink: 0;
    }
    .header-brand-text h1 {
      font-size: 20px;
      font-weight: 800;
      color: #fff;
      letter-spacing: 0.5px;
    }
    .header-brand-text p {
      font-size: 11px;
      color: rgba(255,255,255,0.75);
      font-weight: 400;
      margin-top: 2px;
    }
    .header-invoice-label {
      text-align: right;
      color: #fff;
    }
    .header-invoice-label .inv-title {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: 3px;
      opacity: 0.9;
    }
    .header-invoice-label .inv-number {
      font-size: 13px;
      font-weight: 600;
      margin-top: 4px;
      opacity: 0.85;
    }

    /* ── Meta Row ── */
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      gap: 16px;
      position: relative;
      z-index: 1;
    }
    .meta-chips {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .meta-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .chip-date {
      background: var(--bg-subtle);
      border: 1px solid var(--border);
      color: var(--text-body);
    }
    .chip-status-paid {
      background: var(--success-bg);
      border: 1px solid #a7f3d0;
      color: var(--success);
    }
    .chip-status-unpaid {
      background: var(--warning-bg);
      border: 1px solid #fcd34d;
      color: var(--warning);
    }
    .chip-method {
      background: var(--primary-lighter);
      border: 1px solid #bfdbfe;
      color: var(--primary);
    }

    /* ── Billing Cards ── */
    .billing-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
      position: relative;
      z-index: 1;
    }
    .billing-card {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 18px;
      background: var(--bg-subtle);
    }
    .billing-card .label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: var(--text-light);
      margin-bottom: 10px;
    }
    .billing-card .name {
      font-size: 15px;
      font-weight: 800;
      color: var(--text-dark);
      margin-bottom: 6px;
    }
    .billing-card .detail {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.7;
    }
    .billing-card .license-key {
      display: inline-block;
      margin-top: 6px;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      font-weight: 700;
      color: var(--primary);
      background: var(--primary-lighter);
      padding: 4px 10px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }

    /* ── Item Table ── */
    .items-section {
      margin-bottom: 16px;
      position: relative;
      z-index: 1;
    }
    .items-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    .items-table thead th {
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 14px 18px;
      text-align: left;
    }
    .items-table thead th:last-child { text-align: right; }
    .items-table tbody td {
      padding: 10px 14px;
      font-size: 13px;
      border-bottom: 1px solid var(--border-light);
      vertical-align: top;
    }
    .items-table tbody tr:last-child td { border-bottom: none; }
    .items-table .product-name { font-weight: 700; color: var(--text-dark); font-size: 13px; }
    .items-table .product-desc { font-size: 11px; color: var(--text-muted); margin-top: 3px; }
    .items-table .price-cell { text-align: right; font-weight: 800; color: var(--text-dark); font-size: 14px; }

    /* ── Totals ── */
    .totals-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      gap: 20px;
      position: relative;
      z-index: 1;
    }
    .payment-notes {
      max-width: 380px;
      font-size: 11px;
      color: var(--text-muted);
      line-height: 1.6;
      padding: 10px 16px;
      background: var(--bg-subtle);
      border-radius: 10px;
      border: 1px solid var(--border);
    }
    .payment-notes strong { color: var(--text-body); }
    .totals-box {
      min-width: 240px;
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 20px;
      font-size: 12px;
    }
    .totals-row .t-label { color: var(--text-muted); font-weight: 500; }
    .totals-row .t-value { color: var(--text-dark); font-weight: 600; }
    .totals-row.grand {
      background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
      padding: 10px 20px;
    }
    .totals-row.grand .t-label { color: rgba(255,255,255,0.85); font-weight: 600; font-size: 12px; }
    .totals-row.grand .t-value { color: #fff; font-weight: 900; font-size: 18px; letter-spacing: 0.5px; }

    /* ── Divider ── */
    .section-divider {
      border: none;
      border-top: 1.5px dashed var(--border);
      margin: 16px 0;
    }

    /* ── Signatures ── */
    .signatures {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 10px;
      position: relative;
      z-index: 1;
    }
    .sig-box {
      width: 240px;
    }
    .sig-box .sig-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-light);
      margin-bottom: 45px;
    }
    .sig-box .sig-name {
      font-size: 13px;
      font-weight: 800;
      color: var(--text-dark);
      border-top: 1.5px solid var(--text-dark);
      padding-top: 6px;
    }
    .sig-box .sig-role {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .sig-stamp {
      position: relative;
      height: 80px;
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: -10px;
    }
    .sig-stamp .stamp-img {
      width: 95px;
      height: 95px;
      object-fit: contain;
      opacity: 0.3;
      transform: rotate(-12deg);
      position: absolute;
      z-index: 1;
      filter: drop-shadow(0px 0px 1px rgba(30, 64, 175, 0.5));
    }
    .sig-stamp .sig-cursive {
      font-family: 'Brush Script MT', 'Segoe Script', cursive;
      font-size: 28px;
      color: var(--primary);
      transform: rotate(-5deg);
      font-weight: bold;
      position: relative;
      z-index: 2;
    }

    /* ── Footer ── */
    .invoice-footer {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      position: relative;
      z-index: 1;
    }
    .footer-left {
      font-size: 10px;
      color: var(--text-light);
      line-height: 1.7;
    }
    .footer-verify {
      text-align: right;
      font-size: 10px;
      color: var(--text-light);
    }
    .footer-verify .verify-code {
      display: inline-block;
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      background: var(--bg-subtle);
      border: 1px solid var(--border);
      padding: 4px 10px;
      border-radius: 6px;
      letter-spacing: 1px;
      margin-top: 4px;
    }

    @media print {
      body { padding: 15px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .invoice-page { max-width: 100%; }
      .header-band { border-radius: 8px; }
      .watermark { position: absolute; }
    }
  </style>
</head>
<body>
  <!-- Watermark -->
  <div class="watermark">${statusLabel}</div>

  <div class="invoice-page">
    <!-- ── Header Band ── -->
    <div class="header-band">
      <div class="header-brand">
        <img src="logo.png" style="width: 52px; height: 52px; object-fit: contain; flex-shrink: 0; border-radius: 8px; background: rgba(255,255,255,0.15); padding: 4px;" alt="Absenta Logo">
        <div class="header-brand-text">
          <h1>${state.MAIN_DOMAIN.toUpperCase()}</h1>
          <p>Ekosistem & Solusi Digital Sekolah Terintegrasi</p>
        </div>
      </div>
      <div class="header-invoice-label">
        <div class="inv-title">INVOICE</div>
        <div class="inv-number">${inv.invoice_number}</div>
      </div>
    </div>

    <!-- ── Meta Chips ── -->
    <div class="meta-row">
      <div class="meta-chips">
        <span class="meta-chip chip-date">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${dateStr}
        </span>
        <span class="meta-chip ${isPaid ? 'chip-status-paid' : 'chip-status-unpaid'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="${isPaid ? 'M20 6L9 17l-5-5' : 'M12 8v4m0 4h.01'}"/>${isPaid ? '' : '<circle cx="12" cy="12" r="10"/>'}</svg>
          ${statusLabel}
        </span>
        <span class="meta-chip chip-method">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          ${payMethodLabel}
        </span>
      </div>
    </div>

    <!-- ── Billing Info ── -->
    <div class="billing-row">
      <div class="billing-card">
        <div class="label">Penerbit Layanan (Vendor)</div>
        <div class="name">BARAYA TEKNOLOGI</div>
        <div class="detail">
          Penyedia Solusi & Infrastruktur Digital Sekolah<br>
          barayatekindo@gmail.com &bull; +62 877-7993-7341<br>
          Purwakarta, Jawa Barat, Indonesia
        </div>
      </div>
      <div class="billing-card">
        <div class="label">Pelanggan (Sekolah)</div>
        <div class="name">${cleanSchoolName}</div>
        <div class="detail">
          Penerima Hak Akses Lisensi Ujian Sekolah<br>
          Kunci Lisensi:
        </div>
        <span class="license-key">${license.license_key}</span>
      </div>
    </div>

    <!-- ── Items Table ── -->
    <div class="items-section">
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 45%;">Deskripsi Produk / Layanan</th>
            <th>Masa Aktif</th>
            <th>Kapasitas</th>
            <th>Jumlah</th>
            <th style="text-align: right;">Harga</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div class="product-name">${productName} &mdash; Paket ${planTitle}</div>
              <div class="product-desc">${productDesc}. Termasuk dukungan teknis, pembaruan berkala, dan akses dashboard admin sekolah.</div>
            </td>
            <td>${planDuration}</td>
            <td>${capacityStr}</td>
            <td>1 Lisensi</td>
            <td class="price-cell">${planPrice}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── Totals & Notes ── -->
    <div class="totals-section">
      <div class="payment-notes">
        <strong>Catatan Pembayaran</strong><br>
        Metode: ${payMethodLabel} ${isPaid ? '(Terverifikasi)' : '(Menunggu Konfirmasi)'}<br><br>
        <em>Dokumen ini sah dan diterbitkan secara elektronik sebagai bukti transaksi pembayaran resmi untuk pelaporan SPJ Bantuan Operasional Sekolah (BOS). Tidak memerlukan tanda tangan basah.</em>
      </div>
      <div class="totals-box">
        <div class="totals-row" style="background: var(--bg-subtle);">
          <span class="t-label">Subtotal</span>
          <span class="t-value">${planPrice}</span>
        </div>
        <div class="totals-row">
          <span class="t-label">PPN (0%)</span>
          <span class="t-value">Rp 0</span>
        </div>
        <div class="totals-row">
          <span class="t-label">Diskon</span>
          <span class="t-value" style="color: var(--success);">- Rp 0</span>
        </div>
        <div class="totals-row grand">
          <span class="t-label">TOTAL</span>
          <span class="t-value">${planPrice}</span>
        </div>
      </div>
    </div>

    <!-- ── Signatures ── -->
    <hr class="section-divider">
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-label">Penerima Layanan (Sekolah)</div>
        <div class="sig-name">${cleanSchoolName}</div>
        <div class="sig-role">Kepala Sekolah / Bendahara</div>
      </div>
      <div class="sig-box" style="text-align: center;">
        <div class="sig-label" style="text-align: center;">Petugas Keuangan (Vendor)</div>
        <div class="sig-stamp">
          <img src="BTI-compact-logo.png" class="stamp-img" alt="Stempel BTI">
          <span class="sig-cursive">Baraya Tech</span>
        </div>
        <div class="sig-name" style="text-align: center;">Finance Department</div>
        <div class="sig-role" style="text-align: center;">Baraya Teknologi</div>
      </div>
    </div>

    <!-- ── Footer ── -->
    <div class="invoice-footer">
      <div class="footer-left">
        Invoice Elektronik &mdash; Diterbitkan oleh <strong>${state.MAIN_DOMAIN.toUpperCase()}</strong> (Baraya Teknologi)<br>
        Dokumen ini sah tanpa tanda tangan basah sesuai UU ITE No. 11 Tahun 2008.<br>
        Hubungi: barayatekindo@gmail.com | https://${state.MAIN_DOMAIN}
      </div>
      <div class="footer-verify">
        Kode Verifikasi<br>
        <span class="verify-code">${verifyHash}</span>
      </div>
    </div>
  </div>
</body>
</html>
  `);
  invoiceWindow.document.close();
  setTimeout(() => {
    invoiceWindow.print();
  }, 350);
}

export const menuItems = [
  { id: 'tab-licenses', label: 'Kunci Lisensi', icon: '🔑', title: 'Kunci Lisensi', desc: 'Kelola validasi kunci dan aktivasi perangkat sekolah secara live.' },
  { id: 'tab-packages', label: 'Paket Harga', icon: '🏷️', title: 'Manajemen Paket Harga', desc: 'Kelola konfigurasi harga, durasi aktif, kuota perangkat, dan promo paket per produk.' },
  { id: 'tab-subscriptions', label: 'Langganan (SaaS)', icon: '📋', title: 'Riwayat Langganan', desc: 'Pantau masa tenggang, status sekolah, dan durasi langganan aktif.' },
  { id: 'tab-invoices', label: 'Tagihan & Keuangan', icon: '🧾', title: 'Tagihan & Keuangan', desc: 'Kelola data transaksi keuangan, invoice BOS, dan status pembayaran.' },
  { id: 'tab-tenants', label: 'Monitoring Tenant', icon: '🏢', title: 'Database Tenants (Supabase)', desc: 'Pantau daftar sekolah terdaftar di database Supabase Cloud beserta status lisensi.' },
  { id: 'tab-logs', label: 'Log Audit Trail', icon: '🛡️', title: 'Log Audit Trail', desc: 'Audit trail aktivitas lisensi, IP Address, dan validasi device.' },
  { id: 'tab-settings', label: 'Pengaturan Sistem', icon: '⚙️', title: 'Pengaturan Sistem & Gateway', desc: 'Kelola gateway pembayaran aktif, toggle pembayaran manual, rekening bank, dan nomor support.' },
  { id: 'tab-wa', label: 'WA Gateway', icon: '📱', title: 'WhatsApp Gateway', desc: 'Pantau koneksi WhatsApp Web, status scan QR Code, dan uji coba pengiriman pesan.' },
  { id: 'tab-update', label: 'Pembaruan Server', icon: '🔄', title: 'Pembaruan Server Lisensi', desc: 'Periksa dan jalankan pembaruan server lisensi dari GitHub secara otomatis.' },
  { id: 'tab-caddy', label: 'Caddy Gateway', icon: '🛡️', title: 'Caddy HTTPS Gateway', desc: 'Pantau rute custom domain dinamis, status sertifikat SSL otomatis, dan kondisi web server Caddy.' }
];

export function renderSidebarMenu(activeTabId = 'tab-licenses') {
  const navContainer = document.getElementById('sidebarMenuNav');
  if (!navContainer) return;

  navContainer.innerHTML = '';
  menuItems.forEach(item => {
    const btn = document.createElement('button');
    btn.id = `btn-${item.id}`;
    btn.onclick = () => window.switchTab(item.id);
    
    const isActive = item.id === activeTabId;
    btn.className = isActive
      ? "w-full px-4 py-3 rounded-xl text-left text-xs font-bold uppercase tracking-wider flex items-center gap-3 transition-all duration-200 bg-blue-600 text-white shadow-lg shadow-blue-600/10 cursor-pointer"
      : "w-full px-4 py-3 rounded-xl text-left text-xs font-bold uppercase tracking-wider flex items-center gap-3 transition-all duration-200 text-slate-400 hover:text-white hover:bg-slate-900/50 cursor-pointer";

    btn.innerHTML = `<span>${item.icon}</span> ${item.label}`;
    navContainer.appendChild(btn);
  });
}

export function switchTab(tabId) {
  // Hide all tab panes
  document.getElementById('tab-licenses').classList.add('hidden');
  document.getElementById('tab-packages').classList.add('hidden');
  document.getElementById('tab-subscriptions').classList.add('hidden');
  document.getElementById('tab-invoices').classList.add('hidden');
  document.getElementById('tab-tenants').classList.add('hidden');
  document.getElementById('tab-logs').classList.add('hidden');
  document.getElementById('tab-settings').classList.add('hidden');
  if (document.getElementById('tab-update')) {
    document.getElementById('tab-update').classList.add('hidden');
  }
  if (document.getElementById('tab-caddy')) {
    document.getElementById('tab-caddy').classList.add('hidden');
  }
  if (document.getElementById('tab-wa')) {
    document.getElementById('tab-wa').classList.add('hidden');
  }

  // Show targeted tab pane
  const targetPane = document.getElementById(tabId);
  if (targetPane) targetPane.classList.remove('hidden');

  // Update Page Title and Description dynamically in header
  const pageTitle = document.getElementById('pageTitle');
  const pageDescription = document.getElementById('pageDescription');
  const item = menuItems.find(x => x.id === tabId);
  if (item && pageTitle && pageDescription) {
    pageTitle.textContent = item.title;
    pageDescription.textContent = item.desc;
  }

  // Redraw active classes on sidebar buttons
  renderSidebarMenu(tabId);
}

export function renderTenantsTable(list) {
  const tenantsTableBody = document.getElementById('tenantsTableBody');
  if (!tenantsTableBody) return;
  tenantsTableBody.innerHTML = '';
  
  if (list.length === 0) {
    tenantsTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-slate-500 font-medium">Tidak ada database tenant terdaftar di Supabase.</td>
      </tr>
    `;
    return;
  }

  list.forEach(tenant => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-800/20 transition-all duration-200";

    // 1. Map badge status lisensi
    let statusBadge = '';
    if (tenant.license_status === 'active') {
      statusBadge = `<span class="bg-emerald-500/10 text-emerald-500 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">🟢 AKTIF BERLISENSI</span>`;
    } else if (tenant.license_status === 'pending' || tenant.license_status === 'pending_association') {
      statusBadge = `<span class="bg-amber-500/10 text-amber-500 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-amber-500/20 uppercase tracking-widest">⏳ MENUNGGU BAYAR</span>`;
    } else if (tenant.license_status === 'expired') {
      statusBadge = `<span class="bg-red-500/10 text-red-400 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-red-500/20 uppercase tracking-widest">🔴 KEDALUWARSA</span>`;
    } else {
      statusBadge = `<span class="bg-slate-500/10 text-slate-400 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-slate-700/20 uppercase tracking-widest">⚪ BELUM BERLISENSI</span>`;
    }

    // 2. Format created date
    const dateStr = tenant.created_at ? formatIndonesianDate(tenant.created_at.slice(0, 10)) : '-';
    const expiryStr = tenant.license_expiry ? (tenant.license_expiry === '-' ? '-' : formatIndonesianDate(tenant.license_expiry)) : '-';

    tr.innerHTML = `
      <td class="p-4 font-bold text-white">${tenant.name}</td>
      <td class="p-4">
        <a href="https://${tenant.domain_or_slug}.${state.MAIN_DOMAIN}" target="_blank" class="hover:underline text-blue-400 font-bold text-xs flex items-center gap-1">
          <code class="bg-slate-900/60 px-2 py-0.5 rounded text-blue-400 font-bold text-xs cursor-pointer">${tenant.domain_or_slug}.${state.MAIN_DOMAIN}</code>
          <span>🔗</span>
        </a>
      </td>
      <td class="p-4"><code class="bg-slate-900/60 px-2 py-0.5 rounded text-slate-300 font-mono text-xs">${tenant.license_key || '-'}</code></td>
      <td class="p-4 font-semibold text-slate-400">${dateStr}</td>
      <td class="p-4 font-semibold text-slate-400">${expiryStr}</td>
      <td class="p-4">${statusBadge}</td>
      <td class="p-4 text-right">
        <a href="/admin/tenant-detail?id=${tenant.id}" class="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-bold px-3 py-1.5 rounded-lg transition-all">
          🔍 Detail
        </a>
      </td>
    `;
    tenantsTableBody.appendChild(tr);
  });
}

