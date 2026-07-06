"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.heartbeatRoutes = void 0;
const client_1 = require("@prisma/client");
const api_key_handshake_middleware_1 = require("../middlewares/api-key-handshake.middleware");
const risk_service_1 = require("../modules/risk/services/risk.service");
const prisma = new client_1.PrismaClient();
const heartbeatRoutes = async (fastify) => {
    fastify.post('/api/platform/heartbeat', { preHandler: api_key_handshake_middleware_1.apiKeyHandshakeMiddleware }, async (request, reply) => {
        try {
            const license = request.license;
            const { activeUsers, dbSize, memoryUsage, lastTapped, deployMode, schoolName, appDomain, hostname, osType, tenants } = request.body;
            if (typeof activeUsers === 'undefined' || typeof dbSize === 'undefined' || typeof memoryUsage === 'undefined') {
                return reply.status(400).send({ success: false, message: 'Invalid payload metrics.' });
            }
            // 0. Update the telemetry directly to the License model
            const updateData = {
                lastHeartbeatAt: new Date(),
                deployMode: deployMode || 'local',
                activeUsers: Number(activeUsers),
                dbSize: Number(dbSize),
                memoryUsage: Number(memoryUsage),
                lastTapped: new Date(lastTapped)
            };
            if (schoolName && schoolName.trim()) {
                updateData.schoolName = schoolName.trim();
            }
            if (hostname && hostname.trim()) {
                updateData.activeHostname = hostname.trim();
            }
            if (osType && osType.trim()) {
                updateData.activeOs = osType.trim();
            }
            if (appDomain && appDomain.trim()) {
                const cleanDomain = appDomain.trim().toLowerCase();
                const domainParts = cleanDomain.split('.');
                const isSubdomain = cleanDomain.endsWith('.absenta.id') && domainParts.length >= 3;
                if (isSubdomain) {
                    updateData.requestedSlug = domainParts[0];
                    updateData.customDomain = null;
                }
                else {
                    updateData.requestedSlug = null;
                    updateData.customDomain = cleanDomain;
                }
            }
            await prisma.license.update({
                where: { id: license.id },
                data: updateData
            });
            // 0.5 Sync tenant list from multi-tenant server into subscriptions table
            if (tenants && Array.isArray(tenants) && tenants.length > 0) {
                const existingSubs = await prisma.subscription.findMany({
                    where: { licenseId: license.id },
                    select: { id: true, schoolName: true }
                });
                for (const t of tenants) {
                    const plainName = t.name ? t.name.trim() : '';
                    if (!plainName)
                        continue;
                    const existing = existingSubs.find(s => s.schoolName.split('|')[0].trim() === plainName);
                    if (existing) {
                        // Update existing subscription if the subdomain changed or is missing
                        const currentSubdomain = existing.schoolName.includes('|') ? existing.schoolName.split('|')[1].trim() : '';
                        if (t.subdomain && t.subdomain !== currentSubdomain) {
                            await prisma.subscription.update({
                                where: { id: existing.id },
                                data: { schoolName: `${plainName}|${t.subdomain}` }
                            });
                            // Cascade update requestedSlug of licenses under this slug (easy-tunnel / VPN)
                            if (currentSubdomain) {
                                const oldSlug = currentSubdomain.toLowerCase();
                                const newSlug = t.subdomain.trim().toLowerCase();
                                if (oldSlug !== newSlug) {
                                    await prisma.license.updateMany({
                                        where: { requestedSlug: oldSlug },
                                        data: { requestedSlug: newSlug }
                                    });
                                    console.log(`[Heartbeat-SlugSync] Cascaded requestedSlug update from "${oldSlug}" to "${newSlug}"`);
                                    // Trigger Caddy reload to regenerate routing
                                    try {
                                        const { triggerCaddySync } = require('../services/caddy.service');
                                        await triggerCaddySync();
                                    }
                                    catch (caddyErr) {
                                        console.error('[Heartbeat-SlugSync] Failed to sync Caddy:', caddyErr.message);
                                    }
                                }
                            }
                        }
                        continue;
                    }
                    // Create a placeholder subscription for this school if not already tracked
                    const dbSchoolName = t.subdomain ? `${plainName}|${t.subdomain}` : plainName;
                    await prisma.subscription.create({
                        data: {
                            licenseId: license.id,
                            schoolName: dbSchoolName,
                            productId: license.productId,
                            planId: license.planId || 'saas-node',
                            status: 'active',
                            startDate: new Date().toISOString().split('T')[0],
                            endDate: license.expiresAt
                        }
                    });
                }
            }
            let processedMetricId = '';
            if (tenants && Array.isArray(tenants) && tenants.length > 0) {
                // Multi-tenant path (tenant-centric processing)
                for (const t of tenants) {
                    const tenantSlug = t.subdomain ? t.subdomain.trim().toLowerCase() : license.requestedSlug || 'default';
                    // Cast activeUsers and lastTapped safely
                    const tActiveUsers = typeof t.activeUsers !== 'undefined' ? Number(t.activeUsers) : Number(activeUsers);
                    const tLastTapped = t.lastTapped ? new Date(t.lastTapped) : new Date(lastTapped);
                    // 1. Create TenantMetrics entry
                    const tMetric = await prisma.tenantMetrics.create({
                        data: {
                            tenantId: tenantSlug,
                            activeUsers: tActiveUsers,
                            dbSize: Number(dbSize),
                            memoryUsage: Number(memoryUsage),
                            lastTapped: tLastTapped
                        }
                    });
                    processedMetricId = tMetric.id;
                    // 2. Perform Tenant Churn Risk assessment
                    const { riskScore, riskLevel } = await (0, risk_service_1.calculateTenantRisk)(tenantSlug, tActiveUsers, tLastTapped);
                    await prisma.platformRisk.upsert({
                        where: { tenantId: tenantSlug },
                        create: {
                            tenantId: tenantSlug,
                            riskScore,
                            riskLevel,
                            emailFailureRate: 0,
                            paymentFailureRate: 0,
                            lastCalculatedAt: new Date()
                        },
                        update: {
                            riskScore,
                            riskLevel,
                            lastCalculatedAt: new Date()
                        }
                    });
                    // 3. Perform Upgrade Intelligence assessment
                    const intentScore = tActiveUsers > 100 ? 75 : 30;
                    const intentLevel = intentScore >= 70 ? 'HIGH' : 'LOW';
                    await prisma.upgradeIntelligence.upsert({
                        where: { tenantId: tenantSlug },
                        create: {
                            tenantId: tenantSlug,
                            intentScore,
                            intentLevel,
                            usageGrowthPercent: 5.0,
                            lastCalculatedAt: new Date()
                        },
                        update: {
                            intentScore,
                            intentLevel,
                            lastCalculatedAt: new Date()
                        }
                    });
                }
            }
            else {
                // Fallback: Single-tenant or legacy client path (uses license slug or id as tenantId)
                const fallbackSlug = license.requestedSlug || license.customDomain || license.id;
                // 1. Create TenantMetrics entry
                const metric = await prisma.tenantMetrics.create({
                    data: {
                        tenantId: fallbackSlug,
                        activeUsers: Number(activeUsers),
                        dbSize: Number(dbSize),
                        memoryUsage: Number(memoryUsage),
                        lastTapped: new Date(lastTapped)
                    }
                });
                processedMetricId = metric.id;
                // 2. Perform Tenant Churn Risk assessment
                const lastTappedDate = lastTapped ? new Date(lastTapped) : undefined;
                const { riskScore, riskLevel } = await (0, risk_service_1.calculateTenantRisk)(fallbackSlug, Number(activeUsers), lastTappedDate);
                await prisma.platformRisk.upsert({
                    where: { tenantId: fallbackSlug },
                    create: {
                        tenantId: fallbackSlug,
                        riskScore,
                        riskLevel,
                        emailFailureRate: 0,
                        paymentFailureRate: 0,
                        lastCalculatedAt: new Date()
                    },
                    update: {
                        riskScore,
                        riskLevel,
                        lastCalculatedAt: new Date()
                    }
                });
                // 3. Perform Upgrade Intelligence assessment
                const intentScore = activeUsers > 100 ? 75 : 30;
                const intentLevel = intentScore >= 70 ? 'HIGH' : 'LOW';
                await prisma.upgradeIntelligence.upsert({
                    where: { tenantId: fallbackSlug },
                    create: {
                        tenantId: fallbackSlug,
                        intentScore,
                        intentLevel,
                        usageGrowthPercent: 5.0,
                        lastCalculatedAt: new Date()
                    },
                    update: {
                        intentScore,
                        intentLevel,
                        lastCalculatedAt: new Date()
                    }
                });
            }
            return reply.send({
                success: true,
                message: 'Heartbeat metrics processed successfully.',
                metricId: processedMetricId
            });
        }
        catch (err) {
            fastify.log.error('[Heartbeat Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Failed to process heartbeat: ' + err.message });
        }
    });
};
exports.heartbeatRoutes = heartbeatRoutes;
