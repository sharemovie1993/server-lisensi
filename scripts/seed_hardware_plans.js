const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedHardware() {
  console.log('Seeding hardware products and plans into Server Lisensi DB...');

  // 1. Pastikan product "cakola" sudah ada
  const cakolaProduct = await prisma.product.findUnique({ where: { id: 'cakola' } });
  if (!cakolaProduct) {
    await prisma.product.create({ data: { id: 'cakola', name: 'Cakola Platform', prefix: 'CKL' } });
  }

  // Hapus plan legacy / duplikat yang tidak valid
  await prisma.plan.deleteMany({
    where: {
      OR: [
        { id: { in: ['HW_RFID_LAN_BUDGET_ETH', 'HW_FACE_ZKTECO_MB20', 'BUNDLE_HYBRID_HYDRA', 'BUNDLE_FULL_RFID_VELOX', 'BUNDLE_FULL_RAKITAN_LAN', 'HW_FP_HIKVISION_K1T804', 'HW_FP_HIKVISION_804_OLD'] } },
        { name: { contains: 'Hikvision DS-K1T804 Fingerprint & RFID Terminal' } }
      ]
    }
  });

  // 2. Hardware and Server Plans Catalog (Structured Computer Specifications)
  const plans = [
    // --- DELL POWEREDGE BUILD-UP SERVER TIERS ---
    {
      id: 'HW_SERVER_DELL_T40',
      productId: 'cakola',
      name: 'Server Dell T40 16GB (300 Siswa)',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 8500000,
      weightGrams: 8500,
      deviceLimit: 300,
      featuresJson: [
        "Socket & Chipset: Socket LGA1151 (Intel C246 Server Chipset)",
        "CPU: Intel Xeon E-2224G 4-Core / 4-Thread (Socket LGA1151, up to 4.70 GHz)",
        "Memory: 16GB (2x8GB) DDR4-2666MHz ECC Unbuffered Server RAM",
        "Storage: 256GB NVMe PCIe SSD + 1TB Enterprise SATA 7.2K HDD",
        "Garansi & OS: Garansi 1 Tahun + Pre-configured Ubuntu Server 22.04 LTS"
      ],
      techSpecsJson: {
        sasis: "Dell PowerEdge T40 Mini-Tower OEM Chassis",
        socket: "Socket LGA1151 (Intel Xeon E-2200 Series)",
        cpu: "Intel Xeon E-2224G 4-Core / 4-Thread (LGA1151, 3.5GHz - 4.7GHz, 8MB Cache)",
        cpu_brand: "Dell Factory Installed / Intel Box",
        motherboard: "Dell Proprietary LGA1151 Motherboard (Intel C246 Chipset)",
        motherboard_brand: "Dell Inc. (Garansi Vendor 1 Tahun)",
        ram: "16GB (2x8GB) DDR4 2666MHz ECC UDIMM",
        ram_brand: "Dell Certified Micron / SK Hynix ECC UDIMM",
        storage: "256GB NVMe SSD System + 1TB 3.5\" SATA 7.2K RPM Enterprise HDD",
        storage_brand: "Samsung / Western Digital Enterprise",
        psu: "Dell 300W Bronze Certified Proprietary Power Supply",
        psu_brand: "Dell Inc. OEM PSU",
        nic: "Intel I219-LM Single Gigabit Ethernet Controller",
        nic_brand: "Onboard Dell T40 NIC",
        cooler: "Dell Factory Aluminum Heatsink & Chassis Fan",
        cooler_brand: "Dell Inc. OEM Air Cooling",
        bios_checklist: [
          "Restore AC Power Loss = LAST / ON (Otomatis Nyala Usai Mati PLN)",
          "Intel VT-x / VT-d Virtualization = ENABLED",
          "Ubuntu Server 22.04 LTS + Absenta Node Engine + WireGuard VPN"
        ]
      },
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'SERVER_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_SERVER_DELL_T150',
      productId: 'cakola',
      name: 'Server Dell T150 16GB (600 Siswa)',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 16500000,
      weightGrams: 11500,
      deviceLimit: 600,
      featuresJson: [
        "Socket & Chipset: Socket LGA1200 (Intel C256 Server Chipset)",
        "CPU: Intel Xeon E-2314 4-Core / 4-Thread (Socket LGA1200, 2.8GHz - 4.5GHz BNIB)",
        "Memory: 16GB DDR4-3200MHz ECC Unbuffered Server RAM",
        "Storage: 512GB Enterprise NVMe PCIe 4.0 SSD High-Speed",
        "Garansi & OS: Garansi Resmi Dell Indonesia 3 Tahun Next Business Day"
      ],
      techSpecsJson: {
        sasis: "Dell PowerEdge T150 Tower Chassis (3.5\" Cabled HDDs)",
        socket: "Socket LGA1200 (Intel Xeon E-2300 Series)",
        cpu: "Intel Xeon E-2314 4-Core / 4-Thread (LGA1200, 2.8GHz - 4.5GHz, 8MB Cache)",
        cpu_brand: "Dell Official / Intel Box BNIB (Garansi Resmi 3 Thn)",
        motherboard: "Dell PowerEdge T150 Motherboard (Intel C256 Chipset)",
        motherboard_brand: "Dell Indonesia / PT. Synnex Metrodata",
        ram: "16GB DDR4 3200MHz ECC UDIMM",
        ram_brand: "Dell Certified SK Hynix / Micron ECC UDIMM",
        storage: "512GB Enterprise NVMe PCIe 4.0 SSD",
        storage_brand: "Dell Official Enterprise SSD / Samsung PM9A1",
        psu: "Dell 300W Cabled PSU 80+ Bronze",
        psu_brand: "Dell OEM PSU",
        nic: "Dual 1GbE Onboard LAN LOM (Broadcom/Intel)",
        nic_brand: "Broadcom BCM5720 Dual Port 1GbE",
        cooler: "Dell PowerEdge T150 Active Air Cooling System",
        cooler_brand: "Dell OEM Enterprise Fan",
        bios_checklist: [
          "Restore AC Power Loss = ALWAYS ON (iDRAC9 Power Management)",
          "Intel VT-x Virtualization = ENABLED",
          "Ubuntu Server 22.04 LTS + Absenta Node Engine + WireGuard VPN"
        ]
      },
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'SERVER_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_SERVER_DELL_T150_ENT',
      productId: 'cakola',
      name: 'Server Dell T150 Enterprise Solution (600 Siswa)',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 23100000,
      weightGrams: 11500,
      deviceLimit: 600,
      featuresJson: [
        "Paket Solusi Terpadu: Perangkat Server Dell T150 + Dedicated Managed Support 3 Tahun",
        "CPU: Intel Xeon E-2314 4-Core / 4-Thread (Socket LGA1200, 2.8GHz - 4.5GHz)",
        "Memory: 16GB DDR4-3200MHz ECC Unbuffered Server RAM",
        "Storage: 512GB Enterprise NVMe PCIe 4.0 SSD High-Speed",
        "Dukungan Khusus: Pre-configured WireGuard VPN Node + Backup Vault Auto-Sync"
      ],
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'SERVER_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_SERVER_DELL_T150_PRO',
      productId: 'cakola',
      name: 'Server Dell T150 Pro 32GB (1.200 Siswa)',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 22500000,
      weightGrams: 12000,
      deviceLimit: 1200,
      featuresJson: [
        "Socket & Chipset: Socket LGA1200 (Intel C256 Server Chipset)",
        "CPU: Intel Xeon E-2336 6-Core / 12-Thread (Socket LGA1200, 2.9GHz - 4.8GHz)",
        "Memory: 32GB (2x16GB) DDR4-3200MHz ECC Unbuffered Server RAM",
        "Storage: 1TB Enterprise NVMe SSD + 2TB SATA 7.2K Enterprise HDD",
        "Garansi & OS: Garansi Resmi Dell Indonesia 3 Tahun NBD + iDRAC9 Basic"
      ],
      techSpecsJson: {
        sasis: "Dell PowerEdge T150 Tower Chassis",
        socket: "Socket LGA1200 (Intel Xeon E-2300 Series)",
        cpu: "Intel Xeon E-2336 6-Core / 12-Thread (LGA1200, 2.9GHz - 4.8GHz, 12MB Cache)",
        cpu_brand: "Dell Official / Intel Box BNIB (Garansi Resmi 3 Thn)",
        motherboard: "Dell PowerEdge T150 Motherboard (Intel C256 Chipset)",
        motherboard_brand: "Dell Indonesia / PT. Synnex Metrodata",
        ram: "32GB (2x16GB) DDR4 3200MHz ECC UDIMM",
        ram_brand: "Dell Certified SK Hynix / Micron ECC UDIMM",
        storage: "1TB Enterprise NVMe SSD System + 2TB 3.5\" Enterprise SATA HDD",
        storage_brand: "Dell / Seagate Exos Enterprise",
        psu: "Dell 400W Gold Efficiency Cabled PSU",
        psu_brand: "Dell OEM PSU",
        nic: "Dual 1GbE Onboard LOM (Broadcom BCM5720)",
        nic_brand: "Broadcom BCM5720 Dual Port 1GbE",
        cooler: "Dell PowerEdge Active Cooling Heatsink",
        cooler_brand: "Dell OEM System Fan",
        bios_checklist: [
          "Restore AC Power Loss = ALWAYS ON",
          "Intel VT-x Virtualization = ENABLED",
          "iDRAC9 Remote Management Setup",
          "Ubuntu Server 22.04 LTS + Absenta Node Engine + WireGuard VPN"
        ]
      },
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'SERVER_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_SERVER_DELL_R730',
      productId: 'cakola',
      name: 'Server Dell R730 64GB (2.500 Siswa)',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 18500000,
      weightGrams: 22000,
      deviceLimit: 2500,
      featuresJson: [
        "Socket & Platform: Dual Socket LGA2011-v3 (Ex-Data Center Grade A)",
        "CPU: Dual Intel Xeon E5-2670 v3 (Total 16-Core / 32-Thread, 2.3GHz - 3.1GHz)",
        "Memory: 64GB (4x16GB) DDR4 ECC Registered RDIMM High-Reliability",
        "Storage: Dual 1TB Enterprise NVMe SSD (PERC Hardware RAID-1 Redundant Mirroring)",
        "Chassis & Power: 2U Enterprise Rackmount + Dual Redundant 750W Hot-Plug PSU"
      ],
      techSpecsJson: {
        sasis: "Dell PowerEdge R730 2U Enterprise Rackmount (8x 2.5\" SAS/SATA/NVMe Hot-Plug Bays)",
        socket: "Dual Socket LGA2011-v3 (Socket R3 - Intel C610 Chipset)",
        cpu: "Dual Intel Xeon E5-2670 v3 (16-Core / 32-Thread Total, 2.3GHz - 3.1GHz, 60MB Cache Total)",
        cpu_brand: "Intel Xeon Processor E5 v3 Family (Grade A Ex-Data Center Import)",
        motherboard: "Dell PowerEdge R730 Dual Socket LGA2011-v3 Motherboard",
        motherboard_brand: "Dell Inc. (Garansi Replace 1 Tahun)",
        ram: "64GB (4x16GB) DDR4 2133MHz ECC Registered RDIMM (Quad-Channel Configured)",
        ram_brand: "Samsung / SK Hynix Enterprise ECC RDIMM",
        storage: "Dual 1TB Enterprise NVMe SSD (PERC RAID-1 Hardware Redundant Mirroring)",
        storage_brand: "Kingston KC3000 / Samsung PM9A1 1TB Enterprise NVMe",
        psu: "Dual Redundant 750W 80+ Platinum Hot-Plug Power Supplies (2x 750W)",
        psu_brand: "Dell OEM Hot-Plug PSU",
        nic: "Quad Port 1GbE Network Daughter Card (Dell Broadcom 5720 Quad Port)",
        nic_brand: "Broadcom Quad Port 1GbE NDC",
        cooler: "Dual Enterprise Server Heatsinks + 6x High-CFM Hot-Swap Redundant System Fans",
        cooler_brand: "Dell R730 High-Performance Fan Modules",
        bios_checklist: [
          "Restore AC Power Loss = ALWAYS ON (Power Management iDRAC8 Enterprise)",
          "Intel VT-x / VT-d Virtualization = ENABLED",
          "PERC Hardware RAID-1 SSD Mirroring Active",
          "iDRAC8 Enterprise Dedicated Remote Management IP Active",
          "Ubuntu Server 22.04 LTS + Absenta Node Engine + WireGuard VPN"
        ]
      },
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'SERVER_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_SERVER_DELL_R750',
      productId: 'cakola',
      name: 'Server Dell R750 Enterprise 64GB (5.000+ Siswa)',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 48500000,
      weightGrams: 25000,
      deviceLimit: 4000,
      featuresJson: [
        "Socket & Platform: Dual Socket LGA4189 (Intel 3rd Gen Xeon Scalable Ice Lake BNIB)",
        "CPU: Dual Intel Xeon Silver 4310 (Total 24-Core / 48-Thread, 2.1GHz - 3.3GHz)",
        "Memory: 64GB (4x16GB) DDR4-3200MHz ECC Registered RDIMM",
        "Storage: Dual 1.92TB Enterprise Read-Intensive NVMe PCIe 4.0 SSD (Hardware RAID-1)",
        "Chassis & Power: 2U Enterprise Rackmount + Dual Redundant 800W Platinum Hot-Plug PSU"
      ],
      techSpecsJson: {
        sasis: "Dell PowerEdge R750 2U Enterprise Rackmount (8x 2.5\" NVMe/SAS Hot-Plug Bays)",
        socket: "Dual Socket LGA4189 (Socket P+ - Intel C620A Chipset)",
        cpu: "Dual Intel Xeon Silver 4310 (24-Core / 48-Thread Total, 2.1GHz - 3.3GHz, 36MB Cache)",
        cpu_brand: "Intel Official BNIB (Garansi Resmi Dell 3 Tahun)",
        motherboard: "Dell PowerEdge R750 Dual LGA4189 Motherboard (Intel C620A)",
        motherboard_brand: "Dell Indonesia / PT. Synnex Metrodata",
        ram: "64GB (4x16GB) DDR4 3200MHz ECC RDIMM",
        ram_brand: "Dell Factory Certified SK Hynix / Micron ECC RDIMM",
        storage: "Dual 1.92TB Enterprise Read-Intensive NVMe PCIe 4.0 Hot-Plug SSD (RAID-1)",
        storage_brand: "Dell Official Enterprise NVMe SSD / Kioxia CD6",
        psu: "Dual Redundant 800W Platinum Hot-Plug Power Supplies (2x 800W 100-240V)",
        psu_brand: "Dell Official Hot-Plug Platinum PSU",
        nic: "Dual Port 10GbE SFP+ / 2.5GbE OCP 3.0 Network Card",
        nic_brand: "Intel E810-XXVDA2 / Broadcom Dual Port 10G OCP 3.0",
        cooler: "Dual High-TDP Heatpipe Server Coolers + 6x High-Performance Hot-Plug Fans",
        cooler_brand: "Dell PowerEdge High-Performance Fan Array",
        bios_checklist: [
          "Restore AC Power Loss = ALWAYS ON (iDRAC9 Enterprise Controller)",
          "Intel VT-x / VT-d Virtualization = ENABLED",
          "PERC H755 Front NVMe RAID-1 Mirroring Configured",
          "iDRAC9 Enterprise Remote Management Dedicated Port Configured",
          "Ubuntu Server 22.04 LTS + Absenta Node Engine + WireGuard VPN"
        ]
      },
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'SERVER_HARDWARE',
      serviceCode: 'cakola'
    },

    // --- ABSENTA MINI PC SERVER TIERS ---
    {
      id: 'HW_SERVER_NODE_SMALL',
      productId: 'cakola',
      name: 'Absenta Mini PC Small 8GB (300 Siswa)',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 2650000,
      weightGrams: 1500,
      deviceLimit: 300,
      featuresJson: [
        "CPU: Intel Celeron N5105 4-Core Industrial High-Efficiency",
        "Memory: 8GB High-Speed RAM",
        "Storage: 128GB NVMe SSD System Storage",
        "Network: Dual Gigabit Ethernet LAN Port 24/7",
        "Engine: Pre-configured Absenta Node & WireGuard VPN Tunnel"
      ],
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'SERVER_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_SERVER_NODE_MEDIUM',
      productId: 'cakola',
      name: 'Absenta Mini PC Medium 8GB (600 Siswa)',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 3450000,
      weightGrams: 1800,
      deviceLimit: 600,
      featuresJson: [
        "CPU: Intel N100 Alder Lake-N 4-Core (Next-Gen Efficiency)",
        "Memory: 8GB DDR5 High-Speed RAM",
        "Storage: 256GB NVMe SSD System Storage",
        "Network: Dual 2.5G LAN Port High-Throughput",
        "Engine: Pre-configured Absenta Node & Auto-sync Engine"
      ],
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'SERVER_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_SERVER_NODE_LARGE',
      productId: 'cakola',
      name: 'Absenta Mini PC Large 16GB (1.200 Siswa)',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 5500000,
      weightGrams: 2500,
      deviceLimit: 1200,
      featuresJson: [
        "Socket & Platform: Socket LGA1700 (Intel 12th/13th/14th Gen)",
        "CPU: Intel Core i3-14100 4-Core / 8-Thread (Socket LGA1700, 3.5GHz - 4.7GHz)",
        "Motherboard: ASUS TUF Gaming B760M-PLUS WIFI (Socket LGA1700, DDR4)",
        "Memory: 16GB (2x8GB) DDR4 3200MHz Kingston FURY / Corsair Vengeance",
        "Storage: 512GB M.2 NVMe PCIe 4.0 SSD (Kingston KC3000)",
        "PSU & Case: Corsair CX550 550W + Tecware Forge M Airflow Case"
      ],
      techSpecsJson: {
        sasis: "Tecware Forge M Airflow Micro-ATX Industrial Case",
        socket: "Socket LGA1700 (Intel 12th / 13th / 14th Gen)",
        cpu: "Intel Core i3-14100 4-Core / 8-Thread (LGA1700, 3.5GHz - 4.7GHz)",
        cpu_brand: "Intel Box Resmi Indonesia (Garansi 3 Tahun)",
        motherboard: "ASUS TUF Gaming B760M-PLUS WIFI (LGA1700, Dual M.2 PCIe 4.0)",
        motherboard_brand: "ASUS Indonesia / Synnex Metrodata",
        ram: "16GB (2x8GB) DDR4 3200MHz Dual-Channel",
        ram_brand: "Kingston FURY Beast DDR4 / Corsair Vengeance LPX",
        storage: "512GB M.2 NVMe PCIe 4.0 x4 High-Speed SSD",
        storage_brand: "Kingston KC3000 512GB (R/W up to 7000MB/s)",
        psu: "Corsair CX550 550W 80+ Bronze Certified Power Supply",
        psu_brand: "Corsair Indonesia (Garansi 5 Tahun)",
        nic: "Realtek 2.5Gb Ethernet Ultra-Low Latency Controller",
        nic_brand: "Onboard ASUS TUF Gaming 2.5G NIC",
        cooler: "DeepCool AG400 Single Tower Air Cooler (LGA1700 Bracket)",
        cooler_brand: "DeepCool Indonesia",
        bios_checklist: [
          "Restore AC Power Loss = ALWAYS ON (Otomatis Nyala Saat Listrik PLN Hidup)",
          "Intel VT-x Virtualization = ENABLED (Engine Docker Container)",
          "XMP Profile 1 = ENABLED (RAM 3200MHz Full Speed)",
          "Ubuntu Server 22.04 LTS + Absenta Node Engine + WireGuard VPN Auto-Tunnel"
        ]
      },
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'SERVER_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_SERVER_NODE_ENTERPRISE',
      productId: 'cakola',
      name: 'Absenta Workstation Server 32GB (2.500 Siswa)',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 12500000,
      weightGrams: 3500,
      deviceLimit: 2500,
      featuresJson: [
        "Socket & Platform: Socket LGA1700 (Intel 13th/14th Gen DDR5)",
        "CPU: Intel Core i5-13600K 14-Core / 20-Thread (Socket LGA1700)",
        "Motherboard: MSI MAG B760M MORTAR WIFI DDR5 (Socket LGA1700)",
        "Memory: 32GB (2x16GB) DDR5 5600MHz Corsair Vengeance DDR5",
        "Storage: Dual 1TB M.2 NVMe PCIe 4.0 SSD (RAID-1 Redundant Mirroring)",
        "PSU & Case: Seasonic Core GX-650 650W 80+ Gold + DeepCool CC560 Case"
      ],
      techSpecsJson: {
        sasis: "DeepCool CC560 ARGB High-Airflow Mid-Tower Case",
        socket: "Socket LGA1700 (Intel 13th / 14th Gen Core i5/i7)",
        cpu: "Intel Core i5-13600K 14-Core / 20-Thread (LGA1700, 3.5GHz - 5.1GHz)",
        cpu_brand: "Intel Box Resmi Indonesia (Garansi 3 Tahun)",
        motherboard: "MSI MAG B760M MORTAR WIFI DDR5 (LGA1700, Dual M.2, VRM 12+1+1)",
        motherboard_brand: "MSI Indonesia / PT. Nusantara Eranet",
        ram: "32GB (2x16GB) DDR5 5600MHz Dual-Channel",
        ram_brand: "Corsair Vengeance DDR5 / Kingston FURY Beast DDR5",
        storage: "Dual 1TB M.2 NVMe PCIe 4.0 SSD (RAID-1 Redundant Mirroring)",
        storage_brand: "2x Kingston KC3000 1TB NVMe PCIe 4.0",
        psu: "Seasonic Core GX-650 650W 80+ Gold Full Modular (Garansi 7 Thn)",
        psu_brand: "Seasonic Indonesia / PT. Cahaya Distribusi",
        nic: "Dual 2.5G Ethernet LAN (Realtek 2.5G Onboard + Intel I225-V PCIe Card)",
        nic_brand: "Intel I225-V Dedicated Server NIC",
        cooler: "Thermalright Peerless Assassin 120 SE Dual-Tower (LGA1700)",
        cooler_brand: "Thermalright Indonesia",
        bios_checklist: [
          "Restore AC Power Loss = ALWAYS ON (Otomatis Nyala Saat Listrik PLN Hidup)",
          "Intel VT-x Virtualization = ENABLED (Engine Docker Container)",
          "M.2 NVMe RAID-1 Mirroring Configured (Ketahanan Storage)",
          "Ubuntu Server 22.04 LTS + Absenta Node Engine + WireGuard VPN Auto-Tunnel"
        ]
      },
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'SERVER_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_SERVER_NODE_ULTRA',
      productId: 'cakola',
      name: 'Absenta Workstation Server Ultra 64GB (4.000+ Siswa)',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 22500000,
      weightGrams: 8500,
      deviceLimit: 4000,
      featuresJson: [
        "Socket & Platform: Socket LGA1700 (Intel 14th Gen DDR5 Z790)",
        "CPU: Intel Core i7-14700K 20-Core / 28-Thread (Socket LGA1700, up to 5.6GHz)",
        "Motherboard: ASUS TUF Gaming Z790-PLUS WIFI DDR5 (Socket LGA1700, Heavy VRM 16+1)",
        "Memory: 64GB (2x32GB) DDR5 5600MHz Kingston FURY Beast DDR5 Dual-Channel",
        "Storage: Dual 1TB M.2 NVMe PCIe 4.0 SSD (Samsung 980 Pro / Kingston KC3000 - RAID-1)",
        "PSU & Case: Corsair RM750x 750W 80+ Gold Full Modular + DeepCool CK560 Case"
      ],
      techSpecsJson: {
        sasis: "DeepCool CK560 High-Airflow Industrial Workstation Case",
        socket: "Socket LGA1700 (Intel 14th Gen Core i7/i9)",
        cpu: "Intel Core i7-14700K 20-Core / 28-Thread (LGA1700, 3.4GHz - 5.6GHz, 33MB Cache)",
        cpu_brand: "Intel Box Resmi Indonesia (Garansi 3 Tahun)",
        motherboard: "ASUS TUF Gaming Z790-PLUS WIFI DDR5 (LGA1700, Quad M.2, VRM 16+1 60A 24/7)",
        motherboard_brand: "ASUS Indonesia / PT. Synnex Metrodata Indonesia",
        ram: "64GB (2x32GB) DDR5 5600MHz Dual-Channel High-Speed RAM",
        ram_brand: "Kingston FURY Beast DDR5 64GB Kit (KF556C40BBK2-64)",
        storage: "Dual 1TB M.2 NVMe PCIe 4.0 SSD (RAID-1 Redundant Mirroring)",
        storage_brand: "2x Samsung 980 PRO 1TB / Kingston KC3000 1TB NVMe PCIe 4.0",
        psu: "Corsair RM750x 750W 80+ Gold Full Modular (100% Japanese 105°C Caps, Garansi 10 Thn)",
        psu_brand: "Corsair Indonesia / PT. DTG Indonesia",
        nic: "Dual 2.5G Ethernet LAN (Intel I225-V Onboard + Intel PCIe 2.5G Server Card)",
        nic_brand: "Intel Corporation Server NIC",
        cooler: "DeepCool AK620 Digital High-Performance Dual-Tower Cooler (LGA1700 Bracket)",
        cooler_brand: "DeepCool Indonesia / PT. Asia Global Suksesindo",
        bios_checklist: [
          "Restore AC Power Loss = ALWAYS ON (Otomatis Nyala Saat Listrik PLN Hidup)",
          "Intel VT-x Virtualization = ENABLED (Engine Docker Container)",
          "Intel XMP 3.0 Profile 1 = ENABLED (DDR5 5600MHz Full Speed)",
          "M.2 NVMe RAID-1 Mirroring Configured (Ketahanan Storage)",
          "Ubuntu Server 22.04 LTS + Absenta Node Engine + WireGuard VPN Auto-Tunnel"
        ]
      },
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'SERVER_HARDWARE',
      serviceCode: 'cakola'
    },

    // --- ACCESS POINT WI-FI 6 & NETWORK ---
    {
      id: 'HW_AP_TPLINK_EAP610',
      productId: 'cakola',
      name: 'TP-Link Omada EAP610 Wi-Fi 6',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 2250000,
      weightGrams: 800,
      deviceLimit: 0,
      featuresJson: [
        "Tipe AP: Enterprise Wi-Fi 6 AX1800 Dual Band",
        "Power: PoE Powered (Standard IEEE 802.3at)",
        "Kapasitas: 100+ Concurrent Classroom Users",
        "Fitur: Omada Mesh & Seamless Roaming"
      ],
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'NETWORK_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_AP_RUIJIE_AX3000',
      productId: 'cakola',
      name: 'Ruijie RG-RAP2260(G) Wi-Fi 6',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 3250000,
      weightGrams: 900,
      deviceLimit: 0,
      featuresJson: [
        "Tipe AP: Enterprise Wi-Fi 6 AX3000 High-Capacity",
        "Power & Net: PoE Powered Gigabit LAN Port",
        "Kapasitas: 150+ Concurrent Users per Room",
        "Management: Cloud Managed App + Auto RF Optimization"
      ],
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'NETWORK_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_AP_UNIFI_U6_PRO',
      productId: 'cakola',
      name: 'Ubiquiti UniFi U6 Pro Wi-Fi 6',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 4500000,
      weightGrams: 1000,
      deviceLimit: 0,
      featuresJson: [
        "Tipe AP: UniFi Enterprise Wi-Fi 6 (4x4 MIMO)",
        "Power & Net: PoE+ Powered Gigabit Port",
        "Kapasitas: High-Density Classroom 300+ Concurrent Clients",
        "Management: UniFi OS Controller Integration"
      ],
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'NETWORK_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_AP_OUTDOOR_WIFI6',
      productId: 'cakola',
      name: 'Outdoor Wi-Fi 6 AP (IP68)',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 3850000,
      weightGrams: 1400,
      deviceLimit: 0,
      featuresJson: [
        "Tipe AP: IP68 Weatherproof Outdoor Antenna",
        "Coverage: Long-Range Coverage Lapangan Upacara / Olahraga",
        "Power: PoE Powered High-Density Outdoor Users"
      ],
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'NETWORK_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_SWITCH_POE_8PORT',
      productId: 'cakola',
      name: 'Managed Switch PoE+ 8-Port 120W',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 1650000,
      weightGrams: 1200,
      deviceLimit: 0,
      featuresJson: [
        "Ports: 8 Gigabit Ports PoE IEEE 802.3af/at (120W Total Power)",
        "Fungsi: Power Supply Terpusat AP Wi-Fi & Fingerprint PoE",
        "Proteksi: Plug and Play + Surge Protection 4KV"
      ],
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'NETWORK_HARDWARE',
      serviceCode: 'cakola'
    },

    // --- RFID & FINGERPRINT TERMINALS ---
    {
      id: 'HW_RFID_MINI_OTG_ANDRO',
      productId: 'cakola',
      name: 'Mini OTG RFID Reader (Android)',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 350000,
      weightGrams: 150,
      deviceLimit: 0,
      featuresJson: [
        "Kategori: Portable RFID Reader untuk Smartphone/Tablet Guru",
        "Interface: Direct USB Type-C / Micro-USB OTG (Non-LAN)",
        "RFID Support: 13.56MHz Mifare Reader Built-in",
        "Power: Ikut Daya Baterai HP/Tablet Guru"
      ],
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'ABSENSI_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_RFID_DESKTOP_USB',
      productId: 'cakola',
      name: 'Desktop USB RFID Reader',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 250000,
      weightGrams: 200,
      deviceLimit: 0,
      featuresJson: [
        "Kategori: Scan Tap Cepat Meja Operator/TU",
        "Interface: USB Type-A Plug & Play (Non-LAN)",
        "RFID Support: 13.56MHz Mifare Reader Built-in",
        "Power: Direct USB 5V Power Supply"
      ],
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'ABSENSI_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_FP_HIKVISION_8003MF',
      productId: 'cakola',
      name: 'Hikvision DS-K1T8003MF (1.000 FP / 1.000 Card)',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 850000,
      weightGrams: 650,
      deviceLimit: 0,
      featuresJson: [
        "Kategori: Fingerprint & RFID Card Terminal LAN TCP/IP",
        "Kapasitas: 1.000 Sidik Jari | 1.000 Kartu RFID | 100.000 Log",
        "Konektivitas: LAN TCP/IP RJ45 + Support Active 12V PoE Splitter",
        "Scan Support: Optical Fingerprint & 13.56MHz Mifare Reader"
      ],
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'ABSENSI_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_FACE_HIKVISION_320MFX',
      productId: 'cakola',
      name: 'Hikvision DS-K1T320MFX (500 Face / 1.000 FP)',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 1250000,
      weightGrams: 800,
      deviceLimit: 0,
      featuresJson: [
        "Kategori: Smart Face Recognition, Fingerprint & RFID Terminal",
        "Kapasitas: 500 Wajah | 1.000 Sidik Jari | 1.000 Kartu RFID | 100.000 Log",
        "Kamera: Dual-Camera Smart Face Recognition Anti-Spoofing",
        "Konektivitas: LAN TCP/IP RJ45 + Support Active 12V PoE Splitter"
      ],
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'ABSENSI_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_RFID_ZKTECO_SCR100',
      productId: 'cakola',
      name: 'ZKTeco SCR100 RFID LAN (30.000 Card)',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 1550000,
      weightGrams: 600,
      deviceLimit: 0,
      featuresJson: [
        "Kategori: Wall-Mount RFID Reader Terminal LAN Pintu Kelas",
        "Kapasitas: 30.000 Kartu RFID Mifare | 50.000 Log Transaksi",
        "Konektivitas: LAN TCP/IP RJ45 + Active 12V PoE Splitter Kit Included",
        "Kecepatan: High-Speed RFID Tap (0.2 Detik per Siswa)"
      ],
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'ABSENSI_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_FP_ZKTECO_K40',
      productId: 'cakola',
      name: 'ZKTeco K40 Fingerprint (1.000 FP / 1.000 Card)',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 1750000,
      weightGrams: 850,
      deviceLimit: 0,
      featuresJson: [
        "Kategori: Fingerprint & RFID Card LAN Terminal",
        "Kapasitas: 1.000 Sidik Jari | 1.000 Kartu RFID | 80.000 Log",
        "Konektivitas: LAN TCP/IP RJ45 + Support Active 12V PoE Splitter",
        "Baterai Backup: Built-in Internal Rechargeable Battery"
      ],
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'ABSENSI_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_FP_SOLUTION_X100C',
      productId: 'cakola',
      name: 'Solution X100-C (10.000 FP / 10.000 Card)',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 2550000,
      weightGrams: 1100,
      deviceLimit: 0,
      featuresJson: [
        "Kategori: Fingerprint & RFID High-Capacity LAN Terminal",
        "Kapasitas: 10.000 Sidik Jari | 10.000 Kartu RFID | 100.000 Log",
        "Konektivitas: LAN TCP/IP RJ45 + Support Active 12V PoE Splitter",
        "Baterai Backup: Built-in Internal Rechargeable Battery"
      ],
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'ABSENSI_HARDWARE',
      serviceCode: 'cakola'
    },
    {
      id: 'HW_FP_HIKVISION_804',
      productId: 'cakola',
      name: 'Hikvision DS-K1T804 PoE (3.000 FP / 3.000 Card)',
      type: 'HARDWARE_PERIPHERAL',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 2850000,
      weightGrams: 750,
      deviceLimit: 0,
      featuresJson: [
        "Kategori: Fingerprint & RFID Terminal dengan Built-in PoE",
        "Kapasitas: 3.000 Sidik Jari | 3.000 Kartu RFID | 100.000 Log",
        "Power & Net: Standard PoE IEEE 802.3af (1-Kabel Data & Daya)",
        "Scan Support: Optical Fingerprint & 13.56MHz Mifare Reader"
      ],
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'ABSENSI_HARDWARE',
      serviceCode: 'cakola'
    },

    // --- CARDS & SERVICES ---
    {
      id: 'SVC_CETAK_KARTU_MIFARE_CUSTOM',
      productId: 'cakola',
      name: 'Kartu RFID Custom Print',
      type: 'PHYSICAL_SERVICE',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 8000,
      weightGrams: 10,
      deviceLimit: 0,
      featuresJson: [
        "Layanan: Full Produce Custom Print 2 Sisi (Logo & Foto Siswa)",
        "Frekuensi: High-Frequency 13.56MHz Mifare Chip",
        "Bahan: High-Quality Glossy PVC 0.76mm",
        "Garansi: Cetak Tajam & Anti-Luntur"
      ],
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'PHYSICAL_SERVICE',
      serviceCode: 'cakola'
    },
    {
      id: 'SVC_KARTU_MIFARE_BLANK',
      productId: 'cakola',
      name: 'Kartu RFID Blank',
      type: 'PHYSICAL_SERVICE',
      priceMonthly: 0,
      priceYearly: 0,
      priceOnetime: 3500,
      weightGrams: 10,
      deviceLimit: 0,
      featuresJson: [
        "Layanan: Bahan Kartu Polos Putih (Sekolah Cetak Mandiri)",
        "Frekuensi: High-Frequency 13.56MHz Mifare Chip",
        "Bahan: Printable White PVC 0.76mm",
        "Peruntukan: ID Card Printer (Fargo/Evolis/Datacard)"
      ],
      billingPeriod: 'ONETIME',
      isActive: true,
      moduleId: 'PHYSICAL_SERVICE',
      serviceCode: 'cakola'
    },

    // --- SOFTWARE SAAS CLOUD SUBSCRIPTION TIERS ---
    {
      id: 'SW_SAAS_MICRO',
      productId: 'cakola',
      name: 'Absenta SaaS Cloud Micro (300 Siswa)',
      type: 'SOFTWARE_SUBSCRIPTION',
      priceMonthly: 350000,
      priceYearly: 3500000,
      priceOnetime: 0,
      weightGrams: 0,
      deviceLimit: 300,
      featuresJson: [
        "Layanan SaaS Cloud Managed (Data Center Jakarta / Singapura)",
        "Kapasitas Maksimal: 300 Siswa & Guru",
        "Support WA Gateway Bot & Automatic Daily Backup",
        "Bebas Mati Lampu & Bebas Maintenance Server Mandiri"
      ],
      billingPeriod: 'YEARLY',
      isActive: true,
      moduleId: 'ABSENSI',
      serviceCode: 'cakola'
    },
    {
      id: 'SW_SAAS_SMALL',
      productId: 'cakola',
      name: 'Absenta SaaS Cloud Small (600 Siswa)',
      type: 'SOFTWARE_SUBSCRIPTION',
      priceMonthly: 580000,
      priceYearly: 5800000,
      priceOnetime: 0,
      weightGrams: 0,
      deviceLimit: 600,
      featuresJson: [
        "Layanan SaaS Cloud Managed (Data Center Jakarta / Singapura)",
        "Kapasitas Maksimal: 600 Siswa & Guru",
        "Support WA Gateway Bot & Automatic Daily Backup",
        "High-Speed Engine Response (< 100ms)"
      ],
      billingPeriod: 'YEARLY',
      isActive: true,
      moduleId: 'ABSENSI',
      serviceCode: 'cakola'
    },
    {
      id: 'SW_SAAS_LARGE',
      productId: 'cakola',
      name: 'Absenta SaaS Cloud Large (1.200 Siswa)',
      type: 'SOFTWARE_SUBSCRIPTION',
      priceMonthly: 950000,
      priceYearly: 9500000,
      priceOnetime: 0,
      weightGrams: 0,
      deviceLimit: 1200,
      featuresJson: [
        "Layanan SaaS Cloud Managed High-Capacity",
        "Kapasitas Maksimal: 1.200 Siswa & Guru",
        "Support Multi-Tap Machine Parallel Sync",
        "Dedicated Database Instance Backup & Recovery"
      ],
      billingPeriod: 'YEARLY',
      isActive: true,
      moduleId: 'ABSENSI',
      serviceCode: 'cakola'
    },
    {
      id: 'SW_SAAS_ENTERPRISE',
      productId: 'cakola',
      name: 'Absenta SaaS Cloud Enterprise (2.500 Siswa)',
      type: 'SOFTWARE_SUBSCRIPTION',
      priceMonthly: 1850000,
      priceYearly: 18500000,
      priceOnetime: 0,
      weightGrams: 0,
      deviceLimit: 2500,
      featuresJson: [
        "Layanan SaaS Cloud Dedicated Performance (Biznet GIO / Hetzner)",
        "Kapasitas Maksimal: 2.500 Siswa & Guru",
        "High-Concurrency Peak Surge Engine (Bebas Macet Jam 06.30 WIB)",
        "Priority 24/7 Technical SLA Support"
      ],
      billingPeriod: 'YEARLY',
      isActive: true,
      moduleId: 'ABSENSI',
      serviceCode: 'cakola'
    },
    {
      id: 'SW_SAAS_ULTRA',
      productId: 'cakola',
      name: 'Absenta SaaS Cloud Ultra / Campus (> 2.500 Siswa)',
      type: 'SOFTWARE_SUBSCRIPTION',
      priceMonthly: 2450000,
      priceYearly: 24500000,
      priceOnetime: 0,
      weightGrams: 0,
      deviceLimit: 5000,
      featuresJson: [
        "Layanan SaaS Cloud Cluster Enterprise Dedicated",
        "Kapasitas Unlimited (> 2.500 Siswa & Multi-Kampus)",
        "Dedicated Multi-Core VPS Cluster Allocation",
        "Custom Feature Request & Direct On-Call Engineering SLA"
      ],
      billingPeriod: 'YEARLY',
      isActive: true,
      moduleId: 'ABSENSI',
      serviceCode: 'cakola'
    },

    // --- ON-PREMISE ANNUAL SOFTWARE MAINTENANCE LICENSES ---
    {
      id: 'SW_ONPREM_ENTERPRISE',
      productId: 'cakola',
      name: 'Lisensi Perpanjangan On-Premise Enterprise (2.500 Siswa)',
      type: 'SOFTWARE_SUBSCRIPTION',
      priceMonthly: 850000,
      priceYearly: 8500000,
      priceOnetime: 0,
      weightGrams: 0,
      deviceLimit: 2500,
      featuresJson: [
        "Perpanjangan Lisensi Server Lokal On-Premise (1 Tahun)",
        "Dukungan Update Engine Security & Patching 24/7",
        "Akses Easy-Tunnel Remote Access Cloud",
        "Offsite Automatic Encrypted Cloud Backup"
      ],
      billingPeriod: 'YEARLY',
      isActive: true,
      moduleId: 'ABSENSI',
      serviceCode: 'cakola'
    }
  ];

  for (const p of plans) {
    await prisma.plan.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        type: p.type,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        priceOnetime: p.priceOnetime,
        weightGrams: p.weightGrams,
        deviceLimit: p.deviceLimit,
        featuresJson: JSON.stringify(p.featuresJson),
        techSpecsJson: p.techSpecsJson ? p.techSpecsJson : null,
        billingPeriod: p.billingPeriod,
        isActive: p.isActive,
        moduleId: p.moduleId,
        serviceCode: p.serviceCode,
      },
      create: {
        id: p.id,
        productId: p.productId,
        name: p.name,
        type: p.type,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        priceOnetime: p.priceOnetime,
        weightGrams: p.weightGrams,
        deviceLimit: p.deviceLimit,
        featuresJson: JSON.stringify(p.featuresJson),
        techSpecsJson: p.techSpecsJson ? p.techSpecsJson : null,
        billingPeriod: p.billingPeriod,
        isActive: p.isActive,
        moduleId: p.moduleId,
        serviceCode: p.serviceCode,
      }
    });
    console.log(`- Upserted plan: ${p.name}`);
  }

  // Deactivate old legacy card packages & non-standard card variants
  await prisma.plan.updateMany({
    where: {
      id: { 
        in: [
          'SVC_CETAK_KARTU_PVC_100', 
          'SVC_CETAK_KARTU_PVC_300', 
          'SVC_CETAK_KARTU_PVC_500',
          'SVC_CETAK_KARTU_PROXIMITY_CUSTOM',
          'SVC_KARTU_DUAL_FREQ_CUSTOM',
          'SVC_KARTU_PROXIMITY_BLANK'
        ] 
      }
    },
    data: { isActive: false }
  });

  console.log('Seeding hardware plans completed successfully!');
}

seedHardware()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
