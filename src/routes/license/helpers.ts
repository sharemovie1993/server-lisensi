import { FastifyReply, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { waGateway } from '../../services/whatsapp.service';
import { ADMIN_SECRET } from '../../utils/keys';

export const prisma = new PrismaClient();

/**
 * Normalisasi alias product ID yang tidak konsisten.
 * Menangani semua alias historis agar backward-compatible.
 *
 * Alias yang aktif:
 *   'platform-absenta' → 'cakola'  (legacy ID lama sebelum refactor)
 *   'absenta'          → 'cakola'  (ID sebelum rename Juli 2026)
 *
 * Tambahkan alias baru di sini jika ada produk dengan dua ID.
 */
export function normalizeProductId(productId: string): string {
  const aliases: Record<string, string> = {
    'platform-absenta': 'cakola',
    'absenta': 'cakola',
  };
  return aliases[productId] ?? productId;
}

/**
 * Ambil prefix license key dari tabel Product secara dinamis.
 * Fallback ke 3 huruf pertama productId jika tidak ditemukan.
 */
export async function getProductPrefix(productId: string): Promise<string> {
  const normalizedId = normalizeProductId(productId);
  try {
    const product = await prisma.product.findUnique({ where: { id: normalizedId } });
    if (product?.prefix) return product.prefix;
  } catch (e: any) {
    console.warn(`[getProductPrefix] Gagal baca prefix '${normalizedId}':`, e.message);
  }
  // Fallback: 3 huruf pertama dari productId
  return normalizedId.slice(0, 3).toUpperCase();
}

export function formatWA(nomor: string): string {
  if (!nomor) return '';
  let clean = nomor.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }
  return clean;
}

export async function verifyClient(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ success: false, message: 'Harap masuk terlebih dahulu.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, ADMIN_SECRET + '_client_session') as any;
    if (decoded && decoded.nomor) {
      (request as any).operator = decoded;
      return;
    }
  } catch (err) {
    return reply.status(401).send({ success: false, message: 'Sesi login telah berakhir. Silakan masuk kembali.' });
  }
  return reply.status(401).send({ success: false, message: 'Sesi login tidak valid.' });
}

export interface RequestBody {
  school_name: string;
  device_limit?: number;
  is_unlimited?: number;
  product_id: string;
  plan_id: string;
  price: number;
  payment_method?: string;
  renew_license_key?: string;
  requested_slug?: string;
  include_vpn?: number;
  device_id?: string;
  phone_number?: string;
  wa_number?: string;
  whatsapp?: string;
}

export const sendLicenseWhatsAppNotification = async (
  phone: string,
  schoolName: string,
  slug: string | null,
  prodId: string,
  planName: string,
  key: string,
  invoiceNum: string,
  amount: number,
  paymentMethod: string,
  status: 'paid' | 'unpaid',
  payCode?: string | null,
  qrUrl?: string | null
) => {
  try {
    const amountFormatted = amount === 0 ? 'Rp 0 (Gratis)' : `Rp ${amount.toLocaleString('id-ID')}`;
    const normalizedId = normalizeProductId(prodId);
    const isPrivateer = normalizedId === 'privateer';
    
    const productLabel = normalizedId === 'cakola' ? 'Platform Cakola' : (normalizedId === 'easy-tunnel' ? 'Easy Tunnel' : (isPrivateer ? 'Privateer' : prodId.toUpperCase()));
    
    let paymentStatusNotes = '';
    if (status === 'paid') {
      paymentStatusNotes = `*Status*: ✅ *${isPrivateer ? 'PEMBAYARAN BERHASIL' : 'LUNAS'}* (${isPrivateer ? 'Saldo Sesi Bertambah' : 'Lisensi Aktif'})`;
    } else {
      paymentStatusNotes = `*Status*: ⚠️ *MENUNGGU PEMBAYARAN*\n`;
      if (paymentMethod.toLowerCase() === 'manual') {
        paymentStatusNotes += `Silakan lakukan transfer manual ke rekening BNI yang tertera di panel/dashboard, lalu unggah/kirim bukti transfer ke Admin untuk konfirmasi manual.`;
      } else {
        if (payCode) {
          paymentStatusNotes += `*Kode Bayar / VA*: *${payCode}*\n`;
        }
        if (qrUrl) {
          paymentStatusNotes += `*QR Code Link*: ${qrUrl}\n`;
        }
        paymentStatusNotes += `Silakan lakukan pembayaran melalui metode ${paymentMethod} sesuai petunjuk di panel.`;
      }
    }

    let message = '';
    if (isPrivateer) {
      // Branding Privateer (Gaya Guru TK & Tanpa Kata Lisensi)
      const parts = schoolName.split('|').map(p => p.trim());
      const studentName = parts[0] || schoolName;
      
      message = `*💎 [Privateer] TOP-UP SESI BELAJAR*

Halo Kakak *${studentName}* yang hebat! 👋
Wah, asyik sekali! Ada pengajuan top-up sesi belajar baru nih. Yuk, segera selesaikan pembayarannya agar kita bisa belajar bareng lagi! 🤗

*✨ Detail Belajar:*
- *Nama Siswa*: ${studentName}
- *Paket*: ${planName}

*💳 Rincian Tagihan:*
- *Nomor Invoice*: *${invoiceNum}*
- *Total Biaya*: *${amountFormatted}*
- *Metode*: ${paymentMethod}
${paymentStatusNotes}

Terima kasih ya sudah rajin belajar di Privateer. Semangat terus! ✨🚀`;
    } else {
      // Branding Standard Cakola
      const confirmInstructions = status === 'unpaid' ? `\n\n━━━━━━━━━━━━━━━━━━━━\n💡 *Sudah Membayar?*\nBalas pesan ini dengan:\n  *KONFIRMASI ${invoiceNum}*\nKami akan memandu Anda mengirim bukti transfer secara langsung via WhatsApp ini.\n━━━━━━━━━━━━━━━━━━━━` : '';

      message = `*🔑 [Platform Cakola] PENGAJUAN LISENSI BARU*

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
${paymentStatusNotes}${confirmInstructions}

Terima kasih telah menggunakan layanan kami!`;
    }

    await waGateway.sendMessage(phone, message, 'BILLING_NOTIFICATION', normalizedId);
  } catch (err: any) {
    console.error('[WA Notification Error]', err.message);
  }
};

