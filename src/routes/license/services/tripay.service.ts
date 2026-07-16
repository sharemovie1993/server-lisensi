import crypto from 'crypto';
import fetch from 'node-fetch';

/**
 * Generate Tripay HMAC SHA256 signature.
 */
export function buildTripaySignature(
  merchantCode: string,
  merchantRef: string,
  amount: number,
  privateKey: string
): string {
  return crypto
    .createHmac('sha256', privateKey)
    .update(merchantCode + merchantRef + amount)
    .digest('hex');
}

interface TripayPayloadConfig {
  method: string;
  merchantRef: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  sku: string;
  itemName: string;
  expirySeconds: number;
  signature: string;
}

/**
 * Construct standard Tripay request payload.
 */
export function buildTripayPayload(cfg: TripayPayloadConfig) {
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
export async function createTripayTransaction(
  payload: any,
  apiUrl: string,
  apiKey: string
): Promise<any | null> {
  try {
    const res = await fetch(`${apiUrl}/transaction/create`, {
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
    } else {
      throw new Error(data?.message || 'Gateway pembayaran Tripay sedang offline.');
    }
  } catch (err: any) {
    console.error('[Tripay Service] API crash:', err.message);
    throw err;
  }
}
