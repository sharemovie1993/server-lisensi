"use strict";
/**
 * wa-bot.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive WhatsApp Bot untuk manajemen lisensi trial Absenta.
 *
 * Alur percakapan:
 *  1. Sistem mengirim pesan peringatan dengan menu angka pilihan.
 *  2. Operator membalas dengan angka: 1, 2, atau 3.
 *  3. Bot mengeksekusi aksi dan mengkonfirmasi hasilnya.
 *
 * State per nomor disimpan di in-memory Map dengan TTL 24 jam.
 * ─────────────────────────────────────────────────────────────────────────────
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSession = registerSession;
exports.handleIncomingMessage = handleIncomingMessage;
exports.buildWarningMessage = buildWarningMessage;
exports.buildDeletionMessage = buildDeletionMessage;
const client_1 = require("@prisma/client");
const caddy_service_1 = require("./caddy.service");
const prisma = new client_1.PrismaClient();
// ─── In-memory session store (phone → pending action) ─────────────────────────
// Key: cleaned phone number (e.g. "6281234567890")
const pendingSessions = new Map();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 jam
// ─── Utility ─────────────────────────────────────────────────────────────────
function cleanPhone(nomor) {
    let cleaned = nomor.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('08'))
        cleaned = '62' + cleaned.slice(1);
    else if (cleaned.startsWith('8') && cleaned.length >= 9)
        cleaned = '62' + cleaned;
    return cleaned;
}
function formatPhone(nomor) {
    // Normalize incoming JID (e.g. "628123@s.whatsapp.net") to plain number
    return nomor.replace(/@.*$/, '').replace(/[^0-9]/g, '');
}
// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Daftarkan sesi interaktif untuk satu lisensi.
 * Dipanggil dari cron.service.ts saat mengirim pesan peringatan.
 */
function registerSession(phone, licenseId, licenseKey, schoolName, requestedSlug) {
    const cleaned = cleanPhone(phone);
    pendingSessions.set(cleaned, {
        licenseId,
        licenseKey,
        schoolName,
        requestedSlug,
        expiresAt: Date.now() + SESSION_TTL_MS
    });
    console.log(`[WA-BOT] Session registered for ${cleaned} → ${schoolName} (${licenseKey})`);
}
/**
 * Proses balasan masuk dari operator.
 * Dipanggil oleh whatsapp.service.ts lewat event 'messages.upsert'.
 *
 * @returns Teks balasan yang harus dikirim balik, atau null jika bukan pesan bot.
 */
