const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PRIVATE_KEY_PATH = path.join(__dirname, '..', 'private_key.pem');
const PUBLIC_KEY_PATH = path.join(__dirname, '..', 'public_key.pem');

function initializeKeys() {
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

// Ensure RSA keys are ready
initializeKeys();

const PRIVATE_KEY = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
const PUBLIC_KEY = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123';
const TOTP_SECRET = process.env.TOTP_SECRET || 'ABSENTASECRETKEYMYSECURETOKEN';

module.exports = {
  PRIVATE_KEY,
  PUBLIC_KEY,
  ADMIN_SECRET,
  TOTP_SECRET,
  PORT: process.env.PORT || 5000,
  TRIPAY_API_KEY: process.env.TRIPAY_API_KEY,
  TRIPAY_PRIVATE_KEY: process.env.TRIPAY_PRIVATE_KEY,
  TRIPAY_MERCHANT_CODE: process.env.TRIPAY_MERCHANT_CODE,
  TRIPAY_API_URL: process.env.TRIPAY_API_URL || 'https://tripay.co.id/api-sandbox',
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  EXPO_ACCESS_TOKEN: process.env.EXPO_ACCESS_TOKEN
};
