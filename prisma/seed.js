const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MODULE_BLUEPRINTS = {
  'ABSENSI-SIMPLE': [
    'Absensi Datang & Pulang (GPS/Radius)',
    'Face Recognition & Liveness Detection',
    'Persetujuan Izin & Cuti via App',
    'Notifikasi WhatsApp Otomatis ke Orang Tua',
    'Laporan Kehadiran Harian & Bulanan',
    'Manajemen Jam Kerja & Kalender Sekolah'
  ],
  'ABSENSI-MULTI_SESI': [
    'Absensi Per Mata Pelajaran (KBM)',
    'Jurnal Mengajar Guru Digital',
    'Monitoring KBM Real-time (Siswa Bolos)',
    'Notifikasi WhatsApp Per Jam Pelajaran',
    'Rekap Kehadiran Per Mapel & Guru',
    'Integrasi Jadwal Kurikulum Otomatis'
  ],
  'KOPERASI': [
    'Manajemen Anggota & Tabungan Siswa',
    'Sistem Pinjaman & Angsuran Otomatis',
    'Kasir / POS (Point of Sale) Koperasi',
    'Laporan Keuangan & SHU (Sisa Hasil Usaha)',
    'Manajemen Stok & Inventaris Toko',
    'PPOB (Pulsa, Listrik, Paket Data)'
  ],
  'SARPRAS': [
    'Manajemen Inventaris Aset Sekolah',
    'Sistem Peminjaman Ruang & Lab',
    'Monitoring Perbaikan & Maintenance',
    'Audit Aset Berbasis Lokasi (QR Code)',
    'Laporan Penyusutan Nilai Aset'
  ],
  'HUBIN': [
    'Manajemen Mitra Industri (DU/DI)',
    'Penempatan & Monitoring PKL Siswa',
    'Jurnal PKL Digital (Input di Lokasi)',
    'Absensi PKL Berbasis Geofencing',
    'Laporan Evaluasi Pembimbing Industri'
  ],
  'WHATSAPP': [
    'Notifikasi Kehadiran Otomatis (Real-time)',
    'Laporan Harian & Bulanan via WhatsApp',
    'Sistem Blast Pengumuman Seluruh Sekolah',
    'Integrasi Notifikasi Koperasi & Sarpras',
    'Dashboard Monitoring Status Pengiriman Pesan',
    'Support Custom API Gateway (Fonnte/WoWA/dll)'
  ],
  'PAKET_LENGKAP-SIMPLE': [
    'Akses Seluruh Modul (PAKET LENGKAP SIMPLE)',
    'Integrasi WhatsApp Notifikasi Otomatis',
    'Prioritas Dukungan Teknis 24/7',
    'Update Fitur Terbaru Secara Otomatis',
    'Backup Data Harian & Keamanan Berlapis'
  ],
  'PAKET_LENGKAP-MULTI_SESI': [
    'Akses Seluruh Modul (PAKET LENGKAP MULTI)',
    'Integrasi WhatsApp Notifikasi Otomatis',
    'Prioritas Dukungan Teknis 24/7',
    'Update Fitur Terbaru Secara Otomatis',
    'Backup Data Harian & Keamanan Berlapis'
  ]
};

const TIERS = [
  { label: 'Micro', max_user: 100, tier: 'BASIC' },
  { label: 'Small', max_user: 300, tier: 'BASIC' },
  { label: 'Medium', max_user: 600, tier: 'STANDARD' },
  { label: 'Large', max_user: 1200, tier: 'ENTERPRISE' },
  { label: 'Enterprise', max_user: 0, tier: 'ULTIMATE' },
];

const MODULE_CONFIGS = [
  { id: 'ABSENSI', name: 'Absensi Simple', mode: 'SIMPLE' },
  { id: 'ABSENSI', name: 'Absensi Multi Sesi', mode: 'MULTI_SESI' },
  { id: 'KOPERASI', name: 'Koperasi Sekolah', mode: 'SIMPLE' },
  { id: 'SARPRAS', name: 'Inventory Sekolah', mode: 'SIMPLE' },
  { id: 'HUBIN', name: 'Hubungan Industri', mode: 'SIMPLE' },
  { id: 'WHATSAPP', name: 'WhatsApp Service', mode: 'SIMPLE' },
  { id: 'PAKET_LENGKAP_SIMPLE', name: 'PAKET LENGKAP SIMPLE', mode: 'SIMPLE' },
  { id: 'PAKET_LENGKAP_MULTI', name: 'PAKET LENGKAP MULTI', mode: 'MULTI_SESI' },
];

const PRICING_MATRIX = {
  'ABSENSI-SIMPLE': { 'Micro': 100000, 'Small': 250000, 'Medium': 450000, 'Large': 750000, 'Enterprise': 1500000 },
  'ABSENSI-MULTI_SESI': { 'Micro': 200000, 'Small': 450000, 'Medium': 750000, 'Large': 1250000, 'Enterprise': 2500000 },
  'KOPERASI': { 'Micro': 150000, 'Small': 300000, 'Medium': 500000, 'Large': 850000, 'Enterprise': 1750000 },
  'SARPRAS': { 'Micro': 25000, 'Small': 50000, 'Medium': 100000, 'Large': 200000, 'Enterprise': 350000 },
  'HUBIN': { 'Micro': 20000, 'Small': 40000, 'Medium': 75000, 'Large': 150000, 'Enterprise': 250000 },
  'WHATSAPP': { 'Micro': 20000, 'Small': 40000, 'Medium': 75000, 'Large': 150000, 'Enterprise': 250000 },
  'PAKET_LENGKAP-SIMPLE': { 'Micro': 199000, 'Small': 499000, 'Medium': 899000, 'Large': 1599000, 'Enterprise': 2999000 },
  'PAKET_LENGKAP-MULTI_SESI': { 'Micro': 299000, 'Small': 599000, 'Medium': 1099000, 'Large': 1999000, 'Enterprise': 3999000 }
};

