const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');

const { db } = require('../config/db');
const { PUBLIC_KEY, PRIVATE_KEY, TRIPAY_API_KEY, TRIPAY_PRIVATE_KEY, TRIPAY_MERCHANT_CODE, TRIPAY_API_URL, ADMIN_SECRET } = require('../config/keys');
const { logLicenseActivity } = require('../utils/logger');
const { generateKey, formatIndonesianDate } = require('../utils/helpers');
const { triggerCaddySync } = require('../utils/caddy');
const renderInvoiceTemplate = require('../views/invoice-template');

// ── RATE LIMITING MIDDLEWARE ──
const activationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan aktivasi dari perangkat Anda. Silakan coba sesaat lagi.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const licenseRequestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Terlalu banyak pengajuan lisensi dari perangkat Anda. Mohon tunggu 10 menit sebelum mencoba lagi.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const statusCheckLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan status checking dari perangkat Anda.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── HELPER: Automated dynamic Nginx & Certbot SSL setup ──
function provisionNginxAndSsl(slug) {
  const { exec } = require('child_process');
  const fs = require('fs');

  const domain = `${slug}.${process.env.MAIN_DOMAIN}`;
  const configPath = `/etc/nginx/sites-available/${domain}`;
  const enabledPath = `/etc/nginx/sites-enabled/${domain}`;

  console.log(`[SSL Provisioning] Starting automated Nginx and SSL setup for: ${domain}`);

  const nginxConfig = `server {
    server_name ${domain};
    root /var/www/${process.env.MAIN_DOMAIN}; # Points to the central catch-all web client
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
`;

  try {
    fs.writeFileSync(configPath, nginxConfig);
    console.log(`[SSL Provisioning] Nginx config written to: ${configPath}`);

    if (!fs.existsSync(enabledPath)) {
      fs.symlinkSync(configPath, enabledPath);
      console.log(`[SSL Provisioning] Created Nginx symlink at: ${enabledPath}`);
    }

    exec('nginx -t && systemctl reload nginx', (err, stdout, stderr) => {
      if (err) {
        console.error('[SSL Provisioning] Nginx reload failed:', stderr || stdout);
        return;
      }
      console.log('[SSL Provisioning] Nginx configuration verified and reloaded.');

      console.log(`[SSL Provisioning] Requesting Certbot SSL certificate for ${domain}...`);
      const certbotCmd = `certbot --nginx -d ${domain} --non-interactive --agree-tos --email 119asepsuryadi@gmail.com --redirect`;
      
      exec(certbotCmd, (certErr, certStdout, certStderr) => {
        if (certErr) {
          console.error('[SSL Provisioning] Certbot failed:', certStderr || certStdout);
          return;
        }
        console.log(`[SSL Provisioning] Certbot successfully generated SSL and configured Nginx for ${domain}!`);
        
        exec('systemctl reload nginx', (reloadErr) => {
          if (reloadErr) console.error('[SSL Provisioning] Final Nginx reload failed');
          else console.log(`[SSL Provisioning] Dynamic SSL configuration completely live for https://${domain}!`);
        });
      });
    });
  } catch (err) {
    console.error('[SSL Provisioning] Error during automated file writing:', err.message);
  }
}

// ── CLIENT ROUTES ──

// 1. Get packages configurations
router.get('/api/license/packages', async (req, res) => {
  const { product_id } = req.query;
  const productId = product_id || 'gform-orkestrator';
  try {
    let list;
    if (productId === 'absenta' || productId === 'platform-absenta') {
      list = await db.all(
        "SELECT * FROM pricing_plans WHERE product_id = 'absenta' OR product_id = 'platform-absenta' OR product_id LIKE 'absenta-module-%'"
      );
    } else {
      list = await db.all('SELECT * FROM pricing_plans WHERE product_id = ?', [productId]);
    }
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil konfigurasi paket.' });
  }
});

// 2. Get Public JWT verification key
router.get('/api/license/public-key', (req, res) => {
  res.json({ success: true, public_key: PUBLIC_KEY });
});

// 2b. Get Public System Settings (active gateway, manual transfer details, support whatsapp)
router.get('/api/license/system-config', async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM system_settings');
    const settings = {};
    list.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat konfigurasi sistem pembayaran.' });
  }
});

// Global in-memory cache for Tripay payment channels
let paymentChannelsCache = null;
let cacheExpirationTime = 0;

// Hardcoded premium fallback payment channels (in case of Tripay API completely down & empty cache)
const FALLBACK_PAYMENT_CHANNELS = [
  { group: "Virtual Account", code: "BCAVA", name: "BCA Virtual Account", type: "direct", active: true, fee_flat: 5500, fee_percent: 0, icon_url: "https://assets.tripay.co.id/upload/payment-icon/ytBKvaleGy1605201833.png" },
  { group: "Virtual Account", code: "BNIVA", name: "BNI Virtual Account", type: "direct", active: true, fee_flat: 4250, fee_percent: 0, icon_url: "https://assets.tripay.co.id/upload/payment-icon/n22Qsh8jMa1583433577.png" },
  { group: "Virtual Account", code: "BRIVA", name: "BRI Virtual Account", type: "direct", active: true, fee_flat: 4250, fee_percent: 0, icon_url: "https://assets.tripay.co.id/upload/payment-icon/8WQ3APST5s1579461828.png" },
  { group: "Virtual Account", code: "MANDIRIVA", name: "Mandiri Virtual Account", type: "direct", active: true, fee_flat: 4250, fee_percent: 0, icon_url: "https://assets.tripay.co.id/upload/payment-icon/T9Z012UE331583531536.png" },
  { group: "Virtual Account", code: "PERMATAVA", name: "Permata Virtual Account", type: "direct", active: true, fee_flat: 4250, fee_percent: 0, icon_url: "https://assets.tripay.co.id/upload/payment-icon/szezRhAALB1583408731.png" },
  { group: "E-Wallet", code: "QRIS", name: "QRIS by ShopeePay", type: "direct", active: true, fee_flat: 750, fee_percent: 0.7, icon_url: "https://assets.tripay.co.id/upload/payment-icon/BpE4BPVyIw1605597490.png" }
];

// 3. Get Tripay payment channels list with robust caching & offline fallback
router.get('/api/license/payment-channels', async (req, res) => {
  const currentTime = Date.now();
  
  // 1. Return cache if it is still fresh (valid for 1 hour)
  if (paymentChannelsCache && currentTime < cacheExpirationTime) {
    console.log('[Payment Channels Cache] Serving payment channels from fresh memory cache.');
    return res.json({ success: true, gateway_online: true, message: 'Success', data: paymentChannelsCache });
  }

  try {
    const fetch = require('node-fetch');
    
    if (!TRIPAY_API_URL || !TRIPAY_API_KEY) {
      throw new Error('Tripay credentials are not properly configured.');
    }

    const response = await fetch(`${TRIPAY_API_URL}/merchant/payment-channel`, {
      headers: { 'Authorization': `Bearer ${TRIPAY_API_KEY}` },
      timeout: 2000 // 2s — keep well under Cloudflare's origin timeout
    });
    
    const data = await response.json();
    
    if (data.success && Array.isArray(data.data)) {
      // Map properties to flat fee_flat and fee_percent with robust defensive fallbacks
      const mappedData = data.data.map(channel => {
        const feeFlat = channel && channel.fee_customer && typeof channel.fee_customer.flat !== 'undefined'
          ? (parseInt(channel.fee_customer.flat, 10) || 0)
          : 0;
        const feePercent = channel && channel.fee_customer && typeof channel.fee_customer.percent !== 'undefined'
          ? (parseFloat(channel.fee_customer.percent) || 0)
          : 0;
        return {
          ...channel,
          fee_flat: feeFlat,
          fee_percent: feePercent
        };
      });
      
      // Update memory cache
      paymentChannelsCache = mappedData;
      cacheExpirationTime = currentTime + (60 * 60 * 1000); // 1 hour expiration
      console.log('[Payment Channels Cache] Successfully updated payment channels memory cache.');
      
      return res.json({ success: true, gateway_online: true, message: 'Success', data: mappedData });
    }
    
    // If API responded but not success, throw to trigger fallback
    throw new Error(data.message || 'API responded with success=false');
  } catch (err) {
    console.error('[payment-channels API Error] Fetching Tripay failed:', err.message);
    
    // 2. STALE FALLBACK: If API fails but we have stale cache, serve it
    if (paymentChannelsCache) {
      console.log('[Payment Channels Fallback] Tripay down. Serving stale payment channels from memory.');
      return res.json({ success: true, gateway_online: false, message: 'Serving from stale cache due to gateway error', data: paymentChannelsCache });
    }
    
    // 3. OFFLINE FALLBACK: If completely no cache, serve hardcoded backup list
    console.log('[Payment Channels Fallback] Tripay down & cache empty. Serving robust offline payment channels list.');
    return res.json({ 
      success: true,
      gateway_online: false,
      message: 'Serving offline fallback payment methods', 
      data: FALLBACK_PAYMENT_CHANNELS 
    });
  }
});

