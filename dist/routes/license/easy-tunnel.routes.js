"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerEasyTunnelRoutes = void 0;
const helpers_1 = require("./helpers");
const caddy_service_1 = require("../../services/caddy.service");
/**
 * Easy Tunnel Routes — Dedicated endpoint untuk produk Easy Tunnel
 * ProductId: 'easy-tunnel'
 *
 * Endpoint yang tersedia:
 *  GET  /api/license/easy-tunnel/packages
 *  GET  /api/license/easy-tunnel/validate/:key
 *  POST /api/license/easy-tunnel/request
 *  POST /api/license/easy-tunnel/update-port
 *  POST /api/license/easy-tunnel/release
 *  GET  /api/license/easy-tunnel/check-vnc-port/:license_key
 *  GET  /api/license/easy-tunnel/by-slug/:slug
 */
const registerEasyTunnelRoutes = (fastify) => {
    // 1. GET /api/license/easy-tunnel/packages — Ambil daftar paket Easy Tunnel
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
    // 2. GET /api/license/easy-tunnel/validate/:key — Validasi license key Easy Tunnel
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
    // 3. POST /api/license/easy-tunnel/request — Request WireGuard tunnel configuration
    fastify.post('/api/license/easy-tunnel/request', async (request, reply) => {
        const body = request.body;
        const { license_key, subdomain_slug, local_port, app_name, hostname, os_type } = body;
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
            // 2. Cek slug tidak duplikat (hanya duplikat jika sesama produk tunnel)
            const existingSlug = await helpers_1.prisma.license.findFirst({
                where: {
                    requestedSlug: slugLower,
                    id: { not: license.id },
                    productId: { in: ['easy-tunnel', 'vpn-tunnel'] }
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
                    activeHostname: hostname ? hostname.trim() : null,
                    activeOs: os_type ? os_type.trim() : null
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
    // 4. POST /api/license/easy-tunnel/update-port — Update local port di server
    fastify.post('/api/license/easy-tunnel/update-port', async (request, reply) => {
        const { license_key, local_port, app_name } = request.body;
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
                data: {
                    localPort: portNum,
                    ...(app_name ? { appName: app_name.trim() } : {})
                }
            });
            await (0, caddy_service_1.triggerCaddySync)();
            return reply.send({
                success: true,
                message: `Port lokal berhasil diubah ke ${portNum} di cloud gateway.`
            });
        }
        catch (err) {
            console.error('[Easy Tunnel Update Port Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengubah port di VPS: ' + err.message });
        }
    });
    // 5. POST /api/license/easy-tunnel/release — Lepas device lock
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
            console.error('[Easy Tunnel Release Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal melepas kunci perangkat: ' + err.message });
        }
    });
    // 6. GET /api/license/easy-tunnel/check-vnc-port/:license_key — Cek VNC port reachability
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
            console.error('[Easy Tunnel VNC Port Check Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengecek port VNC.' });
        }
    });
    // 7. GET /api/license/easy-tunnel/by-slug/:slug — Cari lisensi berdasarkan slug
    fastify.get('/api/license/easy-tunnel/by-slug/:slug', async (request, reply) => {
        const { slug } = request.params;
        try {
            const licenses = await helpers_1.prisma.license.findMany({
                where: {
                    productId: 'easy-tunnel',
                    requestedSlug: slug.trim().toLowerCase()
                },
                orderBy: { createdAt: 'desc' }
            });
            return reply.send({
                success: true,
                data: licenses.map(license => ({
                    license_key: license.licenseKey,
                    school_name: license.schoolName,
                    expires_at: license.expiresAt,
                    status: license.status,
                    is_active: license.isActive,
                    local_port: license.localPort || null,
                    app_name: license.appName || null,
                    wireguard_ip: license.wireguardIp || null
                }))
            });
        }
        catch (err) {
            console.error('[Easy Tunnel By Slug Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar lisensi Easy Tunnel.' });
        }
    });
};
exports.registerEasyTunnelRoutes = registerEasyTunnelRoutes;
