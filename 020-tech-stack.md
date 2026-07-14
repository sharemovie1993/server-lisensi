# TECH STACK

Backend Core:
- **Fastify**: Engine web asinkron dengan overhead minimal dan skalabilitas tinggi.
- **Prisma**: Type-safe ORM untuk pemetaan skema PostgreSQL dan migrasi database.
- **TypeScript**: Pengembangan berbasis tipe data statis.

Security & Auth:
- **jsonwebtoken**: Penandatanganan JWT asimetris (RS256) untuk sertifikat lisensi aktif.
- **crypto (Native)**: Enkripsi dan kalkulasi signature HMAC-SHA256 untuk webhook Tripay/Xendit.
- **Custom TOTP (RFC 6238)**: Algoritma TOTP mandiri untuk otentikasi login 2FA admin Cakola HQ.

Middleware & Services:
- **@whiskeysockets/baileys**: Pustaka WhatsApp API gateway berbasis WebSocket untuk bot pesan notifikasi.
- **ws**: WebSocket server untuk menjembatani protokol TightVNC ke Web browser.
- **pg (node-postgres)**: Klien postgres untuk eksekusi query SQL cepat pada skrip sinkronisasi Caddy.
- **qrcode**: Pembuat kode QR base64 untuk login bot WhatsApp.

Infrastructure Tools:
- **Caddy**: Reverse proxy web server dengan fitur ACME On-Demand TLS otomatis.
- **WireGuard**: Protokol VPN untuk membentuk terowongan (tunneling) aman bagi klien on-premise.
- **PM2**: Pengelola proses latar belakang dan autorestart server lisensi (`licensing-server`).
- **Iptables (Linux Firewall)**: Aturan blokir routing untuk isolasi keamanan lalu lintas internal VPN.

Payment Gateways:
- **Tripay**: Pintu pembayaran invoice tagihan paket lisensi/langganan.
- **Xendit**: Gateway pendukung untuk perluasan opsi pembayaran retail/bank transfer.
