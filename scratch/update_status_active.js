const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function main() {
  const dbPath = 'C:\\Users\\SERVER-DELL\\AppData\\Roaming\\project-easy-tunnel\\local.db';
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  
  const result = await db.run("UPDATE tunnels SET status = 'active' WHERE license_key = 'ET-A0F0-CBE7-C16E'");
  console.log('UPDATED LOCAL DB STATUS RESULT:', result);
}

main().catch(console.error);
