import dns from 'dns';
// Force Node.js to prefer IPv4 over IPv6 when resolving DNS to avoid 'fetch failed' errors on VPS
dns.setDefaultResultOrder('ipv4first');

import dotenv from 'dotenv';
import path from 'path';
import { exec } from 'child_process';
import { buildApp } from './app';
import { waGateway } from './services/whatsapp.service';
import { checkExpirations } from './services/cron.service';
import { setupVncProxy } from './services/vnc-proxy.service';
import { triggerCaddySync } from './services/caddy.service';
import cron from 'node-cron';


// Load .env variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const PORT = parseInt(process.env.PORT || '5001', 10);
const HOST = '0.0.0.0';

// ── Global Error Handlers (cegah proses mati diam-diam) ─────────────────────
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException — server akan shutdown:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason);
  // Jangan exit — log saja agar tidak crash karena promise WA/DB minor
});
// ─────────────────────────────────────────────────────────────────────────────

// VPN Firewall Client Isolation Setup (3-Zone Security Policy)
function initVpnFirewall(): void {
  console.log('[FIREWALL] Mengonfigurasi aturan isolasi 3-Zona pada interface wg0...');
  try {
    // 1. Izinkan Laptop Admin/Deployer (10.0.0.2/29) di urutan teratas (-I FORWARD 1)
    exec('sudo iptables -C FORWARD -i wg0 -o wg0 -s 10.0.0.2/29 -j ACCEPT 2>/dev/null || sudo iptables -I FORWARD 1 -i wg0 -o wg0 -s 10.0.0.2/29 -j ACCEPT');
    // 2. Blokir inter-tenant traffic antar-sekolah (10.0.0.10 - 10.0.0.254) di urutan ke-2 (-I FORWARD 2)
    exec('sudo iptables -C FORWARD -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 --dst-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable 2>/dev/null || sudo iptables -I FORWARD 2 -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 --dst-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable');
    // 3. Isolasi Standalone Retail (10.0.1.0/24) dari Server Absenta Sekolah (10.0.0.0/24)
    exec('sudo iptables -C FORWARD -i wg0 -o wg0 -s 10.0.1.0/24 -d 10.0.0.0/24 -j REJECT 2>/dev/null || sudo iptables -I FORWARD 3 -i wg0 -o wg0 -s 10.0.1.0/24 -d 10.0.0.0/24 -j REJECT');
    // 4. Simpan ke rules.v4 jika ada
    exec('if [ -d /etc/iptables ]; then sudo sh -c "iptables-save > /etc/iptables/rules.v4"; fi');
    console.log('[FIREWALL] Aturan isolasi 3-Zona pada wg0 sukses terpasang!');
  } catch (err: any) {
    console.warn('[FIREWALL WARNING] Gagal menerapkan aturan isolasi 3-Zona:', err.message);
  }
}

async function startServer() {
  const app = buildApp();

  // ── Graceful Shutdown Handler ────────────────────────────────────────────
  let isShuttingDown = false;

  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[SERVER] Menerima sinyal ${signal} — memulai graceful shutdown...`);
    try {
      await app.close();
      console.log('[SERVER] HTTP server ditutup dengan bersih.');
    } catch (e: any) {
      console.warn('[SERVER] Error saat menutup HTTP server:', e.message);
    }
    console.log('[SERVER] Shutdown selesai. Bye!');
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
  // ─────────────────────────────────────────────────────────────────────────

  // Initialize VNC WebSocket-to-TCP Proxy
  setupVncProxy(app);

  // Initialize WhatsApp Gateway
  waGateway.init().catch(err => {
    console.error('[WA GATEWAY ERROR] Gagal inisialisasi WA Gateway saat startup:', err.message);
  });

  // Log when WA gateway connects
  waGateway.on('connected', async (num) => {
    console.log(`[WA] ✅ WA Gateway terhubung ke ${num}.`);
  });

  // Start cron checks and Caddy configuration sync
  await triggerCaddySync().catch(err => console.error('[CADDY SYNC ERROR]', err));
  await checkExpirations();

  // Setup daily cron job using node-cron (run at 01:00 AM every day)
  cron.schedule('0 1 * * *', async () => {
    console.log('[CRON-TRIGGER] Running scheduled daily checkExpirations at 01:00 AM...');
    await checkExpirations();
  });


  // Initialize Firewall rules
  if (process.platform === 'linux') {
    initVpnFirewall();
  }

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`[LICENSE SERVER] SaaS Engine running securely on http://${HOST}:${PORT}`);
  } catch (err: any) {
    // ── Port conflict → exit(78) agar PM2 tidak loop restart ──────────────
    // exit code 78 = EX_CONFIG (standard UNIX: environment/config error)
    // Dikonfigurasi di ecosystem.config.js: stop_exit_codes: [78]
    // Sehingga PM2 TIDAK akan restart saat terjadi port conflict
    if (err.code === 'EADDRINUSE') {
      console.error(`[FATAL] Port ${PORT} sudah dipakai proses lain! Jalankan: sudo fuser -k ${PORT}/tcp`);
      console.error('[FATAL] Server tidak dapat start — menghentikan proses tanpa restart otomatis.');
      process.exit(78);
    }
    app.log.error(err);
    process.exit(1);
  }

}

startServer();
