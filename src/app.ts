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
    logger: true,
    trustProxy: true
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
