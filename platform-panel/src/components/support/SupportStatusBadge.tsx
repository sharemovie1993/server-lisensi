import React from 'react';
import { CheckCircle, X } from 'lucide-react';

interface SupportStatusBadgeProps {
  status: string;
}

export default function SupportStatusBadge({ status }: SupportStatusBadgeProps) {
  const normalized = status?.toUpperCase();
  switch (normalized) {
    case 'OPEN':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 animate-ping"></span>
          NEW OPEN
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>
          HANDLING
        </span>
      );
    case 'PENDING_CUSTOMER':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse"></span>
          SLA WAITING
        </span>
      );
    case 'RESOLVED':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle size={10} className="mr-1" />
          RESOLVED
        </span>
      );
    case 'CLOSED':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-300">
          <X size={10} className="mr-1" />
          CLOSED
        </span>
      );
    default:
      // Fallback fallback if status is open or other lowercase variations
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 animate-ping"></span>
          {normalized || 'OPEN'}
        </span>
      );
  }
}
