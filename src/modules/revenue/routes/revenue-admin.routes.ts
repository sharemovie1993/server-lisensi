import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { revenueIntelligenceService } from '../services/revenueIntelligence.service';
import { verifyAdmin } from '../../../routes/admin.routes';

export async function revenueAdminRoutes(fastify: FastifyInstance) {
  fastify.get('/api/admin/revenue/overview', {
    preHandler: [verifyAdmin],
    handler: async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = await revenueIntelligenceService.getGlobalRevenueOverview();
        return reply.status(200).send({ success: true, message: 'Revenue overview retrieved successfully', data });
      } catch (err: any) {
        return reply.status(500).send({ success: false, message: err.message });
      }
    },
  });

  fastify.get('/api/admin/revenue/trend', {
    preHandler: [verifyAdmin],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const lastNMonthsRaw = Number((request.query as any)?.lastNMonths ?? (request.query as any)?.months ?? 6);
        const lastNMonths = Number.isFinite(lastNMonthsRaw) && lastNMonthsRaw > 0 ? Math.floor(lastNMonthsRaw) : 6;
        const data = await revenueIntelligenceService.getMonthlyTrend(lastNMonths);
        return reply.status(200).send({ success: true, message: 'Revenue trend retrieved successfully', data });
      } catch (err: any) {
        return reply.status(500).send({ success: false, message: err.message });
      }
    },
  });

  fastify.get('/api/admin/revenue/churn', {
    preHandler: [verifyAdmin],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const lastNMonthsRaw = Number((request.query as any)?.lastNMonths ?? (request.query as any)?.months ?? 6);
        const lastNMonths = Number.isFinite(lastNMonthsRaw) && lastNMonthsRaw > 0 ? Math.floor(lastNMonthsRaw) : 6;
        const data = await revenueIntelligenceService.getChurnAnalysis(lastNMonths);
        return reply.status(200).send({ success: true, message: 'Churn analysis retrieved successfully', data });
      } catch (err: any) {
        return reply.status(500).send({ success: false, message: err.message });
      }
    },
  });

  fastify.get('/api/admin/revenue/exposure', {
    preHandler: [verifyAdmin],
    handler: async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = await revenueIntelligenceService.getTenantRevenueExposure();
        return reply.status(200).send({ success: true, message: 'Revenue exposure retrieved successfully', data });
      } catch (err: any) {
        return reply.status(500).send({ success: false, message: err.message });
      }
    },
  });
}
