import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface TripayEnvironmentConfig {
  mode: 'PRODUCTION' | 'SANDBOX';
  merchantCode: string;
  apiKey: string;
  privateKey: string;
  apiUrl: string;
}

/**
 * Mendapatkan kredensial Tripay (Production vs Sandbox) secara dinamis
 * berdasarkan kolom payment_mode di tabel Product pada database.
 */
export async function getTripayConfigByProductId(productId?: string | null): Promise<TripayEnvironmentConfig> {
  const prodMerchantCode = process.env.TRIPAY_PROD_MERCHANT_CODE || '';
  const prodApiKey       = process.env.TRIPAY_PROD_API_KEY || '';
  const prodPrivateKey   = process.env.TRIPAY_PROD_PRIVATE_KEY || '';
  const prodApiUrl       = process.env.TRIPAY_PROD_API_URL || 'https://tripay.co.id/api';

  const sandMerchantCode = process.env.TRIPAY_SANDBOX_MERCHANT_CODE || process.env.TRIPAY_MERCHANT_CODE || '';
  const sandApiKey       = process.env.TRIPAY_SANDBOX_API_KEY || process.env.TRIPAY_API_KEY || '';
  const sandPrivateKey   = process.env.TRIPAY_SANDBOX_PRIVATE_KEY || process.env.TRIPAY_PRIVATE_KEY || '';
  const sandApiUrl       = process.env.TRIPAY_SANDBOX_API_URL || process.env.TRIPAY_API_URL || 'https://tripay.co.id/api-sandbox';

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
  } catch (err: any) {
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
export function getAllTripayPrivateKeys(): string[] {
  const keys = new Set<string>();
  if (process.env.TRIPAY_PROD_PRIVATE_KEY) keys.add(process.env.TRIPAY_PROD_PRIVATE_KEY);
  if (process.env.TRIPAY_SANDBOX_PRIVATE_KEY) keys.add(process.env.TRIPAY_SANDBOX_PRIVATE_KEY);
  if (process.env.TRIPAY_PRIVATE_KEY) keys.add(process.env.TRIPAY_PRIVATE_KEY);
  return Array.from(keys).filter(Boolean);
}
