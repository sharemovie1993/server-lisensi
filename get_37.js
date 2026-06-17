const { initDatabase, db } = require('./config/db');

initDatabase().then(async () => {
  const row = await db.get("SELECT * FROM licenses WHERE id = 37");
  console.log('LICENSE 37:', row);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
