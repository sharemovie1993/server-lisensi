/**
 * TRIPAY TRANSACTION CREATION TESTER
 * 
 * Script ini mengirimkan POST request ke server lokal untuk membuat
 * transaksi baru dengan metode pembayaran tertentu (misal: BNI Virtual Account)
 * untuk memverifikasi integrasi Tripay API.
 */

const PORT = 5001;

async function test() {
  console.log('[TEST] Mengirim permintaan lisensi pending ke server lisensi...');
  
  const payload = {
    school_name: 'SMKN 1 Cikalong Uji Coba',
    device_limit: 150,
    is_unlimited: 0,
    product_id: 'gform-orkestrator',
    plan_id: 'monthly',
    payment_method: 'BNIVA' // BNI Virtual Account
  };

  try {
    const res = await fetch(`http://localhost:${PORT}/api/license/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('\n====== RESPONS SERVER ======');
    console.log(JSON.stringify(data, null, 2));
    console.log('============================\n');

    if (data.success && data.data) {
      console.log('[TEST SUCCESS] Transaksi berhasil dibuat di Sandbox Tripay!');
      console.log(`- Kunci Lisensi: ${data.data.license_key}`);
      console.log(`- Invoice Number: ${data.data.invoice_number}`);
      console.log(`- Metode Pembayaran: ${data.data.payment_method}`);
      console.log(`- Nomor Virtual Account: ${data.data.pay_code}`);
      console.log(`- Nominal: Rp ${data.data.amount.toLocaleString('id-ID')}`);
      console.log(`- Jumlah Instruksi Bayar: ${data.data.instructions ? data.data.instructions.length : 0}`);
      console.log('\n[TEST SUCCESS] Sekarang jalankan simulator callback untuk menyelesaikan pembayaran!');
      console.log('Jalankan: node simulate_tripay_callback.js');
    } else {
      console.error('[TEST FAILED] Gagal membuat transaksi:', data.message);
    }
  } catch (err) {
    console.error('[TEST ERROR] Gagal menghubungi server lisensi:', err.message);
  }
}

test();
