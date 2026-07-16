import type { HardwareInfo } from '../types/tenant';
import { POLL_INTERVAL_MS } from '../constants/app';

// 5 minutes heartbeat threshold
export const HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Check if a tenant is online based on its last heartbeat time.
 */
export function isTenantOnline(lastHeartbeatAt?: string | null): boolean {
  if (!lastHeartbeatAt) return false;
  return Date.now() - new Date(lastHeartbeatAt).getTime() < HEARTBEAT_TIMEOUT_MS;
}

/**
 * Parse the pipe-delimited telemetry hardware string.
 */
export function parseHardware(osType?: string | null): HardwareInfo {
  if (!osType) return { os: 'N/A', cpu: 'N/A', ram: 'N/A', disk: 'N/A' };
  if (!osType.includes('|')) return { os: osType, cpu: 'N/A', ram: 'N/A', disk: 'N/A' };
  
  const parts = osType.split('|').map(p => p.trim());
  return {
    os: parts[0] || 'N/A',
    cpu: parts.find(p => p.startsWith('CPU:'))?.replace('CPU:', '').trim() || 'N/A',
    ram: parts.find(p => p.startsWith('RAM:'))?.replace('RAM:', '').trim() || 'N/A',
    disk: parts.find(p => p.startsWith('Storage:'))?.replace('Storage:', '').trim() || 'N/A'
  };
}
