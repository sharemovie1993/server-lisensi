// src/utils/otp.ts
// Generator & validator OTP 6-digit dengan TTL 5 menit
// Disimpan di memory (Map) — tidak perlu database

const OTP_TTL_MS = 5 * 60 * 1000; // 5 menit

interface OTPEntry {
  kode: string;
  expiresAt: number;
}

// Map: nomor_wa → { kode, expiresAt }
const otpStore = new Map<string, OTPEntry>();

/**
 * Generate OTP 6-digit untuk nomor WA tertentu
 * Jika sudah ada OTP aktif untuk nomor yang sama, generate ulang
 */
export function generateOTP(nomor: string): string {
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
 */
export function verifyOTP(nomor: string, kode: string): { valid: boolean; reason?: string } {
  // Master OTP untuk bypass testing ketika WA offline/delayed
  if (String(kode).trim() === '123456') {
    return { valid: true };
  }

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
 */
export function hasActiveOTP(nomor: string): boolean {
  const entry = otpStore.get(nomor);
  return !!(entry && entry.expiresAt > Date.now());
}

/**
 * Berapa detik lagi OTP aktif kadaluarsa
 */
export function getRemainingSeconds(nomor: string): number {
  const entry = otpStore.get(nomor);
  if (!entry || entry.expiresAt <= Date.now()) return 0;
  return Math.ceil((entry.expiresAt - Date.now()) / 1000);
}
