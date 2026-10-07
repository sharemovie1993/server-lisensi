import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface QueryProductsBody {
  server_license_key: string;
  tenant_slug?: string;
  npsn?: string;
  deploy_scenario?: 'onpremise' | 'saas-local' | 'saas-public';
}

interface RebindTenantBody {
  target_host_key: string;
  source_host_key?: string;
  tenant_slug: string;
  npsn?: string;
  target_scenario: 'onpremise' | 'saas-local' | 'saas-public';
  source_scenario?: string;
  entitlement_keys?: string[];
}

export function registerTenantEntitlementRoutes(fastify: FastifyInstance) {
  /**
   * 1. POST /api/license/tenant/products
   * Mencari produk/lisensi yang dimiliki oleh tenant secara terotentikasi & terisolasi
   */
  fastify.post('/api/license/tenant/products', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as QueryProductsBody;
    const { server_license_key, tenant_slug, npsn, deploy_scenario } = body || {};

    if (!server_license_key || server_license_key.trim() === '') {
      return reply.status(401).send({
        success: false,
        message: 'Otorisasi server ditolak: server_license_key wajib disertakan.'
      });
    }

    try {
      // 1. Verifikasi Validitas Host Server Key
      const hostLicense = await prisma.license.findUnique({
        where: { licenseKey: server_license_key.trim() }
      });

      // Jika server key tidak ditemukan di DB License Server
      if (!hostLicense) {
        return reply.status(401).send({
          success: false,
          message: 'Server License Key tidak valid atau tidak terdaftar pada Server Lisensi.'
        });
      }

      const cleanSlug = tenant_slug ? tenant_slug.trim().toLowerCase() : '';
      const cleanNpsn = npsn ? npsn.trim() : '';

      // Tentukan kandidat slug (termasuk variasi ejaan th / t)
      const candidateSlugs = new Set<string>();
      if (cleanSlug) {
        candidateSlugs.add(cleanSlug);
        if (cleanSlug.endsWith('t')) candidateSlugs.add(`${cleanSlug}h`);
        if (cleanSlug.endsWith('th')) candidateSlugs.add(cleanSlug.slice(0, -1));
      }

      // 2. Query Lisensi Produk dengan Strict Multi-Tenant Scoping
      let whereClause: any = {};

      if (deploy_scenario === 'onpremise') {
        // Pada onpremise: 1 server = 1 tenant.
        // Cari lisensi yang bound ke server ini ATAU milik slug/npsn sekolah ini
        const orConditions: any[] = [
          { hostLicenseKey: server_license_key.trim() }
        ];
        if (candidateSlugs.size > 0) {
          orConditions.push({ requestedSlug: { in: Array.from(candidateSlugs) } });
        }
        if (cleanNpsn) {
          orConditions.push({ npsn: cleanNpsn });
        }
        whereClause = {
          productId: { not: 'cakola' }, // Hanya produk tenant (easy-tunnel, addons, dll)
          OR: orConditions
        };
      } else {
        // Pada saas-local & saas-public: Multi-tenant.
        // Wajib strictly scoped ke tenant_slug atau npsn tenant tersebut!
        if (candidateSlugs.size === 0 && !cleanNpsn) {
          return reply.send({ success: true, data: [] });
        }

        const orConditions: any[] = [];
        if (candidateSlugs.size > 0) {
          orConditions.push({ requestedSlug: { in: Array.from(candidateSlugs) } });
        }
        if (cleanNpsn) {
          orConditions.push({ npsn: cleanNpsn });
        }

        whereClause = {
          productId: { not: 'cakola' },
          OR: orConditions
        };
      }

      const licenses = await prisma.license.findMany({
        where: whereClause,
        include: { plan: true, product: true },
        orderBy: { createdAt: 'desc' }
      });

      const formatted = licenses.map((lic: any) => ({
        license_key: lic.licenseKey,
        product_id: lic.productId,
        product_name: lic.product?.name || lic.productId,
        package_title: lic.plan?.name || lic.schoolName || 'Paket Lisensi',
        school_name: lic.schoolName,
        subdomain: lic.requestedSlug || '',
        requested_slug: lic.requestedSlug || '',
        status: lic.status,
        is_active: lic.isActive,
        entitlement_status: lic.entitlementStatus || 'ACTIVE',
        expires_at: lic.expiresAt,
        local_port: lic.localPort || null,
        app_name: lic.appName || lic.schoolName || null,
        wireguard_ip: lic.wireguardIp || null
      }));

      return reply.send({
        success: true,
        data: formatted
      });
    } catch (err: any) {
      console.error('[Tenant Entitlements Query Error]', err.message);
      return reply.status(500).send({
        success: false,
        message: 'Gagal memeriksa produk lisensi tenant: ' + err.message
      });
    }
  });

  /**
   * 2. POST /api/license/tenant/rebind
   * Protokol Rekonsiliasi & Migrasi Dua Arah (On-Premise <-> SaaS)
   */
  fastify.post('/api/license/tenant/rebind', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as RebindTenantBody;
    const {
      target_host_key,
      source_host_key,
      tenant_slug,
      npsn,
      target_scenario,
      source_scenario,
      entitlement_keys = []
    } = body || {};

    if (!target_host_key || !tenant_slug || !target_scenario) {
      return reply.status(400).send({
        success: false,
        message: 'target_host_key, tenant_slug, dan target_scenario wajib diisi.'
      });
    }

    try {
      // 1. Verifikasi Host Tujuan
      const targetHost = await prisma.license.findUnique({
        where: { licenseKey: target_host_key.trim() }
      });
      if (!targetHost) {
        return reply.status(401).send({
          success: false,
          message: 'Target Host License Key tidak valid.'
        });
      }

      const cleanSlug = tenant_slug.trim().toLowerCase();
      const candidateSlugs = [cleanSlug];
      if (cleanSlug.endsWith('t')) candidateSlugs.push(`${cleanSlug}h`);
      if (cleanSlug.endsWith('th')) candidateSlugs.push(cleanSlug.slice(0, -1));

      // 2. Cari lisensi produk milik tenant tersebut
      const orConditions: any[] = [
        { requestedSlug: { in: candidateSlugs } }
      ];
      if (npsn && npsn.trim()) {
        orConditions.push({ npsn: npsn.trim() });
      }
      if (entitlement_keys.length > 0) {
        orConditions.push({ licenseKey: { in: entitlement_keys } });
      }

      const tenantLicenses = await prisma.license.findMany({
        where: {
          productId: { not: 'cakola' },
          OR: orConditions
        }
      });

      const updatedKeys: string[] = [];

      for (const lic of tenantLicenses) {
        let newEntitlementStatus = 'ACTIVE';

        // 🌟 ATURAN SKENARIO MIGRASI KHUSUS 🌟
        if (target_scenario === 'saas-public') {
          // Jika pindah ke Cloud VPS Publik: Easy Tunnel tidak dibutuhkan (diparkir)
          if (lic.productId === 'easy-tunnel') {
            newEntitlementStatus = 'PARKED_CLOUD';
          }
        } else {
          // Jika pindah ke On-Premise atau SaaS-Local: Easy Tunnel diaktifkan kembali
          newEntitlementStatus = 'ACTIVE';
        }

        await prisma.license.update({
          where: { id: lic.id },
          data: {
            hostLicenseKey: target_host_key.trim(),
            entitlementStatus: newEntitlementStatus,
            requestedSlug: lic.requestedSlug || cleanSlug,
            npsn: lic.npsn || npsn || null
          }
        });

        updatedKeys.push(lic.licenseKey);
      }

      // 3. Catat Riwayat Migrasi ke Audit Log
      await prisma.tenantMigrationLog.create({
        data: {
          tenantSlug: cleanSlug,
          npsn: npsn || null,
          sourceHostKey: source_host_key || null,
          targetHostKey: target_host_key.trim(),
          sourceScenario: source_scenario || null,
          targetScenario: target_scenario,
          licenseKeysJson: updatedKeys,
          action: target_scenario === 'saas-public' ? 'PARK_CLOUD' : (source_scenario === 'saas-public' ? 'UNPARK_LOCAL' : 'REBIND'),
          ipAddress: request.ip
        }
      });

      return reply.send({
        success: true,
        message: `Berhasil merekonsiliasi ${updatedKeys.length} lisensi untuk tenant ${cleanSlug}.`,
        data: {
          rebound_count: updatedKeys.length,
          rebound_keys: updatedKeys,
          target_scenario: target_scenario
        }
      });
    } catch (err: any) {
      console.error('[Tenant Entitlements Rebind Error]', err.message);
      return reply.status(500).send({
        success: false,
        message: 'Gagal melakukan re-binding lisensi: ' + err.message
      });
    }
  });
}
