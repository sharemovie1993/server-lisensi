const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function main() {
  const dbPath = path.join(__dirname, 'licenses.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  
  console.log('\n=== PRODUCTS ===');
  const products = await db.all('SELECT * FROM products');
  products.forEach(p => console.log(`  [${p.id}] ${p.name}`));
  
  console.log('\n=== MUSTAHIQ CARE PRICING PLANS ===');
  const plans = await db.all("SELECT id, title, price, duration, device_limit, is_unlimited FROM pricing_plans WHERE product_id = 'project-yatim'");
  plans.forEach(p => console.log(`  [${p.id}] ${p.title} | ${p.price} | ${p.duration} | device_limit=${p.device_limit} | unlimited=${p.is_unlimited}`));
  
  console.log('\n=== MUSTAHIQ CARE LICENSES ===');
  const lics = await db.all("SELECT license_key, school_name, status, expires_at FROM licenses WHERE product_id = 'project-yatim'");
  lics.forEach(l => console.log(`  [${l.license_key}] ${l.school_name} | ${l.status} | expires: ${l.expires_at}`));
  
  await db.close();
}
main().catch(console.error);
