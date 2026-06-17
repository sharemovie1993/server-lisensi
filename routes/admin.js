const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const { db } = require('../config/db');
const { ADMIN_SECRET, TOTP_SECRET } = require('../config/keys');
const { verifyTOTP } = require('../utils/totp');
const { logLicenseActivity } = require('../utils/logger');
const { generateKey } = require('../utils/helpers');
const { triggerCaddySync } = require('../utils/caddy');

// ── ADMIN AUTHENTICATION MIDDLEWARE ──
function adminAuth(req, res, next) {
  const authHeader = req.headers['x-admin-secret'] || req.query.secret;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Akses Ditolak. Harap login terlebih dahulu.' });
  }

  // Bypass 2FA for local CLI scripts or localhost connections
  const ip = req.ip || req.connection.remoteAddress;
  const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  if (isLocalhost && authHeader === ADMIN_SECRET) {
    return next();
  }

  try {
    const decoded = jwt.verify(authHeader, ADMIN_SECRET + '_2fa_session');
    if (decoded.role === 'admin') {
      return next();
    }
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Sesi login telah berakhir atau tidak valid. Silakan login kembali.' });
  }

  return res.status(401).json({ success: false, message: 'Akses Ditolak.' });
}

// Admin login brute-force defense
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Terlalu banyak percobaan PIN Admin. Silakan coba lagi setelah 15 menit.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── ADMIN ENDPOINTS ──

// 1. Admin login with TOTP verification
router.post('/api/admin/login', adminLoginLimiter, (req, res) => {
  const { secret, totp_code } = req.body;
  
  if (secret === ADMIN_SECRET) {
    const isTotpValid = verifyTOTP(TOTP_SECRET, totp_code);
    if (isTotpValid) {
      const sessionToken = jwt.sign({ role: 'admin' }, ADMIN_SECRET + '_2fa_session', { expiresIn: '7d' });
      return res.json({ success: true, token: sessionToken });
    }
  }
  
  res.status(401).json({ success: false, message: 'PIN Admin atau Kode 2FA tidak valid!' });
});

// 2. Get registered products list
router.get('/api/admin/products', adminAuth, async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM products ORDER BY name ASC');
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil daftar produk.' });
  }
});

