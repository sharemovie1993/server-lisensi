const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const usePostgres = process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.startsWith('postgres://') || process.env.DATABASE_URL.startsWith('postgresql://'));

class DBAdapter {
  constructor(client, type) {
    this.client = client;
    this.type = type; // 'sqlite' or 'postgres'
  }

  async exec(sql) {
    if (this.type === 'postgres') {
      const pgSql = sql
        .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
        .replace(/\(datetime\('now',\s*'localtime'\)\)/gi, 'CURRENT_TIMESTAMP')
        .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');
      await this.client.query(pgSql);
    } else {
      await this.client.exec(sql);
    }
  }

  async run(sql, params = []) {
    if (this.type === 'postgres') {
      let index = 1;
      const pgSql = sql.replace(/\?/g, () => `$${index++}`);
      await this.client.query(pgSql, params);
    } else {
      await this.client.run(sql, params);
    }
  }

  async get(sql, params = []) {
    if (this.type === 'postgres') {
      let index = 1;
      const pgSql = sql.replace(/\?/g, () => `$${index++}`);
      const res = await this.client.query(pgSql, params);
      return res.rows[0];
    } else {
      return await this.client.get(sql, params);
    }
  }

  async all(sql, params = []) {
    if (this.type === 'postgres') {
      let index = 1;
      const pgSql = sql.replace(/\?/g, () => `$${index++}`);
      const res = await this.client.query(pgSql, params);
      return res.rows;
    } else {
      return await this.client.all(sql, params);
    }
  }
}

const db = {
  instance: null,
  get client() {
    return this.instance;
  },
  set client(val) {
    this.instance = val;
  },
  async exec(sql) {
    if (!this.instance) throw new Error('Database not initialized! Call initDatabase() first.');
    return this.instance.exec(sql);
  },
  async run(sql, params) {
    if (!this.instance) throw new Error('Database not initialized! Call initDatabase() first.');
    return this.instance.run(sql, params);
  },
  async get(sql, params) {
    if (!this.instance) throw new Error('Database not initialized! Call initDatabase() first.');
    return this.instance.get(sql, params);
  },
  async all(sql, params) {
    if (!this.instance) throw new Error('Database not initialized! Call initDatabase() first.');
    return this.instance.all(sql, params);
  }
};

