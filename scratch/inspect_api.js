const { buildApp } = require('../dist/app');

async function main() {
  const app = buildApp();
  
  // Inject mock request to /api/admin/logs (bypassing authentication in mock or logging schema)
  // Wait, verifyAdmin might block it, so let's mock verifyAdmin or just query the database logic
  // Since we already proved the DB returns it, let's double check if there's any serializer schema
  // in fastify that strips out activeOs/activeHostname!
  
  console.log('Checking Fastify route serialization...');
}

main().catch(console.error);
