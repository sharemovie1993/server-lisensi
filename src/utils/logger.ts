// src/utils/logger.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function logLicenseActivity(
  licenseKey: string,
  productId: string,
  ipAddress: string,
  action: string
) {
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
  } catch (err: any) {
    console.error('[AUDIT LOG ERROR]', err.message);
  }
}
