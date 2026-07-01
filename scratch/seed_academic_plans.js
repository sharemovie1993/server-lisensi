const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const academicPlans = [
  {
    id: 'ACADEMIC_MICRO_TAHUNAN',
    productId: 'absenta',
    name: 'Academic Core (Micro) - Tahunan',
    priceMonthly: 0,
    priceYearly: 0,
    deviceLimit: 100,
    featuresJson: [],
    billingPeriod: 'YEAR',
    isActive: true,
    moduleId: 'CORE',
    serviceCode: 'CORE',
  },
  {
    id: 'ACADEMIC_SMALL_TAHUNAN',
    productId: 'absenta',
    name: 'Academic Core (Small) - Tahunan',
    priceMonthly: 0,
    priceYearly: 0,
    deviceLimit: 300,
    featuresJson: [],
    billingPeriod: 'YEAR',
    isActive: true,
    moduleId: 'CORE',
    serviceCode: 'CORE',
  },
  {
    id: 'ACADEMIC_MEDIUM_TAHUNAN',
    productId: 'absenta',
    name: 'Academic Core (Medium) - Tahunan',
    priceMonthly: 0,
    priceYearly: 0,
    deviceLimit: 600,
    featuresJson: [],
    billingPeriod: 'YEAR',
    isActive: true,
    moduleId: 'CORE',
    serviceCode: 'CORE',
  },
  {
    id: 'ACADEMIC_LARGE_TAHUNAN',
    productId: 'absenta',
    name: 'Academic Core (Large) - Tahunan',
    priceMonthly: 0,
    priceYearly: 0,
    deviceLimit: 1200,
    featuresJson: [],
    billingPeriod: 'YEAR',
    isActive: true,
    moduleId: 'CORE',
    serviceCode: 'CORE',
  },
  {
    id: 'ACADEMIC_ENTERPRISE_TAHUNAN',
    productId: 'absenta',
    name: 'Academic Core (Enterprise) - Tahunan',
    priceMonthly: 0,
    priceYearly: 0,
    deviceLimit: 0,
    featuresJson: [],
    billingPeriod: 'YEAR',
    isActive: true,
    moduleId: 'CORE',
    serviceCode: 'CORE',
  }
];

async function main() {
  console.log('Starting seed of Academic Plans on Licensing Server...');
  for (const plan of academicPlans) {
    const existing = await prisma.plan.findUnique({
      where: { id: plan.id }
    });
    if (!existing) {
      await prisma.plan.create({
        data: plan
      });
      console.log(`Created plan: ${plan.id}`);
    } else {
      await prisma.plan.update({
        where: { id: plan.id },
        data: plan
      });
      console.log(`Updated plan: ${plan.id}`);
    }
  }
  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
