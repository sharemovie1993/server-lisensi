"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revenueAdminRoutes = revenueAdminRoutes;
const revenueIntelligence_service_1 = require("../services/revenueIntelligence.service");
const admin_routes_1 = require("../../../routes/admin.routes");
async function revenueAdminRoutes(fastify) {
    fastify.get('/api/admin/revenue/overview', {
        preHandler: [admin_routes_1.verifyAdmin],
        handler: async (_request, reply) => {
            try {
                const data = await revenueIntelligence_service_1.revenueIntelligenceService.getGlobalRevenueOverview();
                return reply.status(200).send({ success: true, message: 'Revenue overview retrieved successfully', data });
            }
            catch (err) {
                return reply.status(500).send({ success: false, message: err.message });
            }
        },
    });
    fastify.get('/api/admin/revenue/trend', {
        preHandler: [admin_routes_1.verifyAdmin],
        handler: async (request, reply) => {
            try {
                const lastNMonthsRaw = Number(request.query?.lastNMonths ?? request.query?.months ?? 6);
                const lastNMonths = Number.isFinite(lastNMonthsRaw) && lastNMonthsRaw > 0 ? Math.floor(lastNMonthsRaw) : 6;
                const data = await revenueIntelligence_service_1.revenueIntelligenceService.getMonthlyTrend(lastNMonths);
                return reply.status(200).send({ success: true, message: 'Revenue trend retrieved successfully', data });
            }
            catch (err) {
                return reply.status(500).send({ success: false, message: err.message });
            }
        },
    });
    fastify.get('/api/admin/revenue/churn', {
        preHandler: [admin_routes_1.verifyAdmin],
        handler: async (request, reply) => {
            try {
                const lastNMonthsRaw = Number(request.query?.lastNMonths ?? request.query?.months ?? 6);
                const lastNMonths = Number.isFinite(lastNMonthsRaw) && lastNMonthsRaw > 0 ? Math.floor(lastNMonthsRaw) : 6;
                const data = await revenueIntelligence_service_1.revenueIntelligenceService.getChurnAnalysis(lastNMonths);
                return reply.status(200).send({ success: true, message: 'Churn analysis retrieved successfully', data });
            }
            catch (err) {
                return reply.status(500).send({ success: false, message: err.message });
            }
        },
    });
    fastify.get('/api/admin/revenue/exposure', {
        preHandler: [admin_routes_1.verifyAdmin],
        handler: async (_request, reply) => {
            try {
                const data = await revenueIntelligence_service_1.revenueIntelligenceService.getTenantRevenueExposure();
                return reply.status(200).send({ success: true, message: 'Revenue exposure retrieved successfully', data });
            }
            catch (err) {
                return reply.status(500).send({ success: false, message: err.message });
            }
        },
    });
}
