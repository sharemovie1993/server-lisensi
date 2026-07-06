import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { registerCoreLicenseRoutes } from './license/core.routes';
import { registerTunnelLicenseRoutes } from './license/tunnel.routes';
import { registerAuthLicenseRoutes } from './license/auth.routes';
import { registerPaymentLicenseRoutes } from './license/payment.routes';

export const licenseRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  registerCoreLicenseRoutes(fastify);
  registerTunnelLicenseRoutes(fastify);
  registerAuthLicenseRoutes(fastify);
  registerPaymentLicenseRoutes(fastify);
};
