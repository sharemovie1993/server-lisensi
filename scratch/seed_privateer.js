const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const product = {
  id: 'privateer',
  name: 'Privateer Computer Course',
  prefix: 'PVT'
};

const plans = [
  {
    id: 'PVT_SESSION_1',
    productId: 'privateer',
    name: '1 Sesi Praktik',
    priceMonthly: 10000,
    priceYearly: 10000,
    deviceLimit: 1,
    featuresJson: [
      '1 Sesi Pertemuan Langsung',
      'Akses Materi Praktik Terstruktur',
      'Berlaku Selamanya'
    ],
    billingPeriod: 'MONTH',
    isActive: true,
    moduleId: 'SESSIONS',
    serviceCode: 'SESSIONS'
  },
  {
    id: 'PVT_SESSION_10',
    productId: 'privateer',
    name: 'Paket 10 Sesi Belajar',
    priceMonthly: 100000,
    priceYearly: 100000,
    deviceLimit: 1,
    featuresJson: [
      '10 Sesi Pertemuan Langsung',
      'Akses Materi Praktik Terstruktur',
      'Log Evaluasi dari Master Coach',
      'Berlaku Selamanya'
    ],
    billingPeriod: 'MONTH',
    isActive: true,
    moduleId: 'SESSIONS',
    serviceCode: 'SESSIONS'
  },
  {
    id: 'PVT_SESSION_25',
    productId: 'privateer',
    name: 'Paket 25 Sesi Belajar',
    priceMonthly: 250000,
    priceYearly: 250000,
    deviceLimit: 1,
    featuresJson: [
      '25 Sesi Pertemuan Langsung',
      'Akses Materi Praktik Terstruktur',
      'Log Evaluasi dari Master Coach',
      'Prioritas Penjadwalan Sesi',
      'Berlaku Selamanya'
    ],
    billingPeriod: 'MONTH',
    isActive: true,
    moduleId: 'SESSIONS',
    serviceCode: 'SESSIONS'
  },
  {
    id: 'PVT_SESSION_50',
    productId: 'privateer',
    name: 'Paket 50 Sesi Belajar (Pro)',
    priceMonthly: 500000,
    priceYearly: 500000,
    deviceLimit: 1,
    featuresJson: [
      '50 Sesi Pertemuan Langsung',
      'Akses Materi Praktik Terstruktur',
      'Log Evaluasi dari Master Coach',
      'Konsultasi Karir & Portofolio',
      'Berlaku Selamanya'
    ],
    billingPeriod: 'MONTH',
    isActive: true,
    moduleId: 'SESSIONS',
    serviceCode: 'SESSIONS'
  }
];

async function main() {
  console.log('🌱 Seeding Privateer Product and Plans...');

  // 1. Upsert Product
  await prisma.product.upsert({
    where: { id: product.id },
    update: {
      name: product.name,
      prefix: product.prefix
    },
    create: product
  });
  console.log(`✅ Product upserted: ${product.name}`);

  // 2. Upsert Plans
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: {
        productId: plan.productId,
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        deviceLimit: plan.deviceLimit,
        featuresJson: plan.featuresJson,
        billingPeriod: plan.billingPeriod,
        isActive: plan.isActive,
        moduleId: plan.moduleId,
        serviceCode: plan.serviceCode
      },
      create: plan
    });
    console.log(`✅ Plan upserted: ${plan.name}`);
  }

  console.log('✨ Seeding finished.');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
