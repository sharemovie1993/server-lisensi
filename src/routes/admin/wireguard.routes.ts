import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { verifyAdmin } from './middleware';
import {
  getWireguardServerStatus,
  listWireguardPeers,
  createWireguardPeer,
  deleteWireguardPeer,
  syncWireguardConfig,
  getNextWireguardIp
} from '../../services/wireguard.service';

export const registerWireguardRoutes = (fastify: FastifyInstance) => {

  // 1. GET /api/admin/wireguard/status — Ambil ringkasan status interface wg0
  fastify.get('/api/admin/wireguard/status', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const status = await getWireguardServerStatus();
      return reply.send({ success: true, data: status });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message || 'Gagal mengambil status server WireGuard.' });
    }
  });

  // 2. GET /api/admin/wireguard/peers — Daftar lengkap peer dan metrik live
  fastify.get('/api/admin/wireguard/peers', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const peers = await listWireguardPeers();
      const nextIp = await getNextWireguardIp('10.0.0.');
      return reply.send({
        success: true,
        data: peers,
        suggestedNextIp: nextIp
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message || 'Gagal mengambil daftar peer WireGuard.' });
    }
  });

  // 3. POST /api/admin/wireguard/peers — Tambah peer baru & generate .conf klien
  fastify.post('/api/admin/wireguard/peers', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const body = request.body as {
        name: string;
        publicKey?: string;
        privateKey?: string;
        ipAddress?: string;
        subdomainSlug?: string;
        localPort?: number;
        appName?: string;
      };

      if (!body.name || !body.name.trim()) {
        return reply.status(400).send({ success: false, message: 'Nama Peer/Klien wajib diisi!' });
      }

      const result = await createWireguardPeer(body);
      return reply.send({
        success: true,
        message: `Peer '${result.peer.name}' berhasil dibuat.`,
        data: result
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message || 'Gagal membuat peer WireGuard.' });
    }
  });

  // 4. DELETE /api/admin/wireguard/peers/:publicKey — Hapus peer
  fastify.delete('/api/admin/wireguard/peers/:publicKey', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const { publicKey } = request.params as { publicKey: string };
      const decodedKey = decodeURIComponent(publicKey);
      const res = await deleteWireguardPeer(decodedKey);
      return reply.send(res);
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message || 'Gagal menghapus peer WireGuard.' });
    }
  });

  // 5. POST /api/admin/wireguard/sync — Sinkronisasi runtime kernel
  fastify.post('/api/admin/wireguard/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const res = await syncWireguardConfig();
      return reply.send(res);
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message || 'Gagal syncconf WireGuard.' });
    }
  });
};
