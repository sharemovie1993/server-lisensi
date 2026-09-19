"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWireguardRoutes = void 0;
const middleware_1 = require("./middleware");
const wireguard_service_1 = require("../../services/wireguard.service");
const registerWireguardRoutes = (fastify) => {
    // 1. GET /api/admin/wireguard/status — Ambil ringkasan status interface wg0
    fastify.get('/api/admin/wireguard/status', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const status = await (0, wireguard_service_1.getWireguardServerStatus)();
            return reply.send({ success: true, data: status });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: err.message || 'Gagal mengambil status server WireGuard.' });
        }
    });
    // 2. GET /api/admin/wireguard/peers — Daftar lengkap peer dan metrik live
    fastify.get('/api/admin/wireguard/peers', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const peers = await (0, wireguard_service_1.listWireguardPeers)();
            const nextIp = await (0, wireguard_service_1.getNextWireguardIp)('10.0.0.');
            return reply.send({
                success: true,
                data: peers,
                suggestedNextIp: nextIp
            });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: err.message || 'Gagal mengambil daftar peer WireGuard.' });
        }
    });
    // 3. POST /api/admin/wireguard/peers — Tambah peer baru & generate .conf klien
    fastify.post('/api/admin/wireguard/peers', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const body = request.body;
            if (!body.name || !body.name.trim()) {
                return reply.status(400).send({ success: false, message: 'Nama Peer/Klien wajib diisi!' });
            }
            const result = await (0, wireguard_service_1.createWireguardPeer)(body);
            return reply.send({
                success: true,
                message: `Peer '${result.peer.name}' berhasil dibuat.`,
                data: result
            });
        }
        catch (err) {
            return reply.status(400).send({ success: false, message: err.message || 'Gagal membuat peer WireGuard.' });
        }
    });
    // 4. DELETE /api/admin/wireguard/peers/:publicKey — Hapus peer
    fastify.delete('/api/admin/wireguard/peers/:publicKey', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const { publicKey } = request.params;
            const decodedKey = decodeURIComponent(publicKey);
            const res = await (0, wireguard_service_1.deleteWireguardPeer)(decodedKey);
            return reply.send(res);
        }
        catch (err) {
            return reply.status(400).send({ success: false, message: err.message || 'Gagal menghapus peer WireGuard.' });
        }
    });
    // 5. POST /api/admin/wireguard/sync — Sinkronisasi runtime kernel
    fastify.post('/api/admin/wireguard/sync', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const res = await (0, wireguard_service_1.syncWireguardConfig)();
            return reply.send(res);
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: err.message || 'Gagal syncconf WireGuard.' });
        }
    });
};
exports.registerWireguardRoutes = registerWireguardRoutes;
