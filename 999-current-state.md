# CURRENT STATE

Completed:
- **Fastify TS Server Engine**: Migrasi server Express JS lama ke server Fastify berbasis TypeScript untuk performa dan type-safety yang lebih tinggi.
- **PostgreSQL & Prisma Migration**: Pemodelan relasi database pusat menggunakan Prisma ORM dan PostgreSQL, menggantikan sistem dual-mode database SQLite yang lama.
- **WireGuard Tunneling (Easy Tunnel)**: Registrasi peer WireGuard otomatis, alokasi IP dinamis subnet `10.0.0.0/24`, isolasi firewall client-to-client, dan generator berkas konfig WireGuard.
- **Dynamic Caddy sync & On-Demand TLS**: Skrip `scripts/sync-caddy.js` otomatis menulis ulang `/etc/caddy/Caddyfile` dan reload Caddy secara instan. Menghubungkan API ask dynamic SSL Let's Encrypt dan endpoint pengunduh sertifikat SSL internal VPN.
- **WebSocket VNC Proxy**: Penerus komunikasi TightVNC desktop sekolah ke browser admin Cakola HQ lewat soket biner terowongan VPN.
- **WhatsApp Gateway Singleton**: Pengiriman kode OTP login operator, pairing QR bot, dan cron job pengingat tempo (jatuh tempo lisensi H-3 s/d H-1).
- **Payment Gateway Webhook**: Otorisasi tanda tangan webhook callback Tripay Sandbox/Production dan Xendit, disusul pembagian modul lisensi/modul Absenta otomatis.
- **Audit Logging**: Log trail aktivitas telemetri database/CPU/RAM heartbeat per sekolah.
- **Cleanup SQLite Remnants**: Penghapusan berkas database SQLite `licenses.db*`, server JS lama, dan utilitas force-activate yang usang di repositori lokal dan server produksi VPS.

In Progress:
- None

Current Focus:
- Final Verification & Cleanup.

Next Task:
- Integration testing with Absenta school clients during live deployments.
