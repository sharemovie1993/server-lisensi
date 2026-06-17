const { db } = require('../config/db');

async function logLicenseActivity(licenseKey, productId, deviceId, ipAddress, status) {
  try {
    await db.run(
      "INSERT INTO license_logs (license_key, product_id, device_id, ip_address, status) VALUES (?, ?, ?, ?, ?)",
      [licenseKey || null, productId || null, deviceId || null, ipAddress || null, status]
    );
  } catch (err) {
    console.error('[AUDIT LOG ERROR]', err);
  }
}

module.exports = {
  logLicenseActivity
};
