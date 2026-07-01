// src/utils/keys.ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const PRIVATE_KEY_PATH = path.join(__dirname, '../../private_key.pem');
const PUBLIC_KEY_PATH = path.join(__dirname, '../../public_key.pem');

export function initializeKeys() {
  if (!fs.existsSync(PRIVATE_KEY_PATH) || !fs.existsSync(PUBLIC_KEY_PATH)) {
    console.log('[CRYPTO] Generating RSA 2048-bit key pair for secure license signing...');
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);
    fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);
    console.log('[CRYPTO] RSA key pair generated and saved successfully.');
  }
}

// Ensure keys exist
initializeKeys();

export const PRIVATE_KEY = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
export const PUBLIC_KEY = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
export const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123';
export const TOTP_SECRET = process.env.TOTP_SECRET || 'ABSENTASECRETKEYMYSECURETOKEN';
export const TRIPAY_API_KEY = process.env.TRIPAY_API_KEY;
export const TRIPAY_PRIVATE_KEY = process.env.TRIPAY_PRIVATE_KEY;
export const TRIPAY_MERCHANT_CODE = process.env.TRIPAY_MERCHANT_CODE;
export const TRIPAY_API_URL = process.env.TRIPAY_API_URL || 'https://tripay.co.id/api-sandbox';
