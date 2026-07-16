# CURRENT STATE

Completed:
- **Fastify TS Server Engine**: Migrasi server Express JS lama ke server Fastify berbasis TypeScript untuk performa dan type-safety yang lebih tinggi.
- **PostgreSQL & Prisma Migration**: Pemodelan relasi database pusat menggunakan Prisma ORM dan PostgreSQL, menggantikan sistem dual-mode database SQLite yang lama.
- **WireGuard Tunneling (Easy Tunnel)**: Registrasi peer WireGuard otomatis, alokasi IP dinamis subnet `10.0.0.0/24`, isolasi firewall client-to-client, dan generator berkas konfig WireGuard.
- **Dynamic Caddy sync & On-Demand TLS**: Skrip `scripts/sync-caddy.js` otomatis menulis ulang `/etc/caddy/Caddyfile` dan reload Caddy secara instan. Menghubungkan API ask dynamic SSL Let's Encrypt dan endpoint pengunduh sertifikat SSL internal VPN.
- **WebSocket VNC Proxy**: Penerus komunikasi TightVNC desktop sekolah ke browser admin Cakola HQ lewat soket biner terowongan VPN.
- **WhatsApp Gateway Singleton**: Pengiriman kode OTP operator, pairing QR bot, dan integrasi WhatsApp bot interaktif untuk warning masa uji coba.
- **Payment Gateway Webhook**: Otorisasi tanda tangan webhook callback Tripay Sandbox/Production dan Xendit, disusul pembagian modul lisensi/modul Absenta otomatis.
- **Audit Logging**: Log trail aktivitas telemetri database/CPU/RAM heartbeat per sekolah.
- **Cleanup SQLite Remnants**: Penghapusan berkas database SQLite `licenses.db*`, server JS lama, dan utilitas force-activate yang usang di repositori lokal dan server produksi VPS.
- **Standard Industry Scheduler (`node-cron`)**: Mengganti interval timer lama (`setInterval`) dengan `node-cron` yang dijadwalkan tepat pukul 01:00 dini hari agar tidak mengganggu jam operasional KBM sekolah.
- **Cron Monitoring Panel & DB Logging**: Menambahkan skema logging `CronJobLog` di database PostgreSQL dan halaman visual dashboard interaktif untuk memantau status running counter, last run, durasi, metrik sukses/gagal, dan bypass manual trigger.
- **Client Hardware Specs Visualization**: Integrasi visualisasi rincian sistem klien (Sistem Operasi, CPU, RAM, Disk) di panel detail samping `TenantManager` dengan mem-parsing string telemetri `osType` secara dinamis.
- **License Status Filter**: Penyaringan status lisensi non-pending (`{ not: 'pending' }`) pada API `/api/auth/my-licenses` agar lisensi belum terbayar tidak bocor ke klien Easy Tunnel.

In Progress:
- None

Current Focus:
- Pemeliharaan sistem dan pemantauan stabilitas heartbeat.

Next Task:
- Eksplorasi fitur otomatisasi port publik khusus untuk terowongan non-HTTP (RDP/TCP).
