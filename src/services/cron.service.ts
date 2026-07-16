import { PrismaClient } from '@prisma/client';
import { triggerCaddySync } from './caddy.service';
import { waGateway } from './whatsapp.service';
import { buildWarningMessage, buildDeletionMessage, registerSession } from './wa-bot.service';

const prisma = new PrismaClient();

// Helper: try to send a WA notification, silently ignore if WA not connected
async function sendWaNotif(phone: string | null | undefined, pesan: string, triggerType = 'SYSTEM', productId?: string): Promise<void> {
  if (!phone) return;
  try {
    await waGateway.sendMessage(phone, pesan, triggerType, productId);
  } catch (e: any) {
    console.warn(`[CRON-WA] Gagal kirim notifikasi ke ${phone}:`, e.message);
  }
}

export async function checkExpirations(): Promise<void> {
  console.log('[CRON] Running automatic license & subscription expiration check...');

  // 1. Buat record awal CronJobLog dengan status RUNNING
  const logRecord = await prisma.cronJobLog.create({
    data: {
      jobName: 'DAILY_LICENSE_SUBSCRIPTION_JOB',
      status: 'RUNNING'
    }
  });

  const nowLocal = new Date();
  const year = nowLocal.getFullYear();
  const month = String(nowLocal.getMonth() + 1).padStart(2, '0');
  const date = String(nowLocal.getDate()).padStart(2, '0');
  const hours = String(nowLocal.getHours()).padStart(2, '0');
  const minutes = String(nowLocal.getMinutes()).padStart(2, '0');
  const seconds = String(nowLocal.getSeconds()).padStart(2, '0');

  const currentTimestamp = `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;

  let expiredRevoked = 0;
  let warningsSent = 0;
  let deletedLicensesFromTrials = 0;
  let markedExpiredInvoices = 0;
  let deletedInvoicesCount = 0;
  let deletedLicensesFromInvoices = 0;

  try {
    // 1. Find newly expired active licenses
    const expiredLicenses = await prisma.license.findMany({
      where: {
        expiresAt: { lt: currentTimestamp },
        OR: [
          { status: 'active' },
          { isActive: 1 }
        ]
      }
    });

    if (expiredLicenses.length === 0) {
      console.log('[CRON] No expired licenses found.');
    } else {
      for (const lic of expiredLicenses) {
        console.log(`[CRON] License ${lic.licenseKey} for ${lic.schoolName} has expired. Revoking...`);

        // Update license status
        await prisma.license.update({
          where: { id: lic.id },
          data: {
            isActive: 0,
            status: 'expired'
          }
        });

        // Update subscriptions
        await prisma.subscription.updateMany({
          where: { licenseId: lic.id },
          data: {
            status: 'expired'
          }
        });

        // Log activity
        await prisma.activityLog.create({
          data: {
            licenseKey: lic.licenseKey,
            productId: lic.productId,
            ipAddress: 'system',
            action: 'CRON_EXPIRED'
          }
        });

        expiredRevoked++;
      }

      // Trigger Caddy sync to remove routing for expired licenses
      console.log(`[CRON] Triggering Caddy sync to remove routing for ${expiredLicenses.length} expired licenses...`);
      await triggerCaddySync();
    }

    // Run cleanup of inactive trial/test licenses
    const trialsResult = await cleanupInactiveTrials();
    warningsSent = trialsResult.warningsSent;
    deletedLicensesFromTrials = trialsResult.deletedLicenses;
    
    // Run cleanup of expired unpaid invoices
    const invoicesResult = await cleanupExpiredInvoices();
    markedExpiredInvoices = invoicesResult.markedExpired;
    deletedInvoicesCount = invoicesResult.deletedInvoices;
    deletedLicensesFromInvoices = invoicesResult.deletedLicenses;

    // Hitung durasi job
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - logRecord.startedAt.getTime();

    // 2. Tandai sukses dan update metrik di CronJobLog
    await prisma.cronJobLog.update({
      where: { id: logRecord.id },
      data: {
        finishedAt,
        status: 'SUCCESS',
        meta: {
          durationMs,
          expiredRevoked,
          warningsSent,
          deletedLicensesFromTrials,
          markedExpiredInvoices,
          deletedInvoicesCount,
          deletedLicensesFromInvoices
        }
      }
    });

  } catch (err: any) {
    console.error('[CRON] Error during expiration check:', err.message);
    
    // 3. Catat status FAILED jika terjadi error crash
    await prisma.cronJobLog.update({
      where: { id: logRecord.id },
      data: {
        finishedAt: new Date(),
        status: 'FAILED',
        message: err.message
      }
    });
  }
}

export async function cleanupInactiveTrials(): Promise<{ warningsSent: number, deletedLicenses: number }> {
  console.log('[CRON] Running automatic cleanup of inactive trial/test licenses...');

  const now = new Date();
  let warningsSent = 0;
  let deletedCount = 0;

  // Phase thresholds
  const warningThreshold  = new Date(now); warningThreshold.setDate(now.getDate() - 7);   // 7 days → warning
  const deleteThreshold   = new Date(now); deleteThreshold.setDate(now.getDate() - 14);   // 14 days → delete
  const neverPulseDelete  = new Date(now); neverPulseDelete.setDate(now.getDate() - 7);   // never pulsed 7+ days → delete

  try {
    // ─────────────────────────────────────────────────────────
    // PHASE 1: Kirim peringatan WA untuk yang sudah 7 hari tidak aktif
    //          tapi belum mencapai 14 hari (zona peringatan)
    // ─────────────────────────────────────────────────────────
    const warnCandidates = await prisma.license.findMany({
      where: {
        lastHeartbeatAt: {
          lt: warningThreshold,
          gte: deleteThreshold,   // antara 7-14 hari
        }
      },
      include: { invoices: true }
    });

    for (const lic of warnCandidates) {
      const hasPaidInvoice = lic.invoices.some(inv => inv.status === 'paid' || inv.status === 'PAID');
      if (hasPaidInvoice) continue;

      if (lic.operatorPhone) {
        const heartbeatAge = Math.floor((now.getTime() - new Date(lic.lastHeartbeatAt!).getTime()) / (1000 * 60 * 60 * 24));

        // Register interactive session so operator can reply 1/2/3
        registerSession(
          lic.operatorPhone,
          lic.id,
          lic.licenseKey,
          lic.schoolName,
          lic.requestedSlug ?? null
        );

        // Send interactive warning message with action menu
        const msg = buildWarningMessage(lic.schoolName, lic.licenseKey, heartbeatAge);
        await sendWaNotif(lic.operatorPhone, msg, 'CRON_WARNING', lic.productId);
        console.log(`[CRON-WA] Peringatan interaktif terkirim ke operator ${lic.schoolName} (${lic.operatorPhone})`);
        warningsSent++;
      }
    }

    // ─────────────────────────────────────────────────────────
    // PHASE 2: Hapus lisensi yang sudah 14+ hari tidak aktif
    //          atau yang tidak pernah heartbeat 7+ hari sejak dibuat
    // ─────────────────────────────────────────────────────────
    const deleteCandidates = await prisma.license.findMany({
      where: {
        OR: [
          { lastHeartbeatAt: { lt: deleteThreshold } },
          { lastHeartbeatAt: null, createdAt: { lt: neverPulseDelete } }
        ]
      },
      include: { invoices: true }
    });

    if (deleteCandidates.length === 0) {
      console.log('[CRON] No inactive trial licenses ready for deletion.');
      return { warningsSent, deletedLicenses: 0 };
    }

    for (const lic of deleteCandidates) {
      // Safety: jangan hapus kalau ada invoice lunas
      const hasPaidInvoice = lic.invoices.some(inv => inv.status === 'paid' || inv.status === 'PAID');
      if (hasPaidInvoice) continue;

      console.log(`[CRON-CLEANUP] Deleting inactive trial license: ${lic.licenseKey} for ${lic.schoolName}`);

      // Kirim notifikasi WA penghapusan ke operator SEBELUM menghapus
      if (lic.operatorPhone) {
        const msg = buildDeletionMessage(lic.schoolName, lic.licenseKey, lic.requestedSlug ?? null);
        await sendWaNotif(lic.operatorPhone, msg, 'CRON_DELETION', lic.productId);
        console.log(`[CRON-WA] Notifikasi penghapusan terkirim ke operator ${lic.schoolName} (${lic.operatorPhone})`);
      }

      // Hapus data secara berurutan (relasi)
      await prisma.subscription.deleteMany({ where: { licenseId: lic.id } });
      await prisma.invoice.deleteMany({ where: { licenseId: lic.id } });
      await prisma.activatedDevice.deleteMany({ where: { licenseId: lic.id } });
      await prisma.license.delete({ where: { id: lic.id } });

      deletedCount++;
    }

    if (deletedCount > 0) {
      console.log(`[CRON-CLEANUP] Successfully cleaned up ${deletedCount} inactive trial licenses.`);
      await triggerCaddySync();
    }
  } catch (err: any) {
    console.error('[CRON-CLEANUP] Error during trial cleanup:', err.message);
    throw err; // throw agar checkExpirations tahu ada kegagalan
  }

  return { warningsSent, deletedLicenses: deletedCount };
}

/**
 * Membersihkan / membatalkan invoice pending (unpaid) yang telah kedaluwarsa.
 * Jika invoice sudah kedaluwarsa > 7 hari, data invoice & lisensi unpaid akan dihapus permanen.
 */
export async function cleanupExpiredInvoices(): Promise<{ markedExpired: number, deletedInvoices: number, deletedLicenses: number }> {
  console.log('[CRON] Running automatic cleanup of expired unpaid invoices...');
  const nowSec = Math.floor(Date.now() / 1000);
  let markedExpired = 0;
  let deletedInvoices = 0;
  let deletedLicenses = 0;

  try {
    // 1. Cari invoice 'unpaid' yang waktu expired-nya sudah lewat
    const expiredInvoices = await prisma.invoice.findMany({
      where: {
        status: 'unpaid'
      }
    });

    for (const inv of expiredInvoices) {
      const expTimestamp = parseInt(inv.expiredTime, 10);
      if (isNaN(expTimestamp) || nowSec < expTimestamp) continue;

      console.log(`[CRON-INVOICE] Invoice ${inv.invoiceNumber} has expired. Updating status to expired...`);

      // Update status invoice menjadi expired
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { status: 'expired' }
      });

      // Update status license terkait menjadi expired jika statusnya masih unpaid
      await prisma.license.updateMany({
        where: { id: inv.licenseId, status: 'unpaid' },
        data: { status: 'expired', isActive: 0 }
      });

      markedExpired++;
    }

    // 2. Hapus invoice & license yang berstatus 'expired' dan berumur lebih dari 7 hari sejak dibuat
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const deleteCandidates = await prisma.invoice.findMany({
      where: {
        status: 'expired',
        createdAt: { lt: sevenDaysAgo }
      },
      include: { license: true }
    });
    
    for (const inv of deleteCandidates) {
      const hasPaid = inv.license && (inv.license.status === 'active' || inv.license.isActive === 1);
      
      if (hasPaid) {
        // Jika lisensinya aktif (sudah dibayar melalui invoice lain),
        // cukup hapus invoice yang expired ini saja agar database bersih. Jangan sentuh lisensi aktifnya!
        console.log(`[CRON-INVOICE] Deleting expired invoice only (license active): ${inv.invoiceNumber}`);
        await prisma.invoice.delete({ where: { id: inv.id } });
        deletedInvoices++;
      } else {
        // Jika lisensinya memang tidak aktif (unpaid/trial terbengkalai), hapus keduanya
        console.log(`[CRON-INVOICE] Deleting expired invoice & license: ${inv.invoiceNumber} (created: ${inv.createdAt})`);
        await prisma.subscription.deleteMany({ where: { licenseId: inv.licenseId } });
        await prisma.activatedDevice.deleteMany({ where: { licenseId: inv.licenseId } });
        await prisma.invoice.delete({ where: { id: inv.id } });
        await prisma.license.deleteMany({ where: { id: inv.licenseId } });
        deletedLicenses++;
        deletedInvoices++;
      }
    }

    if (deletedInvoices > 0) {
      console.log(`[CRON-INVOICE] Purged ${deletedInvoices} old expired invoices and ${deletedLicenses} licenses from database.`);
      await triggerCaddySync();
    }
  } catch (err: any) {
    console.error('[CRON-INVOICE] Error during expired invoices cleanup:', err.message);
    throw err; // throw agar checkExpirations tahu ada kegagalan
  }

  return { markedExpired, deletedInvoices, deletedLicenses };
}

