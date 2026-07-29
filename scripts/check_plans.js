const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Cek berapa banyak plan per productId
  const stats = await prisma.plan.groupBy({
    by: ['productId', 'moduleId'],
    _count: { id: true },
    orderBy: { productId: 'asc' }
  });
  console.log('=== Plans per productId & moduleId ===');
  console.log(JSON.stringify(stats, null, 2));

  // Cek hardware plans khusus
  const hw = await prisma.plan.findMany({
    where: {
      OR: [
        { moduleId: 'SERVER_HARDWARE' },
        { moduleId: 'NETWORK_HARDWARE' },
        { moduleId: 'ABSENSI_HARDWARE' },
        { moduleId: 'PHYSICAL_SERVICE' },
      ]
    },
    select: { id: true, productId: true, moduleId: true, name: true }
  });
  console.log('\n=== Hardware Plans ===');
  console.log(JSON.stringify(hw, null, 2));
}

main().finally(() => prisma.$disconnect());
