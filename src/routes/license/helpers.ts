import { FastifyReply, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { waGateway } from '../../services/whatsapp.service';
import { ADMIN_SECRET } from '../../utils/keys';
import { getTripayConfigByProductId } from '../../services/tripay-resolver';

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
 * Mengambil pengaturan sistem dari database (system_settings) dengan fallback ke environment variable / default.
 */
export async function getSystemSetting(key: string, fallback: string): Promise<string> {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key } });
    if (setting && setting.value.trim() !== '') {
      return setting.value.trim();
    }
  } catch (err: any) {
    console.warn(`[getSystemSetting] Gagal mengambil key '${key}':`, err.message);
  }
  return process.env[key] || fallback;
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
  server_license_key?: string;
  tenant_identifier?: string;
}

export interface LicenseWhatsAppNotificationOptions {
  phone: string;
  schoolName: string;
  slug: string | null;
  prodId: string;
  planName: string;
  key: string;
  invoiceNum: string;
  amount: number;
  paymentMethod: string;
  status: 'paid' | 'unpaid' | 'expired';
  payCode?: string | null;
  qrUrl?: string | null;
  isRenewal?: boolean;
  expiresAt?: string | null;
  isBundledVpn?: boolean;
}

export const sendLicenseWhatsAppNotification = async (
  phoneOrOpts: string | LicenseWhatsAppNotificationOptions,
  rawSchoolName?: string,
  rawSlug?: string | null,
  rawProdId?: string,
  rawPlanName?: string,
  rawKey?: string,
  rawInvoiceNum?: string,
  rawAmount?: number,
  rawPaymentMethod?: string,
  rawStatus?: 'paid' | 'unpaid' | 'expired',
  rawPayCode?: string | null,
  rawQrUrl?: string | null,
  rawIsRenewal?: boolean,
  rawExpiresAt?: string | null,
  rawIsBundledVpn?: boolean
) => {
  try {
    let opts: LicenseWhatsAppNotificationOptions;
    if (typeof phoneOrOpts === 'object') {
      opts = phoneOrOpts;
    } else {
      opts = {
        phone: phoneOrOpts,
        schoolName: rawSchoolName || '',
        slug: rawSlug ?? null,
        prodId: rawProdId || '',
        planName: rawPlanName || '',
        key: rawKey || '',
        invoiceNum: rawInvoiceNum || '',
        amount: rawAmount ?? 0,
        paymentMethod: rawPaymentMethod || '',
        status: rawStatus || 'unpaid',
        payCode: rawPayCode,
        qrUrl: rawQrUrl,
        isRenewal: rawIsRenewal,
        expiresAt: rawExpiresAt,
        isBundledVpn: rawIsBundledVpn
      };
    }

    const {
      phone,
      schoolName,
      slug,
      prodId,
      planName,
      key,
      invoiceNum,
      amount,
      paymentMethod,
      status,
      payCode,
      qrUrl,
      isRenewal = false,
      expiresAt,
      isBundledVpn
    } = opts;

    if (!phone || phone.trim() === '') return;

    // Bersihkan nama sekolah jika mengandung pipe '|'
    const cleanSchoolName = schoolName.includes('|') ? schoolName.split('|')[0].trim() : schoolName.trim();
    const cleanSlug = slug || (schoolName.includes('|') ? schoolName.split('|')[1].trim() : '');

    const amountFormatted = amount === 0 ? 'Rp 0 (Gratis)' : `Rp ${amount.toLocaleString('id-ID')}`;
    const normalizedId = normalizeProductId(prodId);
    const isPrivateer = normalizedId === 'privateer';

    const productLabel = normalizedId === 'cakola' ? 'Platform Absenta'
      : (normalizedId === 'easy-tunnel' ? 'Easy Tunnel VPN'
      : (isPrivateer ? 'Privateer' : prodId.toUpperCase()));

    let paymentStatusNotes = '';
    if (status === 'paid') {
      paymentStatusNotes = `*Status*: ✅ *${isPrivateer ? 'PEMBAYARAN BERHASIL' : 'LUNAS & AKTIF'}*`;
      if (expiresAt) {
        paymentStatusNotes += `\n*Masa Aktif Layanan*: 📅 *Hingga ${expiresAt}*`;
      }
    } else if (status === 'expired') {
      paymentStatusNotes = `*Status*: ⏰ *KADALUARSA (EXPIRED)*\nBatas waktu pembayaran tagihan ini telah berakhir. Silakan lakukan pemesanan/tagihan baru melalui panel layanan.`;
    } else {
      paymentStatusNotes = `*Status*: ⚠️ *MENUNGGU PEMBAYARAN*\n`;
      if (paymentMethod.toLowerCase() === 'manual') {
        paymentStatusNotes += `Silakan lakukan transfer manual sesuai nominal ke rekening bank yang tertera di panel, lalu konfirmasikan ke Admin.`;
      } else {
        if (payCode) {
          paymentStatusNotes += `*Kode Bayar / VA*: *${payCode}*\n`;
        }
        if (qrUrl) {
          paymentStatusNotes += `*QR Code Link*: ${qrUrl}\n`;
        }
        paymentStatusNotes += `Silakan lakukan pembayaran melalui metode *${paymentMethod}* sesuai petunjuk di panel.`;
      }
    }

    const confirmInstructions = status === 'unpaid'
      ? `\n\n━━━━━━━━━━━━━━━━━━━━\n💡 *Sudah Membayar?*\nBalas pesan ini dengan:\n  *KONFIRMASI ${invoiceNum}*\nKami akan memandu Anda mengirim bukti transfer secara langsung via WhatsApp ini.\n━━━━━━━━━━━━━━━━━━━━`
      : '';

    let message = '';

    if (isPrivateer) {
      // Branding Privateer (Top-up sesi belajar)
      message = `*💎 [Privateer] TOP-UP SESI BELAJAR*

Halo Kakak *${cleanSchoolName}* yang hebat! 👋
Ada pengajuan top-up sesi belajar baru nih. Yuk, segera selesaikan pembayarannya agar kita bisa belajar bareng lagi! 🤗

*✨ Detail Belajar:*
- *Nama Siswa*: ${cleanSchoolName}
- *Paket*: ${planName}

*💳 Rincian Tagihan:*
- *Nomor Invoice*: *${invoiceNum}*
- *Total Biaya*: *${amountFormatted}*
- *Metode*: ${paymentMethod}
${paymentStatusNotes}${confirmInstructions}

Terima kasih ya sudah rajin belajar di Privateer. Semangat terus! ✨🚀`;

    } else {
      // Branding Platform Absenta / Easy Tunnel
      const headerTitle = status === 'paid'
        ? (isRenewal ? 'PERPANJANGAN LISENSI BERHASIL' : 'AKTIVASI LISENSI BERHASIL')
        : (isRenewal ? 'TAGIHAN PERPANJANGAN LISENSI' : 'TAGIHAN PEMESANAN LISENSI BARU');

      const greetingText = status === 'paid'
        ? `Pembayaran Anda telah kami terima dengan sukses. Layanan telah aktif dan siap digunakan!`
        : `Halo Administrator *${cleanSchoolName}*! Permintaan lisensi Anda telah berhasil dibuat. Silakan lakukan pembayaran sesuai rincian berikut:`;

      const checkBundled = isBundledVpn || planName.toLowerCase().includes('lengkap') || (opts as any).include_vpn === 1;

      message = `*🔑 [${productLabel}] ${headerTitle}*

${greetingText}

*📋 Rincian Layanan:*
- *Instansi*: ${cleanSchoolName}
- *Domain Portal*: ${cleanSlug ? cleanSlug + '.absenta.id' : '-'}
- *Modul / Paket*: ${planName}
- *Kode Lisensi*: \`${key}\`${checkBundled ? '\n- *Fitur Tambahan*: ⚡ _Termasuk Easy Tunnel Gateway_' : ''}

*💳 Rincian Tagihan:*
- *Nomor Invoice*: *${invoiceNum}*
- *Total Biaya*: *${amountFormatted}*
- *Metode Pembayaran*: *${paymentMethod}*
${paymentStatusNotes}${confirmInstructions}

Terima kasih telah mempercayakan operasional sekolah kepada *${productLabel}*! 🚀`;
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
  paymentMethod: string,
  isRenewal: boolean = false
) => {
  try {
    const ownerWA = await getSystemSetting('OWNER_WA_NUMBER', '6287779937341');
    const amountFormatted = amount === 0 ? 'Rp 0 (Gratis)' : `Rp ${amount.toLocaleString('id-ID')}`;
    const normalizedId = normalizeProductId(prodId);
    const productLabel = normalizedId === 'cakola' ? 'Platform Absenta' : (normalizedId === 'easy-tunnel' ? 'Easy Tunnel VPN' : (normalizedId === 'privateer' ? 'Privateer' : prodId.toUpperCase()));

    const cleanSchoolName = schoolName.includes('|') ? schoolName.split('|')[0].trim() : schoolName.trim();
    const cleanSlug = slug || (schoolName.includes('|') ? schoolName.split('|')[1].trim() : '');

    const tripayConfig = await getTripayConfigByProductId(normalizedId);
    const modeNote = tripayConfig.mode === 'PRODUCTION'
      ? `_Status: 🟢 Transaksi Mode PRODUCTION (Tripay Live / Real Money)_`
      : `_Catatan: Karena produk ini dalam mode sandbox, Anda dapat membuka dashboard Sandbox Tripay untuk mengubah status invoice *${invoiceNum}* secara manual agar terkonfirmasi otomatis oleh sistem._`;

    const titleAction = isRenewal ? 'PERPANJANGAN LISENSI' : 'ORDER LISENSI BARU';

    const message = `*📢 [NOTIFIKASI OWNER] ${titleAction}*

Halo Owner! Ada transaksi/pengajuan lisensi masuk pada sistem.

*📋 Rincian Pesanan:*
- *Nama Instansi*: ${cleanSchoolName}
- *Subdomain*: ${cleanSlug ? cleanSlug + '.absenta.id' : '-'}
- *Tipe Transaksi*: *${isRenewal ? '🔄 Perpanjangan Masa Aktif' : '✨ Pendaftaran Baru'}*
- *Produk*: ${productLabel}
- *Paket/Plan*: ${planName}
- *Kunci Lisensi*: \`${key}\`

*💳 Rincian Tagihan:*
- *Nomor Invoice*: *${invoiceNum}*
- *Total Biaya*: *${amountFormatted}*
- *Metode Pembayaran*: *${paymentMethod}*

${modeNote}`;

    await waGateway.sendMessage(ownerWA, message, 'ADMIN_NOTIFICATION', normalizedId);
    console.log(`[WA Owner Notify] Berhasil mengirim notifikasi order baru ke Owner (${ownerWA})`);
  } catch (err: any) {
    console.error('[WA Owner Notify Error]', err.message);
  }
};

/**
 * Memproses top-up sesi belajar Privateer saat invoice status berubah menjadi 'paid'
 */
export async function processPrivateerTopUp(invoice: any): Promise<void> {
  if (!invoice || normalizeProductId(invoice.productId) !== 'privateer') return;

  const metadata = invoice.schoolName || '';
  const parts = metadata.split('|').map((p: string) => p.trim());
  const studentName = parts[0] || 'Siswa Privateer';
  const rawPhone = parts[3] || ''; // Nomor WA disimpan di index ke-3

  if (!rawPhone) {
    console.warn(`[Privateer-Topup] Skip topup untuk invoice ${invoice.invoiceNumber} karena nomor WA tidak ditemukan di metadata.`);
    return;
  }

  const phone = formatWA(rawPhone);

  // Extract session count dari planId (e.g. PVT_SESSION_10 -> 10, PVT_SESSION_25 -> 25)
  const sessionMatch = (invoice.planId || '').match(/SESSION_(\d+)/);
  const sessionCount = sessionMatch ? parseInt(sessionMatch[1], 10) : 0;

  if (sessionCount <= 0) {
    console.warn(`[Privateer-Topup] Jumlah sesi untuk plan ${invoice.planId} adalah 0. Skip.`);
    return;
  }

  try {
    // 1. Upsert UserCredit berdasarkan nomor WA
    const userCredit = await prisma.userCredit.upsert({
      where: { phone },
      update: {
        balance: { increment: sessionCount },
        studentName: studentName
      },
      create: {
        phone,
        balance: sessionCount,
        studentName: studentName
      }
    });

    // 2. Catat transaksi top-up
    await prisma.topUpTransaction.create({
      data: {
        userCreditId: userCredit.id,
        amount: sessionCount,
        pricePaid: Math.floor(Number(invoice.amount)),
        invoiceNumber: invoice.invoiceNumber,
        status: 'PAID',
        paidAt: new Date()
      }
    });

    console.log(`[Privateer-Topup] Berhasil topup ${sessionCount} sesi untuk ${studentName} (${phone}). Saldo baru: ${userCredit.balance}`);

    // 3. Kirim notifikasi WA Lunas & Saldo Baru ke Siswa
    const message = `*💎 [Privateer] TOP-UP SESI BELAJAR BERHASIL*

Halo *${studentName}*, pembayaran top-up sesi belajar Anda telah kami terima secara sistem.

*📋 Rincian Top-up:*
- *No. Invoice*: ${invoice.invoiceNumber}
- *Paket*: ${invoice.planTitle}
- *Tambahan Sesi*: *+${sessionCount} Sesi Belajar*
- *Status*: ✅ *LUNAS (Saldo Ditambahkan)*

*💳 Saldo Sesi Belajar Anda Sekarang:*
- *Total Saldo*: *${userCredit.balance} Sesi Belajar*

Terima kasih ya sudah rajin belajar di Privateer. Semangat terus! ✨🚀`;
    await waGateway.sendMessage(phone, message, 'TOPUP_NOTIFICATION', 'privateer');

  } catch (err: any) {
    console.error(`[Privateer-Topup] Error memproses topup untuk invoice ${invoice.invoiceNumber}:`, err.message);
  }
}

