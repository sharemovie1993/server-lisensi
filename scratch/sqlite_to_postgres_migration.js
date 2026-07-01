const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runMigration() {
  console.log('--- STARTING SQLITE TO POSTGRESQL MIGRATION ---');

  let sqliteDb;
  try {
    sqliteDb = await open({
      filename: 'licenses.db',
      driver: sqlite3.Database
    });
    console.log('Connected to SQLite database: licenses.db');
  } catch (err) {
    console.error('Failed to open SQLite database:', err.message);
    process.exit(1);
  }

  try {
    // 0. Reset PostgreSQL database tables
    console.log('Resetting PostgreSQL database tables...');
    await prisma.systemSetting.deleteMany({});
    await prisma.activityLog.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.license.deleteMany({});
    await prisma.plan.deleteMany({});
    await prisma.product.deleteMany({});
    console.log('Database tables reset complete.');

    // 1. Migrate Products
    console.log('\nMigrating Products...');
    const productsToSeed = [
      { id: 'absenta', name: 'Absenta Attendance', prefix: 'ABS' },
      { id: 'gform-orkestrator', name: 'GForm Orkestrator', prefix: 'GF' },
      { id: 'project-yatim', name: 'Project Yatim', prefix: 'YT' },
      { id: 'easy-tunnel', name: 'Easy Tunnel', prefix: 'ET' },
      { id: 'vpn-tunnel', name: 'VPN Tunneling Addon', prefix: 'VPN' }
    ];

    for (const prod of productsToSeed) {
      await prisma.product.upsert({
        where: { id: prod.id },
        update: { name: prod.name, prefix: prod.prefix },
        create: prod
      });
    }
    console.log('Products migrated successfully.');

    // 2. Migrate Plans
    console.log('\nMigrating Plans...');
    const sqlPlans = await sqliteDb.all('SELECT * FROM pricing_plans');
    console.log(`Found ${sqlPlans.length} plans in SQLite.`);

    for (const plan of sqlPlans) {
      const prodId = plan.product_id || 'absenta';
      const prodExists = await prisma.product.findUnique({ where: { id: prodId } });
      if (!prodExists) {
        await prisma.product.create({
          data: { id: prodId, name: prodId, prefix: prodId.substring(0, 3).toUpperCase() }
        });
      }

      let features = [];
      try {
        features = typeof plan.features_json === 'string' 
          ? JSON.parse(plan.features_json) 
          : (plan.features_json || []);
      } catch (e) {
        features = [];
      }

      await prisma.plan.upsert({
        where: { id: plan.id },
        update: {
          productId: prodId,
          name: plan.title || plan.name || 'Plan',
          priceMonthly: plan.price_monthly || 0,
          priceYearly: plan.price_yearly || 0,
          deviceLimit: plan.device_limit || 0,
          featuresJson: features,
          billingPeriod: plan.billing_period || 'MONTH',
          isActive: true
        },
        create: {
          id: plan.id,
          productId: prodId,
          name: plan.title || plan.name || 'Plan',
          priceMonthly: plan.price_monthly || 0,
          priceYearly: plan.price_yearly || 0,
          deviceLimit: plan.device_limit || 0,
          featuresJson: features,
          billingPeriod: plan.billing_period || 'MONTH',
          isActive: true
        }
      });
    }
    console.log('Plans migrated successfully.');

    // 3. Migrate Licenses
    console.log('\nMigrating Licenses...');
    const sqlLicenses = await sqliteDb.all('SELECT * FROM licenses');
    console.log(`Found ${sqlLicenses.length} licenses in SQLite.`);

    for (const lic of sqlLicenses) {
      const prodId = lic.product_id || 'absenta';
      const licId = String(lic.id);

      const prodExists = await prisma.product.findUnique({ where: { id: prodId } });
      if (!prodExists) {
        await prisma.product.create({
          data: { id: prodId, name: prodId, prefix: prodId.substring(0, 3).toUpperCase() }
        });
      }
      let resolvedPlanId = lic.plan_id || null;
      if (resolvedPlanId) {
        const planExists = await prisma.plan.findUnique({ where: { id: resolvedPlanId } });
        if (!planExists) {
          resolvedPlanId = null;
        }
      }
      
      await prisma.license.upsert({
        where: { licenseKey: lic.license_key },
        update: {
          productId: prodId,
          schoolName: lic.school_name,
          deviceLimit: lic.device_limit || 0,
          isUnlimited: lic.is_unlimited || 0,
          expiresAt: lic.expires_at || '',
          status: lic.status || 'pending',
          isActive: lic.is_active || 0,
          planId: resolvedPlanId,
          requestedSlug: lic.requested_slug || null,
          requestedSupabaseUrl: lic.requested_supabase_url || null,
          requestedSupabaseAnonKey: lic.requested_supabase_anon_key || null,
          wireguardIp: lic.wireguard_ip || null,
          includeVpn: lic.include_vpn || 0,
          customDomain: lic.custom_domain || null,
          localPort: lic.local_port || null,
          appName: lic.app_name || null,
          operatorPhone: lic.operator_phone || null,
          activeHostname: lic.active_hostname || null
        },
        create: {
          id: licId,
          licenseKey: lic.license_key,
          productId: prodId,
          schoolName: lic.school_name,
          deviceLimit: lic.device_limit || 0,
          isUnlimited: lic.is_unlimited || 0,
          expiresAt: lic.expires_at || '',
          status: lic.status || 'pending',
          isActive: lic.is_active || 0,
          planId: resolvedPlanId,
          requestedSlug: lic.requested_slug || null,
          requestedSupabaseUrl: lic.requested_supabase_url || null,
          requestedSupabaseAnonKey: lic.requested_supabase_anon_key || null,
          wireguardIp: lic.wireguard_ip || null,
          includeVpn: lic.include_vpn || 0,
          customDomain: lic.custom_domain || null,
          localPort: lic.local_port || null,
          appName: lic.app_name || null,
          operatorPhone: lic.operator_phone || null,
          activeHostname: lic.active_hostname || null
        }
      });
    }
    console.log('Licenses migrated successfully.');

    // 4. Migrate Subscriptions
    console.log('\nMigrating Subscriptions...');
    const sqlSubs = await sqliteDb.all('SELECT * FROM subscriptions');
    console.log(`Found ${sqlSubs.length} subscriptions in SQLite.`);

    for (const sub of sqlSubs) {
      const licExists = await prisma.license.findFirst({ where: { id: String(sub.license_id) } });
      if (!licExists) {
        console.warn(`Skipping subscription ${sub.id} because license ${sub.license_id} does not exist.`);
        continue;
      }

      await prisma.subscription.upsert({
        where: { id: String(sub.id) },
        update: {
          licenseId: String(sub.license_id),
          schoolName: sub.school_name,
          productId: sub.product_id || 'absenta',
          planId: sub.plan_id || '',
          status: sub.status || 'pending',
          startDate: sub.start_date || '',
          endDate: sub.end_date || ''
        },
        create: {
          id: String(sub.id),
          licenseId: String(sub.license_id),
          schoolName: sub.school_name,
          productId: sub.product_id || 'absenta',
          planId: sub.plan_id || '',
          status: sub.status || 'pending',
          startDate: sub.start_date || '',
          endDate: sub.end_date || ''
        }
      });
    }
    console.log('Subscriptions migrated successfully.');

    // 5. Migrate Invoices
    console.log('\nMigrating Invoices...');
    const sqlInvs = await sqliteDb.all('SELECT * FROM invoices');
    console.log(`Found ${sqlInvs.length} invoices in SQLite.`);

    for (const inv of sqlInvs) {
      const licExists = await prisma.license.findFirst({ where: { id: String(inv.license_id) } });
      if (!licExists) {
        console.warn(`Skipping invoice ${inv.invoice_number} because license ${inv.license_id} does not exist.`);
        continue;
      }

      let instructions = [];
      try {
        instructions = typeof inv.payment_instructions === 'string'
          ? JSON.parse(inv.payment_instructions)
          : (inv.payment_instructions || []);
      } catch (e) {
        instructions = [];
      }

      let resolvedPlanId = inv.plan_id || null;
      if (resolvedPlanId) {
        const planExists = await prisma.plan.findUnique({ where: { id: resolvedPlanId } });
        if (!planExists) {
          resolvedPlanId = null;
        }
      }

      await prisma.invoice.upsert({
        where: { invoiceNumber: inv.invoice_number },
        update: {
          licenseId: String(inv.license_id),
          schoolName: inv.school_name,
          productId: inv.product_id || 'absenta',
          planTitle: inv.plan_title || '',
          amount: inv.amount || 0,
          status: inv.status || 'unpaid',
          paymentMethod: inv.payment_method || 'Gateway',
          paymentInstructions: instructions,
          paymentProof: inv.payment_proof || null,
          expiredTime: String(inv.expired_time || ''),
          paidAt: inv.paid_at ? new Date(inv.paid_at) : null,
          planId: resolvedPlanId
        },
        create: {
          id: String(inv.id),
          invoiceNumber: inv.invoice_number,
          licenseId: String(inv.license_id),
          schoolName: inv.school_name,
          productId: inv.product_id || 'absenta',
          planTitle: inv.plan_title || '',
          amount: inv.amount || 0,
          status: inv.status || 'unpaid',
          paymentMethod: inv.payment_method || 'Gateway',
          paymentInstructions: instructions,
          paymentProof: inv.payment_proof || null,
          expiredTime: String(inv.expired_time || ''),
          paidAt: inv.paid_at ? new Date(inv.paid_at) : null,
          planId: resolvedPlanId
        }
      });
    }
    console.log('Invoices migrated successfully.');

    // 6. Migrate Logs
    try {
      console.log('\nMigrating Activity Logs...');
      const sqlLogs = await sqliteDb.all('SELECT * FROM license_logs');
      console.log(`Found ${sqlLogs.length} logs in SQLite.`);

      for (const log of sqlLogs) {
        const licExists = await prisma.license.findUnique({ where: { licenseKey: log.license_key } });
        if (!licExists) {
          console.warn(`Skipping log ${log.id} because license key ${log.license_key} does not exist.`);
          continue;
        }

        await prisma.activityLog.upsert({
          where: { id: String(log.id) },
          update: {
            licenseKey: log.license_key,
            productId: log.product_id || 'absenta',
            ipAddress: log.ip_address || '',
            action: log.action || '',
            createdAt: log.created_at ? new Date(log.created_at) : new Date()
          },
          create: {
            id: String(log.id),
            licenseKey: log.license_key,
            productId: log.product_id || 'absenta',
            ipAddress: log.ip_address || '',
            action: log.action || '',
            createdAt: log.created_at ? new Date(log.created_at) : new Date()
          }
        });
      }
      console.log('Activity Logs migrated successfully.');
    } catch (logErr) {
      console.warn('Skipping Activity Logs migration because SQLite log table disk image is malformed:', logErr.message);
    }

    // 7. Migrate Activated Devices
    try {
      console.log('\nMigrating Activated Devices...');
      const sqlDevices = await sqliteDb.all('SELECT * FROM activated_devices');
      console.log(`Found ${sqlDevices.length} activated devices in SQLite.`);

      for (const dev of sqlDevices) {
        const licExists = await prisma.license.findUnique({ where: { id: String(dev.license_id) } });
        if (!licExists) {
          console.warn(`Skipping device ${dev.id} because license id ${dev.license_id} does not exist.`);
          continue;
        }

        try {
          await prisma.activatedDevice.upsert({
            where: {
              licenseId_deviceId: {
                licenseId: String(dev.license_id),
                deviceId: String(dev.device_id)
              }
            },
            update: {
              activatedAt: dev.activated_at ? new Date(dev.activated_at) : new Date()
            },
            create: {
              licenseId: String(dev.license_id),
              deviceId: String(dev.device_id),
              activatedAt: dev.activated_at ? new Date(dev.activated_at) : new Date()
            }
          });
        } catch (dbErr) {
          console.error(`Failed to upsert device ${dev.device_id} for license ${dev.license_id}:`, dbErr.message);
        }
      }
      console.log('Activated Devices migrated successfully.');
    } catch (devErr) {
      console.warn('Skipping Activated Devices migration:', devErr.message);
    }

    console.log('\n--- MIGRATION SUCCEEDED 100% ---');

  } catch (error) {
    console.error('Migration failed with error:', error);
  } finally {
    if (sqliteDb) await sqliteDb.close();
    await prisma.$disconnect();
  }
}

runMigration();
