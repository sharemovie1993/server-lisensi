const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function main() {
  const dbPath = 'C:\\Users\\SERVER-DELL\\AppData\\Roaming\\project-easy-tunnel\\local.db';
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  const tunnels = await db.all("SELECT * FROM tunnels");
  console.log('LOCAL TUNNELS:', JSON.stringify(tunnels, null, 2));
}

main().catch(console.error);
