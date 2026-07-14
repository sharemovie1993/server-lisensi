import dotenv from 'dotenv';
import path from 'path';
import { exec } from 'child_process';
import { buildApp } from './app';
import { waGateway } from './services/whatsapp.service';
import { checkExpirations } from './services/cron.service';
import { setupVncProxy } from './services/vnc-proxy.service';
import { triggerCaddySync } from './services/caddy.service';

// Load .env variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const PORT = parseInt(process.env.PORT || '5001', 10);
const HOST = '0.0.0.0';

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
  setInterval(checkExpirations, 24 * 60 * 60 * 1000); // 24 hours daily cron loop

  // Initialize Firewall rules
  if (process.platform === 'linux') {
    initVpnFirewall();
  }

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`[LICENSE SERVER] SaaS Engine running securely on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

startServer();
