const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const license = await prisma.license.findUnique({
    where: { licenseKey: 'ET-A0F0-CBE7-C16E' }
  });
  console.log('LICENSE HEARTBEAT STATUS:', {
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
