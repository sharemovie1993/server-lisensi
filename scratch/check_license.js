const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const l = await prisma.license.findUnique({ where: { licenseKey: 'ABS-H2OT-VYNZ-NV0G' } });
  console.log('LICENSE:', JSON.stringify(l, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
