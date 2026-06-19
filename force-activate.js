const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function forceActivate(licenseKey) {
  const db = new sqlite3.Database('/var/www/licensing-server/licenses.db');

  console.log(`[ForceActivate] Mencari lisensi: ${licenseKey}...`);
  
  db.get("SELECT id, school_name FROM licenses WHERE license_key = ?", [licenseKey], (err, row) => {
    if (err) {
      console.error("❌ Error DB:", err.message);
      return;
    }
    if (!row) {
      console.error("❌ Lisensi tidak ditemukan!");
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const expireDate = new Date();
    expireDate.setFullYear(expireDate.getFullYear() + 1);
    const expiresStr = expireDate.toISOString().slice(0, 10);

    db.serialize(() => {
      db.run("UPDATE licenses SET status = 'active', is_active = 1, expires_at = ? WHERE id = ?", [expiresStr, row.id]);
      db.run("UPDATE subscriptions SET status = 'active', start_date = ?, end_date = ? WHERE license_id = ?", [todayStr, expiresStr, row.id]);
      db.run("UPDATE invoices SET status = 'paid', paid_at = (datetime('now', 'localtime')), payment_method = 'Gateway' WHERE license_id = ?", [row.id], (err2) => {
        if (err2) console.error("❌ Gagal update invoice:", err2.message);
        else console.log(`✅ BERHASIL! Lisensi ${licenseKey} untuk ${row.school_name} sekarang AKTIF.`);
        db.close();
      });
    });
  });
}

const key = process.argv[2];
if (!key) {
  console.log("Gunakan: node force-activate.js <LICENSE_KEY>");
} else {
  forceActivate(key);
}
