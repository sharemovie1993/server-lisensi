"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendLicenseWhatsAppNotification = exports.prisma = void 0;
exports.normalizeProductId = normalizeProductId;
exports.getProductPrefix = getProductPrefix;
exports.formatWA = formatWA;
exports.verifyClient = verifyClient;
const client_1 = require("@prisma/client");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const whatsapp_service_1 = require("../../services/whatsapp.service");
const keys_1 = require("../../utils/keys");
exports.prisma = new client_1.PrismaClient();
/**
 * Normalisasi alias product ID yang tidak konsisten.
 * Contoh: 'platform-absenta' → 'absenta'
 * Tambahkan alias baru di sini jika ada produk dengan dua ID.
 */
function normalizeProductId(productId) {
    const aliases = {
        'platform-absenta': 'absenta',
    };
    return aliases[productId] ?? productId;
}
/**
 * Ambil prefix license key dari tabel Product secara dinamis.
 * Fallback ke 3 huruf pertama productId jika tidak ditemukan.
 */
async function getProductPrefix(productId) {
    const normalizedId = normalizeProductId(productId);
    try {
        const product = await exports.prisma.product.findUnique({ where: { id: normalizedId } });
        if (product?.prefix)
            return product.prefix;
    }
    catch (e) {
        console.warn(`[getProductPrefix] Gagal baca prefix '${normalizedId}':`, e.message);
    }
    // Fallback: 3 huruf pertama dari productId
    return normalizedId.slice(0, 3).toUpperCase();
}
function formatWA(nomor) {
    if (!nomor)
        return '';
    let clean = nomor.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
        clean = '62' + clean.slice(1);
    }
    return clean;
}
async function verifyClient(request, reply) {
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ success: false, message: 'Harap masuk terlebih dahulu.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, keys_1.ADMIN_SECRET + '_client_session');
        if (decoded && decoded.nomor) {
            request.operator = decoded;
            return;
        }
    }
    catch (err) {
        return reply.status(401).send({ success: false, message: 'Sesi login telah berakhir. Silakan masuk kembali.' });
    }
    return reply.status(401).send({ success: false, message: 'Sesi login tidak valid.' });
}
const sendLicenseWhatsAppNotification = async (phone, schoolName, slug, prodId, planName, key, invoiceNum, amount, paymentMethod, status, payCode, qrUrl) => {
    try {
        const amountFormatted = amount === 0 ? 'Rp 0 (Gratis)' : `Rp ${amount.toLocaleString('id-ID')}`;
        const productLabel = prodId === 'absenta' ? 'Platform Cakola' : (prodId === 'easy-tunnel' ? 'Easy Tunnel' : prodId.toUpperCase());
        let paymentStatusNotes = '';
        if (status === 'paid') {
            paymentStatusNotes = '*Status*: ✅ *LUNAS* (Lisensi Aktif)';
        }
        else {
            paymentStatusNotes = `*Status*: ⚠️ *MENUNGGU PEMBAYARAN*\n`;
            if (paymentMethod.toLowerCase() === 'manual') {
                paymentStatusNotes += `Silakan lakukan transfer manual ke rekening BNI yang tertera di panel/dashboard, lalu unggah/kirim bukti transfer ke Admin untuk konfirmasi manual.`;
            }
            else {
                if (payCode) {
                    paymentStatusNotes += `*Kode Bayar / VA*: *${payCode}*\n`;
                }
                if (qrUrl) {
                    paymentStatusNotes += `*QR Code Link*: ${qrUrl}\n`;
                }
                paymentStatusNotes += `Silakan lakukan pembayaran melalui metode ${paymentMethod} sesuai petunjuk di panel.`;
            }
        }
        const message = `*🔑 [Platform Cakola] PENGAJUAN LISENSI BARU*

Halo! Pengajuan lisensi server Anda telah berhasil diproses. Berikut adalah rincian lisensi Anda:

* Nama Sekolah: *${schoolName}*
* Subdomain: *${slug ? slug + '.absenta.id' : '-'}*
* Produk: *${productLabel}*
* Paket/Plan: *${planName}*
* Lisensi Key: \`${key}\`

----------------------------------
*Rincian Tagihan:*
* Nomor Invoice: *${invoiceNum}*
* Total Biaya: *${amountFormatted}*
* Metode Pembayaran: *${paymentMethod}*
${paymentStatusNotes}

Terima kasih telah menggunakan layanan kami!`;
        await whatsapp_service_1.waGateway.sendMessage(phone, message);
    }
    catch (err) {
        console.error('[WA Notification Error]', err.message);
    }
};
exports.sendLicenseWhatsAppNotification = sendLicenseWhatsAppNotification;
