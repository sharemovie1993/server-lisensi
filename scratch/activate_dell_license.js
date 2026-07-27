const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.license.update({
    where: { licenseKey: 'ET-EFDF-FB92-0798' },
    data: {
      status: 'active',
      isActive: 1
    }
  });
  console.log('ACTIVATED LICENSE:', JSON.stringify(result, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
