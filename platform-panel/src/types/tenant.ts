export interface Tenant {
  id: string;
  schoolName: string;
  requestedSlug: string;
  licenseKey: string;
  status: string;
  createdAt: string;
  productId?: string;
  lastHeartbeatAt?: string | null;
  deployMode?: string | null;
  activeUsers?: number | null;
  dbSize?: number | null;
  memoryUsage?: number | null;
  lastTapped?: string | null;
  modules?: string[];
  schools?: Array<{ name: string; subdomain: string | null } | string>;
  hostname?: string | null;
  osType?: string | null;
  activeDevices?: number | null;
  activatedDevices?: Array<{ id: number; deviceId: string; activatedAt: string }>;
  wireguardIp?: string | null;
  is_trial?: boolean;
  nodeType?: string;
}

export interface HardwareInfo {
  os: string;
  cpu: string;
  ram: string;
  disk: string;
}
