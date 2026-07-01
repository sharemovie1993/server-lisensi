"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const app_1 = require("./app");
const whatsapp_service_1 = require("./services/whatsapp.service");
const cron_service_1 = require("./services/cron.service");
const vnc_proxy_service_1 = require("./services/vnc-proxy.service");
// Load .env variables
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
const PORT = parseInt(process.env.PORT || '5001', 10);
const HOST = '0.0.0.0';
// VPN Firewall Client Isolation Setup
function initVpnFirewall() {
    const checkCmd = 'sudo iptables -C FORWARD -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable';
    (0, child_process_1.exec)(checkCmd, (err) => {
        if (err) {
            console.log('[FIREWALL] Menerapkan aturan isolasi Client-to-Client pada interface wg0...');
            const applyCmd = 'sudo iptables -A FORWARD -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable && ' +
                'sudo iptables -A FORWARD -i wg0 -o wg0 -m iprange --dst-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable';
            (0, child_process_1.exec)(applyCmd, (applyErr) => {
                if (applyErr) {
                    console.warn('[FIREWALL WARNING] Gagal menerapkan aturan iptables secara otomatis:', applyErr.message);
                }
                else {
                    console.log('[FIREWALL] Aturan isolasi VPN berhasil diterapkan secara otomatis!');
                    (0, child_process_1.exec)('if [ -d /etc/iptables ]; then sudo sh -c "iptables-save > /etc/iptables/rules.v4"; fi');
                }
            });
        }
        else {
            console.log('[FIREWALL] Aturan isolasi Client-to-Client pada wg0 sudah terpasang.');
        }
    });
}
async function startServer() {
    const app = (0, app_1.buildApp)();
    // Initialize VNC WebSocket-to-TCP Proxy
    (0, vnc_proxy_service_1.setupVncProxy)(app);
    // Initialize WhatsApp Gateway
    whatsapp_service_1.waGateway.init().catch(err => {
        console.error('[WA GATEWAY ERROR] Gagal inisialisasi WA Gateway saat startup:', err.message);
    });
    // Run checkExpirations immediately on WA connect or startup fallback
    whatsapp_service_1.waGateway.on('connected', async (num) => {
        console.log(`[WA] WA Gateway terhubung ke ${num}. Menjalankan checkExpirations...`);
        await (0, cron_service_1.checkExpirations)();
    });
    // Start cron checks
    await (0, cron_service_1.checkExpirations)();
    setInterval(cron_service_1.checkExpirations, 30 * 1000); // 30s quick testing loop
    // Initialize Firewall rules
    if (process.platform === 'linux') {
        initVpnFirewall();
    }
    try {
        await app.listen({ port: PORT, host: HOST });
        console.log(`[LICENSE SERVER] SaaS Engine running securely on http://${HOST}:${PORT}`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
startServer();
