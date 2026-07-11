# WORKING FLOW — Central Licensing Server

## Cara Update & Deploy ke VPS

### 1. Update Kode (dari komputer lokal)
```powershell
# Di folder Project-Server-Lisensi:
git add .
git commit -m "feat/fix/refactor: deskripsi perubahan"
git push origin master

# Deploy ke VPS:
ssh -i ls-key.pem asepsuryadi@103.196.155.87 `
  "cd /var/www/licensing-server && git pull && pm2 reload licensing-server && pm2 save"
```

### 2. Build Admin Panel (jika ada perubahan UI)
```powershell
cd platform-panel
npm run build
# Output ke: ../public/ (otomatis di-serve oleh Fastify)
cd ..
git add platform-panel/src public/
git commit -m "feat(panel): deskripsi perubahan UI"
git push origin master
# Lalu deploy VPS seperti di atas
```

### 3. Akses Admin Dashboard
- **URL**: `https://api.absenta.id/` atau `https://api.absenta.id/admin`
- **Login**: PIN admin + kode 2FA TOTP
- Gunakan aplikasi authenticator (Google Authenticator / Aegis) dengan secret `TOTP_SECRET`

---

## Konvensi Kode

### Penamaan File
- Routes: `nama-domain.routes.ts` (contoh: `heartbeat.routes.ts`)
- Services: `nama.service.ts` (contoh: `caddy.service.ts`)
- Utils: `nama.ts` (contoh: `logger.ts`, `keys.ts`)
- Docs: `NNN-nama.md` dengan nomor urut 3 digit (contoh: `010-architecture.md`)

### Commit Message Format
```
type(scope): deskripsi singkat

Contoh:
feat(license): tambah endpoint reset device lock
fix(cron): perbaiki threshold cleanup 14 hari
refactor(prefix): ambil prefix dari DB bukan hardcode
docs: tambah 040-decisions.md untuk CLS
```

Type yang digunakan: `feat`, `fix`, `refactor`, `docs`, `chore`, `perf`

### Penambahan Produk Baru (tanpa deploy ulang)
1. Login ke admin dashboard → menu **Produk & Plan**
2. Buat produk baru: isi `ID`, `Nama`, `Prefix` (contoh: `easy-tunnel`, `Easy Tunnel`, `ET`)
3. Buat plan untuk produk tersebut
4. Server lisensi otomatis mengenali prefix baru saat generate license key

---

## Struktur Folder Penting

```
Project-Server-Lisensi/
├── docs/                    ← Dokumentasi proyek (NEW)
│   ├── 010-architecture.md
│   ├── 040-decisions.md
│   └── 050-working-flow.md
├── platform-panel/          ← Admin Dashboard (React/Vite)
│   └── src/components/
├── prisma/
│   └── schema.prisma        ← Definisi skema database
├── src/
│   ├── modules/             ← Modul analytics, revenue, risk, dll
│   ├── routes/
│   │   ├── license/         ← core, auth, payment, tunnel routes
│   │   ├── admin.routes.ts
│   │   └── heartbeat.routes.ts
│   ├── services/
│   │   ├── caddy.service.ts
│   │   ├── cron.service.ts
│   │   ├── wa-bot.service.ts
│   │   └── whatsapp.service.ts
│   ├── utils/
│   │   ├── keys.ts          ← RSA key pair & env constants
│   │   └── logger.ts
│   └── server.ts            ← Entry point
├── public/                  ← Build output admin panel (jangan edit manual)
├── licenses.db              ← SQLite database (JANGAN di-commit)
├── private_key.pem          ← RSA private key (JANGAN di-commit)
├── public_key.pem           ← RSA public key (boleh didistribusikan ke client)
└── .env                     ← Environment variables (JANGAN di-commit)
```

---

## Monitoring & Maintenance

### Cek Status Server
```bash
# Di VPS:
pm2 status
pm2 logs licensing-server --lines 50

# Cek Caddy:
systemctl status caddy
curl http://localhost:2019/config/   # Caddy JSON API
```

### Database Backup
```bash
# SQLite backup manual:
cp /var/www/licensing-server/licenses.db ~/backup-$(date +%Y%m%d).db
```

### Reset WA Bot (jika koneksi putus)
1. Login admin dashboard → menu **WhatsApp Gateway**
2. Klik **Restart Koneksi**
3. Scan ulang QR code jika diminta

---

## Catatan Keamanan

- File `ls-key.pem`, `.env`, `licenses.db`, `private_key.pem`, `wa_auth/` **TIDAK** boleh di-commit ke Git
- `public_key.pem` aman untuk didistribusikan ke node sekolah untuk verifikasi token offline
- Admin dashboard dilindungi PIN + 2FA TOTP — jangan bagikan `TOTP_SECRET` ke orang lain
- IP VPS: `103.196.155.87` — akses SSH hanya via `ls-key.pem`
