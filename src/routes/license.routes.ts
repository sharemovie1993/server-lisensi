import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { registerCoreLicenseRoutes } from './license/core.routes';
import { registerTunnelLicenseRoutes } from './license/tunnel.routes';
import { registerEasyTunnelRoutes } from './license/easy-tunnel.routes';
import { registerAuthLicenseRoutes } from './license/auth.routes';
import { registerPaymentLicenseRoutes } from './license/payment.routes';
import { registerPrivateerLicenseRoutes } from './license/privateer.routes';

export const licenseRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  registerCoreLicenseRoutes(fastify);
  registerTunnelLicenseRoutes(fastify);    // VPN Tunnel lama (vpn-tunnel)
  registerEasyTunnelRoutes(fastify);       // Easy Tunnel dedicated (easy-tunnel)
  registerAuthLicenseRoutes(fastify);
  registerPaymentLicenseRoutes(fastify);
  registerPrivateerLicenseRoutes(fastify);
};

