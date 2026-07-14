const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const products = await prisma.product.findMany();
    console.log('--- PRODUCTS ---');
    console.log(JSON.stringify(products, null, 2));

    const latestLicenses = await prisma.license.findMany({
      orderBy: { id: 'desc' },
      take: 5
    });
    console.log('--- LATEST LICENSES ---');
    console.log(JSON.stringify(latestLicenses, null, 2));
  } catch (err) {
    console.error('Error running inspection:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
