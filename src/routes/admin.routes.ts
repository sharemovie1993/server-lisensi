import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { verifyAdmin } from './admin/middleware';
import { registerAuthRoutes } from './admin/auth.routes';
import { registerProductRoutes } from './admin/product.routes';
import { registerTenantRoutes } from './admin/tenant.routes';
import { registerBillingRoutes } from './admin/billing.routes';
import { registerWhatsAppRoutes } from './admin/whatsapp.routes';
import { registerSystemRoutes } from './admin/system.routes';
import { registerTicketRoutes } from './admin/ticket.routes';
import { registerPublicRoutes } from './admin/public.routes';

// Re-export verifyAdmin for backwards compatibility
export { verifyAdmin };

export const adminRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Register Auth Sub-routes
  registerAuthRoutes(fastify);

  // Register Product & Plan Sub-routes
  registerProductRoutes(fastify);

  // Register Tenant & Node Sub-routes
  registerTenantRoutes(fastify);

  // Register Billing & Payment Sub-routes
  registerBillingRoutes(fastify);

  // Register WhatsApp Sub-routes
  registerWhatsAppRoutes(fastify);

  // Register System & Telemetry Sub-routes
  registerSystemRoutes(fastify);

  // Register Helpdesk Tickets Sub-routes
  registerTicketRoutes(fastify);

  // Register Public Validation Sub-routes
  registerPublicRoutes(fastify);
};
