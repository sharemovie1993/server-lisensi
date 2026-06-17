const sqlite3 = require('sqlite3');

const dbPath = '/var/www/licensing-server/licenses.db';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
});

db.serialize(() => {
  db.all("SELECT * FROM products", [], (err, rows) => {
    console.log('=== PRODUCTS ===');
    console.log(rows);
  });

  db.all("SELECT * FROM pricing_plans", [], (err, rows) => {
    console.log('=== PRICING PLANS ===');
    console.log(rows);
    process.exit(0);
  });
});
