import { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

export async function verifyAdmin(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = (request.headers['x-admin-secret'] as string) || (request.query as any).secret;
  if (!authHeader) {
    return reply.status(401).send({ success: false, message: 'Akses Ditolak. Harap login terlebih dahulu.' });
  }

  // Bypass 2FA for localhost connections
  const ip = request.ip;
  const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  if (isLocalhost && authHeader === ADMIN_SECRET) {
    return;
  }

  try {
    const decoded = jwt.verify(authHeader, ADMIN_SECRET + '_2fa_session') as any;
    if (decoded && decoded.role === 'admin') {
      return;
    }
  } catch (err) {
    return reply.status(401).send({ success: false, message: 'Sesi login telah berakhir atau tidak valid. Silakan login kembali.' });
  }

  return reply.status(401).send({ success: false, message: 'Akses Ditolak.' });
}
