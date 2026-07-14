# WORKING FLOW & DEPLOYMENT GUIDE

Panduan ini menjelaskan prosedur untuk melakukan pemeriksaan kesehatan (*health check*) dan pembaruan (*deployment/update*) pada server produksi **Central Licensing Server** (`api.absenta.id`).

---

## 1. Pemeriksaan Server Produksi (Server Inspection)

Pemeriksaan kesehatan server dilakukan secara remote menggunakan SSH dengan kredensial yang tersimpan di `CredentialVPS.txt`.

### A. Koneksi ke VPS
Gunakan kunci privat `ls-key.pem` untuk masuk ke server:
```bash
ssh -i ls-key.pem asepsuryadi@103.196.155.87
```

### B. Memeriksa Status Layanan (PM2)
Gunakan PM2 untuk memantau status aplikasi licensing-server:
```bash
# Menampilkan daftar proses aktif
pm2 status

# Menampilkan informasi detail penggunaan memori & CPU proses lisensi
pm2 show licensing-server
```

### C. Membaca Log Aktivitas
Untuk melihat log aktivitas real-time (heartbeat, webhook pembayaran, error):
```bash
# Melihat log langsung 100 baris terakhir secara real-time
pm2 logs licensing-server --lines 100

# Membaca log historis dari berkas penyimpanan
cat /var/www/licensing-server/logs/out.log
cat /var/www/licensing-server/logs/err.log
```

### D. Memeriksa Koneksi Aktif Database (PostgreSQL)
Untuk memastikan node server tersambung ke PostgreSQL produksi (IP `10.0.0.2` di internal VPN) dan tidak ada file deskriptor SQLite terbuka:
```bash
# Ganti <PID> dengan ID proses node yang didapat dari perintah 'pm2 status'
sudo lsof -p <PID> | grep -E 'postgresql|5432|licenses.db'
```
*Hasil normal harus menampilkan status `ESTABLISHED` ke `10.0.0.2:postgresql` dan tidak menampilkan file `.db`.*

### E. Memeriksa Isolasi Jaringan VPN (Firewall rules)
Pastikan aturan isolasi lalu lintas antar-klien Wireguard aktif terpasang:
```bash
sudo iptables -L FORWARD -v -n --line-numbers
```
*Aturan REJECT untuk src/dst range `10.0.0.10-10.0.0.254` harus berada di baris forward.*

---

## 2. Melakukan Pembaruan Server (Deployment / Update)

Pembaruan server lisensi dari kode lokal terbaru ke server produksi VPS dilakukan melalui dua metode:

### Metode A: Menggunakan Skrip Wizard Otomatis (Rekomendasi)
Telah disediakan berkas wizard interaktif `deploy.ps1` di root proyek. Cukup jalankan perintah ini di PowerShell lokal Windows Anda:
```powershell
.\deploy.ps1
```
**Alur Kerja Wizard `deploy.ps1`**:
1. Menguji koneksi SSH menggunakan berkas kunci PEM.
2. Melakukan login SSH otomatis ke VPS dan masuk ke direktori `/var/www/licensing-server`.
3. Menarik kode terbaru dari GitHub (`git fetch origin` & `git reset --hard origin/master`).
4. Memperbarui dependensi Node.js di server (`npm install --production`).
5. Membangun ulang (compile) TypeScript jika ada perubahan (`npm run build`).
6. Melakukan restart aman layanan di PM2 (`sudo pm2 startOrReload ecosystem.config.js`).
7. Memicu sinkronisasi ulang pemetaan Caddyfile (`sudo node scripts/sync-caddy.js`).

### Metode B: Melakukan Pembaruan Manual (Fallback)
Jika skrip otomatis mengalami kendala, masuk ke VPS menggunakan SSH secara manual dan jalankan instruksi berikut:
```bash
# 1. Pindah ke folder aplikasi
cd /var/www/licensing-server

# 2. Ambil kode terbaru dan timpa perubahan lokal kotor jika ada
sudo git fetch origin
sudo git reset --hard origin/master

# 3. Instal dependensi baru
sudo npm install --production

# 4. Generate Prisma Client (japa prisma schema berubah)
sudo npx prisma generate

# 5. Bangun ulang file TypeScript
sudo npm run build

# 6. Restart proses PM2
sudo pm2 reload licensing-server

# 7. Sinkronisasi Caddy
sudo node scripts/sync-caddy.js
```
