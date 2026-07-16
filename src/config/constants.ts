export const INVOICE_EXPIRY_SECONDS = 48 * 3600;       // 172800 (48 hours)
export const TRIPAY_EXPIRY_SECONDS  = 24 * 3600;       // 86400 (24 hours)
export const JWT_EXPIRY             = '365d';
export const ADMIN_JWT_EXPIRY       = '7d';
export const HEARTBEAT_TIMEOUT_MS   = 5 * 60 * 1000;   // 5 minutes
export const HEARTBEAT_OFFLINE_MS   = 15 * 60 * 1000;  // 15 minutes
export const ASSIST_TOKEN_EXPIRY     = '15m';

export const TIER_VALUES = ['MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'] as const;

export const INVOICE_PREFIX_STANDARD = 'INV-ORK-';
export const INVOICE_PREFIX_LOCAL    = 'INV-LOC-';

export const FREE_LICENSE_EXPIRY     = '2099-12-31';
export const FREE_LICENSE_PLAN_ID    = 'FREE_LICENSE_SERVER_ACTIVATION';

export const NODE_PRODUCT_IDS        = ['cakola', 'easy-tunnel'];
export const BYTES_PER_GB            = 1024 * 1024 * 1024;

export const PLAN_DURATION_DAYS: Record<string, number> = {
  MONTHLY: 30,
  QUARTERLY: 90,
  SEMI: 180,
  YEARLY: 365,
  ETERNAL: 3650
};
