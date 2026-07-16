import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../license/helpers';
import { verifyAdmin } from './middleware';

export const registerSettingsRoutes = (fastify: FastifyInstance) => {
  // GET /api/admin/settings (Get system settings)
  fastify.get('/api/admin/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const list = await prisma.systemSetting.findMany();
      const settings: Record<string, string> = {};
      list.forEach(row => {
        settings[row.key] = row.value;
      });
      return reply.send({ success: true, data: settings });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal mengambil pengaturan sistem.' });
    }
  });

  // POST /api/admin/settings (Update system settings)
  fastify.post('/api/admin/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    const body = request.body as Record<string, string>;

    try {
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== null) {
          await prisma.systemSetting.upsert({
            where: { key },
            update: { value: String(value).trim() },
            create: { key, value: String(value).trim() }
          });
        }
      }

      return reply.send({ success: true, message: 'Pengaturan sistem berhasil diperbarui!' });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal memperbarui pengaturan sistem.' });
    }
  });
};
