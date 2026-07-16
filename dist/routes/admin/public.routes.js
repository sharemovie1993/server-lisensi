"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPublicRoutes = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const helpers_1 = require("../license/helpers");
const settings_service_1 = require("../../config/settings.service");
const registerPublicRoutes = (fastify) => {
    // GET /api/public/validate-domain (Public check for Caddy on-demand TLS)
    fastify.get('/api/public/validate-domain', async (request, reply) => {
        const query = request.query;
        const domain = query.domain;
        if (!domain) {
            return reply.status(400).send('Domain parameter required');
        }
        const cleanDomain = domain.trim().toLowerCase();
        const dbMainDomain = await (0, settings_service_1.getSetting)('main_domain', 'absenta.id');
        const MAIN_DOMAIN = (process.env.MAIN_DOMAIN || dbMainDomain).toLowerCase();
        // 1. Allow main domain and its platform subdomains
        if (cleanDomain === MAIN_DOMAIN || cleanDomain === `www.${MAIN_DOMAIN}` || cleanDomain === `api.${MAIN_DOMAIN}`) {
            return reply.status(200).send('OK');
        }
        // 2. Allow registered active platform subdomains (*.absenta.id)
        if (cleanDomain.endsWith(`.${MAIN_DOMAIN}`)) {
            const slug = cleanDomain.replace(`.${MAIN_DOMAIN}`, '');
            try {
                const lic = await helpers_1.prisma.license.findFirst({
                    where: { requestedSlug: slug, isActive: 1 }
                });
                if (lic) {
                    return reply.status(200).send('OK');
                }
            }
            catch (e) { }
        }
        // 3. Allow registered active custom domains (e.g. absensi.tefatjkt.net)
        try {
            const lic = await helpers_1.prisma.license.findFirst({
                where: { customDomain: cleanDomain, isActive: 1 }
            });
            if (lic) {
                return reply.status(200).send('OK');
            }
        }
        catch (e) { }
        return reply.status(404).send('Domain not found or inactive');
    });
    // GET /api/public/release/check (Public check for latest product releases)
    fastify.get('/api/public/release/check', async (_request, reply) => {
        try {
            const manifestPath = path_1.default.join(__dirname, '../../public/releases/manifest.json');
            if (fs_1.default.existsSync(manifestPath)) {
                const manifestContent = fs_1.default.readFileSync(manifestPath, 'utf8');
                const manifest = JSON.parse(manifestContent);
                return reply.send({
                    success: true,
                    ...manifest
                });
            }
            else {
                return reply.status(404).send({
                    success: false,
                    message: 'Release manifest not found'
                });
            }
        }
        catch (err) {
            return reply.status(500).send({
                success: false,
                message: 'Failed to read release manifest: ' + err.message
            });
        }
    });
};
exports.registerPublicRoutes = registerPublicRoutes;
