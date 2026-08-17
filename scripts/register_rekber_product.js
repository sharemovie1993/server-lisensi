const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createRekberProduct() {
  console.log('Registering product REKBER in Server Lisensi database...');

  const product = await prisma.product.upsert({
    where: { id: 'rekber' },
    update: {
      name: 'Rekening Bersama & Multi-Tenant Payment Gateway',
      prefix: 'RKB',
      paymentMode: 'SANDBOX' // Bisa diubah ke PRODUCTION kapan saja
    },
    create: {
      id: 'rekber',
      name: 'Rekening Bersama & Multi-Tenant Payment Gateway',
      prefix: 'RKB',
      paymentMode: 'SANDBOX'
    }
  });

  const plan = await prisma.plan.upsert({
    where: { id: 'rekber-custom-billing' },
    update: {
      name: 'Custom Dynamic Invoicing & Payment Gateway',
      type: 'PHYSICAL_SERVICE',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 0,
      deviceLimit: 99999,
      featuresJson: ['DYNAMIC_AMOUNT', 'VIRTUAL_ACCOUNT', 'QRIS', 'MULTI_TENANT_API', 'WEBHOOK_FORWARDER'],
      billingPeriod: 'ONETIME',
      isActive: true
    },
    create: {
      id: 'rekber-custom-billing',
      productId: product.id,
      name: 'Custom Dynamic Invoicing & Payment Gateway',
      type: 'PHYSICAL_SERVICE',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 0,
      deviceLimit: 99999,
      featuresJson: ['DYNAMIC_AMOUNT', 'VIRTUAL_ACCOUNT', 'QRIS', 'MULTI_TENANT_API', 'WEBHOOK_FORWARDER'],
      billingPeriod: 'ONETIME',
      isActive: true
    }
  });

  console.log('✅ Berhasil mendaftarkan produk di Server Lisensi:');
  console.log(`- Product ID: ${product.id}`);
  console.log(`- Prefix: ${product.prefix}`);
  console.log(`- Payment Mode: ${product.paymentMode}`);
  console.log(`- Plan ID: ${plan.id}`);
}

createRekberProduct()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
