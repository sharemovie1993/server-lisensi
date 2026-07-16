"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLicenseAndSubscription = createLicenseAndSubscription;
exports.createInvoice = createInvoice;
exports.sendBothWaNotifications = sendBothWaNotifications;
const client_1 = require("@prisma/client");
const helpers_1 = require("../helpers");
const prisma = new client_1.PrismaClient();
async function createLicenseAndSubscription(licenseKey, data) {
    return await prisma.$transaction(async (tx) => {
        // 1. Create License
        const license = await tx.license.create({
            data: {
                licenseKey,
                productId: data.productId,
                schoolName: data.schoolName,
                deviceLimit: data.deviceLimit,
                isUnlimited: data.isUnlimited,
                expiresAt: data.expiresAt,
                status: data.status,
                isActive: data.isActive,
                planId: data.planId,
                requestedSlug: data.requestedSlug,
                wireguardIp: data.wireguardIp,
                includeVpn: data.includeVpn,
                operatorPhone: data.operatorPhone,
                npsn: data.npsn,
                originalDeviceId: data.originalDeviceId
            }
        });
        // 2. Create Subscription
        const subscription = await tx.subscription.create({
            data: {
                licenseId: license.id,
                schoolName: data.schoolName,
                productId: data.productId,
                planId: data.planId,
                status: data.status,
                startDate: '',
                endDate: ''
            }
        });
        return { license, subscription };
    });
}
async function createInvoice(data) {
    return await prisma.invoice.create({
        data: {
            invoiceNumber: data.invoiceNumber,
            licenseId: data.licenseId,
            schoolName: data.schoolName,
            productId: data.productId,
            planTitle: data.planTitle,
            amount: data.amount,
            status: data.status,
            paymentMethod: data.paymentMethod,
            paymentInstructions: data.paymentInstructions,
            expiredTime: data.expiredTime,
            planId: data.planId
        }
    });
}
async function sendBothWaNotifications(phone, schoolName, slug, prodId, planName, key, invoiceNum, amount, paymentMethod, status, payCode, qrUrl) {
    await Promise.allSettled([
        (0, helpers_1.sendLicenseWhatsAppNotification)(phone, schoolName, slug, prodId, planName, key, invoiceNum, amount, paymentMethod, status, payCode, qrUrl),
        (0, helpers_1.sendOwnerOrderNotification)(schoolName, slug, prodId, planName, key, invoiceNum, amount, paymentMethod)
    ]);
}
