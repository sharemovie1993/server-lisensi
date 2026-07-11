import { FastifyReply, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { waGateway } from '../../services/whatsapp.service';
import { ADMIN_SECRET } from '../../utils/keys';

export const prisma = new PrismaClient();

/**
 * Normalisasi alias product ID yang tidak konsisten.
 * Contoh: 'platform-absenta' → 'absenta'
 * Tambahkan alias baru di sini jika ada produk dengan dua ID.
 */
export function normalizeProductId(productId: string): string {
  const aliases: Record<string, string> = {
    'platform-absenta': 'absenta',
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
    const productLabel = prodId === 'absenta' ? 'Platform Cakola' : (prodId === 'easy-tunnel' ? 'Easy Tunnel' : prodId.toUpperCase());
    
    let paymentStatusNotes = '';
    if (status === 'paid') {
      paymentStatusNotes = '*Status*: ✅ *LUNAS* (Lisensi Aktif)';
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

    await waGateway.sendMessage(phone, message);
  } catch (err: any) {
    console.error('[WA Notification Error]', err.message);
  }
};
