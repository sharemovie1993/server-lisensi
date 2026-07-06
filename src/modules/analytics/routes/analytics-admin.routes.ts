import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { verifyAdmin } from '../../../routes/admin.routes';
import { revenueForecastService } from '../services/revenueForecast.service';
import { cohortService } from '../services/cohort.service';

const prisma = new PrismaClient();

export async function analyticsAdminRoutes(fastify: FastifyInstance) {
  fastify.get('/api/admin/analytics/revenue', {
    preHandler: [verifyAdmin],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as any;
        const productId = query?.productId || undefined;
        const data = await revenueForecastService.getLatestForecast(prisma, productId);
        return reply.status(200).send({ success: true, message: 'Revenue forecast retrieved successfully', data });
      } catch (err: any) {
        return reply.status(500).send({ success: false, message: err.message });
      }
    },
  });

  fastify.get('/api/admin/analytics/revenue-forecast', {
    preHandler: [verifyAdmin],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as any;
        const productId = query?.productId || undefined;
        const data = await revenueForecastService.getLatestForecast(prisma, productId);
        return reply.status(200).send({ success: true, message: 'Revenue forecast retrieved successfully', data });
      } catch (err: any) {
        return reply.status(500).send({ success: false, message: err.message });
      }
    },
  });

  fastify.get('/api/admin/analytics/cohort', {
    preHandler: [verifyAdmin],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as any;
        const limitRaw = Number(query?.limit ?? query?.lastN ?? 24);
        const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 24;
        const productId = query?.productId || undefined;

        const data = await cohortService.getCohortRetention(prisma, limit, productId);
        return reply.status(200).send({ success: true, message: 'Cohort retention retrieved successfully', data });
      } catch (err: any) {
        return reply.status(500).send({ success: false, message: err.message });
      }
    },
  });
}
