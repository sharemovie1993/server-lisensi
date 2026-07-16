import { FastifyReply } from 'fastify';

/**
 * Format bytes to human readable GB string.
 */
export function bytesToGB(bytes: number): string {
  if (isNaN(bytes) || bytes === null || bytes === undefined) return '0.0';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1);
}

/**
 * Send a standardized API error response.
 */
export function sendError(reply: FastifyReply, statusCode: number, message: string) {
  return reply.status(statusCode).send({ success: false, message });
}

/**
 * Send a standardized API success response.
 */
export function sendOk(reply: FastifyReply, data?: any, message?: string) {
  const payload: any = { success: true };
  if (data !== undefined) payload.data = data;
  if (message !== undefined) payload.message = message;
  return reply.send(payload);
}
