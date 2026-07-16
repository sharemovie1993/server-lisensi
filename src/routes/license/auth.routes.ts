import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { prisma, formatWA, verifyClient } from './helpers';
import { waGateway } from '../../services/whatsapp.service';
import * as otp from '../../utils/otp';
import { ADMIN_SECRET } from '../../utils/keys';

export const registerAuthLicenseRoutes = (fastify: FastifyInstance) => {

  // 1. Client Auth: Request OTP
  fastify.post('/api/auth/request-otp', async (request: FastifyRequest, reply: FastifyReply) => {
    const { nomor } = request.body as { nomor: string };
    if (!nomor) {
      return reply.status(400).send({ success: false, message: 'Nomor WhatsApp wajib diisi.' });
    }
    const formatted = formatWA(nomor);
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

      await waGateway.sendMessage(formatted, message);
      return reply.send({ success: true, message: 'Kode OTP berhasil dikirim ke nomor WhatsApp Anda.' });
    } catch (err: any) {
      console.error('[Request OTP Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal mengirim OTP: ' + err.message });
    }
  });

  // 2. Client Auth: Verify OTP
  fastify.post('/api/auth/verify-otp', async (request: FastifyRequest, reply: FastifyReply) => {
    const { nomor, code } = request.body as { nomor: string; code: string };
    if (!nomor || !code) {
      return reply.status(400).send({ success: false, message: 'Nomor WhatsApp dan kode OTP wajib diisi.' });
    }
    const formatted = formatWA(nomor);

    const result = otp.verifyOTP(formatted, code);
    if (!result.valid) {
      return reply.status(400).send({ success: false, message: result.reason });
    }

    const token = jwt.sign({ nomor: formatted }, ADMIN_SECRET + '_client_session', { expiresIn: '30d' });
    return reply.send({
      success: true,
      token,
      message: 'Verifikasi berhasil!'
    });
  });

  // Helper to handle both local (08...) and international (62...) phone number formats in DB query
  const getPhoneVariants = (phone: string): string[] => {
    const formatted = formatWA(phone);
    if (!formatted) return [];
    const local = '0' + formatted.slice(2);
    return [formatted, local];
  };

  // 3. Client Auth: Get my licenses
  fastify.get('/api/auth/my-licenses', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyClient(request, reply);
    if (reply.sent) return;

    const { nomor } = (request as any).operator;
    try {
      const list = await prisma.license.findMany({
        where: {
          operatorPhone: { in: getPhoneVariants(nomor) },
          productId: 'easy-tunnel'
        },
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
    } catch (err: any) {
      console.error('[Get Licenses Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar lisensi: ' + err.message });
    }
  });

  // 4. Client Auth: Claim license
  fastify.post('/api/auth/claim-license', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyClient(request, reply);
    if (reply.sent) return;

    const { nomor } = (request as any).operator;
    const { license_key } = request.body as { license_key: string };
    if (!license_key) {
      return reply.status(400).send({ success: false, message: 'License key wajib diisi.' });
    }

    const cleanKey = license_key.trim();
    try {
      const license = await prisma.license.findUnique({
        where: { licenseKey: cleanKey }
      });

      if (!license || license.productId !== 'easy-tunnel') {
        return reply.status(404).send({ success: false, message: 'Kunci lisensi tidak ditemukan.' });
      }

      // Check if already claimed by someone else (not the same number in any format)
      if (license.operatorPhone && !getPhoneVariants(nomor).includes(license.operatorPhone)) {
        return reply.status(400).send({
          success: false,
          message: 'Kunci lisensi ini sudah diklaim oleh operator lain.'
        });
      }

      await prisma.license.update({
        where: { licenseKey: cleanKey },
        data: { operatorPhone: nomor }
      });

      return reply.send({
        success: true,
        message: 'Kunci lisensi berhasil diklaim dan dikaitkan dengan nomor Anda.'
      });
    } catch (err: any) {
      console.error('[Claim License Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal mengklaim lisensi: ' + err.message });
    }
  });

  // 5. Client Auth: Get my orders
  fastify.get('/api/auth/my-orders', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyClient(request, reply);
    if (reply.sent) return;

    const { nomor } = (request as any).operator;
    try {
      const invoices = await prisma.invoice.findMany({
        where: {
          license: {
            operatorPhone: { in: getPhoneVariants(nomor) },
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
        created_at: i.createdAt,
        payment_instructions: i.paymentInstructions
      }));
      return reply.send({ success: true, count: mapped.length, data: mapped });
    } catch (err: any) {
      console.error('[Get Orders Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar order: ' + err.message });
    }
  });

};
