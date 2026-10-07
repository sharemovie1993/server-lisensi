import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { registerCoreLicenseRoutes } from './license/core.routes';
import { registerTunnelLicenseRoutes } from './license/tunnel.routes';
import { registerEasyTunnelRoutes } from './license/easy-tunnel.routes';
import { registerAuthLicenseRoutes } from './license/auth.routes';
import { registerPaymentLicenseRoutes } from './license/payment.routes';
import { registerPrivateerLicenseRoutes } from './license/privateer.routes';
import { registerUndanganDigitalLicenseRoutes } from './license/undangan-digital.routes';
import { registerTenantEntitlementRoutes } from './license/tenant-entitlements.routes';

export const licenseRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  registerCoreLicenseRoutes(fastify);
  registerTunnelLicenseRoutes(fastify);    // VPN Tunnel lama (vpn-tunnel)
  registerEasyTunnelRoutes(fastify);       // Easy Tunnel dedicated (easy-tunnel)
  registerTenantEntitlementRoutes(fastify); // Tenant Entitlements & Migration Rebind
  registerAuthLicenseRoutes(fastify);
  registerPaymentLicenseRoutes(fastify);
  registerPrivateerLicenseRoutes(fastify);
  registerUndanganDigitalLicenseRoutes(fastify); // Undangan Digital dedicated (undangan-digital)
};
