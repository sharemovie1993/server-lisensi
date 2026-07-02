import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { verifyTOTP } from '../utils/totp';
import { waGateway } from '../services/whatsapp.service';
import { triggerCaddySync } from '../services/caddy.service';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'kumahatetehwe';
const TOTP_SECRET = process.env.TOTP_SECRET || 'ABSENTASECRETKEYMYSECURETOKEN';

// Middleware helper to check admin authentication
async function verifyAdmin(request: FastifyRequest, reply: FastifyReply) {
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

export const adminRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

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

  // 2. Get registered products
  fastify.get('/api/admin/products', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const list = await prisma.product.findMany({
        where: { id: { not: 'platform-absenta' } },
        orderBy: { name: 'asc' }
      });
      return reply.send({ success: true, data: list });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar produk.' });
    }
  });

  // 3. Get active tenants (licenses with slugs)
  fastify.get('/api/admin/tenants', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const list = await prisma.license.findMany({
        where: {
          requestedSlug: { not: null }
        },
        orderBy: { createdAt: 'desc' }
      });

      const enrichedTenants = list.map(t => ({
        id: t.id,
        name: t.schoolName,
        domain_or_slug: t.requestedSlug,
        license_key: t.licenseKey,
        created_at: t.createdAt,
        is_active: t.isActive,
        custom_domain: null,
        license_details: {
          status: t.status,
          expires_at: t.expiresAt,
          is_active: t.isActive
        }
      }));

      return reply.send({ success: true, count: enrichedTenants.length, data: enrichedTenants });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar tenant: ' + err.message });
    }
  });

  // 4. Generate new license manually
  fastify.post('/api/license/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    const { school_name, device_limit, expires_at, product_id, is_unlimited, requested_slug, include_vpn, wireguard_ip } = request.body as any;

    if (!school_name || !product_id || !expires_at) {
      return reply.status(400).send({ success: false, message: 'Parameter school_name, product_id, dan expires_at wajib diisi.' });
    }

    try {
      let targetProductId = product_id;
      if (product_id === 'absenta') {
        targetProductId = 'platform-absenta';
      }

      const product = await prisma.product.findUnique({ where: { id: targetProductId } });
      if (!product) {
        return reply.status(404).send({ success: false, message: 'Produk tidak ditemukan.' });
      }

      const generateKey = (prefix: string) => {
        const rand = crypto.randomBytes(8).toString('hex').toUpperCase();
        return `${prefix}-${rand.slice(0, 4)}-${rand.slice(4, 8)}-${rand.slice(8, 12)}`;
      };

      const key = generateKey(product.prefix);

      const license = await prisma.license.create({
        data: {
          licenseKey: key,
          productId: targetProductId,
          schoolName: school_name.trim(),
          deviceLimit: device_limit || 0,
          isUnlimited: is_unlimited ? 1 : 0,
          expiresAt: expires_at,
          status: 'active',
          isActive: 1,
          requestedSlug: requested_slug ? requested_slug.trim().toLowerCase() : null,
          includeVpn: include_vpn ? 1 : 0,
          wireguardIp: wireguard_ip || null
        }
      });

      // Seed dynamic routing configuration if slug exists
      if (requested_slug) {
        await triggerCaddySync();
      }

      return reply.send({
        success: true,
        message: 'Lisensi berhasil digenerate secara manual.',
        data: license
      });

    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal generate lisensi: ' + err.message });
    }
  });

  // 5. Get list of all licenses
  fastify.get('/api/license/list', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const list = await prisma.license.findMany({
        orderBy: { createdAt: 'desc' }
      });
      const mapped = list.map(l => ({
        id: l.id,
        license_key: l.licenseKey,
        product_id: l.productId === 'platform-absenta' ? 'absenta' : l.productId,
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
        created_at: l.createdAt
      }));
      return reply.send({ success: true, data: mapped });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal memuat daftar lisensi.' });
    }
  });

  // 6. Get Activity Logs
  fastify.get('/api/admin/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const list = await prisma.activityLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 300
      });
      return reply.send({ success: true, data: list });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal mengambil riwayat logs.' });
    }
  });

  // 7. Get total revenue stats
  fastify.get('/api/admin/revenue', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const paidInvoices = await prisma.invoice.findMany({
        where: { status: 'paid' }
      });

      const total = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
      return reply.send({
        success: true,
        data: {
          total_revenue: total,
          formatted_revenue: `Rp ${total.toLocaleString('id-ID')}`
        }
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal mengambil laporan pendapatan.' });
    }
  });

  // 8. Get all invoices
  fastify.get('/api/admin/invoices', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const list = await prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' }
      });

      const mapped = list.map(i => ({
        id: i.id,
        invoice_number: i.invoiceNumber,
        license_id: i.licenseId,
        school_name: i.schoolName,
        product_id: i.productId === 'platform-absenta' ? 'absenta' : i.productId,
        plan_title: i.planTitle,
        amount: i.amount,
        status: i.status,
        payment_method: i.paymentMethod,
        expired_time: i.expiredTime,
        paid_at: i.paidAt ? i.paidAt.toISOString() : null,
        created_at: i.createdAt
      }));

      return reply.send({ success: true, data: mapped });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar invoice.' });
    }
  });

  // 9. Get all subscriptions
  fastify.get('/api/admin/subscriptions', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const list = await prisma.subscription.findMany({
        orderBy: { id: 'desc' }
      });
      const mapped = list.map(s => ({
        id: s.id,
        license_id: s.licenseId,
        school_name: s.schoolName,
        product_id: s.productId === 'platform-absenta' ? 'absenta' : s.productId,
        plan_id: s.planId,
        status: s.status,
        start_date: s.startDate,
        end_date: s.endDate,
        created_at: s.createdAt
      }));
      return reply.send({ success: true, data: mapped });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar langganan.' });
    }
  });

  // 10. Manually mark invoice as paid
  fastify.post('/api/admin/invoices/pay/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    const { id } = request.params as { id: string };

    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: id }
      });

      if (!invoice) {
        return reply.status(404).send({ success: false, message: 'Invoice tidak ditemukan.' });
      }

      await prisma.invoice.update({
        where: { id: id },
        data: { status: 'paid', paidAt: new Date() }
      });

      // Update license status
      await prisma.license.update({
        where: { id: invoice.licenseId },
        data: { status: 'active', isActive: 1 }
      });

      // Update subscriptions status
      await prisma.subscription.updateMany({
        where: { licenseId: invoice.licenseId },
        data: { status: 'active' }
      });

      await triggerCaddySync();

      return reply.send({ success: true, message: 'Invoice berhasil dikonfirmasi lunas secara manual!' });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal mengonfirmasi invoice.' });
    }
  });

  // 11. Approve license manually
  fastify.post('/api/license/approve/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    const { id } = request.params as { id: string };

    try {
      const license = await prisma.license.findUnique({ where: { id } });
      if (!license) {
        return reply.status(404).send({ success: false, message: 'Lisensi tidak ditemukan.' });
      }

      await prisma.license.update({
        where: { id },
        data: { status: 'active', isActive: 1 }
      });

      await prisma.subscription.updateMany({
        where: { licenseId: id },
        data: { status: 'active' }
      });

      await triggerCaddySync();

      return reply.send({
        success: true,
        message: `Lisensi untuk ${license.schoolName} berhasil disetujui!`
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal menyetujui lisensi.' });
    }
  });

  // 12. Delete or deactivate license key
  fastify.delete('/api/license/delete/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    const { id } = request.params as { id: string };

    try {
      const license = await prisma.license.findUnique({ where: { id } });
      if (license) {
        // Cascading deletion
        await prisma.subscription.deleteMany({ where: { licenseId: id } });
        await prisma.invoice.deleteMany({ where: { licenseId: id } });
        await prisma.license.delete({ where: { id } });

        await triggerCaddySync();
      }

      return reply.send({ success: true, message: 'Lisensi berhasil dibersihkan dari server secara permanen.' });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal menghapus lisensi.' });
    }
  });

  // 13. Get system settings
  fastify.get('/api/admin/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const list = await prisma.systemSetting.findMany();
      const settings: Record<string, string> = {};
      list.forEach(row => {
        settings[row.key] = row.value;
      });
      return reply.send({ success: true, data: settings });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal mengambil pengaturan sistem.' });
    }
  });

  // 14. Update system settings
  fastify.post('/api/admin/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    const body = request.body as Record<string, string>;

    try {
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== null) {
          await prisma.systemSetting.upsert({
            where: { key },
            update: { value: String(value).trim() },
            create: { key, value: String(value).trim() }
          });
        }
      }

      return reply.send({ success: true, message: 'Pengaturan sistem berhasil diperbarui!' });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal memperbarui pengaturan sistem.' });
    }
  });

  // 15. GET /api/public/validate-domain (Public check for Caddy on-demand TLS)
  fastify.get('/api/public/validate-domain', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { domain?: string };
    const domain = query.domain;
    if (!domain) {
      return reply.status(400).send('Domain parameter required');
    }

    const cleanDomain = domain.trim().toLowerCase();
    const MAIN_DOMAIN = (process.env.MAIN_DOMAIN || 'absenta.id').toLowerCase();

    // 1. Allow main domain and its platform subdomains
    if (cleanDomain === MAIN_DOMAIN || cleanDomain === `www.${MAIN_DOMAIN}` || cleanDomain === `api.${MAIN_DOMAIN}`) {
      return reply.status(200).send('OK');
    }

    // 2. Allow registered active platform subdomains (*.absenta.id)
    if (cleanDomain.endsWith(`.${MAIN_DOMAIN}`)) {
      const slug = cleanDomain.replace(`.${MAIN_DOMAIN}`, '');
      try {
        const lic = await prisma.license.findFirst({
          where: { requestedSlug: slug, isActive: 1 }
        });
        if (lic) {
          return reply.status(200).send('OK');
        }
      } catch (e) {}
    }

    // 3. Allow registered active custom domains (e.g. absensi.tefatjkt.net)
    try {
      const lic = await prisma.license.findFirst({
        where: { customDomain: cleanDomain, isActive: 1 }
      });
      if (lic) {
        return reply.status(200).send('OK');
      }
    } catch (e) {}

    return reply.status(404).send('Domain not found or inactive');
  });

  // 15b. GET /api/public/release/check (Public check for latest product releases)
  fastify.get('/api/public/release/check', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const manifestPath = path.join(__dirname, '../../public/releases/manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifestContent = fs.readFileSync(manifestPath, 'utf8');
        const manifest = JSON.parse(manifestContent);
        return reply.send({
          success: true,
          ...manifest
        });
      } else {
        return reply.status(404).send({
          success: false,
          message: 'Release manifest not found'
        });
      }
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        message: 'Failed to read release manifest: ' + err.message
      });
    }
  });



  // 16. Restart server (PM2 command)
  fastify.post('/api/admin/restart', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    reply.send({ success: true, message: 'Menginisialisasi restart server lisensi dalam 1 detik...' });

    setTimeout(() => {
      console.log('[Admin Command] Restarting process via PM2...');
      exec('pm2 restart licensing-server');
    }, 1000);
  });

  // 17. WhatsApp status
  fastify.get('/api/admin/wa/status', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    return reply.send({ success: true, data: waGateway.getStatus() });
  });

  // 18. WhatsApp QR
  fastify.get('/api/admin/wa/qr', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    const qrBase64 = waGateway.getQRBase64();
    return reply.send({ success: true, qr: qrBase64 });
  });

  // 19. WhatsApp Reconnect
  fastify.post('/api/admin/wa/reconnect', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    waGateway.reconnect().catch(err => console.error('[WA Reconnect Error]', err.message));
    return reply.send({ success: true, message: 'WhatsApp sedang di-reset dan menghubungkan kembali...' });
  });

  // 20. WhatsApp Send Test Message
  fastify.post('/api/admin/wa/send-test', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    const { number, message } = request.body as { number: string; message: string };
    if (!number || !message) {
      return reply.status(400).send({ success: false, message: 'Nomor dan pesan wajib diisi.' });
    }

    try {
      await waGateway.sendMessage(number, message);
      return reply.send({ success: true, message: 'Pesan test berhasil dikirim.' });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal mengirim pesan test: ' + err.message });
    }
  });

  // 21. GET /api/admin/caddy/status
  fastify.get('/api/admin/caddy/status', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    const checkCmd = process.platform === 'linux' ? 'systemctl is-active caddy' : 'echo active';

    return new Promise((resolve) => {
      exec(checkCmd, (err, stdout) => {
        const isActive = !err && stdout.trim() === 'active';
        let caddyfileContent = '';
        try {
          const caddyPath = process.platform === 'linux' ? '/etc/caddy/Caddyfile' : path.join(__dirname, '../../Caddyfile.generated');
          if (fs.existsSync(caddyPath)) {
            caddyfileContent = fs.readFileSync(caddyPath, 'utf8');
          }
        } catch (e) {}

        resolve(reply.send({
          success: true,
          status: isActive ? 'online' : 'offline',
          caddyfile: caddyfileContent
        }));
      });
    });
  });

  // 22. POST /api/admin/caddy/sync
  fastify.post('/api/admin/caddy/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      await triggerCaddySync();
      return reply.send({ success: true, message: 'Sinkronisasi konfigurasi Caddy berhasil dan Caddy telah dimuat ulang.' });
    } catch (err: any) {
      console.error('[Caddy Sync API] Manual sync failed:', err.message);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

};
