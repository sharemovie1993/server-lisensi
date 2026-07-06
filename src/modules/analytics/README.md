# MODULE ANALYTICS

## Deskripsi
Modul Analytics adalah bagian platform intelijen Absenta.id yang berfokus pada visualisasi metrik bisnis seperti tren pendapatan (*revenue trend*), prediksi churn langganan (*revenue forecast*), dan retensi retensi pengguna (*cohort retention*) untuk manajemen platform.

## Aktor & Peran
- **System Superadmin**: Satu-satunya aktor yang memiliki wewenang penuh mengakses data analitik platform.

## Sub-Modul & Fitur Terimplementasi
### 1. Cohort Analysis Engine
- **Grid Retention**: Kalkulasi persentase retensi pengguna aktif per bulan berbasis pendaftaran.
- **GET /cohort**: Mengambil grid data kohort retensi.

### 2. Revenue Forecast
- **Prediction Model**: Algoritma heuristik linier sederhana untuk memproyeksikan pendapatan platform 3-6 bulan mendatang.
- **GET /revenue-forecast**: Mengambil data proyeksi finansial.
- **GET /revenue**: Dashboard ikhtisar pertumbuhan pendapatan bulanan.

## Teknologi & Pattern
- **Pattern**: Platform Analytics Engine, Predictive Analytics.
- **Database**: Tabel `PlatformMetrics` dan cache Redis untuk agregasi data.
