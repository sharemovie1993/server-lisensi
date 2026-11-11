"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTenantEntitlementRoutes = registerTenantEntitlementRoutes;
const client_1 = require("@prisma/client");
const caddy_service_1 = require("../../services/caddy.service");
const prisma = new client_1.PrismaClient();
function registerTenantEntitlementRoutes(fastify) {
    /**
     * 1. POST /api/license/tenant/products
     * Mencari produk/lisensi yang dimiliki oleh tenant secara terotentikasi & terisolasi
     */
    fastify.post('/api/license/tenant/products', async (request, reply) => {
        const body = request.body;
        const { server_license_key, tenant_slug, npsn, deploy_scenario } = body || {};
        if (!server_license_key || server_license_key.trim() === '') {
            return reply.status(401).send({
                success: false,
                message: 'Otorisasi server ditolak: server_license_key wajib disertakan.'
            });
        }
        try {
            // 1. Verifikasi Validitas Host Server Key
            const hostLicense = await prisma.license.findUnique({
                where: { licenseKey: server_license_key.trim() }
            });
            // Jika server key tidak ditemukan di DB License Server
            if (!hostLicense) {
                return reply.status(401).send({
                    success: false,
                    message: 'Server License Key tidak valid atau tidak terdaftar pada Server Lisensi.'
                });
            }
            const cleanSlug = tenant_slug ? tenant_slug.trim().toLowerCase() : '';
            const cleanNpsn = npsn ? npsn.trim() : '';
            // Tentukan kandidat slug (termasuk variasi ejaan th / t)
            const candidateSlugs = new Set();
            if (cleanSlug) {
                candidateSlugs.add(cleanSlug);
                if (cleanSlug.endsWith('t'))
                    candidateSlugs.add(`${cleanSlug}h`);
                if (cleanSlug.endsWith('th'))
                    candidateSlugs.add(cleanSlug.slice(0, -1));
            }
            // 2. Query Lisensi Produk dengan Strict Multi-Tenant Scoping (Kecualikan Host Server Key)
            let whereClause = {};
            if (deploy_scenario === 'onpremise') {
                // Pada onpremise: 1 server = 1 tenant.
                // Cari lisensi yang bound ke server ini ATAU milik slug/npsn sekolah ini
                const orConditions = [
                    { hostLicenseKey: server_license_key.trim() }
                ];
                if (candidateSlugs.size > 0) {
                    orConditions.push({ requestedSlug: { in: Array.from(candidateSlugs) } });
                    orConditions.push({ tenantIdentifier: { in: Array.from(candidateSlugs) } });
                }
                if (cleanNpsn) {
                    orConditions.push({ npsn: cleanNpsn });
                }
                whereClause = {
                    licenseKey: { not: server_license_key.trim() }, // Jangan sertakan lisensi host mesin itu sendiri
                    OR: orConditions
                };
            }
            else {
                // Pada saas-local & saas-public: Multi-tenant.
                // Wajib strictly scoped ke tenant_slug atau npsn tenant tersebut!
                if (candidateSlugs.size === 0 && !cleanNpsn) {
                    return reply.send({ success: true, data: [] });
                }
                const orConditions = [];
                if (candidateSlugs.size > 0) {
                    orConditions.push({ requestedSlug: { in: Array.from(candidateSlugs) } });
                    orConditions.push({ tenantIdentifier: { in: Array.from(candidateSlugs) } });
                }
                if (cleanNpsn) {
                    orConditions.push({ npsn: cleanNpsn });
                }
                whereClause = {
                    licenseKey: { not: server_license_key.trim() },
                    OR: orConditions
                };
            }
            const licenses = await prisma.license.findMany({
                where: whereClause,
                include: { plan: true, product: true },
                orderBy: { createdAt: 'desc' }
            });
            const formatted = licenses.map((lic) => ({
                license_key: lic.licenseKey,
                product_id: lic.productId,
                product_name: lic.product?.name || lic.productId,
                package_title: lic.plan?.name || lic.schoolName || 'Paket Lisensi',
                school_name: lic.schoolName,
                subdomain: lic.requestedSlug || '',
                requested_slug: lic.requestedSlug || '',
                status: lic.status,
                is_active: lic.isActive,
                is_bundled: lic.includeVpn === 1 || (Boolean(lic.hostLicenseKey) && lic.productId === 'easy-tunnel'),
                entitlement_status: lic.entitlementStatus || 'ACTIVE',
                expires_at: lic.expiresAt,
                local_port: lic.localPort || null,
                app_name: lic.appName || lic.schoolName || null,
                wireguard_ip: lic.wireguardIp || null
            }));
            return reply.send({
                success: true,
                data: formatted
            });
        }
        catch (err) {
            console.error('[Tenant Entitlements Query Error]', err.message);
            return reply.status(500).send({
                success: false,
                message: 'Gagal memeriksa produk lisensi tenant: ' + err.message
            });
        }
    });
    /**
     * 2. POST /api/license/tenant/rebind
     * Protokol Rekonsiliasi & Migrasi Dua Arah (On-Premise <-> SaaS)
     */
    fastify.post('/api/license/tenant/rebind', async (request, reply) => {
        const body = request.body;
        const { target_host_key, source_host_key, tenant_slug, npsn, target_scenario, source_scenario, entitlement_keys = [] } = body || {};
        if (!target_host_key || !tenant_slug || !target_scenario) {
            return reply.status(400).send({
                success: false,
                message: 'target_host_key, tenant_slug, dan target_scenario wajib diisi.'
            });
        }
        try {
            // 1. Verifikasi Host Tujuan
            const targetHost = await prisma.license.findUnique({
                where: { licenseKey: target_host_key.trim() }
            });
            if (!targetHost) {
                return reply.status(401).send({
                    success: false,
                    message: 'Target Host License Key tidak valid.'
                });
            }
            const cleanSlug = tenant_slug.trim().toLowerCase();
            const candidateSlugs = [cleanSlug];
            if (cleanSlug.endsWith('t'))
                candidateSlugs.push(`${cleanSlug}h`);
            if (cleanSlug.endsWith('th'))
                candidateSlugs.push(cleanSlug.slice(0, -1));
            // 2. Cari lisensi produk milik tenant tersebut (Kecualikan Host Server)
            const orConditions = [
                { requestedSlug: { in: candidateSlugs } },
                { tenantIdentifier: { in: candidateSlugs } }
            ];
            if (npsn && npsn.trim()) {
                orConditions.push({ npsn: npsn.trim() });
            }
            if (entitlement_keys.length > 0) {
                orConditions.push({ licenseKey: { in: entitlement_keys } });
            }
            const tenantLicenses = await prisma.license.findMany({
                where: {
                    licenseKey: { not: target_host_key.trim() },
                    OR: orConditions
                }
            });
            const updatedKeys = [];
            for (const lic of tenantLicenses) {
                let newEntitlementStatus = 'ACTIVE';
                // 🌟 ATURAN SKENARIO MIGRASI KHUSUS 🌟
                if (target_scenario === 'saas-public') {
                    // Jika pindah ke Cloud VPS Publik: Easy Tunnel tidak dibutuhkan (diparkir)
                    if (lic.productId === 'easy-tunnel') {
                        newEntitlementStatus = 'PARKED_CLOUD';
                    }
                }
                else {
                    // Jika pindah ke On-Premise atau SaaS-Local: Easy Tunnel diaktifkan kembali
                    newEntitlementStatus = 'ACTIVE';
                }
                await prisma.license.update({
                    where: { id: lic.id },
                    data: {
                        hostLicenseKey: target_host_key.trim(),
                        entitlementStatus: newEntitlementStatus,
                        requestedSlug: lic.requestedSlug || cleanSlug,
                        npsn: lic.npsn || npsn || null
                    }
                });
                updatedKeys.push(lic.licenseKey);
            }
            // 3. Catat Riwayat Migrasi ke Audit Log
            await prisma.tenantMigrationLog.create({
                data: {
                    tenantSlug: cleanSlug,
                    npsn: npsn || null,
                    sourceHostKey: source_host_key || null,
                    targetHostKey: target_host_key.trim(),
                    sourceScenario: source_scenario || null,
                    targetScenario: target_scenario,
                    licenseKeysJson: updatedKeys,
                    action: target_scenario === 'saas-public' ? 'PARK_CLOUD' : (source_scenario === 'saas-public' ? 'UNPARK_LOCAL' : 'REBIND'),
                    ipAddress: request.ip
                }
            });
            return reply.send({
                success: true,
                message: `Berhasil merekonsiliasi ${updatedKeys.length} lisensi untuk tenant ${cleanSlug}.`,
                data: {
                    rebound_count: updatedKeys.length,
                    rebound_keys: updatedKeys,
                    target_scenario: target_scenario
                }
            });
        }
        catch (err) {
            console.error('[Tenant Entitlements Rebind Error]', err.message);
            return reply.status(500).send({
                success: false,
                message: 'Gagal melakukan re-binding lisensi: ' + err.message
            });
        }
    });
    /**
     * 3. POST /api/license/tenant/sync-metadata
     * Sinkronisasi real-time perubahan metadata tenant (nama, subdomain, custom_domain, status)
     * dari Superadmin Absenta ke License Server (License + Subscription) dan trigger reload Caddy.
     */
    fastify.post('/api/license/tenant/sync-metadata', async (request, reply) => {
        const body = (request.body || {});
        const serverKey = body.server_license_key?.trim();
        if (!serverKey) {
            return reply.status(401).send({
                success: false,
                message: 'Otorisasi server ditolak: server_license_key wajib disertakan.'
            });
        }
        try {
            const hostLicense = await prisma.license.findUnique({
                where: { licenseKey: serverKey }
            });
            if (!hostLicense) {
                return reply.status(401).send({
                    success: false,
                    message: 'Server License Key tidak valid atau tidak terdaftar pada Server Lisensi.'
                });
            }
            const oldSub = body.old_subdomain?.trim().toLowerCase() || undefined;
            const newSub = body.new_subdomain?.trim().toLowerCase() || undefined;
            const oldCustom = body.old_custom_domain?.trim().toLowerCase() || undefined;
            const hasCustomField = body.custom_domain !== undefined;
            const newCustom = hasCustomField
                ? (body.custom_domain ? body.custom_domain.trim().toLowerCase() : null)
                : undefined;
            const oldName = body.old_name?.trim() || undefined;
            const newName = body.new_name?.trim() || undefined;
            const cleanNpsn = body.npsn?.trim() || undefined;
            const deployScenario = body.deploy_scenario?.trim().toLowerCase();
            const upperStatus = body.status?.trim().toUpperCase();
            const subdomainChanged = Boolean(newSub && newSub !== oldSub);
            const customDomainChanged = hasCustomField && (newCustom ?? null) !== (oldCustom ?? null);
            const nameChanged = Boolean(newName && newName !== oldName);
            const statusChanged = Boolean(upperStatus);
            // 1. Cari lisensi terkait milik tenant ini
            const licenseOrConditions = [];
            if (deployScenario === 'onpremise') {
                licenseOrConditions.push({ id: hostLicense.id });
                licenseOrConditions.push({ hostLicenseKey: hostLicense.licenseKey });
            }
            if (oldSub) {
                licenseOrConditions.push({ hostLicenseKey: hostLicense.licenseKey, requestedSlug: oldSub });
                licenseOrConditions.push({ hostLicenseKey: hostLicense.licenseKey, tenantIdentifier: oldSub });
                licenseOrConditions.push({
                    requestedSlug: oldSub,
                    productId: { in: ['easy-tunnel', 'absenta-vpn'] },
                    OR: [{ hostLicenseKey: hostLicense.licenseKey }, { hostLicenseKey: null }]
                });
            }
            if (oldCustom) {
                licenseOrConditions.push({ hostLicenseKey: hostLicense.licenseKey, customDomain: oldCustom });
            }
            if (cleanNpsn) {
                licenseOrConditions.push({ hostLicenseKey: hostLicense.licenseKey, npsn: cleanNpsn });
            }
            const matchedLicenses = licenseOrConditions.length > 0
                ? await prisma.license.findMany({ where: { OR: licenseOrConditions } })
                : [];
            const matchedLicenseIds = new Set(matchedLicenses.map((l) => l.id));
            // 2. Cek bentrok subdomain baru (jika subdomain berubah)
            if (subdomainChanged && newSub) {
                const conflictingLicense = await prisma.license.findFirst({
                    where: {
                        id: { notIn: Array.from(matchedLicenseIds) },
                        isActive: 1,
                        OR: [
                            { requestedSlug: newSub },
                            { tenantIdentifier: newSub }
                        ]
                    },
                    select: { licenseKey: true, schoolName: true, requestedSlug: true }
                });
                if (conflictingLicense) {
                    return reply.status(409).send({
                        success: false,
                        code: 'SUBDOMAIN_CONFLICT',
                        message: `Subdomain '${newSub}' sudah digunakan oleh lisensi aktif lain di Server Lisensi.`
                    });
                }
                const otherHostSubs = await prisma.subscription.findMany({
                    where: {
                        licenseId: { not: hostLicense.id },
                        status: 'active',
                        schoolName: { endsWith: `|${newSub}`, mode: 'insensitive' }
                    },
                    select: { id: true, schoolName: true }
                });
                if (otherHostSubs.length > 0) {
                    return reply.status(409).send({
                        success: false,
                        code: 'SUBDOMAIN_CONFLICT',
                        message: `Subdomain '${newSub}' sudah digunakan oleh tenant pada server lain.`
                    });
                }
            }
            // 3. Cek bentrok custom domain baru (jika custom_domain diisi & berubah)
            if (customDomainChanged && newCustom) {
                const conflictingCustom = await prisma.license.findFirst({
                    where: {
                        id: { notIn: Array.from(matchedLicenseIds) },
                        isActive: 1,
                        customDomain: { equals: newCustom, mode: 'insensitive' }
                    },
                    select: { licenseKey: true, customDomain: true }
                });
                if (conflictingCustom) {
                    return reply.status(409).send({
                        success: false,
                        code: 'CUSTOM_DOMAIN_CONFLICT',
                        message: `Custom domain '${newCustom}' sudah terpasang pada lisensi lain di Server Lisensi.`
                    });
                }
            }
            // 4. Update Subscription pada Host License (format schoolName: "Nama Sekolah|subdomain")
            let updatedSubscriptions = 0;
            const hostSubscriptions = await prisma.subscription.findMany({
                where: { licenseId: hostLicense.id }
            });
            const effectiveName = newName || oldName;
            const effectiveSub = newSub || oldSub;
            for (const sub of hostSubscriptions) {
                const parts = sub.schoolName.split('|');
                const subPartName = parts[0]?.trim().toLowerCase();
                const subPartSlug = parts[1]?.trim().toLowerCase();
                const matchesBySlug = Boolean(oldSub && subPartSlug === oldSub);
                const matchesByName = Boolean(oldName && subPartName === oldName.toLowerCase());
                if (!matchesBySlug && !matchesByName)
                    continue;
                const targetName = effectiveName || parts[0]?.trim() || sub.schoolName;
                const targetSlug = effectiveSub || parts[1]?.trim();
                const nextSchoolName = targetSlug ? `${targetName}|${targetSlug}` : targetName;
                if (nextSchoolName !== sub.schoolName) {
                    await prisma.subscription.update({
                        where: { id: sub.id },
                        data: { schoolName: nextSchoolName }
                    });
                    updatedSubscriptions++;
                }
            }
            // 5. Update matched License records (slug, customDomain, schoolName, entitlementStatus)
            let updatedLicenses = 0;
            for (const lic of matchedLicenses) {
                const isHostSelf = lic.id === hostLicense.id;
                // Pada SaaS multi-tenant, jangan pernah timpa slug/status host utama jika lolos filter
                if (isHostSelf && deployScenario !== 'onpremise')
                    continue;
                const updateData = {};
                if (newSub && (subdomainChanged || lic.requestedSlug !== newSub)) {
                    updateData.requestedSlug = newSub;
                    updateData.tenantIdentifier = newSub;
                }
                if (nameChanged && newName) {
                    updateData.schoolName = newName;
                }
                if (customDomainChanged) {
                    updateData.customDomain = newCustom;
                }
                if (!isHostSelf && upperStatus) {
                    if (upperStatus === 'SUSPENDED' || upperStatus === 'INACTIVE') {
                        updateData.entitlementStatus = 'SUSPENDED';
                    }
                    else if (upperStatus === 'ACTIVE' && lic.entitlementStatus === 'SUSPENDED') {
                        updateData.entitlementStatus = 'ACTIVE';
                    }
                }
                if (Object.keys(updateData).length > 0) {
                    await prisma.license.update({
                        where: { id: lic.id },
                        data: updateData
                    });
                    updatedLicenses++;
                }
            }
            // 6. Trigger reload Caddy jika ada perubahan routing domain/subdomain/status
            let caddySynced = false;
            if (subdomainChanged || customDomainChanged || statusChanged) {
                await (0, caddy_service_1.triggerCaddySync)();
                caddySynced = true;
            }
            return reply.send({
                success: true,
                message: 'Metadata tenant berhasil disinkronkan ke Server Lisensi.',
                data: {
                    updated_licenses: updatedLicenses,
                    updated_subscriptions: updatedSubscriptions,
                    caddy_synced: caddySynced
                }
            });
        }
        catch (err) {
            console.error('[Tenant Metadata Sync Error]', err.message);
            return reply.status(500).send({
                success: false,
                message: 'Gagal menyinkronkan metadata tenant: ' + err.message
            });
        }
    });
}
