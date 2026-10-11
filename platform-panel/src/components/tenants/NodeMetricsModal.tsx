import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api/apiClient';
import type { Tenant } from '../../types/tenant';
import { 
  X, RefreshCw, Activity, Cpu, Database, Users, 
  Clock, TrendingUp, AlertTriangle, ShieldCheck, 
  BarChart3, Layers, Wifi
} from 'lucide-react';

interface MetricPoint {
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  responseTimeMs: number;
  localLatencyMs: number;
  publicLatencyMs: number;
  requestsCount: number;
  activeUsers: number;
  dbSize: number;
}

interface MetricSummary {
  avgCpu: number;
  maxCpu: number;
  avgMemory: number;
  maxMemory: number;
  avgResponseTime: number;
  maxResponseTime: number;
  totalRequests: number;
  peakUsers: number;
  totalSamples: number;
}

interface NodeMetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant | null;
}

type TimeRange = '1h' | '24h' | '7d' | '30d';

export default function NodeMetricsModal({ isOpen, onClose, tenant }: NodeMetricsModalProps) {
  const [range, setRange] = useState<TimeRange>('24h');
  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState<MetricPoint[]>([]);
  const [summary, setSummary] = useState<MetricSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'latency' | 'system' | 'traffic' | 'all'>('all');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const fetchMetrics = async (targetRange: TimeRange) => {
    if (!tenant) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/api/admin/nodes/${tenant.id}/metrics`, {
        params: { range: targetRange }
      });
      if (res.data?.success) {
        setPoints(res.data.points || []);
        setSummary(res.data.summary || null);
      }
    } catch (err) {
      console.error('Failed to load metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && tenant) {
      fetchMetrics(range);
    } else {
      setPoints([]);
      setSummary(null);
      setHoveredIndex(null);
    }
  }, [isOpen, tenant, range]);

  if (!isOpen || !tenant) return null;

  // Format label sumbu X
  const formatTimeLabel = (isoStr: string) => {
    const d = new Date(isoStr);
    if (range === '1h') {
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    if (range === '24h') {
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Helper render Interactive SVG Area & Line Chart
  const renderLineChart = (
    title: string,
    dataKeys: Array<{ key: keyof MetricPoint; label: string; color: string; unit: string }>,
    maxValOverride?: number
  ) => {
    const width = 640;
    const height = 180;
    const padding = { top: 20, right: 20, bottom: 30, left: 45 };

    if (points.length === 0) {
      return (
        <div className="h-44 flex flex-col items-center justify-center bg-slate-950/40 border border-slate-800/80 rounded-xl text-slate-500 text-xs">
          <Activity className="w-6 h-6 text-slate-600 mb-2 animate-pulse" />
          <span>Belum ada data rekaman pada rentang waktu ini</span>
        </div>
      );
    }

    // Hitung Max Value untuk scaling Y
    let maxVal = maxValOverride || 0;
    if (!maxValOverride) {
      points.forEach(p => {
        dataKeys.forEach(k => {
          const val = Number(p[k.key]) || 0;
          if (val > maxVal) maxVal = val;
        });
      });
      maxVal = maxVal > 0 ? Math.ceil(maxVal * 1.15) : 10;
    }

    const usableWidth = width - padding.left - padding.right;
    const usableHeight = height - padding.top - padding.bottom;

    const getX = (idx: number) => {
      if (points.length <= 1) return padding.left + usableWidth / 2;
      return padding.left + (idx / (points.length - 1)) * usableWidth;
    };

    const getY = (val: number) => {
      const clamped = Math.max(0, Math.min(val, maxVal));
      return padding.top + usableHeight - (clamped / maxVal) * usableHeight;
    };

    const hoveredPoint = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;

    return (
      <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 space-y-2 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <span className="w-1.5 h-3 rounded-full bg-indigo-500 inline-block" />
            {title}
          </span>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            {dataKeys.map((k, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: k.color }} />
                <span>{k.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          <svg 
            viewBox={`0 0 ${width} ${height}`} 
            className="w-full h-auto overflow-visible select-none"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <defs>
              {dataKeys.map((k, i) => (
                <linearGradient key={i} id={`grad-${k.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={k.color} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={k.color} stopOpacity="0.0" />
                </linearGradient>
              ))}
            </defs>

            {/* Grid Lines Horisontal */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const yVal = padding.top + usableHeight * (1 - ratio);
              const labelVal = Math.round(maxVal * ratio);
              return (
                <g key={i}>
                  <line 
                    x1={padding.left} 
                    y1={yVal} 
                    x2={width - padding.right} 
                    y2={yVal} 
                    stroke="rgba(51, 65, 85, 0.3)" 
                    strokeDasharray="3 3" 
                  />
                  <text 
                    x={padding.left - 8} 
                    y={yVal + 3} 
                    textAnchor="end" 
                    fill="#64748b" 
                    fontSize="9" 
                    fontFamily="monospace"
                  >
                    {labelVal}
                  </text>
                </g>
              );
            })}

            {/* Area & Polyline untuk tiap data series */}
            {dataKeys.map((k) => {
              const polyPoints = points.map((p, idx) => `${getX(idx)},${getY(Number(p[k.key]) || 0)}`).join(' ');
              const firstX = getX(0);
              const lastX = getX(points.length - 1);
              const bottomY = padding.top + usableHeight;
              const areaPoints = `${firstX},${bottomY} ${polyPoints} ${lastX},${bottomY}`;

              return (
                <g key={String(k.key)}>
                  <polygon points={areaPoints} fill={`url(#grad-${k.key})`} />
                  <polyline 
                    points={polyPoints} 
                    fill="none" 
                    stroke={k.color} 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />
                </g>
              );
            })}

            {/* Hover vertical crosshair & point indicators */}
            {hoveredIndex !== null && (
              <g>
                <line 
                  x1={getX(hoveredIndex)} 
                  y1={padding.top} 
                  x2={getX(hoveredIndex)} 
                  y2={padding.top + usableHeight} 
                  stroke="#818cf8" 
                  strokeWidth="1.5" 
                  strokeDasharray="2 2" 
                />
                {dataKeys.map((k) => {
                  const val = Number(points[hoveredIndex][k.key]) || 0;
                  return (
                    <circle 
                      key={String(k.key)}
                      cx={getX(hoveredIndex)} 
                      cy={getY(val)} 
                      r="4" 
                      fill="#0f172a" 
                      stroke={k.color} 
                      strokeWidth="2.5" 
                    />
                  );
                })}
              </g>
            )}

            {/* Transparan touch/mouse columns untuk deteksi hover */}
            {points.map((_, idx) => {
              const xPos = getX(idx);
              const colWidth = usableWidth / Math.max(1, points.length);
              return (
                <rect 
                  key={idx}
                  x={xPos - colWidth / 2}
                  y={padding.top}
                  width={colWidth}
                  height={usableHeight}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoveredIndex(idx)}
                />
              );
            })}

            {/* Label Waktu di Sumbu X */}
            {points.length > 0 && (
              <>
                <text 
                  x={padding.left} 
                  y={height - 8} 
                  fill="#64748b" 
                  fontSize="9" 
                  fontFamily="monospace"
                >
                  {formatTimeLabel(points[0].timestamp)}
                </text>
                {points.length > 2 && (
                  <text 
                    x={padding.left + usableWidth / 2} 
                    y={height - 8} 
                    textAnchor="middle" 
                    fill="#64748b" 
                    fontSize="9" 
                    fontFamily="monospace"
                  >
                    {formatTimeLabel(points[Math.floor(points.length / 2)].timestamp)}
                  </text>
                )}
                <text 
                  x={width - padding.right} 
                  y={height - 8} 
                  textAnchor="end" 
                  fill="#64748b" 
                  fontSize="9" 
                  fontFamily="monospace"
                >
                  {formatTimeLabel(points[points.length - 1].timestamp)}
                </text>
              </>
            )}
          </svg>

          {/* Interactive Tooltip Card saat hover */}
          {hoveredPoint && (
            <div className="absolute top-2 right-2 bg-slate-900/95 border border-indigo-500/40 backdrop-blur-md rounded-lg p-2 shadow-2xl text-[10px] space-y-1 pointer-events-none transition-all">
              <div className="text-slate-400 font-mono border-b border-slate-800 pb-1">
                ⏱️ {new Date(hoveredPoint.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} ({new Date(hoveredPoint.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})
              </div>
              {dataKeys.map((k) => (
                <div key={String(k.key)} className="flex items-center justify-between gap-3">
                  <span className="text-slate-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: k.color }} />
                    {k.label}:
                  </span>
                  <span className="font-mono font-bold text-white">
                    {Number(hoveredPoint[k.key]) || 0} {k.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header Modal */}
        <div className="p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Audit Telemetri & Grafik Performa Node
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {tenant.schoolName || 'Server Node'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Domain: <strong className="text-slate-300 font-mono">{tenant.requestedSlug ? `${tenant.requestedSlug}.absenta.id` : (tenant.customDomain || 'Local')}</strong></span>
                <span className="text-slate-600">•</span>
                <span>Mode: <strong className="text-indigo-400 uppercase">{tenant.networkMode || tenant.deployMode || 'HYBRID'}</strong></span>
                {(tenant.activeHostname || tenant.hostname) && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="font-mono text-slate-400">Host: {tenant.activeHostname || tenant.hostname}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Rentang Waktu (1 Jam, 24 Jam, 7 Hari, 30 Hari) */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {(['1h', '24h', '7d', '30d'] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 rounded-lg font-medium transition ${
                    range === r 
                      ? 'bg-indigo-600 text-white shadow-xs font-semibold' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r === '1h' && '1 Jam'}
                  {r === '24h' && '24 Jam'}
                  {r === '7d' && '7 Hari'}
                  {r === '30d' && '30 Hari'}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchMetrics(range)}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition disabled:opacity-50"
              title="Refresh metrik"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Card 1: HTTP Latency */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" /> Latensi HTTP
                </span>
                <span className="text-[10px] text-slate-500 font-mono">P95 / Avg</span>
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold font-mono text-white">
                  {summary?.avgResponseTime ? `${summary.avgResponseTime}` : '0'}
                </span>
                <span className="text-xs text-slate-400">ms</span>
              </div>
              <p className="text-[10.5px] text-slate-500 font-mono">
                Puncak: <strong className="text-rose-400">{summary?.maxResponseTime || 0}ms</strong>
              </p>
            </div>

            {/* Card 2: CPU */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-amber-400" /> Beban CPU
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Avg</span>
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold font-mono text-white">
                  {summary?.avgCpu ? `${summary.avgCpu}` : '0'}
                </span>
                <span className="text-xs text-slate-400">%</span>
              </div>
              <p className="text-[10.5px] text-slate-500 font-mono">
                Puncak: <strong className="text-amber-400">{summary?.maxCpu || 0}%</strong>
              </p>
            </div>

            {/* Card 3: RAM */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-emerald-400" /> Pemakaian RAM
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Avg</span>
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold font-mono text-white">
                  {summary?.avgMemory ? `${summary.avgMemory}` : '0'}
                </span>
                <span className="text-xs text-slate-400">MB</span>
              </div>
              <p className="text-[10.5px] text-slate-500 font-mono">
                Puncak: <strong className="text-emerald-400">{summary?.maxMemory || 0}MB</strong>
              </p>
            </div>

            {/* Card 4: Requests & Peak Users */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-sky-400" /> Volume Beban
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Reqs</span>
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold font-mono text-white">
                  {summary?.totalRequests ? summary.totalRequests.toLocaleString('id-ID') : '0'}
                </span>
                <span className="text-xs text-slate-400">req</span>
              </div>
              <p className="text-[10.5px] text-slate-500 font-mono">
                Peak User: <strong className="text-sky-400">{summary?.peakUsers || 0} akun</strong>
              </p>
            </div>
          </div>

          {/* Sub Tab Pemilih Kategori Grafik */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  activeTab === 'all' 
                    ? 'bg-slate-800 text-white font-bold' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Semua Grafik
              </button>
              <button
                onClick={() => setActiveTab('latency')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  activeTab === 'latency' 
                    ? 'bg-slate-800 text-white font-bold' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Latensi & Respons (Split DNS)
              </button>
              <button
                onClick={() => setActiveTab('system')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  activeTab === 'system' 
                    ? 'bg-slate-800 text-white font-bold' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                Hardware (CPU & RAM)
              </button>
              <button
                onClick={() => setActiveTab('traffic')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  activeTab === 'traffic' 
                    ? 'bg-slate-800 text-white font-bold' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
                Trafik & Pengguna Aktif
              </button>
            </div>

            <span className="text-[11px] text-slate-500 font-mono">
              {points.length} titik sampel ({range})
            </span>
          </div>

          {/* Konten Grafik Sesuai Tab */}
          <div className="space-y-4">
            {(activeTab === 'all' || activeTab === 'latency') && (
              renderLineChart(
                'Waktu Respons HTTP (Rata-rata ms)',
                [
                  { key: 'responseTimeMs', label: 'Total Avg (ms)', color: '#818cf8', unit: 'ms' },
                  { key: 'localLatencyMs', label: 'LAN / Lokal (ms)', color: '#34d399', unit: 'ms' },
                  { key: 'publicLatencyMs', label: 'Publik / Internet (ms)', color: '#f59e0b', unit: 'ms' },
                ]
              )
            )}

            {(activeTab === 'all' || activeTab === 'system') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderLineChart(
                  'Beban CPU (%)',
                  [
                    { key: 'cpuUsage', label: 'CPU Usage', color: '#f59e0b', unit: '%' }
                  ],
                  100
                )}
                {renderLineChart(
                  'Pemakaian RAM (MB)',
                  [
                    { key: 'memoryUsage', label: 'Memory (RAM)', color: '#10b981', unit: 'MB' }
                  ]
                )}
              </div>
            )}

            {(activeTab === 'all' || activeTab === 'traffic') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderLineChart(
                  'Volume Permintaan / Request HTTP',
                  [
                    { key: 'requestsCount', label: 'Jumlah Request', color: '#38bdf8', unit: 'req' }
                  ]
                )}
                {renderLineChart(
                  'Pengguna Aktif (Concurrent Users)',
                  [
                    { key: 'activeUsers', label: 'Active Users', color: '#ec4899', unit: 'user' }
                  ]
                )}
              </div>
            )}
          </div>

          {/* Catatan / Keterangan Audit */}
          <div className="p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-xl flex items-start gap-3 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-300">Pencatatan Rolling Window 2-Menit:</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Data latensi dan beban dikumpulkan secara real-time dari middleware sistem di node server dan dikirimkan setiap siklus 2 menit. 
                Data di-reset per siklus untuk memastikan setiap lonjakan (peak) performa terekam dengan akurat tanpa teredam oleh data lama.
              </p>
            </div>
          </div>

        </div>

        {/* Footer Modal */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Perekaman metrik aktif</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
