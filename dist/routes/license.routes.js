"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.licenseRoutes = void 0;
const core_routes_1 = require("./license/core.routes");
const tunnel_routes_1 = require("./license/tunnel.routes");
const auth_routes_1 = require("./license/auth.routes");
const payment_routes_1 = require("./license/payment.routes");
const licenseRoutes = async (fastify) => {
    (0, core_routes_1.registerCoreLicenseRoutes)(fastify);
    (0, tunnel_routes_1.registerTunnelLicenseRoutes)(fastify);
    (0, auth_routes_1.registerAuthLicenseRoutes)(fastify);
    (0, payment_routes_1.registerPaymentLicenseRoutes)(fastify);
};
exports.licenseRoutes = licenseRoutes;
