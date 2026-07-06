"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthLicenseRoutes = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const helpers_1 = require("./helpers");
const whatsapp_service_1 = require("../../services/whatsapp.service");
const otp = __importStar(require("../../utils/otp"));
const keys_1 = require("../../utils/keys");
const registerAuthLicenseRoutes = (fastify) => {
    // 1. Client Auth: Request OTP
    fastify.post('/api/auth/request-otp', async (request, reply) => {
        const { nomor } = request.body;
        if (!nomor) {
            return reply.status(400).send({ success: false, message: 'Nomor WhatsApp wajib diisi.' });
        }
        const formatted = (0, helpers_1.formatWA)(nomor);
        if (!formatted.startsWith('62') || formatted.length < 10) {
            return reply.status(400).send({ success: false, message: 'Format nomor WhatsApp tidak valid.' });
        }
        if (otp.hasActiveOTP(formatted)) {
            const remaining = otp.getRemainingSeconds(formatted);
            return reply.status(429).send({
                success: false,
                message: `Silakan tunggu ${remaining} detik sebelum meminta kode OTP kembali.`
            });
        }
        try {
            const code = otp.generateOTP(formatted);
            const templates = [
                `*[Easy Tunnel]*\n\nKode OTP verifikasi Anda adalah: *${code}*\n\nJangan bagikan kode ini kepada siapa pun. Kode berlaku selama 5 menit.`,
                `🔑 *Kode OTP Easy Tunnel*: *${code}*\n\nMasukkan kode ini untuk masuk ke dashboard. Rahasiakan kode verifikasi Anda. Kedaluwarsa dalam 5 menit.`,
                `Halo! Berikut adalah kode verifikasi akun Easy Tunnel Anda:\n\n*${code}*\n\nBerlaku selama 5 menit. Abaikan jika Anda tidak memintanya.`,
                `⚠️ *KEAMANAN AKUN - Easy Tunnel*\n\nKode verifikasi masuk Anda: *${code}*\n\nKode ini bersifat rahasia dan aktif selama 300 detik.`,
                `Berikut adalah kode OTP Anda untuk masuk ke sistem:\n🔑 *${code}*\n\nBerlaku 5 menit. Tim kami tidak pernah meminta kode ini.`,
                `Kode verifikasi Easy Tunnel Anda: *${code}*`,
                `OTP masuk Easy Tunnel: *${code}*`,
                `Kode OTP Anda: *${code}* (Berlaku 5 menit)`,
                `Gunakan kode *${code}* untuk login ke dashboard Easy Tunnel.`
            ];
            const randTemplate = templates[Math.floor(Math.random() * templates.length)];
            const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
            const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
            const message = `${randTemplate}\n\n_[Ref: ${randomChars} - Pukul ${timeStr}]_`;
            await whatsapp_service_1.waGateway.sendMessage(formatted, message);
            return reply.send({ success: true, message: 'Kode OTP berhasil dikirim ke nomor WhatsApp Anda.' });
        }
        catch (err) {
            console.error('[Request OTP Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengirim OTP: ' + err.message });
        }
    });
    // 2. Client Auth: Verify OTP
    fastify.post('/api/auth/verify-otp', async (request, reply) => {
        const { nomor, code } = request.body;
        if (!nomor || !code) {
            return reply.status(400).send({ success: false, message: 'Nomor WhatsApp dan kode OTP wajib diisi.' });
        }
        const formatted = (0, helpers_1.formatWA)(nomor);
        const result = otp.verifyOTP(formatted, code);
        if (!result.valid) {
            return reply.status(400).send({ success: false, message: result.reason });
        }
        const token = jsonwebtoken_1.default.sign({ nomor: formatted }, keys_1.ADMIN_SECRET + '_client_session', { expiresIn: '30d' });
        return reply.send({
            success: true,
            token,
            message: 'Verifikasi berhasil!'
        });
    });
    // 3. Client Auth: Get my licenses
    fastify.get('/api/auth/my-licenses', async (request, reply) => {
        await (0, helpers_1.verifyClient)(request, reply);
        if (reply.sent)
            return;
        const { nomor } = request.operator;
        try {
            const list = await helpers_1.prisma.license.findMany({
                where: { operatorPhone: nomor, productId: 'easy-tunnel' },
                orderBy: { createdAt: 'desc' }
            });
            const mapped = list.map(l => ({
                id: l.id,
                license_key: l.licenseKey,
                product_id: l.productId,
                school_name: l.schoolName,
                device_limit: l.deviceLimit,
                is_unlimited: l.isUnlimited,
                expires_at: l.expiresAt,
                status: l.status,
                is_active: l.isActive,
                plan_id: l.planId,
                requested_slug: l.requestedSlug,
                wireguard_ip: l.wireguardIp,
                include_vpn: l.includeVpn,
                local_port: l.localPort,
                app_name: l.appName,
                active_hostname: l.activeHostname,
                created_at: l.createdAt
            }));
            return reply.send({ success: true, count: mapped.length, data: mapped });
        }
        catch (err) {
            console.error('[Get Licenses Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar lisensi: ' + err.message });
        }
    });
    // 4. Client Auth: Claim license
    fastify.post('/api/auth/claim-license', async (request, reply) => {
        await (0, helpers_1.verifyClient)(request, reply);
        if (reply.sent)
            return;
        const { nomor } = request.operator;
        const { license_key } = request.body;
        if (!license_key) {
            return reply.status(400).send({ success: false, message: 'License key wajib diisi.' });
        }
        const cleanKey = license_key.trim();
        try {
            const license = await helpers_1.prisma.license.findUnique({
                where: { licenseKey: cleanKey }
            });
            if (!license || license.productId !== 'easy-tunnel') {
                return reply.status(404).send({ success: false, message: 'Kunci lisensi tidak ditemukan.' });
            }
            if (license.operatorPhone && license.operatorPhone !== nomor) {
                return reply.status(400).send({
                    success: false,
                    message: 'Kunci lisensi ini sudah diklaim oleh operator lain.'
                });
            }
            await helpers_1.prisma.license.update({
                where: { licenseKey: cleanKey },
                data: { operatorPhone: nomor }
            });
            return reply.send({
                success: true,
                message: 'Kunci lisensi berhasil diklaim dan dikaitkan dengan nomor Anda.'
            });
        }
        catch (err) {
            console.error('[Claim License Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengklaim lisensi: ' + err.message });
        }
    });
    // 5. Client Auth: Get my orders
    fastify.get('/api/auth/my-orders', async (request, reply) => {
        await (0, helpers_1.verifyClient)(request, reply);
        if (reply.sent)
            return;
        const { nomor } = request.operator;
        try {
            const invoices = await helpers_1.prisma.invoice.findMany({
                where: {
                    license: {
                        operatorPhone: nomor,
                        productId: 'easy-tunnel'
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            const mapped = invoices.map(i => ({
                id: i.id,
                invoice_number: i.invoiceNumber,
                license_id: i.licenseId,
                school_name: i.schoolName,
                product_id: i.productId,
                plan_title: i.planTitle,
                amount: i.amount,
                status: i.status,
                payment_method: i.paymentMethod,
                expired_time: i.expiredTime,
                paid_at: i.paidAt ? i.paidAt.toISOString() : null,
                created_at: i.createdAt
            }));
            return reply.send({ success: true, count: mapped.length, data: mapped });
        }
        catch (err) {
            console.error('[Get Orders Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar order: ' + err.message });
        }
    });
};
exports.registerAuthLicenseRoutes = registerAuthLicenseRoutes;
