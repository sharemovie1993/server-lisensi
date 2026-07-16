"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bytesToGB = bytesToGB;
exports.sendError = sendError;
exports.sendOk = sendOk;
/**
 * Format bytes to human readable GB string.
 */
function bytesToGB(bytes) {
    if (isNaN(bytes) || bytes === null || bytes === undefined)
        return '0.0';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1);
}
/**
 * Send a standardized API error response.
 */
function sendError(reply, statusCode, message) {
    return reply.status(statusCode).send({ success: false, message });
}
/**
 * Send a standardized API success response.
 */
function sendOk(reply, data, message) {
    const payload = { success: true };
    if (data !== undefined)
        payload.data = data;
    if (message !== undefined)
        payload.message = message;
    return reply.send(payload);
}
