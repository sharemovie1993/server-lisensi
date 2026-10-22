const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SKKNI_DATA = [
  // =========================================================================
  // 1. TEKNIK KOMPUTER DAN JARINGAN (TKJ)
  // =========================================================================
  {
    rumpun: 'Teknologi Informasi & Komunikasi',
    kodeSkema: 'SKEMA-KKNI-TKJ-L2',
    namaSkema: 'Skema Sertifikasi KKNI Level II Pada Kompetensi Keahlian Teknik Komputer dan Jaringan',
    namaSkemaEn: 'KKNI Level II Certification Scheme in Computer and Network Engineering',
    levelKkni: 2,
    deskripsi: 'Standar kompetensi keahlian TKJ mencakup instalasi jaringan lokal, pengalamatan IP, konfigurasi routing, perakitan perangkat, dan keamanan jaringan dasar sesuai Kepmenaker RI.',
    defaultJudulId: 'Rancang Bangun Jaringan Komputer Berbasis Kabel dan Nirkabel dengan Routing Dinamis serta Manajemen Bandwidth',
    defaultJudulEn: 'Design and Implementation of Wired and Wireless Computer Network with Dynamic Routing and Bandwidth Management',
    units: [
      {
        kode_unit: 'J.611000.001.01',
        judul_unit_id: 'Mengumpulkan Kebutuhan Teknis Pengguna yang Menggunakan Jaringan',
        judul_unit_en: 'Gathering Technical Requirements of Network Users',
        kategori: 'INTI',
      },
      {
        kode_unit: 'J.611000.002.01',
        judul_unit_id: 'Mengumpulkan Data Peralatan Jaringan Dengan Teknologi yang Sesuai',
        judul_unit_en: 'Collecting Network Equipment Data with Appropriate Technology',
        kategori: 'INTI',
      },
      {
        kode_unit: 'J.611000.003.02',
        judul_unit_id: 'Merancang Topologi Jaringan',
        judul_unit_en: 'Designing Network Topology',
        kategori: 'INTI',
      },
      {
        kode_unit: 'J.611000.004.01',
        judul_unit_id: 'Merancang Pengalamatan Jaringan (IP Addressing & Subnetting)',
        judul_unit_en: 'Designing Network Addressing Scheme',
        kategori: 'INTI',
      },
      {
        kode_unit: 'J.611000.005.02',
        judul_unit_id: 'Menentukan Spesifikasi Perangkat Jaringan',
        judul_unit_en: 'Determining Network Device Specifications',
        kategori: 'INTI',
      },
      {
        kode_unit: 'J.611000.008.02',
        judul_unit_id: 'Menyiapkan Kabel Jaringan (Crimping & Termination)',
        judul_unit_en: 'Preparing Network Structured Cabling',
        kategori: 'INTI',
      },
      {
        kode_unit: 'J.611000.009.02',
        judul_unit_id: 'Memasang Kabel Jaringan Terstruktur',
        judul_unit_en: 'Installing Structured Network Cabling',
        kategori: 'INTI',
      },
      {
        kode_unit: 'J.611000.010.02',
        judul_unit_id: 'Memasang Jaringan Nirkabel (Wireless Access Point)',
        judul_unit_en: 'Installing Wireless Local Area Network',
        kategori: 'INTI',
      },
      {
        kode_unit: 'J.611000.011.02',
        judul_unit_id: 'Memasang Perangkat Jaringan ke dalam Sistem Jaringan',
        judul_unit_en: 'Mounting Network Devices into Network System',
        kategori: 'INTI',
      },
      {
        kode_unit: 'J.611000.012.02',
        judul_unit_id: 'Mengkonfigurasi Switch pada Jaringan (VLAN & Trunking)',
        judul_unit_en: 'Configuring Switches on the Network',
        kategori: 'INTI',
      },
      {
        kode_unit: 'J.611000.013.02',
        judul_unit_id: 'Mengkonfigurasi Routing pada Perangkat Jaringan (MikroTik/Router)',
        judul_unit_en: 'Configuring Routing on Network Devices',
        kategori: 'INTI',
      },
    ],
  },

  // =========================================================================
  // 2. REKAYASA PERANGKAT LUNAK (RPL)
  // =========================================================================
  {
    rumpun: 'Teknologi Informasi & Komunikasi',
    kodeSkema: 'SKEMA-KKNI-RPL-L2',
    namaSkema: 'Skema Sertifikasi KKNI Level II Pada Kompetensi Keahlian Rekayasa Perangkat Lunak',
    namaSkemaEn: 'KKNI Level II Certification Scheme in Software Engineering',
    levelKkni: 2,
    deskripsi: 'Standar kompetensi keahlian RPL mencakup pemrograman terstruktur & berorientasi objek, perancangan database relasional, antarmuka web responsif, dan deployment aplikasi.',
    defaultJudulId: 'Pengembangan Aplikasi Web Interaktif Berbasis Database Relasional dan RESTful API',
    defaultJudulEn: 'Development of Interactive Web Application Based on Relational Database and RESTful API',
    units: [
      {
        kode_unit: 'J.620100.004.01',
        judul_unit_id: 'Mengimplementasikan Algoritma Pemrograman',
        judul_unit_en: 'Implementing Programming Algorithms',
        kategori: 'INTI',
      },
      {
        kode_unit: 'J.620100.005.02',
        judul_unit_id: 'Mengimplementasikan Pemrograman Berorientasi Objek (OOP)',
        judul_unit_en: 'Implementing Object-Oriented Programming',
        kategori: 'INTI',
      },
      {
        kode_unit: 'J.620100.009.01',
        judul_unit_id: 'Menggunakan Spesifikasi Program untuk Pembuatan Kode',
        judul_unit_en: 'Using Program Specifications for Coding',
        kategori: 'INTI',
      },
      {
        kode_unit: 'J.620100.016.01',
        judul_unit_id: 'Menulis Kode dengan Prinsip Sesuai Guidelines dan Best Practice',
        judul_unit_en: 'Writing Code Following Guidelines and Best Practices',
        kategori: 'INTI',
      },
      {
        kode_unit: 'J.620100.017.02',
        judul_unit_id: 'Mengimplementasikan Struktur Data Relasional dalam Basis Data',
        judul_unit_en: 'Implementing Relational Data Structures in Database',
        kategori: 'INTI',
      },
      {
        kode_unit: 'J.620100.018.02',
        judul_unit_id: 'Mengimplementasikan Akses Basis Data (SQL CRUD)',
        judul_unit_en: 'Implementing Database Access Operations',
        kategori: 'INTI',
      },
      {
        kode_unit: 'J.620100.022.02',
        judul_unit_id: 'Mengimplementasikan Antarmuka Pengguna (Web User Interface)',
        judul_unit_en: 'Implementing Web User Interface',
        kategori: 'INTI',
      },
      {
        kode_unit: 'J.620100.023.02',
        judul_unit_id: 'Membuat Dokumen Kode Program dan Arsitektur Aplikasi',
        judul_unit_en: 'Documenting Program Code and Application Architecture',
        kategori: 'INTI',
      },
      {
        kode_unit: 'J.620100.025.02',
        judul_unit_id: 'Melakukan Pengujian Unit Perangkat Lunak (Unit Testing)',
        judul_unit_en: 'Conducting Software Unit Testing',
        kategori: 'INTI',
      },
      {
        kode_unit: 'J.620100.033.02',
        judul_unit_id: 'Melaksanakan Penggelaran Perangkat Lunak (Application Deployment)',
        judul_unit_en: 'Executing Software Deployment to Server',
        kategori: 'INTI',
      },
    ],
  },

  // =========================================================================
  // 3. DESAIN KOMUNIKASI VISUAL (DKV) / MULTIMEDIA
  // =========================================================================
  {
    rumpun: 'Seni & Ekonomi Kreatif',
    kodeSkema: 'SKEMA-KKNI-DKV-L2',
    namaSkema: 'Skema Sertifikasi KKNI Level II Pada Kompetensi Keahlian Desain Komunikasi Visual',
    namaSkemaEn: 'KKNI Level II Certification Scheme in Visual Communication Design',
    levelKkni: 2,
    deskripsi: 'Standar kompetensi keahlian DKV mencakup prinsip dasar desain grafis, ilustrasi digital, tipografi, pembuatan identitas visual merk (branding), dan produksi aset multimedia.',
    defaultJudulId: 'Perancangan Identitas Visual Brand Promosi Produk UMKM dan Publikasi Media Digital',
    defaultJudulEn: 'Visual Brand Identity Design for MSME Product Promotion and Digital Media Publication',
    units: [
      {
        kode_unit: 'M.74100.001.02',
        judul_unit_id: 'Menerapkan Prinsip Dasar Desain Komunikasi Visual',
        judul_unit_en: 'Applying Fundamental Principles of Visual Design',
        kategori: 'INTI',
      },
      {
        kode_unit: 'M.74100.002.02',
        judul_unit_id: 'Menerapkan Desain Brief dan Analisis Kebutuhan Klien',
        judul_unit_en: 'Applying Design Brief and Client Requirement Analysis',
        kategori: 'INTI',
      },
      {
        kode_unit: 'M.74100.005.02',
        judul_unit_id: 'Mengoperasikan Perangkat Lunak Desain Grafis Berbasis Vektor',
        judul_unit_en: 'Operating Vector Graphics Software',
        kategori: 'INTI',
      },
      {
        kode_unit: 'M.74100.006.02',
        judul_unit_id: 'Mengoperasikan Perangkat Lunak Desain Grafis Berbasis Raster/Bitmap',
        judul_unit_en: 'Operating Raster/Bitmap Image Editing Software',
        kategori: 'INTI',
      },
      {
        kode_unit: 'M.74100.008.02',
        judul_unit_id: 'Menciptakan Karya Desain Grafis Publikasi Cetak dan Digital',
        judul_unit_en: 'Creating Print and Digital Graphic Publication Assets',
        kategori: 'INTI',
      },
      {
        kode_unit: 'M.74100.009.02',
        judul_unit_id: 'Menerapkan Prinsip Tipografi dalam Karya Desain',
        judul_unit_en: 'Applying Typography Principles in Design Works',
        kategori: 'INTI',
      },
      {
        kode_unit: 'M.74100.010.01',
        judul_unit_id: 'Melakukan Editing Audio dan Video Promosi Dasar',
        judul_unit_en: 'Performing Basic Promotional Audio and Video Editing',
        kategori: 'INTI',
      },
      {
        kode_unit: 'M.74100.012.01',
        judul_unit_id: 'Menyiapkan Materi Karya Desain untuk Pra-Cetak (Pre-Press)',
        judul_unit_en: 'Preparing Design Artwork for Pre-Press Production',
        kategori: 'INTI',
      },
    ],
  },

  // =========================================================================
  // 4. TEKNIK KENDARAAN RINGAN OTOMOTIF (TKRO)
  // =========================================================================
  {
    rumpun: 'Teknologi & Rekayasa',
    kodeSkema: 'SKEMA-KKNI-TKRO-L2',
    namaSkema: 'Skema Sertifikasi KKNI Level II Pada Kompetensi Keahlian Teknik Kendaraan Ringan Otomotif',
    namaSkemaEn: 'KKNI Level II Certification Scheme in Light Vehicle Automotive Engineering',
    levelKkni: 2,
    deskripsi: 'Standar kompetensi keahlian TKRO mencakup perawatan berkala mesin kendaraan ringan, sistem EFI/Injeksi, sistem rem, sistem suspensi, transmisi, dan kelistrikan bodi.',
    defaultJudulId: 'Perawatan Berkala Mesin EFI, Sistem Rem ABS, dan Sistem Kelistrikan Body Kendaraan Ringan',
    defaultJudulEn: 'Periodic Maintenance of EFI Engine, ABS Brake System, and Vehicle Body Electrical System',
    units: [
      {
        kode_unit: 'G.452110.001.01',
        judul_unit_id: 'Melaksanakan Pemeliharaan/Servis Komponen Mesin Bensin Konvensional dan EFI',
        judul_unit_en: 'Periodic Maintenance of Conventional and EFI Gasoline Engine',
        kategori: 'INTI',
      },
      {
        kode_unit: 'G.452110.002.01',
        judul_unit_id: 'Melaksanakan Pemeliharaan Sistem Pendingin Mesin',
        judul_unit_en: 'Maintaining Engine Cooling System',
        kategori: 'INTI',
      },
      {
        kode_unit: 'G.452110.003.01',
        judul_unit_id: 'Melaksanakan Pemeliharaan Sistem Bahan Bakar Bensin dan Injeksi',
        judul_unit_en: 'Maintaining Gasoline and Fuel Injection Systems',
        kategori: 'INTI',
      },
      {
        kode_unit: 'G.452110.005.01',
        judul_unit_id: 'Memelihara/Servis Engine Management System Menggunakan Diagnostic Scan Tool',
        judul_unit_en: 'Servicing Engine Management System Using Diagnostic Scan Tool',
        kategori: 'INTI',
      },
      {
        kode_unit: 'G.452110.008.01',
        judul_unit_id: 'Melaksanakan Pemeliharaan Unit Kopling dan Komponen Pengoperasian',
        judul_unit_en: 'Maintaining Clutch Unit and Operating Components',
        kategori: 'INTI',
      },
      {
        kode_unit: 'G.452110.009.01',
        judul_unit_id: 'Melaksanakan Pemeliharaan Transmisi Manual dan Otomatis',
        judul_unit_en: 'Maintaining Manual and Automatic Transmission',
        kategori: 'INTI',
      },
      {
        kode_unit: 'G.452110.012.01',
        judul_unit_id: 'Melaksanakan Pemeliharaan Sistem Rem Cakram dan Tromol',
        judul_unit_en: 'Maintaining Disc and Drum Braking Systems',
        kategori: 'INTI',
      },
      {
        kode_unit: 'G.452110.015.01',
        judul_unit_id: 'Melaksanakan Pemeliharaan Sistem Suspensi dan Kemudi Kendaraan',
        judul_unit_en: 'Maintaining Vehicle Steering and Suspension Systems',
        kategori: 'INTI',
      },
      {
        kode_unit: 'G.452110.018.01',
        judul_unit_id: 'Memasang dan Memelihara Sistem Kelistrikan Bodi Kendaraan',
        judul_unit_en: 'Installing and Maintaining Vehicle Body Electrical Systems',
        kategori: 'INTI',
      },
      {
        kode_unit: 'G.452110.020.01',
        judul_unit_id: 'Memelihara dan Mengisi Sistem Pendingin Udara (Air Conditioner / AC Mobil)',
        judul_unit_en: 'Maintaining and Charging Automotive Air Conditioning System',
        kategori: 'INTI',
      },
    ],
  },

  // =========================================================================
  // 5. TEKNIK DAN BISNIS SEPEDA MOTOR (TBSM)
  // =========================================================================
  {
    rumpun: 'Teknologi & Rekayasa',
    kodeSkema: 'SKEMA-KKNI-TBSM-L2',
    namaSkema: 'Skema Sertifikasi KKNI Level II Pada Kompetensi Keahlian Teknik dan Bisnis Sepeda Motor',
    namaSkemaEn: 'KKNI Level II Certification Scheme in Motorcycle Engineering and Business',
    levelKkni: 2,
    deskripsi: 'Standar kompetensi keahlian TBSM mencakup perawatan berkala mesin sepeda motor 4 langkah, sistem PGM-FI/Injeksi bahan bakar, sistem transmisi otomatis CVT, dan sistem kelistrikan.',
    defaultJudulId: 'Tune-Up Mesin Injeksi Sepeda Motor, Servis Transmisi CVT Matic, dan Sistem Rem Hidrolik',
    defaultJudulEn: 'Periodic Tune-Up of Motorcycle Injection Engine, CVT Automatic Transmission Service, and Hydraulic Brake',
    units: [
      {
        kode_unit: 'G.454010.001.01',
        judul_unit_id: 'Melakukan Pemeriksaan dan Penyetelan Celah Katup Mesin Sepeda Motor',
        judul_unit_en: 'Inspecting and Adjusting Motorcycle Engine Valve Clearance',
        kategori: 'INTI',
      },
      {
        kode_unit: 'G.454010.002.01',
        judul_unit_id: 'Melakukan Servis Sistem Pelumasan dan Pendingin Sepeda Motor',
        judul_unit_en: 'Servicing Motorcycle Engine Lubrication and Cooling Systems',
        kategori: 'INTI',
      },
      {
        kode_unit: 'G.454010.003.01',
        judul_unit_id: 'Melakukan Perawatan Sistem Bahan Bakar Injeksi (FI Diagnostic Tool)',
        judul_unit_en: 'Maintaining Fuel Injection System with Diagnostic Tool',
        kategori: 'INTI',
      },
      {
        kode_unit: 'G.454010.005.01',
        judul_unit_id: 'Melakukan Servis Sistem Transmisi Otomatis (CVT & V-Belt)',
        judul_unit_en: 'Servicing Continuously Variable Transmission (CVT) and Drive Belt',
        kategori: 'INTI',
      },
      {
        kode_unit: 'G.454010.006.01',
        judul_unit_id: 'Melakukan Servis Kopling Manual dan Transmisi Rantai Penggerak',
        judul_unit_en: 'Servicing Manual Clutch and Final Drive Chain',
        kategori: 'INTI',
      },
      {
        kode_unit: 'G.454010.008.01',
        judul_unit_id: 'Melakukan Pemeliharaan Sistem Rem Hidrolik dan Tromol Mekanik',
        judul_unit_en: 'Maintaining Hydraulic Disc and Mechanical Drum Brakes',
        kategori: 'INTI',
      },
      {
        kode_unit: 'G.454010.010.01',
        judul_unit_id: 'Melakukan Pemeliharaan Sistem Suspensi Depan dan Belakang',
        judul_unit_en: 'Maintaining Front and Rear Motorcycle Suspension',
        kategori: 'INTI',
      },
      {
        kode_unit: 'G.454010.012.01',
        judul_unit_id: 'Melakukan Servis dan Troubleshooting Sistem Pengisian dan Starter',
        judul_unit_en: 'Servicing Battery Charging and Electric Starter Systems',
        kategori: 'INTI',
      },
      {
        kode_unit: 'G.454010.014.01',
        judul_unit_id: 'Melakukan Servis Sistem Penerangan dan Sinyal Kelistrikan Bodi',
        judul_unit_en: 'Servicing Motorcycle Lighting and Signalling Electrical Systems',
        kategori: 'INTI',
      },
    ],
  },

  // =========================================================================
  // 6. AKUNTANSI DAN KEUANGAN LEMBAGA (AKL)
  // =========================================================================
  {
    rumpun: 'Bisnis & Manajemen',
    kodeSkema: 'SKEMA-KKNI-AKL-L2',
    namaSkema: 'Skema Sertifikasi KKNI Level II Pada Kompetensi Keahlian Akuntansi dan Keuangan Lembaga',
    namaSkemaEn: 'KKNI Level II Certification Scheme in Accounting and Institutional Finance',
    levelKkni: 2,
    deskripsi: 'Standar kompetensi keahlian AKL mencakup pemrosesan dokumen transaksi, entri jurnal buku besar, siklus akuntansi perusahaan jasa dan dagang, komputer akuntansi (MYOB/Accurate), dan perpajakan.',
    defaultJudulId: 'Penyusunan Laporan Keuangan Siklus Akuntansi Perusahaan Dagang Berbasis Spreadsheet dan Software Akuntansi',
    defaultJudulEn: 'Preparation of Financial Statements for Merchandising Company Accounting Cycle Using Spreadsheet and Accounting Software',
    units: [
      {
        kode_unit: 'M.692000.001.02',
        judul_unit_id: 'Menerapkan Prinsip Praktik Profesional dalam Bekerja Bidang Akuntansi',
        judul_unit_en: 'Applying Professional Practice Principles in Accounting Work',
        kategori: 'INTI',
      },
      {
        kode_unit: 'M.692000.002.02',
        judul_unit_id: 'Menerapkan Praktik Kesehatan dan Keselamatan Kerja di Lingkungan Kantor',
        judul_unit_en: 'Applying Occupational Health and Safety Practices in Office',
        kategori: 'INTI',
      },
      {
        kode_unit: 'M.692000.007.02',
        judul_unit_id: 'Memproses Dokumen Transaksi Keuangan dan Bukti Pembukuan',
        judul_unit_en: 'Processing Financial Transaction Documents and Vouchers',
        kategori: 'INTI',
      },
      {
        kode_unit: 'M.692000.008.02',
        judul_unit_id: 'Memproses Buku Jurnal Transaksi Perusahaan Jasa dan Dagang',
        judul_unit_en: 'Processing General and Special Journals',
        kategori: 'INTI',
      },
      {
        kode_unit: 'M.692000.009.02',
        judul_unit_id: 'Memproses Buku Besar Utama dan Buku Besar Pembantu',
        judul_unit_en: 'Posting to General Ledger and Subsidiary Ledgers',
        kategori: 'INTI',
      },
      {
        kode_unit: 'M.692000.013.02',
        judul_unit_id: 'Menyusun Laporan Keuangan (Laba Rugi, Neraca, Perubahan Modal, Arus Kas)',
        judul_unit_en: 'Preparing Complete Financial Statements',
        kategori: 'INTI',
      },
      {
        kode_unit: 'M.692000.014.02',
        judul_unit_id: 'Mengoperasikan Aplikasi Komputer Akuntansi (MYOB / Accurate / Zahir)',
        judul_unit_en: 'Operating Computerized Accounting Software',
        kategori: 'INTI',
      },
      {
        kode_unit: 'M.692000.015.02',
        judul_unit_id: 'Mengoperasikan Paket Program Pengolah Angka / Spreadsheet (Excel)',
        judul_unit_en: 'Operating Spreadsheet Application Software',
        kategori: 'INTI',
      },
      {
        kode_unit: 'M.692000.018.02',
        judul_unit_id: 'Mengelola Kartu Persediaan Barang Dagang (Metode FIFO / Average)',
        judul_unit_en: 'Managing Inventory Subsidiary Cards',
        kategori: 'INTI',
      },
      {
        kode_unit: 'M.692000.022.02',
        judul_unit_id: 'Menyiapkan Surat Pemberitahuan Pajak (SPT PPh Pasal 21 dan PPN)',
        judul_unit_en: 'Preparing Tax Return Statements',
        kategori: 'INTI',
      },
    ],
  },

  // =========================================================================
  // 7. MANAJEMEN PERKANTORAN & LAYANAN BISNIS (MPLB / OTKP)
  // =========================================================================
  {
    rumpun: 'Bisnis & Manajemen',
    kodeSkema: 'SKEMA-KKNI-MPLB-L2',
    namaSkema: 'Skema Sertifikasi KKNI Level II Pada Kompetensi Keahlian Manajemen Perkantoran dan Layanan Bisnis',
    namaSkemaEn: 'KKNI Level II Certification Scheme in Office Management and Business Services',
    levelKkni: 2,
    deskripsi: 'Standar kompetensi keahlian MPLB mencakup korespondensi bisnis bahasa Indonesia & Inggris, kearsipan sistem digital, tata kelola rapat, layanan telepon dan kas kecil.',
    defaultJudulId: 'Pengelolaan Administrasi Perkantoran Modern, Kearsipan Digital, dan Layanan Komunikasi Bisnis',
    defaultJudulEn: 'Modern Office Administration Management, Digital Archiving, and Business Communication Services',
    units: [
      {
        kode_unit: 'N.821100.001.02',
        judul_unit_id: 'Menangani Penerimaan dan Pengiriman Surat/Dokumen Kantor',
        judul_unit_en: 'Handling Incoming and Outgoing Mail and Documents',
        kategori: 'INTI',
      },
      {
        kode_unit: 'N.821100.004.02',
        judul_unit_id: 'Membuat Format dan Menyusun Surat Bisnis Bahasa Indonesia',
        judul_unit_en: 'Drafting Business Correspondence Letters',
        kategori: 'INTI',
      },
      {
        kode_unit: 'N.821100.007.02',
        judul_unit_id: 'Melakukan Pengelolaan Sistem Kearsipan Manual dan Elektronik',
        judul_unit_en: 'Managing Manual and Electronic Record Filing Systems',
        kategori: 'INTI',
      },
      {
        kode_unit: 'N.821100.011.02',
        judul_unit_id: 'Melakukan Komunikasi Lisan dan Menangani Telepon Masuk/Keluar',
        judul_unit_en: 'Performing Verbal Communication and Telephone Handling',
        kategori: 'INTI',
      },
      {
        kode_unit: 'N.821100.014.02',
        judul_unit_id: 'Mengelola Dana Kas Kecil Kantor (Petty Cash)',
        judul_unit_en: 'Managing Office Petty Cash Fund',
        kategori: 'INTI',
      },
      {
        kode_unit: 'N.821100.018.02',
        judul_unit_id: 'Mempersiapkan Rapat/Pertemuan Bisnis dan Notula',
        judul_unit_en: 'Organizing Business Meetings and Writing Minutes',
        kategori: 'INTI',
      },
      {
        kode_unit: 'N.821100.021.02',
        judul_unit_id: 'Memberikan Pelayanan Prima kepada Pelanggan/Tamu Kantor (Customer Service)',
        judul_unit_en: 'Delivering Excellent Customer Service to Visitors',
        kategori: 'INTI',
      },
      {
        kode_unit: 'N.821100.024.02',
        judul_unit_id: 'Mengoperasikan Aplikasi Komputer Pengolah Kata dan Presentasi',
        judul_unit_en: 'Operating Word Processing and Presentation Applications',
        kategori: 'INTI',
      },
    ],
  },

  // =========================================================================
  // 8. KULINER / TATA BOGA
  // =========================================================================
  {
    rumpun: 'Kuliner & Pariwisata',
    kodeSkema: 'SKEMA-KKNI-KULINER-L2',
    namaSkema: 'Skema Sertifikasi KKNI Level II Pada Kompetensi Keahlian Kuliner',
    namaSkemaEn: 'KKNI Level II Certification Scheme in Culinary Arts',
    levelKkni: 2,
    deskripsi: 'Standar kompetensi keahlian Kuliner mencakup sanitasi hygiene makanan (HACCP), persiapan mise en place, pengolahan hidangan Indonesia dan Kontinental, penataan hidangan (plating), dan penyimpanan makanan.',
    defaultJudulId: 'Pengolahan dan Penataan Menu Lengkap (Appetizer, Main Course, Dessert) Makanan Tradisional Nusantara dan Kontinental',
    defaultJudulEn: 'Preparation and Plating of Complete Course Menu (Appetizer, Main Course, Dessert) in Indonesian and Continental Cuisine',
    units: [
      {
        kode_unit: 'I.55HDR00.015.2',
        judul_unit_id: 'Menerapkan Prosedur Keselamatan dan Kesehatan Kerja (K3) di Dapur',
        judul_unit_en: 'Applying Workplace Health and Safety in Commercial Kitchen',
        kategori: 'INTI',
      },
      {
        kode_unit: 'I.55HDR00.016.2',
        judul_unit_id: 'Menerapkan Kebersihan Diri dan Sanitasi Hygiene Makanan (Food Safety)',
        judul_unit_en: 'Practicing Food Safety and Personal Hygiene',
        kategori: 'INTI',
      },
      {
        kode_unit: 'I.55HDR00.020.2',
        judul_unit_id: 'Menggunakan dan Memelihara Peralatan Pengolahan Makanan Komersial',
        judul_unit_en: 'Operating and Maintaining Commercial Kitchen Equipment',
        kategori: 'INTI',
      },
      {
        kode_unit: 'I.55HDR00.024.2',
        judul_unit_id: 'Menyiapkan Bahan Baku Makanan (Mise en Place)',
        judul_unit_en: 'Preparing Food Ingredients (Mise en Place)',
        kategori: 'INTI',
      },
      {
        kode_unit: 'I.55HDR00.026.2',
        judul_unit_id: 'Mengolah Makanan Pembuka Dingin dan Panas (Appetizer & Soup)',
        judul_unit_en: 'Preparing Cold and Hot Appetizers and Soups',
        kategori: 'INTI',
      },
      {
        kode_unit: 'I.55HDR00.028.2',
        judul_unit_id: 'Mengolah Hidangan Utama Berbahan Daging, Unggas, dan Seafood (Main Course)',
        judul_unit_en: 'Cooking Meat, Poultry, and Seafood Main Course Dishes',
        kategori: 'INTI',
      },
      {
        kode_unit: 'I.55HDR00.031.2',
        judul_unit_id: 'Mengolah Hidangan Penutup Tradisional dan Kontinental (Dessert)',
        judul_unit_en: 'Preparing Traditional and Continental Desserts',
        kategori: 'INTI',
      },
      {
        kode_unit: 'I.55HDR00.035.2',
        judul_unit_id: 'Menyajikan dan Menghias Makanan dengan Teknik Food Plating Modern',
        judul_unit_en: 'Presenting and Garnishing Food with Modern Plating Techniques',
        kategori: 'INTI',
      },
    ],
  },
];

