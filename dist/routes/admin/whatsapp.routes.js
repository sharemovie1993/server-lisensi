"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWhatsAppRoutes = void 0;
const helpers_1 = require("../license/helpers");
const middleware_1 = require("./middleware");
const whatsapp_service_1 = require("../../services/whatsapp.service");
const registerWhatsAppRoutes = (fastify) => {
    // GET /api/admin/whatsapp/conversations (Grouped WhatsApp Chat List)
    fastify.get('/api/admin/whatsapp/conversations', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            // 1. Ambil 1000 log WhatsApp terbaru
            const logs = await helpers_1.prisma.whatsAppLog.findMany({
                orderBy: { createdAt: 'desc' },
                take: 1000
            });
            // 2. Ambil referensi lisensi untuk pencocokan nomor HP -> Nama Sekolah
            const licenses = await helpers_1.prisma.license.findMany({
                select: { schoolName: true, operatorPhone: true, licenseKey: true }
            });
            // Map nomor HP bersih -> Nama Sekolah
            const phoneToSchool = new Map();
            licenses.forEach(l => {
                if (l.operatorPhone) {
                    const cleanPh = l.operatorPhone.replace(/[^0-9]/g, '');
                    phoneToSchool.set(cleanPh, l.schoolName);
                    if (cleanPh.startsWith('08')) {
                        phoneToSchool.set('62' + cleanPh.slice(1), l.schoolName);
                    }
                }
            });
            // 3. Kelompokkan log berdasarkan recipient (nomor HP)
            const convMap = new Map();
            for (const log of logs) {
                const cleanRecip = log.recipient.replace(/[^0-9]/g, '');
                const recipientKey = cleanRecip || log.recipient;
                if (!convMap.has(recipientKey)) {
                    const matchedSchool = phoneToSchool.get(recipientKey) || 'Klien WA / Operator';
                    convMap.set(recipientKey, {
                        recipient: recipientKey,
                        schoolName: matchedSchool,
                        lastMessage: log.message,
                        lastStatus: log.status,
                        lastTriggerType: log.triggerType,
                        lastCreatedAt: log.createdAt,
                        totalMessages: 1
                    });
                }
                else {
                    const existing = convMap.get(recipientKey);
                    existing.totalMessages += 1;
                }
            }
            const conversations = Array.from(convMap.values()).sort((a, b) => b.lastCreatedAt.getTime() - a.lastCreatedAt.getTime());
            return reply.send({ success: true, count: conversations.length, data: conversations });
        }
        catch (err) {
            console.error('[Admin WhatsApp Conversations Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar percakapan WA: ' + err.message });
        }
    });
    // GET /api/admin/whatsapp/conversations/:recipient (Thread Percakapan WA Kronologis)
    fastify.get('/api/admin/whatsapp/conversations/:recipient', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { recipient } = request.params;
        const cleanRecip = recipient.replace(/[^0-9]/g, '');
        try {
            const logs = await helpers_1.prisma.whatsAppLog.findMany({
                where: {
                    OR: [
                        { recipient: recipient },
                        { recipient: cleanRecip },
                        { recipient: { contains: cleanRecip } }
                    ]
                },
                orderBy: { createdAt: 'asc' }
            });
            // Cari metadata nama sekolah dari License
            const license = await helpers_1.prisma.license.findFirst({
                where: {
                    OR: [
                        { operatorPhone: { contains: cleanRecip } },
                        { operatorPhone: { contains: recipient } }
                    ]
                },
                select: { schoolName: true, licenseKey: true, status: true }
            });
            return reply.send({
                success: true,
                recipient: cleanRecip || recipient,
                schoolName: license ? license.schoolName : 'Klien WA / Operator',
                licenseKey: license ? license.licenseKey : null,
                data: logs
            });
        }
        catch (err) {
            console.error('[Admin WhatsApp Thread Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengambil thread percakapan WA: ' + err.message });
        }
    });
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
