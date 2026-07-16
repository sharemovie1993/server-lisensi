"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthRoutes = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const totp_1 = require("../../utils/totp");
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const TOTP_SECRET = process.env.TOTP_SECRET || '';
const registerAuthRoutes = (fastify) => {
    // 1. Admin login with TOTP verification (supports bypass via DISABLE_2FA=true)
    fastify.post('/api/admin/login', async (request, reply) => {
        const { secret, totp_code } = request.body;
        if (secret === ADMIN_SECRET) {
            const disable2fa = process.env.DISABLE_2FA === 'true';
            const isTotpValid = disable2fa || (0, totp_1.verifyTOTP)(TOTP_SECRET, totp_code);
            if (isTotpValid) {
                const sessionToken = jsonwebtoken_1.default.sign({ role: 'admin' }, ADMIN_SECRET + '_2fa_session', { expiresIn: '7d' });
                return reply.send({ success: true, token: sessionToken });
            }
            else {
                return reply.status(401).send({ success: false, message: 'Kode 2FA tidak valid!' });
            }
        }
        return reply.status(401).send({ success: false, message: 'PIN Admin tidak valid!' });
    });
};
exports.registerAuthRoutes = registerAuthRoutes;
