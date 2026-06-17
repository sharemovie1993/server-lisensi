# 🔐 Central Licensing Server (CLS)

Server lisensi pusat untuk ekosistem aplikasi Absenta ID (Project Yatim, Absenta Premium, Orkestrator Ujian, dll). Server ini mengelola aktivasi, verifikasi, dan routing domain kustom untuk seluruh tenant.

---

## 🚀 Jalur Pembaruan & Deployment (GitHub-Only)

Server ini menggunakan jalur pembaruan terpusat melalui GitHub. **Metode lama (SCP) sudah tidak digunakan.**

### 1. Cara Update Kode ke VPS
Pembaruan dilakukan menggunakan script PowerShell dari komputer lokal:
```powershell
./deploy.ps1
```
Script ini akan:
- Menghubungkan ke VPS via SSH menggunakan `nginxonly.pem`.
- Melakukan `git pull` terbaru dari branch `master`.
- Merestart proses PM2 (`licensing-server`).
- Menjalankan sinkronisasi Caddy untuk memperbarui konfigurasi domain/SSL.

### 2. Kredensial VPS
- **IP VPS**: `103.129.148.127`
- **User**: `asepsuryadi`
- **SSH Key**: `nginxonly.pem` (Wajib ada di root direktori)

---

## ⚙️ Arsitektur Sistem

1. **Lite & Standalone**: Menggunakan **SQLite** (`licenses.db`) sebagai database utama. Tidak lagi bergantung pada Supabase untuk routing.
2. **Multi-Project**: Satu server untuk banyak aplikasi menggunakan kolom `product_id`.
3. **Automated Reverse Proxy**: Integrasi otomatis dengan **Caddy** untuk penyediaan SSL On-Demand dan routing subdomain/domain kustom.
4. **WireGuard VPN**: Mendukung tunneling untuk aplikasi yang berjalan di jaringan lokal (On-Premise) agar bisa diakses online.

---

## 📂 Struktur Projek
- `server.js`: Entry point aplikasi Express.
- `routes/`: Logika API (license, admin, system).
- `scripts/`: Skrip pemeliharaan sistem (sync-caddy, dll).
- `utils/`: Helper fungsi (crypto, logger, caddy).
- `config/`: Konfigurasi database dan kunci keamanan.
- `licenses.db`: Database SQLite (Hanya ada di VPS, jangan di-commit).

---

- **Port**: `5001` (Backend API)
- **Admin Dashboard**: `https://api.absenta.id/admin.html`
pm2 start server.js --name "orkestra-license-server"

# Simpan konfigurasi PM2 agar otomatis menyala saat VPS restart/reboot
pm2 save
pm2 startup
```

---

## 🔑 Kunci Uji Coba Default (Demo Key)

Secara otomatis saat database pertama kali diinisialisasi, server telah membuat satu kunci uji coba untuk memudahkan integrasi pertama Anda:
* **License Key**: `ORK-DEMO-TEST-KEY-2026`
* **Nama Sekolah**: `SMK Ujicoba Indonesia`
* **Limit Kapasitas**: `50 Perangkat`
* **Masa Aktif**: `1 Tahun (Aktif)`
