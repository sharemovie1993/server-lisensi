"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSettingsRoutes = void 0;
const helpers_1 = require("../license/helpers");
const middleware_1 = require("./middleware");
const registerSettingsRoutes = (fastify) => {
    // GET /api/admin/settings (Get system settings)
    fastify.get('/api/admin/settings', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const list = await helpers_1.prisma.systemSetting.findMany();
            const settings = {};
            list.forEach(row => {
                settings[row.key] = row.value;
            });
            return reply.send({ success: true, data: settings });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal mengambil pengaturan sistem.' });
        }
    });
    // POST /api/admin/settings (Update system settings)
    fastify.post('/api/admin/settings', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const body = request.body;
        try {
            for (const [key, value] of Object.entries(body)) {
                if (value !== undefined && value !== null) {
                    await helpers_1.prisma.systemSetting.upsert({
                        where: { key },
                        update: { value: String(value).trim() },
                        create: { key, value: String(value).trim() }
                    });
                }
            }
            return reply.send({ success: true, message: 'Pengaturan sistem berhasil diperbarui!' });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal memperbarui pengaturan sistem.' });
        }
    });
};
exports.registerSettingsRoutes = registerSettingsRoutes;
