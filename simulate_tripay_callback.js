/**
 * TRIPAY CALLBACK WEBHOOK SIMULATOR
 * 
 * Script ini digunakan untuk menguji integrasi otomatisasi aktivasi lisensi 
 * G-Form Orkestrator melalui Webhook Callback Tripay secara lokal.
 * 
 * Alur Kerja:
 * 1. Membaca file konfigurasi .env untuk mendapatkan PORT server dan PORT_PRIVATE_KEY.
 * 2. Menghubungi database SQLite lokal untuk mengambil Invoice berstatus 'unpaid' terbaru.
 * 3. Menyusun JSON payload callback Tripay dengan status "PAID".
 * 4. Menghitung HMAC-SHA256 signature yang sah menggunakan Private Key Sandbox.
 * 5. Mengirimkan HTTP POST request ke server lokal (http://localhost:5001/api/license/tripay-callback).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

// Load .env
const envPath = path.join(__dirname, '.env');
const dotenv = require('dotenv');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('[SIMULATOR] Berhasil memuat .env lokal.');
} else {
  console.error('[SIMULATOR] File .env tidak ditemukan di: ' + envPath);
  process.exit(1);
}

const PORT = process.env.PORT || 5001;
const TRIPAY_PRIVATE_KEY = process.env.TRIPAY_PRIVATE_KEY;
const DB_PATH = path.join(__dirname, 'licenses.db');

if (!TRIPAY_PRIVATE_KEY) {
  console.error('[SIMULATOR] TRIPAY_PRIVATE_KEY tidak dikonfigurasi di .env!');
  process.exit(1);
}

async function run() {
  console.log('[SIMULATOR] Menghubungkan ke Database SQLite local...');
  
  if (!fs.existsSync(DB_PATH)) {
    console.error('[SIMULATOR] Database licenses.db tidak ditemukan di: ' + DB_PATH);
    process.exit(1);
  }

  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  // 1. Ambil invoice unpaid terbaru
  const latestUnpaidInvoice = await db.get("SELECT * FROM invoices WHERE status = 'unpaid' ORDER BY id DESC LIMIT 1");

  if (!latestUnpaidInvoice) {
    console.log('[SIMULATOR] Tidak ditemukan invoice berstatus UNPAID di database untuk disimulasikan.');
    console.log('[SIMULATOR] Lakukan request perpanjangan/aktivasi lisensi terlebih dahulu dari aplikasi!');
    await db.close();
    process.exit(0);
  }

  console.log(`[SIMULATOR] Menemukan Invoice pending: ${latestUnpaidInvoice.invoice_number}`);
  console.log(`- Sekolah: ${latestUnpaidInvoice.school_name}`);
  console.log(`- Nominal: Rp ${latestUnpaidInvoice.amount.toLocaleString('id-ID')}`);
  console.log(`- Channel: ${latestUnpaidInvoice.payment_method}`);

  // 2. Susun payload callback Tripay
  const payload = {
    reference: 'T' + Math.floor(10000000 + Math.random() * 90000000) + 'ORKMOCK',
    merchant_ref: latestUnpaidInvoice.invoice_number,
    payment_method: latestUnpaidInvoice.payment_method.replace(' ', ''),
    payment_method_code: latestUnpaidInvoice.payment_method.replace(' ', ''),
    total_amount: latestUnpaidInvoice.amount,
    status: 'PAID',
    paid_at: Math.floor(Date.now() / 1000),
    customer_name: latestUnpaidInvoice.school_name,
    customer_email: 'billing@gform-orkestrator.test',
    customer_phone: '081234567890'
  };

  const rawPayload = JSON.stringify(payload);

  // 3. Hitung Signature HMAC-SHA256
  const signature = crypto
    .createHmac('sha256', TRIPAY_PRIVATE_KEY)
    .update(rawPayload)
    .digest('hex');

  console.log(`[SIMULATOR] Mengirim Webhook Callback...`);
  console.log(`- URL: http://localhost:${PORT}/api/license/tripay-callback`);
  console.log(`- Signature: ${signature}`);

  try {
    const res = await fetch(`http://localhost:${PORT}/api/license/tripay-callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Callback-Signature': signature
      },
      body: rawPayload
    });

    const textResult = await res.text();
    console.log(`\n[SIMULATOR RESPONSE] Status HTTP: ${res.status}`);
    console.log(`[SIMULATOR RESPONSE] Body: ${textResult}`);

    if (res.status === 200) {
      console.log('\n[SIMULATOR SUCCESS] Pembayaran berhasil disimulasikan!');
      console.log('[SIMULATOR SUCCESS] Memeriksa status lisensi di database...');
      
      const updatedLicense = await db.get("SELECT * FROM licenses WHERE id = ?", [latestUnpaidInvoice.license_id]);
      const updatedInvoice = await db.get("SELECT * FROM invoices WHERE id = ?", [latestUnpaidInvoice.id]);
      const updatedSub = await db.get("SELECT * FROM subscriptions WHERE license_id = ?", [latestUnpaidInvoice.license_id]);

      console.log('\n====== HASIL DB ======');
      console.log(`- Invoice Status: ${updatedInvoice.status} (Paid At: ${updatedInvoice.paid_at})`);
      console.log(`- License Status: ${updatedLicense.status} (Is Active: ${updatedLicense.is_active})`);
      console.log(`- License Expiry: ${updatedLicense.expires_at}`);
      console.log(`- Subscription Status: ${updatedSub.status} (End Date: ${updatedSub.end_date})`);
      console.log('======================\n');
      console.log('[SIMULATOR INFO] Aplikasi mobile proktor akan terbuka dalam hitungan 5 detik (karena polling otomatis).');
    } else {
      console.error('\n[SIMULATOR FAILED] Gagal memverifikasi callback. Periksa error server.');
    }
  } catch (err) {
    console.error('\n[SIMULATOR ERROR] Gagal menghubungi server lisensi:', err.message);
  }

  await db.close();
}

run().catch(console.error);
