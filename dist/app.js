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
    // 3. Fallback redirects for admin html files
    app.get('/admin', async (_request, reply) => {
        return reply.sendFile('admin.html');
    });
    app.get('/admin/tenant-detail', async (_request, reply) => {
        return reply.sendFile('tenant_detail.html');
    });
    // 4. Register route plugins
    app.register(license_routes_1.licenseRoutes);
    app.register(admin_routes_1.adminRoutes);
    return app;
}
