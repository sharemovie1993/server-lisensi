"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ticketsRoutes = void 0;
const client_1 = require("@prisma/client");
const api_key_handshake_middleware_1 = require("../middlewares/api-key-handshake.middleware");
const prisma = new client_1.PrismaClient();
const ticketsRoutes = async (fastify) => {
    // Secure all routes in this file with API key handshake middleware
    fastify.addHook('preHandler', api_key_handshake_middleware_1.apiKeyHandshakeMiddleware);
    // 1. Create Ticket
    fastify.post('/api/tickets', async (request, reply) => {
        try {
            const license = request.license;
            const { subject, description, priority, category, attachments } = request.body;
            if (!subject || !description) {
                return reply.status(400).send({ success: false, message: 'Subject and description are required.' });
            }
            const ticket = await prisma.supportTicket.create({
                data: {
                    tenantId: license.id,
                    schoolName: license.schoolName,
                    subject,
                    description,
                    status: 'open',
                    priority: priority || 'medium',
                    category: category || 'TECHNICAL',
                    attachments: attachments || null
                }
            });
            // Create initial first message
            await prisma.ticketMessage.create({
                data: {
                    ticketId: ticket.id,
                    sender: 'tenant',
                    senderName: license.schoolName,
                    message: description,
                    attachments: attachments || null
                }
            });
            return reply.send({ success: true, data: ticket });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: err.message });
        }
    });
    // 2. List Tickets
    fastify.get('/api/tickets', async (request, reply) => {
        try {
            const license = request.license;
            const tickets = await prisma.supportTicket.findMany({
                where: { tenantId: license.id },
                orderBy: { createdAt: 'desc' }
            });
            return reply.send({ success: true, data: tickets });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: err.message });
        }
    });
    // 3. Get Detail Ticket
    fastify.get('/api/tickets/:id', async (request, reply) => {
        try {
            const license = request.license;
            const { id } = request.params;
            const ticket = await prisma.supportTicket.findFirst({
                where: { id, tenantId: license.id },
                include: {
                    messages: {
                        orderBy: { createdAt: 'asc' }
                    }
                }
            });
            if (!ticket) {
                return reply.status(404).send({ success: false, message: 'Ticket not found.' });
            }
            return reply.send({ success: true, data: ticket });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: err.message });
        }
    });
    // 4. Reply Ticket (from Customer/Tenant)
    fastify.post('/api/tickets/:id/messages', async (request, reply) => {
        try {
            const license = request.license;
            const { id } = request.params;
            const { message, attachments } = request.body;
            if (!message) {
                return reply.status(400).send({ success: false, message: 'Message content is required.' });
            }
            const ticket = await prisma.supportTicket.findFirst({
                where: { id, tenantId: license.id }
            });
            if (!ticket) {
                return reply.status(404).send({ success: false, message: 'Ticket not found.' });
            }
            const msg = await prisma.ticketMessage.create({
                data: {
                    ticketId: ticket.id,
                    sender: 'tenant',
                    senderName: license.schoolName,
                    message,
                    attachments: attachments || null
                }
            });
            // Auto-reopen ticket if it was resolved/closed
            if (ticket.status === 'closed' || ticket.status === 'resolved') {
                await prisma.supportTicket.update({
                    where: { id: ticket.id },
                    data: { status: 'open' }
                });
            }
            return reply.send({ success: true, data: msg });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: err.message });
        }
    });
    // 5. Resolve Ticket
    fastify.post('/api/tickets/:id/resolve', async (request, reply) => {
        try {
            const license = request.license;
            const { id } = request.params;
            const ticket = await prisma.supportTicket.findFirst({
                where: { id, tenantId: license.id }
            });
            if (!ticket) {
                return reply.status(404).send({ success: false, message: 'Ticket not found.' });
            }
            const updated = await prisma.supportTicket.update({
                where: { id: ticket.id },
                data: { status: 'resolved' }
            });
            return reply.send({ success: true, data: updated });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: err.message });
        }
    });
    // 6. Rate/Close Ticket
    fastify.post('/api/tickets/:id/rate', async (request, reply) => {
        try {
            const license = request.license;
            const { id } = request.params;
            const { rating, comment } = request.body;
            const ticket = await prisma.supportTicket.findFirst({
                where: { id, tenantId: license.id }
            });
            if (!ticket) {
                return reply.status(404).send({ success: false, message: 'Ticket not found.' });
            }
            const updated = await prisma.supportTicket.update({
                where: { id: ticket.id },
                data: {
                    status: 'closed',
                    rating: rating ? parseInt(rating, 10) : null,
                    ratingComment: comment || null
                }
            });
            return reply.send({ success: true, data: updated });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: err.message });
        }
    });
};
exports.ticketsRoutes = ticketsRoutes;
