# PROJECT

Nama:
Central Licensing Server (CLS) / Orkestrator Lisensi Absenta.id

Jenis:
Centralized Licensing, Subscription, & Tunneling Orchestrator

Tujuan:
Menjadi pusat otorisasi lisensi, registrasi subdomain sekolah, billing otomatis, audit keamanan log aktivitas, isolasi VPN, dan gateway monitoring terpadu untuk mendukung seluruh instansi/sekolah yang tergabung dalam ekosistem Absenta.id.

Target User:
- **Platform Administrator (Cakola HQ)**: Tim pusat pengelola yang memantau kesehatan server sekolah, mitigasi churn risk, dan manajemen ticket bantuan.
- **School Operator / Tenant Owner**: Operator lokal sekolah yang meregistrasikan subdomain, mengklaim lisensi, dan melakukan perpanjangan masa aktif (billing).
- **Client App Core (Absenta Node)**: Aplikasi backend sekolah lokal yang melakukan request token lisensi berkala dan sinkronisasi status.

Domain Utama:
- **License Orchestrator**: Pembuatan, pengaktifan, pembatasan perangkat (*HWID binding*), dan validasi token lisensi (JWT RS256).
- **Billing & Subscriptions (Tripay/Xendit Webhook)**: Sinkronisasi invoice dinamis dengan payment gateway Indonesia untuk memproses perpanjangan modul otomatis.
- **Dynamic Routing & On-Demand TLS (Caddy ask API)**: Otomatisasi konfigurasi Caddyfile untuk pemetaan subdomain sekolah (`*.absenta.id`) dan custom domain eksternal secara instant (ACME HTTP-01 Let's Encrypt).
- **Easy Tunnel Gateway (VPN WireGuard)**: Manajemen pertukaran kunci peer WireGuard dan subnet tunneling (`10.0.0.0/24`) untuk menjembatani server sekolah lokal ke internet publik.
- **VNC WebSocket-to-TCP Bridge**: Layanan reverse proxy desktop jarak jauh untuk keperluan remote debugging server lokal melalui panel admin Cakola HQ.
- **Telemetry & Risk Intelligence**: Pengumpulan log kesehatan database/CPU/RAM server lokal untuk analisis kecenderungan churn (*Churn Risk*) dan kecenderungan upgrade modul (*Upgrade Intelligence*).

Status:
Active Production Engine (Unified API Gateway)
