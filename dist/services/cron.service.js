"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkExpirations = checkExpirations;
const client_1 = require("@prisma/client");
const caddy_service_1 = require("./caddy.service");
const prisma = new client_1.PrismaClient();
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
            return;
        }
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
            // Send WhatsApp Notification if operator has a phone number
            // We will read developer configuration or operator phone from lic.operatorPhone if it is configured.
            // Wait, in our schema we didn't add operatorPhone to License (because the SQLite db didn't have it in schema,
            // or we just didn't map it. Let's see if we should send it to a default admin phone or if we should add it).
            // Since it is building from scratch, let's keep the logging action.
        }
        // Trigger Caddy sync to remove routing for expired licenses
        console.log(`[CRON] Triggering Caddy sync to remove routing for ${expiredLicenses.length} expired licenses...`);
        await (0, caddy_service_1.triggerCaddySync)();
    }
    catch (err) {
        console.error('[CRON] Error during expiration check:', err.message);
    }
}
