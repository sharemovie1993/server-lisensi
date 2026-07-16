import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { FastifyReply } from 'fastify';
import { toDateStr } from '../../../utils/date';
import { sendError } from '../../../utils/format';

const prisma = new PrismaClient();

/**
 * Fetch a license by key.
 */
export async function getLicenseByKey(key: string) {
  const trimmed = key.trim();
  return await prisma.license.findUnique({
    where: { licenseKey: trimmed }
  });
}

/**
 * Find a license by ID or return a 404 response.
 */
export async function findLicenseOrFail(id: string, reply: FastifyReply) {
  const license = await prisma.license.findUnique({
    where: { id }
  });
  if (!license) {
    sendError(reply, 404, 'Lisensi tidak ditemukan.');
    return null;
  }
  return license;
}

/**
 * Check if a license is expired based on current YYYY-MM-DD date.
 */
export function isLicenseExpired(license: { expiresAt: string }): boolean {
  return toDateStr() > license.expiresAt;
}

/**
 * Get the features list associated with a Plan.
 */
export async function getPlanFeatures(planId: string | null): Promise<string[]> {
  if (!planId) return [];
  try {
    const plan = await prisma.plan.findUnique({
      where: { id: planId }
    });
    return (plan?.featuresJson as string[]) ?? [];
  } catch {
    return [];
  }
}

/**
 * Generate a standard invoice number.
 */
export function generateInvoiceNumber(prefix: string): string {
  const randomPrefix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${randomPrefix}-${new Date().getFullYear()}`;
}

/**
 * Generate a random license key using crypto bytes.
 */
export function generateLicenseKey(prefix: string): string {
  const p = prefix ? prefix.toUpperCase() : 'LIC';
  const block1 = crypto.randomBytes(4).toString('hex').toUpperCase();
  const block2 = crypto.randomBytes(4).toString('hex').toUpperCase();
  const block3 = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${p}-${block1}-${block2}-${block3}`;
}
