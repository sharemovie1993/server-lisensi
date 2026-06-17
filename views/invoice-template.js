module.exports = function (data) {
  const {
    invoiceNumber,
    cleanSchoolName,
    dateStr,
    statusLabel,
    isPaid,
    payMethodLabel,
    licenseKey,
    productName,
    planTitle,
    productDesc,
    planDuration,
    capacityStr,
    planPrice,
    verifyHash
  } = data;

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
<body onload="setTimeout(()=>window.print(), 300)">
  <!-- Watermark -->
  <div class="watermark">${statusLabel}</div>

  <div class="invoice-page">
    <!-- ── Header Band ── -->
    <div class="header-band">
      <div class="header-brand">
        <img src="/logo.png" style="width: 52px; height: 52px; object-fit: contain; flex-shrink: 0; border-radius: 8px; background: rgba(255,255,255,0.15); padding: 4px;" alt="Logo">
        <div class="header-brand-text">
          <h1>${productName.toUpperCase()}</h1>
          <p>${productDesc}</p>
        </div>
      </div>
      <div class="header-invoice-label">
        <div class="inv-title">INVOICE</div>
        <div class="inv-number">${invoiceNumber}</div>
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
          Penyedia Solusi & Infrastruktur Digital Lembaga<br>
          barayatekindo@gmail.com &bull; +62 877-7993-7341<br>
          Purwakarta, Jawa Barat, Indonesia
        </div>
      </div>
      <div class="billing-card">
        <div class="label">Pelanggan (Lembaga)</div>
        <div class="name">${cleanSchoolName}</div>
        <div class="detail">
          Penerima Hak Akses Lisensi Layanan Digital<br>
          Kunci Lisensi:
        </div>
        <span class="license-key">${licenseKey}</span>
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
          ${(data.items && data.items.length > 0) ? data.items.map(item => `
          <tr>
            <td>
              <div class="product-name">${item.name}</div>
              <div class="product-desc">${item.desc}</div>
            </td>
            <td>${item.duration}</td>
            <td>${item.capacity}</td>
            <td>${item.quantity || '1 Lisensi'}</td>
            <td class="price-cell">Rp ${item.price.toLocaleString('id-ID')}</td>
          </tr>
          `).join('') : `
          <tr>
            <td>
              <div class="product-name">${productName} &mdash; ${planTitle}</div>
              <div class="product-desc">${productDesc}. Termasuk dukungan teknis, pembaruan berkala, dan akses dashboard admin.</div>
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
};
