"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWireguardServerStatus = getWireguardServerStatus;
exports.listWireguardPeers = listWireguardPeers;
exports.getNextWireguardIp = getNextWireguardIp;
exports.createWireguardPeer = createWireguardPeer;
exports.deleteWireguardPeer = deleteWireguardPeer;
exports.syncWireguardConfig = syncWireguardConfig;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const helpers_1 = require("../routes/license/helpers");
const caddy_service_1 = require("./caddy.service");
const WG_CONF_PATH = process.env.WG_CONF_PATH || '/etc/wireguard/wg0.conf';
const WG_INTERFACE = process.env.WG_INTERFACE || 'wg0';
const MAIN_DOMAIN = process.env.MAIN_DOMAIN || 'absenta.id';
const VPS_IP = process.env.VPS_IP || '103.196.155.87';
const WG_PORT = process.env.WG_PORT || '51821';
function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0)
        return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
function formatTimeAgo(timestampSec) {
    if (!timestampSec || timestampSec <= 0)
        return 'Belum pernah';
    const nowSec = Math.floor(Date.now() / 1000);
    const diffSec = nowSec - timestampSec;
    if (diffSec < 0 || diffSec < 5)
        return 'Baru saja';
    if (diffSec < 60)
        return `${diffSec} detik lalu`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60)
        return `${diffMin} menit lalu`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24)
        return `${diffHour} jam lalu`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay} hari lalu`;
}
/**
 * Membaca status server WireGuard (wg show dump)
 */
async function getWireguardServerStatus() {
    let isOnline = false;
    let serverPubKey = '';
    let listenPort = parseInt(WG_PORT, 10);
    let totalPeers = 0;
    let activePeers = 0;
    let stalePeers = 0;
    let offlinePeers = 0;
    let totalRx = 0;
    let totalTx = 0;
    try {
        if (process.platform === 'linux') {
            const dump = (0, child_process_1.execSync)(`sudo wg show ${WG_INTERFACE} dump 2>/dev/null || true`, {
                encoding: 'utf8',
                stdio: 'pipe'
            }).trim();
            if (dump) {
                isOnline = true;
                const lines = dump.split('\n');
                // Line 0 is Interface: private_key, public_key, listen_port, fwmark
                if (lines.length > 0) {
                    const ifParts = lines[0].split('\t');
                    if (ifParts.length >= 3) {
                        serverPubKey = ifParts[1] || '';
                        listenPort = parseInt(ifParts[2], 10) || listenPort;
                    }
                }
                const nowSec = Math.floor(Date.now() / 1000);
                for (let i = 1; i < lines.length; i++) {
                    const parts = lines[i].split('\t');
                    if (parts.length >= 8) {
                        totalPeers++;
                        const handshake = parseInt(parts[4], 10) || 0;
                        const rx = parseInt(parts[5], 10) || 0;
                        const tx = parseInt(parts[6], 10) || 0;
                        totalRx += rx;
                        totalTx += tx;
                        const diff = nowSec - handshake;
                        if (handshake > 0 && diff <= 180) {
                            activePeers++;
                        }
                        else if (handshake > 0 && diff <= 3600) {
                            stalePeers++;
                        }
                        else {
                            offlinePeers++;
                        }
                    }
                }
            }
        }
        else {
            // Mock for Windows / Local Dev
            isOnline = true;
            serverPubKey = 'SP47bTGqXxN4Qqe2DewpONtYEOh2qcXPTj7dt1g1x2o=';
            totalPeers = 3;
            activePeers = 2;
            stalePeers = 0;
            offlinePeers = 1;
            totalRx = 104857600;
            totalTx = 52428800;
        }
    }
    catch (err) {
        console.warn('[WG Server Status Warning]', err.message);
    }
    if (!serverPubKey && fs_1.default.existsSync('/etc/wireguard/publickey')) {
        try {
            serverPubKey = fs_1.default.readFileSync('/etc/wireguard/publickey', 'utf8').trim();
        }
        catch { }
    }
    return {
        interface: WG_INTERFACE,
        publicKey: serverPubKey,
        listenPort,
        totalPeers,
        activePeers,
        stalePeers,
        offlinePeers,
        totalRx,
        totalTx,
        totalRxHuman: formatBytes(totalRx),
        totalTxHuman: formatBytes(totalTx),
        isOnline
    };
}
/**
 * Mengambil daftar peer lengkap beserta status runtime kernel & data database
 */
async function listWireguardPeers() {
    const peersMap = new Map();
    // 1. Baca data statis dari wg0.conf
    try {
        if (fs_1.default.existsSync(WG_CONF_PATH)) {
            const confContent = fs_1.default.readFileSync(WG_CONF_PATH, 'utf8');
            const peerBlocks = confContent.split(/\[Peer\]/i);
            for (let i = 1; i < peerBlocks.length; i++) {
                const block = peerBlocks[i];
                const prevText = peerBlocks[i - 1];
                // Ambil komentar nama sebelum [Peer]
                let name = '';
                const commentMatch = prevText.match(/#\s*(?:Client|Peer|Instansi|Sekolah)?:\s*(.+)$/im);
                if (commentMatch) {
                    name = commentMatch[1].trim();
                }
                const pubKeyMatch = block.match(/PublicKey\s*=\s*([A-Za-z0-9+/=]+)/i);
                const allowedIpsMatch = block.match(/AllowedIPs\s*=\s*([0-9.,/ ]+)/i);
                const keepaliveMatch = block.match(/PersistentKeepalive\s*=\s*(\d+)/i);
                if (pubKeyMatch) {
                    const pubKey = pubKeyMatch[1].trim();
                    peersMap.set(pubKey, {
                        publicKey: pubKey,
                        allowedIps: allowedIpsMatch ? allowedIpsMatch[1].trim() : '',
                        persistentKeepalive: keepaliveMatch ? parseInt(keepaliveMatch[1], 10) : 0,
                        name: name || 'Unnamed Peer',
                        status: 'offline',
                        latestHandshake: 0,
                        transferRx: 0,
                        transferTx: 0,
                        endpoint: '(none)'
                    });
                }
            }
        }
    }
    catch (err) {
        console.warn('[WG List Config Warning]', err.message);
    }
    // 2. Baca data dinamis dari runtime kernel `wg show dump`
    try {
        if (process.platform === 'linux') {
            const dump = (0, child_process_1.execSync)(`sudo wg show ${WG_INTERFACE} dump 2>/dev/null || true`, {
                encoding: 'utf8',
                stdio: 'pipe'
            }).trim();
            if (dump) {
                const lines = dump.split('\n');
                const nowSec = Math.floor(Date.now() / 1000);
                for (let i = 1; i < lines.length; i++) {
                    const parts = lines[i].split('\t');
                    if (parts.length >= 8) {
                        const pubKey = parts[0];
                        const psk = parts[1] !== '(none)' ? parts[1] : undefined;
                        const endpoint = parts[2] !== '(none)' ? parts[2] : '(none)';
                        const allowedIps = parts[3];
                        const handshake = parseInt(parts[4], 10) || 0;
                        const rx = parseInt(parts[5], 10) || 0;
                        const tx = parseInt(parts[6], 10) || 0;
                        const keepalive = parseInt(parts[7], 10) || 0;
                        const diff = nowSec - handshake;
                        let status = 'offline';
                        if (handshake > 0 && diff <= 180) {
                            status = 'active';
                        }
                        else if (handshake > 0 && diff <= 3600) {
                            status = 'stale';
                        }
                        const existing = peersMap.get(pubKey) || {
                            publicKey: pubKey,
                            name: 'Dynamic Peer'
                        };
                        peersMap.set(pubKey, {
                            ...existing,
                            publicKey: pubKey,
                            presharedKey: psk,
                            endpoint,
                            allowedIps: allowedIps || existing.allowedIps || '',
                            latestHandshake: handshake,
                            transferRx: rx,
                            transferTx: tx,
                            persistentKeepalive: keepalive,
                            status
                        });
                    }
                }
            }
        }
    }
    catch (err) {
        console.warn('[WG List Runtime Warning]', err.message);
    }
    // 3. Gabungkan dengan data database License
    try {
        const licenses = await helpers_1.prisma.license.findMany({
            where: {
                wireguardIp: { not: null }
            },
            select: {
                licenseKey: true,
                schoolName: true,
                appName: true,
                requestedSlug: true,
                wireguardIp: true,
                localPort: true,
                isActive: true,
                expiresAt: true
            }
        });
        const licenseByIp = new Map();
        licenses.forEach(l => {
            if (l.wireguardIp) {
                licenseByIp.set(l.wireguardIp.replace(/\/32$/, ''), l);
            }
        });
        for (const peer of peersMap.values()) {
            const cleanIp = (peer.allowedIps || '').split('/')[0].trim();
            const lic = licenseByIp.get(cleanIp);
            if (lic) {
                peer.name = lic.schoolName || peer.name;
                peer.appName = lic.appName || 'EasyTunnel';
                peer.subdomain = lic.requestedSlug ? `${lic.requestedSlug}.${MAIN_DOMAIN}` : undefined;
                peer.localPort = lic.localPort || undefined;
                peer.licenseKey = lic.licenseKey;
                peer.isRegisteredDb = true;
            }
            else {
                peer.isRegisteredDb = false;
            }
        }
    }
    catch (err) {
        console.warn('[WG DB Correlation Warning]', err.message);
    }
    // Format ke array
    const result = Array.from(peersMap.values()).map(p => ({
        publicKey: p.publicKey || '',
        presharedKey: p.presharedKey,
        endpoint: p.endpoint || '(none)',
        allowedIps: p.allowedIps || '',
        latestHandshake: p.latestHandshake || 0,
        latestHandshakeHuman: formatTimeAgo(p.latestHandshake || 0),
        transferRx: p.transferRx || 0,
        transferTx: p.transferTx || 0,
        transferRxHuman: formatBytes(p.transferRx || 0),
        transferTxHuman: formatBytes(p.transferTx || 0),
        persistentKeepalive: p.persistentKeepalive || 0,
        status: p.status || 'offline',
        name: p.name || 'Unnamed Peer',
        appName: p.appName,
        subdomain: p.subdomain,
        localPort: p.localPort,
        licenseKey: p.licenseKey,
        isRegisteredDb: p.isRegisteredDb || false
    }));
    // Urutkan: active paling atas, lalu stale, lalu offline
    return result.sort((a, b) => {
        const score = (s) => (s === 'active' ? 2 : s === 'stale' ? 1 : 0);
        const diff = score(b.status) - score(a.status);
        if (diff !== 0)
            return diff;
        return b.latestHandshake - a.latestHandshake;
    });
}
/**
 * Mencari IP berikutnya yang belum dipakai
 */
async function getNextWireguardIp(prefix = '10.0.0.') {
    const peers = await listWireguardPeers();
    let maxOctet = prefix === '10.0.2.' ? 1 : 9;
    peers.forEach(p => {
        const cleanIp = p.allowedIps.split('/')[0].trim();
        if (cleanIp.startsWith(prefix)) {
            const parts = cleanIp.split('.');
            if (parts.length === 4) {
                const octet = parseInt(parts[3], 10);
                if (!isNaN(octet) && octet > maxOctet)
                    maxOctet = octet;
            }
        }
    });
    return `${prefix}${maxOctet + 1}`;
}
/**
 * Membuat peer baru di server dan mengembalikan konfigurasi klien
 */
async function createWireguardPeer(payload) {
    const { name, subdomainSlug, localPort, appName } = payload;
    let { publicKey, privateKey, ipAddress } = payload;
    if (!name)
        throw new Error('Nama Peer/Klien wajib diisi.');
    // 1. Generate keypair jika belum ada
    if (!publicKey) {
        if (process.platform === 'linux') {
            privateKey = (0, child_process_1.execSync)('wg genkey').toString().trim();
            publicKey = (0, child_process_1.execSync)(`echo "${privateKey}" | wg pubkey`).toString().trim();
        }
        else {
            privateKey = 'cHEzi9eLQgLXCE8lgebX8EZ9bjiQxIU9VlZiJMO5gWo=';
            publicKey = 'aNXX26oxSYevAh1hdhJPoc6PXmOFvTyLchUVzIC8bX8=';
        }
    }
    // 2. Alokasikan IP
    if (!ipAddress) {
        ipAddress = await getNextWireguardIp('10.0.0.');
    }
    const cleanIp = ipAddress.split('/')[0].trim();
    // 3. Tambahkan ke runtime kernel WireGuard jika di Linux
    if (process.platform === 'linux') {
        // Pastikan tidak ada peer lama dengan IP atau Key yang sama
        try {
            (0, child_process_1.execSync)(`sudo python3 /var/www/licensing-server/scripts/remove-wg-peer.py "${cleanIp}" "${publicKey}" 2>/dev/null || true`);
        }
        catch { }
        // Hot-add ke kernel
        try {
            (0, child_process_1.execSync)(`sudo wg set ${WG_INTERFACE} peer "${publicKey}" allowed-ips "${cleanIp}/32"`, { stdio: 'pipe' });
        }
        catch (e) {
            console.warn('[WG Hot-Add Warning]', e.message);
        }
        // Tulis ke wg0.conf TANPA ENDPOINT (Golden Rule for Dynamic Roaming)
        try {
            if (fs_1.default.existsSync(WG_CONF_PATH)) {
                const peerEntry = `
