const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const initialSettings = [
    { key: 'contact_phone', value: '087779937341' },
    { key: 'billing_email', value: 'billing@absenta.id' },
    { key: 'bank_account_info', value: 'BNI: 1234567890 a/n Baraya Teknologi' },
    { key: 'main_domain', value: 'absenta.id' },
    { key: 'pm2_app_name', value: 'licensing-server' },
    { key: 'caddy_config_path', value: '/etc/caddy/Caddyfile' }
  ];

  console.log('Seeding initial system settings...');
  for (const setting of initialSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting
    });
    console.log(`- Upserted: ${setting.key} = "${setting.value}"`);
  }
  console.log('Done!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