const toPlanCode = (name) => {
  return String(name || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

async function main() {
  console.log('🌱 Starting database seeding for central License Server...');

  // 1. Seed Product
  console.log('📦 Seeding Product...');
  await prisma.product.upsert({
    where: { id: 'absenta' },
    update: { name: 'Absenta', prefix: 'ABS' },
    create: { id: 'absenta', name: 'Absenta', prefix: 'ABS' }
  });

  // 2. Seed CORE_PLATFORM Plan
  console.log('🎫 Seeding Plan CORE_PLATFORM...');
  await prisma.plan.upsert({
    where: { id: 'CORE_PLATFORM' },
    update: {
      productId: 'absenta',
      name: 'CORE_PLATFORM',
      priceMonthly: 0,
      priceYearly: 0,
      deviceLimit: 0,
      featuresJson: [],
      billingPeriod: 'MONTH',
      isActive: true,
      moduleId: 'CORE',
      serviceCode: 'CORE'
    },
    create: {
      id: 'CORE_PLATFORM',
      productId: 'absenta',
      name: 'CORE_PLATFORM',
      priceMonthly: 0,
      priceYearly: 0,
      deviceLimit: 0,
      featuresJson: [],
      billingPeriod: 'MONTH',
      isActive: true,
      moduleId: 'CORE',
      serviceCode: 'CORE'
    }
  });

  // 3. Seed Academic Core Plans
  console.log('🎓 Seeding Academic Core Plans...');
  const academicPlans = [
    { id: 'ACADEMIC_MICRO_TAHUNAN', name: 'Academic Core (Micro) - Tahunan', max_user: 100 },
    { id: 'ACADEMIC_SMALL_TAHUNAN', name: 'Academic Core (Small) - Tahunan', max_user: 300 },
    { id: 'ACADEMIC_MEDIUM_TAHUNAN', name: 'Academic Core (Medium) - Tahunan', max_user: 600 },
    { id: 'ACADEMIC_LARGE_TAHUNAN', name: 'Academic Core (Large) - Tahunan', max_user: 1200 },
    { id: 'ACADEMIC_ENTERPRISE_TAHUNAN', name: 'Academic Core (Enterprise) - Tahunan', max_user: 0 }
  ];

  for (const plan of academicPlans) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: {
        productId: 'absenta',
        name: plan.name,
        priceMonthly: 0,
        priceYearly: 0,
        deviceLimit: plan.max_user,
        featuresJson: [],
        billingPeriod: 'YEAR',
        isActive: true,
        moduleId: 'CORE',
        serviceCode: 'CORE'
      },
      create: {
        id: plan.id,
        productId: 'absenta',
        name: plan.name,
        priceMonthly: 0,
        priceYearly: 0,
        deviceLimit: plan.max_user,
        featuresJson: [],
        billingPeriod: 'YEAR',
        isActive: true,
        moduleId: 'CORE',
        serviceCode: 'CORE'
      }
    });
  }

  // 4. Seed Premium Plans Matrix
  console.log('💎 Seeding Premium Plans Matrix...');
  for (const mod of MODULE_CONFIGS) {
    const featureKey = mod.id === 'ABSENSI' ? `ABSENSI-${mod.mode}` : (mod.id.startsWith('PAKET_LENGKAP') ? `PAKET_LENGKAP-${mod.mode}` : mod.id);
    let features = MODULE_BLUEPRINTS[featureKey] || [];

    if (mod.id.startsWith('PAKET_LENGKAP')) {
      const baseFeatures = ['KOPERASI', 'SARPRAS', 'HUBIN', 'WHATSAPP'];
      const attendanceFeature = `ABSENSI-${mod.mode}`;
      features = [...baseFeatures, attendanceFeature, ...features];
    }

    const modPrices = PRICING_MATRIX[featureKey] || {};

    for (const tier of TIERS) {
      const baseMonthlyPrice = modPrices[tier.label] || 0;
      const yearlyPrice = Math.round(baseMonthlyPrice * 12 * 0.8);

      for (const billingPeriod of ['MONTH', 'YEAR']) {
        const periodLabel = billingPeriod === 'YEAR' ? 'Tahunan' : 'Bulanan';
        const planName = `${mod.name} (${tier.label}) - ${periodLabel}`;
        const planId = toPlanCode(planName);

        const data = {
          productId: 'absenta',
          name: planName,
          priceMonthly: billingPeriod === 'YEAR' ? Math.round(yearlyPrice / 12) : baseMonthlyPrice,
          priceYearly: yearlyPrice,
          deviceLimit: tier.max_user,
          featuresJson: features,
          billingPeriod: billingPeriod,
          isActive: true,
          moduleId: mod.id.startsWith('PAKET_LENGKAP') ? 'PAKET_LENGKAP' : mod.id,
          serviceCode: mod.id
        };

        await prisma.plan.upsert({
          where: { id: planId },
          update: data,
          create: { id: planId, ...data }
        });
      }
    }
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
