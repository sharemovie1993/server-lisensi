import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { verifyAdmin } from '../../../routes/admin.routes';
import { normalizeProductId } from '../../../routes/license/helpers';

const prisma = new PrismaClient();

export async function riskAdminRoutes(fastify: FastifyInstance) {
  fastify.get('/api/admin/risk/overview', {
    preHandler: [verifyAdmin],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const queryProduct = request.query as { productId?: string };
        const productId = queryProduct.productId && queryProduct.productId !== 'all' ? normalizeProductId(queryProduct.productId) : undefined;

        const licenseFilter: any = {
          OR: [
            { requestedSlug: { not: null } },
            { customDomain: { not: null } }
          ]
        };
        if (productId) {
          licenseFilter.productId = productId;
        }

        const matchingLicenses = await prisma.license.findMany({
          where: licenseFilter,
          select: { id: true, schoolName: true, productId: true, requestedSlug: true, customDomain: true, updatedAt: true }
        });

        const matchingIds = matchingLicenses.map(l => l.id);

        const subscriptions = await prisma.subscription.findMany({
          where: {
            licenseId: { in: matchingIds },
            status: 'active'
          }
        });

        // Compile the list of all matching tenant slugs
        const matchingSlugs: string[] = [];
        for (const lic of matchingLicenses) {
          if (lic.productId === 'platform-absenta') {
            const licenseSubs = subscriptions.filter(s => s.licenseId === lic.id);
            for (const sub of licenseSubs) {
              const slug = sub.schoolName.includes('|') ? sub.schoolName.split('|')[1].trim().toLowerCase() : '';
              if (slug) {
                matchingSlugs.push(slug);
              }
            }
          } else {
            const slug = lic.requestedSlug ? lic.requestedSlug.trim().toLowerCase() : lic.customDomain ? lic.customDomain.trim().toLowerCase() : lic.id;
            if (slug) {
              matchingSlugs.push(slug);
            }
          }
        }

        // Fetch risks only for the matching slugs
        const risks = await prisma.platformRisk.findMany({
          where: { tenantId: { in: matchingSlugs } }
        });

        const riskMap = new Map(risks.map(r => [r.tenantId.toLowerCase(), r]));

        const uniqueTenants: Array<{
          id: string;
          name: string;
          licenseId: string;
          riskScore: number;
          riskLevel: string;
          lastCalculatedAt: Date;
          isCalculated: boolean;
        }> = [];

        for (const license of matchingLicenses) {
          if (license.productId === 'platform-absenta') {
            const licenseSubs = subscriptions.filter(s => s.licenseId === license.id);
            if (licenseSubs.length > 0) {
              const seenNames = new Set<string>();
              for (const sub of licenseSubs) {
                const cleanName = sub.schoolName.split('|')[0].trim();
                const slug = sub.schoolName.includes('|') ? sub.schoolName.split('|')[1].trim().toLowerCase() : '';
                if (seenNames.has(cleanName.toLowerCase())) continue;
                seenNames.add(cleanName.toLowerCase());

                const tenantRisk = slug ? riskMap.get(slug) : undefined;
                const riskScore = tenantRisk?.riskScore ?? 10;
                const riskLevel = tenantRisk?.riskLevel ?? 'HEALTHY';
                const lastCalculatedAt = tenantRisk?.lastCalculatedAt ?? license.updatedAt;
                const isCalculated = !!tenantRisk;

                uniqueTenants.push({
                  id: sub.id,
                  name: cleanName,
                  licenseId: license.id,
                  riskScore,
                  riskLevel,
                  lastCalculatedAt,
                  isCalculated
                });
              }
            } else {
              const slug = license.requestedSlug ? license.requestedSlug.trim().toLowerCase() : license.customDomain ? license.customDomain.trim().toLowerCase() : license.id;
              const tenantRisk = riskMap.get(slug);
              const riskScore = tenantRisk?.riskScore ?? 10;
              const riskLevel = tenantRisk?.riskLevel ?? 'HEALTHY';
              const lastCalculatedAt = tenantRisk?.lastCalculatedAt ?? license.updatedAt;
              const isCalculated = !!tenantRisk;

              uniqueTenants.push({
                id: license.id,
                name: license.schoolName,
                licenseId: license.id,
                riskScore,
                riskLevel,
                lastCalculatedAt,
                isCalculated
              });
            }
          } else {
            const slug = license.requestedSlug ? license.requestedSlug.trim().toLowerCase() : license.customDomain ? license.customDomain.trim().toLowerCase() : license.id;
            const tenantRisk = riskMap.get(slug);
            const riskScore = tenantRisk?.riskScore ?? 10;
            const riskLevel = tenantRisk?.riskLevel ?? 'HEALTHY';
            const lastCalculatedAt = tenantRisk?.lastCalculatedAt ?? license.updatedAt;
            const isCalculated = !!tenantRisk;

            uniqueTenants.push({
              id: license.id,
              name: license.schoolName,
              licenseId: license.id,
              riskScore,
              riskLevel,
              lastCalculatedAt,
              isCalculated
            });
          }
        }

        const totalTenants = uniqueTenants.length;
        const scoredTenants = uniqueTenants.filter(t => t.isCalculated).length;

        const byLevel: Record<string, number> = {
          HEALTHY: 0,
          WARNING: 0,
          HIGH_RISK: 0,
          CRITICAL: 0
        };
        for (const t of uniqueTenants) {
          byLevel[t.riskLevel] = (byLevel[t.riskLevel] || 0) + 1;
        }

        const topTen = [...uniqueTenants]
          .sort((a, b) => {
            if (b.riskScore !== a.riskScore) {
              return b.riskScore - a.riskScore;
            }
            return new Date(b.lastCalculatedAt).getTime() - new Date(a.lastCalculatedAt).getTime();
          })
          .slice(0, 10);

        return reply.status(200).send({
          success: true,
          message: 'Tenant risk overview retrieved successfully',
          data: {
            total_tenant: totalTenants,
            uncalculated_tenant: Math.max(0, totalTenants - scoredTenants),
            HEALTHY: byLevel.HEALTHY ?? 0,
            WARNING: byLevel.WARNING ?? 0,
            HIGH_RISK: byLevel.HIGH_RISK ?? 0,
            CRITICAL: byLevel.CRITICAL ?? 0,
            top_10: topTen.map((t) => ({
              tenant_id: t.id,
              tenant_name: t.name,
              risk_score: t.riskScore,
              risk_level: t.riskLevel,
              last_calculated_at: t.lastCalculatedAt,
            })),
          },
        });
      } catch (err: any) {
        return reply.status(500).send({ success: false, message: err.message });
      }
    },
  });

  fastify.get('/api/admin/risk/tenant/:id', {
    preHandler: [verifyAdmin],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        if (!id) {
          return reply.status(400).send({ success: false, code: 'VALIDATION_ERROR', message: 'tenant id is required' });
        }

        let tenantName = 'Unknown';
        let tenantSlug = id;

        const subscription = await prisma.subscription.findUnique({
          where: { id },
          include: { license: true }
        });

        if (subscription) {
          tenantName = subscription.schoolName.split('|')[0].trim();
          tenantSlug = subscription.schoolName.includes('|') ? subscription.schoolName.split('|')[1].trim().toLowerCase() : id;
        } else {
          const license = await prisma.license.findUnique({
            where: { id },
            select: { id: true, schoolName: true, requestedSlug: true, customDomain: true }
          });
          if (license) {
            tenantName = license.schoolName;
            tenantSlug = license.requestedSlug ? license.requestedSlug.trim().toLowerCase() : license.customDomain ? license.customDomain.trim().toLowerCase() : license.id;
          }
        }

        const risk = await prisma.platformRisk.findUnique({
          where: { tenantId: tenantSlug },
        });

        if (!risk) {
          return reply.status(200).send({
            success: true,
            message: 'Tenant risk retrieved successfully',
            data: {
              score: {
                tenant_id: id,
                tenant_name: tenantName,
                risk_score: 10,
                risk_level: 'HEALTHY',
                email_failure_rate: 0,
                payment_failure_rate: 0,
                last_calculated_at: new Date(),
              },
              recent_events: []
            }
          });
        }

        return reply.status(200).send({
          success: true,
          message: 'Tenant risk retrieved successfully',
          data: {
            score: {
              tenant_id: id,
              tenant_name: tenantName,
              risk_score: risk.riskScore,
              risk_level: risk.riskLevel,
              email_failure_rate: risk.emailFailureRate,
              payment_failure_rate: risk.paymentFailureRate,
              last_calculated_at: risk.lastCalculatedAt,
            },
            recent_events: [] // stub event logs
          }
        });
      } catch (err: any) {
        return reply.status(500).send({ success: false, message: err.message });
      }
    },
  });
}
