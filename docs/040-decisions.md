# DECISION LOG — Central Licensing Server

Format: `YYYY-MM: Judul Keputusan`
- **Keputusan**: Apa yang diputuskan.
- **Rasional**: Mengapa keputusan ini diambil.

---

2026-01: Single Product Origin (GForm Orkestrator)
- **Keputusan**: Server lisensi pertama kali dibangun hanya untuk satu produk: `gform-orkestrator` dengan prefix key `GF-`.
- **Rasional**: Scope awal yang terbatas memungkinkan pengembangan cepat dan deployment ke production tanpa kompleksitas multi-produk.

2026-03: Ekspansi ke Multi-Produk (Absenta)
- **Keputusan**: CLS diperluas untuk melayani produk kedua, `absenta` (alias `platform-absenta`), menggunakan kolom `product_id` yang sudah ada di skema.
- **Rasional**: Efisiensi infrastruktur — satu server lisensi melayani semua produk ekosistem Baraya/Absenta ID.

2026-05: SQLite sebagai Database Awal
- **Keputusan**: Menggunakan SQLite (embedded via Prisma) sebagai database awal CLS.
- **Rasional**: Zero-dependency infrastruktur, tidak butuh setup database server terpisah, dan volume data lisensi tidak membutuhkan skalabilitas horizontal pada tahap awal pengembangan.

2026-06: Migrasi Database dari SQLite ke PostgreSQL
- **Keputusan**: Mengganti SQLite dengan PostgreSQL (`orkestrator_licensing` di `10.0.0.2:5432`) sebagai database utama CLS.
- **Rasional**: Kebutuhan skalabilitas yang meningkat seiring bertambahnya produk dan tenant. PostgreSQL memberikan dukungan transaksi yang lebih kuat, konkurensi yang lebih baik, dan ekosistem tooling (backup, monitoring, replication) yang lebih matang dibanding SQLite untuk lingkungan production multi-produk.


2026-05: Caddy sebagai Reverse Proxy & Auto-SSL
- **Keputusan**: Menggunakan Caddy (bukan Nginx) untuk routing subdomain dan SSL termination.
- **Rasional**: Caddy mendukung On-Demand TLS dan konfigurasi dinamis via JSON API, sehingga penambahan subdomain tenant baru tidak memerlukan restart proxy atau edit file konfigurasi manual.

2026-06: RSA-2048 untuk License Token Signing
- **Keputusan**: Setiap license token di-sign dengan RSA-2048 private key (PKCS8) dan diverifikasi dengan public key yang dapat didistribusikan ke client.
- **Rasional**: Memungkinkan client (node sekolah) memverifikasi keaslian token secara offline tanpa harus menghubungi server lisensi setiap saat.

2026-06: WireGuard VPN untuk Node On-Premise
- **Keputusan**: Mengintegrasikan WireGuard sebagai opsional tunneling bagi server sekolah yang berjalan di jaringan lokal (on-premise) agar bisa diakses dari internet publik.
- **Rasional**: Alternatif yang lebih ringan dari DDNS dan port forwarding, dengan overhead enkripsi yang minimal dan koneksi peer-to-peer yang stabil.

2026-07: WhatsApp Gateway via Baileys
- **Keputusan**: Mengimplementasikan gateway WhatsApp langsung di dalam CLS menggunakan `@whiskeysockets/baileys` sebagai engine notifikasi.
- **Rasional**: Notifikasi billing, aktivasi, dan peringatan lisensi membutuhkan saluran komunikasi yang sudah familiar bagi operator sekolah. Baileys memungkinkan integrasi tanpa biaya API pihak ketiga.

2026-07: Interactive WA Bot dengan Session State
- **Keputusan**: Menambahkan mesin bot interaktif (`wa-bot.service.ts`) yang mempertahankan sesi per-nomor operator (TTL 24 jam) dan memproses balasan angka (1/2/3) untuk aksi cepat manajemen lisensi.
- **Rasional**: Operator sekolah dapat mengkonfirmasi status server, menandai server tidak aktif, atau meminta penghapusan langsung via WhatsApp tanpa harus login ke admin panel.

2026-07: 2-Phase Auto-Cleanup Trial Licenses via Cron
- **Keputusan**: Mengimplementasikan pembersihan lisensi trial tidak aktif dalam dua fase — peringatan di hari ke-7 (WA interaktif) dan penghapusan otomatis di hari ke-14 — dengan safety guard: skip jika ada invoice lunas.
- **Rasional**: Menjaga database CLS tetap bersih dari sisa lisensi percobaan (trial and error) deployment, sekaligus memberikan operator kesempatan merespons sebelum data dihapus permanen.

2026-07: Dynamic Product Prefix dari Database
- **Keputusan**: Prefix license key tidak lagi di-hardcode dalam kode (`'absenta' → 'ABS'`), melainkan diambil secara dinamis dari kolom `Product.prefix` di database via helper `getProductPrefix()`.
- **Rasional**: Menambahkan produk baru ke ekosistem tidak lagi memerlukan perubahan kode dan deployment ulang. Admin cukup mendaftarkan produk dengan prefix yang diinginkan via API admin.

2026-07: Helper `normalizeProductId()` untuk Konsistensi Alias
- **Keputusan**: Membuat fungsi `normalizeProductId()` terpusat di `helpers.ts` untuk memetakan alias product ID yang tidak konsisten (contoh: `'platform-absenta'` → `'absenta'`).
- **Rasional**: Kode legacy menghasilkan dua ID untuk produk yang sama (`'absenta'` dan `'platform-absenta'`), menyebabkan duplikasi conditional di 10+ titik kode. Satu fungsi normalisasi menyelesaikan ini tanpa migrasi data.