// 3. Get Tenants list from Local SQLite (Replaces Supabase)
router.get('/api/admin/tenants', adminAuth, async (req, res) => {
  try {
    // Fetch all records from licenses table that have a slug (indicating they are tenants)
    const rows = await db.all(
      'SELECT id, school_name as name, requested_slug as domain_or_slug, license_key, created_at, is_active, status as license_status, expires_at as license_expiry, custom_domain FROM licenses WHERE requested_slug IS NOT NULL AND requested_slug != "" ORDER BY created_at DESC'
    );
    
    const enrichedTenants = rows.map(tenant => ({
      ...tenant,
      license_details: {
        status: tenant.license_status,
        expires_at: tenant.license_expiry,
        is_active: tenant.is_active
      }
    }));

    res.json({ success: true, count: enrichedTenants.length, data: enrichedTenants });
  } catch (err) {
    console.error('[Admin Tenants] Error fetching tenants from SQLite:', err.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil daftar tenant: ' + err.message });
  }
});

// 4. Generate License Key Manual
router.post('/api/license/generate', adminAuth, async (req, res) => {
  const { school_name, device_limit, duration_days, product_id, plan_id, tenant_id } = req.body;

  if (!school_name) {
    return res.status(400).json({ success: false, message: 'Nama Sekolah harus diisi.' });
  }

  const prodId = product_id || 'gform-orkestrator';
  const limit = (device_limit !== undefined && device_limit !== null) ? parseInt(device_limit, 10) : 1;
  const days = parseInt(duration_days, 10) || 365;
  const isUnlimited = (req.body.is_unlimited === 1 || req.body.is_unlimited === true || limit >= 9999) ? 1 : 0;

  const expireDate = new Date();
  expireDate.setDate(expireDate.getDate() + days);
  const expiresStr = expireDate.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  let productPrefix = null;
  try {
    const prodDb = await db.get("SELECT key_prefix FROM products WHERE id = ?", [prodId]);
    if (prodDb && prodDb.key_prefix) {
      productPrefix = prodDb.key_prefix;
    }
  } catch (e) {
    console.error('[Admin License Generate] Failed to fetch product key prefix:', e.message);
  }

  const newKey = generateKey(prodId, productPrefix);

  try {
    let resolvedPlanId = plan_id;
    if (!resolvedPlanId) {
      if (prodId === 'absenta') {
        resolvedPlanId = limit >= 400 ? 'absenta_annual' : (limit >= 150 ? 'absenta_semester' : 'absenta_monthly');
      } else if (prodId === 'project-yatim') {
        resolvedPlanId = isUnlimited ? 'yatim_enterprise_lifetime' : 'yatim_basic_lifetime';
      } else {
        resolvedPlanId = isUnlimited ? 'annual' : 'monthly';
      }
    }

    const plan = await db.get("SELECT * FROM pricing_plans WHERE id = ?", [resolvedPlanId]) || {
      id: resolvedPlanId,
      title: isUnlimited ? 'Tahunan' : 'Bulanan',
      price: isUnlimited ? 'Rp 1.199.000' : 'Rp 299.000'
    };

    const amount = parseInt(plan.price.replace(/[^\d]/g, ''), 10) || 299000;

    await db.run(
      "INSERT INTO licenses (license_key, product_id, school_name, device_limit, is_unlimited, expires_at, status, is_active, plan_id) VALUES (?, ?, ?, ?, ?, ?, 'active', 1, ?)",
      [newKey, prodId, school_name.trim(), limit, isUnlimited, expiresStr, plan.id]
    );

    const insertedLicense = await db.get("SELECT id FROM licenses WHERE license_key = ?", [newKey]);
    const licenseId = insertedLicense ? insertedLicense.id : null;

    if (licenseId) {
      await db.run(
        "INSERT INTO subscriptions (license_id, school_name, product_id, plan_id, status, start_date, end_date) VALUES (?, ?, ?, ?, 'active', ?, ?)",
        [licenseId, school_name.trim(), prodId, plan.id, todayStr, expiresStr]
      );

      const randomPrefix = Math.floor(1000 + Math.random() * 9000);
      const prefixCode = productPrefix || 'GEN';
      const invNum = `INV-${prefixCode}-${randomPrefix}-${new Date().getFullYear()}`;
      await db.run(
        "INSERT INTO invoices (invoice_number, license_id, school_name, product_id, plan_title, amount, status, payment_method, paid_at) VALUES (?, ?, ?, ?, ?, ?, 'paid', 'Manual', (datetime('now', 'localtime')))",
        [invNum, licenseId, school_name.trim(), prodId, plan.title, amount]
      );
    }

    if (tenant_id) {
      console.log(`[License Generator] Linking generated key '${newKey}' to Supabase tenant ID: ${tenant_id}`);
      try {
        const https = require('https');
        const updateTenantLicenseRest = (id, licenseKey) => {
          return new Promise((resolve, reject) => {
            const data = JSON.stringify({ license_key: licenseKey });
            const options = {
              hostname: 'supabaselocal.absenta.id',
              port: 443,
              path: `/rest/v1/tenants?id=eq.${id}`,
              method: 'PATCH',
              headers: {
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE',
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE',
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

        await updateTenantLicenseRest(tenant_id, newKey);
        console.log(`[License Generator] Successfully updated Supabase tenant ${tenant_id} with license key ${newKey}`);
      } catch (supabaseErr) {
        console.error('[License Generator] Failed to update Supabase tenant:', supabaseErr.message);
      }
    }

    await logLicenseActivity(newKey, prodId, null, req.ip, 'MANUAL_GENERATED');

    triggerCaddySync();

    res.json({
      success: true,
      message: 'License Key baru beserta Subscription & Invoice berstatus PAID berhasil dibuat.',
      data: {
        license_key: newKey,
        product_id: prodId,
        school_name,
        device_limit: limit,
        expires_at: expiresStr,
        duration_days: days
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal membuat kunci lisensi di database.' });
  }
});

// 5. Upload Merchant QRIS Image
router.post('/api/admin/qris', adminAuth, async (req, res) => {
  const { image } = req.body;

  if (!image) {
    return res.status(400).json({ success: false, message: 'Data gambar QRIS wajib disertakan.' });
  }

  try {
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, message: 'Format base64 gambar tidak valid.' });
    }

    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    const targetPath = path.join(__dirname, '..', 'public', 'qris.png');
    fs.writeFileSync(targetPath, buffer);

    res.json({
      success: true,
      message: 'Gambar QRIS berhasil diperbarui!',
      url: `/qris.png?t=${Date.now()}`
    });
  } catch (err) {
    console.error('[QRIS UPLOAD ERROR]', err);
    res.status(500).json({ success: false, message: 'Gagal menyimpan gambar QRIS di server.' });
  }
});

// 6. Update specific pricing package
router.post('/api/admin/packages/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { title, price, duration, device_limit, badge } = req.body;

  if (!title || !price || !duration || !device_limit) {
    return res.status(400).json({ success: false, message: 'Semua kolom wajib diisi kecuali badge.' });
  }

  try {
    const plan = await db.get('SELECT * FROM pricing_plans WHERE id = ?', [id]);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Paket harga tidak ditemukan.' });
    }

    await db.run(
      "UPDATE pricing_plans SET title = ?, price = ?, duration = ?, device_limit = ?, badge = ? WHERE id = ?",
      [title.trim(), price.trim(), duration.trim(), parseInt(device_limit, 10), badge ? badge.trim() : null, id]
    );

    res.json({
      success: true,
      message: `Paket ${title} berhasil diperbarui!`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui paket harga di database.' });
  }
});

// 6b. Create a new pricing package
router.post('/api/admin/packages', adminAuth, async (req, res) => {
  const { id, product_id, title, price, duration, device_limit, is_unlimited, badge } = req.body;

  if (!id || !product_id || !title || !price || !duration || device_limit === undefined) {
    return res.status(400).json({ success: false, message: 'Semua kolom wajib diisi kecuali badge.' });
  }

  try {
    const existing = await db.get('SELECT * FROM pricing_plans WHERE id = ?', [id.trim()]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'ID Paket sudah terdaftar.' });
    }

    await db.run(
      "INSERT INTO pricing_plans (id, product_id, title, price, duration, device_limit, is_unlimited, badge) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id.trim(),
        product_id.trim(),
        title.trim(),
        price.trim(),
        duration.trim(),
        parseInt(device_limit, 10),
        is_unlimited ? 1 : 0,
        badge ? badge.trim() : null
      ]
    );

    res.json({
      success: true,
      message: `Paket ${title} berhasil dibuat!`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal membuat paket baru di database.' });
  }
});

// 6c. Delete pricing package
router.delete('/api/admin/packages/:id', adminAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const plan = await db.get('SELECT * FROM pricing_plans WHERE id = ?', [id]);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Paket harga tidak ditemukan.' });
    }

    await db.run('DELETE FROM pricing_plans WHERE id = ?', [id]);

    res.json({
      success: true,
      message: `Paket ${plan.title} berhasil dihapus!`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal menghapus paket harga dari database.' });
  }
});

const net = require('net');

const getBackendPortFromNginx = (subdomain) => {
  if (!subdomain) return 5002;
  try {
    const confPath = `/etc/nginx/sites-available/${subdomain}.absenta.id`;
    if (fs.existsSync(confPath)) {
      const content = fs.readFileSync(confPath, 'utf8');
      const apiBlockMatch = content.match(/location\s+\/api\s*\{[^}]*proxy_pass\s+http:\/\/10\.0\.0\.\d+:(\d+)/i);
      if (apiBlockMatch) return parseInt(apiBlockMatch[1], 10);
      const match = content.match(/proxy_pass\s+http:\/\/10\.0\.0\.\d+:(\d+)/);
      if (match) return parseInt(match[1], 10);
    }
  } catch (e) {
    console.error(`[Nginx Parser] Gagal membaca port backend untuk ${subdomain}:`, e.message);
  }
  return 5002;
};

const checkTcpPort = (ip, port, timeoutMs = 600) => {
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

// 7. List all licenses & activations
router.get('/api/license/list', adminAuth, async (req, res) => {
  try {
    const list = await db.all(`
      SELECT l.*, 
             p.device_limit AS plan_device_limit, 
             p.is_unlimited AS plan_is_unlimited,
             p.title AS plan_title,
             i.payment_method AS invoice_payment_method,
             i.payment_proof AS invoice_payment_proof
      FROM licenses l
      LEFT JOIN pricing_plans p ON l.plan_id = p.id
      LEFT JOIN invoices i ON l.id = i.license_id
      ORDER BY l.id DESC
    `);

    // Fetch WireGuard status if available
    let wgPeers = {};
    try {
      const { execSync } = require('child_process');
      const wgOutput = execSync('wg show wg0 dump').toString();
      const lines = wgOutput.trim().split('\n');
      // Skip first line (interface info)
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split('\t');
        if (parts.length >= 5) {
          const allowedIps = parts[3].split('/')[0]; // e.g. 10.0.0.10
          const latestHandshake = parseInt(parts[4], 10);
          wgPeers[allowedIps] = {
            latest_handshake: latestHandshake,
            endpoint: parts[2] !== '(none)' ? parts[2] : null,
            rx: parseInt(parts[5], 10) || 0,
            tx: parseInt(parts[6], 10) || 0
          };
        }
      }
    } catch (err) {
      console.warn('[Admin API] Failed to read WireGuard status:', err.message);
    }

    const fullList = await Promise.all(
      list.map(async (license) => {
        const devices = await db.all(
          'SELECT device_id, activated_at FROM activated_devices WHERE license_id = ?',
          [license.id]
        );
        
        // Dynamically override device limit and is_unlimited fields from the plan configuration if available
        let finalDeviceLimit = license.device_limit;
        let finalIsUnlimited = license.is_unlimited;
        
        if (license.plan_id && typeof license.plan_device_limit !== 'undefined' && license.plan_device_limit !== null) {
          finalDeviceLimit = license.plan_device_limit;
          finalIsUnlimited = license.plan_is_unlimited;
        }

        const vpnStatus = {
          is_online: false,
          latest_handshake: null,
          endpoint: null,
          rx: 0,
          tx: 0
        };

        if (license.wireguard_ip && wgPeers[license.wireguard_ip]) {
          const peer = wgPeers[license.wireguard_ip];
          const nowSeconds = Math.floor(Date.now() / 1000);
          const hasRecentHandshake = peer.latest_handshake > 0 && (nowSeconds - peer.latest_handshake) < 150;
          
          let isOnline = false;
          if (hasRecentHandshake) {
            // Verifikasi ganda: Dapatkan port backend dinamis dari Nginx config
            const portToCheck = getBackendPortFromNginx(license.requested_slug);
            isOnline = await checkTcpPort(license.wireguard_ip, portToCheck, 600);
          }
          
          vpnStatus.is_online = isOnline;
          vpnStatus.latest_handshake = peer.latest_handshake;
          vpnStatus.endpoint = peer.endpoint;
          vpnStatus.rx = peer.rx;
          vpnStatus.tx = peer.tx;
        }

        return {
          ...license,
          device_limit: finalDeviceLimit,
          is_unlimited: finalIsUnlimited,
          payment_method: license.invoice_payment_method || 'PENDING',
          payment_proof: license.invoice_payment_proof || null,
          active_devices_count: devices.length,
          devices,
          vpn_status: vpnStatus
        };
      })
    );
    res.json({ success: true, count: fullList.length, data: fullList });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat list lisensi.' });
  }
});

// 8. List recent license audit logs
router.get('/api/admin/logs', adminAuth, async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM license_logs ORDER BY id DESC LIMIT 100');
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat log aktivitas.' });
  }
});

// 9. Get SaaS Revenue analytics
router.get('/api/admin/revenue', adminAuth, async (req, res) => {
  try {
    const result = await db.get("SELECT SUM(amount) as total FROM invoices WHERE status = 'paid'");
    const total = parseInt(result.total, 10) || 0;

    const byProduct = {};
    const prods = await db.all("SELECT id FROM products");
    for (const p of prods) {
      const resProd = await db.get("SELECT SUM(amount) as total FROM invoices WHERE status = 'paid' AND product_id = ?", [p.id]);
      byProduct[p.id] = parseInt(resProd.total, 10) || 0;
    }

    res.json({
      success: true,
      data: {
        total_revenue: total,
        by_product: byProduct
      }
    });
  } catch (err) {
    console.error('[REVENUE API ERROR]', err);
    res.status(500).json({ success: false, message: 'Gagal memuat analitik pendapatan.' });
  }
});

// 10. Get list of all Invoices
router.get('/api/admin/invoices', adminAuth, async (req, res) => {
  try {
    const list = await db.all("SELECT * FROM invoices ORDER BY id DESC");
    res.json({ success: true, data: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat daftar invoice.' });
  }
});

// 11. Get list of all Subscriptions
router.get('/api/admin/subscriptions', adminAuth, async (req, res) => {
  try {
    const list = await db.all("SELECT * FROM subscriptions ORDER BY id DESC");
    res.json({ success: true, data: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat daftar langganan.' });
  }
});

// 12. Manually approve payment for an invoice (Offline Transfer/Cash case)
router.post('/api/admin/invoices/pay/:id', adminAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const invoice = await db.get("SELECT * FROM invoices WHERE id = ?", [id]);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan.' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Invoice ini sudah berstatus PAID.' });
    }

    const licenseId = invoice.license_id;
    const license = await db.get("SELECT * FROM licenses WHERE id = ?", [licenseId]);
    if (!license) {
      return res.status(404).json({ success: false, message: 'Lisensi terkait tidak ditemukan.' });
    }

    let planId = license.plan_id;
    if (!planId) {
      if (license.product_id === 'absenta') {
        planId = license.device_limit >= 400 ? 'absenta_annual' : (license.device_limit >= 150 ? 'absenta_semester' : 'absenta_monthly');
      } else {
        planId = license.is_unlimited === 1 ? 'annual' : 'monthly';
      }
      await db.run("UPDATE licenses SET plan_id = ? WHERE id = ?", [planId, licenseId]);
    }

    const plan = await db.get("SELECT * FROM pricing_plans WHERE id = ?", [planId]) || { duration: '365 Hari' };
    let days = 365;
    if (plan.duration.includes('Selama') || planId.includes('lifetime')) {
      days = 3650; // 10 years for lifetime
    } else {
      const match = plan.duration.match(/\d+/);
      days = match ? parseInt(match[0], 10) : 365;
    }

    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + days);
    const expiresStr = expiresDate.toISOString().slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);

    await db.run(
      "UPDATE invoices SET status = 'paid', paid_at = (datetime('now', 'localtime')), payment_method = 'Manual' WHERE id = ?",
      [id]
    );

    await db.run(
      "UPDATE licenses SET status = 'active', is_active = 1, expires_at = ? WHERE id = ?",
      [expiresStr, licenseId]
    );

    await db.run(
      "UPDATE subscriptions SET status = 'active', start_date = ?, end_date = ?, updated_at = (datetime('now', 'localtime')) WHERE license_id = ?",
      [todayStr, expiresStr, licenseId]
    );

    await logLicenseActivity(license.license_key, license.product_id, null, req.ip, 'ADMIN_MANUAL_PAY');

    triggerCaddySync();

    res.json({
      success: true,
      message: `Invoice ${invoice.invoice_number} berhasil disetujui secara manual! Masa aktif sekolah ${license.school_name} aktif hingga ${expiresStr}.`
    });
  } catch (err) {
    console.error('[MANUAL PAY ERROR]', err);
    res.status(500).json({ success: false, message: 'Gagal memproses pembayaran manual invoice.' });
  }
});
// 12b. Upload payment proof for an invoice (ADMIN ONLY)
router.post('/api/admin/invoices/upload-proof/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { image } = req.body; // Expect base64 data URL
  if (!image) {
    return res.status(400).json({ success: false, message: 'Gambar bukti pembayaran tidak diberikan.' });
  }
  try {
    const matches = image.match(/^data:(.+);base64,(.+)$/);
    const ext = matches ? matches[1].split('/')[1] : 'png';
    const data = matches ? matches[2] : image;
    const buffer = Buffer.from(data, 'base64');
    const filename = `payment_proof_${id}_${Date.now()}.${ext}`;
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'payment_proofs');
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);
    const dbPath = `/uploads/payment_proofs/${filename}`;
    await db.run('UPDATE invoices SET payment_proof = ? WHERE id = ?', [dbPath, id]);
    res.json({ success: true, message: 'Bukti pembayaran berhasil diunggah.', proofUrl: dbPath });
  } catch (e) {
    console.error('[UPLOAD PROOF ERROR]', e);
    res.status(500).json({ success: false, message: 'Gagal mengunggah bukti pembayaran.' });
  }
});
// 13. Manually approve a pending QRIS key (ADMIN ONLY)

