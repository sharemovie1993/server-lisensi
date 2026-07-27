const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const licenses = await prisma.license.findMany({
    select: {
      licenseKey: true,
      schoolName: true,
      activeOs: true,
      activeHostname: true
    }
  });
  console.log('ALL LICENSES:', JSON.stringify(licenses, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
