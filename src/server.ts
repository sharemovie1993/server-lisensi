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

// VPN Firewall Client Isolation Setup
function initVpnFirewall(): void {
  const checkCmd = 'sudo iptables -C FORWARD -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable';

  exec(checkCmd, (err) => {
    if (err) {
      console.log('[FIREWALL] Menerapkan aturan isolasi Client-to-Client pada interface wg0...');
      const applyCmd = 
        'sudo iptables -A FORWARD -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable && ' +
        'sudo iptables -A FORWARD -i wg0 -o wg0 -m iprange --dst-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable';
      
      exec(applyCmd, (applyErr) => {
        if (applyErr) {
          console.warn('[FIREWALL WARNING] Gagal menerapkan aturan iptables secara otomatis:', applyErr.message);
        } else {
          console.log('[FIREWALL] Aturan isolasi VPN berhasil diterapkan secara otomatis!');
          exec('if [ -d /etc/iptables ]; then sudo sh -c "iptables-save > /etc/iptables/rules.v4"; fi');
        }
      });
    } else {
      console.log('[FIREWALL] Aturan isolasi Client-to-Client pada wg0 sudah terpasang.');
    }
  });
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

  // Run checkExpirations immediately on WA connect or startup fallback
  waGateway.on('connected', async (num) => {
    console.log(`[WA] WA Gateway terhubung ke ${num}. Menjalankan checkExpirations...`);
    await checkExpirations();
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
    // ── Port conflict → exit(1) agar PM2 tidak loop restart tanpa batas ──
    if (err.code === 'EADDRINUSE') {
      console.error(`[FATAL] Port ${PORT} sudah dipakai proses lain! Jalankan: sudo fuser -k ${PORT}/tcp`);
      console.error('[FATAL] Server tidak dapat start — menghentikan proses tanpa restart otomatis.');
      process.exit(1);
    }
    app.log.error(err);
    process.exit(1);
  }
}

startServer();
