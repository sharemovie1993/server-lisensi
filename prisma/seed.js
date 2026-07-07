const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const products = [
  {
    "id": "gform-orkestrator",
    "name": "GForm Orkestrator",
    "prefix": "GF"
  },
  {
    "id": "project-yatim",
    "name": "Project Yatim",
    "prefix": "YT"
  },
  {
    "id": "easy-tunnel",
    "name": "Easy Tunnel",
    "prefix": "ET"
  },
  {
    "id": "vpn-tunnel",
    "name": "VPN Tunneling Addon",
    "prefix": "VPN"
  },
  {
    "id": "platform-absenta",
    "name": "platform-absenta",
    "prefix": "PLA"
  },
  {
    "id": "absenta",
    "name": "Platform Cakola",
    "prefix": "ABS"
  }
];

const plans = [
  {
    "id": "FREE_LICENSE_SERVER_ACTIVATION",
    "productId": "absenta",
    "name": "Free Lisensi - Aktivasi Server",
    "priceMonthly": 0,
    "priceYearly": 0,
    "deviceLimit": 9999,
    "featuresJson": [
      "Akses Seluruh Modul (PAKET LENGKAP)",
      "Dukungan Integrasi Server Lokal",
      "Lisensi Server Mandiri (On-Premise)"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "CORE"
  },
  {
    "id": "INVENTORY_SEKOLAH_LARGE_BULANAN",
    "productId": "absenta",
    "name": "Inventory Sekolah (Large) - Bulanan",
    "priceMonthly": 200000,
    "priceYearly": 1920000,
    "deviceLimit": 1200,
    "featuresJson": [
      "Manajemen Inventaris Aset Sekolah",
      "Sistem Peminjaman Ruang & Lab",
      "Monitoring Perbaikan & Maintenance",
      "Audit Aset Berbasis Lokasi (QR Code)",
      "Laporan Penyusutan Nilai Aset"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "SARPRAS",
    "serviceCode": "SARPRAS"
  },
  {
    "id": "INVENTORY_SEKOLAH_LARGE_TAHUNAN",
    "productId": "absenta",
    "name": "Inventory Sekolah (Large) - Tahunan",
    "priceMonthly": 160000,
    "priceYearly": 1920000,
    "deviceLimit": 1200,
    "featuresJson": [
      "Manajemen Inventaris Aset Sekolah",
      "Sistem Peminjaman Ruang & Lab",
      "Monitoring Perbaikan & Maintenance",
      "Audit Aset Berbasis Lokasi (QR Code)",
      "Laporan Penyusutan Nilai Aset"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "SARPRAS",
    "serviceCode": "SARPRAS"
  },
  {
    "id": "INVENTORY_SEKOLAH_ENTERPRISE_BULANAN",
    "productId": "absenta",
    "name": "Inventory Sekolah (Enterprise) - Bulanan",
    "priceMonthly": 350000,
    "priceYearly": 3360000,
    "deviceLimit": 0,
    "featuresJson": [
      "Manajemen Inventaris Aset Sekolah",
      "Sistem Peminjaman Ruang & Lab",
      "Monitoring Perbaikan & Maintenance",
      "Audit Aset Berbasis Lokasi (QR Code)",
      "Laporan Penyusutan Nilai Aset"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "SARPRAS",
    "serviceCode": "SARPRAS"
  },
  {
    "id": "INVENTORY_SEKOLAH_ENTERPRISE_TAHUNAN",
    "productId": "absenta",
    "name": "Inventory Sekolah (Enterprise) - Tahunan",
    "priceMonthly": 280000,
    "priceYearly": 3360000,
    "deviceLimit": 0,
    "featuresJson": [
      "Manajemen Inventaris Aset Sekolah",
      "Sistem Peminjaman Ruang & Lab",
      "Monitoring Perbaikan & Maintenance",
      "Audit Aset Berbasis Lokasi (QR Code)",
      "Laporan Penyusutan Nilai Aset"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "SARPRAS",
    "serviceCode": "SARPRAS"
  },
  {
    "id": "HUBUNGAN_INDUSTRI_MICRO_BULANAN",
    "productId": "absenta",
    "name": "Hubungan Industri (Micro) - Bulanan",
    "priceMonthly": 20000,
    "priceYearly": 192000,
    "deviceLimit": 100,
    "featuresJson": [
      "Manajemen Mitra Industri (DU/DI)",
      "Penempatan & Monitoring PKL Siswa",
      "Jurnal PKL Digital (Input di Lokasi)",
      "Absensi PKL Berbasis Geofencing",
      "Laporan Evaluasi Pembimbing Industri"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "HUBIN",
    "serviceCode": "HUBIN"
  },
  {
    "id": "HUBUNGAN_INDUSTRI_MICRO_TAHUNAN",
    "productId": "absenta",
    "name": "Hubungan Industri (Micro) - Tahunan",
    "priceMonthly": 16000,
    "priceYearly": 192000,
    "deviceLimit": 100,
    "featuresJson": [
      "Manajemen Mitra Industri (DU/DI)",
      "Penempatan & Monitoring PKL Siswa",
      "Jurnal PKL Digital (Input di Lokasi)",
      "Absensi PKL Berbasis Geofencing",
      "Laporan Evaluasi Pembimbing Industri"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "HUBIN",
    "serviceCode": "HUBIN"
  },
  {
    "id": "HUBUNGAN_INDUSTRI_SMALL_BULANAN",
    "productId": "absenta",
    "name": "Hubungan Industri (Small) - Bulanan",
    "priceMonthly": 40000,
    "priceYearly": 384000,
    "deviceLimit": 300,
    "featuresJson": [
      "Manajemen Mitra Industri (DU/DI)",
      "Penempatan & Monitoring PKL Siswa",
      "Jurnal PKL Digital (Input di Lokasi)",
      "Absensi PKL Berbasis Geofencing",
      "Laporan Evaluasi Pembimbing Industri"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "HUBIN",
    "serviceCode": "HUBIN"
  },
  {
    "id": "HUBUNGAN_INDUSTRI_SMALL_TAHUNAN",
    "productId": "absenta",
    "name": "Hubungan Industri (Small) - Tahunan",
    "priceMonthly": 32000,
    "priceYearly": 384000,
    "deviceLimit": 300,
    "featuresJson": [
      "Manajemen Mitra Industri (DU/DI)",
      "Penempatan & Monitoring PKL Siswa",
      "Jurnal PKL Digital (Input di Lokasi)",
      "Absensi PKL Berbasis Geofencing",
      "Laporan Evaluasi Pembimbing Industri"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "HUBIN",
    "serviceCode": "HUBIN"
  },
  {
    "id": "HUBUNGAN_INDUSTRI_MEDIUM_BULANAN",
    "productId": "absenta",
    "name": "Hubungan Industri (Medium) - Bulanan",
    "priceMonthly": 75000,
    "priceYearly": 720000,
    "deviceLimit": 600,
    "featuresJson": [
      "Manajemen Mitra Industri (DU/DI)",
      "Penempatan & Monitoring PKL Siswa",
      "Jurnal PKL Digital (Input di Lokasi)",
      "Absensi PKL Berbasis Geofencing",
      "Laporan Evaluasi Pembimbing Industri"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "HUBIN",
    "serviceCode": "HUBIN"
  },
  {
    "id": "HUBUNGAN_INDUSTRI_MEDIUM_TAHUNAN",
    "productId": "absenta",
    "name": "Hubungan Industri (Medium) - Tahunan",
    "priceMonthly": 60000,
    "priceYearly": 720000,
    "deviceLimit": 600,
    "featuresJson": [
      "Manajemen Mitra Industri (DU/DI)",
      "Penempatan & Monitoring PKL Siswa",
      "Jurnal PKL Digital (Input di Lokasi)",
      "Absensi PKL Berbasis Geofencing",
      "Laporan Evaluasi Pembimbing Industri"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "HUBIN",
    "serviceCode": "HUBIN"
  },
  {
    "id": "HUBUNGAN_INDUSTRI_LARGE_BULANAN",
    "productId": "absenta",
    "name": "Hubungan Industri (Large) - Bulanan",
    "priceMonthly": 150000,
    "priceYearly": 1440000,
    "deviceLimit": 1200,
    "featuresJson": [
      "Manajemen Mitra Industri (DU/DI)",
      "Penempatan & Monitoring PKL Siswa",
      "Jurnal PKL Digital (Input di Lokasi)",
      "Absensi PKL Berbasis Geofencing",
      "Laporan Evaluasi Pembimbing Industri"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "HUBIN",
    "serviceCode": "HUBIN"
  },
  {
    "id": "HUBUNGAN_INDUSTRI_LARGE_TAHUNAN",
    "productId": "absenta",
    "name": "Hubungan Industri (Large) - Tahunan",
    "priceMonthly": 120000,
    "priceYearly": 1440000,
    "deviceLimit": 1200,
    "featuresJson": [
      "Manajemen Mitra Industri (DU/DI)",
      "Penempatan & Monitoring PKL Siswa",
      "Jurnal PKL Digital (Input di Lokasi)",
      "Absensi PKL Berbasis Geofencing",
      "Laporan Evaluasi Pembimbing Industri"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "HUBIN",
    "serviceCode": "HUBIN"
  },
  {
    "id": "HUBUNGAN_INDUSTRI_ENTERPRISE_BULANAN",
    "productId": "absenta",
    "name": "Hubungan Industri (Enterprise) - Bulanan",
    "priceMonthly": 250000,
    "priceYearly": 2400000,
    "deviceLimit": 0,
    "featuresJson": [
      "Manajemen Mitra Industri (DU/DI)",
      "Penempatan & Monitoring PKL Siswa",
      "Jurnal PKL Digital (Input di Lokasi)",
      "Absensi PKL Berbasis Geofencing",
      "Laporan Evaluasi Pembimbing Industri"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "HUBIN",
    "serviceCode": "HUBIN"
  },
  {
    "id": "HUBUNGAN_INDUSTRI_ENTERPRISE_TAHUNAN",
    "productId": "absenta",
    "name": "Hubungan Industri (Enterprise) - Tahunan",
    "priceMonthly": 200000,
    "priceYearly": 2400000,
    "deviceLimit": 0,
    "featuresJson": [
      "Manajemen Mitra Industri (DU/DI)",
      "Penempatan & Monitoring PKL Siswa",
      "Jurnal PKL Digital (Input di Lokasi)",
      "Absensi PKL Berbasis Geofencing",
      "Laporan Evaluasi Pembimbing Industri"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "HUBIN",
    "serviceCode": "HUBIN"
  },
  {
    "id": "WHATSAPP_SERVICE_MICRO_BULANAN",
    "productId": "absenta",
    "name": "WhatsApp Service (Micro) - Bulanan",
    "priceMonthly": 20000,
    "priceYearly": 192000,
    "deviceLimit": 100,
    "featuresJson": [
      "Notifikasi Kehadiran Otomatis (Real-time)",
      "Laporan Harian & Bulanan via WhatsApp",
      "Sistem Blast Pengumuman Seluruh Sekolah",
      "Integrasi Notifikasi Koperasi & Sarpras",
      "Dashboard Monitoring Status Pengiriman Pesan",
      "Support Custom API Gateway (Fonnte/WoWA/dll)"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "WHATSAPP",
    "serviceCode": "WHATSAPP"
  },
  {
    "id": "WHATSAPP_SERVICE_MICRO_TAHUNAN",
    "productId": "absenta",
    "name": "WhatsApp Service (Micro) - Tahunan",
    "priceMonthly": 16000,
    "priceYearly": 192000,
    "deviceLimit": 100,
    "featuresJson": [
      "Notifikasi Kehadiran Otomatis (Real-time)",
      "Laporan Harian & Bulanan via WhatsApp",
      "Sistem Blast Pengumuman Seluruh Sekolah",
      "Integrasi Notifikasi Koperasi & Sarpras",
      "Dashboard Monitoring Status Pengiriman Pesan",
      "Support Custom API Gateway (Fonnte/WoWA/dll)"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "WHATSAPP",
    "serviceCode": "WHATSAPP"
  },
  {
    "id": "WHATSAPP_SERVICE_SMALL_BULANAN",
    "productId": "absenta",
    "name": "WhatsApp Service (Small) - Bulanan",
    "priceMonthly": 40000,
    "priceYearly": 384000,
    "deviceLimit": 300,
    "featuresJson": [
      "Notifikasi Kehadiran Otomatis (Real-time)",
      "Laporan Harian & Bulanan via WhatsApp",
      "Sistem Blast Pengumuman Seluruh Sekolah",
      "Integrasi Notifikasi Koperasi & Sarpras",
      "Dashboard Monitoring Status Pengiriman Pesan",
      "Support Custom API Gateway (Fonnte/WoWA/dll)"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "WHATSAPP",
    "serviceCode": "WHATSAPP"
  },
  {
    "id": "WHATSAPP_SERVICE_SMALL_TAHUNAN",
    "productId": "absenta",
    "name": "WhatsApp Service (Small) - Tahunan",
    "priceMonthly": 32000,
    "priceYearly": 384000,
    "deviceLimit": 300,
    "featuresJson": [
      "Notifikasi Kehadiran Otomatis (Real-time)",
      "Laporan Harian & Bulanan via WhatsApp",
      "Sistem Blast Pengumuman Seluruh Sekolah",
      "Integrasi Notifikasi Koperasi & Sarpras",
      "Dashboard Monitoring Status Pengiriman Pesan",
      "Support Custom API Gateway (Fonnte/WoWA/dll)"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "WHATSAPP",
    "serviceCode": "WHATSAPP"
  },
  {
    "id": "WHATSAPP_SERVICE_MEDIUM_BULANAN",
    "productId": "absenta",
    "name": "WhatsApp Service (Medium) - Bulanan",
    "priceMonthly": 75000,
    "priceYearly": 720000,
    "deviceLimit": 600,
    "featuresJson": [
      "Notifikasi Kehadiran Otomatis (Real-time)",
      "Laporan Harian & Bulanan via WhatsApp",
      "Sistem Blast Pengumuman Seluruh Sekolah",
      "Integrasi Notifikasi Koperasi & Sarpras",
      "Dashboard Monitoring Status Pengiriman Pesan",
      "Support Custom API Gateway (Fonnte/WoWA/dll)"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "WHATSAPP",
    "serviceCode": "WHATSAPP"
  },
  {
    "id": "ACADEMIC_SMALL_TAHUNAN",
    "productId": "absenta",
    "name": "Academic Core (Small) - Tahunan",
    "priceMonthly": 0,
    "priceYearly": 0,
    "deviceLimit": 300,
    "featuresJson": [],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "CORE",
    "serviceCode": "CORE"
  },
  {
    "id": "ACADEMIC_MEDIUM_TAHUNAN",
    "productId": "absenta",
    "name": "Academic Core (Medium) - Tahunan",
    "priceMonthly": 0,
    "priceYearly": 0,
    "deviceLimit": 600,
    "featuresJson": [],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "CORE",
    "serviceCode": "CORE"
  },
  {
    "id": "ACADEMIC_LARGE_TAHUNAN",
    "productId": "absenta",
    "name": "Academic Core (Large) - Tahunan",
    "priceMonthly": 0,
    "priceYearly": 0,
    "deviceLimit": 1200,
    "featuresJson": [],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "CORE",
    "serviceCode": "CORE"
  },
  {
    "id": "ACADEMIC_ENTERPRISE_TAHUNAN",
    "productId": "absenta",
    "name": "Academic Core (Enterprise) - Tahunan",
    "priceMonthly": 0,
    "priceYearly": 0,
    "deviceLimit": 0,
    "featuresJson": [],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "CORE",
    "serviceCode": "CORE"
  },
  {
    "id": "KOPERASI_SEKOLAH_MICRO_BULANAN",
    "productId": "absenta",
    "name": "Koperasi Sekolah (Micro) - Bulanan",
    "priceMonthly": 150000,
    "priceYearly": 1440000,
    "deviceLimit": 100,
    "featuresJson": [
      "Manajemen Anggota & Tabungan Siswa",
      "Sistem Pinjaman & Angsuran Otomatis",
      "Kasir / POS (Point of Sale) Koperasi",
      "Laporan Keuangan & SHU (Sisa Hasil Usaha)",
      "Manajemen Stok & Inventaris Toko",
      "PPOB (Pulsa, Listrik, Paket Data)"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "KOPERASI",
    "serviceCode": "KOPERASI"
  },
  {
    "id": "KOPERASI_SEKOLAH_MICRO_TAHUNAN",
    "productId": "absenta",
    "name": "Koperasi Sekolah (Micro) - Tahunan",
    "priceMonthly": 120000,
    "priceYearly": 1440000,
    "deviceLimit": 100,
    "featuresJson": [
      "Manajemen Anggota & Tabungan Siswa",
      "Sistem Pinjaman & Angsuran Otomatis",
      "Kasir / POS (Point of Sale) Koperasi",
      "Laporan Keuangan & SHU (Sisa Hasil Usaha)",
      "Manajemen Stok & Inventaris Toko",
      "PPOB (Pulsa, Listrik, Paket Data)"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "KOPERASI",
    "serviceCode": "KOPERASI"
  },
  {
    "id": "KOPERASI_SEKOLAH_SMALL_BULANAN",
    "productId": "absenta",
    "name": "Koperasi Sekolah (Small) - Bulanan",
    "priceMonthly": 300000,
    "priceYearly": 2880000,
    "deviceLimit": 300,
    "featuresJson": [
      "Manajemen Anggota & Tabungan Siswa",
      "Sistem Pinjaman & Angsuran Otomatis",
      "Kasir / POS (Point of Sale) Koperasi",
      "Laporan Keuangan & SHU (Sisa Hasil Usaha)",
      "Manajemen Stok & Inventaris Toko",
      "PPOB (Pulsa, Listrik, Paket Data)"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "KOPERASI",
    "serviceCode": "KOPERASI"
  },
  {
    "id": "KOPERASI_SEKOLAH_SMALL_TAHUNAN",
    "productId": "absenta",
    "name": "Koperasi Sekolah (Small) - Tahunan",
    "priceMonthly": 240000,
    "priceYearly": 2880000,
    "deviceLimit": 300,
    "featuresJson": [
      "Manajemen Anggota & Tabungan Siswa",
      "Sistem Pinjaman & Angsuran Otomatis",
      "Kasir / POS (Point of Sale) Koperasi",
      "Laporan Keuangan & SHU (Sisa Hasil Usaha)",
      "Manajemen Stok & Inventaris Toko",
      "PPOB (Pulsa, Listrik, Paket Data)"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "KOPERASI",
    "serviceCode": "KOPERASI"
  },
  {
    "id": "KOPERASI_SEKOLAH_MEDIUM_BULANAN",
    "productId": "absenta",
    "name": "Koperasi Sekolah (Medium) - Bulanan",
    "priceMonthly": 500000,
    "priceYearly": 4800000,
    "deviceLimit": 600,
    "featuresJson": [
      "Manajemen Anggota & Tabungan Siswa",
      "Sistem Pinjaman & Angsuran Otomatis",
      "Kasir / POS (Point of Sale) Koperasi",
      "Laporan Keuangan & SHU (Sisa Hasil Usaha)",
      "Manajemen Stok & Inventaris Toko",
      "PPOB (Pulsa, Listrik, Paket Data)"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "KOPERASI",
    "serviceCode": "KOPERASI"
  },
  {
    "id": "KOPERASI_SEKOLAH_MEDIUM_TAHUNAN",
    "productId": "absenta",
    "name": "Koperasi Sekolah (Medium) - Tahunan",
    "priceMonthly": 400000,
    "priceYearly": 4800000,
    "deviceLimit": 600,
    "featuresJson": [
      "Manajemen Anggota & Tabungan Siswa",
      "Sistem Pinjaman & Angsuran Otomatis",
      "Kasir / POS (Point of Sale) Koperasi",
      "Laporan Keuangan & SHU (Sisa Hasil Usaha)",
      "Manajemen Stok & Inventaris Toko",
      "PPOB (Pulsa, Listrik, Paket Data)"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "KOPERASI",
    "serviceCode": "KOPERASI"
  },
  {
    "id": "KOPERASI_SEKOLAH_LARGE_BULANAN",
    "productId": "absenta",
    "name": "Koperasi Sekolah (Large) - Bulanan",
    "priceMonthly": 850000,
    "priceYearly": 8160000,
    "deviceLimit": 1200,
    "featuresJson": [
      "Manajemen Anggota & Tabungan Siswa",
      "Sistem Pinjaman & Angsuran Otomatis",
      "Kasir / POS (Point of Sale) Koperasi",
      "Laporan Keuangan & SHU (Sisa Hasil Usaha)",
      "Manajemen Stok & Inventaris Toko",
      "PPOB (Pulsa, Listrik, Paket Data)"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "KOPERASI",
    "serviceCode": "KOPERASI"
  },
  {
    "id": "KOPERASI_SEKOLAH_LARGE_TAHUNAN",
    "productId": "absenta",
    "name": "Koperasi Sekolah (Large) - Tahunan",
    "priceMonthly": 680000,
    "priceYearly": 8160000,
    "deviceLimit": 1200,
    "featuresJson": [
      "Manajemen Anggota & Tabungan Siswa",
      "Sistem Pinjaman & Angsuran Otomatis",
      "Kasir / POS (Point of Sale) Koperasi",
      "Laporan Keuangan & SHU (Sisa Hasil Usaha)",
      "Manajemen Stok & Inventaris Toko",
      "PPOB (Pulsa, Listrik, Paket Data)"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "KOPERASI",
    "serviceCode": "KOPERASI"
  },
  {
    "id": "KOPERASI_SEKOLAH_ENTERPRISE_BULANAN",
    "productId": "absenta",
    "name": "Koperasi Sekolah (Enterprise) - Bulanan",
    "priceMonthly": 1750000,
    "priceYearly": 16800000,
    "deviceLimit": 0,
    "featuresJson": [
      "Manajemen Anggota & Tabungan Siswa",
      "Sistem Pinjaman & Angsuran Otomatis",
      "Kasir / POS (Point of Sale) Koperasi",
      "Laporan Keuangan & SHU (Sisa Hasil Usaha)",
      "Manajemen Stok & Inventaris Toko",
      "PPOB (Pulsa, Listrik, Paket Data)"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "KOPERASI",
    "serviceCode": "KOPERASI"
  },
  {
    "id": "KOPERASI_SEKOLAH_ENTERPRISE_TAHUNAN",
    "productId": "absenta",
    "name": "Koperasi Sekolah (Enterprise) - Tahunan",
    "priceMonthly": 1400000,
    "priceYearly": 16800000,
    "deviceLimit": 0,
    "featuresJson": [
      "Manajemen Anggota & Tabungan Siswa",
      "Sistem Pinjaman & Angsuran Otomatis",
      "Kasir / POS (Point of Sale) Koperasi",
      "Laporan Keuangan & SHU (Sisa Hasil Usaha)",
      "Manajemen Stok & Inventaris Toko",
      "PPOB (Pulsa, Listrik, Paket Data)"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "KOPERASI",
    "serviceCode": "KOPERASI"
  },
  {
    "id": "INVENTORY_SEKOLAH_MICRO_BULANAN",
    "productId": "absenta",
    "name": "Inventory Sekolah (Micro) - Bulanan",
    "priceMonthly": 25000,
    "priceYearly": 240000,
    "deviceLimit": 100,
    "featuresJson": [
      "Manajemen Inventaris Aset Sekolah",
      "Sistem Peminjaman Ruang & Lab",
      "Monitoring Perbaikan & Maintenance",
      "Audit Aset Berbasis Lokasi (QR Code)",
      "Laporan Penyusutan Nilai Aset"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "SARPRAS",
    "serviceCode": "SARPRAS"
  },
  {
    "id": "INVENTORY_SEKOLAH_MICRO_TAHUNAN",
    "productId": "absenta",
    "name": "Inventory Sekolah (Micro) - Tahunan",
    "priceMonthly": 20000,
    "priceYearly": 240000,
    "deviceLimit": 100,
    "featuresJson": [
      "Manajemen Inventaris Aset Sekolah",
      "Sistem Peminjaman Ruang & Lab",
      "Monitoring Perbaikan & Maintenance",
      "Audit Aset Berbasis Lokasi (QR Code)",
      "Laporan Penyusutan Nilai Aset"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "SARPRAS",
    "serviceCode": "SARPRAS"
  },
  {
    "id": "INVENTORY_SEKOLAH_SMALL_BULANAN",
    "productId": "absenta",
    "name": "Inventory Sekolah (Small) - Bulanan",
    "priceMonthly": 50000,
    "priceYearly": 480000,
    "deviceLimit": 300,
    "featuresJson": [
      "Manajemen Inventaris Aset Sekolah",
      "Sistem Peminjaman Ruang & Lab",
      "Monitoring Perbaikan & Maintenance",
      "Audit Aset Berbasis Lokasi (QR Code)",
      "Laporan Penyusutan Nilai Aset"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "SARPRAS",
    "serviceCode": "SARPRAS"
  },
  {
    "id": "INVENTORY_SEKOLAH_SMALL_TAHUNAN",
    "productId": "absenta",
    "name": "Inventory Sekolah (Small) - Tahunan",
    "priceMonthly": 40000,
    "priceYearly": 480000,
    "deviceLimit": 300,
    "featuresJson": [
      "Manajemen Inventaris Aset Sekolah",
      "Sistem Peminjaman Ruang & Lab",
      "Monitoring Perbaikan & Maintenance",
      "Audit Aset Berbasis Lokasi (QR Code)",
      "Laporan Penyusutan Nilai Aset"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "SARPRAS",
    "serviceCode": "SARPRAS"
  },
  {
    "id": "INVENTORY_SEKOLAH_MEDIUM_BULANAN",
    "productId": "absenta",
    "name": "Inventory Sekolah (Medium) - Bulanan",
    "priceMonthly": 100000,
    "priceYearly": 960000,
    "deviceLimit": 600,
    "featuresJson": [
      "Manajemen Inventaris Aset Sekolah",
      "Sistem Peminjaman Ruang & Lab",
      "Monitoring Perbaikan & Maintenance",
      "Audit Aset Berbasis Lokasi (QR Code)",
      "Laporan Penyusutan Nilai Aset"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "SARPRAS",
    "serviceCode": "SARPRAS"
  },
  {
    "id": "INVENTORY_SEKOLAH_MEDIUM_TAHUNAN",
    "productId": "absenta",
    "name": "Inventory Sekolah (Medium) - Tahunan",
    "priceMonthly": 80000,
    "priceYearly": 960000,
    "deviceLimit": 600,
    "featuresJson": [
      "Manajemen Inventaris Aset Sekolah",
      "Sistem Peminjaman Ruang & Lab",
      "Monitoring Perbaikan & Maintenance",
      "Audit Aset Berbasis Lokasi (QR Code)",
      "Laporan Penyusutan Nilai Aset"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "SARPRAS",
    "serviceCode": "SARPRAS"
  },
  {
    "id": "WHATSAPP_SERVICE_LARGE_BULANAN",
    "productId": "absenta",
    "name": "WhatsApp Service (Large) - Bulanan",
    "priceMonthly": 150000,
    "priceYearly": 1440000,
    "deviceLimit": 1200,
    "featuresJson": [
      "Notifikasi Kehadiran Otomatis (Real-time)",
      "Laporan Harian & Bulanan via WhatsApp",
      "Sistem Blast Pengumuman Seluruh Sekolah",
      "Integrasi Notifikasi Koperasi & Sarpras",
      "Dashboard Monitoring Status Pengiriman Pesan",
      "Support Custom API Gateway (Fonnte/WoWA/dll)"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "WHATSAPP",
    "serviceCode": "WHATSAPP"
  },
  {
    "id": "ABSENSI_MULTI_SESI_ENTERPRISE_TAHUNAN",
    "productId": "absenta",
    "name": "Absensi Multi Sesi (Enterprise) - Tahunan",
    "priceMonthly": 2000000,
    "priceYearly": 24000000,
    "deviceLimit": 0,
    "featuresJson": [
      "Absensi Per Mata Pelajaran (KBM)",
      "Jurnal Mengajar Guru Digital",
      "Monitoring KBM Real-time (Siswa Bolos)",
      "Notifikasi WhatsApp Per Jam Pelajaran",
      "Rekap Kehadiran Per Mapel & Guru",
      "Integrasi Jadwal Kurikulum Otomatis"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "ABSENSI_SIMPLE_SMALL_BULANAN",
    "productId": "absenta",
    "name": "Absensi Simple (Small) - Bulanan",
    "priceMonthly": 250000,
    "priceYearly": 2400000,
    "deviceLimit": 300,
    "featuresJson": [
      "Absensi Harian Face Recognition & GPS",
      "Logbook Kegiatan Harian Pegawai",
      "Pengajuan Izin & Sakit Digital",
      "Notifikasi Kehadiran via WhatsApp",
      "Rekap Laporan Bulanan Excel/PDF"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "ABSENSI_SIMPLE_SMALL_TAHUNAN",
    "productId": "absenta",
    "name": "Absensi Simple (Small) - Tahunan",
    "priceMonthly": 200000,
    "priceYearly": 2400000,
    "deviceLimit": 300,
    "featuresJson": [
      "Absensi Harian Face Recognition & GPS",
      "Logbook Kegiatan Harian Pegawai",
      "Pengajuan Izin & Sakit Digital",
      "Notifikasi Kehadiran via WhatsApp",
      "Rekap Laporan Bulanan Excel/PDF"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "ABSENSI_SIMPLE_MEDIUM_BULANAN",
    "productId": "absenta",
    "name": "Absensi Simple (Medium) - Bulanan",
    "priceMonthly": 450000,
    "priceYearly": 4320000,
    "deviceLimit": 600,
    "featuresJson": [
      "Absensi Harian Face Recognition & GPS",
      "Logbook Kegiatan Harian Pegawai",
      "Pengajuan Izin & Sakit Digital",
      "Notifikasi Kehadiran via WhatsApp",
      "Rekap Laporan Bulanan Excel/PDF"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "ABSENSI_SIMPLE_MEDIUM_TAHUNAN",
    "productId": "absenta",
    "name": "Absensi Simple (Medium) - Tahunan",
    "priceMonthly": 360000,
    "priceYearly": 4320000,
    "deviceLimit": 600,
    "featuresJson": [
      "Absensi Harian Face Recognition & GPS",
      "Logbook Kegiatan Harian Pegawai",
      "Pengajuan Izin & Sakit Digital",
      "Notifikasi Kehadiran via WhatsApp",
      "Rekap Laporan Bulanan Excel/PDF"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "ABSENSI_SIMPLE_LARGE_BULANAN",
    "productId": "absenta",
    "name": "Absensi Simple (Large) - Bulanan",
    "priceMonthly": 750000,
    "priceYearly": 7200000,
    "deviceLimit": 1200,
    "featuresJson": [
      "Absensi Harian Face Recognition & GPS",
      "Logbook Kegiatan Harian Pegawai",
      "Pengajuan Izin & Sakit Digital",
      "Notifikasi Kehadiran via WhatsApp",
      "Rekap Laporan Bulanan Excel/PDF"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "ABSENSI_SIMPLE_LARGE_TAHUNAN",
    "productId": "absenta",
    "name": "Absensi Simple (Large) - Tahunan",
    "priceMonthly": 600000,
    "priceYearly": 7200000,
    "deviceLimit": 1200,
    "featuresJson": [
      "Absensi Harian Face Recognition & GPS",
      "Logbook Kegiatan Harian Pegawai",
      "Pengajuan Izin & Sakit Digital",
      "Notifikasi Kehadiran via WhatsApp",
      "Rekap Laporan Bulanan Excel/PDF"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "ABSENSI_SIMPLE_ENTERPRISE_BULANAN",
    "productId": "absenta",
    "name": "Absensi Simple (Enterprise) - Bulanan",
    "priceMonthly": 1500000,
    "priceYearly": 14400000,
    "deviceLimit": 0,
    "featuresJson": [
      "Absensi Harian Face Recognition & GPS",
      "Logbook Kegiatan Harian Pegawai",
      "Pengajuan Izin & Sakit Digital",
      "Notifikasi Kehadiran via WhatsApp",
      "Rekap Laporan Bulanan Excel/PDF"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "ABSENSI_SIMPLE_ENTERPRISE_TAHUNAN",
    "productId": "absenta",
    "name": "Absensi Simple (Enterprise) - Tahunan",
    "priceMonthly": 1200000,
    "priceYearly": 14400000,
    "deviceLimit": 0,
    "featuresJson": [
      "Absensi Harian Face Recognition & GPS",
      "Logbook Kegiatan Harian Pegawai",
      "Pengajuan Izin & Sakit Digital",
      "Notifikasi Kehadiran via WhatsApp",
      "Rekap Laporan Bulanan Excel/PDF"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "ABSENSI_MULTI_SESI_MICRO_BULANAN",
    "productId": "absenta",
    "name": "Absensi Multi Sesi (Micro) - Bulanan",
    "priceMonthly": 200000,
    "priceYearly": 1920000,
    "deviceLimit": 100,
    "featuresJson": [
      "Absensi Per Mata Pelajaran (KBM)",
      "Jurnal Mengajar Guru Digital",
      "Monitoring KBM Real-time (Siswa Bolos)",
      "Notifikasi WhatsApp Per Jam Pelajaran",
      "Rekap Kehadiran Per Mapel & Guru",
      "Integrasi Jadwal Kurikulum Otomatis"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "ABSENSI_MULTI_SESI_MICRO_TAHUNAN",
    "productId": "absenta",
    "name": "Absensi Multi Sesi (Micro) - Tahunan",
    "priceMonthly": 160000,
    "priceYearly": 1920000,
    "deviceLimit": 100,
    "featuresJson": [
      "Absensi Per Mata Pelajaran (KBM)",
      "Jurnal Mengajar Guru Digital",
      "Monitoring KBM Real-time (Siswa Bolos)",
      "Notifikasi WhatsApp Per Jam Pelajaran",
      "Rekap Kehadiran Per Mapel & Guru",
      "Integrasi Jadwal Kurikulum Otomatis"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "ABSENSI_MULTI_SESI_SMALL_BULANAN",
    "productId": "absenta",
    "name": "Absensi Multi Sesi (Small) - Bulanan",
    "priceMonthly": 450000,
    "priceYearly": 4320000,
    "deviceLimit": 300,
    "featuresJson": [
      "Absensi Per Mata Pelajaran (KBM)",
      "Jurnal Mengajar Guru Digital",
      "Monitoring KBM Real-time (Siswa Bolos)",
      "Notifikasi WhatsApp Per Jam Pelajaran",
      "Rekap Kehadiran Per Mapel & Guru",
      "Integrasi Jadwal Kurikulum Otomatis"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "ABSENSI_MULTI_SESI_SMALL_TAHUNAN",
    "productId": "absenta",
    "name": "Absensi Multi Sesi (Small) - Tahunan",
    "priceMonthly": 360000,
    "priceYearly": 4320000,
    "deviceLimit": 300,
    "featuresJson": [
      "Absensi Per Mata Pelajaran (KBM)",
      "Jurnal Mengajar Guru Digital",
      "Monitoring KBM Real-time (Siswa Bolos)",
      "Notifikasi WhatsApp Per Jam Pelajaran",
      "Rekap Kehadiran Per Mapel & Guru",
      "Integrasi Jadwal Kurikulum Otomatis"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "ABSENSI_MULTI_SESI_MEDIUM_BULANAN",
    "productId": "absenta",
    "name": "Absensi Multi Sesi (Medium) - Bulanan",
    "priceMonthly": 750000,
    "priceYearly": 7200000,
    "deviceLimit": 600,
    "featuresJson": [
      "Absensi Per Mata Pelajaran (KBM)",
      "Jurnal Mengajar Guru Digital",
      "Monitoring KBM Real-time (Siswa Bolos)",
      "Notifikasi WhatsApp Per Jam Pelajaran",
      "Rekap Kehadiran Per Mapel & Guru",
      "Integrasi Jadwal Kurikulum Otomatis"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "ABSENSI_MULTI_SESI_MEDIUM_TAHUNAN",
    "productId": "absenta",
    "name": "Absensi Multi Sesi (Medium) - Tahunan",
    "priceMonthly": 600000,
    "priceYearly": 7200000,
    "deviceLimit": 600,
    "featuresJson": [
      "Absensi Per Mata Pelajaran (KBM)",
      "Jurnal Mengajar Guru Digital",
      "Monitoring KBM Real-time (Siswa Bolos)",
      "Notifikasi WhatsApp Per Jam Pelajaran",
      "Rekap Kehadiran Per Mapel & Guru",
      "Integrasi Jadwal Kurikulum Otomatis"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "ABSENSI_MULTI_SESI_LARGE_BULANAN",
    "productId": "absenta",
    "name": "Absensi Multi Sesi (Large) - Bulanan",
    "priceMonthly": 1250000,
    "priceYearly": 12000000,
    "deviceLimit": 1200,
    "featuresJson": [
      "Absensi Per Mata Pelajaran (KBM)",
      "Jurnal Mengajar Guru Digital",
      "Monitoring KBM Real-time (Siswa Bolos)",
      "Notifikasi WhatsApp Per Jam Pelajaran",
      "Rekap Kehadiran Per Mapel & Guru",
      "Integrasi Jadwal Kurikulum Otomatis"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "easy_tunnel_monthly",
    "productId": "easy-tunnel",
    "name": "Easy Tunnel Bulanan",
    "priceMonthly": 50000,
    "priceYearly": 600000,
    "deviceLimit": 1,
    "featuresJson": [],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": null,
    "serviceCode": null
  },
  {
    "id": "ABSENSI_SIMPLE_MICRO_TAHUNAN",
    "productId": "absenta",
    "name": "Absensi Simple (Micro) - Tahunan",
    "priceMonthly": 80000,
    "priceYearly": 960000,
    "deviceLimit": 100,
    "featuresJson": [
      "Absensi Harian Face Recognition & GPS",
      "Logbook Kegiatan Harian Pegawai",
      "Pengajuan Izin & Sakit Digital",
      "Notifikasi Kehadiran via WhatsApp",
      "Rekap Laporan Bulanan Excel/PDF"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "easy_tunnel_semester",
    "productId": "easy-tunnel",
    "name": "Easy Tunnel Semester",
    "priceMonthly": 41666,
    "priceYearly": 250000,
    "deviceLimit": 1,
    "featuresJson": [],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": null,
    "serviceCode": null
  },
  {
    "id": "easy_tunnel_annual",
    "productId": "easy-tunnel",
    "name": "Easy Tunnel Tahunan",
    "priceMonthly": 40000,
    "priceYearly": 480000,
    "deviceLimit": 1,
    "featuresJson": [],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": null,
    "serviceCode": null
  },
  {
    "id": "monthly",
    "productId": "gform-orkestrator",
    "name": "Bulanan",
    "priceMonthly": 299000,
    "priceYearly": 3588000,
    "deviceLimit": 0,
    "featuresJson": [],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": null,
    "serviceCode": null
  },
  {
    "id": "semester",
    "productId": "gform-orkestrator",
    "name": "Semesteran",
    "priceMonthly": 116500,
    "priceYearly": 699000,
    "deviceLimit": 0,
    "featuresJson": [],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": null,
    "serviceCode": null
  },
  {
    "id": "annual",
    "productId": "gform-orkestrator",
    "name": "Tahunan",
    "priceMonthly": 100000,
    "priceYearly": 1199000,
    "deviceLimit": 0,
    "featuresJson": [],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": null,
    "serviceCode": null
  },
  {
    "id": "yatim_basic_lifetime",
    "productId": "project-yatim",
    "name": "Mustahiq Care Basic (Lifetime)",
    "priceMonthly": 0,
    "priceYearly": 0,
    "deviceLimit": 100,
    "featuresJson": [],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": null,
    "serviceCode": null
  },
  {
    "id": "yatim_pro_lifetime",
    "productId": "project-yatim",
    "name": "Mustahiq Care Pro (Lifetime)",
    "priceMonthly": 0,
    "priceYearly": 0,
    "deviceLimit": 500,
    "featuresJson": [],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": null,
    "serviceCode": null
  },
  {
    "id": "yatim_enterprise_lifetime",
    "productId": "project-yatim",
    "name": "Mustahiq Care Enterprise (Lifetime)",
    "priceMonthly": 0,
    "priceYearly": 0,
    "deviceLimit": 0,
    "featuresJson": [],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": null,
    "serviceCode": null
  },
  {
    "id": "vpn_monthly",
    "productId": "vpn-tunnel",
    "name": "VPN Tunneling Bulanan",
    "priceMonthly": 0,
    "priceYearly": 0,
    "deviceLimit": 1,
    "featuresJson": [],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": null,
    "serviceCode": null
  },
  {
    "id": "vpn_semester",
    "productId": "vpn-tunnel",
    "name": "VPN Tunneling Semester",
    "priceMonthly": 0,
    "priceYearly": 0,
    "deviceLimit": 1,
    "featuresJson": [],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": null,
    "serviceCode": null
  },
  {
    "id": "vpn_annual",
    "productId": "vpn-tunnel",
    "name": "VPN Tunneling Tahunan",
    "priceMonthly": 0,
    "priceYearly": 0,
    "deviceLimit": 1,
    "featuresJson": [],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": null,
    "serviceCode": null
  },
  {
    "id": "ABSENSI_MULTI_SESI_ENTERPRISE_BULANAN",
    "productId": "absenta",
    "name": "Absensi Multi Sesi (Enterprise) - Bulanan",
    "priceMonthly": 2500000,
    "priceYearly": 24000000,
    "deviceLimit": 0,
    "featuresJson": [
      "Absensi Per Mata Pelajaran (KBM)",
      "Jurnal Mengajar Guru Digital",
      "Monitoring KBM Real-time (Siswa Bolos)",
      "Notifikasi WhatsApp Per Jam Pelajaran",
      "Rekap Kehadiran Per Mapel & Guru",
      "Integrasi Jadwal Kurikulum Otomatis"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "WHATSAPP_SERVICE_LARGE_TAHUNAN",
    "productId": "absenta",
    "name": "WhatsApp Service (Large) - Tahunan",
    "priceMonthly": 120000,
    "priceYearly": 1440000,
    "deviceLimit": 1200,
    "featuresJson": [
      "Notifikasi Kehadiran Otomatis (Real-time)",
      "Laporan Harian & Bulanan via WhatsApp",
      "Sistem Blast Pengumuman Seluruh Sekolah",
      "Integrasi Notifikasi Koperasi & Sarpras",
      "Dashboard Monitoring Status Pengiriman Pesan",
      "Support Custom API Gateway (Fonnte/WoWA/dll)"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "WHATSAPP",
    "serviceCode": "WHATSAPP"
  },
  {
    "id": "ABSENSI_MULTI_SESI_LARGE_TAHUNAN",
    "productId": "absenta",
    "name": "Absensi Multi Sesi (Large) - Tahunan",
    "priceMonthly": 1000000,
    "priceYearly": 12000000,
    "deviceLimit": 1200,
    "featuresJson": [
      "Absensi Per Mata Pelajaran (KBM)",
      "Jurnal Mengajar Guru Digital",
      "Monitoring KBM Real-time (Siswa Bolos)",
      "Notifikasi WhatsApp Per Jam Pelajaran",
      "Rekap Kehadiran Per Mapel & Guru",
      "Integrasi Jadwal Kurikulum Otomatis"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "WHATSAPP_SERVICE_ENTERPRISE_BULANAN",
    "productId": "absenta",
    "name": "WhatsApp Service (Enterprise) - Bulanan",
    "priceMonthly": 250000,
    "priceYearly": 2400000,
    "deviceLimit": 0,
    "featuresJson": [
      "Notifikasi Kehadiran Otomatis (Real-time)",
      "Laporan Harian & Bulanan via WhatsApp",
      "Sistem Blast Pengumuman Seluruh Sekolah",
      "Integrasi Notifikasi Koperasi & Sarpras",
      "Dashboard Monitoring Status Pengiriman Pesan",
      "Support Custom API Gateway (Fonnte/WoWA/dll)"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "WHATSAPP",
    "serviceCode": "WHATSAPP"
  },
  {
    "id": "WHATSAPP_SERVICE_ENTERPRISE_TAHUNAN",
    "productId": "absenta",
    "name": "WhatsApp Service (Enterprise) - Tahunan",
    "priceMonthly": 200000,
    "priceYearly": 2400000,
    "deviceLimit": 0,
    "featuresJson": [
      "Notifikasi Kehadiran Otomatis (Real-time)",
      "Laporan Harian & Bulanan via WhatsApp",
      "Sistem Blast Pengumuman Seluruh Sekolah",
      "Integrasi Notifikasi Koperasi & Sarpras",
      "Dashboard Monitoring Status Pengiriman Pesan",
      "Support Custom API Gateway (Fonnte/WoWA/dll)"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "WHATSAPP",
    "serviceCode": "WHATSAPP"
  },
  {
    "id": "PAKET_LENGKAP_SIMPLE_MICRO_BULANAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP SIMPLE (Micro) - Bulanan",
    "priceMonthly": 199000,
    "priceYearly": 1910400,
    "deviceLimit": 100,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-SIMPLE",
      "Akses Seluruh Modul (PAKET LENGKAP SIMPLE)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  },
  {
    "id": "PAKET_LENGKAP_SIMPLE_MICRO_TAHUNAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP SIMPLE (Micro) - Tahunan",
    "priceMonthly": 159200,
    "priceYearly": 1910400,
    "deviceLimit": 100,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-SIMPLE",
      "Akses Seluruh Modul (PAKET LENGKAP SIMPLE)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  },
  {
    "id": "PAKET_LENGKAP_SIMPLE_SMALL_BULANAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP SIMPLE (Small) - Bulanan",
    "priceMonthly": 499000,
    "priceYearly": 4790400,
    "deviceLimit": 300,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-SIMPLE",
      "Akses Seluruh Modul (PAKET LENGKAP SIMPLE)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  },
  {
    "id": "PAKET_LENGKAP_SIMPLE_SMALL_TAHUNAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP SIMPLE (Small) - Tahunan",
    "priceMonthly": 399200,
    "priceYearly": 4790400,
    "deviceLimit": 300,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-SIMPLE",
      "Akses Seluruh Modul (PAKET LENGKAP SIMPLE)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  },
  {
    "id": "PAKET_LENGKAP_SIMPLE_MEDIUM_BULANAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP SIMPLE (Medium) - Bulanan",
    "priceMonthly": 899000,
    "priceYearly": 8630400,
    "deviceLimit": 600,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-SIMPLE",
      "Akses Seluruh Modul (PAKET LENGKAP SIMPLE)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  },
  {
    "id": "PAKET_LENGKAP_SIMPLE_MEDIUM_TAHUNAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP SIMPLE (Medium) - Tahunan",
    "priceMonthly": 719200,
    "priceYearly": 8630400,
    "deviceLimit": 600,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-SIMPLE",
      "Akses Seluruh Modul (PAKET LENGKAP SIMPLE)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  },
  {
    "id": "PAKET_LENGKAP_SIMPLE_LARGE_BULANAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP SIMPLE (Large) - Bulanan",
    "priceMonthly": 1599000,
    "priceYearly": 15350400,
    "deviceLimit": 1200,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-SIMPLE",
      "Akses Seluruh Modul (PAKET LENGKAP SIMPLE)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  },
  {
    "id": "PAKET_LENGKAP_SIMPLE_LARGE_TAHUNAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP SIMPLE (Large) - Tahunan",
    "priceMonthly": 1279200,
    "priceYearly": 15350400,
    "deviceLimit": 1200,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-SIMPLE",
      "Akses Seluruh Modul (PAKET LENGKAP SIMPLE)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  },
  {
    "id": "PAKET_LENGKAP_SIMPLE_ENTERPRISE_BULANAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP SIMPLE (Enterprise) - Bulanan",
    "priceMonthly": 2999000,
    "priceYearly": 28790400,
    "deviceLimit": 0,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-SIMPLE",
      "Akses Seluruh Modul (PAKET LENGKAP SIMPLE)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  },
  {
    "id": "PAKET_LENGKAP_SIMPLE_ENTERPRISE_TAHUNAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP SIMPLE (Enterprise) - Tahunan",
    "priceMonthly": 2399200,
    "priceYearly": 28790400,
    "deviceLimit": 0,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-SIMPLE",
      "Akses Seluruh Modul (PAKET LENGKAP SIMPLE)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  },
  {
    "id": "PAKET_LENGKAP_MULTI_MICRO_BULANAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP MULTI (Micro) - Bulanan",
    "priceMonthly": 299000,
    "priceYearly": 2870400,
    "deviceLimit": 100,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-MULTI_SESI",
      "Akses Seluruh Modul (PAKET LENGKAP MULTI)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  },
  {
    "id": "ACADEMIC_MICRO_TAHUNAN",
    "productId": "absenta",
    "name": "Academic Core (Micro) - Tahunan",
    "priceMonthly": 0,
    "priceYearly": 0,
    "deviceLimit": 100,
    "featuresJson": [],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "CORE",
    "serviceCode": "CORE"
  },
  {
    "id": "ABSENSI_SIMPLE_MICRO_BULANAN",
    "productId": "absenta",
    "name": "Absensi Simple (Micro) - Bulanan",
    "priceMonthly": 100000,
    "priceYearly": 960000,
    "deviceLimit": 100,
    "featuresJson": [
      "Absensi Harian Face Recognition & GPS",
      "Logbook Kegiatan Harian Pegawai",
      "Pengajuan Izin & Sakit Digital",
      "Notifikasi Kehadiran via WhatsApp",
      "Rekap Laporan Bulanan Excel/PDF"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "ABSENSI",
    "serviceCode": "ABSENSI"
  },
  {
    "id": "WHATSAPP_SERVICE_MEDIUM_TAHUNAN",
    "productId": "absenta",
    "name": "WhatsApp Service (Medium) - Tahunan",
    "priceMonthly": 60000,
    "priceYearly": 720000,
    "deviceLimit": 600,
    "featuresJson": [
      "Notifikasi Kehadiran Otomatis (Real-time)",
      "Laporan Harian & Bulanan via WhatsApp",
      "Sistem Blast Pengumuman Seluruh Sekolah",
      "Integrasi Notifikasi Koperasi & Sarpras",
      "Dashboard Monitoring Status Pengiriman Pesan",
      "Support Custom API Gateway (Fonnte/WoWA/dll)"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "WHATSAPP",
    "serviceCode": "WHATSAPP"
  },
  {
    "id": "PAKET_LENGKAP_MULTI_MICRO_TAHUNAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP MULTI (Micro) - Tahunan",
    "priceMonthly": 239200,
    "priceYearly": 2870400,
    "deviceLimit": 100,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-MULTI_SESI",
      "Akses Seluruh Modul (PAKET LENGKAP MULTI)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  },
  {
    "id": "PAKET_LENGKAP_MULTI_SMALL_BULANAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP MULTI (Small) - Bulanan",
    "priceMonthly": 599000,
    "priceYearly": 5750400,
    "deviceLimit": 300,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-MULTI_SESI",
      "Akses Seluruh Modul (PAKET LENGKAP MULTI)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  },
  {
    "id": "PAKET_LENGKAP_MULTI_SMALL_TAHUNAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP MULTI (Small) - Tahunan",
    "priceMonthly": 479200,
    "priceYearly": 5750400,
    "deviceLimit": 300,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-MULTI_SESI",
      "Akses Seluruh Modul (PAKET LENGKAP MULTI)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  },
  {
    "id": "PAKET_LENGKAP_MULTI_MEDIUM_BULANAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP MULTI (Medium) - Bulanan",
    "priceMonthly": 1099000,
    "priceYearly": 10550400,
    "deviceLimit": 600,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-MULTI_SESI",
      "Akses Seluruh Modul (PAKET LENGKAP MULTI)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  },
  {
    "id": "PAKET_LENGKAP_MULTI_MEDIUM_TAHUNAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP MULTI (Medium) - Tahunan",
    "priceMonthly": 879200,
    "priceYearly": 10550400,
    "deviceLimit": 600,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-MULTI_SESI",
      "Akses Seluruh Modul (PAKET LENGKAP MULTI)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  },
  {
    "id": "PAKET_LENGKAP_MULTI_LARGE_BULANAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP MULTI (Large) - Bulanan",
    "priceMonthly": 1999000,
    "priceYearly": 19190400,
    "deviceLimit": 1200,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-MULTI_SESI",
      "Akses Seluruh Modul (PAKET LENGKAP MULTI)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  },
  {
    "id": "PAKET_LENGKAP_MULTI_LARGE_TAHUNAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP MULTI (Large) - Tahunan",
    "priceMonthly": 1599200,
    "priceYearly": 19190400,
    "deviceLimit": 1200,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-MULTI_SESI",
      "Akses Seluruh Modul (PAKET LENGKAP MULTI)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  },
  {
    "id": "PAKET_LENGKAP_MULTI_ENTERPRISE_BULANAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP MULTI (Enterprise) - Bulanan",
    "priceMonthly": 3999000,
    "priceYearly": 38390400,
    "deviceLimit": 0,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-MULTI_SESI",
      "Akses Seluruh Modul (PAKET LENGKAP MULTI)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "MONTH",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  },
  {
    "id": "PAKET_LENGKAP_MULTI_ENTERPRISE_TAHUNAN",
    "productId": "absenta",
    "name": "PAKET LENGKAP MULTI (Enterprise) - Tahunan",
    "priceMonthly": 3199200,
    "priceYearly": 38390400,
    "deviceLimit": 0,
    "featuresJson": [
      "KOPERASI",
      "SARPRAS",
      "HUBIN",
      "WHATSAPP",
      "ABSENSI-MULTI_SESI",
      "Akses Seluruh Modul (PAKET LENGKAP MULTI)",
      "Integrasi WhatsApp Notifikasi Otomatis",
      "Prioritas Dukungan Teknis 24/7",
      "Update Fitur Terbaru Secara Otomatis",
      "Backup Data Harian & Keamanan Berlapis"
    ],
    "billingPeriod": "YEAR",
    "isActive": true,
    "moduleId": "PAKET_LENGKAP",
    "serviceCode": "PAKET_LENGKAP"
  }
];

async function main() {
  console.log('🌱 Starting database seeding for central License Server using live data...');

  // 1. Seed Products
  console.log('📦 Seeding Products...');
  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        name: product.name,
        prefix: product.prefix
      },
      create: product
    });
    console.log(`  Upserted product: ${product.id}`);
  }

  // 2. Seed Plans
  console.log('🎫 Seeding Plans...');
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: {
        productId: plan.productId,
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        deviceLimit: plan.deviceLimit,
        featuresJson: plan.featuresJson,
        billingPeriod: plan.billingPeriod,
        isActive: plan.isActive,
        moduleId: plan.moduleId,
        serviceCode: plan.serviceCode
      },
      create: plan
    });
    console.log(`  Upserted plan: ${plan.id}`);
  }

  console.log('✅ Central database seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
