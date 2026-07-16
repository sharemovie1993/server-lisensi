import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../license/helpers';
import { verifyAdmin } from './middleware';
import { waGateway } from '../../services/whatsapp.service';

export const registerWhatsAppRoutes = (fastify: FastifyInstance) => {
  // GET /api/admin/whatsapp/logs (Get WhatsApp Outbox/Log list)
  fastify.get('/api/admin/whatsapp/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const logs = await prisma.whatsAppLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500
      });
      return reply.send({ success: true, data: logs });
    } catch (err: any) {
      console.error('[Admin WhatsApp Logs Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal mengambil log WhatsApp: ' + err.message });
    }
  });

  // POST /api/admin/whatsapp/resend/:id (Resend specific WhatsApp log entry)
  fastify.post('/api/admin/whatsapp/resend/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    const { id } = request.params as { id: string };

    try {
      const log = await prisma.whatsAppLog.findUnique({ where: { id } });
      if (!log) {
        return reply.status(404).send({ success: false, message: 'Log WhatsApp tidak ditemukan.' });
      }

      await waGateway.sendMessage(log.recipient, log.message, 'MANUAL_RESEND_OUTBOX');

      return reply.send({ success: true, message: 'Pesan WhatsApp berhasil dikirim ulang!' });
    } catch (err: any) {
      console.error('[Admin WhatsApp Resend Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal mengirim ulang pesan WA: ' + err.message });
    }
  });

  // GET /api/admin/wa/status (WhatsApp status)
  fastify.get('/api/admin/wa/status', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    return reply.send({ success: true, data: waGateway.getStatus() });
  });

  // GET /api/admin/wa/qr (WhatsApp QR)
  fastify.get('/api/admin/wa/qr', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    const qrBase64 = waGateway.getQRBase64();
    return reply.send({ success: true, qr: qrBase64 });
  });

  // POST /api/admin/wa/reconnect (WhatsApp Reconnect)
  fastify.post('/api/admin/wa/reconnect', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    waGateway.reconnect().catch(err => console.error('[WA Reconnect Error]', err.message));
    return reply.send({ success: true, message: 'WhatsApp sedang di-reset dan menghubungkan kembali...' });
  });

  // POST /api/admin/wa/send-test (WhatsApp Send Test Message)
  fastify.post('/api/admin/wa/send-test', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    const { number, message } = request.body as { number: string; message: string };
    if (!number || !message) {
      return reply.status(400).send({ success: false, message: 'Nomor dan pesan wajib diisi.' });
    }

    try {
      await waGateway.sendMessage(number, message);
      return reply.send({ success: true, message: 'Pesan test berhasil dikirim.' });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal mengirim pesan test: ' + err.message });
    }
  });
};
