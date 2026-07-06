import React from 'react';
import { Search, ChevronRight, HelpCircle, RefreshCw } from 'lucide-react';
import SupportStatusBadge from './SupportStatusBadge';
import SupportPriorityBadge from './SupportPriorityBadge';

interface SupportTicket {
  id: string;
  tenantId: string;
  schoolName?: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  productId?: string;
  attachments?: string[] | any;
  rating?: number | null;
  ratingComment?: string | null;
  requestedSlug?: string;
  licenseKey?: string;
  planId?: string;
  licenseStatus?: string;
}

interface SupportTicketSidebarProps {
  filteredTickets: SupportTicket[];
  selectedTicket: SupportTicket | null;
  unreadTicketIds: Set<string>;
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  filterStatus: string;
  setFilterStatus: (val: string) => void;
  filterCategory: string;
  setFilterCategory: (val: string) => void;
  onSelectTicket: (id: string) => void;
}

export const SupportTicketSidebar: React.FC<SupportTicketSidebarProps> = ({
  filteredTickets,
  selectedTicket,
  unreadTicketIds,
  isLoading,
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
  filterCategory,
  setFilterCategory,
  onSelectTicket
}) => {
  return (
    <div className="flex flex-col space-y-4 h-full min-h-0">
      {/* Search & Filters Card */}
      <div className="flex flex-col space-y-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl text-left">
        {/* Search Input */}
        <div className="relative">
          <label htmlFor="sidebar_search_ticket" className="sr-only">Cari Tiket</label>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
          <input
            id="sidebar_search_ticket"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari sekolah atau nomor tiket..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 text-slate-200 text-xs font-semibold focus:outline-none border border-slate-850 transition"
          />
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-2 gap-2 text-xs font-bold">
          <div className="flex flex-col space-y-1">
            <label htmlFor="sidebar_filter_status" className="text-[10px] text-slate-500 uppercase">Status</label>
            <select
              id="sidebar_filter_status"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-indigo-400 font-bold text-xs focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="OPEN">OPEN</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="PENDING_CUSTOMER">PENDING CLIENT</option>
              <option value="RESOLVED">TERATASI</option>
              <option value="CLOSED">DITUTUP</option>
            </select>
          </div>
          
          <div className="flex flex-col space-y-1">
            <label htmlFor="sidebar_filter_category" className="text-[10px] text-slate-500 uppercase">Kategori</label>
            <select
              id="sidebar_filter_category"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-indigo-400 font-bold text-xs focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="BILLING">Tagihan & Billing</option>
              <option value="TECHNICAL">Kendala Bug/Sistem</option>
              <option value="DEVICE_HARDWARE">Mesin Sensor Gate</option>
              <option value="FEATURE_REQUEST">Request Fitur Baru</option>
              <option value="OTHER">Lainnya</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scrollable list card */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden text-left">
        <div className="px-4 py-3 border-b border-slate-850 bg-slate-950/50 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400">Tiket Terdaftar</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-350 font-extrabold">{filteredTickets.length}</span>
        </div>

        <div className="overflow-y-auto divide-y divide-slate-850 flex-1 min-h-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-2">
              <RefreshCw size={24} className="animate-spin text-indigo-500" />
              <span className="text-xs font-semibold">Memuat aduan...</span>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-3 px-6 text-center">
              <div className="p-3 bg-slate-950 rounded-full border border-slate-850">
                <HelpCircle size={24} className="text-slate-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-350">Tidak Ada Tiket</h3>
                <p className="text-xs text-slate-550 mt-1">Belum ada tiket bantuan yang terdaftar berdasarkan penyaringan filter Anda.</p>
              </div>
            </div>
          ) : (
            filteredTickets.map(t => {
              const isSelected = selectedTicket?.id === t.id;
              const isUnread = unreadTicketIds.has(t.id);
              const ticketNum = t.id.substring(0, 8).toUpperCase();
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTicket(t.id)}
                  className={`w-full text-left p-4 flex items-start space-x-3 transition-all duration-200 relative cursor-pointer border-l-4 ${
                    isSelected 
                      ? 'bg-indigo-950/20 border-indigo-600 pl-3' 
                      : isUnread
                        ? 'bg-amber-950/10 hover:bg-amber-950/20 border-amber-500 pl-3'
                        : 'hover:bg-slate-950/40 border-transparent'
                  }`}
                >
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[9px] font-black text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10 uppercase tracking-wider">{ticketNum}</span>
                        {isUnread && (
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {new Date(t.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    
                    <h4 className={`text-xs font-bold truncate ${isUnread ? 'text-amber-400 font-black' : 'text-slate-200'}`}>{t.subject}</h4>
                    <p className="text-slate-500 text-[10px] truncate">
                      🏫 {t.schoolName || t.tenantId.substring(0, 8)}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <SupportStatusBadge status={t.status} />
                      <SupportPriorityBadge priority={t.priority} />
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-500 mt-2.5 self-start shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
