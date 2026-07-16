"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProductRoutes = void 0;
const helpers_1 = require("../license/helpers");
const middleware_1 = require("./middleware");
const registerProductRoutes = (fastify) => {
    // GET /api/admin/products (List all products)
    fastify.get('/api/admin/products', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const list = await helpers_1.prisma.product.findMany({
                orderBy: { name: 'asc' }
            });
            return reply.send({ success: true, data: list });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar produk.' });
        }
    });
    // POST /api/admin/products (Create new product)
    fastify.post('/api/admin/products', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { id, name, prefix } = request.body;
        if (!id || !name || !prefix)
            return reply.status(400).send({ success: false, message: 'ID, Nama, dan Prefix produk wajib diisi.' });
        try {
            const newProduct = await helpers_1.prisma.product.create({
                data: { id: id.trim(), name: name.trim(), prefix: prefix.trim().toUpperCase() }
            });
            return reply.send({ success: true, data: newProduct });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal membuat produk: ' + err.message });
        }
    });
    // PUT /api/admin/products/:id (Update product)
    fastify.put('/api/admin/products/:id', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { id } = request.params;
        const { name, prefix } = request.body;
        try {
            const updated = await helpers_1.prisma.product.update({
                where: { id },
                data: { name: name?.trim(), prefix: prefix?.trim().toUpperCase() }
            });
            return reply.send({ success: true, data: updated });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal memperbarui produk: ' + err.message });
        }
    });
    // DELETE /api/admin/products/:id (Delete product)
    fastify.delete('/api/admin/products/:id', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { id } = request.params;
        try {
            await helpers_1.prisma.product.delete({ where: { id } });
            return reply.send({ success: true, message: 'Produk berhasil dihapus.' });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal menghapus produk: ' + err.message });
        }
    });
    // GET /api/admin/plans (List all plans)
    fastify.get('/api/admin/plans', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const list = await helpers_1.prisma.plan.findMany({
                orderBy: { id: 'asc' },
                include: { product: true }
            });
            return reply.send({ success: true, data: list });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar paket: ' + err.message });
        }
    });
    // POST /api/admin/plans (Create new plan)
    fastify.post('/api/admin/plans', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { id, productId, name, priceMonthly, priceYearly, deviceLimit, featuresJson, billingPeriod, isActive, moduleId, serviceCode } = request.body;
        if (!id || !productId || !name || priceMonthly === undefined || priceYearly === undefined || deviceLimit === undefined) {
            return reply.status(400).send({ success: false, message: 'Kolom-kolom utama wajib diisi.' });
        }
        try {
            const newPlan = await helpers_1.prisma.plan.create({
                data: {
                    id: id.trim(),
                    productId: productId.trim(),
                    name: name.trim(),
                    priceMonthly: Number(priceMonthly),
                    priceYearly: Number(priceYearly),
                    deviceLimit: Number(deviceLimit),
                    featuresJson: Array.isArray(featuresJson) ? featuresJson : [],
                    billingPeriod: billingPeriod || 'MONTH',
                    isActive: isActive !== false,
                    moduleId: moduleId || null,
                    serviceCode: serviceCode || null
                }
            });
            return reply.send({ success: true, data: newPlan });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal membuat paket: ' + err.message });
        }
    });
    // PUT /api/admin/plans/:id (Update plan)
    fastify.put('/api/admin/plans/:id', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { id } = request.params;
        const { productId, name, priceMonthly, priceYearly, deviceLimit, featuresJson, billingPeriod, isActive, moduleId, serviceCode } = request.body;
        try {
            const updated = await helpers_1.prisma.plan.update({
                where: { id },
                data: {
                    productId: productId?.trim(),
                    name: name?.trim(),
                    priceMonthly: priceMonthly !== undefined ? Number(priceMonthly) : undefined,
                    priceYearly: priceYearly !== undefined ? Number(priceYearly) : undefined,
                    deviceLimit: deviceLimit !== undefined ? Number(deviceLimit) : undefined,
                    featuresJson: Array.isArray(featuresJson) ? featuresJson : undefined,
                    billingPeriod: billingPeriod,
                    isActive: isActive,
                    moduleId: moduleId,
                    serviceCode: serviceCode
                }
            });
            return reply.send({ success: true, data: updated });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal memperbarui paket: ' + err.message });
        }
    });
    // DELETE /api/admin/plans/:id (Delete plan)
    fastify.delete('/api/admin/plans/:id', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { id } = request.params;
        try {
            await helpers_1.prisma.plan.delete({ where: { id } });
            return reply.send({ success: true, message: 'Paket berhasil dihapus.' });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal menghapus paket: ' + err.message });
        }
    });
};
exports.registerProductRoutes = registerProductRoutes;