// 4. Request license key creation with billing (Tripay QRIS / Bank Transfer)
router.post('/api/license/request', licenseRequestLimiter, async (req, res) => {
  const { school_name, device_limit, is_unlimited, product_id, plan_id, payment_method, requested_slug, requested_supabase_url, requested_supabase_anon_key, include_vpn, renew_license_key } = req.body;

  let existingLicense = null;
  let resolvedSchoolName = school_name;
  let resolvedLimit = device_limit;

  if (renew_license_key) {
    try {
      existingLicense = await db.get("SELECT * FROM licenses WHERE license_key = ?", [renew_license_key.trim()]);
      if (!existingLicense) {
        return res.status(404).json({ success: false, message: 'Lisensi yang akan diperpanjang tidak ditemukan.' });
      }
      resolvedSchoolName = existingLicense.school_name;
      resolvedLimit = existingLicense.device_limit;
    } catch (err) {
      console.error('[License Renewal Check Error]', err);
      return res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem saat memeriksa lisensi perpanjangan.' });
    }
  }

  if (!resolvedSchoolName || resolvedLimit === undefined || resolvedLimit === null) {
    return res.status(400).json({ success: false, message: 'Nama Sekolah dan Limit Perangkat wajib diisi.' });
  }

  const prodId = existingLicense ? existingLicense.product_id : (product_id || 'gform-orkestrator');
  const limit = (resolvedLimit !== undefined && resolvedLimit !== null) ? parseInt(resolvedLimit, 10) : 10;
  const isUnlimited = existingLicense ? existingLicense.is_unlimited : ((is_unlimited === 1 || is_unlimited === true || limit >= 9999) ? 1 : 0);
  const resolvedSlug = existingLicense ? existingLicense.requested_slug : requested_slug;
  const resolvedSupabaseUrl = existingLicense ? existingLicense.requested_supabase_url : requested_supabase_url;
  const resolvedSupabaseAnonKey = existingLicense ? existingLicense.requested_supabase_anon_key : requested_supabase_anon_key;
  const resolvedIncludeVpn = existingLicense ? existingLicense.include_vpn : (include_vpn === 1 || include_vpn === true || include_vpn === '1');
  
  let productPrefix = null;
  try {
    const prodDb = await db.get("SELECT key_prefix FROM products WHERE id = ?", [prodId]);
    if (prodDb && prodDb.key_prefix) {
      productPrefix = prodDb.key_prefix;
    }
  } catch (e) {
    console.error('[License Request] Failed to fetch product key prefix:', e.message);
  }
  const newKey = existingLicense ? existingLicense.license_key : generateKey(prodId, productPrefix);
  
  const placeholderExpire = new Date();
  placeholderExpire.setFullYear(placeholderExpire.getFullYear() + 1);
  const expiresStr = placeholderExpire.toISOString().slice(0, 10);

  try {
    let isRecovery = existingLicense ? 1 : 0;

    // Validasi domain/slug yang sudah ada untuk menghindari redundansi domain registrasi
    if (resolvedSlug && !existingLicense) {
      const cleanSlug = resolvedSlug.trim().toLowerCase();
      
      const getTenantFromSupabase = (slug) => {
        return new Promise((resolve) => {
          const https = require('https');
          const options = {
            hostname: `supabaselocal.${process.env.MAIN_DOMAIN}`,
            port: 443,
            path: `/rest/v1/tenants?domain_or_slug=eq.${slug}&select=id,name,domain_or_slug,license_key`,
            method: 'GET',
            headers: {
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE',
              'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE'
            }
          };

          const request = https.request(options, (response) => {
            let body = '';
            response.on('data', (chunk) => body += chunk);
            response.on('end', () => {
              if (response.statusCode >= 200 && response.statusCode < 300) {
                try {
                  const arr = JSON.parse(body);
                  resolve(arr.length > 0 ? arr[0] : null);
                } catch (e) {
                  resolve(null);
                }
              } else {
                resolve(null);
              }
            });
          });

          request.on('error', () => resolve(null));
          request.end();
        });
      };

      // 1. Cek ketersediaan di database Master Supabase terlebih dahulu
      const supabaseTenant = await getTenantFromSupabase(cleanSlug);
      if (supabaseTenant) {
        // Jika sudah ada di database Supabase (meski status belum berlisensi/expired), ini PASTI recovery/perpanjangan
        isRecovery = 1;
      } else {
        // 2. Jika tidak ada di Supabase, cek antrean di SQLite lokal
        const existingSlug = await db.get(
          "SELECT id, school_name, status FROM licenses WHERE LOWER(requested_slug) = ? AND product_id = ?",
          [cleanSlug, prodId]
        );
        if (existingSlug) {
          if (existingSlug.status === 'expired') {
            // Recovery mode! The user owns an expired domain and wants to renew it.
            isRecovery = 1;
          } else {
            // The domain is actively used by someone else
            return res.status(400).json({ 
              success: false, 
              message: `Subdomain / Slug '${cleanSlug}' sudah digunakan oleh ${existingSlug.school_name}. Silakan gunakan subdomain yang berbeda.` 
            });
          }
        }
      }
    }

    let resolvedPlanId = plan_id;
    if (!resolvedPlanId) {
      if (prodId === 'absenta') {
        resolvedPlanId = limit >= 400 ? 'absenta_annual' : (limit >= 150 ? 'absenta_semester' : 'absenta_monthly');
      } else {
        resolvedPlanId = isUnlimited ? 'annual' : 'monthly';
      }
    }

    const plan = await db.get("SELECT * FROM pricing_plans WHERE id = ?", [resolvedPlanId]) || {
      id: resolvedPlanId,
      title: isUnlimited ? 'Tahunan' : 'Bulanan',
      price: req.body.price || req.body.amount || (isUnlimited ? 'Rp 1.199.000' : 'Rp 299.000')
    };

    const activeGatewayRow = await db.get("SELECT value FROM system_settings WHERE key = 'active_gateway'") || { value: 'tripay' };
    const activeGateway = activeGatewayRow.value || 'tripay';

    let vpnPlan = null;
    let vpnPrice = 0;
    if (resolvedIncludeVpn) {
      vpnPlan = await db.get("SELECT * FROM pricing_plans WHERE id = 'vpn_monthly'");
      if (vpnPlan) {
        vpnPrice = parseInt(vpnPlan.price.replace(/[^\d]/g, ''), 10) || 50000;
      }
    }

    let basePrice = parseInt(String(plan.price || '').replace(/[^\d]/g, ''), 10) || 0;
    if (vpnPrice > 0) {
      basePrice += vpnPrice;
    }

    const randomPrefix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-ORK-${randomPrefix}-${new Date().getFullYear()}`;

    // ──────── MANAJEMEN PRODUK GRATIS (REGISTRASI SAJA) ────────
    if (basePrice === 0) {
      let licenseId;
      if (existingLicense) {
        licenseId = existingLicense.id;
      } else {
        await db.run(
          "INSERT INTO licenses (license_key, product_id, school_name, device_limit, is_unlimited, expires_at, status, is_active, plan_id, requested_slug, requested_supabase_url, requested_supabase_anon_key, is_recovery, include_vpn) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?, ?, ?)",
          [newKey, prodId, resolvedSchoolName.trim(), limit, isUnlimited, expiresStr, plan.id, resolvedSlug || null, resolvedSupabaseUrl || null, resolvedSupabaseAnonKey || null, isRecovery, vpnPlan ? 1 : 0]
        );

        const insertedLicense = await db.get("SELECT id FROM licenses WHERE license_key = ?", [newKey]);
        licenseId = insertedLicense ? insertedLicense.id : null;

        await db.run(
          "INSERT INTO subscriptions (license_id, school_name, product_id, plan_id, status) VALUES (?, ?, ?, ?, 'pending')",
          [licenseId, resolvedSchoolName.trim(), prodId, plan.id]
        );
      }

      await db.run(
        "INSERT INTO invoices (invoice_number, license_id, school_name, product_id, plan_title, amount, status, payment_method, payment_instructions, expired_time, paid_at, plan_id) VALUES (?, ?, ?, ?, ?, 0, 'paid', 'Gateway', ?, ?, (datetime('now', 'localtime')), ?)",
        [
          invoiceNumber,
          licenseId,
          resolvedSchoolName.trim(),
          prodId,
          plan.title,
          JSON.stringify([{ title: "Registrasi Berhasil", steps: ["Lisensi Anda telah terdaftar sebagai produk Platform-Absenta.", "Status: Menunggu Persetujuan Admin.", "Anda dapat langsung mengaktifkan lisensi ini di dashboard admin."] }]),
          Math.floor(Date.now() / 1000) + (365 * 24 * 3600),
          plan.id
        ]
      );

      await logLicenseActivity(newKey, prodId, null, req.ip, 'REQUEST_FREE_REGISTRATION_SUCCESS');

      return res.json({
        success: true,
        message: 'Registrasi Platform-Absenta berhasil. Silakan hubungi admin untuk aktivasi (Tanpa Bukti Bayar).',
        data: {
          license_key: newKey,
          invoice_number: invoiceNumber,
          amount: 0,
          payment_method: 'Free Registration',
          status: 'pending_approval',
          is_free_product: true
        }
      });
    }

    // ──────── MANAJEMEN TRANSAKSI MANUAL ────────
    if (payment_method === 'manual' || payment_method === 'Manual') {
      const bankNameRow = await db.get("SELECT value FROM system_settings WHERE key = 'manual_bank_name'") || { value: 'BCA' };
      const bankAccNoRow = await db.get("SELECT value FROM system_settings WHERE key = 'manual_account_number'") || { value: '8123-049-182' };
      const bankAccNameRow = await db.get("SELECT value FROM system_settings WHERE key = 'manual_account_name'") || { value: 'Baraya Teknologi' };
      const waNumberRow = await db.get("SELECT value FROM system_settings WHERE key = 'whatsapp_number'") || { value: '6287779937341' };

      const instructions = [
        {
          title: "Transfer Bank Manual",
          steps: [
            `Lakukan transfer ke rekening ${bankNameRow.value} berikut:`,
            `Nomor Rekening: ${bankAccNoRow.value}`,
            `Atas Nama: ${bankAccNameRow.value}`,
            `Nominal Transfer: Rp ${basePrice.toLocaleString('id-ID')}`,
            `Setelah melakukan transfer, wajib klik tombol "Konfirmasi WhatsApp" untuk mengirimkan bukti transfer Anda agar dapat diaktifkan manual oleh Admin.`
          ]
        }
      ];

      let licenseId;
      if (existingLicense) {
        licenseId = existingLicense.id;
      } else {
        await db.run(
          "INSERT INTO licenses (license_key, product_id, school_name, device_limit, is_unlimited, expires_at, status, is_active, plan_id, requested_slug, requested_supabase_url, requested_supabase_anon_key, is_recovery, include_vpn) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?, ?, ?)",
          [newKey, prodId, resolvedSchoolName.trim(), limit, isUnlimited, expiresStr, plan.id, resolvedSlug || null, resolvedSupabaseUrl || null, resolvedSupabaseAnonKey || null, isRecovery, vpnPlan ? 1 : 0]
        );

        const insertedLicense = await db.get("SELECT id FROM licenses WHERE license_key = ?", [newKey]);
        licenseId = insertedLicense ? insertedLicense.id : null;

        await db.run(
          "INSERT INTO subscriptions (license_id, school_name, product_id, plan_id, status) VALUES (?, ?, ?, ?, 'pending')",
          [licenseId, resolvedSchoolName.trim(), prodId, plan.id]
        );
      }

      await db.run(
        "INSERT INTO invoices (invoice_number, license_id, school_name, product_id, plan_title, amount, status, payment_method, payment_reference, qr_url, pay_code, payment_instructions, expired_time, plan_id) VALUES (?, ?, ?, ?, ?, ?, 'unpaid', 'Manual', ?, ?, ?, ?, ?, ?)",
        [
          invoiceNumber,
          licenseId,
          resolvedSchoolName.trim(),
          prodId,
          vpnPlan ? `${plan.title} + VPN Tunnel` : plan.title,
          basePrice,
          `MANUAL-${newKey}`,
          '/qris.png',
          `${bankNameRow.value} - ${bankAccNoRow.value} a/n ${bankAccNameRow.value}`,
          JSON.stringify(instructions),
          Math.floor(Date.now() / 1000) + (48 * 3600),
          plan.id
        ]
      );

      await logLicenseActivity(newKey, prodId, null, req.ip, 'REQUEST_BILLING_MANUAL_SUCCESS');

      return res.json({
        success: true,
        message: 'Pengajuan lisensi manual berhasil. Silakan transfer dan lakukan konfirmasi.',
        data: {
          license_key: newKey,
          invoice_number: invoiceNumber,
          amount: basePrice,
          payment_method: 'Manual',
          payment_reference: `MANUAL-${newKey}`,
          qr_url: '/qris.png',
          pay_code: `${bankNameRow.value} - ${bankAccNoRow.value} a/n ${bankAccNameRow.value}`,
          payment_instructions: instructions,
          instructions: instructions,
          whatsapp_number: waNumberRow.value,
          expired_time: Math.floor(Date.now() / 1000) + (48 * 3600)
        }
      });
    }

    // ──────── MANAJEMEN XENDIT GATEWAY ────────
    if (activeGateway === 'xendit') {
      const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY || 'xnd_development_dummy_key_123';
      const authHeaderBase64 = Buffer.from(`${XENDIT_SECRET_KEY}:`).toString('base64');
      const fetch = require('node-fetch');

      const xenditPayload = {
        external_id: invoiceNumber,
        amount: basePrice,
        description: `Lisensi CBT ${plan.title} - ${resolvedSchoolName.trim()}${vpnPlan ? ' + VPN Tunnel' : ''}`,
        customer: {
          given_names: resolvedSchoolName.trim(),
          email: `billing@${process.env.MAIN_DOMAIN}`,
          mobile_number: '087779937341'
        },
        duration: 86400,
        success_redirect_url: `https://${process.env.MAIN_DOMAIN}/platform_ujian.html?status=success&key=${newKey}`,
        failure_redirect_url: `https://${process.env.MAIN_DOMAIN}/platform_ujian.html?status=failed&key=${newKey}`
      };

      let xenditResponseData = null;
      try {
        const response = await fetch('https://api.xendit.co/v2/invoices', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${authHeaderBase64}`
          },
          body: JSON.stringify(xenditPayload),
          timeout: 4000
        });
        xenditResponseData = await response.json();
      } catch (xenditErr) {
        console.error('[XENDIT NETWORK ERROR]', xenditErr);
      }

      if (xenditResponseData && xenditResponseData.invoice_url) {
        let licenseId;
        if (existingLicense) {
          licenseId = existingLicense.id;
        } else {
          await db.run(
            "INSERT INTO licenses (license_key, product_id, school_name, device_limit, is_unlimited, expires_at, status, is_active, plan_id, requested_slug, requested_supabase_url, requested_supabase_anon_key, is_recovery, include_vpn) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?, ?, ?)",
            [newKey, prodId, resolvedSchoolName.trim(), limit, isUnlimited, expiresStr, plan.id, resolvedSlug || null, resolvedSupabaseUrl || null, resolvedSupabaseAnonKey || null, isRecovery, vpnPlan ? 1 : 0]
          );

          const insertedLicense = await db.get("SELECT id FROM licenses WHERE license_key = ?", [newKey]);
          licenseId = insertedLicense ? insertedLicense.id : null;

          await db.run(
            "INSERT INTO subscriptions (license_id, school_name, product_id, plan_id, status) VALUES (?, ?, ?, ?, 'pending')",
            [licenseId, resolvedSchoolName.trim(), prodId, plan.id]
          );
        }

        await db.run(
          "INSERT INTO invoices (invoice_number, license_id, school_name, product_id, plan_title, amount, status, payment_method, payment_reference, qr_url, pay_code, payment_instructions, expired_time, plan_id) VALUES (?, ?, ?, ?, ?, ?, 'unpaid', 'Xendit', ?, ?, ?, ?, ?, ?)",
          [
            invoiceNumber,
            licenseId,
            resolvedSchoolName.trim(),
            prodId,
            vpnPlan ? `${plan.title} + VPN Tunnel` : plan.title,
            basePrice,
            xenditResponseData.id,
            xenditResponseData.invoice_url,
            xenditResponseData.external_id,
            JSON.stringify([{ title: "Bayar dengan Xendit", steps: ["Buka tautan Invoice Xendit berikut untuk membayar:", xenditResponseData.invoice_url] }]),
            Math.floor(Date.now() / 1000) + 86400,
            plan.id
          ]
        );

        await logLicenseActivity(newKey, prodId, null, req.ip, 'REQUEST_BILLING_XENDIT_SUCCESS');

        return res.json({
          success: true,
          message: 'Pengajuan lisensi berhasil. Invoice Xendit dibuat.',
          data: {
            license_key: newKey,
            invoice_number: invoiceNumber,
            amount: basePrice,
            payment_method: 'Xendit',
            payment_reference: xenditResponseData.id,
            qr_url: xenditResponseData.invoice_url,
            pay_code: xenditResponseData.external_id,
            payment_instructions: [{ title: "Bayar dengan Xendit", steps: ["Klik tombol bayar untuk melakukan pembayaran via Xendit VA/QRIS/E-Wallet.", xenditResponseData.invoice_url] }],
            instructions: [{ title: "Bayar dengan Xendit", steps: ["Klik tombol bayar untuk melakukan pembayaran via Xendit VA/QRIS/E-Wallet.", xenditResponseData.invoice_url] }],
            expired_time: Math.floor(new Date(xenditResponseData.expiry_date).getTime() / 1000)
          }
        });
      } else {
        const errorMsg = (xenditResponseData && xenditResponseData.message)
          ? xenditResponseData.message
          : 'Metode pembayaran sedang gangguan (Xendit Offline). Silakan coba beberapa saat lagi.';
          
        console.warn('[XENDIT API FAIL] Invoice creation failed. Error:', errorMsg);
        
        return res.status(400).json({
          success: false,
          message: errorMsg
        });
      }
    }

    // ──────── MANAJEMEN TRIPAY GATEWAY (DEFAULT) ────────
    const TRIPAY_API_KEY = process.env.TRIPAY_API_KEY;
    const TRIPAY_PRIVATE_KEY = process.env.TRIPAY_PRIVATE_KEY;
    const TRIPAY_MERCHANT_CODE = process.env.TRIPAY_MERCHANT_CODE;
    const TRIPAY_API_URL = process.env.TRIPAY_API_URL || 'https://tripay.co.id/api-sandbox';

    if (!vpnPrice) {
      basePrice = parseInt(plan.price.replace(/[^\d]/g, ''), 10) || 299000;
    }
    let feeFlat = 0;
    let feePercent = 0;
    let resolvedPaymentMethod = payment_method || 'QRIS2';
    
    try {
      const fetch = require('node-fetch');
      const response = await fetch(`${TRIPAY_API_URL}/merchant/payment-channel`, {
        headers: { 'Authorization': `Bearer ${TRIPAY_API_KEY}` },
        timeout: 2000
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        const chan = resData.data.find(c => c.code === resolvedPaymentMethod);
        if (chan) {
          feeFlat = parseInt(chan.fee_customer.flat, 10) || 0;
          feePercent = parseFloat(chan.fee_customer.percent) || 0;
        }
      }
    } catch (e) {
      console.warn('[Tripay] Failed to calculate real payment channel fees. Using flat fallback.', e.message);
    }

    const totalAmount = Math.round(basePrice + feeFlat + (basePrice * feePercent / 100));
    const gatewayFee = totalAmount - basePrice;

    // Send invoice creation request to Tripay
    const signature = crypto
      .createHmac('sha256', TRIPAY_PRIVATE_KEY)
      .update(TRIPAY_MERCHANT_CODE + invoiceNumber + totalAmount)
      .digest('hex');

    // Fetch product details for naming
    const productDb = await db.get("SELECT display_name, name FROM products WHERE id = ?", [prodId]);
    const productNameForInvoice = productDb ? (productDb.display_name || productDb.name) : "Aplikasi";

    const appPrice = parseInt(plan.price.replace(/[^\d]/g, ''), 10) || 299000;
    const tripayOrderItems = [
      {
        sku: plan.id,
        name: `${productNameForInvoice} - ${plan.title}`,
        price: appPrice,
        quantity: 1
      }
    ];

    if (vpnPlan && vpnPrice > 0) {
      tripayOrderItems.push({
        sku: vpnPlan.id,
        name: `VPN Tunneling Gateway - ${vpnPlan.title}`,
        price: vpnPrice,
        quantity: 1
      });
    }

    if (gatewayFee > 0) {
      tripayOrderItems.push({
        sku: 'admin_fee',
        name: 'Biaya Admin Gateway',
        price: gatewayFee,
        quantity: 1
      });
    }

    const tripayPayload = {
      method: resolvedPaymentMethod,
      merchant_ref: invoiceNumber,
      amount: totalAmount,
      customer_name: resolvedSchoolName.trim(),
      customer_email: 'billing@absenta.id',
      customer_phone: '087779937341',
      order_items: tripayOrderItems,
      expired_time: Math.floor(Date.now() / 1000) + (24 * 3600), // 24 hours
      signature
    };

    let tripayResponseData = null;
    try {
      const fetch = require('node-fetch');
      const response = await fetch(`${TRIPAY_API_URL}/transaction/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TRIPAY_API_KEY}`
        },
        body: JSON.stringify(tripayPayload),
        timeout: 2000
      });
      tripayResponseData = await response.json();
    } catch (tripayNetworkErr) {
      console.error('[TRIPAY API ERROR]', tripayNetworkErr);
    }

    if (tripayResponseData && tripayResponseData.success && tripayResponseData.data) {
      const tx = tripayResponseData.data;

      // Tripay succeeded! Safe to insert data into database
      let licenseId;
      if (existingLicense) {
        licenseId = existingLicense.id;
      } else {
        await db.run(
          "INSERT INTO licenses (license_key, product_id, school_name, device_limit, is_unlimited, expires_at, status, is_active, plan_id, requested_slug, requested_supabase_url, requested_supabase_anon_key, is_recovery, include_vpn) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?, ?, ?)",
          [newKey, prodId, resolvedSchoolName.trim(), limit, isUnlimited, expiresStr, plan.id, resolvedSlug || null, resolvedSupabaseUrl || null, resolvedSupabaseAnonKey || null, isRecovery, vpnPlan ? 1 : 0]
        );

        const insertedLicense = await db.get("SELECT id FROM licenses WHERE license_key = ?", [newKey]);
        licenseId = insertedLicense ? insertedLicense.id : null;

        if (!licenseId) {
          throw new Error('Failed to retrieve inserted license ID from database.');
        }

        await db.run(
          "INSERT INTO subscriptions (license_id, school_name, product_id, plan_id, status) VALUES (?, ?, ?, ?, 'pending')",
          [licenseId, resolvedSchoolName.trim(), prodId, plan.id]
        );
      }

      await db.run(
        "INSERT INTO invoices (invoice_number, license_id, school_name, product_id, plan_title, amount, status, payment_method, payment_reference, qr_url, pay_code, payment_instructions, expired_time, plan_id) VALUES (?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, ?, ?, ?, ?)",
        [
          invoiceNumber,
          licenseId,
          resolvedSchoolName.trim(),
          prodId,
          vpnPlan ? `${plan.title} + VPN Tunnel` : plan.title,
          totalAmount,
          resolvedPaymentMethod,
          tx.reference || null,
          tx.qr_url || null,
          tx.pay_code || null,
          JSON.stringify(tx.instructions || []),
          tx.expired_time || null,
          plan.id
        ]
      );

      await logLicenseActivity(newKey, prodId, null, req.ip, 'REQUEST_BILLING_TRIPAY_SUCCESS');
      
      return res.json({
        success: true,
        message: 'Pengajuan lisensi berhasil. Invoice Tripay dibuat.',
        data: {
          license_key: newKey,
          invoice_number: invoiceNumber,
          amount: totalAmount,
          payment_method: resolvedPaymentMethod,
          payment_reference: tx.reference,
          qr_url: tx.qr_url || null,
          pay_code: tx.pay_code || null,
          payment_instructions: tx.instructions || [],
          instructions: tx.instructions || [],
          expired_time: tx.expired_time
        }
      });
    } else {
      const errorMsg = (tripayResponseData && tripayResponseData.message)
        ? tripayResponseData.message
        : 'Metode pembayaran sedang gangguan (Tripay Offline). Silakan coba beberapa saat lagi.';
        
      console.warn('[TRIPAY API FAIL] Tripay creation failed. Bypassing database inserts. Error:', errorMsg);
      
      return res.status(400).json({
        success: false,
        message: errorMsg
      });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal mengajukan permintaan lisensi.' });
  }
});

// 5. Check subdomain / slug availability
router.get('/api/license/check-slug/:slug', async (req, res) => {
  const { slug } = req.params;
  if (!slug) {
    return res.status(400).json({ success: false, message: 'Slug tidak boleh kosong' });
  }

  try {
    const cleanSlug = slug.trim().toLowerCase();
    
    // 1. Ambil data dari Supabase Cloud (Single Source of Truth)
    const https = require('https');
    const getTenantFromSupabase = (domainSlug) => {
      return new Promise((resolve) => {
        const options = {
          hostname: 'supabaselocal.absenta.id',
          port: 443,
          path: `/rest/v1/tenants?domain_or_slug=eq.${domainSlug}&select=id,name,license_key`,
          method: 'GET',
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE'
          }
        };

        const request = https.request(options, (response) => {
          let body = '';
          response.on('data', (chunk) => body += chunk);
          response.on('end', () => {
            if (response.statusCode >= 200 && response.statusCode < 300) {
              try {
                const arr = JSON.parse(body);
                resolve(arr.length > 0 ? arr[0] : null);
              } catch (e) {
                resolve(null);
              }
            } else {
              resolve(null);
            }
          });
        });

        request.on('error', () => resolve(null));
        request.end();
      });
    };

    const supabaseTenant = await getTenantFromSupabase(cleanSlug);

    // 2. Jika slug ada di Supabase, cek validitas lisensinya di SQLite
    if (supabaseTenant) {
      let isExpired = true; // default jika lisensi tidak terdaftar di SQLite
      let keyToVerify = supabaseTenant.license_key ? supabaseTenant.license_key.trim() : '';

      if (keyToVerify) {
        const lic = await db.get(
          'SELECT status, expires_at FROM licenses WHERE license_key = ?',
          [keyToVerify]
        );
        if (lic) {
          const todayStr = new Date().toISOString().slice(0, 10);
          isExpired = lic.status === 'expired' || lic.expires_at < todayStr;
        }
      }

      if (isExpired) {
        return res.json({ 
          success: true, 
          available: false, 
          is_recovery: true, 
          message: 'Subdomain terdaftar namun lisensi kedaluwarsa' 
        });
      }

      // Tentukan apakah statusnya active atau pending
      const isPending = supabaseTenant.license_key ? false : true;

      return res.json({ 
        success: true, 
        available: false, 
        is_recovery: false, 
        status_code: isPending ? 'pending_payment' : 'active_license',
        message: isPending ? 'Subdomain sedang dipesan (Menunggu Pembayaran)' : 'Subdomain sudah digunakan dan masih aktif' 
      });
    }

    // 3. Fallback: Jika tidak ada di Supabase, cek apakah ada antrean pending di SQLite lokal
    const existingLocal = await db.get(
      "SELECT id, status, expires_at FROM licenses WHERE LOWER(requested_slug) = ? ORDER BY id DESC LIMIT 1",
      [cleanSlug]
    );

    if (existingLocal) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const isExpired = existingLocal.status === 'expired' || existingLocal.expires_at < todayStr;
      const isPending = existingLocal.status === 'pending';
      
      if (isExpired) {
        return res.json({ 
          success: true, 
          available: false, 
          is_recovery: true, 
          message: 'Subdomain terdaftar namun lisensi kedaluwarsa' 
        });
      }
      return res.json({ 
        success: true, 
        available: false, 
        is_recovery: false, 
        status_code: isPending ? 'pending_payment' : 'active_license',
        message: isPending ? 'Subdomain sedang dipesan (Menunggu Pembayaran)' : 'Subdomain sudah digunakan dan masih aktif' 
      });
    }
    
    return res.json({ success: true, available: true, message: 'Subdomain tersedia' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal mengecek ketersediaan subdomain.' });
  }
});

// 5. Check SaaS Nginx & Certbot SSL provisioning status
router.get('/api/license/provision-status/:slug', (req, res) => {
  const { slug } = req.params;
  const domain = `${slug}.${process.env.MAIN_DOMAIN}`;
  const fs = require('fs');

  const configPath = `/etc/nginx/sites-available/${domain}`;
  const isCreated = fs.existsSync(configPath);
  
  res.json({
    success: true,
    slug,
    domain,
    status: isCreated ? 'completed' : 'pending',
    ssl_active: isCreated
  });
});

// 6. Direct status check of license key (without activation)
router.get('/api/license/check/:key', statusCheckLimiter, async (req, res) => {
  const { key } = req.params;
  try {
    const license = await db.get(
      'SELECT * FROM licenses WHERE license_key = ?',
      [key.trim()]
    );

    if (!license) {
      return res.status(404).json({ success: false, message: 'Kunci lisensi tidak ditemukan.' });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const expired = license.expires_at < todayStr;
    const active = license.is_active === 1 && license.status === 'active' && !expired;

    const devices = await db.all(
      'SELECT device_id, activated_at FROM activated_devices WHERE license_id = ?',
      [license.id]
    );

    res.json({
      success: true,
      data: {
        license_key: license.license_key,
        product_id: license.product_id,
        school_name: license.school_name,
        device_limit: license.device_limit,
        is_unlimited: license.is_unlimited,
        is_active: active ? 1 : 0,
        status: active ? 'active' : (expired ? 'expired' : 'pending'),
        requested_slug: license.requested_slug,
        created_at: license.created_at,
        expires_at: license.expires_at,
        devices_count: devices.length,
        devices
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memeriksa status lisensi.' });
  }
});

// 7. Get student school active subscriptions list
router.get('/api/license/my-subscriptions/:key', async (req, res) => {
  const { key } = req.params;
  try {
    const license = await db.get('SELECT id FROM licenses WHERE license_key = ?', [key.trim()]);
    if (!license) {
      return res.status(404).json({ success: false, message: 'Lisensi tidak ditemukan.' });
    }
    const subs = await db.all('SELECT * FROM subscriptions WHERE license_id = ? ORDER BY id DESC', [license.id]);
    res.json({ success: true, data: subs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat daftar langganan sekolah.' });
  }
});

// 8. Get student school active invoices list
router.get('/api/license/my-invoices/:key', async (req, res) => {
  const { key } = req.params;
  try {
    const license = await db.get('SELECT id FROM licenses WHERE license_key = ?', [key.trim()]);
    if (!license) {
      return res.status(404).json({ success: false, message: 'Lisensi tidak ditemukan.' });
    }
    const list = await db.all(`
      SELECT i.*, l.requested_slug
      FROM invoices i
      LEFT JOIN licenses l ON i.license_id = l.id
      WHERE i.license_id = ?
      ORDER BY i.id DESC
    `, [license.id]);
    res.json({ success: true, data: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat riwayat invoice sekolah.' });
  }
});

// 8b. Get all licenses & invoices history by core license key (SaaS Tenant History)
router.get('/api/license/history-by-core-key/:coreKey', async (req, res) => {
  const { coreKey } = req.params;
  try {
    // 1. Get the core license to resolve the subdomain/slug
    const coreLicense = await db.get('SELECT requested_slug FROM licenses WHERE license_key = ?', [coreKey.trim()]);
    if (!coreLicense || !coreLicense.requested_slug) {
      return res.status(404).json({ success: false, message: 'Lisensi core tidak ditemukan atau belum terasosiasi dengan subdomain.' });
    }

    const slugLower = coreLicense.requested_slug.toLowerCase();

    // 2. Fetch all licenses associated with this subdomain
    const licenses = await db.all(`
      SELECT l.id, l.product_id, l.license_key, l.school_name, l.status, l.is_active, l.created_at, l.expires_at, l.requested_slug, l.wireguard_ip, p.display_name as product_display_name
      FROM licenses l
      LEFT JOIN products p ON l.product_id = p.id
      WHERE LOWER(l.requested_slug) = ?
      ORDER BY l.id DESC
    `, [slugLower]);

    // 3. Fetch all invoices associated with these licenses
    const licenseIds = licenses.map(l => l.id);
    let invoices = [];
    if (licenseIds.length > 0) {
      const placeholders = licenseIds.map(() => '?').join(',');
      invoices = await db.all(`
        SELECT i.*, l.product_id, l.license_key, l.school_name, p.display_name as product_display_name
        FROM invoices i
        JOIN licenses l ON i.license_id = l.id
        LEFT JOIN products p ON l.product_id = p.id
        WHERE i.license_id IN (${placeholders})
        ORDER BY i.id DESC
      `, licenseIds);
    }

    res.json({
      success: true,
      data: {
        licenses,
        invoices
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat riwayat transaksi instansi: ' + err.message });
  }
});

// 8.5. Invoice status check
router.get('/api/license/invoice-status/:invoiceNumber', async (req, res) => {
  const { invoiceNumber } = req.params;
  try {
    const invoice = await db.get(
      "SELECT * FROM invoices WHERE invoice_number = ?",
      [invoiceNumber.trim()]
    );
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan.' });
    }
    res.json({
      success: true,
      data: {
        invoice_number: invoice.invoice_number,
        status: invoice.status,
        paid_at: invoice.paid_at || null
      }
    });
  } catch (err) {
    console.error('[Invoice Status Error]', err);
    res.status(500).json({ success: false, message: 'Gagal mengecek status invoice.' });
  }
});

// 9. Printable invoice generator
router.get('/api/license/print-invoice/:invoiceNumber', async (req, res) => {
  const { invoiceNumber } = req.params;

  try {
    const inv = await db.get('SELECT * FROM invoices WHERE invoice_number = ?', [invoiceNumber.trim()]);
    if (!inv) {
      return res.status(404).send('<h1>Error 404: Invoice tidak ditemukan</h1>');
    }

    const license = await db.get('SELECT * FROM licenses WHERE id = ?', [inv.license_id]) || { license_key: 'Manual Generation' };
    const cleanSchoolName = inv.school_name.replace(/\(([^)]+)\)/g, '').trim();
    const planTitle = inv.plan_title;
    const planPrice = `Rp ${inv.amount.toLocaleString('id-ID')}`;
    const planDuration = planTitle.toLowerCase().includes('bulan') ? '30 Hari' : (planTitle.toLowerCase().includes('sem') ? '180 Hari' : '365 Hari');
    
    const dateStr = inv.paid_at 
      ? formatIndonesianDate(inv.paid_at.slice(0, 10)) 
      : formatIndonesianDate(inv.created_at.slice(0, 10));
    
    // Fetch product settings dynamically from DB
    const product = await db.get('SELECT * FROM products WHERE id = ?', [inv.product_id]);
    
    const productName = product ? product.display_name : (inv.product_id === 'absenta' ? 'Absenta Premium (AI Absensi)' : 'G-Form Orkestrator Premium');
    const productDesc = product ? product.description : (inv.product_id === 'absenta' ? 'Sistem absensi sekolah berbasis AI wajah & pembatasan radius lokasi' : 'Sistem pengunci & pengaman ujian terintegrasi Google Forms');
    
    // Determine capacity dynamically from the license properties
    let capacityStr = '';
    if (license && (license.is_unlimited === 1 || license.device_limit === 0 || license.device_limit >= 9999)) {
      capacityStr = inv.product_id === 'project-yatim' ? 'Tanpa Batas Mustahiq' : 'Unlimited HP';
    } else if (license && license.device_limit > 0) {
      capacityStr = inv.product_id === 'project-yatim' ? `Maks. ${license.device_limit} Mustahiq` : `Maks. ${license.device_limit} HP`;
    } else {
      capacityStr = product ? product.capacity_label : 'Standar';
    }
    
    const statusLabel = inv.status === 'paid' ? 'LUNAS' : 'BELUM BAYAR';
    const payMethodLabel = inv.payment_method || 'N/A';
    const isPaid = inv.status === 'paid';
    const verifyHash = Buffer.from(`${inv.invoice_number}:${inv.id}:${inv.amount}`).toString('base64').slice(0, 16).toUpperCase();

    const hasVpn = planTitle.toLowerCase().includes('+ vpn') || planTitle.toLowerCase().includes('vpn tunnel');
    const items = [];
    
    if (hasVpn) {
      const vpnPrice = 50000;
      const appPrice = inv.amount - vpnPrice;
      
      items.push({
        name: `${productName} &mdash; ${planTitle.replace(/(\+\s*VPN\s*Tunnel|\+\s*VPN)/gi, '').trim()}`,
        desc: `${productDesc}. Termasuk dukungan teknis, pembaruan berkala, dan akses dashboard admin.`,
        duration: planDuration,
        capacity: capacityStr,
        quantity: '1 Lisensi',
        price: appPrice
      });
      
      items.push({
        name: `VPN Tunneling Gateway &mdash; Bulanan Addon`,
        desc: `Koneksi aman untuk melintasi vpn tunnel agar port lokal dapat diakses publik secara online.`,
        duration: `30 Hari`,
        capacity: `1 Tunnel`,
        quantity: `1 Addon`,
        price: vpnPrice
      });
    }

    const invoiceHtml = renderInvoiceTemplate({
      invoiceNumber: inv.invoice_number,
      cleanSchoolName,
      dateStr,
      statusLabel,
      isPaid,
      payMethodLabel,
      licenseKey: license.license_key,
      productName,
      planTitle,
      productDesc,
      planDuration,
      capacityStr,
      planPrice,
      verifyHash,
      items: items.length > 0 ? items : null
    });

    res.send(invoiceHtml);
  } catch (err) {
    console.error(err);
    res.status(500).send('<h1>Error 500: Terjadi kesalahan server</h1>');
  }
});

// 10. Webhook Callback receiver from Tripay
router.post('/api/license/tripay-callback', async (req, res) => {
  // --- HARDENING: IP WHITELISTING ---
  // List of Tripay IP Addresses (as of documentation)
  const tripayIps = ['103.119.145.161', '103.119.145.162', '103.119.145.163'];
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // Optional: Uncomment the check below if you want strict IP validation
  // if (!tripayIps.some(ip => clientIp.includes(ip)) && clientIp !== '127.0.0.1') {
  //   console.warn(`[TRIPAY Webhook] Unauthorized IP access attempt: ${clientIp}`);
  //   return res.status(403).json({ success: false, message: 'Unauthorized source IP.' });
  // }

  const callbackSignature = req.headers['x-callback-signature'];

  if (!callbackSignature) {
    console.error('[TRIPAY Webhook] Missing X-Callback-Signature header.');
    return res.status(400).json({ success: false, message: 'Missing callback signature header.' });
  }

  if (!TRIPAY_PRIVATE_KEY) {
    console.error('[TRIPAY Webhook] TRIPAY_PRIVATE_KEY is not configured on the server.');
    return res.status(500).json({ success: false, message: 'Server private key missing.' });
  }

  const rawPayload = JSON.stringify(req.body);
  const calculatedSignature = crypto
    .createHmac('sha256', TRIPAY_PRIVATE_KEY)
    .update(rawPayload)
    .digest('hex');

  if (callbackSignature !== calculatedSignature) {
    console.error('[TRIPAY Webhook] Invalid signature received! Rejecting request.');
    return res.status(403).json({ success: false, message: 'Invalid callback signature.' });
  }

  const { merchant_ref, status, reference } = req.body;
  console.log(`[TRIPAY Webhook] Callback received. Ref: ${merchant_ref}, TripayRef: ${reference}, Status: ${status}`);

  if (status === 'PAID') {
    try {
      const invoice = await db.get('SELECT * FROM invoices WHERE invoice_number = ?', [merchant_ref]);
      
      if (!invoice) {
        console.error(`[TRIPAY Webhook] Invoice not found: ${merchant_ref}`);
        return res.status(404).json({ success: false, message: 'Invoice not found.' });
      }

      // --- HARDENING: DOUBLE VALIDATE AMOUNT ---
      // Ensure the amount paid matches the amount in our record to prevent "Underpaid" attacks
      if (req.body.total_amount && parseFloat(req.body.total_amount) < parseFloat(invoice.amount)) {
        console.error(`[TRIPAY Webhook] Amount mismatch! Paid: ${req.body.total_amount}, Expected: ${invoice.amount}`);
        return res.status(400).json({ success: false, message: 'Amount mismatch detected.' });
      }

      if (invoice.status === 'paid') {
        console.log(`[TRIPAY Webhook] Invoice ${merchant_ref} is already PAID. Skipping activation.`);
        return res.json({ success: true });
      }

      const license = await db.get('SELECT * FROM licenses WHERE id = ?', [invoice.license_id]);
      if (!license) {
        console.error(`[TRIPAY Webhook] License associated with invoice not found!`);
        return res.status(404).json({ success: false, message: 'Associated license not found.' });
      }

      let days = 30;
      const planId = invoice.plan_id || license.plan_id || '';
      if (planId.includes('semester')) {
        days = 180;
      } else if (planId.includes('annual')) {
        days = 365;
      } else if (planId.includes('lifetime')) {
        days = 3650; // 10 years for lifetime
      }

      let baseDate = new Date();
      const todayStr = baseDate.toISOString().slice(0, 10);
      if (license.status === 'active' && license.expires_at && license.expires_at > todayStr) {
        baseDate = new Date(license.expires_at);
      }
      baseDate.setDate(baseDate.getDate() + days);
      const expiresStr = baseDate.toISOString().slice(0, 10);

      await db.run(
        "UPDATE invoices SET status = 'paid', paid_at = datetime('now', 'localtime') WHERE id = ?",
        [invoice.id]
      );

      await db.run(
        "UPDATE licenses SET status = 'active', is_active = 1, expires_at = ?, plan_id = ? WHERE id = ?",
        [expiresStr, planId, license.id]
      );

      await db.run(
        "UPDATE subscriptions SET status = 'active', end_date = ?, updated_at = (datetime('now', 'localtime')) WHERE license_id = ? AND plan_id = ?",
        [expiresStr, license.id, planId]
      );

      if (license.status !== 'active' || !license.expires_at || license.expires_at <= todayStr) {
        await db.run(
          "UPDATE subscriptions SET start_date = datetime('now', 'localtime') WHERE license_id = ? AND plan_id = ?",
          [license.id, planId]
        );
      }

      await logLicenseActivity(license.license_key, license.product_id, null, req.ip, 'TRIPAY_CALLBACK_PAID');
      console.log(`[TRIPAY Webhook] Successfully activated license key: ${license.license_key} for school: ${license.school_name}. Duration: ${days} days (Expires: ${expiresStr}).`);
      
      // Auto-provision VPN addon if bundled
      await activateVpnAddonIfNeeded(license, req);

      // Real-time Push Callback to School Server
      if (license.requested_slug) {
        const schoolDomain = license.custom_domain ? `https://${license.custom_domain}` : `https://${license.requested_slug}.absenta.id`;
        const callbackUrl = `${schoolDomain}/api/billing/subscriptions/license/callback`;
        console.log(`[TRIPAY Webhook] Sending real-time push callback to school: ${callbackUrl}`);
        
        const axios = require('axios');
        axios.post(callbackUrl, {
          license_key: license.license_key,
          tenant_id: license.requested_slug
        }, { timeout: 6000 }).then(response => {
          console.log(`[TRIPAY Webhook] Callback to school succeeded: ${response.status}`);
        }).catch(err => {
          console.log(`[TRIPAY Webhook] Callback to school failed (school NAT/offline - will fallback to pull sync): ${err.message}`);
        });
      }

      if (license.requested_slug) {
        if (license.is_recovery === 1) {
          console.log(`[TRIPAY Webhook] Recovery mode: updating existing tenant '${license.requested_slug}' license_key in Supabase...`);
          try {
            const https = require('https');
            const updateTenantLicenseRest = (slug, licenseKey, schoolName) => {
              return new Promise((resolve, reject) => {
                const data = JSON.stringify({ license_key: licenseKey, is_active: true, name: schoolName });
                const options = {
                  hostname: 'xjnctgbzilrhbzsbrtpu.supabase.co',
                  port: 443,
                  path: `/rest/v1/tenants?domain_or_slug=eq.${slug}`,
                  method: 'PATCH',
                  headers: {
                    'apikey': 'sb_publishable_V-cqiwiR7AleBLJuILePTg_-CWhSAgg',
                    'Authorization': 'Bearer sb_publishable_V-cqiwiR7AleBLJuILePTg_-CWhSAgg',
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                  }
                };

                const req = https.request(options, (res) => {
                  let body = '';
                  res.on('data', (chunk) => body += chunk);
                  res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                      resolve(body);
                    } else {
                      reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                    }
                  });
                });

                req.on('error', (err) => reject(err));
                req.write(data);
                req.end();
              });
            };

            await updateTenantLicenseRest(license.requested_slug, license.license_key, license.school_name);
            console.log(`[TRIPAY Webhook] SaaS Recovery Successful: license key and school name updated on existing tenant '${license.requested_slug}'`);
          } catch (pgErr) {
            console.error('[TRIPAY Webhook] SaaS Recovery Failed during Supabase patch:', pgErr.message);
          }
        } else {
          console.log(`[TRIPAY Webhook] Automatic SaaS provisioning: inserting tenant '${license.requested_slug}' into Master Supabase database...`);
          try {
            const https = require('https');
            const upsertTenantRest = (payload) => {
              return new Promise((resolve, reject) => {
                const data = JSON.stringify(payload);
                const options = {
                  hostname: 'xjnctgbzilrhbzsbrtpu.supabase.co',
                  port: 443,
                  path: '/rest/v1/tenants',
                  method: 'POST',
                  headers: {
                    'apikey': 'sb_publishable_V-cqiwiR7AleBLJuILePTg_-CWhSAgg',
                    'Authorization': 'Bearer sb_publishable_V-cqiwiR7AleBLJuILePTg_-CWhSAgg',
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates',
                    'Content-Length': Buffer.byteLength(data)
                  }
                };

                const req = https.request(options, (res) => {
                  let body = '';
                  res.on('data', (chunk) => body += chunk);
                  res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                      resolve(body);
                    } else {
                      reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                    }
                  });
                });

                req.on('error', (err) => reject(err));
                req.write(data);
                req.end();
              });
            };

            const insertGuruRest = (payload) => {
              return new Promise((resolve, reject) => {
                const data = JSON.stringify(payload);
                const options = {
                  hostname: 'xjnctgbzilrhbzsbrtpu.supabase.co',
                  port: 443,
                  path: '/rest/v1/guru',
                  method: 'POST',
                  headers: {
                    'apikey': 'sb_publishable_V-cqiwiR7AleBLJuILePTg_-CWhSAgg',
                    'Authorization': 'Bearer sb_publishable_V-cqiwiR7AleBLJuILePTg_-CWhSAgg',
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates',
                    'Content-Length': Buffer.byteLength(data)
                  }
                };

                const req = https.request(options, (res) => {
                  let body = '';
                  res.on('data', (chunk) => body += chunk);
                  res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                      resolve(body);
                    } else {
                      reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                    }
                  });
                });

                req.on('error', (err) => reject(err));
                req.write(data);
                req.end();
              });
            };

            const tenantId = crypto.randomUUID();
            const payload = {
              id: tenantId,
              name: license.school_name,
              exam_event_title: 'Ujian Online',
              logo_url: null,
              domain_or_slug: license.requested_slug,
              supabase_url: license.requested_supabase_url || null,
              supabase_anon_key: license.requested_supabase_anon_key || null,
              license_key: license.license_key,
              is_active: true
            };

            await upsertTenantRest(payload);
            console.log(`[TRIPAY Webhook] SaaS Provisioning Successful: school '${license.school_name}' with license key is now live at https://${license.requested_slug}.${process.env.MAIN_DOMAIN}!`);

            if (!license.requested_supabase_url) {
              console.log(`[TRIPAY Webhook] Shared DB detected. Seeding default admin account for tenant ${tenantId}...`);
              const guruPayload = {
                tenant_id: tenantId,
                nama_guru: 'Admin ' + license.school_name,
                username: 'admin',
                password_hash: 'pbkdf2_sha256$260000$mockhash$admin',
                pin_pengawas: '123456',
                is_active: true
              };
              await insertGuruRest(guruPayload);
              console.log(`[TRIPAY Webhook] Successfully seeded default admin account (username: admin, PIN: 123456) for tenant: ${license.school_name}`);
            }
          } catch (pgErr) {
            console.error('[TRIPAY Webhook] SaaS Provisioning Failed during Supabase REST API insert:', pgErr.message);
          }

          provisionNginxAndSsl(license.requested_slug);
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error('[TRIPAY Webhook] Error updating database:', err);
      res.status(500).json({ success: false, message: 'Database update failed.' });
    }
  } else if (status === 'EXPIRED' || status === 'FAILED') {
    try {
      const invoice = await db.get('SELECT * FROM invoices WHERE invoice_number = ?', [merchant_ref]);
      if (invoice) {
        const targetStatus = status.toLowerCase(); // 'expired' atau 'failed'
        
        await db.run(
          "UPDATE invoices SET status = ? WHERE id = ?",
          [targetStatus, invoice.id]
        );
        
        await db.run(
          "UPDATE licenses SET status = 'expired', is_active = 0 WHERE id = ?",
          [invoice.license_id]
        );
        
        await db.run(
          "UPDATE subscriptions SET status = 'expired' WHERE license_id = ? AND plan_id = ?",
          [invoice.license_id, invoice.plan_id]
        );
        
        const license = await db.get('SELECT * FROM licenses WHERE id = ?', [invoice.license_id]);
        if (license) {
          await logLicenseActivity(license.license_key, license.product_id, null, req.ip, `TRIPAY_CALLBACK_${status}`);
        }
        
        console.log(`[TRIPAY Webhook] Transaction ${merchant_ref} marked as ${status} successfully. Cleared from pending queues.`);
      }
      res.json({ success: true });
    } catch (err) {
      console.error(`[TRIPAY Webhook] Error processing ${status} status:`, err);
      res.status(500).json({ success: false, message: 'Database update failed.' });
    }
  } else {
    console.log(`[TRIPAY Webhook] Non-PAID/EXPIRED/FAILED status received (${status}). Acknowledged.`);
    res.json({ success: true });
  }
});

