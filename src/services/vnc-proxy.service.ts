import WebSocket from 'ws';
import net from 'net';
import { PrismaClient } from '@prisma/client';
import { FastifyInstance } from 'fastify';

const prisma = new PrismaClient();

export function setupVncProxy(fastify: FastifyInstance): void {
  const wss = new WebSocket.Server({ noServer: true });

  // Handle upgrade requests for path: /api/vnc/connect/:licenseKey
  fastify.server.on('upgrade', (request, socket, head) => {
    const host = request.headers.host || 'localhost';
    const url = new URL(request.url || '', `http://${host}`);
    const pathname = url.pathname;

    const match = pathname.match(/^\/api\/vnc\/connect\/([A-Z0-9-]+)/);
    if (match) {
      const licenseKey = match[1];
      wss.handleUpgrade(request, socket, head, (ws: any) => {
        wss.emit('connection', ws, request, licenseKey);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', async (ws: WebSocket, _request: any, licenseKey: string) => {
    console.log(`[VNC Proxy] Incoming WS connection for license: ${licenseKey}`);

    try {
      // 1. Fetch active WireGuard IP for this license from PostgreSQL
      const license = await prisma.license.findFirst({
        where: {
          licenseKey: licenseKey,
          isActive: 1
        },
        select: {
          wireguardIp: true
        }
      });

      if (!license || !license.wireguardIp) {
        console.warn(`[VNC Proxy] License ${licenseKey} tidak ditemukan, tidak aktif, atau belum dipasang.`);
        ws.close(4001, 'Lisensi tidak valid atau belum dipasang di PC klien.');
        return;
      }

      const targetHost = license.wireguardIp;
      const targetPort = 5900;

      console.log(`[VNC Proxy] Bridging WS to TCP VNC Server at ${targetHost}:${targetPort}`);

      // 2. Connect to TightVNC server local in client PC via WireGuard VPN IP
      const tcpSocket = net.connect({ host: targetHost, port: targetPort }, () => {
        console.log(`[VNC Proxy] TCP connected to ${targetHost}:${targetPort}`);
      });

      // Set binary mode
      ws.binaryType = 'arraybuffer';

      // Bridge WS -> TCP
      ws.on('message', (message: WebSocket.Data) => {
        const data = Buffer.isBuffer(message) ? message : Buffer.from(message as ArrayBuffer);
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

      ws.on('error', (err: any) => {
        console.error(`[VNC Proxy] WS error for ${licenseKey}:`, err.message);
        tcpSocket.end();
      });

    } catch (err: any) {
      console.error('[VNC Proxy Fatal Connection Error]', err);
      ws.close(4003, 'Gagal menghubungkan proxy VNC.');
    }
  });

  console.log('[VNC Proxy] WebSocket proxy server initialized successfully.');
}
