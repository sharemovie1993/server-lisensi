"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkUpcomingExpirations = checkUpcomingExpirations;
exports.checkExpirations = checkExpirations;
exports.cleanupInactiveTrials = cleanupInactiveTrials;
exports.cleanupExpiredInvoices = cleanupExpiredInvoices;
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
/**
 * Membentuk pesan WhatsApp pengingat pra-expire (H-7, H-3, H-1) dengan nama produk & paket lengkap.
 */
function buildUpcomingExpirationMessage(params) {
    const portalUrl = params.slug ? `https://${params.slug}.absenta.id/billing` : 'https://absenta.id/billing';
    const bundledText = params.isBundled ? '\n• Fitur Tambahan: ⚡ _Termasuk Easy Tunnel Gateway_' : '';
    const dayText = params.daysRemaining <= 1 ? '1 hari lagi (Besok)' : `${params.daysRemaining} hari lagi`;
    return `⚠️ *[${params.productName}] PENGINGAT MASA AKTIF LISENSI*

Halo Bapak/Ibu Operator *${params.schoolName}*, 👋

Kami ingin menginformasikan bahwa masa aktif lisensi layanan sekolah Anda akan segera berakhir dalam *${dayText}*.

📋 *Rincian Layanan:*
• Nama Instansi: *${params.schoolName}*
• Produk: *${params.productName}*
• Paket Layanan: *${params.planName}*${bundledText}
• Kode Lisensi: \`${params.licenseKey}\`
• Tanggal Berakhir: 📅 *${params.expiresAt}*

Agar layanan presensi, sinkronisasi mesin, dan aplikasi mobile tetap berjalan lancar tanpa kendala atau terputus, silakan lakukan perpanjangan sebelum tanggal di atas.

🔗 *Perpanjangan Mandiri:*
Silakan akses menu Tagihan di portal sekolah Anda:
${portalUrl}

Jika membutuhkan bantuan administrasi atau teknis, Anda dapat langsung membalas pesan WhatsApp ini.

Terima kasih atas kerja sama dan kepercayaan Anda bersama *${params.productName}*! ✨`;
}
/**
 * Membentuk pesan WhatsApp pemberitahuan saat lisensi resmi kedaluwarsa.
 */
function buildLicenseExpiredMessage(params) {
    const portalUrl = params.slug ? `https://${params.slug}.absenta.id/billing` : 'https://absenta.id/billing';
    const bundledText = params.isBundled ? '\n• Fitur Tambahan: ⚡ _Termasuk Easy Tunnel Gateway_' : '';
    return `⏰ *[${params.productName}] PEMBERITAHUAN MASA AKTIF BERAKHIR*

Halo Bapak/Ibu Operator *${params.schoolName}*, 👋

Kami menginformasikan bahwa masa aktif lisensi layanan untuk instansi Anda telah *resmi berakhir* pada tanggal *${params.expiresAt}*.

📋 *Rincian Lisensi:*
• Nama Instansi: *${params.schoolName}*
• Produk: *${params.productName}*
• Paket Layanan: *${params.planName}*${bundledText}
• Kode Lisensi: \`${params.licenseKey}\`
• Status Layanan: ⛔ *Dinonaktifkan Sementara*

⚠️ *Informasi Penting:*
Seluruh data presensi dan konfigurasi sekolah Anda tetap tersimpan dengan aman di server. Namun, akses portal dan sinkronisasi mesin dinonaktifkan sementara hingga perpanjangan berhasil dilakukan.

🚀 *Cara Mengaktifkan Kembali:*
1. Kunjungi portal perpanjangan: ${portalUrl}
2. Buat tagihan perpanjangan paket dan selesaikan pembayaran.
3. Layanan akan otomatis aktif kembali begitu pembayaran terverifikasi.

Butuh bantuan atau ingin konfirmasi? Silakan balas pesan WhatsApp ini untuk terhubung dengan tim teknis kami.`;
}
/**
 * Pengecekan lisensi aktif yang akan kedaluwarsa dalam 7 hari, 3 hari, atau 1 hari (H-7, H-3, H-1).
 */
