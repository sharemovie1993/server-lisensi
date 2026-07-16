/**
 * wa-bot.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive WhatsApp Bot untuk manajemen lisensi Absenta.
 *
 * Alur 1 — Trial Management:
 *  1. Sistem mengirim pesan peringatan dengan menu angka pilihan.
 *  2. Operator membalas dengan angka: 1, 2, atau 3.
 *  3. Bot mengeksekusi aksi dan mengkonfirmasi hasilnya.
 *
 * Alur 2 — Konfirmasi Pembayaran Manual:
 *  1. Sistem mengirim tagihan pending dengan instruksi "balas KONFIRMASI INV-xxx".
 *  2. User membalas keyword KONFIRMASI → bot minta upload bukti transfer.
 *  3. User kirim foto bukti → bot forward ke Owner, konfirmasi ke user.
 *
 * State per nomor disimpan di in-memory Map dengan TTL 24 jam.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client';
import { triggerCaddySync } from './caddy.service';

const prisma = new PrismaClient();

// ─── Types ────────────────────────────────────────────────────────────────────

export type BotActionCode = 'KEEP' | 'IGNORE' | 'DELETE_NOW';

interface PendingSession {
  licenseId: string;
  licenseKey: string;
  schoolName: string;
  requestedSlug: string | null;
  expiresAt: number;  // epoch ms — session TTL
}

/** Sesi konfirmasi pembayaran manual via upload bukti transfer */
interface PaymentConfirmSession {
  invoiceNumber: string;
  licenseKey: string;
  schoolName: string;
  productId: string;
  phone: string;
  step: 'awaiting_proof';  // user sudah ketik KONFIRMASI, menunggu kirim foto
  expiresAt: number;
}

// ─── In-memory session stores ─────────────────────────────────────────────────
// Key: cleaned phone number (e.g. "6281234567890")
const pendingSessions = new Map<string, PendingSession>();

/** Sesi konfirmasi pembayaran: phone → PaymentConfirmSession */
const paymentConfirmSessions = new Map<string, PaymentConfirmSession>();

// Mapping untuk WhatsApp LID (List Identifier) ke nomor HP
const lidToPhoneMap = new Map<string, string>();

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 jam

// ─── Utility ─────────────────────────────────────────────────────────────────

function cleanPhone(nomor: string): string {
  let cleaned = nomor.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('08')) cleaned = '62' + cleaned.slice(1);
  else if (cleaned.startsWith('8') && cleaned.length >= 9) cleaned = '62' + cleaned;
  return cleaned;
}