# Client: ${name.replace(/\n/g, '')}
[Peer]
PublicKey = ${publicKey}
AllowedIPs = ${cleanIp}/32
`;
                fs_1.default.appendFileSync(WG_CONF_PATH, peerEntry, 'utf8');
            }
        }
        catch (e) {
            console.warn('[WG Append Conf Warning]', e.message);
        }
    }
    // 4. Update Caddy jika ada subdomain dan port
    if (subdomainSlug && localPort) {
        try {
            await (0, caddy_service_1.triggerCaddySync)();
        }
        catch { }
    }
    // 5. Generate Client Config
    let serverPubKey = 'SP47bTGqXxN4Qqe2DewpONtYEOh2qcXPTj7dt1g1x2o=';
    try {
        if (fs_1.default.existsSync('/etc/wireguard/publickey')) {
            serverPubKey = fs_1.default.readFileSync('/etc/wireguard/publickey', 'utf8').trim();
        }
    }
    catch { }
    const clientConfig = `[Interface]
PrivateKey = ${privateKey || '<MASUKKAN_PRIVATE_KEY_ANDA>'}
Address = ${cleanIp}/32
DNS = 1.1.1.1
MTU = 1360

[Peer]
PublicKey = ${serverPubKey}
Endpoint = ${VPS_IP}:${WG_PORT}
AllowedIPs = 10.0.0.1/32, 10.0.2.1/32
PersistentKeepalive = 25
`;
    return {
        peer: {
            publicKey,
            endpoint: '(none)',
            allowedIps: `${cleanIp}/32`,
            latestHandshake: 0,
            latestHandshakeHuman: 'Belum pernah',
            transferRx: 0,
            transferTx: 0,
            transferRxHuman: '0 B',
            transferTxHuman: '0 B',
            persistentKeepalive: 25,
            status: 'offline',
            name,
            appName,
            subdomain: subdomainSlug ? `${subdomainSlug}.${MAIN_DOMAIN}` : undefined,
            localPort,
            isRegisteredDb: false
        },
        clientConfig
    };
}
/**
 * Menghapus peer secara bersih dari kernel dan konfigurasi
 */
async function deleteWireguardPeer(publicKey) {
    if (!publicKey)
        throw new Error('Public key wajib diisi.');
    if (process.platform === 'linux') {
        // 1. Remove dari kernel runtime
        try {
            (0, child_process_1.execSync)(`sudo wg set ${WG_INTERFACE} peer "${publicKey}" remove`, { stdio: 'pipe' });
        }
        catch (e) {
            console.warn('[WG Delete Kernel Warning]', e.message);
        }
        // 2. Remove dari wg0.conf
        try {
            if (fs_1.default.existsSync(WG_CONF_PATH)) {
                let content = fs_1.default.readFileSync(WG_CONF_PATH, 'utf8');
                // Pattern untuk menghapus blok peer dan komentar sebelumnya
                const pattern = new RegExp(`(?:#[^\\n]*\\n)*\\s*\\[Peer\\][\\s\\S]*?PublicKey\\s*=\\s*${publicKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=(?:#[^\\n]*\\n)*\\s*\\[Peer\\]|$)`, 'gi');
                content = content.replace(pattern, '').trim() + '\n';
                fs_1.default.writeFileSync(WG_CONF_PATH, content, 'utf8');
            }
        }
        catch (e) {
            console.warn('[WG Delete Conf Warning]', e.message);
        }
    }
    return {
        success: true,
        message: 'Peer WireGuard berhasil dihapus secara bersih dari server.'
    };
}
/**
 * Sinkronisasi ulang konfigurasi WireGuard runtime
 */
async function syncWireguardConfig() {
    if (process.platform === 'linux') {
        try {
            (0, child_process_1.execSync)(`sudo wg syncconf ${WG_INTERFACE} <(sudo wg-quick strip ${WG_INTERFACE})`, {
                shell: '/bin/bash',
                stdio: 'pipe'
            });
            return { success: true, message: 'Konfigurasi WireGuard berhasil disinkronkan ke kernel.' };
        }
        catch (err) {
            throw new Error('Gagal syncconf WireGuard: ' + err.message);
        }
    }
    return { success: true, message: 'Sync WireGuard simulasi berhasil (Dev mode).' };
}