async function checkUpcomingExpirations() {
    console.log('[CRON] Running upcoming license expiration reminders check (H-7, H-3, H-1)...');
    let remindersH7Sent = 0;
    let remindersH3Sent = 0;
    let remindersH1Sent = 0;
    const now = new Date();
    const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    try {
        const activeLicenses = await prisma.license.findMany({
            where: {
                operatorPhone: { not: null },
                OR: [
                    { status: 'active' },
                    { isActive: 1 }
                ]
            },
            include: {
                product: true,
                plan: true
            }
        });
        for (const lic of activeLicenses) {
            if (!lic.operatorPhone || !lic.expiresAt)
                continue;
            const expDate = new Date(lic.expiresAt.replace(' ', 'T'));
            if (isNaN(expDate.getTime()))
                continue;
            // Skip lisensi seumur hidup / permanen (tahun >= 2090)
            if (expDate.getFullYear() >= 2090)
                continue;
            const expDateOnly = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
            const calendarDiffDays = Math.round((expDateOnly.getTime() - nowDateOnly.getTime()) / (1000 * 60 * 60 * 24));
            let triggerType = null;
            if (calendarDiffDays === 7) {
                triggerType = 'CRON_REMINDER_H7';
            }
            else if (calendarDiffDays === 3) {
                triggerType = 'CRON_REMINDER_H3';
            }
            else if (calendarDiffDays === 1) {
                triggerType = 'CRON_REMINDER_H1';
            }
            if (!triggerType)
                continue;
            // Anti-Spam: Cek apakah sudah pernah dikirim dalam 24 jam terakhir untuk lisensi ini
            const alreadySent = await prisma.whatsAppLog.findFirst({
                where: {
                    recipient: lic.operatorPhone,
                    triggerType,
                    message: { contains: lic.licenseKey },
                    createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
                }
            });
            if (alreadySent) {
                continue;
            }
            const cleanSchoolName = lic.schoolName.includes('|') ? lic.schoolName.split('|')[0].trim() : lic.schoolName.trim();
            const slug = lic.requestedSlug || (lic.schoolName.includes('|') ? lic.schoolName.split('|')[1].trim() : '') || lic.tenantIdentifier || '';
            const productName = lic.product?.name || (lic.productId === 'cakola' ? 'Platform Absenta' : lic.productId === 'easy-tunnel' ? 'Easy Tunnel VPN' : lic.productId.toUpperCase());
            const planName = lic.plan?.name || 'Paket Standar';
            const isBundled = lic.includeVpn === 1 || planName.toLowerCase().includes('lengkap') || planName.toLowerCase().includes('easy tunnel');
            const msg = buildUpcomingExpirationMessage({
                schoolName: cleanSchoolName,
                productName,
                planName,
                licenseKey: lic.licenseKey,
                expiresAt: lic.expiresAt,
                daysRemaining: calendarDiffDays,
                slug,
                isBundled
            });
            await sendWaNotif(lic.operatorPhone, msg, triggerType, lic.productId);
            console.log(`[CRON-WA] Pengingat ${triggerType} terkirim ke operator ${cleanSchoolName} (${lic.operatorPhone}) untuk lisensi ${lic.licenseKey}`);
            if (calendarDiffDays === 7)
                remindersH7Sent++;
            else if (calendarDiffDays === 3)
                remindersH3Sent++;
            else if (calendarDiffDays === 1)
                remindersH1Sent++;
        }
    }
    catch (err) {
        console.error('[CRON] Error during upcoming expirations check:', err.message);
    }
    return { remindersH7Sent, remindersH3Sent, remindersH1Sent };
}
async function checkExpirations() {
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
    let expiredNotifsSent = 0;
    let remindersH7Sent = 0;
    let remindersH3Sent = 0;
    let remindersH1Sent = 0;
    let warningsSent = 0;
    let deletedLicensesFromTrials = 0;
    let markedExpiredInvoices = 0;
    let deletedInvoicesCount = 0;
    let deletedLicensesFromInvoices = 0;
    try {
        // 1. Find newly expired active licenses (include product & plan)
        const expiredLicenses = await prisma.license.findMany({
            where: {
                expiresAt: { lt: currentTimestamp },
                OR: [
                    { status: 'active' },
                    { isActive: 1 }
                ]
            },
            include: {
                product: true,
                plan: true
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
                // Kirim notifikasi WA pemberitahuan lisensi kedaluwarsa ke operator
                if (lic.operatorPhone) {
                    const alreadySentExpired = await prisma.whatsAppLog.findFirst({
                        where: {
                            recipient: lic.operatorPhone,
                            triggerType: 'CRON_LICENSE_EXPIRED',
                            message: { contains: lic.licenseKey },
                            createdAt: { gte: new Date(nowLocal.getTime() - 24 * 60 * 60 * 1000) }
                        }
                    });
                    if (!alreadySentExpired) {
                        const cleanSchoolName = lic.schoolName.includes('|') ? lic.schoolName.split('|')[0].trim() : lic.schoolName.trim();
                        const slug = lic.requestedSlug || (lic.schoolName.includes('|') ? lic.schoolName.split('|')[1].trim() : '') || lic.tenantIdentifier || '';
                        const productName = lic.product?.name || (lic.productId === 'cakola' ? 'Platform Absenta' : lic.productId === 'easy-tunnel' ? 'Easy Tunnel VPN' : lic.productId.toUpperCase());
                        const planName = lic.plan?.name || 'Paket Standar';
                        const isBundled = lic.includeVpn === 1 || planName.toLowerCase().includes('lengkap') || planName.toLowerCase().includes('easy tunnel');
                        const expMsg = buildLicenseExpiredMessage({
                            schoolName: cleanSchoolName,
                            productName,
                            planName,
                            licenseKey: lic.licenseKey,
                            expiresAt: lic.expiresAt,
                            slug,
                            isBundled
                        });
                        await sendWaNotif(lic.operatorPhone, expMsg, 'CRON_LICENSE_EXPIRED', lic.productId);
                        console.log(`[CRON-WA] Notifikasi lisensi kedaluwarsa terkirim ke operator ${cleanSchoolName} (${lic.operatorPhone}) untuk lisensi ${lic.licenseKey}`);
                        expiredNotifsSent++;
                    }
                }
                expiredRevoked++;
            }
            // Trigger Caddy sync to remove routing for expired licenses
            console.log(`[CRON] Triggering Caddy sync to remove routing for ${expiredLicenses.length} expired licenses...`);
            await (0, caddy_service_1.triggerCaddySync)();
        }
        // Jalankan pengingat pra-expire (H-7, H-3, H-1)
        const upcomingResult = await checkUpcomingExpirations();
        remindersH7Sent = upcomingResult.remindersH7Sent;
        remindersH3Sent = upcomingResult.remindersH3Sent;
        remindersH1Sent = upcomingResult.remindersH1Sent;
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
                    expiredNotifsSent,
                    remindersH7Sent,
                    remindersH3Sent,
                    remindersH1Sent,
                    warningsSent,
                    deletedLicensesFromTrials,
                    markedExpiredInvoices,
                    deletedInvoicesCount,
                    deletedLicensesFromInvoices
                }
            }
        });
    }
    catch (err) {
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
async function cleanupInactiveTrials() {
    console.log('[CRON] Running automatic cleanup of inactive trial/test licenses...');
    const now = new Date();
    let warningsSent = 0;
    let deletedCount = 0;
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
            try {
                // Safety: jangan hapus kalau ada invoice lunas
                const hasPaidInvoice = lic.invoices.some(inv => inv.status === 'paid' || inv.status === 'PAID');
                if (hasPaidInvoice)
                    continue;
                console.log(`[CRON-CLEANUP] Deleting inactive trial license: ${lic.licenseKey} for ${lic.schoolName}`);
                // Hapus data relasi terlebih dahulu
                await prisma.activityLog.deleteMany({ where: { licenseKey: lic.licenseKey } });
                await prisma.subscription.deleteMany({ where: { licenseId: lic.id } });
                await prisma.invoice.deleteMany({ where: { licenseId: lic.id } });
                await prisma.activatedDevice.deleteMany({ where: { licenseId: lic.id } });
                await prisma.license.delete({ where: { id: lic.id } });
                // Kirim notifikasi WA penghapusan ke operator SETELAH berhasil menghapus dari database
                if (lic.operatorPhone) {
                    const msg = (0, wa_bot_service_1.buildDeletionMessage)(lic.schoolName, lic.licenseKey, lic.requestedSlug ?? null);
                    await sendWaNotif(lic.operatorPhone, msg, 'CRON_DELETION', lic.productId);
                    console.log(`[CRON-WA] Notifikasi penghapusan terkirim ke operator ${lic.schoolName} (${lic.operatorPhone})`);
                }
                deletedCount++;
            }
            catch (singleErr) {
                console.error(`[CRON-CLEANUP] Gagal menghapus lisensi ${lic.licenseKey}:`, singleErr.message);
            }
        }
        if (deletedCount > 0) {
            console.log(`[CRON-CLEANUP] Successfully cleaned up ${deletedCount} inactive trial licenses.`);
            await (0, caddy_service_1.triggerCaddySync)();
        }
    }
    catch (err) {
        console.error('[CRON-CLEANUP] Error during trial cleanup:', err.message);
        throw err; // throw agar checkExpirations tahu ada kegagalan
    }
    return { warningsSent, deletedLicenses: deletedCount };
}
/**
 * Membersihkan / membatalkan invoice pending (unpaid) yang telah kedaluwarsa.
 * Jika invoice sudah kedaluwarsa > 7 hari, data invoice & lisensi unpaid akan dihapus permanen.
 */
