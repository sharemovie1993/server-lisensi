"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeyHandshakeMiddleware = apiKeyHandshakeMiddleware;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function apiKeyHandshakeMiddleware(request, reply) {
    const licenseKey = request.headers['x-license-key'];
    if (!licenseKey || typeof licenseKey !== 'string') {
        return reply.status(401).send({
            success: false,
            message: 'Missing X-License-Key header.'
        });
    }
    // Validate license key against central database
    const license = await prisma.license.findUnique({
        where: { licenseKey }
    });
    if (!license) {
        return reply.status(401).send({
            success: false,
            message: 'Access Denied: Invalid license key.'
        });
    }
    // Attach license metadata to request context for route controller use
    request.license = license;
}
