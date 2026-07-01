const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function run() {
  const db = await open({
    filename: path.join(__dirname, '../licenses.db'),
    driver: sqlite3.Database
  });

  try {
    const licenses = await db.all("SELECT id, product_id, license_key, school_name, requested_slug, status, is_active FROM licenses");
    console.log('All licenses in DB:');
    console.log(licenses);

    const invoices = await db.all("SELECT id, invoice_number, license_id, amount, status, payment_method, pay_code FROM invoices");
    console.log('All invoices in DB:');
    console.log(invoices);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await db.close();
  }
}

run();
