import React from 'react';
import type { Tenant } from '../../types/tenant';
import { isTenantOnline } from '../../utils/tenant';

interface TelemetryStatusIconProps {
  tenant: Tenant;
}

export default function TelemetryStatusIcon({ tenant }: TelemetryStatusIconProps) {
  // Offline -> Gray/Dark dot
  if (!tenant.lastHeartbeatAt || !isTenantOnline(tenant.lastHeartbeatAt)) {
    return (
      <span 
        className="h-2.5 w-2.5 rounded-full flex-shrink-0 bg-slate-650 border border-slate-600" 
        title="Offline / Disconnected" 
      />
    );
  }

  // RAM Kritis (> 85%) -> Merah Berkedip Cepat
  if (tenant.memoryUsage && tenant.memoryUsage > 0.85) {
    return (
      <span 
        className="h-2.5 w-2.5 rounded-full flex-shrink-0 bg-rose-500 animate-pulse border border-rose-400" 
        title={`Online | RAM Kritis: ${(tenant.memoryUsage * 100).toFixed(0)}%`} 
      />
    );
  }

  // RAM tinggi (> 70%) -> Kuning Berkedip Lambat
  if (tenant.memoryUsage && tenant.memoryUsage > 0.70) {
    return (
      <span 
        className="h-2.5 w-2.5 rounded-full flex-shrink-0 bg-amber-500 animate-pulse border border-amber-400" 
        title={`Online | RAM Tinggi: ${(tenant.memoryUsage * 100).toFixed(0)}%`} 
      />
    );
  }

  // RAM normal -> Hijau Sehat
  return (
    <span 
      className="h-2.5 w-2.5 rounded-full flex-shrink-0 bg-emerald-500 animate-pulse border border-emerald-400" 
      title="Online | Sehat" 
    />
  );
}
