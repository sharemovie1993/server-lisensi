"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAdmin = verifyAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
async function verifyAdmin(request, reply) {
    const authHeader = request.headers['x-admin-secret'] || request.query.secret;
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
        const decoded = jsonwebtoken_1.default.verify(authHeader, ADMIN_SECRET + '_2fa_session');
        if (decoded && decoded.role === 'admin') {
            return;
        }
    }
    catch (err) {
        return reply.status(401).send({ success: false, message: 'Sesi login telah berakhir atau tidak valid. Silakan login kembali.' });
    }
    return reply.status(401).send({ success: false, message: 'Akses Ditolak.' });
}
