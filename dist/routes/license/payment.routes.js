"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPaymentLicenseRoutes = void 0;
const crypto_1 = __importDefault(require("crypto"));
const helpers_1 = require("./helpers");
const http_1 = require("../../utils/http");
const invoice_template_1 = require("../../utils/invoice-template");
const caddy_service_1 = require("../../services/caddy.service");
const logger_1 = require("../../utils/logger");
const registerPaymentLicenseRoutes = (fastify) => {
    // 1. Get packages / plans list
    fastify.get('/api/license/packages', async (request, reply) => {
        const query = request.query;
        const productId = (0, helpers_1.normalizeProductId)(query.product_id || 'cakola');
        try {
            const plans = await helpers_1.prisma.plan.findMany({
                where: {
                    productId: productId,
                    isActive: true
                },
                orderBy: { id: 'asc' }
            });
            // Map plans to match Express old response
            const mappedPlans = plans.map(p => ({
                id: p.id,
                product_id: p.productId,
                title: p.name,
                price: `Rp ${p.priceMonthly.toLocaleString('id-ID')}`,
                device_limit: p.deviceLimit,
                is_unlimited: p.deviceLimit === 0 ? 1 : 0,
                name: p.name,
                features_json: JSON.stringify(p.featuresJson),
                billing_period: p.billingPeriod,
                price_monthly: p.priceMonthly,
                price_yearly: p.priceYearly,
                module_id: p.moduleId,
                service_code: p.serviceCode
            }));
            return reply.send({ success: true, data: mappedPlans });
        }
        catch (err) {
            console.error('[Get Packages Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar paket: ' + err.message });
        }
    });
    // 2. Check subdomain / slug availability
    fastify.get('/api/license/check-slug/:slug', async (request, reply) => {
        const { slug } = request.params;
        if (!slug) {
            return reply.status(400).send({ success: false, message: 'Slug tidak boleh kosong' });
        }
        try {
            const cleanSlug = slug.trim().toLowerCase();
            // Query from PostgreSQL using Prisma Client
            const existingLocal = await helpers_1.prisma.license.findFirst({
                where: { requestedSlug: cleanSlug },
                orderBy: { createdAt: 'desc' }
            });
            if (existingLocal) {
                const todayStr = new Date().toISOString().slice(0, 10);
                const isExpired = existingLocal.status === 'expired' || existingLocal.expiresAt < todayStr;
                const isPending = existingLocal.status === 'pending';
                if (isExpired) {
                    return reply.send({
                        success: true,
                        available: false,
                        is_recovery: true,
                        message: 'Subdomain terdaftar namun lisensi kedaluwarsa'
                    });
                }
                return reply.send({
                    success: true,
                    available: false,
                    is_recovery: false,
                    status_code: isPending ? 'pending_payment' : 'active_license',
                    message: isPending ? 'Subdomain sedang dipesan (Menunggu Pembayaran)' : 'Subdomain sudah digunakan dan masih aktif'
                });
            }
            return reply.send({ success: true, available: true, message: 'Subdomain tersedia' });
        }
        catch (err) {
            console.error('[Check Slug Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengecek ketersediaan subdomain.' });
        }
    });
    // 3. Tripay callback webhook receiver
    fastify.post('/api/license/tripay-callback', async (request, reply) => {
        const callbackSignature = request.headers['x-callback-signature'];
        const TRIPAY_PRIVATE_KEY = process.env.TRIPAY_PRIVATE_KEY || '';
        if (!callbackSignature) {
            return reply.status(400).send({ success: false, message: 'Missing callback signature.' });
        }
        const rawPayload = JSON.stringify(request.body);
        const calculatedSignature = crypto_1.default
            .createHmac('sha256', TRIPAY_PRIVATE_KEY)
            .update(rawPayload)
            .digest('hex');
        if (callbackSignature !== calculatedSignature) {
            return reply.status(403).send({ success: false, message: 'Invalid callback signature.' });
        }
        const body = request.body;
        const { merchant_ref, status } = body;
        if (status === 'PAID') {
            try {
                const invoice = await helpers_1.prisma.invoice.findUnique({
                    where: { invoiceNumber: merchant_ref }
                });
                if (!invoice) {
                    return reply.status(404).send({ success: false, message: 'Invoice not found.' });
                }
                if (invoice.status === 'paid') {
                    return reply.send({ success: true, message: 'Already paid.' });
                }
                // Update invoice
                await helpers_1.prisma.invoice.update({
                    where: { id: invoice.id },
                    data: { status: 'paid', paidAt: new Date() }
                });
                // Resolve license duration
                const planId = invoice.planId || '';
                let days = 30;
                if (planId.includes('semester'))
                    days = 180;
                else if (planId.includes('annual'))
                    days = 365;
                else if (planId.includes('lifetime'))
                    days = 3650;
                const baseDate = new Date();
                baseDate.setDate(baseDate.getDate() + days);
                const expiresStr = baseDate.toISOString().slice(0, 10);
                // Activate license
                const lic = await helpers_1.prisma.license.update({
                    where: { id: invoice.licenseId },
                    data: { status: 'active', isActive: 1, expiresAt: expiresStr }
                });
                // Upsert subscription
                const existingSub = await helpers_1.prisma.subscription.findFirst({
                    where: {
                        licenseId: lic.id,
                        planId,
                        schoolName: invoice.schoolName
                    }
                });
                if (existingSub) {
                    await helpers_1.prisma.subscription.update({
                        where: { id: existingSub.id },
                        data: {
                            status: 'active',
                            startDate: new Date().toISOString().slice(0, 10),
                            endDate: expiresStr,
                            schoolName: invoice.schoolName
                        }
                    });
                }
                else {
                    await helpers_1.prisma.subscription.create({
                        data: {
                            licenseId: lic.id,
                            schoolName: invoice.schoolName,
                            productId: lic.productId,
                            planId,
                            status: 'active',
                            startDate: new Date().toISOString().slice(0, 10),
                            endDate: expiresStr
                        }
                    });
                }
                // Realtime webhook push to school client
                if (lic.requestedSlug) {
                    const schoolDomain = `https://${lic.requestedSlug}.absenta.id`;
                    const callbackUrl = `${schoolDomain}/api/billing/subscriptions/license/callback`;
                    (0, http_1.httpPost)(callbackUrl, { license_key: lic.licenseKey, tenant_id: lic.requestedSlug }, {}, 6000)
                        .then(res => console.log('[Tripay Callback Push Success]', res.status))
                        .catch(err => console.log('[Tripay Callback Push Offline/NAT]', err.message));
                }
                // Trigger dynamic routing sync
                await (0, caddy_service_1.triggerCaddySync)();
            }
            catch (err) {
                console.error('[Tripay Callback Database Error]', err.message);
                return reply.status(500).send({ success: false, message: 'Database sync error.' });
            }
        }
        return reply.send({ success: true });
    });
    // 4. Get school licenses & invoices history by core license key (Stateless Pull Sync API)
    fastify.get('/api/license/history-by-core-key/:coreKey', async (request, reply) => {
        const { coreKey } = request.params;
        try {
            const coreLicense = await helpers_1.prisma.license.findUnique({
                where: { licenseKey: coreKey.trim() },
                select: { id: true, productId: true, requestedSlug: true }
            });
            if (!coreLicense) {
                return reply.status(404).send({ success: false, message: 'Lisensi core tidak terdaftar.' });
            }
            let slugs = [];
            if (coreLicense.requestedSlug) {
                slugs.push(coreLicense.requestedSlug.toLowerCase());
            }
            // If it is a SaaS platform core, pull all tenant slugs from active subscriptions
            if ((0, helpers_1.normalizeProductId)(coreLicense.productId) === 'cakola') {
                const platformSubs = await helpers_1.prisma.subscription.findMany({
                    where: { licenseId: coreLicense.id },
                    select: { schoolName: true }
                });
                platformSubs.forEach(s => {
                    if (s.schoolName && s.schoolName.includes('|')) {
                        const parts = s.schoolName.split('|');
                        const slug = parts[parts.length - 1].trim().toLowerCase();
                        if (slug && !slugs.includes(slug)) {
                            slugs.push(slug);
                        }
                    }
                });
            }
            // Find all licenses under these subdomain slugs
            const licenses = await helpers_1.prisma.license.findMany({
                where: { requestedSlug: { in: slugs } },
                orderBy: { id: 'desc' }
            });
            // Find all invoices under these license IDs (including the core license itself)
            const licenseIds = licenses.map(l => l.id);
            if (!licenseIds.includes(coreLicense.id)) {
                licenseIds.push(coreLicense.id);
            }
            let invoices = [];
            if (licenseIds.length > 0) {
                invoices = await helpers_1.prisma.invoice.findMany({
                    where: { licenseId: { in: licenseIds } },
                    orderBy: { createdAt: 'desc' }
                });
            }
            // Map response to match Express naming format (using flat mappings)
            const mappedLicenses = licenses.map(l => ({
                id: l.id,
                product_id: l.productId,
                license_key: l.licenseKey,
                school_name: l.schoolName,
                status: l.status,
                is_active: l.isActive,
                requested_slug: l.requestedSlug,
                wireguard_ip: l.wireguardIp,
                expires_at: l.expiresAt
            }));
            const mappedInvoices = invoices.map(i => {
                let instructions = [];
                let payCode = '';
                let qrUrl = '';
                let reference = '';
                if (i.paymentInstructions) {
                    try {
                        const parsed = typeof i.paymentInstructions === 'string'
                            ? JSON.parse(i.paymentInstructions)
                            : i.paymentInstructions;
                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                            instructions = parsed.instructions || [];
                            payCode = parsed.pay_code || '';
                            qrUrl = parsed.qr_url || '';
                            reference = parsed.reference || '';
                        }
                        else if (Array.isArray(parsed)) {
                            instructions = parsed;
                            // Fallback: extract payCode from instructions array by searching for a 10-20 digit number in payment steps
                            for (const instObj of parsed) {
                                if (instObj.steps && Array.isArray(instObj.steps)) {
                                    for (const step of instObj.steps) {
                                        const stepClean = String(step).toLowerCase();
                                        if (stepClean.includes('virtual account') || stepClean.includes('va') || stepClean.includes('transfer') || stepClean.includes('bayar') || stepClean.includes('rekening')) {
                                            const m = String(step).match(/\d{10,20}/);
                                            if (m) {
                                                payCode = m[0];
                                                break;
                                            }
                                        }
                                    }
                                }
                                if (payCode)
                                    break;
                            }
                        }
                    }
                    catch (e) { }
                }
                return {
                    id: i.id,
                    invoice_number: i.invoiceNumber,
                    license_id: i.licenseId,
                    school_name: i.schoolName,
                    product_id: i.productId,
                    plan_title: i.planTitle,
                    amount: i.amount,
                    status: i.status,
                    payment_method: i.paymentMethod,
                    payment_instructions: JSON.stringify(instructions),
                    pay_code: payCode,
                    qr_url: qrUrl,
                    payment_reference: reference,
                    expired_time: i.expiredTime,
                    paid_at: i.paidAt ? i.paidAt.toISOString() : null,
                    created_at: i.createdAt ? i.createdAt.toISOString() : null,
                    plan_id: i.planId
                };
            });
            return reply.send({
                success: true,
                data: {
                    licenses: mappedLicenses,
                    invoices: mappedInvoices
                }
            });
        }
        catch (err) {
            console.error('[History by Core Key Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal memuat riwayat transaksi: ' + err.message });
        }
    });
    // 5. Renders clean, premium invoice receipt HTML printable page
    fastify.get('/api/license/print-invoice/:invoiceNumber', async (request, reply) => {
        const { invoiceNumber } = request.params;
        try {
            const inv = await helpers_1.prisma.invoice.findUnique({
                where: { invoiceNumber: invoiceNumber.trim() },
                include: {
                    license: { include: { plan: true } },
                    plan: true
                }
            });
            if (!inv) {
                return reply.status(404).type('text/html').send('<h1>Error 404: Invoice tidak ditemukan</h1>');
            }
            const planTitle = inv.planTitle;
            const planDuration = planTitle.toLowerCase().includes('bulan') ? '30 Hari' : (planTitle.toLowerCase().includes('sem') ? '180 Hari' : '365 Hari');
            const dateStr = inv.paidAt
                ? (0, invoice_template_1.formatIndonesianDate)(inv.paidAt.toISOString().slice(0, 10))
                : (0, invoice_template_1.formatIndonesianDate)(inv.createdAt.toISOString().slice(0, 10));
            const product = await helpers_1.prisma.product.findUnique({ where: { id: inv.productId } });
            const productName = product ? product.name : 'Aplikasi Premium';
            let productDesc = 'Sistem terintegrasi dan berkinerja tinggi skala SaaS Enterprise.';
            const cleanProdId = inv.productId.toLowerCase().replace('platform-', '');
            const titleUpper = planTitle.toUpperCase();
            if (titleUpper.includes('HUBUNGAN INDUSTRI') || titleUpper.includes('HUBIN')) {
                productDesc = 'Layanan manajemen hubungan industri, praktek kerja lapangan (PKL), penempatan & monitoring siswa magang, serta jurnal digital PKL.';
            }
            else if (titleUpper.includes('SARANA PRASARANA') || titleUpper.includes('SARPRAS') || titleUpper.includes('SARANA & PRASARANA')) {
                productDesc = 'Layanan manajemen aset sekolah, sarana prasarana, inventarisasi barang, pelaporan kerusakan, dan log pemeliharaan.';
            }
            else if (titleUpper.includes('KOPERASI')) {
                productDesc = 'Layanan sistem informasi koperasi sekolah, pencatatan transaksi kasir, simpan pinjam, dan pembukuan otomatis.';
            }
            else if (titleUpper.includes('KANTIN')) {
                productDesc = 'Layanan sistem kasir kantin sekolah dan transaksi cashless siswa/guru.';
            }
            else if (titleUpper.includes('EASY TUNNEL') || titleUpper.includes('EASY-TUNNEL') || titleUpper.includes('TUNNEL')) {
                productDesc = 'Layanan tunnel jaringan aman untuk konektivitas server lokal ke cloud publik.';
            }
            else if (titleUpper.includes('VPN')) {
                productDesc = 'Layanan koneksi VPN aman untuk akses multi-cabang terintegrasi.';
            }
            else if (cleanProdId === 'cakola' || cleanProdId === 'absenta' || titleUpper.includes('ABSENSI') || titleUpper.includes('ATTENDANCE')) {
                productDesc = `Layanan sistem absensi digital ${productName} berbasis scan wajah/kartu dan real-time notification.`;
            }
            else {
                productDesc = `Layanan ${productName} terintegrasi dan berkinerja tinggi skala SaaS Enterprise.`;
            }
            let displayModuleId = '';
            if (inv.plan && inv.plan.moduleId) {
                displayModuleId = inv.plan.moduleId.trim().toUpperCase();
            }
            else {
                if (titleUpper.includes('HUBUNGAN INDUSTRI') || titleUpper.includes('HUBIN')) {
                    displayModuleId = 'HUBIN';
                }
                else if (titleUpper.includes('SARANA PRASARANA') || titleUpper.includes('SARPRAS') || titleUpper.includes('SARANA & PRASARANA')) {
                    displayModuleId = 'SARPRAS';
                }
                else if (titleUpper.includes('KOPERASI')) {
                    displayModuleId = 'KOPERASI';
                }
                else if (titleUpper.includes('KANTIN')) {
                    displayModuleId = 'KANTIN';
                }
                else if (titleUpper.includes('EASY TUNNEL') || titleUpper.includes('EASY-TUNNEL') || titleUpper.includes('TUNNEL') || titleUpper.includes('VPN')) {
                    displayModuleId = 'TUNNEL';
                }
                else if (titleUpper.includes('WHATSAPP') || titleUpper.includes('WA')) {
                    displayModuleId = 'WHATSAPP';
                }
                else if (titleUpper.includes('RAPOR') || titleUpper.includes('ACADEMIC')) {
                    displayModuleId = 'AKADEMIK';
                }
                else {
                    displayModuleId = 'ABSENSI';
                }
            }
            // Format: Platform {productName} — Modul {moduleId}
            const displayProductName = `${productName} — Modul ${displayModuleId}`;
            // Kapasitas Dinamis: sumber utama dari plan yang terikat di lisensi (license.planId → Plan.deviceLimit)
            // Fallback: invoice.plan → license.deviceLimit
            const isAbsenta = (0, helpers_1.normalizeProductId)(inv.productId) === 'cakola';
            const licPlan = inv.license.plan;
            const rawLimit = licPlan?.deviceLimit ?? inv.plan?.deviceLimit ?? inv.license.deviceLimit;
            const isUnlimited = rawLimit === 0 || rawLimit === 9999;
            let capacityStr = 'Standar';
            if (isAbsenta) {
                capacityStr = isUnlimited ? 'Unlimited Pengguna' : `Maks. ${rawLimit} Pengguna`;
            }
            else {
                capacityStr = isUnlimited ? 'Unlimited HP/Akses' : `Maks. ${rawLimit} HP/Akses`;
            }
            // Calculate Subtotal (Base Price) & Transaction/Admin Fee dynamically
            let basePriceVal = inv.plan ? inv.plan.priceMonthly : inv.amount;
            if (inv.plan && planTitle.toLowerCase().includes('tahun')) {
                basePriceVal = inv.plan.priceYearly;
            }
            let adminFeeVal = 0;
            if (inv.paymentInstructions) {
                try {
                    const parsed = typeof inv.paymentInstructions === 'string'
                        ? JSON.parse(inv.paymentInstructions)
                        : inv.paymentInstructions;
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        if (typeof parsed.base_price === 'number')
                            basePriceVal = parsed.base_price;
                        if (typeof parsed.admin_fee === 'number')
                            adminFeeVal = parsed.admin_fee;
                    }
                }
                catch { }
            }
            if (adminFeeVal === 0 && inv.amount > basePriceVal) {
                adminFeeVal = inv.amount - basePriceVal;
            }
            if (basePriceVal > inv.amount) {
                basePriceVal = inv.amount;
                adminFeeVal = 0;
            }
            const planPrice = `Rp ${basePriceVal.toLocaleString('id-ID')}`;
            const adminFee = `Rp ${adminFeeVal.toLocaleString('id-ID')}`;
            const totalPrice = `Rp ${inv.amount.toLocaleString('id-ID')}`;
            const verifyHash = Buffer.from(`${inv.invoiceNumber}:${inv.id}:${inv.amount}`).toString('base64').slice(0, 16).toUpperCase();
            const nowUnix = Math.floor(Date.now() / 1000);
            const isExpired = inv.status !== 'paid' && inv.status !== 'cancelled' && Number(inv.expiredTime || 0) > 0 && nowUnix > Number(inv.expiredTime);
            const statusLabel = inv.status === 'paid'
                ? 'LUNAS'
                : (isExpired ? 'KEDALUWARSA' : 'BELUM BAYAR');
            let cleanSchoolName = inv.schoolName;
            if (!cleanSchoolName || cleanSchoolName === '0') {
                cleanSchoolName = inv.license?.schoolName && inv.license?.schoolName !== '0'
                    ? inv.license.schoolName
                    : (inv.license?.requestedSlug ? `${inv.license.requestedSlug.toUpperCase()} (Cakola)` : 'Instansi Sekolah');
            }
            const invoiceHtml = (0, invoice_template_1.renderInvoiceTemplate)({
                invoiceNumber: inv.invoiceNumber,
                cleanSchoolName,
                dateStr,
                statusLabel,
                isPaid: inv.status === 'paid',
                isExpired,
                payMethodLabel: inv.paymentMethod,
                licenseKey: inv.license.licenseKey,
                productName: displayProductName,
                planTitle,
                productDesc,
                planDuration,
                capacityStr,
                planPrice,
                adminFee,
                totalPrice,
                verifyHash
            });
            return reply.type('text/html').send(invoiceHtml);
        }
        catch (err) {
            console.error('[Print Invoice Error]', err.message);
            return reply.status(500).type('text/html').send('<h1>Error 500: Gagal merender invoice</h1>');
        }
    });
    // In-memory cache for payment channels
    let paymentChannelsCache = null;
    let cacheExpirationTime = 0;
    const FALLBACK_PAYMENT_CHANNELS = [
        { group: "Virtual Account", code: "BCAVA", name: "BCA Virtual Account", type: "direct", active: true, fee_flat: 5500, fee_percent: 0, icon_url: "https://assets.tripay.co.id/upload/payment-icon/ytBKvaleGy1605201833.png" },
        { group: "Virtual Account", code: "BNIVA", name: "BNI Virtual Account", type: "direct", active: true, fee_flat: 4250, fee_percent: 0, icon_url: "https://assets.tripay.co.id/upload/payment-icon/n22Qsh8jMa1583433577.png" },
        { group: "Virtual Account", code: "BRIVA", name: "BRI Virtual Account", type: "direct", active: true, fee_flat: 4250, fee_percent: 0, icon_url: "https://assets.tripay.co.id/upload/payment-icon/8WQ3APST5s1579461828.png" },
        { group: "Virtual Account", code: "MANDIRIVA", name: "Mandiri Virtual Account", type: "direct", active: true, fee_flat: 4250, fee_percent: 0, icon_url: "https://assets.tripay.co.id/upload/payment-icon/T9Z012UE331583531536.png" },
        { group: "Virtual Account", code: "PERMATAVA", name: "Permata Virtual Account", type: "direct", active: true, fee_flat: 4250, fee_percent: 0, icon_url: "https://assets.tripay.co.id/upload/payment-icon/szezRhAALB1583408731.png" },
        { group: "E-Wallet", code: "QRIS", name: "QRIS by ShopeePay", type: "direct", active: true, fee_flat: 750, fee_percent: 0.7, icon_url: "https://assets.tripay.co.id/upload/payment-icon/BpE4BPVyIw1605597490.png" }
    ];
    // 6. Payment Channels list
    fastify.get('/api/license/payment-channels', async (_request, reply) => {
        const currentTime = Date.now();
        let manualChannel = null;
        try {
            const manualEnabledRow = await helpers_1.prisma.systemSetting.findUnique({ where: { key: 'manual_payment_enabled' } }) || { value: '1' };
            if (manualEnabledRow.value === '1') {
                const bankNameRow = await helpers_1.prisma.systemSetting.findUnique({ where: { key: 'manual_bank_name' } }) || { value: 'BCA' };
                manualChannel = {
                    group: "Transfer Manual",
                    code: "Manual",
                    name: `Transfer Bank Manual (${bankNameRow.value})`,
                    type: "direct",
                    active: true,
                    fee_flat: 0,
                    fee_percent: 0,
                    icon_url: "https://img.icons8.com/fluency/96/bank-card-back-side.png",
                    minimum_amount: 10000,
                    maximum_amount: 50000000
                };
            }
        }
        catch (err) {
            console.error('[payment-channels] Failed to read manual payment settings:', err.message);
        }
        if (paymentChannelsCache && currentTime < cacheExpirationTime) {
            const resultData = [...paymentChannelsCache];
            if (manualChannel) {
                resultData.unshift(manualChannel);
            }
            return reply.send({ success: true, gateway_online: true, message: 'Success', data: resultData });
        }
        try {
            const fetch = require('node-fetch');
            const tripayApiUrl = process.env.TRIPAY_API_URL || 'https://tripay.co.id/api-sandbox';
            const tripayApiKey = process.env.TRIPAY_API_KEY;
            if (!tripayApiUrl || !tripayApiKey) {
                throw new Error('Tripay credentials are not properly configured.');
            }
            const response = await fetch(`${tripayApiUrl}/merchant/payment-channel`, {
                headers: { 'Authorization': `Bearer ${tripayApiKey}` },
                timeout: 2000
            });
            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                const mappedData = data.data.map((channel) => {
                    const feeFlat = channel && channel.fee_customer && typeof channel.fee_customer.flat !== 'undefined'
                        ? (parseInt(channel.fee_customer.flat, 10) || 0)
                        : 0;
                    const feePercent = channel && channel.fee_customer && typeof channel.fee_customer.percent !== 'undefined'
                        ? (parseFloat(channel.fee_customer.percent) || 0)
                        : 0;
                    return {
                        ...channel,
                        fee_flat: feeFlat,
                        fee_percent: feePercent
                    };
                });
                paymentChannelsCache = mappedData;
                cacheExpirationTime = currentTime + (5 * 60 * 1000);
                const resultData = [...mappedData];
                if (manualChannel) {
                    resultData.unshift(manualChannel);
                }
                return reply.send({ success: true, gateway_online: true, message: 'Success', data: resultData });
            }
            throw new Error(data.message || 'API responded with success=false');
        }
        catch (err) {
            console.error('[payment-channels API Error] Fetching Tripay failed:', err.message);
            if (paymentChannelsCache) {
                const resultData = [...paymentChannelsCache];
                if (manualChannel) {
                    resultData.unshift(manualChannel);
                }
                return reply.send({ success: true, gateway_online: false, message: 'Serving from stale cache due to gateway error', data: resultData });
            }
            const resultData = [...FALLBACK_PAYMENT_CHANNELS];
            if (manualChannel) {
                resultData.unshift(manualChannel);
            }
            return reply.send({
                success: true,
                gateway_online: false,
                message: 'Serving offline fallback payment methods',
                data: resultData
            });
        }
    });
    // 7. Upload manual receipt
    fastify.post('/api/license/upload-receipt', async (request, reply) => {
        const { license_key, image } = request.body;
        if (!license_key || !image) {
            return reply.status(400).send({ success: false, message: 'Kunci Lisensi dan Gambar Bukti Transfer wajib dikirim.' });
        }
        const clientIp = request.ip;
        try {
            const license = await helpers_1.prisma.license.findUnique({
                where: { licenseKey: license_key.trim() }
            });
            if (!license) {
                return reply.status(404).send({ success: false, message: 'Lisensi tidak ditemukan.' });
            }
            const lastInvoice = await helpers_1.prisma.invoice.findFirst({
                where: { licenseId: license.id },
                orderBy: { createdAt: 'desc' }
            });
            if (!lastInvoice) {
                return reply.status(404).send({ success: false, message: 'Tagihan untuk lisensi ini tidak ditemukan.' });
            }
            const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return reply.status(400).send({ success: false, message: 'Format base64 gambar bukti bayar tidak valid.' });
            }
            const fileExtension = matches[1].split('/')[1] || 'png';
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');
            const fs = require('fs');
            const path = require('path');
            const uploadDir = path.join(__dirname, '../../public/uploads/receipts');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            const filename = `${lastInvoice.invoiceNumber}_${Date.now()}.${fileExtension}`;
            const targetPath = path.join(uploadDir, filename);
            fs.writeFileSync(targetPath, buffer);
            const relativePath = `/uploads/receipts/${filename}`;
            await helpers_1.prisma.invoice.update({
                where: { id: lastInvoice.id },
                data: { paymentProof: relativePath }
            });
            await (0, logger_1.logLicenseActivity)(license_key, license.productId, clientIp, 'RECEIPT_UPLOAD_SUCCESS');
            return reply.send({
                success: true,
                message: 'Bukti transfer berhasil diunggah! Mohon tunggu konfirmasi admin.',
                data: {
                    payment_proof: relativePath
                }
            });
        }
        catch (err) {
            console.error('[RECEIPT UPLOAD ERROR]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengunggah gambar bukti transfer di server.' });
        }
    });
    // 8. Download APK
    fastify.get('/download-apk', async (request, reply) => {
        const fs = require('fs');
        const path = require('path');
        const apkPath = path.join(__dirname, '../../public/Orkestrator Ujian.apk');
        const clientIp = request.ip;
        if (fs.existsSync(apkPath)) {
            console.log(`[Download APK] ✓ Serving local static APK instantly to ${clientIp}`);
            try {
                const metaPath = path.join(__dirname, '../../public/build-meta.json');
                let meta = { downloadCount: 0 };
                if (fs.existsSync(metaPath)) {
                    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                }
                meta.downloadCount = (meta.downloadCount || 0) + 1;
                fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
            }
            catch (e) {
                console.error('[Download APK Counter Error]', e.message);
            }
            return reply.sendFile('Orkestrator Ujian.apk');
        }
        return reply.status(404).send({ success: false, message: 'File APK tidak ditemukan di server.' });
    });
};
exports.registerPaymentLicenseRoutes = registerPaymentLicenseRoutes;
