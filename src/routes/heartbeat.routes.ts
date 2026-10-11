import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { apiKeyHandshakeMiddleware } from '../middlewares/api-key-handshake.middleware';
import { calculateTenantRisk } from '../modules/risk/services/risk.service';

const prisma = new PrismaClient();

interface HeartbeatPayload {
  activeUsers: number;
  dbSize: number;
  memoryUsage: number;
  cpuUsage?: number;
  lastTapped: string;
  deployMode?: string;
  schoolName?: string;
  appDomain?: string;
  hostname?: string;
  osType?: string;
  localAvgResponseTimeMs?: number;
  publicAvgResponseTimeMs?: number;
  avgResponseTimeMs?: number;
  requestsCount?: number;
  localRequestsToday?: number;
  publicRequestsToday?: number;
  tenants?: Array<{ name: string; subdomain: string | null }>;
  easyTunnelTelemetry?: any[];
}

export const heartbeatRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post(
    '/api/platform/heartbeat',
    { preHandler: apiKeyHandshakeMiddleware },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const license = (request as any).license;
        const { 
          activeUsers, 
          dbSize, 
          memoryUsage, 
          cpuUsage, 
          localAvgResponseTimeMs,
          publicAvgResponseTimeMs,
          avgResponseTimeMs,
          requestsCount,
          localRequestsToday,
          publicRequestsToday,
          lastTapped, 
          deployMode, 
          schoolName, 
          appDomain, 
          hostname, 
          osType, 
          tenants, 
          easyTunnelTelemetry 
        } = request.body as HeartbeatPayload;

      if (typeof activeUsers === 'undefined' || typeof dbSize === 'undefined' || typeof memoryUsage === 'undefined') {
        return reply.status(400).send({ success: false, message: 'Invalid payload metrics.' });
      }

      // 0. Update the telemetry directly to the License model
      const updateData: any = {
        lastHeartbeatAt: new Date(),
        deployMode: deployMode || 'local',
        activeUsers: Number(activeUsers),
        dbSize: Number(dbSize),
        memoryUsage: Number(memoryUsage),
        lastTapped: new Date(lastTapped)
      };

      if (typeof cpuUsage !== 'undefined' && cpuUsage !== null) {
        updateData.cpuUsage = Number(cpuUsage);
      }

      if (typeof localAvgResponseTimeMs !== 'undefined' && localAvgResponseTimeMs !== null) {
        updateData.localAvgResponseTimeMs = Number(localAvgResponseTimeMs);
      } else if (typeof avgResponseTimeMs !== 'undefined' && avgResponseTimeMs !== null) {
        updateData.localAvgResponseTimeMs = Number(avgResponseTimeMs);
      }

      if (typeof publicAvgResponseTimeMs !== 'undefined' && publicAvgResponseTimeMs !== null) {
        updateData.publicAvgResponseTimeMs = Number(publicAvgResponseTimeMs);
      }

      if (typeof localRequestsToday !== 'undefined' && localRequestsToday !== null) {
        updateData.localRequestsToday = Number(localRequestsToday);
      }

      if (typeof publicRequestsToday !== 'undefined' && publicRequestsToday !== null) {
        updateData.publicRequestsToday = Number(publicRequestsToday);
      }

      if (easyTunnelTelemetry && Array.isArray(easyTunnelTelemetry) && easyTunnelTelemetry.length > 0) {
        const item = easyTunnelTelemetry[0];
        updateData.networkMode = item.networkMode || 'HYBRID_SPLIT_DNS';
        if (item.localRequestsToday !== undefined) updateData.localRequestsToday = item.localRequestsToday;
        if (item.publicRequestsToday !== undefined) updateData.publicRequestsToday = item.publicRequestsToday;
        if (item.localAvgResponseTimeMs !== undefined) updateData.localAvgResponseTimeMs = item.localAvgResponseTimeMs;
        if (item.publicAvgResponseTimeMs !== undefined) updateData.publicAvgResponseTimeMs = item.publicAvgResponseTimeMs;
      }

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
        } else {
          updateData.requestedSlug = null;
          updateData.customDomain = cleanDomain;
        }
      }

      await prisma.license.update({
        where: { id: license.id },
        data: updateData
      });

      // 0.1 Record time-series metric log (rolling 2-minute window snapshots)
      try {
        const respTime = (typeof avgResponseTimeMs !== 'undefined' && avgResponseTimeMs !== null)
          ? Number(avgResponseTimeMs)
          : ((typeof localAvgResponseTimeMs !== 'undefined' && localAvgResponseTimeMs !== null) ? Number(localAvgResponseTimeMs) : null);

        await prisma.serverMetricLog.create({
          data: {
            licenseId: license.id,
            cpuUsage: (typeof cpuUsage !== 'undefined' && cpuUsage !== null) ? Number(cpuUsage) : null,
            memoryUsage: Number(memoryUsage),
            responseTimeMs: respTime,
            localLatencyMs: (typeof localAvgResponseTimeMs !== 'undefined' && localAvgResponseTimeMs !== null) ? Number(localAvgResponseTimeMs) : null,
            publicLatencyMs: (typeof publicAvgResponseTimeMs !== 'undefined' && publicAvgResponseTimeMs !== null) ? Number(publicAvgResponseTimeMs) : null,
            requestsCount: (typeof requestsCount !== 'undefined' && requestsCount !== null) ? Number(requestsCount) : 0,
            activeUsers: Number(activeUsers),
            dbSize: Number(dbSize),
            recordedAt: new Date()
          }
        });
      } catch (logErr: any) {
        console.error('[Heartbeat] Failed to insert metric log:', logErr.message);
      }

      // 0.5 Sync tenant list from multi-tenant server into subscriptions table
      if (tenants && Array.isArray(tenants) && tenants.length > 0) {
        const existingSubs = await prisma.subscription.findMany({
          where: { licenseId: license.id },
          select: { id: true, schoolName: true, planId: true }
        });

        // Prune saas-node placeholder subscriptions if tenant was removed from node
        const incomingNames = tenants.map(t => (t.name || '').trim().toLowerCase()).filter(Boolean);
        const incomingSlugs = tenants.map(t => (t.subdomain || '').trim().toLowerCase()).filter(Boolean);

        for (const s of existingSubs) {
          if (s.planId === 'saas-node') {
            const parts = s.schoolName.split('|');
            const sName = parts[0].trim().toLowerCase();
            const sSlug = parts[1] ? parts[1].trim().toLowerCase() : '';
            const matchName = incomingNames.includes(sName);
            const matchSlug = sSlug && incomingSlugs.includes(sSlug);
            if (!matchName && !matchSlug) {
              await prisma.subscription.delete({ where: { id: s.id } }).catch(() => {});
            }
          }
        }

        for (const t of tenants) {
          const plainName = t.name ? t.name.trim() : '';
          if (!plainName) continue;

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
                      const updateResult = await prisma.license.updateMany({
                        where: { requestedSlug: oldSlug, productId: { in: ['easy-tunnel', 'vpn'] } },
                        data: { requestedSlug: newSlug }
                      });
                      
                      if (updateResult.count > 0) {
                        console.log(`[Heartbeat-SlugSync] License:${license.id} Triggered cascade update: "${oldSlug}" -> "${newSlug}" (${updateResult.count} licenses)`);
                        
                        // Trigger Caddy reload to regenerate routing
                        try {
                          const { triggerCaddySync } = require('../services/caddy.service');
                          await triggerCaddySync();
                        } catch (caddyErr: any) {
                          console.error('[Heartbeat-SlugSync] Failed to sync Caddy:', caddyErr.message);
                        }
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
          const tActiveUsers = typeof (t as any).activeUsers !== 'undefined' ? Number((t as any).activeUsers) : Number(activeUsers);
          const tLastTapped = (t as any).lastTapped ? new Date((t as any).lastTapped) : new Date(lastTapped);

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
          const { riskScore, riskLevel } = await calculateTenantRisk(tenantSlug, tActiveUsers, tLastTapped);

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
      } else {
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
        const { riskScore, riskLevel } = await calculateTenantRisk(fallbackSlug, Number(activeUsers), lastTappedDate);

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
    } catch (err: any) {
      fastify.log.error('[Heartbeat Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Failed to process heartbeat: ' + err.message });
    }
  });
};
