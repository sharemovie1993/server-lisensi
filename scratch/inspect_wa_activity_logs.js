const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const logs = await prisma.activityLog.findMany({
      where: {
        action: {
          contains: 'WA'
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    console.log('--- WA ACTIVITY LOGS ---');
    console.log(JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
