import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { prisma, normalizeProductId } from '../license/helpers';
import { verifyAdmin } from './middleware';
import { triggerCaddySync } from '../../services/caddy.service';
import { getSetting } from '../../config/settings.service';
import { waGateway } from '../../services/whatsapp.service';
import { logLicenseActivity } from '../../utils/logger';

export const registerTenantRoutes = (fastify: FastifyInstance) => {
  // GET /api/admin/tenants (List active tenants with modules and schools)
  fastify.get('/api/admin/tenants', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const [list, subscriptions, paidInvoices] = await Promise.all([
        prisma.license.findMany({
          include: {
            activatedDevices: true
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.subscription.findMany({
          where: { status: 'active' },
          select: { licenseId: true, productId: true, schoolName: true }
        }),
        prisma.invoice.findMany({
          where: { status: { in: ['paid', 'PAID'] } },
          select: { licenseId: true }
        })
      ]);

      const paidLicenseIds = new Set(paidInvoices.map(inv => inv.licenseId));

      const subscriptionMap = new Map<string, { productId: string, name: string, subdomain: string | null }[]>();
      for (const sub of subscriptions) {
        if (!subscriptionMap.has(sub.licenseId)) {
          subscriptionMap.set(sub.licenseId, []);
        }
        const parts = sub.schoolName.split('|');
        subscriptionMap.get(sub.licenseId)!.push({
          productId: sub.productId,
          name: parts[0].trim(),
          subdomain: parts[1] ? parts[1].trim() : null
        });
      }

      const enrichedTenants = list.map(t => {
        const licenseSubs = subscriptionMap.get(t.id) || [];
        const seen = new Set<string>();
        const uniqueSchools: { name: string; subdomain: string | null }[] = [];
        
        for (const s of licenseSubs) {
          if (!s.name || seen.has(s.name)) continue;
          seen.add(s.name);
          uniqueSchools.push({ name: s.name, subdomain: s.subdomain });
        }

        const modules = licenseSubs.map(s => s.productId);
        const isTrial = !paidLicenseIds.has(t.id);

        return {
          id: t.id,
          name: t.schoolName,
          schoolName: t.schoolName,
          domain_or_slug: t.requestedSlug,
          requestedSlug: t.requestedSlug,
          license_key: t.licenseKey,
          licenseKey: t.licenseKey,
          created_at: t.createdAt,
          createdAt: t.createdAt,
          isActive: t.isActive,
          status: t.status,
          is_trial: isTrial,
          productId: normalizeProductId(t.productId),
          custom_domain: t.customDomain,
          lastHeartbeatAt: t.lastHeartbeatAt,
          deployMode: t.deployMode,
          wireguardIp: t.wireguardIp,
          activeUsers: t.activeUsers,
          dbSize: t.dbSize,
          memoryUsage: t.memoryUsage,
          lastTapped: t.lastTapped,
          hostname: t.activeHostname,
          osType: t.activeOs,
          modules: modules,
          schools: uniqueSchools.length > 0 ? uniqueSchools : [{ name: t.schoolName, subdomain: t.requestedSlug || null }],
          activeDevices: t.activatedDevices.length,
          activatedDevices: t.activatedDevices.map(d => ({
            id: d.id,
            deviceId: d.deviceId,
            activatedAt: d.activatedAt.toISOString()
          })),
          license_details: {
            status: t.status,
            expires_at: t.expiresAt,
            is_active: t.isActive
          }
        };
      });

      return reply.send({ success: true, count: enrichedTenants.length, data: enrichedTenants });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar tenant: ' + err.message });
    }
  });

  // POST /api/admin/tenants (Manual tenant/school registration - frontend compatibility)
  fastify.post('/api/admin/tenants', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    const { 
      schoolName, 
      requestedSlug, 
      packageId,
      licenseKey,
      nodeType,
      deployMode,
      deviceLimit,
      isUnlimited,
      expiresAt,
      planId
    } = request.body as any;

    if (!schoolName) {
      return reply.status(400).send({ success: false, message: 'Nama server / sekolah wajib diisi.' });
    }

    try {
      const targetProductId = normalizeProductId(packageId || 'cakola');
      const product = await prisma.product.findUnique({ where: { id: targetProductId } });
      if (!product) {
        return reply.status(404).send({ success: false, message: `Produk ${targetProductId} tidak ditemukan.` });
      }

      const generateKey = (prefix: string) => {
        const rand = crypto.randomBytes(8).toString('hex').toUpperCase();
        return `${prefix}-${rand.slice(0, 4)}-${rand.slice(4, 8)}-${rand.slice(8, 12)}`;
      };

      let key = (licenseKey || '').trim().toUpperCase();
      if (key) {
        const existingKey = await prisma.license.findUnique({ where: { licenseKey: key } });
        if (existingKey) {
          return reply.status(400).send({ 
            success: false, 
            message: `License key ${key} sudah terdaftar di database Server Lisensi.` 
          });
        }
      } else {
        key = generateKey(product.prefix);
      }

      // Default expired 1 tahun jika tidak ditentukan
      const defaultExpires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const effectiveExpires = expiresAt || defaultExpires;

      const effectiveNodeType = nodeType || 'SERVER_ONPREMISE';
      const effectiveDeployMode = deployMode || (effectiveNodeType === 'SERVER_SAAS' ? 'saas' : 'local');
      const effectiveDeviceLimit = Number(deviceLimit) || 1200;
      const effectiveIsUnlimited = isUnlimited ? 1 : (effectiveDeviceLimit >= 99999 ? 1 : 0);

      const license = await prisma.license.create({
        data: {
          licenseKey: key,
          productId: targetProductId,
          schoolName: schoolName.trim(),
          deviceLimit: effectiveDeviceLimit,
          isUnlimited: effectiveIsUnlimited,
          expiresAt: effectiveExpires,
          status: 'active',
          isActive: 1,
          requestedSlug: requestedSlug ? requestedSlug.trim().toLowerCase() : null,
          nodeType: effectiveNodeType,
          deployMode: effectiveDeployMode,
          planId: planId || (effectiveNodeType === 'SERVER_SAAS' ? 'SW_SAAS_ENTERPRISE' : 'SW_ONPREM_ENTERPRISE'),
          hostLicenseKey: null, // Host Server Appliance adalah root server
        }
      });

      // Seed dynamic routing configuration if slug exists
      if (requestedSlug) {
        await triggerCaddySync().catch(() => {});
      }

      return reply.status(201).send({
        success: true,
        message: 'Lisensi Server / Node Appliance berhasil didaftarkan.',
        data: license
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal mendaftarkan lisensi: ' + err.message });
    }
  });

  // GET /api/admin/nodes (Get active infrastructure server & tunnel nodes)
  fastify.get('/api/admin/nodes', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      // 1. Ambil Server Host Appliance (hostLicenseKey null) ATAU lisensi Easy Tunnel
      const list = await prisma.license.findMany({
        where: {
          OR: [
            { productId: 'cakola', hostLicenseKey: null },
            { productId: 'easy-tunnel' }
          ]
        },
        include: {
          activatedDevices: true,
          subscriptions: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // 2. Ambil seluruh lisensi anak (child licenses) yang menumpang di server host ini
      const childLicenses = await prisma.license.findMany({
        where: {
          hostLicenseKey: { not: null }
        },
        select: {
          hostLicenseKey: true,
          schoolName: true,
          requestedSlug: true,
          productId: true
        }
      });

      // Buat pemetaan child licenses per hostLicenseKey
      const childLicensesByHost = new Map<string, { schoolName: string; requestedSlug: string | null }[]>();
      for (const cl of childLicenses) {
        if (!cl.hostLicenseKey) continue;
        if (!childLicensesByHost.has(cl.hostLicenseKey)) {
          childLicensesByHost.set(cl.hostLicenseKey, []);
        }
        childLicensesByHost.get(cl.hostLicenseKey)!.push({
          schoolName: cl.schoolName,
          requestedSlug: cl.requestedSlug
        });
      }

      const mapped = list.map(t => {
        const hostedTenants: { name: string; slug: string | null }[] = [];

        // Sumber 1: Ambil dari subscriptions yang dikirim langsung oleh Heartbeat telemetri node ini
        if (t.subscriptions && Array.isArray(t.subscriptions)) {
          for (const sub of t.subscriptions) {
            if (!sub.schoolName) continue;
            const parts = sub.schoolName.split('|');
            const name = parts[0].trim();
            const slug = parts[1] ? parts[1].trim().toLowerCase() : null;

            if (name.toLowerCase().startsWith('saas node') || name.toLowerCase().startsWith('server host')) continue;

            if (!hostedTenants.some(h => (slug && h.slug === slug) || h.name.toLowerCase() === name.toLowerCase())) {
              hostedTenants.push({ name, slug });
            }
          }
        }

        // Sumber 2: Ambil dari child licenses yang terikat ke hostLicenseKey ini (cakola maupun easy-tunnel)
        const childs = t.licenseKey ? (childLicensesByHost.get(t.licenseKey) || []) : [];
        for (const cl of childs) {
          const parts = cl.schoolName.split('|');
          const name = parts[0].trim();
          const slug = cl.requestedSlug ? cl.requestedSlug.trim().toLowerCase() : (parts[1] ? parts[1].trim().toLowerCase() : null);

          if (name.toLowerCase().startsWith('saas node') || name.toLowerCase().startsWith('server host')) continue;

          const existingIdx = hostedTenants.findIndex(h => (slug && h.slug === slug) || h.name.toLowerCase() === name.toLowerCase());
          if (existingIdx >= 0) {
            if (!hostedTenants[existingIdx].slug && slug) {
              hostedTenants[existingIdx].slug = slug;
            }
          } else {
            hostedTenants.push({ name, slug });
          }
        }

        const isTunnel = t.productId === 'easy-tunnel';
        const effectiveNodeType = isTunnel ? 'TUNNEL' : (t.nodeType || 'SERVER_SAAS');

        // Sinkronkan Nama Server / Header secara dinamis:
        let displayName = t.schoolName;
        if (!isTunnel && t.schoolName.includes('|')) {
          displayName = t.schoolName.split('|')[0].trim();
        }

        // Jika server menampung tenant, sesuaikan angka di judul kartu secara otomatis
        if (hostedTenants.length > 0) {
          if (displayName.toLowerCase().startsWith('saas node') || displayName.includes('Tenant')) {
            displayName = `SaaS Node (${hostedTenants.length} Tenant)`;
          }
        }

        return {
          id: t.id,
          schoolName: displayName,
          requestedSlug: t.requestedSlug,
          licenseKey: t.licenseKey,
          productId: t.productId,
          nodeType: effectiveNodeType,
          status: t.status,
          lastHeartbeatAt: t.lastHeartbeatAt,
          deployMode: t.deployMode,
          activeUsers: t.activeUsers,
          dbSize: t.dbSize,
          memoryUsage: t.memoryUsage,
          lastTapped: t.lastTapped,
          wireguardIp: t.wireguardIp,
          is_trial: t.status === 'active' && t.isActive === 1 && !t.planId,
          hostname: t.activeHostname,
          osType: t.activeOs,
          activeDevices: t.activatedDevices.length,
          hostedTenantsCount: hostedTenants.length,
          hostedTenants: hostedTenants,
          createdAt: t.createdAt
        };
      });

      return reply.send({ success: true, count: mapped.length, data: mapped });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar server node: ' + err.message });
    }
  });

  // POST /api/license/generate (Generate new license key manually)
  fastify.post('/api/license/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    const { school_name, device_limit, expires_at, product_id, is_unlimited, requested_slug, include_vpn, wireguard_ip } = request.body as any;

    if (!school_name || !product_id || !expires_at) {
      return reply.status(400).send({ success: false, message: 'Parameter school_name, product_id, dan expires_at wajib diisi.' });
    }

    try {
      const targetProductId = normalizeProductId(product_id);
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

  // GET /api/license/list (List all licenses)
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
        product_id: normalizeProductId(l.productId),
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

  // POST /api/license/approve/:id (Approve license manually)
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

      if (license.productId !== 'privateer') {
        await triggerCaddySync();
      }

      return reply.send({
        success: true,
        message: `Lisensi untuk ${license.schoolName} berhasil disetujui!`
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal menyetujui lisensi.' });
    }
  });

  // DELETE /api/license/delete/:id (Delete license key)
  fastify.delete('/api/license/delete/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    const { id } = request.params as { id: string };

    try {
      const license = await prisma.license.findUnique({ where: { id } });
      if (license) {
        await prisma.activityLog.deleteMany({ where: { licenseKey: license.licenseKey } });
        await prisma.subscription.deleteMany({ where: { licenseId: id } });
        await prisma.invoice.deleteMany({ where: { licenseId: id } });
        await prisma.activatedDevice.deleteMany({ where: { licenseId: id } });
        await prisma.license.delete({ where: { id } });

        if (license.productId !== 'privateer') {
          await triggerCaddySync();
        }
      }

      return reply.send({ success: true, message: 'Lisensi berhasil dibersihkan dari server secara permanen.' });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal menghapus lisensi.' });
    }
  });

  // POST /api/admin/license/reset-devices/:id (Reset device lock/HWID)
  fastify.post('/api/admin/license/reset-devices/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    const { id } = request.params as { id: string };

    try {
      const license = await prisma.license.findUnique({ where: { id } });
      if (!license) {
        return reply.status(404).send({ success: false, message: 'Lisensi tidak ditemukan.' });
      }

      await prisma.activatedDevice.deleteMany({
        where: { licenseId: id }
      });

      await prisma.license.update({
        where: { id },
        data: {
          activeHostname: null,
          activeOs: null,
          originalDeviceId: null
        }
      });

      console.log(`[Admin License Reset] Reset devices/hosts lock for license: ${license.licenseKey} by admin`);

      return reply.send({ success: true, message: 'Kunci perangkat (device lock) berhasil dilepas oleh admin.' });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal melepas kunci perangkat: ' + err.message });
    }
  });

  // POST /api/admin/license/resend-wa/:id (Resend license details via WA)
  fastify.post('/api/admin/license/resend-wa/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    const { id } = request.params as { id: string };

    try {
      const license = await prisma.license.findUnique({ where: { id } });
      if (!license) {
        return reply.status(404).send({ success: false, message: 'Lisensi tidak ditemukan.' });
      }

      if (!license.operatorPhone) {
        return reply.status(400).send({ success: false, message: 'Nomor WhatsApp operator tidak terdaftar di lisensi ini.' });
      }

      const cleanWaNumber = license.operatorPhone.trim();
      const cleanSchoolName = license.schoolName.trim();
      const cleanSlug = license.requestedSlug ? license.requestedSlug.trim().toLowerCase() : '';
      const newKey = license.licenseKey;

      const dbMainDomain = await getSetting('main_domain', 'absenta.id');
      const waMessage = `🟢 *[AKTIVASI LISENSI LOKAL PLATFORM CAKOLA SUCCESS]*\n\n` +
        `Yth. Operator *${cleanSchoolName}*,\n` +
        `Selamat! Proses registrasi server dan pemasangan Platform Cakola untuk sekolah Anda telah berhasil diselesaikan secara sempurna.\n\n` +
        `Berikut adalah detail lisensi dan akses Anda:\n` +
        `🔑 Kunci Lisensi: \`${newKey}\`\n` +
        `🌐 Subdomain Akses Online: *https://${cleanSlug}.${dbMainDomain}*\n` +
        `📅 Status Lisensi: *AKTIF*\n\n` +
        `*Catatan Penting*:\n` +
        `- *Akses Online (Easy-Tunnel)*: Sudah aktif secara otomatis. Aplikasi dapat langsung diakses dari internet luar melalui tautan domain di atas.\n` +
        `- *Akses Lokal (Intranet)*: Dapat diakses menggunakan IP lokal server atau pengaturan Split DNS di jaringan internal sekolah.\n` +
        `- *Langkah Selanjutnya*: Buka tautan domain sekolah Anda di atas, lalu masuk menu *Daftar Sekolah / Registrasi Sekolah* untuk membuat akun Administrator utama sekolah Anda.\n\n` +
        `Simpan pesan ini sebagai bukti catatan lisensi Anda. Terima kasih!`;

      await waGateway.sendMessage(cleanWaNumber, waMessage, 'MANUAL_RESEND', license.productId);
      await logLicenseActivity(newKey, license.productId, request.ip, 'WA_RESEND_LICENSE_SUCCESS');

      return reply.send({ success: true, message: 'Data lisensi berhasil dikirim ulang ke nomor WhatsApp operator!' });
    } catch (err: any) {
      console.error('[Admin License Resend WA Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal mengirim ulang WhatsApp: ' + err.message });
    }
  });
};
