"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTunnelLicenseRoutes = void 0;
const helpers_1 = require("./helpers");
const caddy_service_1 = require("../../services/caddy.service");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const registerTunnelLicenseRoutes = (fastify) => {
    // 1. Wireguard Client Tunnel Request
    fastify.post('/api/license/tunnel/request', async (request, reply) => {
        const body = request.body;
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
            const license = await helpers_1.prisma.license.findFirst({
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
            const existingSlug = await helpers_1.prisma.license.findFirst({
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
                const activeLicenses = await helpers_1.prisma.license.findMany({
                    where: { wireguardIp: { not: null } },
                    select: { wireguardIp: true }
                });
                let maxOctet = 9;
                activeLicenses.forEach(l => {
                    const parts = l.wireguardIp.split('.');
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
            }
            catch (errCmd) {
                console.error('[VPN Tunnel Cmd Error]', errCmd.message);
            }
            // Update license in database
            await helpers_1.prisma.license.update({
                where: { id: license.id },
                data: {
                    wireguardIp: clientIp,
                    requestedSlug: slugLower
                }
            });
            // Synchronize Caddy file
            await (0, caddy_service_1.triggerCaddySync)();
            // Generate client WireGuard config
            let serverPublicKey = 'SP47bTGqXxN4Qqe2DewpONtYEOh2qcXPTj7dt1g1x2o=';
            try {
                const fs = require('fs');
                if (fs.existsSync('/etc/wireguard/publickey')) {
                    serverPublicKey = fs.readFileSync('/etc/wireguard/publickey', 'utf8').trim();
                }
            }
            catch (e) { }
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
        }
        catch (err) {
            console.error('[Wireguard Request Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal memproses request tunnel: ' + err.message });
        }
    });
    // 2. Easy Tunnel: Get packages
    fastify.get('/api/license/easy-tunnel/packages', async (_request, reply) => {
        try {
            const plans = await helpers_1.prisma.plan.findMany({
                where: { productId: 'easy-tunnel', isActive: true },
                orderBy: { id: 'asc' }
            });
            return reply.send({ success: true, data: plans });
        }
        catch (err) {
            console.error('[Easy Tunnel Packages Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengambil paket Easy Tunnel.' });
        }
    });
    // 3. Easy Tunnel: Validate license key
    fastify.get('/api/license/easy-tunnel/validate/:key', async (request, reply) => {
        const { key } = request.params;
        try {
            const license = await helpers_1.prisma.license.findUnique({
                where: { licenseKey: key.trim() }
            });
            if (!license || license.productId !== 'easy-tunnel') {
                return reply.status(404).send({ success: false, message: 'Kunci lisensi Easy Tunnel tidak ditemukan.' });
            }
            const todayStr = new Date().toISOString().slice(0, 10);
            const expired = license.isActive === 0 || license.status === 'expired' || license.expiresAt < todayStr;
            return reply.send({
                success: true,
                data: {
                    license_key: license.licenseKey,
                    school_name: license.schoolName,
                    expires_at: license.expiresAt,
                    wireguard_ip: license.wireguardIp || null,
                    requested_slug: license.requestedSlug || null,
                    local_port: license.localPort || null,
                    app_name: license.appName || null,
                    active_hostname: license.activeHostname || null,
                    expired: expired
                }
            });
        }
        catch (err) {
            console.error('[Easy Tunnel Validate Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal memvalidasi lisensi Easy Tunnel.' });
        }
    });
    // 4. Easy Tunnel: Request tunnel configuration
    fastify.post('/api/license/easy-tunnel/request', async (request, reply) => {
        const body = request.body;
        const { license_key, subdomain_slug, local_port, app_name, hostname } = body;
        if (!license_key || !subdomain_slug || !local_port) {
            return reply.status(400).send({
                success: false,
                message: 'license_key, subdomain_slug, dan local_port wajib diisi.'
            });
        }
        try {
            const slugLower = subdomain_slug.trim().toLowerCase();
            if (!/^[a-z0-9-]+$/.test(slugLower)) {
                return reply.status(400).send({
                    success: false,
                    message: 'Subdomain slug hanya boleh huruf kecil, angka, dan strip (-).'
                });
            }
            const portNum = parseInt(local_port, 10);
            if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                return reply.status(400).send({ success: false, message: 'Port lokal tidak valid (1-65535).' });
            }
            // 1. Verifikasi lisensi aktif easy-tunnel
            const license = await helpers_1.prisma.license.findFirst({
                where: {
                    licenseKey: license_key.trim(),
                    isActive: 1,
                    productId: 'easy-tunnel'
                }
            });
            if (!license) {
                return reply.status(403).send({
                    success: false,
                    message: 'Lisensi Easy Tunnel tidak ditemukan atau tidak aktif.'
                });
            }
            const todayStr = new Date().toISOString().slice(0, 10);
            if (license.expiresAt < todayStr) {
                return reply.status(403).send({ success: false, message: 'Lisensi Easy Tunnel telah kedaluwarsa.' });
            }
            // Single Device Lock by Hostname
            if (hostname) {
                const reqHostname = hostname.trim();
                if (license.activeHostname && license.activeHostname !== reqHostname) {
                    return reply.status(403).send({
                        success: false,
                        message: `Lisensi ini sudah aktif di komputer '${license.activeHostname}'. Silakan hapus/uninstal terowongan terlebih dahulu di komputer tersebut sebelum memasang di komputer baru.`
                    });
                }
            }
            // 2. Cek slug tidak duplikat
            const existingSlug = await helpers_1.prisma.license.findFirst({
                where: {
                    requestedSlug: slugLower,
                    id: { not: license.id }
                }
            });
            if (existingSlug) {
                return reply.status(400).send({
                    success: false,
                    message: `Subdomain '${slugLower}' sudah digunakan oleh instansi lain. Silakan pilih subdomain yang berbeda.`
                });
            }
            // 3. Assign IP
            let clientIp = license.wireguardIp;
            if (!clientIp) {
                const activeLicenses = await helpers_1.prisma.license.findMany({
                    where: { wireguardIp: { not: null } },
                    select: { wireguardIp: true }
                });
                let maxOctet = 9;
                activeLicenses.forEach(l => {
                    const parts = l.wireguardIp.split('.');
                    if (parts.length === 4) {
                        const octet = parseInt(parts[3], 10);
                        if (!isNaN(octet) && octet > maxOctet)
                            maxOctet = octet;
                    }
                });
                clientIp = `10.0.0.${maxOctet + 1}`;
            }
            // 4. Generate WireGuard keypair
            const { execSync } = require('child_process');
            const privateKey = execSync('wg genkey').toString().trim();
            const publicKey = execSync(`echo "${privateKey}" | wg pubkey`).toString().trim();
            // 5. Hot-add peer
            const safeSchoolName = (license.schoolName || '').replace(/[^a-zA-Z0-9 ]/g, '');
            const safeAppName = (app_name || 'EasyTunnel').replace(/[^a-zA-Z0-9 ]/g, '');
            // Clean up old peer
            try {
                const removeCmd = `sudo python3 /var/www/licensing-server/scripts/remove-wg-peer.py "${clientIp}" "${publicKey}"`;
                console.log(`[Easy Tunnel] Cleaning up old peers: ${removeCmd}`);
                execSync(removeCmd);
            }
            catch (cleanupErr) {
                console.warn('[Easy Tunnel WARNING] Failed to clean up old peers:', cleanupErr.message);
            }
            const execCmd = `sudo /usr/local/bin/add-wg-peer.sh "${safeSchoolName} - ${safeAppName}" "${publicKey}" "${clientIp}" "${slugLower}" "${portNum}" "${portNum}"`;
            console.log(`[Easy Tunnel] Running system command: ${execCmd}`);
            execSync(execCmd);
            // Firewall rule check
            try {
                execSync('sudo iptables -C FORWARD -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable', { stdio: 'ignore' });
            }
            catch (checkErr) {
                try {
                    execSync('sudo iptables -A FORWARD -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable && ' +
                        'sudo iptables -A FORWARD -i wg0 -o wg0 -m iprange --dst-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable');
                    execSync("if [ -d /etc/iptables ]; then sudo sh -c 'iptables-save > /etc/iptables/rules.v4'; fi", { stdio: 'ignore' });
                }
                catch (applyErr) {
                    console.warn('[Easy Tunnel WARNING] Failed to apply iptables rules:', applyErr.message);
                }
            }
            // 6. Save to DB
            await helpers_1.prisma.license.update({
                where: { id: license.id },
                data: {
                    wireguardIp: clientIp,
                    requestedSlug: slugLower,
                    localPort: portNum,
                    appName: app_name || null,
                    activeHostname: hostname ? hostname.trim() : null
                }
            });
            await (0, caddy_service_1.triggerCaddySync)();
            // 7. Generate client WireGuard config
            let serverPublicKey = 'SP47bTGqXxN4Qqe2DewpONtYEOh2qcXPTj7dt1g1x2o=';
            try {
                const fs = require('fs');
                if (fs.existsSync('/etc/wireguard/publickey')) {
                    serverPublicKey = fs.readFileSync('/etc/wireguard/publickey', 'utf8').trim();
                }
            }
            catch (e) { }
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
                message: 'Easy Tunnel WireGuard berhasil dibuat.',
                data: {
                    license_key,
                    client_ip: clientIp,
                    subdomain: `${slugLower}.${mainDomain}`,
                    local_port: portNum,
                    app_name: app_name || null,
                    config: clientConfig
                }
            });
        }
        catch (err) {
            console.error('[Easy Tunnel Request Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal memproses request tunnel: ' + err.message });
        }
    });
    // 5. Easy Tunnel: Check VNC port reachability
    fastify.get('/api/license/easy-tunnel/check-vnc-port/:license_key', async (request, reply) => {
        const { license_key } = request.params;
        try {
            const license = await helpers_1.prisma.license.findUnique({
                where: { licenseKey: license_key.trim() }
            });
            if (!license || !license.wireguardIp) {
                return reply.status(404).send({ success: false, message: 'Koneksi tunnel belum terkonfigurasi.' });
            }
            const net = require('net');
            const vncHost = license.wireguardIp;
            const vncPort = 5900;
            const checkPort = () => {
                return new Promise((resolve) => {
                    const client = new net.Socket();
                    client.setTimeout(2000);
                    client.connect(vncPort, vncHost, () => {
                        client.end();
                        resolve(true);
                    });
                    client.on('error', () => {
                        resolve(false);
                    });
                    client.on('timeout', () => {
                        client.destroy();
                        resolve(false);
                    });
                });
            };
            const isOpen = await checkPort();
            return reply.send({
                success: true,
                ip: vncHost,
                port: vncPort,
                open: isOpen,
                message: isOpen ? 'Port VNC (5900) terbuka & dapat dijangkau.' : 'Port VNC (5900) tertutup atau tidak dapat dijangkau.'
            });
        }
        catch (err) {
            console.error('[VNC Port Check Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengecek port VNC.' });
        }
    });
    // 6. Update custom domain for tunnel
    fastify.post('/api/license/tunnel/custom-domain', async (request, reply) => {
        const { license_key, custom_domain } = request.body;
        if (!license_key) {
            return reply.status(400).send({ success: false, message: 'License key wajib diisi.' });
        }
        try {
            const license = await helpers_1.prisma.license.findFirst({
                where: { licenseKey: license_key.trim(), isActive: 1 }
            });
            if (!license) {
                return reply.status(403).send({ success: false, message: 'Lisensi tidak ditemukan atau tidak aktif.' });
            }
            const slug = license.requestedSlug;
            if (!slug) {
                return reply.status(400).send({ success: false, message: 'Lisensi belum di-online-kan (belum memiliki slug/IP).' });
            }
            let targetDomain = null;
            if (custom_domain) {
                targetDomain = custom_domain.trim().toLowerCase();
                const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/;
                if (!domainRegex.test(targetDomain)) {
                    return reply.status(400).send({ success: false, message: 'Format domain kustom tidak valid. Contoh: zakat.sekolah.sch.id' });
                }
            }
            await helpers_1.prisma.license.update({
                where: { id: license.id },
                data: { customDomain: targetDomain }
            });
            await (0, caddy_service_1.triggerCaddySync)();
            return reply.send({
                success: true,
                message: targetDomain
                    ? `Domain kustom '${targetDomain}' berhasil disinkronkan ke cloud gateway.`
                    : 'Domain kustom berhasil dinonaktifkan di cloud gateway.',
                custom_domain: targetDomain
            });
        }
        catch (err) {
            console.error('[Tunnel Custom Domain Sync Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal sinkronisasi domain kustom ke VPS: ' + err.message });
        }
    });
    // 7. Easy Tunnel: Update Local Port
    fastify.post('/api/license/easy-tunnel/update-port', async (request, reply) => {
        const { license_key, local_port } = request.body;
        if (!license_key || !local_port) {
            return reply.status(400).send({ success: false, message: 'license_key dan local_port wajib diisi.' });
        }
        const portNum = parseInt(local_port, 10);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            return reply.status(400).send({ success: false, message: 'Port lokal tidak valid (1-65535).' });
        }
        try {
            const license = await helpers_1.prisma.license.findFirst({
                where: {
                    licenseKey: license_key.trim(),
                    productId: 'easy-tunnel'
                }
            });
            if (!license) {
                return reply.status(404).send({ success: false, message: 'Lisensi Easy Tunnel tidak ditemukan.' });
            }
            if (license.isActive !== 1) {
                return reply.status(403).send({ success: false, message: 'Lisensi Easy Tunnel tidak aktif.' });
            }
            await helpers_1.prisma.license.update({
                where: { id: license.id },
                data: { localPort: portNum }
            });
            await (0, caddy_service_1.triggerCaddySync)();
            return reply.send({
                success: true,
                message: `Port lokal berhasil diubah ke ${portNum} di cloud gateway.`
            });
        }
        catch (err) {
            console.error('[Tunnel Change Port Sync Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengubah port di VPS: ' + err.message });
        }
    });
    // 8. Easy Tunnel: Device Unlock
    fastify.post('/api/license/easy-tunnel/release', async (request, reply) => {
        const { license_key } = request.body;
        if (!license_key) {
            return reply.status(400).send({ success: false, message: 'license_key wajib diisi.' });
        }
        try {
            const license = await helpers_1.prisma.license.findFirst({
                where: {
                    licenseKey: license_key.trim(),
                    productId: 'easy-tunnel'
                }
            });
            if (!license) {
                return reply.status(404).send({ success: false, message: 'Lisensi tidak ditemukan.' });
            }
            await helpers_1.prisma.license.update({
                where: { id: license.id },
                data: { activeHostname: null }
            });
            console.log(`[Easy Tunnel] Released active device lock for license: ${license_key}`);
            return reply.send({
                success: true,
                message: 'Kunci perangkat (device lock) berhasil dilepas.'
            });
        }
        catch (err) {
            console.error('[Tunnel Release Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal melepas kunci perangkat: ' + err.message });
        }
    });
    // 9. GET /api/public/download-ssl
    fastify.get('/api/public/download-ssl', async (request, reply) => {
        const query = request.query;
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
        }
        else if (licenseKey) {
            try {
                const lic = await helpers_1.prisma.license.findFirst({
                    where: { licenseKey: licenseKey, isActive: 1 }
                });
                if (lic) {
                    isAuthorized = true;
                }
            }
            catch (err) {
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
            const license = await helpers_1.prisma.license.findFirst({
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
            const domainFolder = path_1.default.join(caddySslBase, MAIN_DOMAIN);
            const certPath = path_1.default.join(domainFolder, `${MAIN_DOMAIN}.crt`);
            const keyPath = path_1.default.join(domainFolder, `${MAIN_DOMAIN}.key`);
            if (!fs_1.default.existsSync(certPath) || !fs_1.default.existsSync(keyPath)) {
                console.error(`[Download SSL] ❌ Cert files not found at: ${domainFolder}`);
                return reply.status(500).send({
                    success: false,
                    message: 'Berkas sertifikat SSL wildcard belum diterbitkan di server. Hubungi Administrator.'
                });
            }
            // 4. Baca berkas dan kirimkan dalam format JSON
            const certContent = fs_1.default.readFileSync(certPath, 'utf8');
            const keyContent = fs_1.default.readFileSync(keyPath, 'utf8');
            console.log(`[Download SSL] ✓ Wildcard SSL successfully downloaded for domain: ${domain} by client ${clientIp}`);
            return reply.send({
                success: true,
                domain: MAIN_DOMAIN,
                cert: certContent,
                key: keyContent
            });
        }
        catch (err) {
            console.error('[Download SSL Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengunduh sertifikat SSL: ' + err.message });
        }
    });
};
exports.registerTunnelLicenseRoutes = registerTunnelLicenseRoutes;
