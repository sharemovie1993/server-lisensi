"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWhatsAppRoutes = void 0;
const helpers_1 = require("../license/helpers");
const middleware_1 = require("./middleware");
const whatsapp_service_1 = require("../../services/whatsapp.service");
const registerWhatsAppRoutes = (fastify) => {
    // GET /api/admin/whatsapp/logs (Get WhatsApp Outbox/Log list)
    fastify.get('/api/admin/whatsapp/logs', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const logs = await helpers_1.prisma.whatsAppLog.findMany({
                orderBy: { createdAt: 'desc' },
                take: 500
            });
            return reply.send({ success: true, data: logs });
        }
        catch (err) {
            console.error('[Admin WhatsApp Logs Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengambil log WhatsApp: ' + err.message });
        }
    });
    // POST /api/admin/whatsapp/resend/:id (Resend specific WhatsApp log entry)
    fastify.post('/api/admin/whatsapp/resend/:id', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { id } = request.params;
        try {
            const log = await helpers_1.prisma.whatsAppLog.findUnique({ where: { id } });
            if (!log) {
                return reply.status(404).send({ success: false, message: 'Log WhatsApp tidak ditemukan.' });
            }
            await whatsapp_service_1.waGateway.sendMessage(log.recipient, log.message, 'MANUAL_RESEND_OUTBOX');
            return reply.send({ success: true, message: 'Pesan WhatsApp berhasil dikirim ulang!' });
        }
        catch (err) {
            console.error('[Admin WhatsApp Resend Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengirim ulang pesan WA: ' + err.message });
        }
    });
    // GET /api/admin/wa/status (WhatsApp status)
    fastify.get('/api/admin/wa/status', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        return reply.send({ success: true, data: whatsapp_service_1.waGateway.getStatus() });
    });
    // GET /api/admin/wa/qr (WhatsApp QR)
    fastify.get('/api/admin/wa/qr', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const qrBase64 = whatsapp_service_1.waGateway.getQRBase64();
        return reply.send({ success: true, qr: qrBase64 });
    });
    // POST /api/admin/wa/reconnect (WhatsApp Reconnect)
    fastify.post('/api/admin/wa/reconnect', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        whatsapp_service_1.waGateway.reconnect().catch(err => console.error('[WA Reconnect Error]', err.message));
        return reply.send({ success: true, message: 'WhatsApp sedang di-reset dan menghubungkan kembali...' });
    });
    // POST /api/admin/wa/send-test (WhatsApp Send Test Message)
    fastify.post('/api/admin/wa/send-test', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { number, message } = request.body;
        if (!number || !message) {
            return reply.status(400).send({ success: false, message: 'Nomor dan pesan wajib diisi.' });
        }
        try {
            await whatsapp_service_1.waGateway.sendMessage(number, message);
            return reply.send({ success: true, message: 'Pesan test berhasil dikirim.' });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal mengirim pesan test: ' + err.message });
        }
    });
};
exports.registerWhatsAppRoutes = registerWhatsAppRoutes;
