# 🔐 Orkestrator Ujian - License Activation Server

Ini adalah backend server lisensi berbasis **Node.js, Express, dan SQLite** yang dirancang ringan, aman, dan siap digunakan di VPS. Server ini mengamankan aplikasi **Orkestrator Ujian** agar hanya sekolah/perangkat yang memiliki Kunci Lisensi sah yang dapat masuk dan menggunakan portal.

---

## ⚙️ Spesifikasi & Fitur Keamanan

1. **Lite & RAM Efficient**: Menggunakan database **SQLite** berbasis file (tanpa setup database berat), hanya mengonsumsi **~15 MB RAM** saat idle di VPS 1 GB Anda.
2. **Kriptografi JWT**: Kunci aktivasi yang divalidasi akan dikembalikan sebagai token JWT terenkripsi yang aman dari pemalsuan waktu sistem lokal klien.
3. **Locking Device Fingerprint**: Mencegah kecurangan pembagian lisensi (*key-sharing*). Satu kunci lisensi terikat dengan **Device ID** unik ponsel/komputer siswa/guru dan memiliki limit kapasitas yang dapat disetel admin (misal: 1 key maksimal untuk 50 HP).
4. **Admin Protection**: Endpoint pembuatan dan pengelolaan lisensi dilindungi oleh **Header PIN Admin** (`x-admin-secret`).

### 8. Penanganan Real-Time Penolakan/Penghapusan Pengajuan QRIS (QRIS Rejection Reactivity)
*   **Masalah**: Ketika administrator menolak (menghapus/menolak) pengajuan pending pembayaran QRIS di dashboard admin, aplikasi klien (HP siswa) tetap tertahan di layar pembayaran QRIS ("Menunggu Pembayaran") dengan status memutar terus (*diem gini terus*).
*   **Penyebab**: Hook polling pembayaran `fetch` di klien sebelumnya hanya mengevaluasi status sukses (`data.success && data.status === 'active'`). Ketika admin menghapus data, server merespon dengan status `404` (`success: false`). Karena respon kegagalan tersebut tidak ditangani (diabaikan), loop interval polling di klien tetap berjalan terus di layar QRIS tanpa batas waktu.
*   **Perbaikan**: Menambahkan blok cabang penanganan kesalahan (`else` block) pada hasil polling pembayaran. 
*   **Alur Baru**: Jika server mengembalikan `success: false` (berarti pengajuan lisensi dihapus/ditolak oleh admin di database), aplikasi klien seketika itu juga akan:
    1. Menghentikan proses interval polling pembayaran (`clearInterval`).
    2. Menghapus kunci lisensi tertunda dari memori penyimpanan lokal (`AsyncStorage.removeItem('@license_pending_key')`).
    3. Mereset state `pendingKey` ke string kosong.
    4. Menampilkan kotak dialog premium **"Aktivasi Ditolak"** yang menginformasikan bahwa permintaan QRIS mereka ditolak/dihapus oleh Admin, dan mengembalikannya ke layar utama pengajuan lisensi secara otomatis.

---

## 📂 Struktur Endpoint API

### 📂 Client App (Aplikasi Orkestrator)
* **`POST /api/license/activate`**
  * **Fungsi**: Mendaftarkan perangkat baru ke kunci lisensi.
  * **Payload**:
    ```json
    {
      "license_key": "ORK-DEMO-TEST-KEY-2026",
      "device_id": "FINGERPRINT_HP_SISWA_UNIQUE_123",
      "school_name": "SMK Ujicoba Indonesia"
    }
    ```
* **`POST /api/license/verify`**
  * **Fungsi**: Memverifikasi validitas token JWT secara online secara berkala.
  * **Payload**:
    ```json
    {
      "token": "JWT_TOKEN_DAR_ASYNC_STORAGE"
    }
    ```

### 🛠️ Administrator Console (Kelola Kunci Lisensi)
*Semua endpoint admin wajib menyertakan header keamanan:*
*Header:* `x-admin-secret: <ADMIN_SECRET_DI_ENV>`

* **`POST /api/license/generate`**
  * **Fungsi**: Membuat kunci lisensi baru untuk sekolah tertentu.
  * **Payload**:
    ```json
    {
      "school_name": "SMKN 1 Bandung",
      "device_limit": 100,
      "duration_days": 365
    }
    ```
* **`GET /api/license/list`**
  * **Fungsi**: Melihat daftar seluruh kunci lisensi yang aktif beserta daftar detail `device_id` yang menempel di masing-masing kunci.
* **`DELETE /api/license/delete/:id`**
  * **Fungsi**: Menghapus/menolak kunci lisensi secara permanen.

---

## 🚀 Panduan Deploy di VPS GIO

### 1. Masuk ke VPS Anda via SSH
```bash
ssh -i "C:\Users\SERVER-DELL\Downloads\nginxonly.pem" ubuntu@<IP_VPS_ANDA>
```

### 2. Install Node.js & PM2 (Process Manager)
Jalankan perintah ini di VPS Anda untuk memasang runtime Node dan pengelola proses background:
```bash
# Pasang Node.js LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Pasang PM2 secara global
sudo npm install -g pm2
```

### 3. Unggah dan Jalankan Server Lisensi
Gunakan **SCP** dari komputer lokal Anda untuk mengirim folder `license-server` ke VPS:
```powershell
# Jalankan ini di PowerShell PC lokal Anda
scp -i "C:\Users\SERVER-DELL\Downloads\nginxonly.pem" -r "c:\Users\SERVER-DELL\Documents\gform-orkestrator\license-server" ubuntu@<IP_VPS_ANDA>:/var/www/
```

Setelah terkirim, masuk ke direktori tersebut di VPS Anda dan nyalakan aplikasinya:
```bash
# Jalankan ini di SSH VPS
cd /var/www/license-server
npm install --omit=dev

# Jalankan server menggunakan PM2 agar tetap menyala di background
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