// 10b. Webhook Callback receiver from Xendit
router.post('/api/license/xendit-callback', async (req, res) => {
  const callbackToken = req.headers['x-callback-token'];
  const XENDIT_CALLBACK_TOKEN = process.env.XENDIT_CALLBACK_TOKEN || '';

  if (XENDIT_CALLBACK_TOKEN && callbackToken !== XENDIT_CALLBACK_TOKEN) {
    console.error('[XENDIT Webhook] Invalid callback token received! Rejecting request.');
    return res.status(403).json({ success: false, message: 'Invalid callback token.' });
  }

  const { external_id, status, id } = req.body;
  console.log(`[XENDIT Webhook] Callback received. Ref: ${external_id}, XenditInvoiceId: ${id}, Status: ${status}`);

  if (status === 'PAID' || status === 'SETTLED') {
    try {
      const invoice = await db.get('SELECT * FROM invoices WHERE invoice_number = ?', [external_id]);
      
      if (!invoice) {
        console.error(`[XENDIT Webhook] Invoice not found: ${external_id}`);
        return res.status(404).json({ success: false, message: 'Invoice not found.' });
      }

      if (invoice.status === 'paid') {
        console.log(`[XENDIT Webhook] Invoice ${external_id} is already PAID. Skipping activation.`);
        return res.json({ success: true });
      }

      const license = await db.get('SELECT * FROM licenses WHERE id = ?', [invoice.license_id]);
      if (!license) {
        console.error(`[XENDIT Webhook] License associated with invoice not found!`);
        return res.status(404).json({ success: false, message: 'Associated license not found.' });
      }

      let days = 30;
      const planId = invoice.plan_id || license.plan_id || '';
      if (planId.includes('semester')) {
        days = 180;
      } else if (planId.includes('annual')) {
        days = 365;
      } else if (planId.includes('lifetime')) {
        days = 3650; // 10 years for lifetime
      }

      let baseDate = new Date();
      const todayStr = baseDate.toISOString().slice(0, 10);
      if (license.status === 'active' && license.expires_at && license.expires_at > todayStr) {
        baseDate = new Date(license.expires_at);
      }
      baseDate.setDate(baseDate.getDate() + days);
      const expiresStr = baseDate.toISOString().slice(0, 10);

      await db.run(
        "UPDATE invoices SET status = 'paid', paid_at = datetime('now', 'localtime') WHERE id = ?",
        [invoice.id]
      );

      await db.run(
        "UPDATE licenses SET status = 'active', is_active = 1, expires_at = ?, plan_id = ? WHERE id = ?",
        [expiresStr, planId, license.id]
      );

      await db.run(
        "UPDATE subscriptions SET status = 'active', end_date = ?, updated_at = (datetime('now', 'localtime')) WHERE license_id = ? AND plan_id = ?",
        [expiresStr, license.id, planId]
      );

      if (license.status !== 'active' || !license.expires_at || license.expires_at <= todayStr) {
        await db.run(
          "UPDATE subscriptions SET start_date = datetime('now', 'localtime') WHERE license_id = ? AND plan_id = ?",
          [license.id, planId]
        );
      }

      await logLicenseActivity(license.license_key, license.product_id, null, req.ip, 'XENDIT_CALLBACK_PAID');
      console.log(`[XENDIT Webhook] Successfully activated license key: ${license.license_key} for school: ${license.school_name}. Duration: ${days} days.`);
      
      // Auto-provision VPN addon if bundled
      await activateVpnAddonIfNeeded(license, req);

      // Real-time Push Callback to School Server
      if (license.requested_slug) {
        const schoolDomain = license.custom_domain ? `https://${license.custom_domain}` : `https://${license.requested_slug}.absenta.id`;
        const callbackUrl = `${schoolDomain}/api/billing/subscriptions/license/callback`;
        console.log(`[XENDIT Webhook] Sending real-time push callback to school: ${callbackUrl}`);
        
        const axios = require('axios');
        axios.post(callbackUrl, {
          license_key: license.license_key,
          tenant_id: license.requested_slug
        }, { timeout: 6000 }).then(response => {
          console.log(`[XENDIT Webhook] Callback to school succeeded: ${response.status}`);
        }).catch(err => {
          console.log(`[XENDIT Webhook] Callback to school failed (school NAT/offline - will fallback to pull sync): ${err.message}`);
        });
      }

      if (license.requested_slug) {
        if (license.is_recovery === 1) {
          console.log(`[XENDIT Webhook] Recovery mode: updating existing tenant '${license.requested_slug}' license_key in Supabase...`);
          try {
            const https = require('https');
            const updateTenantLicenseRest = (slug, licenseKey, schoolName) => {
              return new Promise((resolve, reject) => {
                const data = JSON.stringify({ license_key: licenseKey, is_active: true, name: schoolName });
                const options = {
                  hostname: 'xjnctgbzilrhbzsbrtpu.supabase.co',
                  port: 443,
                  path: `/rest/v1/tenants?domain_or_slug=eq.${slug}`,
                  method: 'PATCH',
                  headers: {
                    'apikey': 'sb_publishable_V-cqiwiR7AleBLJuILePTg_-CWhSAgg',
                    'Authorization': 'Bearer sb_publishable_V-cqiwiR7AleBLJuILePTg_-CWhSAgg',
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                  }
                };

                const req = https.request(options, (res) => {
                  let body = '';
                  res.on('data', (chunk) => body += chunk);
                  res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                      resolve(body);
                    } else {
                      reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                    }
                  });
                });

                req.on('error', (err) => reject(err));
                req.write(data);
                req.end();
              });
            };

            await updateTenantLicenseRest(license.requested_slug, license.license_key, license.school_name);
            console.log(`[XENDIT Webhook] SaaS Recovery Successful: license key updated on existing tenant '${license.requested_slug}'`);
          } catch (pgErr) {
            console.error('[XENDIT Webhook] SaaS Recovery Failed during Supabase patch:', pgErr.message);
          }
        } else {
          console.log(`[XENDIT Webhook] Automatic SaaS provisioning: inserting tenant '${license.requested_slug}' into Master Supabase database...`);
          try {
            const https = require('https');
            const upsertTenantRest = (payload) => {
              return new Promise((resolve, reject) => {
                const data = JSON.stringify(payload);
                const options = {
                  hostname: 'xjnctgbzilrhbzsbrtpu.supabase.co',
                  port: 443,
                  path: '/rest/v1/tenants',
                  method: 'POST',
                  headers: {
                    'apikey': 'sb_publishable_V-cqiwiR7AleBLJuILePTg_-CWhSAgg',
                    'Authorization': 'Bearer sb_publishable_V-cqiwiR7AleBLJuILePTg_-CWhSAgg',
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates',
                    'Content-Length': Buffer.byteLength(data)
                  }
                };

                const req = https.request(options, (res) => {
                  let body = '';
                  res.on('data', (chunk) => body += chunk);
                  res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                      resolve(body);
                    } else {
                      reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                    }
                  });
                });

                req.on('error', (err) => reject(err));
                req.write(data);
                req.end();
              });
            };

            const insertGuruRest = (payload) => {
              return new Promise((resolve, reject) => {
                const data = JSON.stringify(payload);
                const options = {
                  hostname: 'xjnctgbzilrhbzsbrtpu.supabase.co',
                  port: 443,
                  path: '/rest/v1/guru',
                  method: 'POST',
                  headers: {
                    'apikey': 'sb_publishable_V-cqiwiR7AleBLJuILePTg_-CWhSAgg',
                    'Authorization': 'Bearer sb_publishable_V-cqiwiR7AleBLJuILePTg_-CWhSAgg',
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates',
                    'Content-Length': Buffer.byteLength(data)
                  }
                };

                const req = https.request(options, (res) => {
                  let body = '';
                  res.on('data', (chunk) => body += chunk);
                  res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                      resolve(body);
                    } else {
                      reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                    }
                  });
                });

                req.on('error', (err) => reject(err));
                req.write(data);
                req.end();
              });
            };

            const tenantId = crypto.randomUUID();
            const payload = {
              id: tenantId,
              name: license.school_name,
              exam_event_title: 'Ujian Online',
              logo_url: null,
              domain_or_slug: license.requested_slug,
              supabase_url: license.requested_supabase_url || null,
              supabase_anon_key: license.requested_supabase_anon_key || null,
              license_key: license.license_key,
              is_active: true
            };

            await upsertTenantRest(payload);
            console.log(`[XENDIT Webhook] SaaS Provisioning Successful: school '${license.school_name}' live at https://${license.requested_slug}.${process.env.MAIN_DOMAIN}!`);

            if (!license.requested_supabase_url) {
              const guruPayload = {
                tenant_id: tenantId,
                nama_guru: 'Admin ' + license.school_name,
                username: 'admin',
                password_hash: 'pbkdf2_sha256$260000$mockhash$admin',
                pin_pengawas: '123456',
                is_active: true
              };
              await insertGuruRest(guruPayload);
            }
          } catch (pgErr) {
            console.error('[XENDIT Webhook] SaaS Provisioning Failed during Supabase insert:', pgErr.message);
          }

          provisionNginxAndSsl(license.requested_slug);
        }
      }

      return res.json({ success: true, message: 'Activation successful.' });
    } catch (err) {
      console.error('[XENDIT Webhook] Error updating database:', err);
      return res.status(500).json({ success: false, message: 'Database update failed.' });
    }
  } else if (status === 'EXPIRED' || status === 'EXPIRED_INVOICE' || status === 'FAILED') {
    try {
      const invoice = await db.get('SELECT * FROM invoices WHERE invoice_number = ?', [external_id]);
      if (invoice) {
        await db.run("UPDATE invoices SET status = 'expired' WHERE id = ?", [invoice.id]);
        await db.run("UPDATE licenses SET status = 'expired', is_active = 0 WHERE id = ?", [invoice.license_id]);
        await db.run("UPDATE subscriptions SET status = 'expired' WHERE license_id = ? AND plan_id = ?", [invoice.license_id, invoice.plan_id]);
        
        console.log(`[XENDIT Webhook] Transaction ${external_id} marked as expired.`);
      }
      return res.json({ success: true });
    } catch (err) {
      console.error('[XENDIT Webhook] Error processing expired invoice:', err);
      return res.status(500).json({ success: false, message: 'Database update failed.' });
    }
  }

  res.json({ success: true, message: 'Webhook state acknowledged.' });
});

