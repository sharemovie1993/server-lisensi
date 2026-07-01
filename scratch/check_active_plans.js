const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:123123123@10.10.10.250:5432/orkestrator_licensing' });
client.connect().then(async () => {
  const res = await client.query("SELECT id, name, is_active FROM plans WHERE id LIKE 'ACADEMIC_%'");
  console.log(res.rows);
  client.end();
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
