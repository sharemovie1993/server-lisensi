const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const licenseKeys = ['ABS-H2OT-VYNZ-NV0G', 'ABS-E35D-84F7-38C0', 'ABS-1E01-674C-F4A6'];
  const logs = await prisma.activityLog.findMany({
    where: {
      licenseKey: { in: licenseKeys }
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      license: {
        select: {
          licenseKey: true,
          schoolName: true,
          requestedSlug: true,
          activeOs: true,
          activeHostname: true
        }
      }
    }
  });

  console.log('SPECIFIC LOGS DATA:');
  logs.forEach(log => {
    console.log(`Time: ${log.createdAt.toISOString()} | Key: ${log.licenseKey}`);
    console.log('License Relation:', JSON.stringify(log.license, null, 2));
    console.log('--------------------------------------------------');
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
