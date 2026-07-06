"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsAdminRoutes = analyticsAdminRoutes;
const client_1 = require("@prisma/client");
const admin_routes_1 = require("../../../routes/admin.routes");
const revenueForecast_service_1 = require("../services/revenueForecast.service");
const cohort_service_1 = require("../services/cohort.service");
const prisma = new client_1.PrismaClient();
async function analyticsAdminRoutes(fastify) {
    fastify.get('/api/admin/analytics/revenue', {
        preHandler: [admin_routes_1.verifyAdmin],
        handler: async (request, reply) => {
            try {
                const query = request.query;
                const productId = query?.productId || undefined;
                const data = await revenueForecast_service_1.revenueForecastService.getLatestForecast(prisma, productId);
                return reply.status(200).send({ success: true, message: 'Revenue forecast retrieved successfully', data });
            }
            catch (err) {
                return reply.status(500).send({ success: false, message: err.message });
            }
        },
    });
    fastify.get('/api/admin/analytics/revenue-forecast', {
        preHandler: [admin_routes_1.verifyAdmin],
        handler: async (request, reply) => {
            try {
                const query = request.query;
                const productId = query?.productId || undefined;
                const data = await revenueForecast_service_1.revenueForecastService.getLatestForecast(prisma, productId);
                return reply.status(200).send({ success: true, message: 'Revenue forecast retrieved successfully', data });
            }
            catch (err) {
                return reply.status(500).send({ success: false, message: err.message });
            }
        },
    });
    fastify.get('/api/admin/analytics/cohort', {
        preHandler: [admin_routes_1.verifyAdmin],
        handler: async (request, reply) => {
            try {
                const query = request.query;
                const limitRaw = Number(query?.limit ?? query?.lastN ?? 24);
                const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 24;
                const productId = query?.productId || undefined;
                const data = await cohort_service_1.cohortService.getCohortRetention(prisma, limit, productId);
                return reply.status(200).send({ success: true, message: 'Cohort retention retrieved successfully', data });
            }
            catch (err) {
                return reply.status(500).send({ success: false, message: err.message });
            }
        },
    });
}
