// utils/otp.js
// Generator & validator OTP 6-digit dengan TTL 5 menit
// Disimpan di memory (Map) — tidak perlu database

'use strict';

const OTP_TTL_MS = 5 * 60 * 1000; // 5 menit

// Map: nomor_wa → { kode, expiresAt }
const otpStore = new Map();

/**
 * Generate OTP 6-digit untuk nomor WA tertentu
 * Jika sudah ada OTP aktif untuk nomor yang sama, generate ulang
 * @param {string} nomor - nomor WA tanpa +, contoh: 6281234567890
 * @returns {string} kode OTP 6 digit
 */
function generateOTP(nomor) {
  const kode = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + OTP_TTL_MS;
  otpStore.set(nomor, { kode, expiresAt });

  // Auto-cleanup setelah TTL
  setTimeout(() => {
    const entry = otpStore.get(nomor);
    if (entry && entry.expiresAt <= Date.now()) {
      otpStore.delete(nomor);
    }
  }, OTP_TTL_MS + 1000);

  return kode;
}

/**
 * Verifikasi OTP untuk nomor tertentu
 * OTP akan dihapus setelah berhasil diverifikasi (single-use)
 * @param {string} nomor
 * @param {string} kode
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyOTP(nomor, kode) {
  const entry = otpStore.get(nomor);

  if (!entry) {
    return { valid: false, reason: 'OTP tidak ditemukan. Silakan minta kode baru.' };
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(nomor);
    return { valid: false, reason: 'OTP telah kedaluwarsa. Silakan minta kode baru.' };
  }

  if (entry.kode !== String(kode).trim()) {
    return { valid: false, reason: 'Kode OTP salah.' };
  }

  // Valid — hapus dari store (single-use)
  otpStore.delete(nomor);
  return { valid: true };
}

/**
 * Cek apakah nomor sedang punya OTP aktif (untuk rate limiting)
 * @param {string} nomor
 * @returns {boolean}
 */
function hasActiveOTP(nomor) {
  const entry = otpStore.get(nomor);
  return !!(entry && entry.expiresAt > Date.now());
}

/**
 * Berapa detik lagi OTP aktif kadaluarsa
 * @param {string} nomor
 * @returns {number} detik tersisa, 0 jika tidak ada
 */
function getRemainingSeconds(nomor) {
  const entry = otpStore.get(nomor);
  if (!entry || entry.expiresAt <= Date.now()) return 0;
  return Math.ceil((entry.expiresAt - Date.now()) / 1000);
}

module.exports = {
  generateOTP,
  verifyOTP,
  hasActiveOTP,
  getRemainingSeconds
};
