const WebSocket = require('ws');
const net = require('net');
const { db } = require('../config/db');

function setupVncProxy(server) {
  const wss = new WebSocket.Server({ noServer: true });

  // Handle upgrade requests for path: /api/vnc/connect/:licenseKey
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    const match = pathname.match(/^\/api\/vnc\/connect\/([A-Z0-9-]+)/);
    if (match) {
      const licenseKey = match[1];
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, licenseKey);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', async (ws, request, licenseKey) => {
    console.log(`[VNC Proxy] Incoming WS connection for license: ${licenseKey}`);

    try {
      // 1. Ambil IP WireGuard aktif untuk lisensi ini
      const license = await db.get(
        "SELECT wireguard_ip, is_active FROM licenses WHERE license_key = ? AND is_active = 1",
        [licenseKey]
      );

      if (!license || !license.wireguard_ip) {
        console.warn(`[VNC Proxy] License ${licenseKey} tidak ditemukan, tidak aktif, atau belum dipasang.`);
        ws.close(4001, 'Lisensi tidak valid atau belum dipasang di PC klien.');
        return;
      }

      const targetHost = license.wireguard_ip;
      const targetPort = 5900;

      console.log(`[VNC Proxy] Bridging WS to TCP VNC Server at ${targetHost}:${targetPort}`);

      // 2. Koneksi ke TightVNC server lokal di PC klien via IP WireGuard VPN
      const tcpSocket = net.connect({ host: targetHost, port: targetPort }, () => {
        console.log(`[VNC Proxy] TCP connected to ${targetHost}:${targetPort}`);
      });

      // Set binary mode
      ws.binaryType = 'arraybuffer';

      // Bridge WS -> TCP
      ws.on('message', (message) => {
        // ws can pass message as Buffer, ArrayBuffer, or Array of Buffer depending on library version
        const data = Buffer.isBuffer(message) ? message : Buffer.from(message);
        if (tcpSocket.writable) {
          tcpSocket.write(data);
        }
      });

      // Bridge TCP -> WS
      tcpSocket.on('data', (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      // Cleanup & Error Handlers
      ws.on('close', () => {
        console.log(`[VNC Proxy] WS closed for ${licenseKey}`);
        tcpSocket.end();
      });

      tcpSocket.on('end', () => {
        console.log(`[VNC Proxy] TCP ended for ${licenseKey}`);
        ws.close();
      });

      tcpSocket.on('error', (err) => {
        console.error(`[VNC Proxy] TCP error for ${licenseKey}:`, err.message);
        ws.close(4002, 'Koneksi ke VNC Server di komputer target gagal.');
      });

      ws.on('error', (err) => {
        console.error(`[VNC Proxy] WS error for ${licenseKey}:`, err.message);
        tcpSocket.end();
      });

    } catch (err) {
      console.error('[VNC Proxy Fatal Connection Error]', err);
      ws.close(4003, 'Gagal menghubungkan proxy VNC.');
    }
  });

  console.log('[VNC Proxy] WebSocket proxy server initialized successfully.');
}

module.exports = setupVncProxy;
