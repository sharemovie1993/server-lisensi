import { FastifyReply, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function apiKeyHandshakeMiddleware(request: FastifyRequest, reply: FastifyReply) {
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
  (request as any).license = license;
}
