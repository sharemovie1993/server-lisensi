const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function main() {
  try {
    const dbPath = path.join(__dirname, 'licenses.db');
    console.log('Database Path:', dbPath);
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    const rows = await db.all('SELECT * FROM licenses');
    console.log('Rows in Database:', rows);
  } catch (err) {
    console.error('Error reading database:', err);
  }
}
main();
