# MODULE UPGRADE INTELLIGENCE (Platform Upsell Prediction)

## Deskripsi
Modul Upgrade Intelligence bertugas menganalisis pola penggunaan fitur oleh tenant (jumlah siswa terdaftar, volume transaksi koperasi, dan frekuensi notifikasi) untuk memberikan rekomendasi penawaran upgrade paket lisensi secara cerdas (*Upsell Intelligence*).

## Aktor & Peran
- **Platform Sales / Marketing Agent**: Membaca laporan rekomendasi promosi paket.

## Sub-Modul & Fitur Terimplementasi
### 1. Upsell Analysis Engine
- **Upgrade Recommendation**: Melacak sekolah yang kuota penggunanya sudah mendekati batas paket aktif (misal: penggunaan sudah 90% dari limit paket Micro).
- **GET /overview**: Laporan statistik sekolah potensial untuk ditawarkan paket premium.

## Teknologi & Pattern
- **Pattern**: Heuristic Prediction Engine, Usage Analytics.
