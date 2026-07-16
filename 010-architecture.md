# ARCHITECTURE

Backend (Node.js):
- **Framework**: Fastify (Unified web framework).
- **Language**: TypeScript.
- **ORM**: Prisma (Type-safe PostgreSQL interface).

Database & Storage:
- **Primary**: PostgreSQL (Central database storing plans, products, licenses, invoices, logs, tickets, and platform metrics).
- **In-Memory Cache**: Redis (Optional / Dev stage setup).

Architecture Patterns:
- **RS256 JWT License Signing**: Otorisasi lisensi client menggunakan sepasang kunci asimetris. Server memegang `private_key.pem` untuk menandatangani token lisensi yang dipancarkan via endpoint `/api/license/activate`. Client sekolah lokal menggunakan `public_key.pem` untuk memvalidasi validitas token tersebut secara offline/independen.
- **On-Demand TLS Validation (SSL Dynamic)**: Menjawab callback HTTPS Caddy (`ask`) melalui endpoint `/api/public/validate-domain` untuk menyetujui atau menolak penerbitan sertifikat SSL secara dinamis demi efisiensi domain.
- **Secure Certificate Downloader**: Endpoint `/api/public/download-ssl` yang membatasi akses pengunduhan file sertifikat SSL publik milik Caddy hanya untuk IP WireGuard internal (`10.0.0.0/24`) atau client pemegang lisensi aktif.
- **WebSocket VNC Proxying**: Menghubungkan admin Cakola HQ ke desktop sekolah jarak jauh. Mengimplementasikan bridging dua arah dari port biner WebSocket (`ws://api.absenta.id/api/vnc/connect/:licenseKey`) ke soket TCP port `5900` server TightVNC lokal sekolah melalui terowongan VPN WireGuard.
- **VPN Subnet Isolation (Client-to-Client block)**: Pemasangan aturan iptables di VPS untuk menolak komunikasi antar-client VPN (`FORWARD wg0 to wg0`), mengunci keamanan sekolah agar tidak saling mengintip data.
- **Gateway Bot (Singleton Pattern)**: Pool WhatsApp gateway menggunakan `@whiskeysockets/baileys` yang diinisialisasi satu kali untuk mengirim OTP, notifikasi tagihan Tripay, dan peringatan kedaluwarsa sistem.
- **Daily Cron Schedulers & Logger Database**: Pemasangan penjadwal harian menggunakan `node-cron` yang dieksekusi tepat pukul 01:00 pagi setiap hari. Dilengkapi dengan logging aktivitas `CronJobLog` ke PostgreSQL untuk memantau status keberhasilan job dan ringkasan metrik statistiknya secara terpusat.


Communication:
- **REST API**: Endpoint untuk dashboard admin Cakola HQ, pengecekan heartbeat client, dan callback webhook payment gateway.
- **WebSockets (upgrade)**: Proxy VNC dan penanganan real-time stream data telemetri.
- **Webhook Payment**: Webhook callback Tripay & Xendit dengan validasi tanda tangan digital HMAC-SHA256 untuk memproses update otomatis masa aktif lisensi.
