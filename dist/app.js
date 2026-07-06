"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const static_1 = __importDefault(require("@fastify/static"));
const path_1 = __importDefault(require("path"));
const license_routes_1 = require("./routes/license.routes");
const admin_routes_1 = require("./routes/admin.routes");
const heartbeat_routes_1 = require("./routes/heartbeat.routes");
const tickets_routes_1 = require("./routes/tickets.routes");
const risk_admin_routes_1 = require("./modules/risk/routes/risk-admin.routes");
const analytics_admin_routes_1 = require("./modules/analytics/routes/analytics-admin.routes");
const revenue_admin_routes_1 = require("./modules/revenue/routes/revenue-admin.routes");
const upgrade_intelligence_admin_routes_1 = require("./modules/upgrade-intelligence/routes/upgrade-intelligence-admin.routes");
function buildApp() {
    const app = (0, fastify_1.default)({
        logger: true,
        trustProxy: true
    });
    // 1. Register CORS
    app.register(cors_1.default, {
        origin: true,
        credentials: true
    });
    // 2. Register Static Folder (Serving Dashboards, Logos, QRIS)
    app.register(static_1.default, {
        root: path_1.default.join(__dirname, '../public'),
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
    app.register(license_routes_1.licenseRoutes);
    app.register(admin_routes_1.adminRoutes);
    app.register(heartbeat_routes_1.heartbeatRoutes);
    app.register(tickets_routes_1.ticketsRoutes);
    app.register(risk_admin_routes_1.riskAdminRoutes);
    app.register(analytics_admin_routes_1.analyticsAdminRoutes);
    app.register(revenue_admin_routes_1.revenueAdminRoutes);
    app.register(upgrade_intelligence_admin_routes_1.upgradeIntelligenceAdminRoutes);
    return app;
}
