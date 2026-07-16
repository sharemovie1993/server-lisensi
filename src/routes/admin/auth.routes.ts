import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { verifyTOTP } from '../../utils/totp';

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const TOTP_SECRET = process.env.TOTP_SECRET || '';

export const registerAuthRoutes = (fastify: FastifyInstance) => {
  // 1. Admin login with TOTP verification (supports bypass via DISABLE_2FA=true)
  fastify.post('/api/admin/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { secret, totp_code } = request.body as { secret: string; totp_code: string };

    if (secret === ADMIN_SECRET) {
      const disable2fa = process.env.DISABLE_2FA === 'true';
      const isTotpValid = disable2fa || verifyTOTP(TOTP_SECRET, totp_code);

      if (isTotpValid) {
        const sessionToken = jwt.sign({ role: 'admin' }, ADMIN_SECRET + '_2fa_session', { expiresIn: '7d' });
        return reply.send({ success: true, token: sessionToken });
      } else {
        return reply.status(401).send({ success: false, message: 'Kode 2FA tidak valid!' });
      }
    }

    return reply.status(401).send({ success: false, message: 'PIN Admin tidak valid!' });
  });
};
