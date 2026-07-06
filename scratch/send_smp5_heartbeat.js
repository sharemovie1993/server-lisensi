const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

async function run() {
  const licenseKey = 'ABS-H2OT-VYNZ-NV0G'; // License key for platform-absenta
  const port = process.env.PORT || 5001;
  const url = `http://127.0.0.1:${port}/api/platform/heartbeat`;

  // Construct a payload that will trigger high risk intelligence.
  // 1. lastTapped is set to > 30 days ago to trigger inactivity check (+80 points)
  // 2. activeUsers is set to 0 (+30 points)
  // Total risk score will be capped at 100 (CRITICAL level).
  const thirtyTwoDaysAgo = new Date();
  thirtyTwoDaysAgo.setDate(thirtyTwoDaysAgo.getDate() - 32);

  const payload = {
    activeUsers: 0,
    dbSize: 185.5,
    memoryUsage: 0.78,
    lastTapped: thirtyTwoDaysAgo.toISOString(),
    deployMode: 'cloud',
    schoolName: 'SaaS Node (8 Tenant)',
    appDomain: 'smp5.absenta.id',
    hostname: 'smp5-server-prod',
    osType: 'linux',
    tenants: [
      {
        name: 'smp5',
        subdomain: 'smp5'
      }
    ]
  };

  console.log('Sending heartbeat to:', url);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'x-license-key': licenseKey,
        'Content-Type': 'application/json'
      }
    });

    console.log('\n--- Heartbeat Server Response ---');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

    // Verify in database
    console.log('\nVerifying database updates...');
    const prisma = new PrismaClient();
    
    // Find the platform risk for this license
    const risk = await prisma.platformRisk.findFirst({
      where: { tenantId: '119' }
    });
    console.log('Updated Platform Risk Profile for Tenant 119:');
    console.log(JSON.stringify(risk, null, 2));

    // Check latest metrics
    const latestMetric = await prisma.tenantMetrics.findFirst({
      where: { tenantId: '119' },
      orderBy: { createdAt: 'desc' }
    });
    console.log('\nLatest Tenant Metric Entry:');
    console.log(JSON.stringify(latestMetric, null, 2));

    await prisma.$disconnect();
  } catch (error) {
    console.error('Failed to send heartbeat or fetch database metrics:');
    if (error.response) {
      console.error(`HTTP Status: ${error.response.status}`);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

run();
