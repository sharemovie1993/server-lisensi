import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { registerCoreLicenseRoutes } from './license/core.routes';
import { registerTunnelLicenseRoutes } from './license/tunnel.routes';
import { registerAuthLicenseRoutes } from './license/auth.routes';
import { registerPaymentLicenseRoutes } from './license/payment.routes';
import { registerPrivateerLicenseRoutes } from './license/privateer.routes';

export const licenseRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  registerCoreLicenseRoutes(fastify);
  registerTunnelLicenseRoutes(fastify);
  registerAuthLicenseRoutes(fastify);
  registerPaymentLicenseRoutes(fastify);
  registerPrivateerLicenseRoutes(fastify);
};
