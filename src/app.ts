import fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { licenseRoutes } from './routes/license.routes';
import { adminRoutes } from './routes/admin.routes';

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

  // 3. Fallback redirects for admin html files
  app.get('/admin', async (_request, reply) => {
    return reply.sendFile('admin.html');
  });

  app.get('/admin/tenant-detail', async (_request, reply) => {
    return reply.sendFile('tenant_detail.html');
  });

  // 4. Register route plugins
  app.register(licenseRoutes);
  app.register(adminRoutes);

  return app;
}