// 11. Activate License manually with Direct Input (CLIENT APP)
router.post('/api/license/activate', activationLimiter, async (req, res) => {
  const { license_key, device_id, product_id } = req.body;

  if (!license_key || !device_id) {
    return res.status(400).json({ success: false, message: 'Kunci lisensi (key) dan Device ID wajib diisi.' });
  }

  const prodId = product_id || 'gform-orkestrator';

  try {
    const license = await db.get(
      'SELECT * FROM licenses WHERE license_key = ? AND is_active = 1 AND status = "active"',
      [license_key.trim()]
    );

    if (!license) {
      await logLicenseActivity(license_key, prodId, device_id, req.ip, 'ACTIVATE_FAILED_NOT_FOUND');
      return res.status(404).json({ success: false, message: 'Kunci lisensi tidak ditemukan, kedaluwarsa, atau belum disetujui.' });
    }

    if (license.product_id !== prodId) {
      await logLicenseActivity(license_key, prodId, device_id, req.ip, 'ACTIVATE_FAILED_PRODUCT_MISMATCH');
      return res.status(400).json({
        success: false,
        message: `Lisensi ini diterbitkan untuk produk lain dan tidak dapat digunakan pada aplikasi ini.`
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (license.expires_at < todayStr) {
      await logLicenseActivity(license_key, prodId, device_id, req.ip, 'ACTIVATE_FAILED_EXPIRED');
      return res.status(410).json({ success: false, message: 'Masa aktif lisensi ini sudah kedaluwarsa.' });
    }

    let vpnLicenseKey = null;
    if (license.include_vpn === 1 && license.requested_slug) {
      try {
        const vpnLic = await db.get(
          'SELECT license_key FROM licenses WHERE requested_slug = ? AND product_id = "vpn-tunnel" AND is_active = 1',
          [license.requested_slug.trim().toLowerCase()]
        );
        if (vpnLic) {
          vpnLicenseKey = vpnLic.license_key;
        }
      } catch (vpnErr) {
        console.error('[VPN Key Fetch on Activate Error]', vpnErr);
      }
    }

    const alreadyActive = await db.get(
      'SELECT * FROM activated_devices WHERE license_id = ? AND device_id = ?',
      [license.id, device_id]
    );

    if (alreadyActive) {
      const token = jwt.sign(
        {
          license_key: license.license_key,
          product_id: license.product_id,
          school_name: license.school_name,
          device_id,
          expires_at: license.expires_at,
          include_vpn: license.include_vpn,
          vpn_enabled: license.include_vpn,
          vpn_license_key: vpnLicenseKey
        },
        PRIVATE_KEY,
        { algorithm: 'RS256', expiresIn: '365d' }
      );

      await logLicenseActivity(license_key, prodId, device_id, req.ip, 'ACTIVATE_RESTORED');

      return res.json({
        success: true,
        message: 'Perangkat ini sudah terdaftar sebelumnya. Aktivasi dipulihkan.',
        token,
        school_name: license.school_name,
        expires_at: license.expires_at,
        include_vpn: license.include_vpn,
        vpn_license_key: vpnLicenseKey
      });
    }

    const activeCount = await db.get(
      'SELECT COUNT(*) as count FROM activated_devices WHERE license_id = ?',
      [license.id]
    );

    if (license.is_unlimited !== 1 && parseInt(activeCount.count, 10) >= license.device_limit) {
      await logLicenseActivity(license_key, prodId, device_id, req.ip, 'ACTIVATE_FAILED_LIMIT_REACHED');
      return res.status(403).json({
        success: false,
        message: `Batas limit perangkat tercapai. Kunci lisensi ini hanya untuk maksimal ${license.device_limit} HP.`
      });
    }

    await db.run(
      'INSERT INTO activated_devices (license_id, device_id) VALUES (?, ?)',
      [license.id, device_id]
    );

    const token = jwt.sign(
      {
        license_key: license.license_key,
        product_id: license.product_id,
        school_name: license.school_name,
        device_id,
        expires_at: license.expires_at,
        include_vpn: license.include_vpn,
        vpn_enabled: license.include_vpn,
        vpn_license_key: vpnLicenseKey
      },
      PRIVATE_KEY,
      { algorithm: 'RS256', expiresIn: '365d' }
    );

    await logLicenseActivity(license_key, prodId, device_id, req.ip, 'ACTIVATE_SUCCESS');

    res.json({
      success: true,
      message: 'Aktivasi lisensi berhasil dipublikasikan untuk perangkat ini.',
      token,
      school_name: license.school_name,
      expires_at: license.expires_at,
      include_vpn: license.include_vpn,
      vpn_license_key: vpnLicenseKey
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem saat memproses aktivasi.' });
  }
});

// 12. Verify License JWT (CLIENT APP BACKGROUND CHECK)
router.post('/api/license/verify', activationLimiter, async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'Token verifikasi tidak ditemukan.' });
  }

  try {
    const decoded = jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });

    const license = await db.get(
      'SELECT * FROM licenses WHERE license_key = ? AND is_active = 1 AND status = "active"',
      [decoded.license_key]
    );

    if (!license) {
      await logLicenseActivity(decoded.license_key, decoded.product_id, decoded.device_id, req.ip, 'VERIFY_FAILED_REVOKED');
      return res.status(401).json({ success: false, message: 'Lisensi dibatalkan atau dinonaktifkan oleh administrator.' });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (license.expires_at < todayStr) {
      await logLicenseActivity(decoded.license_key, decoded.product_id, decoded.device_id, req.ip, 'VERIFY_FAILED_EXPIRED');
      return res.status(401).json({ success: false, message: 'Lisensi ini sudah habis masa berlakunya.' });
    }

    const deviceRecord = await db.get(
      'SELECT * FROM activated_devices WHERE license_id = ? AND device_id = ?',
      [license.id, decoded.device_id]
    );

    if (!deviceRecord) {
      await logLicenseActivity(decoded.license_key, decoded.product_id, decoded.device_id, req.ip, 'VERIFY_FAILED_DEVICE_UNAUTHORIZED');
      return res.status(401).json({ success: false, message: 'Perangkat ini dide-otorisasi dari lisensi.' });
    }

    await logLicenseActivity(decoded.license_key, decoded.product_id, decoded.device_id, req.ip, 'VERIFY_ONLINE_SUCCESS');

    res.json({
      success: true,
      message: 'Lisensi valid dan terverifikasi online.',
      data: {
        school_name: license.school_name,
        expires_at: license.expires_at,
        device_id: decoded.device_id,
        product_id: license.product_id
      }
    });

  } catch (err) {
    res.status(401).json({ success: false, message: 'Sesi lisensi kedaluwarsa atau tidak valid.' });
  }
});

