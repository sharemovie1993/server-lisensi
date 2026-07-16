"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLicenseByKey = getLicenseByKey;
exports.findLicenseOrFail = findLicenseOrFail;
exports.isLicenseExpired = isLicenseExpired;
exports.getPlanFeatures = getPlanFeatures;
exports.generateInvoiceNumber = generateInvoiceNumber;
exports.generateLicenseKey = generateLicenseKey;
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const date_1 = require("../../../utils/date");
const format_1 = require("../../../utils/format");
const prisma = new client_1.PrismaClient();
/**
 * Fetch a license by key.
 */
async function getLicenseByKey(key) {
    const trimmed = key.trim();
    return await prisma.license.findUnique({
        where: { licenseKey: trimmed }
    });
}
/**
 * Find a license by ID or return a 404 response.
 */
async function findLicenseOrFail(id, reply) {
    const license = await prisma.license.findUnique({
        where: { id }
    });
    if (!license) {
        (0, format_1.sendError)(reply, 404, 'Lisensi tidak ditemukan.');
        return null;
    }
    return license;
}
/**
 * Check if a license is expired based on current YYYY-MM-DD date.
 */
function isLicenseExpired(license) {
    return (0, date_1.toDateStr)() > license.expiresAt;
}
/**
 * Get the features list associated with a Plan.
 */
async function getPlanFeatures(planId) {
    if (!planId)
        return [];
    try {
        const plan = await prisma.plan.findUnique({
            where: { id: planId }
        });
        return plan?.featuresJson ?? [];
    }
    catch {
        return [];
    }
}
/**
 * Generate a standard invoice number.
 */
function generateInvoiceNumber(prefix) {
    const randomPrefix = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${randomPrefix}-${new Date().getFullYear()}`;
}
/**
 * Generate a random license key using crypto bytes.
 */
function generateLicenseKey(prefix) {
    const p = prefix ? prefix.toUpperCase() : 'LIC';
    const block1 = crypto_1.default.randomBytes(4).toString('hex').toUpperCase();
    const block2 = crypto_1.default.randomBytes(4).toString('hex').toUpperCase();
    const block3 = crypto_1.default.randomBytes(4).toString('hex').toUpperCase();
    return `${p}-${block1}-${block2}-${block3}`;
}