// 13. Manually approve a pending QRIS key (ADMIN ONLY)
router.post('/api/license/approve/:id', adminAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const license = await db.get('SELECT * FROM licenses WHERE id = ?', [id]);
    if (!license) {
      return res.status(404).json({ success: false, message: 'Kunci lisensi tidak ditemukan.' });
    }

    if (license.status === 'active') {
      return res.status(400).json({ success: false, message: 'Lisensi ini sudah aktif.' });
    }

    let planId = license.plan_id;
    if (!planId) {
      if (license.product_id === 'absenta') {
        planId = license.device_limit >= 400 ? 'absenta_annual' : (license.device_limit >= 150 ? 'absenta_semester' : 'absenta_monthly');
      } else {
        planId = license.is_unlimited === 1 ? 'annual' : 'monthly';
      }
      await db.run("UPDATE licenses SET plan_id = ? WHERE id = ?", [planId, id]);
    }

    const plan = await db.get("SELECT * FROM pricing_plans WHERE id = ?", [planId]) || { duration: '365 Hari' };
    let days = 365;
    if (plan.duration.includes('Selama') || planId.includes('lifetime')) {
      days = 3650; // 10 years for lifetime
    } else {
      const match = plan.duration.match(/\d+/);
      days = match ? parseInt(match[0], 10) : 365;
    }

    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + days);
    const expiresStr = expiresDate.toISOString().slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);

    await db.run(
      "UPDATE licenses SET status = 'active', is_active = 1, expires_at = ? WHERE id = ?",
      [expiresStr, id]
    );

    await db.run(
      "UPDATE subscriptions SET status = 'active', start_date = ?, end_date = ?, updated_at = (datetime('now', 'localtime')) WHERE license_id = ?",
      [todayStr, expiresStr, id]
    );

    await db.run(
      "UPDATE invoices SET status = 'paid', paid_at = (datetime('now', 'localtime')) WHERE license_id = ?",
      [id]
    );

    await logLicenseActivity(license.license_key, license.product_id, null, req.ip, 'ADMIN_APPROVED');

    // ── AUTOMATED SAAS PROVISIONING ON MANUAL APPROVAL ──
    if (license.requested_slug) {
      console.log(`[ADMIN Approval] Manual approval SaaS provisioning: handling Supabase/Nginx for tenant '${license.requested_slug}'...`);
      try {
        const { provisionNginxAndSsl } = require('./license');
        const https = require('https');
        const crypto = require('crypto');

        if (license.is_recovery === 1) {
          // ── KONDISI 1: RECOVERY / PERPANJANGAN LISENSI (UPDATE) ──
          console.log(`[ADMIN Approval] Recovery mode detected. Patching license_key on existing Supabase tenant: ${license.requested_slug}...`);
          
          const updateTenantLicenseRest = (slug, licenseKey, schoolName) => {
            return new Promise((resolve, reject) => {
              const data = JSON.stringify({ license_key: licenseKey, is_active: true, name: schoolName });
              const options = {
                hostname: 'supabaselocal.absenta.id',
                port: 443,
                path: `/rest/v1/tenants?domain_or_slug=eq.${slug}`,
                method: 'PATCH',
                headers: {
                  'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE',
                  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE',
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
          console.log(`[ADMIN Approval] SaaS Recovery/Renewal Successful for tenant: ${license.requested_slug}`);
        } else {
          // ── KONDISI 2: REGISTRASI BARU (INSERT & SEED) ──
          console.log(`[ADMIN Approval] New registration detected. Inserting brand-new Supabase tenant: ${license.requested_slug}...`);
          
          const upsertTenantRest = (payload) => {
            return new Promise((resolve, reject) => {
              const data = JSON.stringify(payload);
              const options = {
                hostname: 'supabaselocal.absenta.id',
                port: 443,
                path: '/rest/v1/tenants',
                method: 'POST',
                headers: {
                  'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE',
                  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE',
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
                hostname: 'supabaselocal.absenta.id',
                port: 443,
                path: '/rest/v1/guru',
                method: 'POST',
                headers: {
                  'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE',
                  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE',
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
          console.log(`[ADMIN Approval] SaaS Provisioning Successful: school '${license.school_name}' live at https://${license.requested_slug}.absenta.id!`);

          if (!license.requested_supabase_url) {
            console.log(`[ADMIN Approval] Shared DB detected. Seeding default admin account...`);
            const guruPayload = {
              tenant_id: tenantId,
              nama_guru: 'Admin ' + license.school_name,
              username: 'admin',
              password_hash: 'pbkdf2_sha256$260000$mockhash$admin',
              pin_pengawas: '123456',
              is_active: true
            };
            await insertGuruRest(guruPayload);
            console.log(`[ADMIN Approval] Successfully seeded default admin account (username: admin) for ${license.school_name}`);
          }
        }
        
        // Konfigurasi dinamis SSL & Nginx (berlaku untuk kedua kondisi)
        provisionNginxAndSsl(license.requested_slug);

      } catch (pgErr) {
        console.error('[ADMIN Approval] SaaS Provisioning Failed during Supabase sync:', pgErr.message);
      }
    }

    triggerCaddySync();

    res.json({
      success: true,
      message: `Lisensi untuk ${license.school_name} berhasil disetujui! Masa aktif disetel dinamis (${plan.duration || 'Setahun'}) hingga ${expiresStr}.`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal menyetujui kunci lisensi di database.' });
  }
});

// 14. Delete or deactivate license key with cascading cleanup
router.delete('/api/license/delete/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const license = await db.get('SELECT * FROM licenses WHERE id = ?', [id]);
    if (license) {
      // 1. Audit log
      await logLicenseActivity(license.license_key, license.product_id, null, req.ip, 'ADMIN_DELETED');
      
      // 2. Cascading cleanup of associated database records
      await db.run('DELETE FROM subscriptions WHERE license_id = ?', [id]);
      await db.run('DELETE FROM invoices WHERE license_id = ?', [id]);
      await db.run('DELETE FROM activated_devices WHERE license_id = ?', [id]);
      
      // 3. Delete parent license record
      await db.run('DELETE FROM licenses WHERE id = ?', [id]);
      
      console.log(`[License Delete] Cascading cleanup successful for license ID: ${id} (${license.school_name})`);
    }

    triggerCaddySync();

    res.json({ success: true, message: 'Lisensi beserta riwayat langganan & tagihan terkait berhasil dibersihkan dari server secara permanen.' });
  } catch (err) {
    console.error('[License Delete Error]', err);
    res.status(500).json({ success: false, message: 'Gagal menghapus lisensi dan data relasi dari database.' });
  }
});

// 15. Get system settings (ADMIN ONLY)
router.get('/api/admin/settings', adminAuth, async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM system_settings');
    const settings = {};
    list.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal mengambil pengaturan sistem.' });
  }
});

// 16. Update system settings (ADMIN ONLY)
router.post('/api/admin/settings', adminAuth, async (req, res) => {
  const { active_gateway, manual_payment_enabled, manual_bank_name, manual_account_number, manual_account_name, whatsapp_number } = req.body;

  try {
    const updateSetting = async (key, val) => {
      if (val !== undefined && val !== null) {
        await db.run('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', [key, String(val).trim()]);
      }
    };

    await updateSetting('active_gateway', active_gateway);
    await updateSetting('manual_payment_enabled', manual_payment_enabled);
    await updateSetting('manual_bank_name', manual_bank_name);
    await updateSetting('manual_account_number', manual_account_number);
    await updateSetting('manual_account_name', manual_account_name);
    await updateSetting('whatsapp_number', whatsapp_number);

    res.json({ success: true, message: 'Pengaturan sistem berhasil diperbarui!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui pengaturan sistem di database.' });
  }
});

// 17. Get Supabase tenant details (counts and settings)
router.get('/api/admin/tenants/:id/detail', adminAuth, async (req, res) => {
  const { id } = req.params;
  const https = require('https');

  const querySupabase = (path, method = 'GET') => {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'supabaselocal.absenta.id',
        port: 443,
        path: path,
        method: method,
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
              resolve(JSON.parse(body));
            } catch (e) {
              resolve([]);
            }
          } else {
            resolve([]);
          }
        });
      });

      request.on('error', (err) => resolve([]));
      request.end();
    });
  };

  const getCount = (table) => {
    return new Promise((resolve) => {
      const options = {
        hostname: 'supabaselocal.absenta.id',
        port: 443,
        path: `/rest/v1/${table}?tenant_id=eq.${id}&select=id`,
        method: 'GET',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE',
          'Prefer': 'count=exact'
        }
      };

      const request = https.request(options, (response) => {
        const contentRange = response.headers['content-range'];
        let count = 0;
        if (contentRange) {
          const parts = contentRange.split('/');
          if (parts.length > 1) {
            count = parseInt(parts[1], 10) || 0;
          }
        }
        response.resume();
        resolve(count);
      });

      request.on('error', () => resolve(0));
      request.end();
    });
  };

  try {
    const tenantInfoList = await querySupabase(`/rest/v1/tenants?id=eq.${id}&select=*`);
    if (tenantInfoList.length === 0) {
      return res.status(404).json({ success: false, message: 'Tenant tidak ditemukan.' });
    }
    const tenant = tenantInfoList[0];

    const [
      siswaCount,
      kelasCount,
      jurusanCount,
      guruCount,
      mapelCount,
      linkSoalCount,
      settings
    ] = await Promise.all([
      getCount('siswa'),
      getCount('kelas'),
      getCount('jurusan'),
      getCount('guru'),
      getCount('mapel'),
      getCount('link_soal'),
      querySupabase(`/rest/v1/settings?tenant_id=eq.${id}&select=*`)
    ]);

    res.json({
      success: true,
      data: {
        tenant,
        counts: {
          siswa: siswaCount,
          kelas: kelasCount,
          jurusan: jurusanCount,
          guru: guruCount,
          mapel: mapelCount,
          link_soal: linkSoalCount
        },
        settings: settings || []
      }
    });
  } catch (err) {
    console.error('[Tenant Detail API Error]', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil detail data tenant: ' + err.message });
  }
});

