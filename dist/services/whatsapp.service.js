"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.waGateway = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const pino_1 = __importDefault(require("pino"));
const qrcode_1 = __importDefault(require("qrcode"));
const events_1 = require("events");
const AUTH_DIR = path_1.default.join(__dirname, '../../wa_auth');
class WhatsappService extends events_1.EventEmitter {
    sock = null;
    qrBase64 = null;
    connectionStatus = 'disconnected';
    connectedNumber = null;
    isInitialized = false;
    retryCount = 0;
    MAX_RETRY = 10;
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
                if (shouldReconnect && this.retryCount < this.MAX_RETRY) {
                    this.retryCount++;
                    const delay = Math.min(5000 * this.retryCount, 30000);
                    console.log(`[WA] Mencoba reconnect ke-${this.retryCount} dalam ${delay / 1000}s...`);
                    setTimeout(() => this.connect(), delay);
                }
                else if (statusCode === DisconnectReason.loggedOut) {
                    console.log('[WA] Sesi di-logout. Hapus auth state dan scan ulang.');
                    this.clearAuthState();
                    setTimeout(() => this.connect(), 3000);
                }
            }
        });
        this.sock.ev.on('creds.update', saveCreds);
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
    async sendMessage(nomor, pesan) {
        if (this.connectionStatus !== 'connected' || !this.sock) {
            throw new Error('WhatsApp Gateway belum terhubung.');
        }
        const jid = nomor.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        try {
            await this.sock.sendMessage(jid, { text: pesan });
            console.log(`[WA] Pesan terkirim ke ${nomor}`);
            return true;
        }
        catch (err) {
            console.error(`[WA] Gagal kirim pesan ke ${nomor}:`, err.message);
            throw err;
        }
    }
    async reconnect() {
        console.log('[WA] Memulai ulang koneksi WA...');
        if (this.sock) {
            try {
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
            fs_1.default.readdirSync(AUTH_DIR).forEach(f => {
                fs_1.default.unlinkSync(path_1.default.join(AUTH_DIR, f));
            });
            console.log('[WA] Auth state dihapus.');
        }
    }
    getStatus() {
        return {
            status: this.connectionStatus,
            number: this.connectedNumber,
            has_qr: !!this.qrBase64
        };
    }
    getQRBase64() {
        return this.qrBase64;
    }
}
exports.waGateway = new WhatsappService();
