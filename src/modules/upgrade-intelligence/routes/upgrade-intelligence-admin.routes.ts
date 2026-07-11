import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { upgradeIntelligenceService } from '../services/upgradeIntelligence.service';
import { verifyAdmin } from '../../../routes/admin.routes';
import { normalizeProductId } from '../../../routes/license/helpers';

const prisma = new PrismaClient();

function isValidMonthKey(month: string): boolean {
  return /^[0-9]{4}-[0-9]{2}$/.test(month);
}

function normalizeMonthKey(month: string): string | null {
  if (!isValidMonthKey(month)) return null;
  const [yRaw, mRaw] = month.split('-');
  const y = Number(yRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  const monthStart = upgradeIntelligenceService.normalizeMonth(new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0)));
  return upgradeIntelligenceService.monthKeyUtc(monthStart);
}

export async function upgradeIntelligenceAdminRoutes(fastify: FastifyInstance) {
  fastify.get('/api/admin/upgrade-intelligence/overview', {
    preHandler: [verifyAdmin],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const queryProduct = request.query as { productId?: string };
        const productId = queryProduct.productId && queryProduct.productId !== 'all' ? normalizeProductId(queryProduct.productId) : undefined;

        const lastNRaw = Number((request.query as any)?.lastNMonths ?? (request.query as any)?.months ?? 12);
        const lastN = Number.isFinite(lastNRaw) && lastNRaw > 0 ? Math.floor(lastNRaw) : 12;

        const data = await upgradeIntelligenceService.getOverview(prisma, lastN);

        const resolveProductFromSlug = async (slug: string): Promise<string | null> => {
          const activeSub = await prisma.subscription.findFirst({
            where: { schoolName: { contains: `|${slug}` } },
            select: { productId: true }
          });
          if (activeSub) return activeSub.productId;

          const lic = await prisma.license.findFirst({
            where: { OR: [ { requestedSlug: slug }, { customDomain: slug }, { id: slug } ] },
            select: { productId: true }
          });
          if (lic) return lic.productId;

          return null;
        };

        if (data && data.top_hot_tenants) {
          const enriched = [];
          for (const t of data.top_hot_tenants) {
            const prodId = await resolveProductFromSlug(t.tenant_id);
            if (productId && prodId !== productId) continue;
            enriched.push(t);
          }
          data.top_hot_tenants = enriched;
        }

        return reply.status(200).send({ success: true, message: 'Upgrade intelligence overview retrieved successfully', data });
      } catch (err: any) {
        return reply.status(500).send({ success: false, message: err.message });
      }
    },
  });

  fastify.get('/api/admin/upgrade-intelligence/snapshot/:month', {
    preHandler: [verifyAdmin],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const monthRaw = String((request.params as any)?.month || '').trim();
        const month = normalizeMonthKey(monthRaw);
        if (!month) {
          return reply.status(400).send({ success: false, code: 'VALIDATION_ERROR', message: 'month must be in YYYY-MM format' });
        }

        const data = await upgradeIntelligenceService.getMonthSnapshot(prisma, month);
        return reply.status(200).send({ success: true, message: 'Upgrade intelligence snapshot retrieved successfully', data });
      } catch (err: any) {
        return reply.status(500).send({ success: false, message: err.message });
      }
    },
  });

  fastify.get('/api/admin/upgrade-intelligence/tenant/:id/month/:month', {
    preHandler: [verifyAdmin],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = String((request.params as any)?.id || '').trim();
        const monthRaw = String((request.params as any)?.month || '').trim();
        const month = normalizeMonthKey(monthRaw);

        if (!tenantId || !month) {
          return reply.status(400).send({
            success: false,
            code: 'VALIDATION_ERROR',
            message: 'tenant id and month (YYYY-MM) are required',
          });
        }

        const data = await upgradeIntelligenceService.getTenantMonth(prisma, tenantId, month);
        if (!data) {
          return reply.status(404).send({
            success: false,
            code: 'RECORD_NOT_FOUND',
            message: 'Tenant upgrade score snapshot not found for this month',
          });
        }

        return reply.status(200).send({ success: true, message: 'Tenant upgrade score retrieved successfully', data });
      } catch (err: any) {
        return reply.status(500).send({ success: false, message: err.message });
      }
    },
  });
}
