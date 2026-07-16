"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTicketRoutes = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const helpers_1 = require("../license/helpers");
const middleware_1 = require("./middleware");
const registerTicketRoutes = (fastify) => {
    // GET /api/admin/tickets (List all support tickets)
    fastify.get('/api/admin/tickets', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const [tickets, licenses] = await Promise.all([
                helpers_1.prisma.supportTicket.findMany({
                    orderBy: { updatedAt: 'desc' }
                }),
                helpers_1.prisma.license.findMany({
                    select: {
                        id: true,
                        productId: true,
                        requestedSlug: true,
                        licenseKey: true,
                        planId: true,
                        status: true,
                        lastHeartbeatAt: true,
                        deployMode: true,
                        activeUsers: true,
                        dbSize: true,
                        memoryUsage: true,
                        lastTapped: true
                    }
                })
            ]);
            const licenseMap = new Map(licenses.map(l => [l.id, l]));
            const enriched = tickets.map(t => {
                const lic = licenseMap.get(t.tenantId);
                return {
                    ...t,
                    productId: (0, helpers_1.normalizeProductId)(lic?.productId ?? 'unknown'),
                    requestedSlug: lic?.requestedSlug || '',
                    licenseKey: lic?.licenseKey || '',
                    planId: lic?.planId || 'Standard',
                    licenseStatus: lic?.status || 'pending',
                    lastHeartbeatAt: lic?.lastHeartbeatAt || null,
                    deployMode: lic?.deployMode || null,
                    activeUsers: lic?.activeUsers || null,
                    dbSize: lic?.dbSize || null,
                    memoryUsage: lic?.memoryUsage || null,
                    lastTapped: lic?.lastTapped || null
                };
            });
            return reply.send({ success: true, data: enriched });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal mengambil tiket bantuan: ' + err.message });
        }
    });
    // GET /api/admin/tickets/:id (Get ticket details with messages)
    fastify.get('/api/admin/tickets/:id', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { id } = request.params;
        try {
            const ticket = await helpers_1.prisma.supportTicket.findUnique({
                where: { id },
                include: {
                    messages: {
                        orderBy: { createdAt: 'asc' }
                    }
                }
            });
            if (!ticket) {
                return reply.status(404).send({ success: false, message: 'Tiket bantuan tidak ditemukan.' });
            }
            const lic = await helpers_1.prisma.license.findUnique({
                where: { id: ticket.tenantId },
                select: {
                    requestedSlug: true,
                    licenseKey: true,
                    planId: true,
                    status: true,
                    lastHeartbeatAt: true,
                    deployMode: true,
                    activeUsers: true,
                    dbSize: true,
                    memoryUsage: true,
                    lastTapped: true
                }
            });
            const subscriptions = await helpers_1.prisma.subscription.findMany({
                where: {
                    licenseId: ticket.tenantId,
                    status: 'active'
                },
                select: {
                    productId: true
                }
            });
            const merged = {
                ...ticket,
                requestedSlug: lic?.requestedSlug || '',
                licenseKey: lic?.licenseKey || '',
                planId: lic?.planId || 'Standard',
                licenseStatus: lic?.status || 'pending',
                lastHeartbeatAt: lic?.lastHeartbeatAt || null,
                deployMode: lic?.deployMode || null,
                activeUsers: lic?.activeUsers || null,
                dbSize: lic?.dbSize || null,
                memoryUsage: lic?.memoryUsage || null,
                lastTapped: lic?.lastTapped || null,
                modules: subscriptions.map(s => s.productId)
            };
            return reply.send({ success: true, data: merged });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal mengambil detail tiket: ' + err.message });
        }
    });
    // POST /api/admin/tickets/:id/messages (Reply to support ticket)
    fastify.post('/api/admin/tickets/:id/messages', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { id } = request.params;
        const { message } = request.body;
        if (!message) {
            return reply.status(400).send({ success: false, message: 'Isi pesan wajib diisi.' });
        }
        try {
            const ticket = await helpers_1.prisma.supportTicket.findUnique({ where: { id } });
            if (!ticket) {
                return reply.status(404).send({ success: false, message: 'Tiket bantuan tidak ditemukan.' });
            }
            const msg = await helpers_1.prisma.ticketMessage.create({
                data: {
                    ticketId: id,
                    sender: 'agent',
                    senderName: 'Support Agent',
                    message
                }
            });
            await helpers_1.prisma.supportTicket.update({
                where: { id },
                data: { status: 'answered' }
            });
            return reply.status(201).send({ success: true, message: 'Balasan berhasil dikirim.', data: msg });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal mengirim balasan: ' + err.message });
        }
    });
    // POST /api/admin/tickets/:id/resolve (Resolve support ticket)
    fastify.post('/api/admin/tickets/:id/resolve', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { id } = request.params;
        try {
            const ticket = await helpers_1.prisma.supportTicket.findUnique({ where: { id } });
            if (!ticket) {
                return reply.status(404).send({ success: false, message: 'Tiket bantuan tidak ditemukan.' });
            }
            const updated = await helpers_1.prisma.supportTicket.update({
                where: { id },
                data: { status: 'resolved' }
            });
            return reply.send({ success: true, message: 'Tiket berhasil diselesaikan.', data: updated });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal menyelesaikan tiket: ' + err.message });
        }
    });
    // GET /api/admin/tickets/:id/assist-token (Generate remote support impersonation token)
    fastify.get('/api/admin/tickets/:id/assist-token', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { id } = request.params;
        try {
            const ticket = await helpers_1.prisma.supportTicket.findUnique({ where: { id } });
            if (!ticket) {
                return reply.status(404).send({ success: false, message: 'Tiket bantuan tidak ditemukan.' });
            }
            const token = jsonwebtoken_1.default.sign({
                id: 'support-agent',
                email: 'support@system.com',
                tenantId: ticket.tenantId,
                roleName: 'SUPERADMIN',
            }, process.env.JWT_SECRET, { expiresIn: '15m' });
            return reply.send({ success: true, token });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal membuat token assist: ' + err.message });
        }
    });
};
exports.registerTicketRoutes = registerTicketRoutes;
