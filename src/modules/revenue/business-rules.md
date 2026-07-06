# BUSINESS RULES - REVENUE

### 1. Financial Precision
- **Decimal Aggregation**: Perhitungan metrik keuangan wajib menggunakan operasi bilangan desimal presisi tinggi untuk menghindari pembulatan matematis yang salah.
- **Cache Policy**: Nilai MRR dan ARR dihitung ulang secara terjadwal setiap malam, bukan dihitung secara real-time pada setiap muat halaman dashboard.
