"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTripaySignature = buildTripaySignature;
exports.buildTripayPayload = buildTripayPayload;
exports.createTripayTransaction = createTripayTransaction;
const crypto_1 = __importDefault(require("crypto"));
const node_fetch_1 = __importDefault(require("node-fetch"));
/**
 * Generate Tripay HMAC SHA256 signature.
 */
function buildTripaySignature(merchantCode, merchantRef, amount, privateKey) {
    return crypto_1.default
        .createHmac('sha256', privateKey)
        .update(merchantCode + merchantRef + amount)
        .digest('hex');
}
/**
 * Construct standard Tripay request payload.
 */
function buildTripayPayload(cfg) {
    return {
        method: cfg.method,
        merchant_ref: cfg.merchantRef,
        amount: cfg.amount,
        customer_name: cfg.customerName,
        customer_email: cfg.customerEmail,
        customer_phone: cfg.customerPhone,
        order_items: [
            {
                sku: cfg.sku,
                name: cfg.itemName,
                price: cfg.amount,
                quantity: 1
            }
        ],
        expired_time: Math.floor(Date.now() / 1000) + cfg.expirySeconds,
        signature: cfg.signature
    };
}
/**
 * Call Tripay API transaction creation endpoint.
 */
async function createTripayTransaction(payload, apiUrl, apiKey) {
    try {
        const res = await (0, node_fetch_1.default)(`${apiUrl}/transaction/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload),
            timeout: 4000
        });
        const data = await res.json();
        if (data && data.success) {
            return data.data;
        }
        else {
            throw new Error(data?.message || 'Gateway pembayaran Tripay sedang offline.');
        }
    }
    catch (err) {
        console.error('[Tripay Service] API crash:', err.message);
        throw err;
    }
}
