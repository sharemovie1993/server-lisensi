const { initDatabase, db } = require('./config/db');

initDatabase().then(async () => {
  console.log('Database initialized. Modifying license 39 to expired...');
  await db.run("UPDATE licenses SET status = 'expired', is_active = 0 WHERE id = 39");
  console.log('Successfully set license 39 to expired.');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
