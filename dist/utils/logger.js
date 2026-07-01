"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logLicenseActivity = logLicenseActivity;
// src/utils/logger.ts
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function logLicenseActivity(licenseKey, productId, ipAddress, action) {
    try {
        // Check if license exists first, because of relation constraint in ActivityLog
        const lic = await prisma.license.findUnique({ where: { licenseKey: licenseKey.trim() } });
        if (!lic) {
            console.warn(`[AUDIT LOG WARNING] License key ${licenseKey} not found. Skipping ActivityLog creation.`);
            return;
        }
        await prisma.activityLog.create({
            data: {
                licenseKey: licenseKey.trim(),
                productId,
                ipAddress,
                action
            }
        });
    }
    catch (err) {
        console.error('[AUDIT LOG ERROR]', err.message);
    }
}
