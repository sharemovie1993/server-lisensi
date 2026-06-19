// services/waGateway.js
// Self-hosted WhatsApp Gateway menggunakan @whiskeysockets/baileys
// Singleton pattern — hanya 1 koneksi WA per proses server

'use strict';

const path = require('path');
const fs = require('fs');
const pino = require('pino');
const qrcode = require('qrcode');
const { EventEmitter } = require('events');

// ─── State ────────────────────────────────────────────────────────────────────
let sock = null;
let currentQR = null;          // QR string terbaru (belum di-scan)
let qrBase64 = null;           // QR sebagai gambar Base64 PNG
let connectionStatus = 'disconnected'; // 'connecting' | 'connected' | 'disconnected'
let connectedNumber = null;    // Nomor WA yang terhubung
let isInitialized = false;
let retryCount = 0;
const MAX_RETRY = 10;
const AUTH_DIR = path.join(__dirname, '../wa_auth');

const emitter = new EventEmitter();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureAuthDir() {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
}

async function generateQRBase64(qrString) {
  try {
    qrBase64 = await qrcode.toDataURL(qrString, { width: 300, margin: 2 });
    return qrBase64;
  } catch (e) {
    console.error('[WA] Gagal generate QR image:', e.message);
    return null;
  }
}

// ─── Init & Connect ───────────────────────────────────────────────────────────

async function connect() {
  ensureAuthDir();

  // Import Baileys (ESM → pakai dynamic import)
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
  } = await import('@whiskeysockets/baileys');

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  console.log(`[WA] Menghubungkan ke WhatsApp (v${version.join('.')})...`);
  connectionStatus = 'connecting';
  currentQR = null;
  qrBase64 = null;

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }), // Sembunyikan log verbose Baileys
    printQRInTerminal: false,           // Kita handle sendiri via admin panel
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    browser: ['Easy Tunnel Server', 'Chrome', '120.0.0'],
    connectTimeoutMs: 30000,
    keepAliveIntervalMs: 15000,
    retryRequestDelayMs: 2000
  });

  // ── Event: QR Code ──
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      await generateQRBase64(qr);
      connectionStatus = 'connecting';
      console.log('[WA] QR Code tersedia — silakan scan di Admin Panel.');
      emitter.emit('qr', qrBase64);
    }

    if (connection === 'open') {
      connectionStatus = 'connected';
      currentQR = null;
      qrBase64 = null;
      retryCount = 0;
      connectedNumber = sock.user?.id?.split(':')[0] || null;
      console.log(`[WA] ✅ Terhubung sebagai: ${connectedNumber}`);
      emitter.emit('connected', connectedNumber);
    }

    if (connection === 'close') {
      connectionStatus = 'disconnected';
      connectedNumber = null;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`[WA] Koneksi terputus (kode: ${statusCode}). Reconnect: ${shouldReconnect}`);
      emitter.emit('disconnected', statusCode);

      if (shouldReconnect && retryCount < MAX_RETRY) {
        retryCount++;
        const delay = Math.min(5000 * retryCount, 30000);
        console.log(`[WA] Mencoba reconnect ke-${retryCount} dalam ${delay / 1000}s...`);
        setTimeout(connect, delay);
      } else if (statusCode === DisconnectReason.loggedOut) {
        console.log('[WA] Sesi di-logout. Hapus auth state dan scan ulang.');
        clearAuthState();
        setTimeout(connect, 3000);
      }
    }
  });

  // ── Event: Simpan credentials ──
  sock.ev.on('creds.update', saveCreds);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Inisialisasi WA Gateway (dipanggil sekali saat server start)
 */
async function init() {
  if (isInitialized) return;
  isInitialized = true;
  try {
    await connect();
  } catch (err) {
    console.error('[WA] Gagal inisialisasi:', err.message);
  }
}

/**
 * Kirim pesan teks ke nomor WA
 * @param {string} nomor - format: 6281234567890 (tanpa + atau spasi)
 * @param {string} pesan - teks pesan
 */
async function sendMessage(nomor, pesan) {
  if (connectionStatus !== 'connected' || !sock) {
    throw new Error('WhatsApp Gateway belum terhubung.');
  }
  // Format JID WhatsApp
  const jid = nomor.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  try {
    await sock.sendMessage(jid, { text: pesan });
    console.log(`[WA] Pesan terkirim ke ${nomor}`);
    return true;
  } catch (err) {
    console.error(`[WA] Gagal kirim pesan ke ${nomor}:`, err.message);
    throw err;
  }
}

/**
 * Paksa reconnect (reset session + scan ulang)
 */
async function reconnect() {
  console.log('[WA] Memulai ulang koneksi WA...');
  if (sock) {
    try { sock.end(); } catch (_) {}
    sock = null;
  }
  clearAuthState();
  retryCount = 0;
  isInitialized = false;
  await init();
}

/**
 * Hapus semua file auth state (untuk logout / scan ulang)
 */
function clearAuthState() {
  if (fs.existsSync(AUTH_DIR)) {
    fs.readdirSync(AUTH_DIR).forEach(f => {
      fs.unlinkSync(path.join(AUTH_DIR, f));
    });
    console.log('[WA] Auth state dihapus.');
  }
}

/**
 * Ambil status koneksi
 */
function getStatus() {
  return {
    status: connectionStatus,
    number: connectedNumber,
    has_qr: !!qrBase64
  };
}

/**
 * Ambil QR Base64 untuk ditampilkan di admin panel
 */
function getQRBase64() {
  return qrBase64;
}

/**
 * Subscribe ke event WA
 */
function on(event, listener) {
  emitter.on(event, listener);
}

module.exports = {
  init,
  sendMessage,
  reconnect,
  getStatus,
  getQRBase64,
  clearAuthState,
  on
};
