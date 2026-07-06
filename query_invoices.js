const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log('--- SUBSCRIPTIONS FOR LICENSE 119 ---');
    const subs = await prisma.subscription.findMany({
      where: { licenseId: '119' },
      include: { license: true }
    });
    console.log(subs);
  } catch (e) {
    console.error('Error fetching subscriptions:', e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