async function handleIncomingMessage(fromJid, text, sendReply) {
    const phone = formatPhone(fromJid);
    const session = pendingSessions.get(phone);
    if (!session)
        return; // bukan sesi bot yang aktif
    // Cek apakah sesi sudah kadaluwarsa
    if (Date.now() > session.expiresAt) {
        pendingSessions.delete(phone);
        await sendReply(fromJid, `⏰ *Sesi habis waktu.*\n\nSilakan tunggu notifikasi berikutnya dari sistem Absenta.`);
        return;
    }
    const cmd = text.trim();
    if (cmd === '1') {
        // ── Operator konfirmasi: server masih dipakai ─────────────────────────
        pendingSessions.delete(phone);
        console.log(`[WA-BOT] ${phone} menjawab KEEP untuk ${session.licenseKey}`);
        // Perbarui lastHeartbeatAt agar tidak kena hapus di siklus berikutnya
        // (memberi jeda 7 hari lagi tanpa heartbeat nyata)
        await prisma.license.update({
            where: { id: session.licenseId },
            data: { lastHeartbeatAt: new Date() }
        }).catch(() => { });
        await sendReply(fromJid, `✅ *Konfirmasi diterima!*\n\n` +
            `Server *${session.schoolName}* ditandai masih aktif digunakan.\n` +
            `Sistem tidak akan menghapus lisensi ini dalam 7 hari ke depan.\n\n` +
            `Pastikan server Anda kembali menyala dan terkoneksi ke jaringan secepatnya ya! 🙏`);
    }
    else if (cmd === '2') {
        // ── Operator konfirmasi: server sudah tidak dipakai ───────────────────
        pendingSessions.delete(phone);
        console.log(`[WA-BOT] ${phone} menjawab IGNORE untuk ${session.licenseKey}`);
        // Tandai status lisensi menjadi 'inactive' agar mudah diidentifikasi
        await prisma.license.update({
            where: { id: session.licenseId },
            data: { status: 'inactive' }
        }).catch(() => { });
        await sendReply(fromJid, `📋 *Terima kasih atas konfirmasinya.*\n\n` +
            `Server *${session.schoolName}* telah ditandai sebagai *tidak aktif*.\n` +
            `Data lisensi ini akan dibersihkan otomatis oleh sistem dalam waktu dekat.\n\n` +
            `Jika Anda ingin menggunakan Absenta kembali di masa mendatang, silakan hubungi tim kami. 😊`);
    }
    else if (cmd === '3') {
        // ── Operator minta hapus sekarang ─────────────────────────────────────
        pendingSessions.delete(phone);
        console.log(`[WA-BOT] ${phone} menjawab DELETE_NOW untuk ${session.licenseKey}`);
        await sendReply(fromJid, `🗑️ *Permintaan hapus diterima. Memproses...*\n\n` +
            `Menghapus data lisensi *${session.schoolName}* \`${session.licenseKey}\`...`);
        try {
            await prisma.subscription.deleteMany({ where: { licenseId: session.licenseId } });
            await prisma.invoice.deleteMany({ where: { licenseId: session.licenseId } });
            await prisma.activatedDevice.deleteMany({ where: { licenseId: session.licenseId } });
            await prisma.license.delete({ where: { id: session.licenseId } });
            await (0, caddy_service_1.triggerCaddySync)();
            await sendReply(fromJid, `✅ *Berhasil dihapus!*\n\n` +
                `Data lisensi *${session.schoolName}* (\`${session.licenseKey}\`) telah dihapus dari sistem.\n\n` +
                `Subdomain \`${session.requestedSlug || '-'}\` juga telah dilepas.\n\n` +
                `Terima kasih telah menggunakan Absenta! 🙏`);
        }
        catch (err) {
            console.error('[WA-BOT] Gagal hapus lisensi via bot:', err.message);
            await sendReply(fromJid, `❌ *Gagal menghapus data.*\n\nTerjadi kesalahan: ${err.message}\nSilakan hubungi administrator sistem.`);
        }
    }
    else {
        // ── Balasan tidak dikenali — tampilkan menu ulang ─────────────────────
        await sendReply(fromJid, buildMenuMessage(session.schoolName, session.licenseKey));
    }
}
/**
 * Buat teks pesan peringatan interaktif yang berisi menu pilihan.
 * Dipanggil dari cron.service.ts.
 */
function buildWarningMessage(schoolName, licenseKey, heartbeatAgeDays) {
    return (`⚠️ *[ABSENTA — Peringatan Server Tidak Aktif]*\n\n` +
        `Halo, Operator *${schoolName}*! 👋\n\n` +
        `Server Absenta Anda tidak terdeteksi aktif selama *${heartbeatAgeDays} hari*.\n` +
        `License Key: \`${licenseKey}\`\n\n` +
        `📌 Jika server tidak aktif selama *14 hari*, data lisensi ini akan *dihapus otomatis*.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `*Silakan balas dengan angka:*\n\n` +
        `1️⃣  *1* — Server masih saya pakai, jangan hapus\n` +
        `2️⃣  *2* — Server sudah tidak saya pakai\n` +
        `3️⃣  *3* — Hapus sekarang\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `_Balasan hanya berlaku selama 24 jam._`);
}
/**
 * Buat teks pesan notifikasi penghapusan (sebelum auto-delete).
 * Dipanggil dari cron.service.ts.
 */
function buildDeletionMessage(schoolName, licenseKey, requestedSlug) {
    return (`🗑️ *[ABSENTA — Lisensi Trial Dihapus Otomatis]*\n\n` +
        `Kepada Operator *${schoolName}*,\n\n` +
        `Data lisensi percobaan berikut telah *dihapus otomatis* oleh sistem karena tidak ada aktivitas server lebih dari 14 hari.\n\n` +
        `License Key: \`${licenseKey}\`\n` +
        `Slug/Node: \`${requestedSlug || '-'}\`\n\n` +
        `Jika ini kesalahan atau Anda ingin melanjutkan layanan Absenta, silakan hubungi tim kami.\n\n` +
        `Terima kasih. 🙏`);
}
// ─── Private helpers ──────────────────────────────────────────────────────────
function buildMenuMessage(schoolName, licenseKey) {
    return (`🤖 *Maaf, balasan tidak dikenali.*\n\n` +
        `Silakan balas dengan salah satu angka berikut untuk lisensi *${schoolName}* (\`${licenseKey}\`):\n\n` +
        `1️⃣  *1* — Server masih saya pakai, jangan hapus\n` +
        `2️⃣  *2* — Server sudah tidak saya pakai\n` +
        `3️⃣  *3* — Hapus sekarang\n\n` +
        `_Sesi aktif selama 24 jam sejak pesan pertama._`);
}
