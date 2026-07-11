import path from 'path';
import fs from 'fs';
import pino from 'pino';
import qrcode from 'qrcode';
import { EventEmitter } from 'events';
import { handleIncomingMessage } from './wa-bot.service';

const AUTH_DIR = path.join(__dirname, '../../wa_auth');

class WhatsappService extends EventEmitter {
  private sock: any = null;
  private qrBase64: string | null = null;
  private connectionStatus: 'connecting' | 'connected' | 'disconnected' = 'disconnected';
  private connectedNumber: string | null = null;
  private isInitialized = false;
  private retryCount = 0;
  private readonly MAX_RETRY = 10;
  private messagesSentToday = 0;
  private messagesFailedToday = 0;

  constructor() {
    super();
  }

  private ensureAuthDir() {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
  }

  private async generateQRBase64(qrString: string): Promise<string | null> {
    try {
      this.qrBase64 = await qrcode.toDataURL(qrString, { width: 300, margin: 2 });
      return this.qrBase64;
    } catch (e: any) {
      console.error('[WA] Gagal generate QR image:', e.message);
      return null;
    }
  }

  public async connect(): Promise<void> {
    this.ensureAuthDir();

    // Clean up any existing socket/listeners first to prevent duplicate loops
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners('connection.update');
        this.sock.ev.removeAllListeners('creds.update');
        this.sock.end();
      } catch (_) {}
      this.sock = null;
    }

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
    this.connectionStatus = 'connecting';
    this.qrBase64 = null;

    this.sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
      },
      browser: ['Easy Tunnel Server', 'Chrome', '120.0.0'],
      connectTimeoutMs: 30000,
      keepAliveIntervalMs: 15000,
      retryRequestDelayMs: 2000
    });

    this.sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        await this.generateQRBase64(qr);
        this.connectionStatus = 'connecting';
        console.log('[WA] QR Code tersedia — silakan scan di Admin Panel.');
        this.emit('qr', this.qrBase64);
      }

      if (connection === 'open') {
        this.connectionStatus = 'connected';
        this.qrBase64 = null;
        this.retryCount = 0;
        this.connectedNumber = this.sock.user?.id?.split(':')[0] || null;
        console.log(`[WA] ✅ Terhubung sebagai: ${this.connectedNumber}`);
        this.emit('connected', this.connectedNumber);
      }

      if (connection === 'close') {
        this.connectionStatus = 'disconnected';
        this.connectedNumber = null;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`[WA] Koneksi terputus (kode: ${statusCode}). Reconnect: ${shouldReconnect}`);
        this.emit('disconnected', statusCode);

        if (shouldReconnect) {
          if (this.retryCount < this.MAX_RETRY) {
            this.retryCount++;
            const delay = Math.min(5000 * this.retryCount, 30000);
            console.log(`[WA] Mencoba reconnect ke-${this.retryCount} dalam ${delay / 1000}s...`);
            setTimeout(() => this.connect(), delay);
          } else {
            console.log('[WA] Max retry tercapai. Mencoba reconnect berkala setiap 60s...');
            setTimeout(() => this.connect(), 60000);
          }
        } else if (statusCode === DisconnectReason.loggedOut) {
          console.log('[WA] Sesi di-logout. Hapus auth state dan scan ulang.');
          this.clearAuthState();
          setTimeout(() => this.connect(), 3000);
        }
      }
    });

    this.sock.ev.on('creds.update', saveCreds);

    // ── Interactive bot: listen to incoming messages ──────────────────────
    this.sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (msg.key.fromMe) continue;          // abaikan pesan dari diri sendiri
        if (!msg.message) continue;

        const fromJid: string = msg.key.remoteJid || '';
        const text: string =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          '';

        if (!text.trim()) continue;

        console.log(`[WA-BOT] Pesan masuk dari ${fromJid}: "${text.trim()}"`);

        // Delegate to bot engine
        await handleIncomingMessage(fromJid, text, async (toJid, pesan) => {
          try {
            await this.sock.sendMessage(toJid, { text: pesan });
            this.messagesSentToday++;
          } catch (e: any) {
            this.messagesFailedToday++;
            console.error('[WA-BOT] Gagal kirim balasan:', e.message);
          }
        }).catch(err => console.error('[WA-BOT] Error handler:', err.message));
      }
    });
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
    try {
      await this.connect();
    } catch (err: any) {
      console.error('[WA] Gagal inisialisasi:', err.message);
    }
  }

  public async sendMessage(nomor: string, pesan: string): Promise<boolean> {
    if (this.connectionStatus !== 'connected' || !this.sock) {
      throw new Error('WhatsApp Gateway belum terhubung.');
    }

    // Clean all non-numeric characters and format to international format (62)
    let cleaned = nomor.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('08')) {
      cleaned = '62' + cleaned.slice(1);
    } else if (cleaned.startsWith('8') && cleaned.length >= 9) {
      cleaned = '62' + cleaned;
    }

    const jid = cleaned + '@s.whatsapp.net';
    try {
      await this.sock.sendMessage(jid, { text: pesan });
      this.messagesSentToday++;
      console.log(`[WA] Pesan terkirim ke ${nomor} (JID: ${jid})`);
      return true;
    } catch (err: any) {
      this.messagesFailedToday++;
      console.error(`[WA] Gagal kirim pesan ke ${nomor} (JID: ${jid}):`, err.message);
      throw err;
    }
  }

  public async reconnect(): Promise<void> {
    console.log('[WA] Memulai ulang koneksi WA...');
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners('connection.update');
        this.sock.ev.removeAllListeners('creds.update');
        this.sock.end();
      } catch (_) {}
      this.sock = null;
    }
    this.clearAuthState();
    this.retryCount = 0;
    this.isInitialized = false;
    await this.init();
  }

  public clearAuthState(): void {
    if (fs.existsSync(AUTH_DIR)) {
      try {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        console.log('[WA] Auth state directory removed.');
      } catch (e: any) {
        console.error('[WA] Gagal hapus auth dir:', e.message);
      }
    }
    this.ensureAuthDir();
  }

  public getStatus() {
    return {
      status: this.connectionStatus,
      number: this.connectedNumber,
      has_qr: !!this.qrBase64,
      sentToday: this.messagesSentToday,
      failedToday: this.messagesFailedToday
    };
  }

  public getQRBase64(): string | null {
    return this.qrBase64;
  }
}

export const waGateway = new WhatsappService();
