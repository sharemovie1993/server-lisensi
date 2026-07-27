"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSstpRoutes = void 0;
const middleware_1 = require("./middleware");
const sstp_service_1 = require("../../services/sstp.service");
const registerSstpRoutes = (fastify) => {
    // GET /api/admin/sstp/accounts (List all SSTP VPN accounts)
    fastify.get('/api/admin/sstp/accounts', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const accounts = await (0, sstp_service_1.listSstpAccounts)();
            const nextIp = await (0, sstp_service_1.getNextAvailableIp)();
            return reply.send({
                success: true,
                data: accounts,
                suggestedNextIp: nextIp
            });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: err.message || 'Gagal mengambil daftar akun SSTP.' });
        }
    });
    // POST /api/admin/sstp/accounts (Create SSTP account)
    fastify.post('/api/admin/sstp/accounts', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const body = request.body;
            if (!body.username || !body.password) {
                return reply.status(400).send({ success: false, message: 'Username dan Password wajib diisi!' });
            }
            const newAccount = await (0, sstp_service_1.createSstpAccount)(body);
            return reply.send({
                success: true,
                message: `Akun SSTP '${newAccount.username}' berhasil dibuat.`,
                data: newAccount
            });
        }
        catch (err) {
            return reply.status(400).send({ success: false, message: err.message || 'Gagal membuat akun SSTP.' });
        }
    });
    // PUT /api/admin/sstp/accounts/:id (Update SSTP account)
    fastify.put('/api/admin/sstp/accounts/:id', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const { id } = request.params;
            const body = request.body;
            const updated = await (0, sstp_service_1.updateSstpAccount)(id, body);
            return reply.send({
                success: true,
                message: `Akun SSTP '${updated.username}' berhasil diperbarui.`,
                data: updated
            });
        }
        catch (err) {
            return reply.status(400).send({ success: false, message: err.message || 'Gagal mengedit akun SSTP.' });
        }
    });
    // DELETE /api/admin/sstp/accounts/:id (Delete SSTP account)
    fastify.delete('/api/admin/sstp/accounts/:id', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const { id } = request.params;
            const res = await (0, sstp_service_1.deleteSstpAccount)(id);
            return reply.send({
                success: true,
                message: `Akun SSTP '${res.username}' berhasil dihapus.`,
            });
        }
        catch (err) {
            return reply.status(400).send({ success: false, message: err.message || 'Gagal menghapus akun SSTP.' });
        }
    });
    // GET /api/admin/sstp/accounts/:id/script (Get MikroTik RouterOS v6 script)
    fastify.get('/api/admin/sstp/accounts/:id/script', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const { id } = request.params;
            const accounts = await (0, sstp_service_1.listSstpAccounts)();
            const target = accounts.find(a => a.id === id);
            if (!target) {
                return reply.status(404).send({ success: false, message: 'Akun SSTP tidak ditemukan.' });
            }
            const script = (0, sstp_service_1.generateMikrotikScript)(target);
            return reply.send({
                success: true,
                data: {
                    username: target.username,
                    comment: target.comment,
                    script
                }
            });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: err.message || 'Gagal me-generate skrip MikroTik.' });
        }
    });
};
exports.registerSstpRoutes = registerSstpRoutes;
