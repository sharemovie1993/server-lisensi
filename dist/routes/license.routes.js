"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.licenseRoutes = void 0;
const core_routes_1 = require("./license/core.routes");
const tunnel_routes_1 = require("./license/tunnel.routes");
const easy_tunnel_routes_1 = require("./license/easy-tunnel.routes");
const auth_routes_1 = require("./license/auth.routes");
const payment_routes_1 = require("./license/payment.routes");
const privateer_routes_1 = require("./license/privateer.routes");
const licenseRoutes = async (fastify) => {
    (0, core_routes_1.registerCoreLicenseRoutes)(fastify);
    (0, tunnel_routes_1.registerTunnelLicenseRoutes)(fastify); // VPN Tunnel lama (vpn-tunnel)
    (0, easy_tunnel_routes_1.registerEasyTunnelRoutes)(fastify); // Easy Tunnel dedicated (easy-tunnel)
    (0, auth_routes_1.registerAuthLicenseRoutes)(fastify);
    (0, payment_routes_1.registerPaymentLicenseRoutes)(fastify);
    (0, privateer_routes_1.registerPrivateerLicenseRoutes)(fastify);
};
exports.licenseRoutes = licenseRoutes;
