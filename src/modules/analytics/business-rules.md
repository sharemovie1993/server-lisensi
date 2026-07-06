# BUSINESS RULES - ANALYTICS

### 1. Data Refresh & Caching
- **Daily Aggregation**: Proses agregasi kohort dan proyeksi pendapatan dilakukan secara berkala melalui background job (sekali sehari) untuk menghindari overhead query database transaksional.
- **No Direct Modification**: Data analitik dihitung dari data riil invoice dan login, tidak diperbolehkan memiliki input manual.
