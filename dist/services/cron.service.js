"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkExpirations = checkExpirations;
exports.cleanupInactiveTrials = cleanupInactiveTrials;
const client_1 = require("@prisma/client");
const caddy_service_1 = require("./caddy.service");
const whatsapp_service_1 = require("./whatsapp.service");
const wa_bot_service_1 = require("./wa-bot.service");
const prisma = new client_1.PrismaClient();
// Helper: try to send a WA notification, silently ignore if WA not connected
async function sendWaNotif(phone, pesan, triggerType = 'SYSTEM', productId) {
    if (!phone)
        return;
    try {
        await whatsapp_service_1.waGateway.sendMessage(phone, pesan, triggerType, productId);
    }
    catch (e) {
        console.warn(`[CRON-WA] Gagal kirim notifikasi ke ${phone}:`, e.message);
    }
}
async function checkExpirations() {
    console.log('[CRON] Running automatic license & subscription expiration check...');
    const nowLocal = new Date();
    const year = nowLocal.getFullYear();
    const month = String(nowLocal.getMonth() + 1).padStart(2, '0');
    const date = String(nowLocal.getDate()).padStart(2, '0');
    const hours = String(nowLocal.getHours()).padStart(2, '0');
    const minutes = String(nowLocal.getMinutes()).padStart(2, '0');
    const seconds = String(nowLocal.getSeconds()).padStart(2, '0');
    const currentTimestamp = `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
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
        }
        else {
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
            }
            // Trigger Caddy sync to remove routing for expired licenses
            console.log(`[CRON] Triggering Caddy sync to remove routing for ${expiredLicenses.length} expired licenses...`);
            await (0, caddy_service_1.triggerCaddySync)();
        }
    }
    catch (err) {
        console.error('[CRON] Error during expiration check:', err.message);
    }
    // Run cleanup of inactive trial/test licenses
    await cleanupInactiveTrials().catch(err => console.error('[CRON] Error during trial cleanup:', err.message));
}
async function cleanupInactiveTrials() {
    console.log('[CRON] Running automatic cleanup of inactive trial/test licenses...');
    const now = new Date();
    // Phase thresholds
    const warningThreshold = new Date(now);
    warningThreshold.setDate(now.getDate() - 7); // 7 days → warning
    const deleteThreshold = new Date(now);
    deleteThreshold.setDate(now.getDate() - 14); // 14 days → delete
    const neverPulseDelete = new Date(now);
    neverPulseDelete.setDate(now.getDate() - 7); // never pulsed 7+ days → delete
    try {
        // ─────────────────────────────────────────────────────────
        // PHASE 1: Kirim peringatan WA untuk yang sudah 7 hari tidak aktif
        //          tapi belum mencapai 14 hari (zona peringatan)
        // ─────────────────────────────────────────────────────────
        const warnCandidates = await prisma.license.findMany({
            where: {
                lastHeartbeatAt: {
                    lt: warningThreshold,
                    gte: deleteThreshold, // antara 7-14 hari
                }
            },
            include: { invoices: true }
        });
        for (const lic of warnCandidates) {
            const hasPaidInvoice = lic.invoices.some(inv => inv.status === 'paid' || inv.status === 'PAID');
            if (hasPaidInvoice)
                continue;
            if (lic.operatorPhone) {
                const heartbeatAge = Math.floor((now.getTime() - new Date(lic.lastHeartbeatAt).getTime()) / (1000 * 60 * 60 * 24));
                // Register interactive session so operator can reply 1/2/3
                (0, wa_bot_service_1.registerSession)(lic.operatorPhone, lic.id, lic.licenseKey, lic.schoolName, lic.requestedSlug ?? null);
                // Send interactive warning message with action menu
                const msg = (0, wa_bot_service_1.buildWarningMessage)(lic.schoolName, lic.licenseKey, heartbeatAge);
                await sendWaNotif(lic.operatorPhone, msg, 'CRON_WARNING', lic.productId);
                console.log(`[CRON-WA] Peringatan interaktif terkirim ke operator ${lic.schoolName} (${lic.operatorPhone})`);
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
            return;
        }
        let deletedCount = 0;
        for (const lic of deleteCandidates) {
            // Safety: jangan hapus kalau ada invoice lunas
            const hasPaidInvoice = lic.invoices.some(inv => inv.status === 'paid' || inv.status === 'PAID');
            if (hasPaidInvoice)
                continue;
            console.log(`[CRON-CLEANUP] Deleting inactive trial license: ${lic.licenseKey} for ${lic.schoolName}`);
            // Kirim notifikasi WA penghapusan ke operator SEBELUM menghapus
            if (lic.operatorPhone) {
                const msg = (0, wa_bot_service_1.buildDeletionMessage)(lic.schoolName, lic.licenseKey, lic.requestedSlug ?? null);
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
            await (0, caddy_service_1.triggerCaddySync)();
        }
    }
    catch (err) {
        console.error('[CRON-CLEANUP] Error during trial cleanup:', err.message);
    }
}