export const sendPrivateerTopUpNotification = async (
  phone: string,
  studentName: string,
  className: string,
  planName: string,
  invoiceNum: string,
  amount: number,
  paymentMethod: string,
  status: 'paid' | 'unpaid',
  payCode?: string | null,
  qrUrl?: string | null
) => {
  try {
    const amountFormatted = `Rp ${amount.toLocaleString('id-ID')}`;
    
    let paymentStatusNotes = '';
    if (status === 'paid') {
      paymentStatusNotes = '*Status*: ✅ *PEMBAYARAN BERHASIL* (Saldo Sesi Bertambah)';
    } else {
      paymentStatusNotes = `*Status*: ⚠️ *MENUNGGU PEMBAYARAN*\n`;
      if (payCode) paymentStatusNotes += `*Kode Bayar / VA*: *${payCode}*\n`;
      if (qrUrl) paymentStatusNotes += `*QR Code Link*: ${qrUrl}\n`;
      paymentStatusNotes += `Silakan lakukan pembayaran melalui metode ${paymentMethod} agar sesi belajar dapat segera diklaim.`;
    }

    const message = `*💎 [Privateer] TOP-UP SESI BELAJAR BERHASIL*

Halo Kakak *${studentName}* yang hebat! 👋
Wah, asyik sekali! Top-up sesi belajar kamu sudah berhasil diproses nih. Kakak Guru sudah tidak sabar untuk belajar bareng kamu lagi! 🤗

*✨ Detail Belajar Kamu:*
- *Nama Siswa*: ${studentName}
- *Kelas*: ${className}
- *Paket*: ${planName}

*💳 Rincian Pembayaran:*
- *No. Invoice*: *${invoiceNum}*
- *Total Biaya*: *${amountFormatted}*
- *Metode*: ${paymentMethod}
${paymentStatusNotes}

Terima kasih ya sudah rajin belajar di Privateer. Kalau ada yang bingung atau butuh bantuan, jangan sungkan chat Kakak Admin ya! Semangat terus belajarnya! ✨🚀`;

    await waGateway.sendMessage(phone, message, 'TOPUP_NOTIFICATION', 'privateer');
  } catch (err: any) {
    console.error('[WA Privateer Notification Error]', err.message);
  }
};

/**
 * Mengirim notifikasi WA ke Owner/Admin ketika ada pengajuan lisensi/transaksi baru
 */
export const sendOwnerOrderNotification = async (
  schoolName: string,
  slug: string | null,
  prodId: string,
  planName: string,
  key: string,
  invoiceNum: string,
  amount: number,
  paymentMethod: string
) => {
  const ownerWA = process.env.OWNER_WA_NUMBER || '6287779937341';
  try {
    const amountFormatted = amount === 0 ? 'Rp 0 (Gratis)' : `Rp ${amount.toLocaleString('id-ID')}`;
    const normalizedId = normalizeProductId(prodId);
    const productLabel = normalizedId === 'cakola' ? 'Platform Cakola' : (normalizedId === 'easy-tunnel' ? 'Easy Tunnel' : (normalizedId === 'privateer' ? 'Privateer' : prodId.toUpperCase()));

    const message = `*📢 [NOTIFIKASI OWNER] ORDER LISENSI BARU*

Halo Owner! Ada transaksi/pengajuan lisensi baru masuk pada sistem.

*📋 Rincian Pesanan:*
- *Nama Instansi*: ${schoolName}
- *Subdomain*: ${slug ? slug + '.absenta.id' : '-'}
- *Produk*: ${productLabel}
- *Paket/Plan*: ${planName}
- *Lisensi Key*: \`${key}\`

*💳 Rincian Tagihan:*
- *Nomor Invoice*: *${invoiceNum}*
- *Total Biaya*: *${amountFormatted}*
- *Metode Pembayaran*: *${paymentMethod}*

_Catatan: Karena sistem dalam mode sandbox, Anda dapat membuka dashboard Sandbox Tripay/Payment Gateway untuk mengubah status invoice *${invoiceNum}* secara manual agar terkonfirmasi otomatis oleh sistem._`;

    await waGateway.sendMessage(ownerWA, message, 'ADMIN_NOTIFICATION', normalizedId);
    console.log(`[WA Owner Notify] Berhasil mengirim notifikasi order baru ke Owner (${ownerWA})`);
  } catch (err: any) {
    console.error('[WA Owner Notify Error]', err.message);
  }
};

