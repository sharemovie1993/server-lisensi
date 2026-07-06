"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderInvoiceTemplate = renderInvoiceTemplate;
exports.formatIndonesianDate = formatIndonesianDate;
function renderInvoiceTemplate(data) {
    const { invoiceNumber, cleanSchoolName, dateStr, statusLabel, isPaid, isExpired = false, payMethodLabel, licenseKey, productName, planTitle, productDesc, planDuration, capacityStr, planPrice, adminFee, totalPrice, verifyHash, items } = data;
    const statusColor = isPaid
        ? 'var(--success)'
        : (isExpired ? 'var(--text-muted)' : 'var(--warning)');
    const statusBg = isPaid
        ? 'var(--success-bg)'
        : (isExpired ? '#f1f5f9' : 'var(--warning-bg)');
    const statusBorder = isPaid
        ? 'rgba(5, 150, 105, 0.15)'
        : (isExpired ? 'rgba(148, 163, 184, 0.25)' : 'rgba(217, 119, 6, 0.15)');
    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoiceNumber} - ${cleanSchoolName}</title>
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
      color: ${statusColor};
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
      height: auto;
      fill: #fff;
    }
    .header-brand h1 {
      color: #fff;
      font-size: 24px;
      font-weight: 900;
      letter-spacing: -0.5px;
    }
    .header-band .meta-box {
      text-align: right;
      color: rgba(255, 255, 255, 0.95);
    }
    .header-band .meta-box h2 {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 1px;
      color: #fff;
    }
    .header-band .meta-box p {
      font-size: 12px;
      font-weight: 500;
      margin-top: 4px;
      color: rgba(255, 255, 255, 0.8);
    }

    /* ── Badge Status ── */
    .status-badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-align: center;
      text-transform: uppercase;
      color: ${statusColor};
      background-color: ${statusBg};
      border: 1px solid ${statusBorder};
    }

    /* ── Info Grid ── */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 24px;
      position: relative;
      z-index: 1;
    }
    .info-card {
      background: var(--bg-subtle);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    .info-card h3 {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1px;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-bottom: 10px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 4px;
    }
    .info-card p {
      font-size: 13px;
      margin-bottom: 4px;
      color: var(--text-body);
    }
    .info-card p strong {
      color: var(--text-dark);
    }

    /* ── Table ── */
    .table-container {
      margin-bottom: 24px;
      position: relative;
      z-index: 1;
    }
    .invoice-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      text-align: left;
    }
    .invoice-table th {
      background: var(--bg-subtle);
      color: var(--text-muted);
      font-weight: 700;
      padding: 10px 14px;
      border-top: 1px solid var(--border);
      border-bottom: 2px solid var(--border);
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    .invoice-table td {
      padding: 14px;
      border-bottom: 1px solid var(--border-light);
      vertical-align: top;
      color: var(--text-body);
    }
    .invoice-table tr:last-child td {
      border-bottom: 1px solid var(--border);
    }
    .invoice-table .product-name {
      font-weight: 700;
      color: var(--text-dark);
      margin-bottom: 4px;
    }
    .invoice-table .product-desc {
      font-size: 11.5px;
      color: var(--text-muted);
      line-height: 1.4;
    }
    .invoice-table .price-cell {
      font-weight: 700;
      color: var(--text-dark);
      text-align: right;
    }
    .invoice-table th:last-child, .invoice-table td:last-child {
      text-align: right;
    }

    /* ── Totals ── */
    .totals-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 40px;
      margin-bottom: 30px;
      position: relative;
      z-index: 1;
    }
    .payment-notes {
      flex: 1.2;
      font-size: 11px;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .payment-notes strong {
      color: var(--text-dark);
    }
    .totals-box {
      flex: 0.8;
      background: var(--bg-subtle);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      width: 100%;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      padding: 6px 8px;
      color: var(--text-body);
    }
    .totals-row.grand {
      font-size: 15px;
      font-weight: 800;
      color: var(--primary);
      border-top: 1px solid var(--border);
      padding-top: 10px;
      margin-top: 6px;
    }

    /* ── Signatures ── */
    .signatures {
      display: flex;
      justify-content: space-between;
      margin: 20px 0;
      position: relative;
      z-index: 1;
    }
    .sig-box {
      flex: 1;
      max-width: 250px;
    }
    .sig-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 45px;
    }
    .sig-stamp {
      position: relative;
      display: inline-block;
      margin-bottom: -15px;
    }
    .stamp-img {
      position: absolute;
      width: 90px;
      height: auto;
      opacity: 0.75;
      top: -38px;
      left: -20px;
      pointer-events: none;
      z-index: 0;
    }
    .sig-cursive {
      font-family: 'Georgia', serif;
      font-style: italic;
      font-size: 16px;
      color: var(--primary);
      font-weight: 700;
      position: relative;
      z-index: 1;
      display: inline-block;
      margin-left: 20px;
    }
    .sig-name {
      font-weight: 700;
      font-size: 13px;
      color: var(--text-dark);
      margin-bottom: 2px;
    }
    .sig-role {
      font-size: 11px;
      color: var(--text-muted);
    }

    /* ── Footer ── */
    .section-divider {
      border: 0;
      border-top: 1px solid var(--border);
      margin: 24px 0 16px 0;
    }
    .invoice-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10.5px;
      color: var(--text-muted);
      line-height: 1.4;
    }
    .footer-verify {
      text-align: right;
    }
    .verify-code {
      font-family: monospace;
      font-size: 12px;
      font-weight: 700;
      color: var(--text-dark);
      letter-spacing: 0.5px;
    }

    @media print {
      body { padding: 0; background: #fff; }
      .header-band { background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%) !important; }
      .status-badge { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .info-card, .totals-box, .invoice-table th { background: var(--bg-subtle) !important; }
    }
  </style>
</head>
<body>
  <div class="invoice-page">
    <div class="watermark">${statusLabel}</div>
    
    <!-- ── Header Band ── -->
    <div class="header-band">
      <div class="header-brand">
        <svg viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
        <h1>BARAYA TEKNOLOGI</h1>
      </div>
      <div class="meta-box">
        <h2>INVOICE</h2>
        <p>${invoiceNumber}</p>
      </div>
    </div>

    <!-- ── Info Grid ── -->
    <div class="info-grid">
      <div class="info-card">
        <h3>Diterbitkan Untuk</h3>
        <p><strong>Lembaga:</strong> ${cleanSchoolName}</p>
        <p><strong>Kunci Lisensi:</strong> <code>${licenseKey}</code></p>
        <p><strong>Tanggal Transaksi:</strong> ${dateStr}</p>
      </div>
      <div class="info-card" style="text-align: right;">
        <h3>Status Pembayaran</h3>
        <div style="margin-bottom: 8px;">
          <span class="status-badge">${statusLabel}</span>
        </div>
        <p>Metode: <strong>${payMethodLabel}</strong></p>
        <p>Verifikasi: <strong>${isPaid ? 'Otomatis Sistem' : 'Menunggu Konfirmasi'}</strong></p>
      </div>
    </div>

    <!-- ── Table Items ── -->
    <div class="table-container">
      <table class="invoice-table">
        <thead>
          <tr>
            <th style="width: 50%;">Deskripsi Layanan</th>
            <th>Durasi</th>
            <th>Kapasitas</th>
            <th>Jumlah</th>
            <th style="text-align: right;">Total Harga</th>
          </tr>
        </thead>
        <tbody>
          ${items && items.length > 0 ? items.map(item => `
          <tr>
            <td>
              <div class="product-name">${item.name}</div>
              <div class="product-desc">${item.desc}</div>
            </td>
            <td>${item.duration}</td>
            <td>${item.capacity}</td>
            <td>${item.quantity}</td>
            <td class="price-cell">Rp ${item.price.toLocaleString('id-ID')}</td>
          </tr>
          `).join('') : `
          <tr>
            <td>
              <div class="product-name">${productName} &mdash; ${planTitle}</div>
              <div class="product-desc">${productDesc.endsWith('.') ? productDesc : productDesc + '.'} Termasuk dukungan teknis, pembaruan berkala, dan akses dashboard admin.</div>
            </td>
            <td>${planDuration}</td>
            <td>${capacityStr}</td>
            <td>1 Lisensi</td>
            <td class="price-cell">${planPrice}</td>
          </tr>
          `}
        </tbody>
      </table>
    </div>

    <!-- ── Totals & Notes ── -->
    <div class="totals-section">
      <div class="payment-notes">
        <strong>Catatan Pembayaran</strong><br>
        Metode: ${payMethodLabel} ${isPaid ? '(Terverifikasi)' : '(Menunggu Konfirmasi)'}<br><br>
        <em>Dokumen ini sah dan diterbitkan secara elektronik sebagai bukti transaksi pembayaran resmi untuk pelaporan SPJ Bantuan Operasional Lembaga. Tidak memerlukan tanda tangan basah.</em>
      </div>
      <div class="totals-box">
        <div class="totals-row" style="background: var(--bg-subtle);">
          <span class="t-label">Subtotal</span>
          <span class="t-value">${planPrice}</span>
        </div>
        ${adminFee && adminFee !== 'Rp 0' ? `
        <div class="totals-row">
          <span class="t-label">Biaya Transaksi / Admin</span>
          <span class="t-value">${adminFee}</span>
        </div>
        ` : ''}
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
          <span class="t-value">${totalPrice}</span>
        </div>
      </div>
    </div>

    <!-- ── Signatures ── -->
    <hr class="section-divider">
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-label">Penerima Layanan (Lembaga)</div>
        <div class="sig-name">${cleanSchoolName}</div>
        <div class="sig-role">Pimpinan / Bendahara Lembaga</div>
      </div>
      <div class="sig-box" style="text-align: center;">
        <div class="sig-label" style="text-align: center;">Petugas Keuangan (Vendor)</div>
        <div class="sig-stamp">
          <img src="/BTI-compact-logo.png" class="stamp-img" alt="Stempel BTI">
          <span class="sig-cursive">Baraya Tech</span>
        </div>
        <div class="sig-name" style="text-align: center;">Finance Department</div>
        <div class="sig-role" style="text-align: center;">Baraya Teknologi</div>
      </div>
    </div>

    <!-- ── Footer ── -->
    <div class="invoice-footer">
      <div class="footer-left">
        Invoice Elektronik &mdash; Diterbitkan oleh <strong>Baraya Teknologi</strong><br>
        Dokumen ini sah tanpa tanda tangan basah sesuai UU ITE No. 11 Tahun 2008.<br>
        Hubungi: barayatekindo@gmail.com | https://absenta.id
      </div>
      <div class="footer-verify">
        Kode Verifikasi<br>
        <span class="verify-code">${verifyHash}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}
function formatIndonesianDate(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length !== 3)
        return dateStr;
    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const day = parseInt(parts[2], 10);
    const month = months[parseInt(parts[1], 10) - 1];
    const year = parts[0];
    return `${day} ${month} ${year}`;
}
