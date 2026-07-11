const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Querying BPBK plans from database...');
  const bpbkPlans = await prisma.plan.findMany({
    where: {
      moduleId: 'BPBK'
    },
    orderBy: {
      priceMonthly: 'asc'
    }
  });

  console.log(`Found ${bpbkPlans.length} BPBK plans:`);
  bpbkPlans.forEach(plan => {
    console.log(`- [${plan.id}] ${plan.name}: Rp ${plan.priceMonthly}/bln, limit ${plan.deviceLimit} students`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
