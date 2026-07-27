"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = exports.verifyAdmin = void 0;
const middleware_1 = require("./admin/middleware");
Object.defineProperty(exports, "verifyAdmin", { enumerable: true, get: function () { return middleware_1.verifyAdmin; } });
const auth_routes_1 = require("./admin/auth.routes");
const product_routes_1 = require("./admin/product.routes");
const tenant_routes_1 = require("./admin/tenant.routes");
const billing_routes_1 = require("./admin/billing.routes");
const whatsapp_routes_1 = require("./admin/whatsapp.routes");
const system_routes_1 = require("./admin/system.routes");
const ticket_routes_1 = require("./admin/ticket.routes");
const public_routes_1 = require("./admin/public.routes");
const settings_routes_1 = require("./admin/settings.routes");
const sstp_routes_1 = require("./admin/sstp.routes");
const adminRoutes = async (fastify) => {
    // Register Auth Sub-routes
    (0, auth_routes_1.registerAuthRoutes)(fastify);
    // Register Product & Plan Sub-routes
    (0, product_routes_1.registerProductRoutes)(fastify);
    // Register Tenant & Node Sub-routes
    (0, tenant_routes_1.registerTenantRoutes)(fastify);
    // Register Billing & Payment Sub-routes
    (0, billing_routes_1.registerBillingRoutes)(fastify);
    // Register WhatsApp Sub-routes
    (0, whatsapp_routes_1.registerWhatsAppRoutes)(fastify);
    // Register System & Telemetry Sub-routes
    (0, system_routes_1.registerSystemRoutes)(fastify);
    // Register Settings Sub-routes
    (0, settings_routes_1.registerSettingsRoutes)(fastify);
    // Register Helpdesk Tickets Sub-routes
    (0, ticket_routes_1.registerTicketRoutes)(fastify);
    // Register Public Validation Sub-routes
    (0, public_routes_1.registerPublicRoutes)(fastify);
    // Register SSTP VPN Sub-routes
    (0, sstp_routes_1.registerSstpRoutes)(fastify);
};
exports.adminRoutes = adminRoutes;
