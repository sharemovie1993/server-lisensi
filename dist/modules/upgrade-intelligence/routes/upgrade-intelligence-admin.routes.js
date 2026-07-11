"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upgradeIntelligenceAdminRoutes = upgradeIntelligenceAdminRoutes;
const client_1 = require("@prisma/client");
const upgradeIntelligence_service_1 = require("../services/upgradeIntelligence.service");
const admin_routes_1 = require("../../../routes/admin.routes");
const helpers_1 = require("../../../routes/license/helpers");
const prisma = new client_1.PrismaClient();
function isValidMonthKey(month) {
    return /^[0-9]{4}-[0-9]{2}$/.test(month);
}
function normalizeMonthKey(month) {
    if (!isValidMonthKey(month))
        return null;
    const [yRaw, mRaw] = month.split('-');
    const y = Number(yRaw);
    const m = Number(mRaw);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12)
        return null;
    const monthStart = upgradeIntelligence_service_1.upgradeIntelligenceService.normalizeMonth(new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0)));
    return upgradeIntelligence_service_1.upgradeIntelligenceService.monthKeyUtc(monthStart);
}
async function upgradeIntelligenceAdminRoutes(fastify) {
    fastify.get('/api/admin/upgrade-intelligence/overview', {
        preHandler: [admin_routes_1.verifyAdmin],
        handler: async (request, reply) => {
            try {
                const queryProduct = request.query;
                const productId = queryProduct.productId && queryProduct.productId !== 'all' ? (0, helpers_1.normalizeProductId)(queryProduct.productId) : undefined;
                const lastNRaw = Number(request.query?.lastNMonths ?? request.query?.months ?? 12);
                const lastN = Number.isFinite(lastNRaw) && lastNRaw > 0 ? Math.floor(lastNRaw) : 12;
                const data = await upgradeIntelligence_service_1.upgradeIntelligenceService.getOverview(prisma, lastN);
                const resolveProductFromSlug = async (slug) => {
                    const activeSub = await prisma.subscription.findFirst({
                        where: { schoolName: { contains: `|${slug}` } },
                        select: { productId: true }
                    });
                    if (activeSub)
                        return activeSub.productId;
                    const lic = await prisma.license.findFirst({
                        where: { OR: [{ requestedSlug: slug }, { customDomain: slug }, { id: slug }] },
                        select: { productId: true }
                    });
                    if (lic)
                        return lic.productId;
                    return null;
                };
                if (data && data.top_hot_tenants) {
                    const enriched = [];
                    for (const t of data.top_hot_tenants) {
                        const prodId = await resolveProductFromSlug(t.tenant_id);
                        if (productId && prodId !== productId)
                            continue;
                        enriched.push(t);
                    }
                    data.top_hot_tenants = enriched;
                }
                return reply.status(200).send({ success: true, message: 'Upgrade intelligence overview retrieved successfully', data });
            }
            catch (err) {
                return reply.status(500).send({ success: false, message: err.message });
            }
        },
    });
    fastify.get('/api/admin/upgrade-intelligence/snapshot/:month', {
        preHandler: [admin_routes_1.verifyAdmin],
        handler: async (request, reply) => {
            try {
                const monthRaw = String(request.params?.month || '').trim();
                const month = normalizeMonthKey(monthRaw);
                if (!month) {
                    return reply.status(400).send({ success: false, code: 'VALIDATION_ERROR', message: 'month must be in YYYY-MM format' });
                }
                const data = await upgradeIntelligence_service_1.upgradeIntelligenceService.getMonthSnapshot(prisma, month);
                return reply.status(200).send({ success: true, message: 'Upgrade intelligence snapshot retrieved successfully', data });
            }
            catch (err) {
                return reply.status(500).send({ success: false, message: err.message });
            }
        },
    });
    fastify.get('/api/admin/upgrade-intelligence/tenant/:id/month/:month', {
        preHandler: [admin_routes_1.verifyAdmin],
        handler: async (request, reply) => {
            try {
                const tenantId = String(request.params?.id || '').trim();
                const monthRaw = String(request.params?.month || '').trim();
                const month = normalizeMonthKey(monthRaw);
                if (!tenantId || !month) {
                    return reply.status(400).send({
                        success: false,
                        code: 'VALIDATION_ERROR',
                        message: 'tenant id and month (YYYY-MM) are required',
                    });
                }
                const data = await upgradeIntelligence_service_1.upgradeIntelligenceService.getTenantMonth(prisma, tenantId, month);
                if (!data) {
                    return reply.status(404).send({
                        success: false,
                        code: 'RECORD_NOT_FOUND',
                        message: 'Tenant upgrade score snapshot not found for this month',
                    });
                }
                return reply.status(200).send({ success: true, message: 'Tenant upgrade score retrieved successfully', data });
            }
            catch (err) {
                return reply.status(500).send({ success: false, message: err.message });
            }
        },
    });
}
