# MODULE RISK INTELLIGENCE

## Deskripsi
Modul Risk Intelligence bertugas menganalisis parameter kesehatan tenant dan menghitung skor risiko (*Risk Score*) sekolah, guna mendeteksi tenant yang berpotensi gagal bayar tagihan lisensi atau berniat berhenti menggunakan platform.

## Aktor & Peran
- **Platform Customer Success**: Mengidentifikasi sekolah-sekolah yang memerlukan pendampingan penggunaan aplikasi.

## Sub-Modul & Fitur Terimplementasi
### 1. Tenant Risk Evaluation
- **Risk Score Calculator**: Menghitung bobot risiko berdasarkan parameter keaktifan login guru/siswa, keterlambatan pembayaran invoice, dan frekuensi penggunaan modul utama.
- **GET /tenant/:id**: Detail indikator risiko sekolah tertentu.

## Teknologi & Pattern
- **Pattern**: Decision Engine, Risk Profiling.
- **Database**: Membaca data log aktivitas dan riwayat invoice.