// 13. Endpoint to upload manual payment receipt
router.post('/api/license/upload-receipt', async (req, res) => {
  const { license_key, image } = req.body;

  if (!license_key || !image) {
    return res.status(400).json({ success: false, message: 'Kunci Lisensi dan Gambar Bukti Transfer wajib dikirim.' });
  }

  try {
    // Check if the license and invoice exist
    const license = await db.get("SELECT id, school_name, product_id FROM licenses WHERE license_key = ?", [license_key.trim()]);
    if (!license) {
      return res.status(404).json({ success: false, message: 'Lisensi tidak ditemukan.' });
    }

    const invoice = await db.get("SELECT id, invoice_number FROM invoices WHERE license_id = ? ORDER BY id DESC LIMIT 1", [license.id]);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Tagihan untuk lisensi ini tidak ditemukan.' });
    }

    // Process base64 image
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, message: 'Format base64 gambar bukti bayar tidak valid.' });
    }

    const fileExtension = matches[1].split('/')[1] || 'png';
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Create target directory if it doesn't exist
    const fs = require('fs');
    const path = require('path');
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'receipts');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${invoice.invoice_number}_${Date.now()}.${fileExtension}`;
    const targetPath = path.join(uploadDir, filename);
    fs.writeFileSync(targetPath, buffer);

    const relativePath = `/uploads/receipts/${filename}`;

    // Update invoices table
    await db.run("UPDATE invoices SET payment_proof = ? WHERE id = ?", [relativePath, invoice.id]);

    await logLicenseActivity(license_key, license.product_id, null, req.ip, 'RECEIPT_UPLOAD_SUCCESS');

    res.json({
      success: true,
      message: 'Bukti transfer berhasil diunggah! Mohon tunggu konfirmasi admin.',
      data: {
        payment_proof: relativePath
      }
    });
  } catch (err) {
    console.error('[RECEIPT UPLOAD ERROR]', err);
    res.status(500).json({ success: false, message: 'Gagal mengunggah gambar bukti transfer di server.' });
  }
});

// ── GET DYNAMIC APK DOWNLOAD LINK FROM EXPO API ──
router.get('/download-apk', async (req, res) => {
  const apkPath = path.join(__dirname, '../public', 'Orkestrator Ujian.apk');

  // Jika berkas sudah ada di SSD VPS lokal, langsung sajikan super cepat!
  if (fs.existsSync(apkPath)) {
    console.log(`[Download APK] ✓ Serving local static APK instantly to ${req.ip}`);
    
    // Tingkatkan hit counter di build-meta.json secara idempoten
    try {
      const metaPath = path.join(__dirname, '../public/build-meta.json');
      let meta = { downloadCount: 0 };
      if (fs.existsSync(metaPath)) {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      }
      meta.downloadCount = (meta.downloadCount || 0) + 1;
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
      console.log(`[Download APK] Total unduhan meningkat menjadi: ${meta.downloadCount}`);
    } catch (e) {
      console.error('[Download APK Counter Error]', e.message);
    }

    return res.download(apkPath, 'Orkestrator Ujian.apk');
  }

  // Jika belum ada berkas lokal, terpaksa ambil dari Expo CDN sebagai fallback dan pemicu sync
  console.log(`[Download APK] Berkas APK lokal tidak ditemukan. Mencari dari Expo CDN...`);
  
  const EXPO_ACCESS_TOKEN = process.env.EXPO_ACCESS_TOKEN;
  if (!EXPO_ACCESS_TOKEN) {
    return res.status(500).send('Konfigurasi token API Expo (EXPO_ACCESS_TOKEN) tidak ditemukan di server.');
  }

  const projectId = '5e1ad67a-a833-4b34-9f25-124dd382a1c9';

  try {
    const fetch = require('node-fetch');
    const query = `
      query GetLatestApkBuild {
        app {
          byId(appId: "${projectId}") {
            builds(
              filter: { platform: ANDROID, status: FINISHED }
              offset: 0
              limit: 1
            ) {
              id
              artifacts { buildUrl }
              createdAt
            }
          }
        }
      }
    `;

    const response = await fetch('https://api.expo.dev/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${EXPO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Download APK] Expo API error ${response.status}: ${errText}`);
      return res.status(502).send(`Gagal mengambil data dari Expo API (HTTP ${response.status}).`);
    }

    const result = await response.json();

    if (result.errors) {
      console.error('[Download APK] GraphQL errors:', JSON.stringify(result.errors));
      return res.status(502).send('Expo API mengembalikan error: ' + result.errors[0]?.message);
    }

    const build = result?.data?.app?.byId?.builds?.[0];

    if (!build || !build.artifacts?.buildUrl) {
      console.warn('[Download APK] Tidak ada build APK sukses yang ditemukan di Expo.');
      console.warn('[Download APK] Response:', JSON.stringify(result).substring(0, 300));
      return res.status(404).send('Tidak ada file APK hasil build yang ditemukan. Pastikan sudah pernah melakukan EAS Build.');
    }

    const downloadUrl = build.artifacts.buildUrl;
    console.log(`[Download APK] ✓ Terpaksa mengalihkan sementara ke Expo CDN: ${downloadUrl}`);
    
    // Pemicu sync latar belakang jika berkas lokal belum ada
    syncApkFromExpoInBackground();

    return res.redirect(302, downloadUrl);
  } catch (err) {
    console.error('[Download APK Error]', err.message);
    return res.status(500).send('Terjadi kesalahan koneksi saat mengambil tautan unduhan.');
  }
});

