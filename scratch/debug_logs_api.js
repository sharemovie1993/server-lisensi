const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.activityLog.findMany({
    where: { licenseKey: 'ABS-H2OT-VYNZ-NV0G' },
    take: 3,
    include: {
      license: {
        select: {
          schoolName: true,
          requestedSlug: true,
          activeOs: true,
          activeHostname: true
        }
      }
    }
  });
  console.log('LOGS:', JSON.stringify(logs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
