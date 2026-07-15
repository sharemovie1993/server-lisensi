const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('[Migration] Reconstructing historical WhatsApp logs...');
  try {
    // 1. Fetch all licenses that have operator phone numbers
    const licenses = await prisma.license.findMany({
      where: {
        operatorPhone: { not: null }
      },
      include: {
        logs: true
      }
    });

    console.log(`[Migration] Found ${licenses.length} licenses with operator phone numbers.`);

    let insertedCount = 0;

    for (const lic of licenses) {
      const phone = lic.operatorPhone.trim();
      if (!phone) continue;

      const slug = lic.requestedSlug ? lic.requestedSlug.trim().toLowerCase() : '';
      const key = lic.licenseKey.trim();
      const schoolName = lic.schoolName.trim();

      // Reconstruct the message template
      const waMessage = `🟢 *[AKTIVASI LISENSI LOKAL PLATFORM CAKOLA SUCCESS]*\n\n` +
        `Yth. Operator *${schoolName}*,\n` +
        `Selamat! Proses registrasi server dan pemasangan Platform Cakola untuk sekolah Anda telah berhasil diselesaikan secara sempurna.\n\n` +
        `Berikut adalah detail lisensi dan akses Anda:\n` +
        `🔑 Kunci Lisensi: \`${key}\`\n` +
        `🌐 Subdomain Akses Online: *https://${slug}.absenta.id*\n` +
        `📅 Status Lisensi: *AKTIF*\n\n` +
        `*Catatan Penting*:\n` +
        `- *Akses Online (Easy-Tunnel)*: Sudah aktif secara otomatis. Aplikasi dapat langsung diakses dari internet luar melalui tautan domain di atas.\n` +
        `- *Akses Lokal (Intranet)*: Dapat diakses menggunakan IP lokal server atau pengaturan Split DNS di jaringan internal sekolah.\n` +
        `- *Langkah Selanjutnya*: Buka tautan domain sekolah Anda di atas, lalu masuk menu *Daftar Sekolah / Registrasi Sekolah* untuk membuat akun Administrator utama sekolah Anda.\n\n` +
        `Simpan pesan ini sebagai bukti catatan lisensi Anda. Terima kasih!`;

      // Find original activation log
      const activationLog = lic.logs.find(l => l.action === 'WA_LOCAL_FREE_ACTIVATION_SENT');
      
      // Check if we already have this log in whatsapp_logs to prevent duplicates
      const existingLogs = await prisma.whatsAppLog.findMany({
        where: {
          recipient: phone,
          triggerType: 'REGISTRATION_AWAL'
        }
      });

      if (existingLogs.length === 0) {
        if (activationLog) {
          // Success case
          await prisma.whatsAppLog.create({
            data: {
              recipient: phone,
              message: waMessage,
              status: 'SENT',
              triggerType: 'REGISTRATION_AWAL',
              productId: lic.productId,
              createdAt: activationLog.createdAt
            }
          });
          console.log(`[Migration] Reconstructed SENT registration log for ${schoolName} (${phone})`);
        } else {
          // Failed case
          await prisma.whatsAppLog.create({
            data: {
              recipient: phone,
              message: waMessage,
              status: 'FAILED',
              errorMessage: 'WhatsApp Gateway belum terhubung.',
              triggerType: 'REGISTRATION_AWAL',
              productId: lic.productId,
              createdAt: lic.createdAt
            }
          });
          console.log(`[Migration] Reconstructed FAILED registration log for ${schoolName} (${phone})`);
        }
        insertedCount++;
      }

      // Also look for manual resends in activity logs
      const resendLogs = lic.logs.filter(l => l.action === 'WA_RESEND_LICENSE_SUCCESS');
      for (const resend of resendLogs) {
        const existingResends = await prisma.whatsAppLog.findMany({
          where: {
            recipient: phone,
            triggerType: 'MANUAL_RESEND',
            createdAt: resend.createdAt
          }
        });

        if (existingResends.length === 0) {
          await prisma.whatsAppLog.create({
            data: {
              recipient: phone,
              message: waMessage,
              status: 'SENT',
              triggerType: 'MANUAL_RESEND',
              productId: lic.productId,
              createdAt: resend.createdAt
            }
          });
          console.log(`[Migration] Reconstructed SENT manual resend log for ${schoolName} (${phone})`);
          insertedCount++;
        }
      }
    }

    console.log(`[Migration] Successfully reconstructed ${insertedCount} historical logs.`);
  } catch (err) {
    console.error('[Migration] Failed to migrate old logs:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