// ── SISTEM OTOMATISASI BACKGROUND SYNC APK ──
const fs = require('fs');
let isSyncing = false;

async function syncApkFromExpoInBackground() {
  if (isSyncing) {
    console.log('[APK Sync] Proses sinkronisasi sedang berjalan, dilewati...');
    return;
  }

  const EXPO_ACCESS_TOKEN = process.env.EXPO_ACCESS_TOKEN;
  if (!EXPO_ACCESS_TOKEN) {
    console.error('[APK Sync] EXPO_ACCESS_TOKEN tidak dikonfigurasi di server.');
    return;
  }

  isSyncing = true;
  console.log('[APK Sync] Memulai pengecekan build APK terbaru di Expo...');

  const projectId = '5e1ad67a-a833-4b34-9f25-124dd382a1c9';
  const query = `
    query GetLatestApkBuild {
      app {
        byId(appId: "${projectId}") {
          builds(
            filter: { platform: ANDROID, status: FINISHED }
            offset: 0
            limit: 1
          ) {
            id
            artifacts { buildUrl }
            createdAt
          }
        }
      }
    }
  `;

  try {
    const fetch = require('node-fetch');
    const response = await fetch('https://api.expo.dev/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${EXPO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`Expo GraphQL API mengembalikan status ${response.status}`);
    }

    const result = await response.json();
    const build = result?.data?.app?.byId?.builds?.[0];

    if (!build || !build.artifacts?.buildUrl) {
      console.warn('[APK Sync] Tidak ada build sukses yang ditemukan di Expo.');
      isSyncing = false;
      return;
    }

    const buildId = build.id;
    const downloadUrl = build.artifacts.buildUrl;
    const metaPath = path.join(__dirname, '../public/build-meta.json');
    const apkPath = path.join(__dirname, '../public/Orkestrator Ujian.apk');

    // Cek apakah metadata lokal sudah sama dengan build di Expo
    let localMeta = {};
    if (fs.existsSync(metaPath)) {
      try {
        localMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      } catch (e) {
        localMeta = {};
      }
    }

    const apkExists = fs.existsSync(apkPath);

    if (localMeta.buildId === buildId && apkExists) {
      console.log('[APK Sync] Berkas APK lokal sudah yang terbaru dengan Build ID:', buildId);
      isSyncing = false;
      return;
    }

    console.log(`[APK Sync] Menemukan build baru (${buildId}). Mengunduh berkas APK di latar belakang dari: ${downloadUrl}`);

    const resApk = await fetch(downloadUrl);
    if (!resApk.ok) {
      throw new Error(`Gagal mengambil APK dari CDN: ${resApk.statusText}`);
    }

    // Pastikan folder public ada
    const publicDir = path.join(__dirname, '../public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const fileStream = fs.createWriteStream(apkPath);
    
    await new Promise((resolve, reject) => {
      resApk.body.pipe(fileStream);
      resApk.body.on('error', reject);
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    // Simpan metadata baru
    fs.writeFileSync(metaPath, JSON.stringify({ buildId, createdAt: build.createdAt }, null, 2));
    console.log(`[APK Sync] ✓ APK berhasil disinkronkan di latar belakang! Tersimpan sebagai: Orkestrator Ujian.apk`);
  } catch (err) {
    console.error('[APK Sync Error]', err.message);
  } finally {
    isSyncing = false;
  }
}

// Tambahkan rute sinkronisasi manual untuk admin
router.get('/api/license/sync-apk-now', async (req, res) => {
  const { secret } = req.query;
  if (secret !== process.env.ADMIN_SECRET && secret !== 'kumahatetehwe') {
    return res.status(403).send('Akses ditolak.');
  }

  syncApkFromExpoInBackground();
  res.send('Sinkronisasi APK di latar belakang telah dipicu. Silakan pantau log server.');
});

// Tambahkan rute statistik unduhan APK untuk admin
router.get('/api/license/download-stats', async (req, res) => {
  try {
    const metaPath = path.join(__dirname, '../public/build-meta.json');
    let meta = { downloadCount: 0 };
    if (fs.existsSync(metaPath)) {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    }
    
    res.json({
      success: true,
      download_count: meta.downloadCount || 0,
      last_build_id: meta.buildId || 'N/A',
      last_sync_time: meta.createdAt || 'N/A',
      local_file_exists: fs.existsSync(path.join(__dirname, '../public/Orkestrator Ujian.apk'))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil statistik: ' + err.message });
  }
});

// ── VPN TUNNEL REGISTRATION ROUTE ──
router.post('/api/license/tunnel/request', async (req, res) => {
  const { license_key, subdomain_slug } = req.body;
  if (!license_key || !subdomain_slug) {
    return res.status(400).json({ success: false, message: 'License key dan subdomain slug wajib diisi.' });
  }

  try {
    const slugLower = subdomain_slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slugLower)) {
      return res.status(400).json({ success: false, message: 'Subdomain slug hanya boleh huruf kecil, angka, dan strip (-).' });
    }

    // 1. Verifikasi lisensi aktif untuk produk vpn-tunnel
    const license = await db.get('SELECT * FROM licenses WHERE license_key = ? AND is_active = 1 AND product_id = "vpn-tunnel"', [license_key.trim()]);
    if (!license) {
      return res.status(403).json({ success: false, message: 'Lisensi VPN Tunneling tidak ditemukan atau tidak aktif.' });
    }

    // 2. Cek apakah slug sudah terdaftar untuk license/tenant lain dengan produk VPN Tunneling yang sama
    const existingSlug = await db.get('SELECT * FROM licenses WHERE requested_slug = ? AND id != ? AND product_id = ?', [slugLower, license.id, license.product_id]);
    if (existingSlug) {
      return res.status(400).json({ success: false, message: 'Subdomain tersebut sudah digunakan oleh instansi lain.' });
    }

    // 3. Jika sudah ada IP yang terdaftar untuk key ini, gunakan IP tersebut
    let clientIp = license.wireguard_ip;
    if (!clientIp) {
      // Find next available IP (start from 10.0.0.10)
      const activeIps = await db.all('SELECT wireguard_ip FROM licenses WHERE wireguard_ip IS NOT NULL');
      let maxOctet = 9; 
      activeIps.forEach(row => {
        const parts = row.wireguard_ip.split('.');
        if (parts.length === 4) {
          const octet = parseInt(parts[3], 10);
          if (!isNaN(octet) && octet > maxOctet) {
            maxOctet = octet;
          }
        }
      });
      clientIp = `10.0.0.${maxOctet + 1}`;
    }

    // 4. Generate keys
    const { execSync } = require('child_process');
    const privateKey = execSync('wg genkey').toString().trim();
    const publicKey = execSync(`echo "${privateKey}" | wg pubkey`).toString().trim();

    // 5. Hot-add peer & create Nginx config using the secure sudo script
    const localPort = req.body.local_port || 5002;
    const frontendPort = req.body.frontend_port || 5174;
    const safeSchoolName = license.school_name.replace(/[^a-zA-Z0-9 ]/g, '');
    const execCmd = `sudo /usr/local/bin/add-wg-peer.sh "${safeSchoolName}" "${publicKey}" "${clientIp}" "${slugLower}" "${localPort}" "${frontendPort}"`;
    
    console.log(`[VPN Tunnel] Running system command: ${execCmd}`);
    execSync(execCmd);

    // 5b. Ensure Client-to-Client isolation firewall rules are applied on wg0
    try {
      execSync('sudo iptables -C FORWARD -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable', { stdio: 'ignore' });
    } catch (checkErr) {
      console.log('[VPN Tunnel Request] Applying firewall isolation rules on wg0...');
      try {
        const applyCmd = 
          'sudo iptables -A FORWARD -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable && ' +
          'sudo iptables -A FORWARD -i wg0 -o wg0 -m iprange --dst-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable';
        execSync(applyCmd);
        // Persist the rule
        execSync('if [ -d /etc/iptables ]; then sudo sh -c "iptables-save > /etc/iptables/rules.v4"; fi', { stdio: 'ignore' });
        console.log('[VPN Tunnel Request] Firewall isolation rules applied successfully!');
      } catch (applyErr) {
        console.warn('[VPN Tunnel Request WARNING] Failed to apply iptables rules:', applyErr.message);
      }
    }

    // 6. Update database settings
    await db.run('UPDATE licenses SET wireguard_ip = ?, requested_slug = ? WHERE id = ?', [clientIp, slugLower, license.id]);

    triggerCaddySync();

    const clientConfig = `[Interface]
PrivateKey = ${privateKey}
Address = ${clientIp}/24
DNS = 1.1.1.1

[Peer]
PublicKey = SP47bTGqXxN4Qqe2DewpONtYEOh2qcXPTj7dt1g1x2o=
Endpoint = api.${process.env.MAIN_DOMAIN}:51820
AllowedIPs = 10.0.0.0/24
PersistentKeepalive = 25
`;

    res.json({
      success: true,
      message: 'Tunnel Wireguard berhasil dibuat.',
      data: {
        license_key,
        client_ip: clientIp,
        subdomain: `${slugLower}.${process.env.MAIN_DOMAIN}`,
        config: clientConfig
      }
    });
  } catch (err) {
    console.error('[VPN Tunnel Request Error]', err);
    res.status(500).json({ success: false, message: 'Gagal memproses pembuatan VPN Tunnel: ' + err.message });
  }
});

// ── EASY TUNNEL: GET PACKAGES ──
router.get('/api/license/easy-tunnel/packages', async (req, res) => {
  try {
    const plans = await db.all("SELECT * FROM pricing_plans WHERE product_id = 'easy-tunnel' ORDER BY id ASC");
    res.json({ success: true, data: plans });
  } catch (err) {
    console.error('[Easy Tunnel Packages Error]', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil paket Easy Tunnel.' });
  }
});

// ── EASY TUNNEL: VALIDATE LICENSE KEY ──
router.get('/api/license/easy-tunnel/validate/:key', async (req, res) => {
  const { key } = req.params;
  try {
    const license = await db.get(
      "SELECT * FROM licenses WHERE license_key = ? AND product_id = 'easy-tunnel'",
      [key.trim()]
    );
    if (!license) {
      return res.status(404).json({ success: false, message: 'Kunci lisensi Easy Tunnel tidak ditemukan.' });
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    const expired = license.is_active === 0 || license.status === 'expired' || license.expires_at < todayStr;
    res.json({
      success: true,
      data: {
        license_key: license.license_key,
        school_name: license.school_name,
        expires_at: license.expires_at,
        wireguard_ip: license.wireguard_ip || null,
        requested_slug: license.requested_slug || null,
        local_port: license.local_port || null,
        app_name: license.app_name || null,
        active_hostname: license.active_hostname || null,
        expired: expired
      }
    });
  } catch (err) {
    console.error('[Easy Tunnel Validate Error]', err);
    res.status(500).json({ success: false, message: 'Gagal memvalidasi lisensi Easy Tunnel.' });
  }
});

// ── EASY TUNNEL: REQUEST TUNNEL CONFIG (ENDPOINT TERPISAH) ──
// Dipanggil oleh aplikasi Project-Easy-Tunnel setelah license key aktif.
// Workflow:
//  1. Verifikasi license key (product_id = 'easy-tunnel')
//  2. Cek slug tidak duplikat
//  3. Assign WireGuard IP dari pool (10.0.0.10+)
//  4. Generate keypair WireGuard
//  5. Hot-add peer via add-wg-peer.sh
//  6. Simpan wireguard_ip + slug + local_port + app_name ke DB
//  7. Kembalikan file .conf ke client
router.post('/api/license/easy-tunnel/request', async (req, res) => {
  const { license_key, subdomain_slug, local_port, app_name, hostname } = req.body;

  if (!license_key || !subdomain_slug || !local_port) {
    return res.status(400).json({
      success: false,
      message: 'license_key, subdomain_slug, dan local_port wajib diisi.'
    });
  }

  try {
    const slugLower = subdomain_slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slugLower)) {
      return res.status(400).json({
        success: false,
        message: 'Subdomain slug hanya boleh huruf kecil, angka, dan strip (-).'
      });
    }

    const portNum = parseInt(local_port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return res.status(400).json({ success: false, message: 'Port lokal tidak valid (1-65535).' });
    }

    // 1. Verifikasi lisensi aktif easy-tunnel
    const license = await db.get(
      "SELECT * FROM licenses WHERE license_key = ? AND is_active = 1 AND product_id = 'easy-tunnel'",
      [license_key.trim()]
    );
    if (!license) {
      return res.status(403).json({
        success: false,
        message: 'Lisensi Easy Tunnel tidak ditemukan atau tidak aktif.'
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (license.expires_at < todayStr) {
      return res.status(403).json({ success: false, message: 'Lisensi Easy Tunnel telah kedaluwarsa.' });
    }

    // PENGUNCIAN DEVICE BERDASARKAN HOSTNAME (Single Device Lock)
    if (hostname) {
      const reqHostname = hostname.trim();
      if (license.active_hostname && license.active_hostname !== reqHostname) {
        return res.status(403).json({
          success: false,
          message: `Lisensi ini sudah aktif di komputer '${license.active_hostname}'. Silakan hapus/uninstal terowongan terlebih dahulu di komputer tersebut sebelum memasang di komputer baru.`
        });
      }
    }

    // 2. Cek slug tidak duplikat (global, termasuk vpn-tunnel dan easy-tunnel)
    const existingSlug = await db.get(
      "SELECT id, school_name FROM licenses WHERE requested_slug = ? AND id != ?",
      [slugLower, license.id]
    );
    if (existingSlug) {
      return res.status(400).json({
        success: false,
        message: `Subdomain '${slugLower}' sudah digunakan oleh instansi lain. Silakan pilih subdomain yang berbeda.`
      });
    }

    // 3. Assign IP — gunakan IP yang sudah ada jika key ini sudah pernah request
    let clientIp = license.wireguard_ip;
    if (!clientIp) {
      const activeIps = await db.all('SELECT wireguard_ip FROM licenses WHERE wireguard_ip IS NOT NULL');
      let maxOctet = 9;
      activeIps.forEach(row => {
        const parts = row.wireguard_ip.split('.');
        if (parts.length === 4) {
          const octet = parseInt(parts[3], 10);
          if (!isNaN(octet) && octet > maxOctet) maxOctet = octet;
        }
      });
      clientIp = `10.0.0.${maxOctet + 1}`;
    }

    // 4. Generate WireGuard keypair di server
    const { execSync } = require('child_process');
    const privateKey = execSync('wg genkey').toString().trim();
    const publicKey = execSync(`echo "${privateKey}" | wg pubkey`).toString().trim();

    // 5. Hot-add peer via secure sudo script
    const safeSchoolName = (license.school_name || '').replace(/[^a-zA-Z0-9 ]/g, '');
    const safeAppName = (app_name || 'EasyTunnel').replace(/[^a-zA-Z0-9 ]/g, '');

    // Hapus peer lama yang memiliki IP atau Public Key yang sama untuk menghindari konflik
    try {
      const removeCmd = `sudo python3 /var/www/licensing-server/scripts/remove-wg-peer.py "${clientIp}" "${publicKey}"`;
      console.log(`[Easy Tunnel] Cleaning up old peers: ${removeCmd}`);
      execSync(removeCmd);
    } catch (cleanupErr) {
      console.warn('[Easy Tunnel WARNING] Failed to clean up old peers:', cleanupErr.message);
    }

    // Untuk easy-tunnel: hanya 1 port (local_port) — tidak ada "frontend port"
    // Script add-wg-peer.sh akan buat Nginx/Caddy config untuk single port
    const execCmd = `sudo /usr/local/bin/add-wg-peer.sh "${safeSchoolName} - ${safeAppName}" "${publicKey}" "${clientIp}" "${slugLower}" "${portNum}" "${portNum}"`;

    console.log(`[Easy Tunnel] Running system command: ${execCmd}`);
    execSync(execCmd);

    // 5b. Pastikan aturan isolasi firewall client-to-client aktif
    try {
      execSync(
        'sudo iptables -C FORWARD -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable',
        { stdio: 'ignore' }
      );
    } catch (checkErr) {
      try {
        execSync(
          'sudo iptables -A FORWARD -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable && ' +
          'sudo iptables -A FORWARD -i wg0 -o wg0 -m iprange --dst-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable'
        );
        execSync("if [ -d /etc/iptables ]; then sudo sh -c 'iptables-save > /etc/iptables/rules.v4'; fi", { stdio: 'ignore' });
        console.log('[Easy Tunnel] Firewall isolation rules applied.');
      } catch (applyErr) {
        console.warn('[Easy Tunnel WARNING] Failed to apply iptables rules:', applyErr.message);
      }
    }

    // 6. Simpan ke database
    await db.run(
      'UPDATE licenses SET wireguard_ip = ?, requested_slug = ?, local_port = ?, app_name = ?, active_hostname = ? WHERE id = ?',
      [clientIp, slugLower, portNum, app_name || null, hostname ? hostname.trim() : null, license.id]
    );

    triggerCaddySync();

    // 7. Generate konfigurasi WireGuard client
    // Baca server public key dari file (jika ada) atau gunakan hardcoded
    let serverPublicKey = 'SP47bTGqXxN4Qqe2DewpONtYEOh2qcXPTj7dt1g1x2o=';
    try {
      const fs = require('fs');
      if (fs.existsSync('/etc/wireguard/publickey')) {
        serverPublicKey = fs.readFileSync('/etc/wireguard/publickey', 'utf8').trim();
      }
    } catch (e) {}

    const serverEndpoint = process.env.VPS_IP || `api.${process.env.MAIN_DOMAIN}`;
    const clientConfig = `[Interface]
PrivateKey = ${privateKey}
Address = ${clientIp}/24
DNS = 1.1.1.1

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${serverEndpoint}:51820
AllowedIPs = 10.0.0.0/24
PersistentKeepalive = 25
`;

    console.log(`[Easy Tunnel] Tunnel created: ${slugLower}.${process.env.MAIN_DOMAIN} → ${clientIp}:${portNum} (App: ${app_name})`);

    res.json({
      success: true,
      message: 'Easy Tunnel WireGuard berhasil dibuat.',
      data: {
        license_key,
        client_ip: clientIp,
        subdomain: `${slugLower}.${process.env.MAIN_DOMAIN}`,
        local_port: portNum,
        app_name: app_name || null,
        config: clientConfig
      }
    });

  } catch (err) {
    console.error('[Easy Tunnel Request Error]', err);
    res.status(500).json({
      success: false,
      message: 'Gagal memproses Easy Tunnel: ' + err.message
    });
  }
});

// ── UPDATE CUSTOM DOMAIN FOR TUNNEL ──
router.post('/api/license/tunnel/custom-domain', async (req, res) => {
  const { license_key, custom_domain } = req.body;
  if (!license_key) {
    return res.status(400).json({ success: false, message: 'License key wajib diisi.' });
  }

  try {
    // 1. Verifikasi lisensi aktif di SQLite
    const license = await db.get('SELECT * FROM licenses WHERE license_key = ? AND is_active = 1', [license_key.trim()]);
    if (!license) {
      return res.status(403).json({ success: false, message: 'Lisensi tidak ditemukan atau tidak aktif.' });
    }

    const slug = license.requested_slug;
    if (!slug) {
      return res.status(400).json({ success: false, message: 'Lisensi belum di-online-kan (belum memiliki slug/IP).' });
    }

    let targetDomain = null;
    if (custom_domain) {
      targetDomain = custom_domain.trim().toLowerCase();
      // Validasi format domain
      const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/;
      if (!domainRegex.test(targetDomain)) {
        return res.status(400).json({ success: false, message: 'Format domain kustom tidak valid. Contoh: zakat.sekolah.sch.id' });
      }
    }

    // 2. Update Local SQLite database instead of Supabase
    await db.run(
      'UPDATE licenses SET custom_domain = ? WHERE license_key = ?',
      [targetDomain, license_key.trim()]
    );

    // 3. Trigger Caddy sync
    triggerCaddySync();

    res.json({
      success: true,
      message: targetDomain 
        ? `Domain kustom '${targetDomain}' berhasil disinkronkan ke cloud gateway.`
        : 'Domain kustom berhasil dinonaktifkan di cloud gateway.',
      custom_domain: targetDomain
    });

  } catch (err) {
    console.error('[Tunnel Custom Domain Sync Error]', err.message);
    res.status(500).json({ success: false, message: 'Gagal sinkronisasi domain kustom ke VPS: ' + err.message });
  }
});

// ── EASY TUNNEL: UPDATE LOCAL PORT ──
router.post('/api/license/easy-tunnel/update-port', async (req, res) => {
  const { license_key, local_port } = req.body;

  if (!license_key || !local_port) {
    return res.status(400).json({ success: false, message: 'license_key dan local_port wajib diisi.' });
  }

  const portNum = parseInt(local_port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return res.status(400).json({ success: false, message: 'Port lokal tidak valid (1-65535).' });
  }

  try {
    // 1. Verifikasi lisensi aktif easy-tunnel
    const license = await db.get(
      "SELECT id, is_active FROM licenses WHERE license_key = ? AND product_id = 'easy-tunnel'",
      [license_key.trim()]
    );

    if (!license) {
      return res.status(404).json({ success: false, message: 'Lisensi Easy Tunnel tidak ditemukan.' });
    }

    if (license.is_active !== 1) {
      return res.status(403).json({ success: false, message: 'Lisensi Easy Tunnel tidak aktif.' });
    }

    // 2. Update local_port
    await db.run(
      'UPDATE licenses SET local_port = ? WHERE license_key = ?',
      [portNum, license_key.trim()]
    );

    // 3. Trigger Caddy sync
    triggerCaddySync();

    res.json({
      success: true,
      message: `Port lokal berhasil diubah ke ${portNum} di cloud gateway.`
    });

  } catch (err) {
    console.error('[Tunnel Change Port Sync Error]', err.message);
    res.status(500).json({ success: false, message: 'Gagal mengubah port di VPS: ' + err.message });
  }
});

// ── EASY TUNNEL: RELEASE LICENSE (DEVICE UNLOCK) ──
router.post('/api/license/easy-tunnel/release', async (req, res) => {
  const { license_key } = req.body;

  if (!license_key) {
    return res.status(400).json({ success: false, message: 'license_key wajib diisi.' });
  }

  try {
    const license = await db.get(
      "SELECT id, active_hostname FROM licenses WHERE license_key = ? AND product_id = 'easy-tunnel'",
      [license_key.trim()]
    );

    if (!license) {
      return res.status(404).json({ success: false, message: 'Lisensi tidak ditemukan.' });
    }

    // Set active_hostname back to NULL
    await db.run(
      'UPDATE licenses SET active_hostname = NULL WHERE id = ?',
      [license.id]
    );

    console.log(`[Easy Tunnel] Released active device lock for license: ${license_key}`);

    res.json({
      success: true,
      message: 'Kunci perangkat (device lock) berhasil dilepas.'
    });

  } catch (err) {
    console.error('[Tunnel Release Error]', err.message);
    res.status(500).json({ success: false, message: 'Gagal melepas kunci perangkat: ' + err.message });
  }
});

// Helper function to auto-provision VPN license addon
async function activateVpnAddonIfNeeded(license, req) {
  if (license.include_vpn !== 1) return;
  
  try {
    const slugLower = (license.requested_slug || '').trim().toLowerCase();
    if (!slugLower) {
      console.warn('[VPN Addon Autoprovision] License has no requested_slug. Skipping.');
      return;
    }
    
    // Check if there's already an active vpn-tunnel license for this slug
    const existingVpn = await db.get(
      'SELECT id FROM licenses WHERE requested_slug = ? AND product_id = "vpn-tunnel" AND is_active = 1',
      [slugLower]
    );
    if (existingVpn) {
      console.log(`[VPN Addon Autoprovision] VPN license already exists for slug '${slugLower}'. Skipping.`);
      return;
    }

    const newVpnKey = generateKey('vpn-tunnel', 'VPN');
    const now = new Date();
    // VPN addon is monthly (30 days)
    now.setDate(now.getDate() + 30);
    const expiresStr = now.toISOString().slice(0, 10);

    // Insert vpn license
    await db.run(
      "INSERT INTO licenses (license_key, product_id, school_name, device_limit, is_unlimited, expires_at, status, is_active, plan_id, requested_slug) VALUES (?, 'vpn-tunnel', ?, 1, 0, ?, 'active', 1, 'vpn_monthly', ?)",
      [newVpnKey, `${license.school_name} (VPN Addon)`, expiresStr, slugLower]
    );

    const insertedVpn = await db.get("SELECT id FROM licenses WHERE license_key = ?", [newVpnKey]);
    const vpnLicenseId = insertedVpn ? insertedVpn.id : null;

    if (vpnLicenseId) {
      await db.run(
        "INSERT INTO subscriptions (license_id, school_name, product_id, plan_id, status, start_date, end_date) VALUES (?, ?, 'vpn-tunnel', 'vpn_monthly', 'active', datetime('now', 'localtime'), ?)",
        [vpnLicenseId, `${license.school_name} (VPN Addon)`, expiresStr]
      );
      await logLicenseActivity(newVpnKey, 'vpn-tunnel', null, req.ip, 'AUTOPROVISION_VPN_ADDON_SUCCESS');
      console.log(`[VPN Addon Autoprovision] Successfully provisioned VPN license key: ${newVpnKey} for slug: ${slugLower}`);
    }
  } catch (err) {
    console.error('[VPN Addon Autoprovision Error]', err);
  }
}

// ── CLIENT OTP AUTHENTICATION & MANAGEMENT ENDPOINTS ──
const otp = require('../utils/otp');
const waGateway = require('../services/waGateway');

function formatWA(nomor) {
  if (!nomor) return '';
  let clean = nomor.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }
  return clean;
}

function clientAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Harap masuk terlebih dahulu.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, ADMIN_SECRET + '_client_session');
    if (decoded && decoded.nomor) {
      req.operator = decoded;
      return next();
    }
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Sesi login telah berakhir. Silakan masuk kembali.' });
  }
  return res.status(401).json({ success: false, message: 'Sesi login tidak valid.' });
}

// POST /api/auth/request-otp -> kirim OTP
router.post('/api/auth/request-otp', async (req, res) => {
  let { nomor } = req.body;
  if (!nomor) {
    return res.status(400).json({ success: false, message: 'Nomor WhatsApp wajib diisi.' });
  }
  nomor = formatWA(nomor);
  if (!nomor.startsWith('62') || nomor.length < 10) {
    return res.status(400).json({ success: false, message: 'Format nomor WhatsApp tidak valid.' });
  }

  // Rate Limiting Check
  if (otp.hasActiveOTP(nomor)) {
    const remaining = otp.getRemainingSeconds(nomor);
    return res.status(429).json({
      success: false,
      message: `Silakan tunggu ${remaining} detik sebelum meminta kode OTP kembali.`
    });
  }

  try {
    const code = otp.generateOTP(nomor);
    
    const templates = [
      `*[Easy Tunnel]*\n\nKode OTP verifikasi Anda adalah: *${code}*\n\nJangan bagikan kode ini kepada siapa pun. Kode berlaku selama 5 menit.`,
      `🔑 *Kode OTP Easy Tunnel*: *${code}*\n\nMasukkan kode ini untuk masuk ke dashboard. Rahasiakan kode verifikasi Anda. Kedaluwarsa dalam 5 menit.`,
      `Halo! Berikut adalah kode verifikasi akun Easy Tunnel Anda:\n\n*${code}*\n\nBerlaku selama 5 menit. Abaikan jika Anda tidak memintanya.`,
      `⚠️ *KEAMANAN AKUN - Easy Tunnel*\n\nKode verifikasi masuk Anda: *${code}*\n\nKode ini bersifat rahasia dan aktif selama 300 detik.`,
      `Berikut adalah kode OTP Anda untuk masuk ke sistem:\n🔑 *${code}*\n\nBerlaku 5 menit. Tim kami tidak pernah meminta kode ini.`,
      `Kode verifikasi Easy Tunnel Anda: *${code}*`,
      `OTP masuk Easy Tunnel: *${code}*`,
      `Kode OTP Anda: *${code}* (Berlaku 5 menit)`,
      `Gunakan kode *${code}* untuk login ke dashboard Easy Tunnel.`
    ];
    
    const randTemplate = templates[Math.floor(Math.random() * templates.length)];
    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
    const message = `${randTemplate}\n\n_[Ref: ${randomChars} - Pukul ${timeStr}]_`;
    
    await waGateway.sendMessage(nomor, message);
    res.json({ success: true, message: 'Kode OTP berhasil dikirim ke nomor WhatsApp Anda.' });
  } catch (err) {
    console.error('[Request OTP Error]', err.message);
    res.status(500).json({ success: false, message: 'Gagal mengirim OTP: ' + err.message });
  }
});

// POST /api/auth/verify-otp -> verifikasi OTP
router.post('/api/auth/verify-otp', async (req, res) => {
  let { nomor, code } = req.body;
  if (!nomor || !code) {
    return res.status(400).json({ success: false, message: 'Nomor WhatsApp dan kode OTP wajib diisi.' });
  }
  nomor = formatWA(nomor);
  
  const result = otp.verifyOTP(nomor, code);
  if (!result.valid) {
    return res.status(400).json({ success: false, message: result.reason });
  }

  // OTP Valid - Generate JWT
  const token = jwt.sign({ nomor }, ADMIN_SECRET + '_client_session', { expiresIn: '30d' });
  res.json({
    success: true,
    token,
    message: 'Verifikasi berhasil!'
  });
});

// GET /api/auth/my-licenses -> daftar lisensi operator
router.get('/api/auth/my-licenses', clientAuth, async (req, res) => {
  const { nomor } = req.operator;
  try {
    const licenses = await db.all(
      "SELECT * FROM licenses WHERE operator_phone = ? AND product_id = 'easy-tunnel' ORDER BY created_at DESC",
      [nomor]
    );
    res.json({ success: true, count: licenses.length, data: licenses });
  } catch (err) {
    console.error('[Get Licenses Error]', err.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil daftar lisensi: ' + err.message });
  }
});

// GET /api/license/easy-tunnel/check-vnc-port/:license_key -> check reachability of VNC port (5900) on WireGuard IP
router.get('/api/license/easy-tunnel/check-vnc-port/:license_key', async (req, res) => {
  const { license_key } = req.params;
  if (!license_key) {
    return res.status(400).json({ success: false, message: 'License key wajib diisi.' });
  }

  const cleanKey = license_key.trim();
  try {
    const license = await db.get(
      "SELECT wireguard_ip, is_active FROM licenses WHERE license_key = ? AND product_id = 'easy-tunnel'",
      [cleanKey]
    );

    if (!license) {
      return res.status(404).json({ success: false, message: 'Kunci lisensi tidak ditemukan.' });
    }

    if (!license.is_active) {
      return res.status(400).json({ success: false, message: 'Lisensi tidak aktif.' });
    }

    if (!license.wireguard_ip) {
      return res.status(400).json({ success: false, message: 'Tunnel WireGuard belum diaktifkan (IP WireGuard kosong).' });
    }

    const net = require('net');
    const checkTcpPort = (ip, port, timeoutMs = 2500) => {
      return new Promise((resolve) => {
        const socket = new net.Socket();
        let resolved = false;

        socket.setTimeout(timeoutMs);

        socket.connect(port, ip, () => {
          if (!resolved) {
            resolved = true;
            socket.destroy();
            resolve(true);
          }
        });

        socket.on('error', () => {
          if (!resolved) {
            resolved = true;
            socket.destroy();
            resolve(false);
          }
        });

        socket.on('timeout', () => {
          if (!resolved) {
            resolved = true;
            socket.destroy();
            resolve(false);
          }
        });
      });
    };

    const isReachable = await checkTcpPort(license.wireguard_ip, 5900, 2500);

    return res.json({
      success: true,
      wireguard_ip: license.wireguard_ip,
      reachable: isReachable
    });
  } catch (err) {
    console.error('[Check VNC Port Error]', err.message);
    res.status(500).json({ success: false, message: 'Gagal memeriksa port VNC: ' + err.message });
  }
});

// POST /api/auth/claim-license -> klaim lisensi ke nomor operator
router.post('/api/auth/claim-license', clientAuth, async (req, res) => {
  const { nomor } = req.operator;
  const { license_key } = req.body;
  if (!license_key) {
    return res.status(400).json({ success: false, message: 'License key wajib diisi.' });
  }

  const cleanKey = license_key.trim();
  try {
    const license = await db.get(
      "SELECT * FROM licenses WHERE license_key = ? AND product_id = 'easy-tunnel'",
      [cleanKey]
    );

    if (!license) {
      return res.status(404).json({ success: false, message: 'Kunci lisensi tidak ditemukan.' });
    }

    if (license.operator_phone && license.operator_phone !== nomor) {
      return res.status(400).json({
        success: false,
        message: 'Kunci lisensi ini sudah diklaim oleh operator lain.'
      });
    }

    await db.run(
      "UPDATE licenses SET operator_phone = ? WHERE license_key = ?",
      [nomor, cleanKey]
    );

    res.json({
      success: true,
      message: 'Kunci lisensi berhasil diklaim dan dikaitkan dengan nomor Anda.'
    });
  } catch (err) {
    console.error('[Claim License Error]', err.message);
    res.status(500).json({ success: false, message: 'Gagal mengklaim lisensi: ' + err.message });
  }
});

// GET /api/auth/my-orders -> daftar invoice operator
router.get('/api/auth/my-orders', clientAuth, async (req, res) => {
  const { nomor } = req.operator;
  try {
    const orders = await db.all(
      "SELECT i.* FROM invoices i JOIN licenses l ON i.license_id = l.id WHERE l.operator_phone = ? AND l.product_id = 'easy-tunnel' ORDER BY i.id DESC",
      [nomor]
    );
    res.json({ success: true, count: orders.length, data: orders });
  } catch (err) {
    console.error('[Get Orders Error]', err.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil daftar order: ' + err.message });
  }
});

module.exports = router;
module.exports.provisionNginxAndSsl = provisionNginxAndSsl;
module.exports.syncApkFromExpoInBackground = syncApkFromExpoInBackground;
