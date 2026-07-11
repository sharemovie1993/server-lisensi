# ARSITEKTUR — Central Licensing Server (CLS)

## Gambaran Umum

Server Lisensi Pusat (CLS) adalah layanan otonom yang bertanggung jawab atas:
- Penerbitan, aktivasi, dan verifikasi lisensi untuk seluruh produk ekosistem Baraya/Absenta ID.
- Routing domain/subdomain berbasis lisensi aktif via Caddy reverse proxy.
- Pemantauan kesehatan node server (heartbeat & telemetri) dari seluruh tenant.
- Otomasi billing via Tripay dan notifikasi interaktif via WhatsApp.

---

## Stack Teknologi

**Backend:**
- **Runtime**: Node.js (TypeScript)
- **Framework**: Fastify (high-performance, low overhead)
- **ORM**: Prisma (type-safe, PostgreSQL driver)
- **Database**: PostgreSQL (`orkestrator_licensing` — hosted di `10.0.0.2:5432` internal VPS network)

**Infrastructure:**
- **Deployment**: Ubuntu VPS, PM2 (process manager)
- **Reverse Proxy & SSL**: Caddy (auto-HTTPS, On-Demand TLS, dynamic config via JSON API)
- **Tunneling**: WireGuard (untuk node sekolah on-premise)
- **Notifikasi**: WhatsApp via Baileys (`@whiskeysockets/baileys`)

**Admin Panel:**
- **Framework**: React + TypeScript (Vite)
- **Styling**: TailwindCSS
- **Build output**: `public/` — di-serve statis oleh Fastify

---

## Arsitektur Multi-Produk

Satu instance CLS melayani banyak produk menggunakan kolom `product_id`:

```
Product (id, name, prefix)
  └─ Plan (productId, priceMonthly, featuresJson)
       └─ License (licenseKey, productId, schoolName, status)
            ├─ Subscription (status, startDate, endDate)
            ├─ Invoice (amount, status, paymentMethod)
            ├─ ActivatedDevice (deviceId, activatedAt)
            └─ ActivityLog (action, ipAddress, timestamp)
```

**Produk yang terdaftar (real data dari DB):**
| Product ID          | Nama                  | Prefix Key |
|---------------------|-----------------------|------------|
| `absenta`           | Platform Cakola       | `ABS`      |
| `easy-tunnel`       | Easy Tunnel           | `ET`       |
| `gform-orkestrator` | GForm Orkestrator     | `GF`       |
| `platform-absenta`  | *(legacy alias)*      | `PLA`      |
| `project-yatim`     | Project Yatim         | `YT`       |
| `vpn-tunnel`        | VPN Tunneling Addon   | `VPN`      |

> ⚠️ `platform-absenta` adalah alias legacy dari `absenta` yang masih ada di DB. Perlu dimigrasi (lihat `040-decisions.md`).

---

## Pola Arsitektur

- **Route Modularisasi**: API dipisah berdasarkan domain — `core.routes.ts`, `auth.routes.ts`, `payment.routes.ts`, `tunnel.routes.ts`, `heartbeat.routes.ts`, `admin.routes.ts`.
- **Caddy Dynamic Config**: Konfigurasi reverse proxy di-generate dan di-push ke Caddy JSON API setiap kali status lisensi berubah (aktivasi/kedaluwarsa/penghapusan).
- **Cron-based Automation**: `checkExpirations()` dan `cleanupInactiveTrials()` berjalan setiap 30 detik via `setInterval` untuk menjaga kebersihan data secara otomatis.
- **Interactive WA Bot**: Session-based chatbot via Baileys untuk interaksi operator saat mendapat peringatan lisensi tidak aktif.
- **RSA JWT Signing**: License token ditandatangani dengan RSA-2048 private key dan diverifikasi dengan public key yang bisa didistribusikan ke client.

---

## Alur Utama

### 1. Request & Billing Lisensi Baru
```
Client → POST /api/license/request
  ├─ Validasi product_id → ambil ke DB Product
  ├─ Validasi plan_id
  ├─ Idempotency check (device_id + slug)
  ├─ Generate license key: {PREFIX}-XXXX-XXXX-XXXX
  ├─ Buat Invoice via Tripay (atau gratis)
  └─ Kirim notifikasi WA ke operator
```

### 2. Aktivasi Lisensi
```
Client → POST /api/license/activate
  ├─ Verifikasi license_key ada di DB
  ├─ Verifikasi product_id cocok
  ├─ Verifikasi device_id (hardware fingerprint)
  ├─ Buat JWT token signed RSA
  └─ Trigger Caddy sync (tambah routing subdomain)
```

### 3. Heartbeat (setiap 2 menit dari node)
```
Node Server → POST /api/heartbeat
  ├─ Update lastHeartbeatAt, activeUsers, dbSize, memoryUsage
  └─ Dicatat ke TenantMetrics
```

### 4. Auto-Cleanup Lisensi Trial
```
Cron (setiap 30 detik) → cleanupInactiveTrials()
  ├─ 7-13 hari tidak aktif → WA peringatan interaktif (pilih 1/2/3)
  ├─ ≥14 hari tidak aktif → WA notifikasi hapus → hapus data → Caddy sync
  └─ Safety: skip jika ada invoice lunas
```

---

## Variabel Environment (`.env`)

| Key | Keterangan |
|-----|------------|
| `ADMIN_SECRET` | PIN login admin dashboard |
| `TOTP_SECRET` | Secret untuk 2FA admin |
| `TRIPAY_API_KEY` | API key payment gateway |
| `TRIPAY_PRIVATE_KEY` | Private key untuk signature Tripay |
| `TRIPAY_MERCHANT_CODE` | Kode merchant Tripay |
| `TRIPAY_API_URL` | URL API Tripay (sandbox/production) |
| `MAIN_DOMAIN` | Domain utama (default: `absenta.id`) |
| `DISABLE_2FA` | `true` untuk bypass TOTP di dev |
| `PORT` | Port server (default: `5001`) |
