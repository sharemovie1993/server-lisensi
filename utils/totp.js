const crypto = require('crypto');

function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  str = str.replace(/=+$/, '').toUpperCase();
  let length = str.length;
  let bits = 0;
  let value = 0;
  let index = 0;
  const buffer = Buffer.alloc(Math.floor((length * 5) / 8));
  for (let i = 0; i < length; i++) {
    const idx = alphabet.indexOf(str[i]);
    if (idx === -1) continue; // Skip invalid characters
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      buffer[index++] = (value >> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return buffer;
}

function generateTOTP(secret, timeWindowOffset = 0) {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / 30) + timeWindowOffset;

  const buffer = Buffer.alloc(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) {
    buffer[i] = tmp & 0xff;
    tmp = tmp >> 8;
  }

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(buffer);
  const hmacResult = hmac.digest();

  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const code =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const otp = code % 1000000;
  return String(otp).padStart(6, '0');
}

function verifyTOTP(secret, code) {
  if (!code) return false;
  const cleanCode = String(code).trim().replace(/\s/g, '');
  if (cleanCode.length !== 6) return false;
  for (let i = -1; i <= 1; i++) {
    if (generateTOTP(secret, i) === cleanCode) {
      return true;
    }
  }
  return false;
}

module.exports = {
  verifyTOTP,
  generateTOTP
};
