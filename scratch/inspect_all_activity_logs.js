const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const actions = await prisma.$queryRaw`
      SELECT action, count(*)::int as count 
      FROM activity_logs 
      GROUP BY action 
      ORDER BY count DESC
    `;
    console.log('--- UNIQUE ACTIONS IN ACTIVITY LOGS ---');
    console.log(JSON.stringify(actions, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
