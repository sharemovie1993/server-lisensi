# 🔐 Central Licensing Server (CLS) - Platform Cakola

Server lisensi pusat otoritas untuk mengelola lisensi, tagihan, VPN WireGuard (Easy Tunnel), dan routing reverse proxy otomatis untuk seluruh ekosistem **Platform Cakola (Platform Catat dan Kelola)** dan produk BarayaProject lainnya.

---

## 🚀 Jalur Deployment & Pemeliharaan

Pembaruan backend dilakukan secara langsung dari komputer lokal dengan mengompilasi kode TypeScript dan mengunggahnya ke VPS, diikuti dengan me-reload proses PM2.

### 1. Kredensial Produksi VPS
* **IP VPS Pusat**: `103.196.155.87`
* **Domain Utama**: `absenta.id` / `api.absenta.id`
* **User SSH**: `asepsuryadi`
* **SSH Key CLS (Pusat)**: `ls-key.pem`
* **SSH Key Client (Sekolah)**: `nginxonly.pem`

### 2. Aksi PM2 (Remote Daemon)
Untuk mengelola proses backend server lisensi di VPS:
```bash
# Masuk ke server lisensi pusat
pm2 status                  # Melihat status server lisensi
pm2 reload licensing-server # Reload tanpa downtime (zero-downtime)
pm2 restart licensing-server # Restart ulang penuh
pm2 logs licensing-server   # Memonitor log live (termasuk bot WA)
```

---

## ⚙️ Arsitektur & Aturan Sistem

### 1. Database & ORM
Sistem telah dimigrasikan sepenuhnya dari SQLite ke **PostgreSQL** dengan menggunakan **Prisma ORM** untuk menjamin konkurensi data yang tinggi, integritas referensial (Foreign Key), dan performa transaksi real-time.

### 2. Alur Lisensi & Perangkat (HWID Fingerprint)
* **Aktivasi (`/api/license/activate`)**: Pendaftaran kunci perangkat unik (HWID) dilakukan secara ketat hanya pada endpoint aktivasi ketika mengembalikan respons sukses (200). Kunci ini akan disimpan di tabel `activated_devices`.
* **Heartbeat (`/api/platform/heartbeat`)**: Client mengirimkan data heartbeat setiap 30 detik untuk telemetri statis (CPU, RAM, DB size). Endpoint ini **tidak** mendaftarkan atau memvalidasi HWID baru (hanya memantau keaktifan server).

### 3. Pemisahan UI Panel Admin (Admin Panel)
* **Daftar Server (Server-Centric)**: Menyajikan data status telemetri hardware server node secara eksklusif (CPU/RAM/DB size), status lisensi yang terikat, fingerprint terdaftar (HWID), status WireGuard, tombol reset perangkat, dan mode deploy (Hybrid/Cloud). Visual dropdown tenant sekolah dihilangkan dari menu ini.
* **Daftar Sekolah (Tenant-Centric)**: Menampilkan flat list sekolah terdaftar, domain/subdomain, server asal (lisensi induk), serta list paket/modul langganan bersangkutan beserta masa aktif dan status masing-masing modul.

---

## 🤖 WhatsApp Bot & Pembersihan Trial Otomatis (Cron Cleanup)

Sistem memantau masa aktif server uji coba (trial), penagihan invoice kadaluarsa, serta sinkronisasi routing proxy melalui cron job di background yang dieksekusi secara presisi menggunakan **`node-cron`** setiap hari pukul **01:00 AM** dini hari (untuk meminimalkan gangguan operasional KBM sekolah akibat pencabutan domain). Aktivitas ini direkam dalam tabel database `CronJobLog` dan dapat dimonitor secara visual melalui panel "Monitoring Cron" di Dashboard Admin.

### 1. Fase Peringatan (Hari ke-7)
Jika server trial tidak mengirimkan heartbeat selama **7 s/d 14 hari**, bot WhatsApp Gateway (`6283816286608`) akan mengirimkan peringatan interaktif ke nomor WhatsApp operator yang terdaftar.
* Operator dapat merespon dengan angka:
  * `1` — Pertahankan lisensi (tunda pembersihan selama 7 hari lagi).
  * `2` — Tandai sebagai tidak aktif.
  * `3` — Hapus data sekarang.

### 2. Fase Pembersihan (Hari ke-14)
Jika tidak ada aktivitas heartbeat selama **14+ hari** (atau lisensi trial baru dibuat selama 7+ hari tanpa heartbeat pertama), sistem secara otomatis melakukan **Cascading Deletion** (menghapus data lisensi, subscription, invoice, dan device lock) serta me-reload konfigurasi Caddy untuk melepas subdomain/DNS.

### 3. Resolusi LID & Proteksi Privasi Chat
* **Resolusi LID JID**: Bot secara dinamis mendeteksi properti `remoteJidAlt` pada event incoming message Baileys untuk memetakan LID ID pengirim (`@lid`) ke nomor telepon aslinya (`@s.whatsapp.net`).
* **Proteksi Privasi**: Jika pesan masuk berasal dari nomor yang tidak terdaftar di database lisensi, bot akan langsung keluar secara diam-diam (*silent return*) tanpa membalas chat apa pun. Ini memastikan chat pribadi dari kontak biasa Anda tidak akan pernah terganggu.
* **Fitur Cek Mandiri**: Operator terdaftar bisa mengetik kata kunci `"cek"`, `"lisensi"`, atau `"info"` kapan saja untuk mendapatkan list detail lisensi mereka dari bot.

---

## 📂 Struktur Direktori Projek (TS Framework)
* `src/server.ts`: Entry point Fastify, inisialisasi WA Gateway, dan scheduler cron.
* `src/routes/`: Router API.
  * `src/routes/license/`: Logika validasi dan transaksi billing lisensi untuk server klien (klien Easy Tunnel).
  * `src/routes/admin/`: Folder sub-routing modular khusus untuk dashboard admin panel (auth, billing, nodes, settings, system, tickets, whatsapp, public, dsb).
  * `src/routes/admin.routes.ts`: Central route entry point yang mendaftarkan seluruh sub-routing admin.
  * `src/routes/tickets.routes.ts`: Router API tiket bantuan untuk client.
  * `src/routes/heartbeat.routes.ts`: Router heartbeat server node.
* `src/services/`: Logika modular (`caddy.service.ts`, `cron.service.ts`, `whatsapp.service.ts`, `wa-bot.service.ts`).
* `prisma/schema.prisma`: Skema relasi PostgreSQL.
* `dist/`: Berkas compiled JavaScript untuk produksi.
* `platform-panel/`: Dashboard Frontend admin (React/TypeScript).