async function initDatabase() {
  if (db.client) return db;

  if (usePostgres) {
    console.log('[DATABASE] Connecting to PostgreSQL database (Production/SaaS Mode)...');
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    db.client = new DBAdapter(pool, 'postgres');
  } else {
    console.log('[DATABASE] Connecting to SQLite local database (Development/Lightweight Mode)...');
    const dbPath = path.join(__dirname, '..', 'licenses.db');
    const sqliteClient = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    // SQLite Engine Ultra-Hardening & Performance Configuration
    await sqliteClient.exec('PRAGMA journal_mode = WAL');
    await sqliteClient.exec('PRAGMA synchronous = NORMAL');
    await sqliteClient.exec('PRAGMA busy_timeout = 5000');
    await sqliteClient.exec('PRAGMA foreign_keys = ON');
    
    db.client = new DBAdapter(sqliteClient, 'sqlite');
  }

  // 1. Table products
  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      key_prefix TEXT,
      display_name TEXT,
      capacity_label TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Table licenses
  await db.exec(`
    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT DEFAULT 'gform-orkestrator',
      license_key TEXT UNIQUE NOT NULL,
      school_name TEXT NOT NULL,
      device_limit INTEGER DEFAULT 1,
      is_unlimited INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      requested_slug TEXT,
      custom_domain TEXT,
      wireguard_ip TEXT,
      local_port INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      expires_at TEXT NOT NULL
    )
  `);

  // Migrate existing table (add missing columns gracefully)
  try { await db.exec("ALTER TABLE licenses ADD COLUMN requested_slug TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE licenses ADD COLUMN custom_domain TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE licenses ADD COLUMN wireguard_ip TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE licenses ADD COLUMN local_port INTEGER"); } catch (e) {}

  // 3. Table activated_devices
  await db.exec(`
    CREATE TABLE IF NOT EXISTS activated_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_id INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      activated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (license_id) REFERENCES licenses (id) ON DELETE CASCADE,
      UNIQUE(license_id, device_id)
    )
  `);

  // 4. Table pricing_plans
  await db.exec(`
    CREATE TABLE IF NOT EXISTS pricing_plans (
      id TEXT PRIMARY KEY,
      product_id TEXT DEFAULT 'gform-orkestrator',
      title TEXT NOT NULL,
      price TEXT NOT NULL,
      duration TEXT NOT NULL,
      device_limit INTEGER NOT NULL,
      is_unlimited INTEGER DEFAULT 0,
      badge TEXT
    )
  `);

  // 5. Table license_logs (Audit Trail)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS license_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT,
      product_id TEXT,
      device_id TEXT,
      ip_address TEXT,
      status TEXT,
      timestamp TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 6. Table invoices
  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      license_id INTEGER,
      school_name TEXT NOT NULL,
      product_id TEXT NOT NULL,
      plan_title TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT DEFAULT 'unpaid',
      payment_method TEXT DEFAULT 'QRIS',
      payment_reference TEXT,
      qr_url TEXT,
      pay_code TEXT,
      payment_instructions TEXT,
      expired_time INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      paid_at TEXT,
      FOREIGN KEY (license_id) REFERENCES licenses (id) ON DELETE SET NULL
    )
  `);

  // 7. Table subscriptions
  await db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_id INTEGER NOT NULL UNIQUE,
      school_name TEXT NOT NULL,
      product_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      start_date TEXT,
      end_date TEXT,
      auto_renew INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (license_id) REFERENCES licenses (id) ON DELETE CASCADE
    )
  `);

  // 8. Table system_settings
  await db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Dynamic migrations/upgrades
  try {
    await db.exec("ALTER TABLE licenses ADD COLUMN product_id TEXT DEFAULT 'gform-orkestrator'");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE pricing_plans ADD COLUMN product_id TEXT DEFAULT 'gform-orkestrator'");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE licenses ADD COLUMN is_unlimited INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE pricing_plans ADD COLUMN is_unlimited INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE licenses ADD COLUMN plan_id TEXT");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE invoices ADD COLUMN payment_reference TEXT");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE invoices ADD COLUMN qr_url TEXT");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE invoices ADD COLUMN pay_code TEXT");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE invoices ADD COLUMN payment_instructions TEXT");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE invoices ADD COLUMN expired_time INTEGER");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE licenses ADD COLUMN requested_slug TEXT");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE licenses ADD COLUMN requested_supabase_url TEXT");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE licenses ADD COLUMN requested_supabase_anon_key TEXT");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE licenses ADD COLUMN is_recovery INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE licenses ADD COLUMN include_vpn INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE invoices ADD COLUMN payment_proof TEXT");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE invoices ADD COLUMN plan_id TEXT");
  } catch (e) {}

  // Easy-Tunnel: tambah kolom local_port untuk menyimpan port aplikasi lokal setiap tunnel
  try {
    await db.exec("ALTER TABLE licenses ADD COLUMN local_port INTEGER DEFAULT 5002");
  } catch (e) {}
  // Easy-Tunnel: tambah kolom app_name untuk label nama aplikasi (e.g. 'Dapodik', 'E-Rapor')
  try {
    await db.exec("ALTER TABLE licenses ADD COLUMN app_name TEXT");
  } catch (e) {}
  // Easy-Tunnel: tambah kolom operator_phone untuk mengasosiasikan nomor WhatsApp ke lisensi
  try {
    await db.exec("ALTER TABLE licenses ADD COLUMN operator_phone TEXT");
  } catch (e) {}
  // Easy-Tunnel: tambah kolom active_hostname untuk menyimpan hostname komputer aktif
  try {
    await db.exec("ALTER TABLE licenses ADD COLUMN active_hostname TEXT");
  } catch (e) {}


  try {
    await db.exec("ALTER TABLE products ADD COLUMN key_prefix TEXT");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE products ADD COLUMN display_name TEXT");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE products ADD COLUMN capacity_label TEXT");
  } catch (e) {}

  // Migrasi kolom penunjang katalog untuk pricing_plans
  try { await db.exec("ALTER TABLE pricing_plans ADD COLUMN name TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE pricing_plans ADD COLUMN features_json TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE pricing_plans ADD COLUMN description TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE pricing_plans ADD COLUMN service_code TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE pricing_plans ADD COLUMN module_id TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE pricing_plans ADD COLUMN billing_period TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE pricing_plans ADD COLUMN price_monthly INTEGER"); } catch (e) {}
  try { await db.exec("ALTER TABLE pricing_plans ADD COLUMN price_yearly INTEGER"); } catch (e) {}
  try { await db.exec("ALTER TABLE pricing_plans ADD COLUMN size_label TEXT"); } catch (e) {}

  // Seeding/Updating Default Products
  const prodCount = await db.get('SELECT COUNT(*) as count FROM products');
  if (parseInt(prodCount.count, 10) === 0) {
    await db.run("INSERT INTO products (id, name, description, key_prefix, display_name, capacity_label) VALUES ('gform-orkestrator', 'G-Form Orkestrator', 'Sistem pengunci ujian berbasis Google Forms', 'ORK', 'G-Form Orkestrator Premium', 'Unlimited HP')");
    await db.run("INSERT INTO products (id, name, description, key_prefix, display_name, capacity_label) VALUES ('absenta', 'Absenta Premium', 'Sistem absensi berbasis AI & lokasi terpercaya', 'ABS', 'Absenta Premium (AI Absensi)', 'Multi Device HP')");
    console.log('[SEED] Registered SaaS default products.');
  } else {
    // Update existing definitions to ensure they have keys/labels populated
    await db.run("UPDATE products SET key_prefix = 'ORK', display_name = 'G-Form Orkestrator Premium', capacity_label = 'Unlimited HP' WHERE id = 'gform-orkestrator'");
    await db.run("UPDATE products SET key_prefix = 'ABS', display_name = 'Absenta Premium (AI Absensi)', capacity_label = 'Multi Device HP' WHERE id = 'absenta'");
  }

  // Ensure project-yatim product exists
  const yatimProd = await db.get("SELECT id FROM products WHERE id = 'project-yatim'");
  if (!yatimProd) {
    await db.run("INSERT INTO products (id, name, description, key_prefix, display_name, capacity_label) VALUES ('project-yatim', 'Mustahiq Care', 'Sistem Manajemen Mustahiq, Kelompok & Santunan', 'YTM', 'Mustahiq Care Premium', 'Maks. 100 Mustahiq')");
    console.log('[SEED] Registered Mustahiq Care (project-yatim) product.');
  } else {
    await db.run("UPDATE products SET key_prefix = 'YTM', display_name = 'Mustahiq Care Premium', capacity_label = 'Maks. 100 Mustahiq' WHERE id = 'project-yatim'");
  }

  // Ensure vpn-tunnel product exists
  const vpnProd = await db.get("SELECT id FROM products WHERE id = 'vpn-tunnel'");
  if (!vpnProd) {
    await db.run("INSERT INTO products (id, name, description, key_prefix, display_name, capacity_label) VALUES ('vpn-tunnel', 'VPN Tunneling', 'Layanan Online Gateway (VPN Tunnel) agar aplikasi lokal dapat diakses secara publik', 'VPN', 'VPN Tunneling Gateway', 'Bandwidth Tanpa Batas')");
    console.log('[SEED] Registered VPN Tunneling product.');
  } else {
    await db.run("UPDATE products SET key_prefix = 'VPN', display_name = 'VPN Tunneling Gateway', capacity_label = 'Bandwidth Tanpa Batas' WHERE id = 'vpn-tunnel'");
  }

  // Ensure easy-tunnel product exists
  const easyTunnelProd = await db.get("SELECT id FROM products WHERE id = 'easy-tunnel'");
  if (!easyTunnelProd) {
    await db.run("INSERT INTO products (id, name, description, key_prefix, display_name, capacity_label) VALUES ('easy-tunnel', 'Easy Tunnel', 'Layanan terowongan VPN untuk mengekspos layanan lokal (Dapodik, E-Rapor, dll) ke internet secara publik', 'ETN', 'Easy Tunnel Gateway', '1 Port per Aplikasi')");
    console.log('[SEED] Registered Easy Tunnel product.');
  } else {
    await db.run("UPDATE products SET key_prefix = 'ETN', display_name = 'Easy Tunnel Gateway', capacity_label = '1 Port per Aplikasi' WHERE id = 'easy-tunnel'");
  }

  // Ensure absenta module products exist
  const modulesToSeed = [
    { id: 'absenta-module-absensi', name: 'Modul Absensi', desc: 'Modul absensi digital dengan validasi lokasi & face recognition', prefix: 'ABS', dispName: 'Absensi Premium', capLabel: 'Akses Penuh' },
    { id: 'absenta-module-cooperative', name: 'Modul Koperasi', desc: 'Modul tabungan, pinjaman, dan kasir koperasi sekolah', prefix: 'COP', dispName: 'Koperasi Premium', capLabel: 'Akses Penuh' },
    { id: 'absenta-module-sarpras', name: 'Modul Sarpras', desc: 'Modul inventarisasi aset dan peminjaman ruang sarpras', prefix: 'SRP', dispName: 'Sarpras Premium', capLabel: 'Akses Penuh' },
    { id: 'absenta-module-hubin', name: 'Modul Hubin', desc: 'Modul penempatan, absensi, dan monitoring PKL siswa', prefix: 'HBN', dispName: 'Hubin Premium', capLabel: 'Akses Penuh' },
    { id: 'absenta-module-whatsapp', name: 'Modul WhatsApp Gateway', desc: 'Modul integrasi blast notifikasi WhatsApp real-time', prefix: 'WA', dispName: 'WhatsApp Gateway Premium', capLabel: 'Akses Penuh' }
  ];

  for (const m of modulesToSeed) {
    const existingMod = await db.get("SELECT id FROM products WHERE id = ?", [m.id]);
    if (!existingMod) {
      await db.run(
        "INSERT INTO products (id, name, description, key_prefix, display_name, capacity_label) VALUES (?, ?, ?, ?, ?, ?)",
        [m.id, m.name, m.desc, m.prefix, m.dispName, m.capLabel]
      );
      console.log(`[SEED] Registered module product: ${m.id}`);
    } else {
      await db.run(
        "UPDATE products SET key_prefix = ?, display_name = ?, capacity_label = ?, name = ?, description = ? WHERE id = ?",
        [m.prefix, m.dispName, m.capLabel, m.name, m.desc, m.id]
      );
    }
  }

  // Seeding Demo License
  const count = await db.get('SELECT COUNT(*) as count FROM licenses');
  if (parseInt(count.count, 10) === 0) {
    const demoKey = 'ORK-DEMO-TEST-KEY-2026';
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    const expiresStr = oneYearLater.toISOString().slice(0, 10);
    await db.run(
      "INSERT INTO licenses (license_key, product_id, school_name, device_limit, expires_at, status, is_active, plan_id) VALUES (?, 'gform-orkestrator', ?, ?, ?, 'active', 1, 'annual')",
      [demoKey, 'SMK Ujicoba Indonesia', 50, expiresStr]
    );
    console.log(`[SEED] Created demo license: ${demoKey} (G-Form)`);
  }

  // Ensure demo license exists for project-yatim
  const demoYatimLic = await db.get("SELECT id FROM licenses WHERE license_key = 'YATIM-DEMO-TEST-KEY-2026' AND product_id = 'project-yatim'");
  if (!demoYatimLic) {
    const tenYearsLater = new Date();
    tenYearsLater.setFullYear(tenYearsLater.getFullYear() + 10);
    const expiresStr = tenYearsLater.toISOString().slice(0, 10);
    await db.run(
      "INSERT INTO licenses (license_key, product_id, school_name, device_limit, expires_at, status, is_active, plan_id) VALUES ('YATIM-DEMO-TEST-KEY-2026', 'project-yatim', 'Madrasah Uji Coba', 0, ?, 'active', 1, 'yatim_enterprise_lifetime')",
      [expiresStr]
    );
    console.log('[SEED] Created demo license: YATIM-DEMO-TEST-KEY-2026 (Mustahiq Care)');
  }

  // Refresh Pricing Plans
  await db.run("DELETE FROM pricing_plans");
  await db.run("INSERT INTO pricing_plans (id, product_id, title, price, duration, device_limit, is_unlimited, badge) VALUES ('monthly', 'gform-orkestrator', 'Bulanan', 'Rp 299.000', '30 Hari', 0, 1, null)");
  await db.run("INSERT INTO pricing_plans (id, product_id, title, price, duration, device_limit, is_unlimited, badge) VALUES ('semester', 'gform-orkestrator', 'Semesteran', 'Rp 699.000', '180 Hari', 0, 1, 'Terpopuler')");
  await db.run("INSERT INTO pricing_plans (id, product_id, title, price, duration, device_limit, is_unlimited, badge) VALUES ('annual', 'gform-orkestrator', 'Tahunan', 'Rp 1.199.000', '365 Hari', 0, 1, 'Terbaik')");
  await db.run("INSERT INTO pricing_plans (id, product_id, title, price, duration, device_limit, is_unlimited, badge) VALUES ('absenta_monthly', 'absenta', 'Absenta Bulanan', 'Rp 99.000', '30 Hari', 30, 0, null)");
  await db.run("INSERT INTO pricing_plans (id, product_id, title, price, duration, device_limit, is_unlimited, badge) VALUES ('absenta_semester', 'absenta', 'Absenta Semester', 'Rp 450.000', '180 Hari', 150, 0, 'Terpopuler')");
  await db.run("INSERT INTO pricing_plans (id, product_id, title, price, duration, device_limit, is_unlimited, badge) VALUES ('absenta_annual', 'absenta', 'Absenta Tahunan', 'Rp 799.000', '365 Hari', 400, 0, 'Terbaik')");
  
  // Seed pricing plans for project-yatim (Mustahiq Care) - Lifetime / Beli Sekali
  await db.run("INSERT INTO pricing_plans (id, product_id, title, price, duration, device_limit, is_unlimited, badge) VALUES ('yatim_basic_lifetime', 'project-yatim', 'Mustahiq Care Basic (Lifetime)', 'Rp 999.000', 'Selamanya', 100, 0, null)");
  await db.run("INSERT INTO pricing_plans (id, product_id, title, price, duration, device_limit, is_unlimited, badge) VALUES ('yatim_pro_lifetime', 'project-yatim', 'Mustahiq Care Pro (Lifetime)', 'Rp 1.999.000', 'Selamanya', 500, 0, 'Terpopuler')");
  await db.run("INSERT INTO pricing_plans (id, product_id, title, price, duration, device_limit, is_unlimited, badge) VALUES ('yatim_enterprise_lifetime', 'project-yatim', 'Mustahiq Care Enterprise (Lifetime)', 'Rp 4.999.000', 'Selamanya', 0, 1, 'Terbaik')");
  
  // Seed pricing plans for vpn-tunnel
  await db.run("INSERT INTO pricing_plans (id, product_id, title, price, duration, device_limit, is_unlimited, badge) VALUES ('vpn_monthly', 'vpn-tunnel', 'VPN Tunneling Bulanan', 'Rp 50.000', '30 Hari', 1, 0, null)");
  await db.run("INSERT INTO pricing_plans (id, product_id, title, price, duration, device_limit, is_unlimited, badge) VALUES ('vpn_semester', 'vpn-tunnel', 'VPN Tunneling Semester', 'Rp 250.000', '180 Hari', 1, 0, 'Terpopuler')");
  await db.run("INSERT INTO pricing_plans (id, product_id, title, price, duration, device_limit, is_unlimited, badge) VALUES ('vpn_annual', 'vpn-tunnel', 'VPN Tunneling Tahunan', 'Rp 480.000', '365 Hari', 1, 0, 'Terbaik')");

  // Seed pricing plans for easy-tunnel (Rp 50.000/bulan per port/aplikasi)
  await db.run("INSERT INTO pricing_plans (id, product_id, title, price, duration, device_limit, is_unlimited, badge) VALUES ('easy_tunnel_monthly', 'easy-tunnel', 'Easy Tunnel Bulanan', 'Rp 50.000', '30 Hari', 1, 0, null)");
  await db.run("INSERT INTO pricing_plans (id, product_id, title, price, duration, device_limit, is_unlimited, badge) VALUES ('easy_tunnel_semester', 'easy-tunnel', 'Easy Tunnel Semester', 'Rp 250.000', '180 Hari', 1, 0, 'Hemat 17%')");
  await db.run("INSERT INTO pricing_plans (id, product_id, title, price, duration, device_limit, is_unlimited, badge) VALUES ('easy_tunnel_annual', 'easy-tunnel', 'Easy Tunnel Tahunan', 'Rp 480.000', '365 Hari', 1, 0, 'Terbaik')");

  // Seeding pricing plans untuk modul-modul Absenta
  const modulePlans = [
    {
      id: 'absensi_monthly',
      pid: 'absenta-module-absensi',
      title: 'Absensi Bulanan',
      price: 'Rp 49.000',
      dur: '30 Hari',
      name: 'Absensi Bulanan (Standard)',
      desc: 'Solusi Absensi digital skala Standard.',
      features: ['Absensi Datang & Pulang (GPS/Radius)', 'Face Recognition & Liveness Detection', 'Persetujuan Izin & Cuti via App', 'Laporan Kehadiran Harian & Bulanan'],
      scode: 'ABSENSI',
      mid: 'ABSENSI',
      period: 'MONTH',
      pm: 49000,
      py: 490000,
      size: 'Standard'
    },
    {
      id: 'absensi_annual',
      pid: 'absenta-module-absensi',
      title: 'Absensi Tahunan',
      price: 'Rp 499.000',
      dur: '365 Hari',
      name: 'Absensi Tahunan (Standard)',
      desc: 'Solusi Absensi digital skala Standard.',
      features: ['Absensi Datang & Pulang (GPS/Radius)', 'Face Recognition & Liveness Detection', 'Persetujuan Izin & Cuti via App', 'Laporan Kehadiran Harian & Bulanan'],
      scode: 'ABSENSI',
      mid: 'ABSENSI',
      period: 'YEAR',
      pm: 41583,
      py: 499000,
      size: 'Standard',
      badge: 'Terbaik'
    },
    {
      id: 'cooperative_monthly',
      pid: 'absenta-module-cooperative',
      title: 'Koperasi Bulanan',
      price: 'Rp 99.000',
      dur: '30 Hari',
      name: 'Koperasi Bulanan (Standard)',
      desc: 'Solusi Koperasi sekolah skala Standard.',
      features: ['Manajemen Anggota & Tabungan Siswa', 'Sistem Pinjaman & Angsuran Otomatis', 'Kasir / POS (Point of Sale) Koperasi', 'Laporan Keuangan & SHU (Sisa Hasil Usaha)', 'Manajemen Stok & Inventaris Toko'],
      scode: 'KOPERASI',
      mid: 'KOPERASI',
      period: 'MONTH',
      pm: 99000,
      py: 990000,
      size: 'Standard'
    },
    {
      id: 'cooperative_annual',
      pid: 'absenta-module-cooperative',
      title: 'Koperasi Tahunan',
      price: 'Rp 999.000',
      dur: '365 Hari',
      name: 'Koperasi Tahunan (Standard)',
      desc: 'Solusi Koperasi sekolah skala Standard.',
      features: ['Manajemen Anggota & Tabungan Siswa', 'Sistem Pinjaman & Angsuran Otomatis', 'Kasir / POS (Point of Sale) Koperasi', 'Laporan Keuangan & SHU (Sisa Hasil Usaha)', 'Manajemen Stok & Inventaris Toko'],
      scode: 'KOPERASI',
      mid: 'KOPERASI',
      period: 'YEAR',
      pm: 83250,
      py: 999000,
      size: 'Standard',
      badge: 'Terbaik'
    },
    {
      id: 'sarpras_monthly',
      pid: 'absenta-module-sarpras',
      title: 'Sarpras Bulanan',
      price: 'Rp 79.000',
      dur: '30 Hari',
      name: 'Sarpras Bulanan (Standard)',
      desc: 'Solusi Sarana Prasarana skala Standard.',
      features: ['Manajemen Inventaris Aset Sekolah', 'Sistem Peminjaman Ruang & Lab', 'Monitoring Perbaikan & Maintenance', 'Audit Aset Berbasis Lokasi (QR Code)'],
      scode: 'SARPRAS',
      mid: 'SARPRAS',
      period: 'MONTH',
      pm: 79000,
      py: 790000,
      size: 'Standard'
    },
    {
      id: 'sarpras_annual',
      pid: 'absenta-module-sarpras',
      title: 'Sarpras Tahunan',
      price: 'Rp 799.000',
      dur: '365 Hari',
      name: 'Sarpras Tahunan (Standard)',
      desc: 'Solusi Sarana Prasarana skala Standard.',
      features: ['Manajemen Inventaris Aset Sekolah', 'Sistem Peminjaman Ruang & Lab', 'Monitoring Perbaikan & Maintenance', 'Audit Aset Berbasis Lokasi (QR Code)'],
      scode: 'SARPRAS',
      mid: 'SARPRAS',
      period: 'YEAR',
      pm: 66583,
      py: 799000,
      size: 'Standard',
      badge: 'Terbaik'
    },
    {
      id: 'hubin_monthly',
      pid: 'absenta-module-hubin',
      title: 'Hubin Bulanan',
      price: 'Rp 59.000',
      dur: '30 Hari',
      name: 'Hubin Bulanan (Standard)',
      desc: 'Solusi Hubungan Industri & PKL skala Standard.',
      features: ['Manajemen Mitra Industri (DU/DI)', 'Penempatan & Monitoring PKL Siswa', 'Jurnal PKL Digital (Input di Lokasi)', 'Absensi PKL Berbasis Geofencing'],
      scode: 'HUBIN',
      mid: 'HUBIN',
      period: 'MONTH',
      pm: 59000,
      py: 590000,
      size: 'Standard'
    },
    {
      id: 'hubin_annual',
      pid: 'absenta-module-hubin',
      title: 'Hubin Tahunan',
      price: 'Rp 599.000',
      dur: '365 Hari',
      name: 'Hubin Tahunan (Standard)',
      desc: 'Solusi Hubungan Industri & PKL skala Standard.',
      features: ['Manajemen Mitra Industri (DU/DI)', 'Penempatan & Monitoring PKL Siswa', 'Jurnal PKL Digital (Input di Lokasi)', 'Absensi PKL Berbasis Geofencing'],
      scode: 'HUBIN',
      mid: 'HUBIN',
      period: 'YEAR',
      pm: 49916,
      py: 599000,
      size: 'Standard',
      badge: 'Terbaik'
    },
    {
      id: 'whatsapp_monthly',
      pid: 'absenta-module-whatsapp',
      title: 'WhatsApp Gateway Bulanan',
      price: 'Rp 39.000',
      dur: '30 Hari',
      name: 'WhatsApp Gateway Bulanan (Standard)',
      desc: 'Solusi WhatsApp Gateway skala Standard.',
      features: ['Notifikasi Kehadiran Otomatis (Real-time)', 'Laporan Harian & Bulanan via WhatsApp', 'Sistem Blast Pengumuman Seluruh Sekolah', 'Integrasi Notifikasi Koperasi & Sarpras'],
      scode: 'WHATSAPP',
      mid: 'WHATSAPP',
      period: 'MONTH',
      pm: 39000,
      py: 390000,
      size: 'Standard'
    },
    {
      id: 'whatsapp_annual',
      pid: 'absenta-module-whatsapp',
      title: 'WhatsApp Gateway Tahunan',
      price: 'Rp 399.000',
      dur: '365 Hari',
      name: 'WhatsApp Gateway Tahunan (Standard)',
      desc: 'Solusi WhatsApp Gateway skala Standard.',
      features: ['Notifikasi Kehadiran Otomatis (Real-time)', 'Laporan Harian & Bulanan via WhatsApp', 'Sistem Blast Pengumuman Seluruh Sekolah', 'Integrasi Notifikasi Koperasi & Sarpras'],
      scode: 'WHATSAPP',
      mid: 'WHATSAPP',
      period: 'YEAR',
      pm: 33250,
      py: 399000,
      size: 'Standard',
      badge: 'Terbaik'
    }
  ];

  for (const p of modulePlans) {
    await db.run(
      "INSERT INTO pricing_plans (id, product_id, title, price, duration, device_limit, is_unlimited, badge, name, description, features_json, service_code, module_id, billing_period, price_monthly, price_yearly, size_label) VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [p.id, p.pid, p.title, p.price, p.dur, p.badge || null, p.name, p.desc, JSON.stringify(p.features), p.scode, p.mid, p.period, p.pm, p.py, p.size]
    );
  }

  console.log('[SEED] Premium school-grade pricing plans seeded/refreshed successfully.');

  // Seeding System Settings
  const settingsCount = await db.get('SELECT COUNT(*) as count FROM system_settings');
  if (parseInt(settingsCount.count, 10) === 0) {
    await db.run("INSERT INTO system_settings (key, value) VALUES ('active_gateway', 'tripay')");
    await db.run("INSERT INTO system_settings (key, value) VALUES ('manual_payment_enabled', '1')");
    await db.run("INSERT INTO system_settings (key, value) VALUES ('manual_bank_name', 'BCA')");
    await db.run("INSERT INTO system_settings (key, value) VALUES ('manual_account_number', '8123-049-182')");
    await db.run("INSERT INTO system_settings (key, value) VALUES ('manual_account_name', 'Baraya Teknologi')");
    await db.run("INSERT INTO system_settings (key, value) VALUES ('whatsapp_number', '6287779937341')");
    console.log('[SEED] Default system settings registered successfully.');
  }

  // Sync historical licenses
  try {
    const activeLicenses = await db.all("SELECT * FROM licenses");
    for (const lic of activeLicenses) {
      let planId = lic.plan_id;
      if (!planId) {
        planId = lic.is_unlimited === 1 ? 'annual' : 'monthly';
        await db.run("UPDATE licenses SET plan_id = ? WHERE id = ?", [planId, lic.id]);
      }
      const sub = await db.get("SELECT * FROM subscriptions WHERE license_id = ?", [lic.id]);
      if (!sub) {
        const status = lic.status === 'active' ? 'active' : (lic.status === 'expired' ? 'expired' : 'pending');
        const startDate = lic.status === 'active' ? lic.created_at : null;
        const endDate = lic.status === 'active' ? lic.expires_at : null;
        await db.run(
          "INSERT INTO subscriptions (license_id, school_name, product_id, plan_id, status, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [lic.id, lic.school_name, lic.product_id || 'gform-orkestrator', planId, status, startDate, endDate]
        );
      }
      const inv = await db.get("SELECT * FROM invoices WHERE license_id = ?", [lic.id]);
      if (!inv) {
        const plan = await db.get("SELECT * FROM pricing_plans WHERE id = ?", [planId]) || { title: 'Bulanan', price: 'Rp 299.000' };
        const amount = parseInt(plan.price.replace(/[^\d]/g, ''), 10) || 299000;
        const status = lic.status === 'active' ? 'paid' : (lic.status === 'expired' ? 'failed' : 'unpaid');
        const paidAt = lic.status === 'active' ? lic.created_at : null;
        const invNum = `INV-ORK-${lic.id}-${new Date().getFullYear()}`;
        await db.run(
          "INSERT INTO invoices (invoice_number, license_id, school_name, product_id, plan_title, amount, status, payment_method, created_at, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [invNum, lic.id, lic.school_name, lic.product_id || 'gform-orkestrator', plan.title, amount, status, 'Manual', lic.created_at, paidAt]
        );
      }
    }
    console.log('[MIGRATION] Historical licenses, subscriptions, and invoices synced.');
  } catch (err) {
    console.error('[MIGRATION ERROR]', err);
  }

  console.log('[DATABASE] Database initialization completed.');
  return db;
}

module.exports = {
  db,
  initDatabase
};
