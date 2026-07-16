"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_DURATION_DAYS = exports.BYTES_PER_GB = exports.NODE_PRODUCT_IDS = exports.FREE_LICENSE_PLAN_ID = exports.FREE_LICENSE_EXPIRY = exports.INVOICE_PREFIX_LOCAL = exports.INVOICE_PREFIX_STANDARD = exports.TIER_VALUES = exports.ASSIST_TOKEN_EXPIRY = exports.HEARTBEAT_OFFLINE_MS = exports.HEARTBEAT_TIMEOUT_MS = exports.ADMIN_JWT_EXPIRY = exports.JWT_EXPIRY = exports.TRIPAY_EXPIRY_SECONDS = exports.INVOICE_EXPIRY_SECONDS = void 0;
exports.INVOICE_EXPIRY_SECONDS = 48 * 3600; // 172800 (48 hours)
exports.TRIPAY_EXPIRY_SECONDS = 24 * 3600; // 86400 (24 hours)
exports.JWT_EXPIRY = '365d';
exports.ADMIN_JWT_EXPIRY = '7d';
exports.HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
exports.HEARTBEAT_OFFLINE_MS = 15 * 60 * 1000; // 15 minutes
exports.ASSIST_TOKEN_EXPIRY = '15m';
exports.TIER_VALUES = ['MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'];
exports.INVOICE_PREFIX_STANDARD = 'INV-ORK-';
exports.INVOICE_PREFIX_LOCAL = 'INV-LOC-';
exports.FREE_LICENSE_EXPIRY = '2099-12-31';
exports.FREE_LICENSE_PLAN_ID = 'FREE_LICENSE_SERVER_ACTIVATION';
exports.NODE_PRODUCT_IDS = ['cakola', 'easy-tunnel'];
exports.BYTES_PER_GB = 1024 * 1024 * 1024;
exports.PLAN_DURATION_DAYS = {
    MONTHLY: 30,
    QUARTERLY: 90,
    SEMI: 180,
    YEARLY: 365,
    ETERNAL: 3650
};
