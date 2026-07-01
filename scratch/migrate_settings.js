const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Migrating system settings from SQLite to PostgreSQL...');
  let sqliteDb;
  try {
    sqliteDb = await open({
      filename: 'licenses.db',
      driver: sqlite3.Database
    });
    
    const settings = await sqliteDb.all('SELECT * FROM system_settings');
    console.log(`Found ${settings.length} settings in SQLite.`);
    
    for (const setting of settings) {
      await prisma.systemSetting.upsert({
        where: { key: setting.key },
        update: { value: String(setting.value) },
        create: { key: setting.key, value: String(setting.value) }
      });
      console.log(`Migrated setting: ${setting.key} = ${setting.value}`);
    }
    
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Error during settings migration:', err.message);
  } finally {
    if (sqliteDb) await sqliteDb.close();
    await prisma.$disconnect();
  }
}

run();