function formatPhone(nomor: string): string {
  // Normalize incoming JID (e.g. "628123@s.whatsapp.net") to plain number
  return nomor.replace(/@.*$/, '').replace(/[^0-9]/g, '');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Daftarkan mapping LID ke nomor telepon asli.
 */
export function registerLidMapping(lidJidOrId: string, phone: string): void {
  const cleanLid = lidJidOrId.replace(/@.*$/, '').replace(/[^0-9]/g, '');
  const cleanPh = cleanPhone(phone);
  lidToPhoneMap.set(cleanLid, cleanPh);
  console.log(`[WA-BOT] Mapped LID: ${cleanLid} -> Phone: ${cleanPh}`);
}

/**
 * Daftarkan sesi interaktif untuk satu lisensi.
 * Dipanggil dari cron.service.ts saat mengirim pesan peringatan.
 */
export function registerSession(
  phone: string,
  licenseId: string,
  licenseKey: string,
  schoolName: string,
  requestedSlug: string | null
): void {
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
/**
 * Daftarkan sesi konfirmasi pembayaran untuk nomor telepon tertentu.
 * Dipanggil dari core.routes.ts saat order dengan pembayaran pending dibuat.
 */
export function registerPaymentConfirmSession(
  phone: string,
  invoiceNumber: string,
  licenseKey: string,
  schoolName: string,
  productId: string
): void {
  const cleaned = cleanPhone(phone);
  paymentConfirmSessions.set(cleaned, {
    invoiceNumber,
    licenseKey,
    schoolName,
    productId,
    phone: cleaned,
    step: 'awaiting_proof',
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  console.log(`[WA-BOT] PaymentConfirm session registered for ${cleaned} → Invoice: ${invoiceNumber}`);
}

/**
 * Tangani pesan media (gambar) masuk dari user.
 * Dipanggil oleh whatsapp.service.ts saat mendeteksi imageMessage.
 *
 * @param fromJid JID pengirim (untuk membalas)
 * @param altJid  JID alternatif (untuk resolusi sesi)
 * @param mediaBuffer Buffer gambar yang sudah didownload
 * @param caption Caption dari gambar (opsional)
 * @param ownerPhone Nomor WA Owner untuk forward bukti
 * @param sendText Fungsi untuk kirim teks reply
 * @param sendImage Fungsi untuk kirim gambar (forward ke owner)
 */
export async function handleIncomingMedia(
  fromJid: string,
  altJid: string,
  mediaBuffer: Buffer,
  _caption: string,
  ownerPhone: string,
  sendText: (to: string, msg: string) => Promise<void>,
  sendImage: (to: string, buffer: Buffer, caption: string) => Promise<void>
): Promise<void> {
  let phone = formatPhone(fromJid);

  // Resolve LID jika perlu
  if (fromJid.endsWith('@lid')) {
    const mappedPhone = lidToPhoneMap.get(phone);
    if (mappedPhone) phone = mappedPhone;
  }
  // Coba altJid juga
  const altPhone = formatPhone(altJid);
  const session = paymentConfirmSessions.get(phone) || paymentConfirmSessions.get(altPhone);
  const resolvedPhone = paymentConfirmSessions.has(phone) ? phone : altPhone;

  if (!session) return; // Bukan sesi konfirmasi aktif — abaikan

  if (Date.now() > session.expiresAt) {
    paymentConfirmSessions.delete(resolvedPhone);
    await sendText(fromJid, `⏰ *Sesi konfirmasi pembayaran habis waktu.*\n\nSilakan hubungi admin jika butuh bantuan.`);
    return;
  }

  // Hapus sesi
  paymentConfirmSessions.delete(resolvedPhone);

  // 1. Forward gambar ke Owner
  const ownerJid = cleanPhone(ownerPhone) + '@s.whatsapp.net';
  const ownerCaption =
    `📎 *[BUKTI TRANSFER MASUK]*\n\n` +
    `- *Invoice*: ${session.invoiceNumber}\n` +
    `- *Instansi*: ${session.schoolName}\n` +
    `- *Produk*: ${session.productId.toUpperCase()}\n` +
    `- *License Key*: \`${session.licenseKey}\`\n` +
    `- *Dari*: ${phone}\n\n` +
    `_Silakan verifikasi di dashboard payment gateway dan ubah status invoice secara manual._`;

  try {
    await sendImage(ownerJid, mediaBuffer, ownerCaption);
    console.log(`[WA-BOT] Bukti transfer invoice ${session.invoiceNumber} berhasil diteruskan ke owner.`);
  } catch (e: any) {
    console.error('[WA-BOT] Gagal forward bukti ke owner:', e.message);
  }

  // 2. Konfirmasi ke pembeli
  await sendText(fromJid,
    `✅ *Bukti pembayaran Anda telah kami terima!*\n\n` +
    `- *Invoice*: ${session.invoiceNumber}\n` +
    `- *Instansi*: ${session.schoolName}\n\n` +
    `Bukti transfer sudah diteruskan ke admin untuk diverifikasi. ` +
    `Kami akan segera memproses pembayaran Anda.\n\n` +
    `Setelah dikonfirmasi, Anda akan menerima notifikasi otomatis bahwa lisensi sudah *AKTIF*. 🙏`
  );
}

export async function handleIncomingMessage(
  fromJid: string,
  text: string,
  sendReply: (to: string, msg: string) => Promise<void>,
  altJid?: string
): Promise<void> {
  const cmd = text.trim();
  let phone = formatPhone(fromJid);

  // Jika ini LID JID, coba resolve ke nomor telepon asli dari map
  if (fromJid.endsWith('@lid')) {
    const mappedPhone = lidToPhoneMap.get(phone);
    if (mappedPhone) {
      console.log(`[WA-BOT] Resolved LID: ${phone} -> Phone: ${mappedPhone}`);
      phone = mappedPhone;
    }
  }

  // ── Cek sesi konfirmasi pembayaran terlebih dahulu ───────────────────────
  const altPhone = altJid ? formatPhone(altJid) : phone;
  const confirmSessionPhone = paymentConfirmSessions.has(phone) ? phone
    : paymentConfirmSessions.has(altPhone) ? altPhone
    : null;

  // Deteksi keyword KONFIRMASI dari user (format: "KONFIRMASI INV-xxx" atau hanya "KONFIRMASI")
  const isKonfirmasi = /^konfirmasi(\s+\S+)?$/i.test(cmd);
  if (isKonfirmasi) {
    // Coba cari sesi konfirmasi yang sudah terdaftar berdasarkan nomor
    const existingConfirm = confirmSessionPhone ? paymentConfirmSessions.get(confirmSessionPhone) : null;
    if (existingConfirm && Date.now() < existingConfirm.expiresAt) {
      await sendReply(fromJid,
        `📷 *Terima kasih, ${existingConfirm.schoolName}!*\n\n` +
        `Silakan kirim *foto/gambar bukti transfer* Anda ke chat ini sekarang.\n\n` +
        `- *Invoice*: ${existingConfirm.invoiceNumber}\n` +
        `- *Produk*: ${existingConfirm.productId.toUpperCase()}\n\n` +
        `_Pastikan bukti transfer terlihat jelas (nominal, tanggal, rekening tujuan). ` +
        `Sesi ini aktif selama 24 jam._`
      );
      return;
    } else {
      // Tidak ada sesi terdaftar — coba cari invoice dari DB berdasarkan nomor
      await sendReply(fromJid,
        `ℹ️ *Tidak ditemukan tagihan aktif untuk nomor Anda.*\n\n` +
        `Jika Anda yakin memiliki tagihan pending, silakan hubungi admin atau tunggu sistem memperbarui sesi Anda. 🙏`
      );
      return;
    }
  }

  const session = pendingSessions.get(phone);

  if (!session) {
    // Jika tidak ada sesi interaktif aktif, periksa apakah ini kueri info lisensi organik
    await handleOrganicQuery(fromJid, phone, cmd, sendReply);
    return;
  }

  // Cek apakah sesi sudah kadaluwarsa
  if (Date.now() > session.expiresAt) {
    pendingSessions.delete(phone);
    await sendReply(fromJid,
      `⏰ *Sesi habis waktu.*\n\nSilakan tunggu notifikasi berikutnya dari sistem Cakola.`
    );
    return;
  }



  if (cmd === '1') {
    // ── Operator konfirmasi: server masih dipakai ─────────────────────────
    pendingSessions.delete(phone);
    console.log(`[WA-BOT] ${phone} menjawab KEEP untuk ${session.licenseKey}`);

    // Perbarui lastHeartbeatAt agar tidak kena hapus di siklus berikutnya
    // (memberi jeda 7 hari lagi tanpa heartbeat nyata)
    await prisma.license.update({
      where: { id: session.licenseId },
      data: { lastHeartbeatAt: new Date() }
    }).catch(() => {});

    await sendReply(fromJid,
      `✅ *Konfirmasi diterima!*\n\n` +
      `Server *${session.schoolName}* ditandai masih aktif digunakan.\n` +
      `Sistem tidak akan menghapus lisensi ini dalam 7 hari ke depan.\n\n` +
      `Pastikan server Anda kembali menyala dan terkoneksi ke jaringan secepatnya ya! 🙏`
    );

  } else if (cmd === '2') {
    // ── Operator konfirmasi: server sudah tidak dipakai ───────────────────
    pendingSessions.delete(phone);
    console.log(`[WA-BOT] ${phone} menjawab IGNORE untuk ${session.licenseKey}`);

    // Tandai status lisensi menjadi 'inactive' agar mudah diidentifikasi
    await prisma.license.update({
      where: { id: session.licenseId },
      data: { status: 'inactive' }
    }).catch(() => {});

    await sendReply(fromJid,
      `📋 *Terima kasih atas konfirmasinya.*\n\n` +
      `Server *${session.schoolName}* telah ditandai sebagai *tidak aktif*.\n` +
      `Data lisensi ini akan dibersihkan otomatis oleh sistem dalam waktu dekat.\n\n` +
      `Jika Anda ingin menggunakan Cakola kembali di masa mendatang, silakan hubungi tim kami. 😊`
    );

  } else if (cmd === '3') {
    // ── Operator minta hapus sekarang ─────────────────────────────────────
    pendingSessions.delete(phone);
    console.log(`[WA-BOT] ${phone} menjawab DELETE_NOW untuk ${session.licenseKey}`);

    await sendReply(fromJid,
      `🗑️ *Permintaan hapus diterima. Memproses...*\n\n` +
      `Menghapus data lisensi *${session.schoolName}* \`${session.licenseKey}\`...`
    );

    try {
      await prisma.subscription.deleteMany({ where: { licenseId: session.licenseId } });
      await prisma.invoice.deleteMany({ where: { licenseId: session.licenseId } });
      await prisma.activatedDevice.deleteMany({ where: { licenseId: session.licenseId } });
      await prisma.license.delete({ where: { id: session.licenseId } });
      await triggerCaddySync();

      await sendReply(fromJid,
        `✅ *Berhasil dihapus!*\n\n` +
        `Data lisensi *${session.schoolName}* (\`${session.licenseKey}\`) telah dihapus dari sistem.\n\n` +
        `Subdomain \`${session.requestedSlug || '-'}\` juga telah dilepas.\n\n` +
        `Terima kasih telah menggunakan Cakola! 🙏`
      );
    } catch (err: any) {
      console.error('[WA-BOT] Gagal hapus lisensi via bot:', err.message);
      await sendReply(fromJid,
        `❌ *Gagal menghapus data.*\n\nTerjadi kesalahan: ${err.message}\nSilakan hubungi administrator sistem.`
      );
    }

  } else {
    // ── Balasan tidak dikenali — tampilkan menu ulang ─────────────────────
    await sendReply(fromJid, buildMenuMessage(session.schoolName, session.licenseKey));
  }
}

/**
 * Buat teks pesan peringatan interaktif yang berisi menu pilihan.
 * Dipanggil dari cron.service.ts.
 */
export function buildWarningMessage(
  schoolName: string,
  licenseKey: string,
  heartbeatAgeDays: number
): string {
  return (
    `⚠️ *[CAKOLA — Peringatan Server Tidak Aktif]*\n\n` +
    `Halo, Operator *${schoolName}*! 👋\n\n` +
    `Server Cakola Anda tidak terdeteksi aktif selama *${heartbeatAgeDays} hari*.\n` +
    `License Key: \`${licenseKey}\`\n\n` +
    `📌 Jika server tidak aktif selama *14 hari*, data lisensi ini akan *dihapus otomatis*.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `*Silakan balas dengan angka:*\n\n` +
    `1️⃣  *1* — Server masih saya pakai, jangan hapus\n` +
    `2️⃣  *2* — Server sudah tidak saya pakai\n` +
    `3️⃣  *3* — Hapus sekarang\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `_Balasan hanya berlaku selama 24 jam._`
  );
}

/**
 * Buat teks pesan notifikasi penghapusan (sebelum auto-delete).
 * Dipanggil dari cron.service.ts.
 */
export function buildDeletionMessage(
  schoolName: string,
  licenseKey: string,
  requestedSlug: string | null
): string {
  return (
    `🗑️ *[CAKOLA — Lisensi Trial Dihapus Otomatis]*\n\n` +
    `Kepada Operator *${schoolName}*,\n\n` +
    `Data lisensi percobaan berikut telah *dihapus otomatis* oleh sistem karena tidak ada aktivitas server lebih dari 14 hari.\n\n` +
    `License Key: \`${licenseKey}\`\n` +
    `Slug/Node: \`${requestedSlug || '-'}\`\n\n` +
    `Jika ini kesalahan atau Anda ingin melanjutkan layanan Cakola, silakan hubungi tim kami.\n\n` +
    `Terima kasih. 🙏`
  );
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function buildMenuMessage(schoolName: string, licenseKey: string): string {
  return (
    `🤖 *Maaf, balasan tidak dikenali.*\n\n` +
    `Silakan balas dengan salah satu angka berikut untuk lisensi *${schoolName}* (\`${licenseKey}\`):\n\n` +
    `1️⃣  *1* — Server masih saya pakai, jangan hapus\n` +
    `2️⃣  *2* — Server sudah tidak saya pakai\n` +
    `3️⃣  *3* — Hapus sekarang\n\n` +
    `_Sesi aktif selama 24 jam sejak pesan pertama._`
  );
}

/**
 * Tangani kueri interaktif organik dari operator (misal cek status lisensi).
 */
async function handleOrganicQuery(
  fromJid: string,
  phone: string,
  cmd: string,
  sendReply: (to: string, msg: string) => Promise<void>
): Promise<void> {
  const query = cmd.toLowerCase().trim();
  const triggerKeywords = ['cek', 'lisensi', 'info', 'status', 'menu', 'help'];
  
  // Cek apakah pesan masuk mengandung kata kunci pemicu
  const isTriggered = triggerKeywords.some(kw => query.includes(kw));
  if (!isTriggered) return;

  console.log(`[WA-BOT] Memproses kueri organik dari ${phone}: "${cmd}"`);

  try {
    const formattedPhone = cleanPhone(phone);
    const altPhone = formattedPhone.startsWith('62') 
      ? '0' + formattedPhone.slice(2) 
      : '62' + formattedPhone.slice(1);

    const licenses = await prisma.license.findMany({
      where: {
        OR: [
          { operatorPhone: phone },
          { operatorPhone: formattedPhone },
          { operatorPhone: altPhone }
        ]
      },
      include: {
        activatedDevices: true
      }
    });

    // PRIVACY PROTECTOR: Jika nomor pengirim tidak terdaftar sebagai operator lisensi,
    // langsung keluar secara diam-diam (silent return) tanpa membalas apa pun.
    // Ini menjamin percakapan WA pribadi Anda dengan teman/keluarga tidak akan pernah terganggu bot.
    if (licenses.length === 0) {
      return;
    }

    console.log(`[WA-BOT] Memproses kueri organik dari ${phone}: "${cmd}"`);

    let msg = `🤖 *[ASISTEN CAKOLA — Daftar Lisensi Anda]*\n\n` +
              `Halo! Berikut adalah lisensi yang terdaftar atas nomor Anda:\n\n`;

    licenses.forEach((lic, idx) => {
      const statusIcon = lic.status === 'active' || lic.isActive === 1 ? '🟢' : '🔴';
      const expiresDisplay = lic.expiresAt ? lic.expiresAt : '-';
      const hostDisplay = lic.activeHostname ? `\`${lic.activeHostname}\`` : 'Belum terpasang';
      const ipDisplay = lic.wireguardIp ? ` (IP: ${lic.wireguardIp})` : '';
      const domainDisplay = lic.customDomain ? `\n   • Domain: \`${lic.customDomain}\`` : '';
      const devicesCount = lic.activatedDevices ? lic.activatedDevices.length : 0;
      
      let deployDisplay = 'Belum terdeteksi';
      if (lic.deployMode) {
        deployDisplay = lic.deployMode.toUpperCase();
      }

      msg += `${idx + 1}. *${lic.schoolName}*\n` +
             `   • Key: \`${lic.licenseKey}\`\n` +
             `   • Produk: *${lic.productId.toUpperCase()}*\n` +
             `   • Status: ${statusIcon} ${lic.status.toUpperCase()}\n` +
             `   • Masa Aktif: ${expiresDisplay}\n` +
             `   • Mode Deploy: ${deployDisplay}\n` +
             `   • Server Node: ${hostDisplay}${ipDisplay}${domainDisplay}\n` +
             `   • Perangkat Terikat: ${devicesCount} / ${lic.deviceLimit} perangkat\n\n`;
    });

    msg += `Gunakan menu interaktif jika menerima peringatan otomatis untuk mengelola pembersihan trial Anda. Terima kasih! 🙏`;

    await sendReply(fromJid, msg);
  } catch (err: any) {
    console.error('[WA-BOT] Gagal memproses kueri organik:', err.message);
    await sendReply(fromJid,
      `❌ *Gagal mengambil data lisensi.*\n\nTerjadi kesalahan internal: ${err.message}`
    );
  }
}
