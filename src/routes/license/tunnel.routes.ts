import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from './helpers';
import { triggerCaddySync } from '../../services/caddy.service';
import fs from 'fs';
import path from 'path';

/**
 * VPN Tunnel Routes — Endpoint untuk produk VPN Tunnel lama
 * ProductId: 'vpn-tunnel'
 *
 * Catatan: Endpoint Easy Tunnel (/api/license/easy-tunnel/*) telah dipindahkan
 * ke easy-tunnel.routes.ts (productId: 'easy-tunnel').
 */
export const registerTunnelLicenseRoutes = (fastify: FastifyInstance) => {

  // 1. POST /api/license/tunnel/request — Wireguard Client Tunnel Request (VPN Tunnel lama)
  fastify.post('/api/license/tunnel/request', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { license_key: string; subdomain_slug: string; local_port?: number; frontend_port?: number };
    const { license_key, subdomain_slug, local_port, frontend_port } = body;

    if (!license_key || !subdomain_slug) {
      return reply.status(400).send({ success: false, message: 'License key dan subdomain slug wajib diisi.' });
    }

    try {
      const slugLower = subdomain_slug.trim().toLowerCase();
      if (!/^[a-z0-9-]+$/.test(slugLower)) {
        return reply.status(400).send({ success: false, message: 'Subdomain slug hanya boleh huruf kecil, angka, dan strip (-).' });
      }

      // Verify active license for vpn-tunnel
      const license = await prisma.license.findFirst({
        where: {
          licenseKey: license_key.trim(),
          isActive: 1,
          productId: 'vpn-tunnel'
        }
      });

      if (!license) {
        return reply.status(403).send({ success: false, message: 'Lisensi VPN Tunneling tidak ditemukan atau tidak aktif.' });
      }

      // Check if subdomain slug is already used
      const existingSlug = await prisma.license.findFirst({
        where: {
          requestedSlug: slugLower,
          id: { not: license.id },
          productId: license.productId
        }
      });

      if (existingSlug) {
        return reply.status(400).send({ success: false, message: 'Subdomain tersebut sudah digunakan oleh instansi lain.' });
      }

      let clientIp = license.wireguardIp;
      if (!clientIp) {
        // Find next IP in range (start from 10.0.0.10)
        const activeLicenses = await prisma.license.findMany({
          where: { wireguardIp: { not: null } },
          select: { wireguardIp: true }
        });

        let maxOctet = 9;
        activeLicenses.forEach(l => {
          const parts = l.wireguardIp!.split('.');
          if (parts.length === 4) {
            const octet = parseInt(parts[3], 10);
            if (!isNaN(octet) && octet > maxOctet) {
              maxOctet = octet;
            }
          }
        });
        clientIp = `10.0.0.${maxOctet + 1}`;
      }

      // Execute Wireguard generation commands securely
      const { execSync } = require('child_process');
      const privateKey = execSync('wg genkey').toString().trim();
      const publicKey = execSync(`echo "${privateKey}" | wg pubkey`).toString().trim();

      const localPort = local_port || 5002;
      const frontendPort = frontend_port || 5174;
      const safeSchoolName = license.schoolName.replace(/[^a-zA-Z0-9 ]/g, '');

      const execCmd = `sudo /usr/local/bin/add-wg-peer.sh "${safeSchoolName}" "${publicKey}" "${clientIp}" "${slugLower}" "${localPort}" "${frontendPort}"`;
      console.log(`[VPN Tunnel] Executing command: ${execCmd}`);

      try {
        execSync(execCmd);
      } catch (errCmd: any) {
        console.error('[VPN Tunnel Cmd Error]', errCmd.message);
      }

      // Update license in database
      await prisma.license.update({
        where: { id: license.id },
        data: {
          wireguardIp: clientIp,
          requestedSlug: slugLower
        }
      });

      // Synchronize Caddy file
      await triggerCaddySync();

      // Generate client WireGuard config
      let serverPublicKey = 'SP47bTGqXxN4Qqe2DewpONtYEOh2qcXPTj7dt1g1x2o=';
      try {
        if (fs.existsSync('/etc/wireguard/publickey')) {
          serverPublicKey = fs.readFileSync('/etc/wireguard/publickey', 'utf8').trim();
        }
      } catch (e) {}

      const mainDomain = process.env.MAIN_DOMAIN || 'absenta.id';
      const serverEndpoint = process.env.VPS_IP || `api.${mainDomain}`;
      const clientConfig = `[Interface]
PrivateKey = ${privateKey}
Address = ${clientIp}/24
DNS = 1.1.1.1

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${serverEndpoint}:51820
AllowedIPs = 10.0.0.0/24
PersistentKeepalive = 25
`;

      return reply.send({
        success: true,
        message: 'Koneksi Wireguard Tunnel berhasil disiapkan.',
        data: {
          license_key: license_key,
          client_ip: clientIp,
          subdomain: `${slugLower}.${mainDomain}`,
          config: clientConfig
        }
      });

    } catch (err: any) {
      console.error('[Wireguard Request Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal memproses request tunnel: ' + err.message });
    }
  });

  // 2. POST /api/license/tunnel/custom-domain — Update custom domain (vpn-tunnel & easy-tunnel)
  fastify.post('/api/license/tunnel/custom-domain', async (request: FastifyRequest, reply: FastifyReply) => {
    const { license_key, custom_domain } = request.body as { license_key: string; custom_domain?: string };
    if (!license_key) {
      return reply.status(400).send({ success: false, message: 'License key wajib diisi.' });
    }

    try {
      const license = await prisma.license.findFirst({
        where: { licenseKey: license_key.trim(), isActive: 1 }
      });
      if (!license) {
        return reply.status(403).send({ success: false, message: 'Lisensi tidak ditemukan atau tidak aktif.' });
      }

      const slug = license.requestedSlug;
      if (!slug) {
        return reply.status(400).send({ success: false, message: 'Lisensi belum di-online-kan (belum memiliki slug/IP).' });
      }

      let targetDomain: string | null = null;
      if (custom_domain) {
        targetDomain = custom_domain.trim().toLowerCase();
        const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/;
        if (!domainRegex.test(targetDomain)) {
          return reply.status(400).send({ success: false, message: 'Format domain kustom tidak valid. Contoh: zakat.sekolah.sch.id' });
        }
      }

      await prisma.license.update({
        where: { id: license.id },
        data: { customDomain: targetDomain }
      });

      await triggerCaddySync();

      return reply.send({
        success: true,
        message: targetDomain
          ? `Domain kustom '${targetDomain}' berhasil disinkronkan ke cloud gateway.`
          : 'Domain kustom berhasil dinonaktifkan di cloud gateway.',
        custom_domain: targetDomain
      });
    } catch (err: any) {
      console.error('[Tunnel Custom Domain Sync Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal sinkronisasi domain kustom ke VPS: ' + err.message });
    }
  });

  // 3. GET /api/public/download-ssl — Download wildcard SSL certificate
  fastify.get('/api/public/download-ssl', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { domain?: string; license_key?: string };
    const domain = (query.domain || '').trim().toLowerCase();
    const licenseKey = (query.license_key || request.headers['x-license-key'] || '').toString().trim();

    if (!domain) {
      return reply.status(400).send({ success: false, message: 'Parameter domain wajib diisi.' });
    }

    // 1. IP Security Hardening or License Key Authentication
    let clientIp = request.ip || '';
    const isVpnIp = clientIp.startsWith('10.0.0.') || clientIp === '127.0.0.1' || clientIp === '::1';
    let isAuthorized = false;

    if (isVpnIp) {
      isAuthorized = true;
    } else if (licenseKey) {
      try {
        const lic = await prisma.license.findFirst({
          where: { licenseKey: licenseKey, isActive: 1 }
        });
        if (lic) {
          isAuthorized = true;
        }
      } catch (err: any) {
        console.error('[Download SSL] License auth error:', err.message);
      }
    }

    if (!isAuthorized) {
      console.warn(`[Download SSL] ❌ Unauthorized access attempt from IP: ${clientIp}, license: ${licenseKey}`);
      return reply.status(403).send({ success: false, message: 'Forbidden: Akses memerlukan koneksi VPN atau Kunci Lisensi aktif.' });
    }

    try {
      // 2. Cek apakah domain terdaftar dan aktif di database
      const MAIN_DOMAIN = (process.env.MAIN_DOMAIN || '').toLowerCase();
      const isMainDomain = domain === MAIN_DOMAIN || domain === `www.${MAIN_DOMAIN}` || domain === `api.${MAIN_DOMAIN}`;

      const slugToCheck = domain.replace(`.${MAIN_DOMAIN}`, '');
      const license = await prisma.license.findFirst({
        where: {
          OR: [
            { customDomain: domain },
            { requestedSlug: slugToCheck }
          ],
          isActive: 1
        }
      });

      if (!isMainDomain && !license) {
        console.log(`[Download SSL] ❌ Domain not active or unregistered: ${domain}`);
        return reply.status(404).send({ success: false, message: 'Domain tidak terdaftar atau tidak aktif.' });
      }

      // 3. Tentukan lokasi folder sertifikat Caddy di VPS Linux
      const homeDir = process.env.HOME || '/root';
      const caddySslBase = process.env.CADDY_SSL_BASE || `${homeDir}/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory`;

      const wildcardDomain = `wildcard_.${MAIN_DOMAIN}`;
      const domainFolder = path.join(caddySslBase, wildcardDomain);
      const certPath = path.join(domainFolder, `${wildcardDomain}.crt`);
      const keyPath = path.join(domainFolder, `${wildcardDomain}.key`);

      if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
        console.error(`[Download SSL] ❌ Cert files not found at: ${domainFolder}`);
        return reply.status(500).send({
          success: false,
          message: 'Berkas sertifikat SSL wildcard belum diterbitkan di server. Hubungi Administrator.'
        });
      }

      // 4. Baca berkas dan kirimkan dalam format JSON
      const certContent = fs.readFileSync(certPath, 'utf8');
      const keyContent = fs.readFileSync(keyPath, 'utf8');

      console.log(`[Download SSL] ✓ Wildcard SSL successfully downloaded for domain: ${domain} by client ${clientIp}`);
      return reply.send({
        success: true,
        domain: MAIN_DOMAIN,
        cert: certContent,
        key: keyContent
      });

    } catch (err: any) {
      console.error('[Download SSL Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal mengunduh sertifikat SSL: ' + err.message });
    }
  });

};
