const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDatabase, db } = require('./config/db');
const { PORT, TOTP_SECRET } = require('./config/keys');
const { logLicenseActivity } = require('./utils/logger');
const { triggerCaddySync } = require('./utils/caddy');
const waGateway = require('./services/waGateway');

const app = express();
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static admin dashboard UI
app.use(express.static(path.join(__dirname, 'public')));

// ── REDIRECT ROOT FOR CONVENIENCE ──
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin/tenant-detail', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tenant_detail.html'));
});


// ── MOUNT MODULAR ROUTERS ──
app.use('/', require('./routes/admin'));
app.use('/', require('./routes/license'));

// ── AUTOMATED EXPIRATION SCHEDULER (CRON JOB) ──
async function checkExpirations() {
  console.log('[CRON] Running automatic license & subscription expiration check...');
  const currentDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  
  try {
    // 1. Find newly expired active licenses
    const expiredLicenses = await db.all(
      "SELECT * FROM licenses WHERE expires_at < ? AND (status = 'active' OR is_active = 1)",
      [currentDate]
    );
    
    for (const lic of expiredLicenses) {
      console.log(`[CRON] License ${lic.license_key} for ${lic.school_name} has expired on ${lic.expires_at}. Revoking...`);
      
      // Update license status
      await db.run(
        "UPDATE licenses SET is_active = 0, status = 'expired' WHERE id = ?",
        [lic.id]
      );
      
      // Update subscription status
      await db.run(
        "UPDATE subscriptions SET status = 'expired', updated_at = (datetime('now', 'localtime')) WHERE license_id = ?",
        [lic.id]
      );
      
      // Audit Log
      await logLicenseActivity(lic.license_key, lic.product_id, null, 'system', 'CRON_EXPIRED');
    }

    // Trigger Caddy sync if there were expired licenses to clean up routing
    if (expiredLicenses.length > 0) {
      console.log(`[CRON] Triggering Caddy sync to remove routing for ${expiredLicenses.length} expired licenses...`);
      triggerCaddySync();
    }
    
    // 2. Find licenses expiring soon (within 7 days) and log warning
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 7);
    const targetDateStr = targetDate.toISOString().slice(0, 10);
    
    const warningLicenses = await db.all(
      "SELECT * FROM licenses WHERE expires_at >= ? AND expires_at <= ? AND (status = 'active' OR is_active = 1)",
      [currentDate, targetDateStr]
    );
    
    for (const lic of warningLicenses) {
      console.log(`[CRON] WARNING: License ${lic.license_key} for ${lic.school_name} expires soon on ${lic.expires_at}.`);
      await logLicenseActivity(lic.license_key, lic.product_id, null, 'system', 'CRON_WARN_EXPIRING_SOON');
    }
    
    console.log(`[CRON] Expiration check complete. Expired: ${expiredLicenses.length}, Expiring Soon (7d): ${warningLicenses.length}`);
  } catch (err) {
    console.error('[CRON ERROR]', err);
  }
}

// ── AUTOMATED VPN FIREWALL SETUP (ISOLATION) ──
function initVpnFirewall() {
  const { exec } = require('child_process');
  
  // Periksa apakah aturan isolasi sudah ada di iptables
  const checkCmd = 'sudo iptables -C FORWARD -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable';
  
  exec(checkCmd, (err) => {
    if (err) {
      console.log('[FIREWALL] Menerapkan aturan isolasi Client-to-Client pada interface wg0...');
      const applyCmd = 
        'sudo iptables -A FORWARD -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable && ' +
        'sudo iptables -A FORWARD -i wg0 -o wg0 -m iprange --dst-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable';
      
      exec(applyCmd, (applyErr) => {
        if (applyErr) {
          console.warn('[FIREWALL WARNING] Gagal menerapkan aturan iptables secara otomatis:', applyErr.message);
        } else {
          console.log('[FIREWALL] Aturan isolasi VPN berhasil diterapkan secara otomatis!');
          // Coba simpan agar permanen
          exec('if [ -d /etc/iptables ]; then sudo sh -c "iptables-save > /etc/iptables/rules.v4"; fi');
        }
      });
    } else {
      console.log('[FIREWALL] Aturan isolasi Client-to-Client pada wg0 sudah terpasang.');
    }
  });
}

// Start Server after DB init
initDatabase().then(async () => {
  // Inisialisasi WhatsApp Gateway
  waGateway.init().catch(err => {
    console.error('[WA GATEWAY ERROR] Gagal inisialisasi WA Gateway saat startup:', err.message);
  });

  // Run checkExpirations immediately on startup
  await checkExpirations();
  
  // Inisialisasi otomatis firewall VPN
  initVpnFirewall();
  
  // Set interval to run checkExpirations every hour (3600000 ms)
  setInterval(checkExpirations, 3600 * 1000);

  // Jalankan sinkronisasi APK otomatis di latar belakang dari Expo ke SSD VPS
  try {
    const { syncApkFromExpoInBackground } = require('./routes/license');
    if (typeof syncApkFromExpoInBackground === 'function') {
      // Jalankan sync pertama kali di latar belakang
      syncApkFromExpoInBackground();
      // Jalankan sync secara rutin setiap 30 menit
      setInterval(syncApkFromExpoInBackground, 30 * 60 * 1000);
    }
  } catch (err) {
    console.error('[APK Sync Startup Error]', err.message);
  }

  app.listen(PORT, () => {
    console.log(`[LICENSE SERVER] SaaS Monolithic Engine running securely on port ${PORT}`);
    console.log(`[SECURITY] 2FA/2-Step Verification is active!`);
    console.log(`[SECURITY] 2FA Secret Key: ${TOTP_SECRET}`);
    console.log(`[SECURITY] Google Authenticator Setup URI: otpauth://totp/Absenta:Admin?secret=${TOTP_SECRET}&issuer=Absenta.id`);
  });
}).catch(err => {
  console.error('[DATABASE] Critical error initializing database:', err);
});
