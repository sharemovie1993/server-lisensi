const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OUT_LOG = '/var/www/licensing-server/logs/out.log';
const ERR_LOG = '/var/www/licensing-server/logs/err.log';

function parseLogDate(dateStr) {
  // Example: "2026-07-11 12:19:31 +07:00" -> Date object
  const cleaned = dateStr.trim();
  return new Date(cleaned);
}

async function run() {
  console.log('[Forensics] Starting recovery of WhatsApp outbox logs from system log files...');
  
  const recoveredLogs = [];

  // Helper to parse a line
  // Example: "2026-07-15 07:10:26 +07:00: [WA] Pesan terkirim ke 087779937341 (JID: 6287779937341@s.whatsapp.net)"
  const successRegex = /^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\s\+\d{2}:\d{2}):\s+\[WA\]\s+Pesan terkirim ke\s+([0-9]+)/;
  
  // Example: "2026-07-14 16:38:25 +07:00: [WA Privateer Notification Error] WhatsApp Gateway belum terhubung."
  const errorPrivateerRegex = /^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\s\+\d{2}:\d{2}):\s+\[WA Privateer Notification Error\]\s+(.*)/;
  
  // Example: "2026-07-15 06:29:08 +07:00: [Local Free License] Gagal mengirim pesan WA: WhatsApp Gateway belum terhubung."
  const errorLocalFreeRegex = /^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\s\+\d{2}:\d{2}):\s+\[Local Free License\]\s+Gagal mengirim pesan WA:\s+(.*)/;

  // 1. Process out.log
  if (fs.existsSync(OUT_LOG)) {
    const fileStream = fs.createReadStream(OUT_LOG);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    
    for await (const line of rl) {
      const match = line.match(successRegex);
      if (match) {
        const timeStr = match[1];
        const phone = match[2];
        const dateObj = parseLogDate(timeStr);
        
        recoveredLogs.push({
          createdAt: dateObj,
          recipient: phone,
          status: 'SENT',
          errorMessage: null,
          isError: false
        });
      }
    }
    console.log(`[Forensics] Parsed ${recoveredLogs.length} successful logs from out.log`);
  }

  // 2. Process err.log
  let errCount = 0;
  if (fs.existsSync(ERR_LOG)) {
    const fileStream = fs.createReadStream(ERR_LOG);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    
    for await (const line of rl) {
      const matchPrivateer = line.match(errorPrivateerRegex);
      if (matchPrivateer) {
        const timeStr = matchPrivateer[1];
        const errorMsg = matchPrivateer[2];
        const dateObj = parseLogDate(timeStr);
        
        recoveredLogs.push({
          createdAt: dateObj,
          recipient: '087779937341', // Defaults to owner phone for Privateer admin errors
          status: 'FAILED',
          errorMessage: errorMsg,
          isError: true,
          type: 'privateer'
        });
        errCount++;
      }

      const matchLocalFree = line.match(errorLocalFreeRegex);
      if (matchLocalFree) {
        const timeStr = matchLocalFree[1];
        const errorMsg = matchLocalFree[2];
        const dateObj = parseLogDate(timeStr);
        
        recoveredLogs.push({
          createdAt: dateObj,
          recipient: '087779937341', // Defaults to operator/owner phone
          status: 'FAILED',
          errorMessage: errorMsg,
          isError: true,
          type: 'cakola'
        });
        errCount++;
      }
    }
    console.log(`[Forensics] Parsed ${errCount} failed logs from err.log`);
  }

  // Clear current table to prevent duplicates
  await prisma.whatsAppLog.deleteMany({});
  console.log('[Forensics] Cleared whatsAppLog table for fresh rebuild...');

  let insertedCount = 0;

  for (const log of recoveredLogs) {
    const logTime = log.createdAt;
    const startRange = new Date(logTime.getTime() - 60000); // -1 minute
    const endRange = new Date(logTime.getTime() + 60000);  // +1 minute

    let finalMessage = '';
    let triggerType = 'SYSTEM';
    let productId = 'SYSTEM';

    if (log.isError) {
      if (log.type === 'privateer') {
        productId = 'privateer';
        triggerType = 'TOPUP_NOTIFICATION';
        finalMessage = `⚠️ [Gagal Kirim - Topup Sesi Belajar Privateer]\nSistem gagal mengirimkan notifikasi rincian pembayaran ke siswa/pelanggan.`;
      } else {
        productId = 'cakola';
        triggerType = 'REGISTRATION_AWAL';
        finalMessage = `⚠️ [Gagal Kirim - Aktivasi Lisensi Platform Cakola]\nSistem gagal mengirimkan rincian detail lisensi baru ke operator sekolah.`;
      }
    } else {
      // Forensics search: Find nearest license
      const nearestLicense = await prisma.license.findFirst({
        where: {
          createdAt: { gte: startRange, lte: endRange }
        }
      });

      // Forensics search: Find nearest invoice
      const nearestInvoice = await prisma.invoice.findFirst({
        where: {
          createdAt: { gte: startRange, lte: endRange }
        }
      });

      if (nearestLicense) {
        productId = nearestLicense.productId || 'cakola';
        triggerType = 'REGISTRATION_AWAL';
        
        const slug = nearestLicense.requestedSlug ? nearestLicense.requestedSlug.trim().toLowerCase() : '';
        const key = nearestLicense.licenseKey.trim();
        const schoolName = nearestLicense.schoolName.trim();

        finalMessage = `🟢 *[AKTIVASI LISENSI LOKAL PLATFORM CAKOLA SUCCESS]*\n\n` +
          `Yth. Operator *${schoolName}*,\n` +
          `Selamat! Proses registrasi server dan pemasangan Platform Cakola untuk sekolah Anda telah berhasil diselesaikan secara sempurna.\n\n` +
          `🔑 Kunci Lisensi: \`${key}\`\n` +
          `🌐 Subdomain Akses Online: *https://${slug}.absenta.id*\n` +
          `📅 Status Lisensi: *AKTIF*\n\n` +
          `Simpan pesan ini sebagai bukti catatan lisensi Anda. Terima kasih!`;
      } else if (nearestInvoice) {
        productId = nearestInvoice.productId || 'cakola';
        triggerType = 'BILLING_NOTIFICATION';

        const amountFormatted = `Rp ${nearestInvoice.amount.toLocaleString('id-ID')}`;
        const planTitle = nearestInvoice.planTitle || 'Paket Subscription';
        const invoiceNum = nearestInvoice.invoiceNumber;
        const method = nearestInvoice.paymentMethod || 'QRIS2';

        if (productId === 'privateer') {
          triggerType = 'TOPUP_NOTIFICATION';
          const parts = nearestInvoice.schoolName.split('|').map(p => p.trim());
          const studentName = parts[0] || nearestInvoice.schoolName;

          finalMessage = `*💎 [Privateer] TOP-UP SESI BELAJAR BERHASIL*\n\n` +
            `Halo Kakak *${studentName}* yang hebat! 👋\n` +
            `Top-up sesi belajar kamu sudah berhasil diproses nih. Kakak Guru sudah tidak sabar untuk belajar bareng kamu lagi! 🤗\n\n` +
            `- *Nama Siswa*: ${studentName}\n` +
            `- *Paket*: ${planTitle}\n` +
            `- *No. Invoice*: *${invoiceNum}*\n` +
            `- *Total Biaya*: *${amountFormatted}*\n` +
            `- *Metode*: ${method}`;
        } else {
          finalMessage = `*🔑 [Platform Cakola] PENGAJUAN LISENSI BARU*\n\n` +
            `Halo! Pengajuan lisensi server Anda telah berhasil diproses. Berikut adalah rincian tagihan Anda:\n\n` +
            `* Nomor Invoice: *${invoiceNum}*\n` +
            `* Total Biaya: *${amountFormatted}*\n` +
            `* Metode Pembayaran: *${method}*`;
        }
      } else {
        // Fallback placeholder message
        finalMessage = `[Pesan Notifikasi Sistem]\nWhatsApp message successfully delivered.`;
        triggerType = 'SYSTEM';
        productId = 'SYSTEM';
      }
    }

    // Insert log to database
    await prisma.whatsAppLog.create({
      data: {
        recipient: log.recipient,
        message: finalMessage,
        status: log.status,
        errorMessage: log.errorMessage,
        triggerType,
        productId,
        createdAt: logTime
      }
    });

    insertedCount++;
  }

  console.log(`[Forensics] Reconstructed and inserted ${insertedCount} logs successfully into database!`);
  await prisma.$disconnect();
}

run();
