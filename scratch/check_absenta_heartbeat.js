const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const license = await prisma.license.findUnique({
    where: { licenseKey: 'ABS-E35D-84F7-38C0' }
  });
  console.log('ABSENTA HEARTBEAT STATUS:', {
    licenseKey: license.licenseKey,
    schoolName: license.schoolName,
    lastHeartbeatAt: license.lastHeartbeatAt,
    activeOs: license.activeOs,
    activeHostname: license.activeHostname,
    status: license.status,
    isActive: license.isActive
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
