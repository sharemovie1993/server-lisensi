import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { verifyAdmin } from './middleware';
import {
  listSstpAccounts,
  createSstpAccount,
  updateSstpAccount,
  deleteSstpAccount,
  generateMikrotikScript,
  getNextAvailableIp
} from '../../services/sstp.service';

export const registerSstpRoutes = (fastify: FastifyInstance) => {
  // GET /api/admin/sstp/accounts (List all SSTP VPN accounts)
  fastify.get('/api/admin/sstp/accounts', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const accounts = await listSstpAccounts();
      const nextIp = await getNextAvailableIp();
      return reply.send({
        success: true,
        data: accounts,
        suggestedNextIp: nextIp
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message || 'Gagal mengambil daftar akun SSTP.' });
    }
  });

  // POST /api/admin/sstp/accounts (Create SSTP account)
  fastify.post('/api/admin/sstp/accounts', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const body = request.body as {
        username: string;
        password: string;
        ipAddress?: string;
        comment?: string;
      };

      if (!body.username || !body.password) {
        return reply.status(400).send({ success: false, message: 'Username dan Password wajib diisi!' });
      }

      const newAccount = await createSstpAccount(body);
      return reply.send({
        success: true,
        message: `Akun SSTP '${newAccount.username}' berhasil dibuat.`,
        data: newAccount
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message || 'Gagal membuat akun SSTP.' });
    }
  });

  // PUT /api/admin/sstp/accounts/:id (Update SSTP account)
  fastify.put('/api/admin/sstp/accounts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const { id } = request.params as { id: string };
      const body = request.body as {
        password?: string;
        comment?: string;
        isActive?: boolean;
      };

      const updated = await updateSstpAccount(id, body);
      return reply.send({
        success: true,
        message: `Akun SSTP '${updated.username}' berhasil diperbarui.`,
        data: updated
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message || 'Gagal mengedit akun SSTP.' });
    }
  });

  // DELETE /api/admin/sstp/accounts/:id (Delete SSTP account)
  fastify.delete('/api/admin/sstp/accounts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const { id } = request.params as { id: string };
      const res = await deleteSstpAccount(id);
      return reply.send({
        success: true,
        message: `Akun SSTP '${res.username}' berhasil dihapus.`,
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message || 'Gagal menghapus akun SSTP.' });
    }
  });

  // GET /api/admin/sstp/accounts/:id/script (Get MikroTik RouterOS v6 script)
  fastify.get('/api/admin/sstp/accounts/:id/script', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const { id } = request.params as { id: string };
      const accounts = await listSstpAccounts();
      const target = accounts.find(a => a.id === id);
      if (!target) {
        return reply.status(404).send({ success: false, message: 'Akun SSTP tidak ditemukan.' });
      }

      const script = generateMikrotikScript(target);
      return reply.send({
        success: true,
        data: {
          username: target.username,
          comment: target.comment,
          script
        }
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message || 'Gagal me-generate skrip MikroTik.' });
    }
  });
};
