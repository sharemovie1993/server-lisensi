import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fs from 'fs';
import path from 'path';
import { prisma } from '../license/helpers';
import { getSetting } from '../../config/settings.service';

export const registerPublicRoutes = (fastify: FastifyInstance) => {
  // GET /api/public/validate-domain (Public check for Caddy on-demand TLS)
  fastify.get('/api/public/validate-domain', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { domain?: string };
    const domain = query.domain;
    if (!domain) {
      return reply.status(400).send('Domain parameter required');
    }

    const cleanDomain = domain.trim().toLowerCase();
    const dbMainDomain = await getSetting('main_domain', 'absenta.id');
    const MAIN_DOMAIN = (process.env.MAIN_DOMAIN || dbMainDomain).toLowerCase();

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

  // GET /api/public/release/check (Public check for latest product releases)
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

  // GET /api/public/tenant-status (Public status check for tenant server online/offline)
  fastify.get('/api/public/tenant-status', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { domain?: string; slug?: string };
    const rawDomain = query.domain?.trim().toLowerCase();
    let rawSlug = query.slug?.trim().toLowerCase();

    const dbMainDomain = await getSetting('main_domain', 'absenta.id');
    const MAIN_DOMAIN = (process.env.MAIN_DOMAIN || dbMainDomain).toLowerCase();

    if (!rawSlug && rawDomain) {
      if (rawDomain.endsWith(`.${MAIN_DOMAIN}`)) {
        rawSlug = rawDomain.replace(`.${MAIN_DOMAIN}`, '').split('.')[0];
      } else {
        rawSlug = rawDomain.split('.')[0];
      }
    }

    if (!rawSlug) {
      return reply.status(400).send({
        success: false,
        message: 'Parameter slug atau domain wajib disertakan'
      });
    }

    const cleanSlug = rawSlug.trim().toLowerCase();

    try {
      // 1. Search in Subscription (SaaS multi-tenant node)
      const subCandidates = await prisma.subscription.findMany({
        where: {
          schoolName: { contains: `|${cleanSlug}` }
        },
        include: { license: true }
      });

      // 2. Search in License directly (On-premise single appliance or easy-tunnel license)
      const licConditions: any[] = [
        { requestedSlug: cleanSlug }
      ];
      if (rawDomain) {
        licConditions.push({ customDomain: rawDomain });
      }
      licConditions.push({ customDomain: cleanSlug });

      const licCandidates = await prisma.license.findMany({
        where: {
          OR: licConditions
        },
        include: { subscriptions: true }
      });

      type Candidate = {
        schoolName: string;
        lastHeartbeatAt: Date | null;
        wireguardIp: string | null;
        deployMode: string | null;
        nodeType: string;
        isActive: number;
      };

      const candidates: Candidate[] = [];

      for (const sub of subCandidates) {
        const parts = sub.schoolName.split('|');
        const extractedName = parts[0]?.trim() || sub.license?.schoolName || cleanSlug;
        const subSlug = parts[1]?.trim().toLowerCase();
        if (subSlug === cleanSlug) {
          candidates.push({
            schoolName: extractedName,
            lastHeartbeatAt: sub.license?.lastHeartbeatAt ? new Date(sub.license.lastHeartbeatAt) : null,
            wireguardIp: sub.license?.wireguardIp || null,
            deployMode: sub.license?.deployMode || null,
            nodeType: sub.license?.nodeType || 'SERVER_SAAS',
            isActive: sub.license?.isActive ?? 1
          });
        }
      }

      for (const lic of licCandidates) {
        candidates.push({
          schoolName: lic.schoolName || cleanSlug,
          lastHeartbeatAt: lic.lastHeartbeatAt ? new Date(lic.lastHeartbeatAt) : null,
          wireguardIp: lic.wireguardIp || null,
          deployMode: lic.deployMode || null,
          nodeType: lic.nodeType || 'SERVER_ONPREMISE',
          isActive: lic.isActive
        });
      }

      if (candidates.length === 0) {
        return reply.status(200).send({
          success: true,
          found: false,
          slug: cleanSlug,
          domain: rawDomain || `${cleanSlug}.${MAIN_DOMAIN}`,
          message: `Tenant dengan subdomain '${cleanSlug}' belum terdaftar di Server Lisensi.`
        });
      }

      // Sort candidates by lastHeartbeatAt descending (most recent first)
      candidates.sort((a, b) => {
        const timeA = a.lastHeartbeatAt ? a.lastHeartbeatAt.getTime() : 0;
        const timeB = b.lastHeartbeatAt ? b.lastHeartbeatAt.getTime() : 0;
        return timeB - timeA;
      });

      const best = candidates[0];
      const now = Date.now();
      const lastHbTime = best.lastHeartbeatAt ? best.lastHeartbeatAt.getTime() : null;
      const ageMs = lastHbTime ? (now - lastHbTime) : null;
      const ageSeconds = ageMs !== null ? Math.max(0, Math.floor(ageMs / 1000)) : null;

      // Online threshold: heartbeat received within 5 minutes (300 seconds)
      const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
      const isOnline = ageMs !== null && ageMs <= ONLINE_THRESHOLD_MS;
      const serverStatus = isOnline ? 'ONLINE' : 'OFFLINE';

      const formatHeartbeatAgo = (diffMs: number): string => {
        const sec = Math.floor(diffMs / 1000);
        if (sec < 60) return `${sec} detik yang lalu`;
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min} menit yang lalu`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr} jam yang lalu`;
        const dy = Math.floor(hr / 24);
        return `${dy} hari yang lalu`;
      };

      const formatDeployMode = (mode?: string | null): string => {
        switch (mode?.toLowerCase()) {
          case 'saas-local':
            return 'SaaS Local (Home-Lab / Broadband)';
          case 'saas-public':
          case 'saas':
            return 'SaaS Public (Cloud Server)';
          case 'onpremise':
            return 'On-Premise (Server Sekolah)';
          default:
            return mode || 'Standar';
        }
      };

      let lastHeartbeatHuman = 'Belum pernah terdeteksi';
      if (ageMs !== null) {
        lastHeartbeatHuman = formatHeartbeatAgo(ageMs);
      }

      const easyTunnelConnected = !!best.wireguardIp;

      let explanation = '';
      if (isOnline) {
        explanation = `Server fisik sekolah saat ini AKTIF / MENYALA (detak terakhir: ${lastHeartbeatHuman}). Namun jalur online Easy Tunnel belum terhubung ke gateway pusat.`;
      } else {
        if (ageMs !== null) {
          explanation = `Server fisik sekolah saat ini MATI / OFFLINE atau koneksi internet sekolah terputus (terakhir aktif: ${lastHeartbeatHuman}).`;
        } else {
          explanation = 'Server fisik sekolah belum pernah mengirimkan sinyal detak jantung ke Server Lisensi.';
        }
      }

      return reply.send({
        success: true,
        found: true,
        slug: cleanSlug,
        domain: rawDomain || `${cleanSlug}.${MAIN_DOMAIN}`,
        schoolName: best.schoolName,
        serverStatus,
        isOnline,
        lastHeartbeatAt: best.lastHeartbeatAt?.toISOString() || null,
        lastHeartbeatHuman,
        heartbeatAgeSeconds: ageSeconds,
        deployMode: best.deployMode,
        deployModeLabel: formatDeployMode(best.deployMode),
        easyTunnelStatus: easyTunnelConnected ? 'CONNECTED' : 'NOT_CONNECTED',
        explanation
      });
    } catch (err: any) {
      console.error('[Tenant-Status] Error fetching tenant status:', err);
      return reply.status(500).send({
        success: false,
        message: 'Gagal memeriksa status tenant: ' + err.message
      });
    }
  });
};
