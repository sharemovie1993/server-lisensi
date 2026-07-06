import React from 'react';

interface SupportPriorityBadgeProps {
  priority: string;
}

export default function SupportPriorityBadge({ priority }: SupportPriorityBadgeProps) {
  const normalized = priority?.toUpperCase();
  switch (normalized) {
    case 'LOW':
      return <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-extrabold border border-slate-200">Low</span>;
    case 'MEDIUM':
      return <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-extrabold border border-blue-200">Medium</span>;
    case 'HIGH':
      return <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 font-extrabold border border-orange-200">High</span>;
    case 'URGENT':
    case 'CRITICAL':
      return <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-extrabold border border-rose-200 animate-pulse">CRITICAL</span>;
    default:
      return <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-extrabold border border-slate-200">{priority}</span>;
  }
}