// 12. Provision VPS VPN Infrastructure (Zero-Touch Provisioning)
router.get('/api/admin/system/provision', adminAuth, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const log = (msg, type = 'info') => {
    res.write(`data: ${JSON.stringify({ msg, type })}\n\n`);
  };

  log('Memulai proses inisialisasi infrastruktur VPS...', 'status');

  const os = require('os');
  const isLinux = os.platform() === 'linux';

  const runCmd = (cmd) => {
    return new Promise((resolve, reject) => {
      log(`Menjalankan: ${cmd}`, 'cmd');
      const { exec } = require('child_process');
      const child = exec(cmd);
      
      child.stdout.on('data', (data) => {
        log(data.toString().trim(), 'stdout');
      });
      
      child.stderr.on('data', (data) => {
        log(data.toString().trim(), 'stderr');
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Exit code ${code}`));
        }
      });
    });
  };

  try {
    if (!isLinux) {
      log('WARNING: Sistem operasi bukan Linux. Instalasi paket sistem dilewati.', 'warning');
    } else {
      // Step 1: Install packages
      log('Step 1: Menginstal paket WireGuard, Nginx, Certbot via APT...', 'step');
      await runCmd('sudo apt-get update && sudo apt-get install -y wireguard nginx certbot python3-certbot-nginx');
      log('Paket sistem berhasil dipasang.', 'success');

      // Step 2: Enable IP Forwarding
      log('Step 2: Mengaktifkan IP Forwarding di kernel Linux...', 'step');
      await runCmd('sudo sysctl -w net.ipv4.ip_forward=1');
      await runCmd("sudo sh -c 'grep -q \"^net.ipv4.ip_forward=1\" /etc/sysctl.conf || echo \"net.ipv4.ip_forward=1\" >> /etc/sysctl.conf'");
      log('IP Forwarding berhasil dikonfigurasi.', 'success');
      
      // Step 3: Wireguard Directory & Server Keys
      log('Step 3: Menyiapkan kunci enkripsi server WireGuard...', 'step');
      await runCmd('sudo mkdir -p /etc/wireguard');
      await runCmd("sudo sh -c 'if [ ! -f /etc/wireguard/privatekey ]; then wg genkey | tee /etc/wireguard/privatekey | wg pubkey > /etc/wireguard/publickey; fi'");
      log('Kunci enkripsi WireGuard siap.', 'success');
    }

    // Step 4: Write add-wg-peer.sh script
    log('Step 4: Membuat skrip otomatisasi peer /usr/local/bin/add-wg-peer.sh...', 'step');
    const fs = require('fs');
    
    const scriptContent = `#!/bin/bash
# add-wg-peer.sh
SCHOOL_NAME=\$1
PUBLIC_KEY=\$2
CLIENT_IP=\$3
SLUG=\$4
DOMAIN="\${SLUG}.absenta.id"

if [ -z "\$SCHOOL_NAME" ] || [ -z "\$PUBLIC_KEY" ] || [ -z "\$CLIENT_IP" ] || [ -z "\$SLUG" ]; then
    echo "Parameter tidak lengkap: school_name public_key client_ip slug"
    exit 1
fi

if grep -q "\$PUBLIC_KEY" /etc/wireguard/wg0.conf 2>/dev/null; then
    echo "Peer dengan public key ini sudah ada."
else
    cat <<WGEOF >> /etc/wireguard/wg0.conf

# Tenant: \$SCHOOL_NAME
[Peer]
PublicKey = \$PUBLIC_KEY
AllowedIPs = \$CLIENT_IP/32
WGEOF
fi

wg syncconf wg0 <(wg-quick strip wg0) 2>/dev/null || true
`;

    const tmpPath = path.join(__dirname, '../add-wg-peer.tmp');
    fs.writeFileSync(tmpPath, scriptContent, 'utf8');

    if (isLinux) {
      await runCmd(`sudo mv ${tmpPath} /usr/local/bin/add-wg-peer.sh`);
      await runCmd('sudo chmod +x /usr/local/bin/add-wg-peer.sh');
      await runCmd('sudo chown root:root /usr/local/bin/add-wg-peer.sh');
    } else {
      log(`[Dev Mode] Script written to ${tmpPath} (Skipped moving to /usr/local/bin)`, 'info');
    }
    log('Skrip add-wg-peer.sh berhasil dibuat.', 'success');

    if (isLinux) {
      // Step 5: Configure wg0.conf (Hanya jika belum ada untuk mencegah kehilangan peer eksisting)
      log('Step 5: Mengonfigurasi interface wg0.conf...', 'step');
      if (fs.existsSync('/etc/wireguard/wg0.conf')) {
        log('Konfigurasi /etc/wireguard/wg0.conf sudah ada. Modifikasi dilewati untuk menjaga peer eksisting.', 'info');
      } else {
        const pKey = fs.readFileSync('/etc/wireguard/privatekey', 'utf8').trim();
        const wgConfContent = `[Interface]
PrivateKey = ${pKey}
Address = 10.0.0.1/24
ListenPort = 51820
`;
        const tmpWgPath = path.join(__dirname, '../wg0.tmp');
        fs.writeFileSync(tmpWgPath, wgConfContent, 'utf8');
        await runCmd(`sudo mv ${tmpWgPath} /etc/wireguard/wg0.conf`);
        await runCmd('sudo chown root:root /etc/wireguard/wg0.conf');
        log('Interface wg0.conf baru berhasil dikonfigurasi.', 'success');
      }

      // Step 6: Enable & Start services
      log('Step 6: Mengaktifkan layanan WireGuard & Nginx...', 'step');
      await runCmd('sudo systemctl enable wg-quick@wg0 && sudo systemctl start wg-quick@wg0');
      await runCmd('sudo systemctl enable nginx && sudo systemctl start nginx');
      log('Layanan Wireguard & Nginx aktif.', 'success');

      // Step 7: Apply Firewall Isolation
      log('Step 7: Menerapkan aturan isolasi firewall VPN (Client-to-Client Isolation)...', 'step');
      const applyCmd = 
        'sudo iptables -D FORWARD -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable 2>/dev/null; ' +
        'sudo iptables -D FORWARD -i wg0 -o wg0 -m iprange --dst-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable 2>/dev/null; ' +
        'sudo iptables -A FORWARD -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable && ' +
        'sudo iptables -A FORWARD -i wg0 -o wg0 -m iprange --dst-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable';
      await runCmd(applyCmd);
      await runCmd("if [ -d /etc/iptables ]; then sudo sh -c 'iptables-save > /etc/iptables/rules.v4'; fi");
      log('Aturan isolasi firewall VPN berhasil diterapkan.', 'success');
    }

    log('==================================================', 'status');
    log('VPS BERHASIL DIINISIALISASI & SIAP DIGUNAKAN!', 'success');
    log('Semua modul VPN & Nginx terkonfigurasi dengan benar.', 'status');
  } catch (err) {
    log(`ERROR KRITIS: ${err.message}`, 'error');
  } finally {
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ── AUTOMATED LICENSE SERVER UPDATE SYSTEM ──
const projectRoot = path.join(__dirname, '..');
const progressFile = path.join(projectRoot, 'update-progress.json');

function updateProgress(data) {
  try {
    fs.writeFileSync(progressFile, JSON.stringify({
      ...data,
      updatedAt: new Date().toISOString()
    }, null, 2));
  } catch (e) {
    console.error('Failed to write progress file:', e);
  }
}

function getProgress() {
  try {
    if (fs.existsSync(progressFile)) {
      return JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    }
  } catch (e) {}
  return { status: 'idle', step: 'done', message: 'Tidak ada pembaruan aktif.' };
}

const execPromise = (cmd, cwd) => {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    exec(cmd, { cwd, timeout: 300000 }, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stderr, stdout });
      } else {
        resolve(stdout);
      }
    });
  });
};

// 1. GET /api/admin/update/check
router.get('/api/admin/update/check', adminAuth, async (req, res) => {
  try {
    const { exec } = require('child_process');
    exec('git rev-parse --abbrev-ref HEAD', { cwd: projectRoot }, (branchErr, branchStdout) => {
      const branch = branchErr ? 'master' : branchStdout.trim() || 'master';

      exec('git fetch', { cwd: projectRoot, timeout: 15000 }, (fetchErr, fetchStdout, fetchStderr) => {
        if (fetchErr) {
          console.error('[Update Check] git fetch failed:', fetchStderr || fetchErr.message);
        }

        exec(`git log HEAD..origin/${branch} --oneline`, { cwd: projectRoot }, (logErr, logStdout, logStderr) => {
          if (logErr) {
            return res.status(500).json({ 
              success: false, 
              error: 'Gagal membandingkan status lokal dengan remote: ' + (logStderr || logErr.message) 
            });
          }

          const commits = logStdout.trim().split('\n').filter(Boolean).map(line => {
            const spaceIdx = line.indexOf(' ');
            if (spaceIdx === -1) return { hash: line, message: '' };
            return {
              hash: line.substring(0, spaceIdx),
              message: line.substring(spaceIdx + 1)
            };
          });

          res.json({
            success: true,
            isBehind: commits.length > 0,
            commits
          });
        });
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. GET /api/admin/update/status
router.get('/api/admin/update/status', adminAuth, (req, res) => {
  res.json({
    success: true,
    data: getProgress()
  });
});

// 3. POST /api/admin/update/execute
router.post('/api/admin/update/execute', adminAuth, async (req, res) => {
  const current = getProgress();
  if (current.status === 'running') {
    return res.status(400).json({ 
      success: false, 
      error: 'Proses pembaruan sedang berjalan. Silakan tunggu hingga selesai.' 
    });
  }

  executeUpdateInBackground();

  res.json({
    success: true,
    message: 'Proses pembaruan server lisensi telah dimulai di latar belakang.'
  });
});

async function executeUpdateInBackground() {
  updateProgress({
    status: 'running',
    step: 'pulling',
    message: 'Menarik kode sumber terbaru dari GitHub...'
  });

  try {
    console.log('[Updater] Pulling latest code for license server...');
    await execPromise('git pull', projectRoot);

    updateProgress({
      status: 'running',
      step: 'installing',
      message: 'Memasang/memperbarui paket library (npm install)...'
    });
    console.log('[Updater] Installing dependencies...');
    await execPromise('npm install', projectRoot);

    updateProgress({
      status: 'success',
      step: 'done',
      message: 'Server lisensi berhasil diperbarui! Memuat ulang layanan...'
    });
    console.log('[Updater] Update completed successfully. Restarting licensing-server PM2 process...');

    const { exec } = require('child_process');
    setTimeout(() => {
      exec('pm2 restart licensing-server', (pm2Err) => {
        if (pm2Err) {
          console.warn('[Updater] PM2 restart licensing-server failed, attempting pm2 restart all...');
          exec('pm2 restart all');
        }
      });
    }, 2000);

  } catch (errPayload) {
    console.error('[Updater] Update failed:', errPayload);
    updateProgress({
      status: 'failed',
      step: 'error',
      message: 'Gagal melakukan pembaruan server lisensi.',
      error: errPayload.stderr || errPayload.error?.message || String(errPayload)
    });
  }
}

// ── CADDY GATEWAY AUTOMATION ENDPOINTS ──

// 1. GET /api/public/validate-domain (Public, local call only)
router.get('/api/public/validate-domain', async (req, res) => {
  const domain = req.query.domain;
  if (!domain) return res.status(400).send('Domain parameter required');
  
  const cleanDomain = domain.trim().toLowerCase();
  
  // A. Check standard subdomain (e.g. *.absenta.id)
  if (cleanDomain.endsWith('.absenta.id')) {
    const slug = cleanDomain.replace('.absenta.id', '');
    try {
      const lic = await db.get("SELECT id FROM licenses WHERE requested_slug = ? AND is_active = 1", [slug]);
      if (lic) return res.status(200).send('OK');
    } catch (e) {}
  }
  
  // B. Check Supabase for custom domain
  try {
    const https = require('https');
    const checkCustomDomainSupabase = (dom) => {
      return new Promise((resolve) => {
        const options = {
          hostname: 'supabaselocal.absenta.id',
          port: 443,
          path: `/rest/v1/tenants?custom_domain=eq.${encodeURIComponent(dom)}&is_active=eq.true&select=id`,
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
            if (response.statusCode === 200) {
              try {
                const arr = JSON.parse(body);
                resolve(arr.length > 0);
              } catch (e) { resolve(false); }
            } else { resolve(false); }
          });
        });
        request.on('error', () => resolve(false));
        request.end();
      });
    };
    
    const isValidCustom = await checkCustomDomainSupabase(cleanDomain);
    if (isValidCustom) return res.status(200).send('OK');
  } catch (err) {
    console.error('[Validate Domain] Error:', err.message);
  }
  
  res.status(404).send('Domain not allowed');
});

// 2. GET /api/admin/caddy/status (Protected)
router.get('/api/admin/caddy/status', adminAuth, (req, res) => {
  const { exec } = require('child_process');
  
  const checkCmd = process.platform === 'linux' ? 'systemctl is-active caddy' : 'echo active';
  exec(checkCmd, (err, stdout) => {
    const isActive = !err && stdout.trim() === 'active';
    
    let caddyfileContent = '';
    try {
      const caddyPath = process.platform === 'linux' ? '/etc/caddy/Caddyfile' : path.join(__dirname, '../Caddyfile.generated');
      if (fs.existsSync(caddyPath)) {
        caddyfileContent = fs.readFileSync(caddyPath, 'utf8');
      }
    } catch(e){}
    
    res.json({
      success: true,
      status: isActive ? 'online' : 'offline',
      caddyfile: caddyfileContent
    });
  });
});

// 3. POST /api/admin/caddy/sync (Protected)
router.post('/api/admin/caddy/sync', adminAuth, (req, res) => {
  const { exec } = require('child_process');
  const scriptPath = path.join(__dirname, '../scripts/sync-caddy.js');
  
  exec(`node "${scriptPath}"`, (err, stdout, stderr) => {
    if (err) {
      console.error('[Caddy Sync API] Manual sync failed:', stderr || err.message);
      res.status(500).json({ success: false, error: stderr || err.message });
    } else {
      res.json({ success: true, message: 'Sinkronisasi konfigurasi Caddy berhasil dan Caddy telah dimuat ulang.' });
    }
  });
});

// POST /api/license/tunnel/custom-domain
// Called by tenant app (Project-Yatim) when admin saves a custom domain.
// Updates licenses.db and triggers Caddy sync so SSL is issued automatically.
router.post('/api/license/tunnel/custom-domain', async (req, res) => {
  try {
    const { license_key, custom_domain } = req.body;

    if (!license_key) {
      return res.status(400).json({ success: false, message: 'license_key wajib diisi.' });
    }

    const licenseKeyClean = license_key.trim();
    const targetDomain = custom_domain ? custom_domain.trim().toLowerCase() : null;

    // Validate domain format if provided
    if (targetDomain) {
      const domainRegex = /^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/;
      if (!domainRegex.test(targetDomain)) {
        return res.status(400).json({ success: false, message: 'Format domain kustom tidak valid.' });
      }
    }

    // Open SQLite database
    const { open } = require('sqlite');
    const sqlite3 = require('sqlite3');
    const dbPath = path.join(__dirname, '../licenses.db');
    const db = await open({ filename: dbPath, driver: sqlite3.Database });

    try {
      // Check license exists and is active
      const license = await db.get(
        `SELECT id, requested_slug, wireguard_ip FROM licenses WHERE license_key = ? AND is_active = 1`,
        [licenseKeyClean]
      );

      if (!license) {
        return res.status(404).json({ success: false, message: 'Kunci lisensi tidak ditemukan atau tidak aktif.' });
      }

      // If setting a custom domain, ensure it's not already used by another license
      if (targetDomain) {
        const existing = await db.get(
          `SELECT id FROM licenses WHERE custom_domain = ? AND license_key != ?`,
          [targetDomain, licenseKeyClean]
        );
        if (existing) {
          return res.status(409).json({ success: false, message: 'Domain kustom sudah digunakan oleh lisensi lain.' });
        }
      }

      // Update custom_domain in licenses.db
      await db.run(
        `UPDATE licenses SET custom_domain = ? WHERE license_key = ?`,
        [targetDomain, licenseKeyClean]
      );

      console.log(`[Custom Domain] Updated custom_domain for license ${licenseKeyClean} (slug: ${license.requested_slug}) => ${targetDomain || 'NULL'}`);

      // Trigger Caddy sync in background
      const { exec } = require('child_process');
      const scriptPath = path.join(__dirname, '../scripts/sync-caddy.js');
      exec(`node "${scriptPath}"`, (syncErr, syncOut, syncStderr) => {
        if (syncErr) {
          console.warn('[Custom Domain] Caddy sync warning:', syncStderr || syncErr.message);
        } else {
          console.log('[Custom Domain] Caddy synced successfully after custom domain update.');
        }
      });

      res.json({
        success: true,
        message: targetDomain
          ? `Domain kustom '${targetDomain}' berhasil dihubungkan. SSL akan diterbitkan otomatis oleh Caddy.`
          : 'Domain kustom berhasil dilepas dari lisensi.',
        data: {
          license_key: licenseKeyClean,
          slug: license.requested_slug,
          custom_domain: targetDomain
        }
      });

    } finally {
      await db.close().catch(() => {});
    }

  } catch (err) {
    console.error('[Custom Domain Route Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
module.exports.adminAuth = adminAuth;


 // Export for potential server.js usage