async function cleanupExpiredInvoices() {
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
            if (isNaN(expTimestamp) || nowSec < expTimestamp)
                continue;
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
            try {
                const hasPaid = inv.license && (inv.license.status === 'active' || inv.license.isActive === 1);
                if (hasPaid) {
                    // Jika lisensinya aktif (sudah dibayar melalui invoice lain),
                    // cukup hapus invoice yang expired ini saja agar database bersih. Jangan sentuh lisensi aktifnya!
                    console.log(`[CRON-INVOICE] Deleting expired invoice only (license active): ${inv.invoiceNumber}`);
                    await prisma.invoice.delete({ where: { id: inv.id } });
                    deletedInvoices++;
                }
                else {
                    // Jika lisensinya memang tidak aktif (unpaid/trial terbengkalai), hapus keduanya
                    console.log(`[CRON-INVOICE] Deleting expired invoice & license: ${inv.invoiceNumber} (created: ${inv.createdAt})`);
                    if (inv.license) {
                        await prisma.activityLog.deleteMany({ where: { licenseKey: inv.license.licenseKey } });
                    }
                    await prisma.subscription.deleteMany({ where: { licenseId: inv.licenseId } });
                    await prisma.activatedDevice.deleteMany({ where: { licenseId: inv.licenseId } });
                    await prisma.invoice.delete({ where: { id: inv.id } });
                    await prisma.license.deleteMany({ where: { id: inv.licenseId } });
                    deletedLicenses++;
                    deletedInvoices++;
                }
            }
            catch (singleErr) {
                console.error(`[CRON-INVOICE] Gagal menghapus invoice/lisensi ${inv.invoiceNumber}:`, singleErr.message);
            }
        }
        if (deletedInvoices > 0) {
            console.log(`[CRON-INVOICE] Purged ${deletedInvoices} old expired invoices and ${deletedLicenses} licenses from database.`);
            await (0, caddy_service_1.triggerCaddySync)();
        }
    }
    catch (err) {
        console.error('[CRON-INVOICE] Error during expired invoices cleanup:', err.message);
        throw err; // throw agar checkExpirations tahu ada kegagalan
    }
    return { markedExpired, deletedInvoices, deletedLicenses };
}