async function main() {
  console.log('🚀 Memulai Seeding Master Katalog SKKNI di Server Lisensi...');

  for (const item of SKKNI_DATA) {
    const { units, ...katalogData } = item;

    console.log(`📦 Memproses Skema: ${katalogData.kodeSkema} (${katalogData.namaSkema})...`);

    const katalog = await prisma.skkniKatalog.upsert({
      where: { kodeSkema: katalogData.kodeSkema },
      update: {
        rumpun: katalogData.rumpun,
        namaSkema: katalogData.namaSkema,
        namaSkemaEn: katalogData.namaSkemaEn,
        levelKkni: katalogData.levelKkni,
        deskripsi: katalogData.deskripsi,
        defaultJudulId: katalogData.defaultJudulId,
        defaultJudulEn: katalogData.defaultJudulEn,
        isActive: true,
      },
      create: {
        ...katalogData,
      },
    });

    // Bersihkan unit lama dan masukkan unit baru agar urutan dan data selalu mutakhir
    await prisma.skkniUnit.deleteMany({
      where: { katalogId: katalog.id },
    });

    let urutan = 1;
    for (const unit of units) {
      await prisma.skkniUnit.create({
        data: {
          katalogId: katalog.id,
          kodeUnit: unit.kode_unit,
          judulUnitId: unit.judul_unit_id,
          judulUnitEn: unit.judul_unit_en || null,
          kategori: unit.kategori || 'INTI',
          urutan: urutan++,
        },
      });
    }

    console.log(`   ✅ Tersimpan: ${units.length} Unit Kompetensi`);
  }

  const totalKatalog = await prisma.skkniKatalog.count();
  const totalUnits = await prisma.skkniUnit.count();

  console.log(`\n🎉 SUKSES! Master Katalog SKKNI Terpusat selesai di-seed.`);
  console.log(`📊 Total Skema Kejuruan: ${totalKatalog}`);
  console.log(`📊 Total Unit Kompetensi: ${totalUnits}`);
}

main()
  .catch((e) => {
    console.error('❌ Gagal seeding SKKNI:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
