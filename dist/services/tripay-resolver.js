"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTripayConfigByProductId = getTripayConfigByProductId;
exports.getAllTripayPrivateKeys = getAllTripayPrivateKeys;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
/**
 * Mendapatkan kredensial Tripay (Production vs Sandbox) secara dinamis
 * berdasarkan kolom payment_mode di tabel Product pada database.
 */
async function getTripayConfigByProductId(productId) {
    const prodMerchantCode = process.env.TRIPAY_PROD_MERCHANT_CODE || '';
    const prodApiKey = process.env.TRIPAY_PROD_API_KEY || '';
    const prodPrivateKey = process.env.TRIPAY_PROD_PRIVATE_KEY || '';
    const prodApiUrl = process.env.TRIPAY_PROD_API_URL || 'https://tripay.co.id/api';
    const sandMerchantCode = process.env.TRIPAY_SANDBOX_MERCHANT_CODE || process.env.TRIPAY_MERCHANT_CODE || '';
    const sandApiKey = process.env.TRIPAY_SANDBOX_API_KEY || process.env.TRIPAY_API_KEY || '';
    const sandPrivateKey = process.env.TRIPAY_SANDBOX_PRIVATE_KEY || process.env.TRIPAY_PRIVATE_KEY || '';
    const sandApiUrl = process.env.TRIPAY_SANDBOX_API_URL || process.env.TRIPAY_API_URL || 'https://tripay.co.id/api-sandbox';
    if (!productId) {
        return {
            mode: 'SANDBOX',
            merchantCode: sandMerchantCode,
            apiKey: sandApiKey,
            privateKey: sandPrivateKey,
            apiUrl: sandApiUrl
        };
    }
    // Normalisasi productId (misal 'cakola' atau 'absenta')
    const cleanId = productId.toLowerCase().trim();
    try {
        const product = await prisma.product.findFirst({
            where: {
                OR: [
                    { id: cleanId },
                    { prefix: cleanId.toUpperCase() }
                ]
            }
        });
        if (product && (product.paymentMode === 'PRODUCTION' || product.paymentMode === 'production')) {
            return {
                mode: 'PRODUCTION',
                merchantCode: prodMerchantCode,
                apiKey: prodApiKey,
                privateKey: prodPrivateKey,
                apiUrl: prodApiUrl
            };
        }
    }
    catch (err) {
        console.error(`[Tripay Resolver] Gagal mengambil payment_mode produk ${productId}:`, err.message);
    }
    // Default fallback ke Sandbox
    return {
        mode: 'SANDBOX',
        merchantCode: sandMerchantCode,
        apiKey: sandApiKey,
        privateKey: sandPrivateKey,
        apiUrl: sandApiUrl
    };
}
/**
 * Mendapatkan daftar semua Private Key Tripay yang valid (Production & Sandbox)
 * untuk memvalidasi webhook signature Tripay secara aman.
 */
function getAllTripayPrivateKeys() {
    const keys = new Set();
    if (process.env.TRIPAY_PROD_PRIVATE_KEY)
        keys.add(process.env.TRIPAY_PROD_PRIVATE_KEY);
    if (process.env.TRIPAY_SANDBOX_PRIVATE_KEY)
        keys.add(process.env.TRIPAY_SANDBOX_PRIVATE_KEY);
    if (process.env.TRIPAY_PRIVATE_KEY)
        keys.add(process.env.TRIPAY_PRIVATE_KEY);
    return Array.from(keys).filter(Boolean);
}
