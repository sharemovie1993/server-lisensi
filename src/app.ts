import fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { licenseRoutes } from './routes/license.routes';
import { adminRoutes } from './routes/admin.routes';
import { heartbeatRoutes } from './routes/heartbeat.routes';
import { ticketsRoutes } from './routes/tickets.routes';
import { riskAdminRoutes } from './modules/risk/routes/risk-admin.routes';
import { analyticsAdminRoutes } from './modules/analytics/routes/analytics-admin.routes';
import { revenueAdminRoutes } from './modules/revenue/routes/revenue-admin.routes';
import { upgradeIntelligenceAdminRoutes } from './modules/upgrade-intelligence/routes/upgrade-intelligence-admin.routes';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: false,
    trustProxy: true
  });

  // Custom Human-Readable Logger (Format Rapi seperti Absenta)
  app.addHook('onResponse', async (req, reply) => {
    // Filter polling status otomatis agar log tetap bersih & tidak penuh spam
    if (req.url.includes('/api/admin/wa/status') || req.url.includes('/api/admin/system/telemetry')) {
      return;
    }
    const responseTime = reply.elapsedTime ? reply.elapsedTime.toFixed(1) : '0.0';
    const d = new Date();
    const dateStr = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0') + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0') + ':' +
      String(d.getSeconds()).padStart(2, '0');
    console.log(`[${dateStr}] [HTTP] ${req.method} ${req.url} -> ${reply.statusCode} (${responseTime}ms)`);
  });

  // 1. Register CORS
  app.register(fastifyCors, {
    origin: true,
    credentials: true
  });

  // 2. Register Static Folder (Serving Dashboards, Logos, QRIS)
  app.register(fastifyStatic, {
    root: path.join(__dirname, '../public'),
    prefix: '/'
  });

  // 3. Fallback redirects for admin HTML files (React Single Page App)
  app.get('/admin', async (_request, reply) => {
    return reply.sendFile('index.html');
  });

  app.get('/admin/*', async (_request, reply) => {
    return reply.sendFile('index.html');
  });

  // 4. Register route plugins
  app.register(licenseRoutes);
  app.register(adminRoutes);
  app.register(heartbeatRoutes);
  app.register(ticketsRoutes);
  app.register(riskAdminRoutes);
  app.register(analyticsAdminRoutes);
  app.register(revenueAdminRoutes);
  app.register(upgradeIntelligenceAdminRoutes);

  return app;
}
