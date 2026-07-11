const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const licenses = await prisma.license.findMany({
    where: {
      requestedSlug: 'smk6jkt'
    }
  });
  console.log(JSON.stringify(licenses, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
