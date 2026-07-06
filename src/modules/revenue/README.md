# MODULE REVENUE

## Deskripsi
Modul Revenue menyajikan data analitik keuangan tingkat platform (SaaS Global), melacak arus kas masuk (*Cash Flow*) langganan sekolah, rasio konversi upgrade paket, serta risiko kehilangan pendapatan akibat pembatalan langganan (*churn rate*).

## Aktor & Peran
- **Superadmin / Manajemen Platform**: Memantau grafik pertumbuhan finansial platform.

## Sub-Modul & Fitur Terimplementasi
### 1. Revenue Intelligence
- **Global Overview**: Pendapatan kotor, ARR, MRR, dan rata-rata nilai transaksi (ARPU).
- **Churn Analysis**: Pelacakan kerugian finansial akibat tenant yang berhenti berlangganan.

## Teknologi & Pattern
- **Pattern**: Financial Analytics Engine.
- **Database**: Tabel `Invoice` dan `Payment` dari database lisensi pusat.
