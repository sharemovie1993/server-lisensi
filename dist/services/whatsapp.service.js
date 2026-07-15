"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.waGateway = void 0;
const path_1 = __importDefault(require("path"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const fs_1 = __importDefault(require("fs"));
const pino_1 = __importDefault(require("pino"));
const qrcode_1 = __importDefault(require("qrcode"));
const events_1 = require("events");
const wa_bot_service_1 = require("./wa-bot.service");
const AUTH_DIR = path_1.default.join(__dirname, '../../wa_auth');
class WhatsappService extends events_1.EventEmitter {
    sock = null;
    qrBase64 = null;
    connectionStatus = 'disconnected';
    connectedNumber = null;
    isInitialized = false;
    retryCount = 0;
    MAX_RETRY = 10;
    messagesSentToday = 0;
    messagesFailedToday = 0;
    constructor() {
        super();
    }
    ensureAuthDir() {
        if (!fs_1.default.existsSync(AUTH_DIR)) {
            fs_1.default.mkdirSync(AUTH_DIR, { recursive: true });
        }
    }
    async generateQRBase64(qrString) {
        try {
            this.qrBase64 = await qrcode_1.default.toDataURL(qrString, { width: 300, margin: 2 });
            return this.qrBase64;
        }
        catch (e) {
            console.error('[WA] Gagal generate QR image:', e.message);
            return null;
        }
    }
    async connect() {
        this.ensureAuthDir();
        // Clean up any existing socket/listeners first to prevent duplicate loops
        if (this.sock) {
            try {
                this.sock.ev.removeAllListeners('connection.update');
                this.sock.ev.removeAllListeners('creds.update');
                this.sock.end();
            }
            catch (_) { }
            this.sock = null;
        }
        const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = await import('@whiskeysockets/baileys');
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        const { version } = await fetchLatestBaileysVersion();
        console.log(`[WA] Menghubungkan ke WhatsApp (v${version.join('.')})...`);
        this.connectionStatus = 'connecting';
        this.qrBase64 = null;
        this.sock = makeWASocket({
            version,
            logger: (0, pino_1.default)({ level: 'silent' }),
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, (0, pino_1.default)({ level: 'silent' }))
            },
            browser: ['Easy Tunnel Server', 'Chrome', '120.0.0'],
            connectTimeoutMs: 30000,
            keepAliveIntervalMs: 15000,
            retryRequestDelayMs: 2000
        });
        this.sock.ev.on('connection.update', async (update) => {
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
                    }
                    else {
                        console.log('[WA] Max retry tercapai. Mencoba reconnect berkala setiap 60s...');
                        setTimeout(() => this.connect(), 60000);
                    }
                }
                else if (statusCode === DisconnectReason.loggedOut) {
                    console.log('[WA] Sesi di-logout. Hapus auth state dan scan ulang.');
                    this.clearAuthState();
                    setTimeout(() => this.connect(), 3000);
                }
            }
        });
        this.sock.ev.on('creds.update', saveCreds);
        this.sock.ev.on('contacts.upsert', (contacts) => {
            try {
                const { registerLidMapping } = require('./wa-bot.service');
                for (const contact of contacts) {
                    if (contact.id && contact.lid) {
                        registerLidMapping(contact.lid, contact.id);
                    }
                }
            }
            catch (err) {
                console.error('[WA] Error in contacts.upsert listener:', err.message);
            }
        });
        this.sock.ev.on('contacts.update', (contacts) => {
            try {
                const { registerLidMapping } = require('./wa-bot.service');
                for (const contact of contacts) {
                    if (contact.id && contact.lid) {
                        registerLidMapping(contact.lid, contact.id);
                    }
                }
            }
            catch (err) {
                console.error('[WA] Error in contacts.update listener:', err.message);
            }
        });
        // ── Interactive bot: listen to incoming messages ──────────────────────
        this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify')
                return;
            for (const msg of messages) {
                if (msg.key.fromMe)
                    continue; // abaikan pesan dari diri sendiri
                if (!msg.message)
                    continue;
                const fromJid = msg.key.remoteJid || '';
                const altJid = msg.key.remoteJidAlt || fromJid;
                const text = msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text ||
                    '';
                if (!text.trim())
                    continue;
                console.log(`[WA-BOT] Pesan masuk dari ${fromJid} (Alt: ${altJid}): "${text.trim()}"`);
                console.log(`[WA-BOT] Debug MSG:`, JSON.stringify({ key: msg.key, participant: msg.participant, pushName: msg.pushName }));
                // Delegate to bot engine - use altJid for session resolution, but reply to fromJid
                await (0, wa_bot_service_1.handleIncomingMessage)(altJid, text, async (_toJid, pesan) => {
                    try {
                        await this.sock.sendMessage(fromJid, { text: pesan });
                        this.messagesSentToday++;
                    }
                    catch (e) {
                        this.messagesFailedToday++;
                        console.error('[WA-BOT] Gagal kirim balasan:', e.message);
                    }
                }).catch(err => console.error('[WA-BOT] Error handler:', err.message));
            }
        });
    }
    async init() {
        if (this.isInitialized)
            return;
        this.isInitialized = true;
        try {
            await this.connect();
        }
        catch (err) {
            console.error('[WA] Gagal inisialisasi:', err.message);
        }
    }
    async sendMessage(nomor, pesan, triggerType = 'SYSTEM', productId) {
        if (this.connectionStatus !== 'connected' || !this.sock) {
            const errMsg = 'WhatsApp Gateway belum terhubung.';
            try {
                await prisma.whatsAppLog.create({
                    data: {
                        recipient: nomor,
                        message: pesan,
                        status: 'FAILED',
                        errorMessage: errMsg,
                        triggerType,
                        productId
                    }
                });
            }
            catch (e) {
                console.error('[WA LOG DB ERROR]', e.message);
            }
            throw new Error(errMsg);
        }
        // Clean all non-numeric characters and format to international format (62)
        let cleaned = nomor.replace(/[^0-9]/g, '');
        if (cleaned.startsWith('08')) {
            cleaned = '62' + cleaned.slice(1);
        }
        else if (cleaned.startsWith('8') && cleaned.length >= 9) {
            cleaned = '62' + cleaned;
        }
        const jid = cleaned + '@s.whatsapp.net';
        try {
            const sentMsg = await this.sock.sendMessage(jid, { text: pesan });
            this.messagesSentToday++;
            console.log(`[WA] Pesan terkirim ke ${nomor} (JID: ${jid})`);
            // Log success to DB
            try {
                await prisma.whatsAppLog.create({
                    data: {
                        recipient: nomor,
                        message: pesan,
                        status: 'SENT',
                        triggerType,
                        productId
                    }
                });
            }
            catch (e) {
                console.error('[WA LOG DB ERROR]', e.message);
            }
            // Resolve dynamic LID mapping if returned from server
            if (sentMsg && sentMsg.key && sentMsg.key.remoteJid) {
                const actualJid = sentMsg.key.remoteJid;
                if (actualJid.endsWith('@lid')) {
                    const { registerLidMapping } = require('./wa-bot.service');
                    registerLidMapping(actualJid, nomor);
                }
            }
            return true;
        }
        catch (err) {
            this.messagesFailedToday++;
            console.error(`[WA] Gagal kirim pesan ke ${nomor} (JID: ${jid}):`, err.message);
            // Log failure to DB
            try {
                await prisma.whatsAppLog.create({
                    data: {
                        recipient: nomor,
                        message: pesan,
                        status: 'FAILED',
                        errorMessage: err.message,
                        triggerType,
                        productId
                    }
                });
            }
            catch (e) {
                console.error('[WA LOG DB ERROR]', e.message);
            }
            throw err;
        }
    }
    async reconnect() {
        console.log('[WA] Memulai ulang koneksi WA...');
        if (this.sock) {
            try {
                this.sock.ev.removeAllListeners('connection.update');
                this.sock.ev.removeAllListeners('creds.update');
                this.sock.end();
            }
            catch (_) { }
            this.sock = null;
        }
        this.clearAuthState();
        this.retryCount = 0;
        this.isInitialized = false;
        await this.init();
    }
    clearAuthState() {
        if (fs_1.default.existsSync(AUTH_DIR)) {
            try {
                fs_1.default.rmSync(AUTH_DIR, { recursive: true, force: true });
                console.log('[WA] Auth state directory removed.');
            }
            catch (e) {
                console.error('[WA] Gagal hapus auth dir:', e.message);
            }
        }
        this.ensureAuthDir();
    }
    getStatus() {
        return {
            status: this.connectionStatus,
            number: this.connectedNumber,
            has_qr: !!this.qrBase64,
            sentToday: this.messagesSentToday,
            failedToday: this.messagesFailedToday
        };
    }
    getQRBase64() {
        return this.qrBase64;
    }
}
exports.waGateway = new WhatsappService();
