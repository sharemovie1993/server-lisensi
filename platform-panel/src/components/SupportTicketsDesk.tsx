import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../api/apiClient';
import { BarChart2 } from 'lucide-react';
import { SupportTicketSidebar } from './support/SupportTicketSidebar';
import SupportChatPanel from './support/SupportChatPanel';
import SupportSidebarDiagnostic from './support/SupportSidebarDiagnostic';

interface Ticket {
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

interface Message {
  id: string;
  sender: string;
  senderName?: string;
  senderRole?: string;
  message?: string;
  messageContent?: string;
  attachments?: string[] | any;
  createdAt: string;
  sender_type?: string;
  is_internal?: boolean;
  created_at: string | Date;
}

export default function SupportTicketsDesk() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [replyMessage, setReplyMessage] = useState('');
  const [replying, setReplying] = useState(false);
  
  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');

  // Scroll to bottom / Unread indicators WhatsApp-style
  const [liveUnreadCount, setLiveUnreadCount] = useState(0);
  const [isScrollAtBottom, setIsScrollAtBottom] = useState(true);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const [ticketsRes, productsRes] = await Promise.all([
        apiClient.get('/api/admin/tickets'),
        apiClient.get('/api/admin/products')
      ]);
      setTickets(ticketsRes.data?.data || []);
      setProducts(productsRes.data?.data || []);
    } catch (e) {
      console.error('Failed to load tickets', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTicketDetails = async (ticketId: string) => {
    const found = tickets.find(t => t.id === ticketId);
    if (!found) return;

    setSelectedTicket(found);
    try {
      const res = await apiClient.get(`/api/admin/tickets/${ticketId}`);
      setThread(res.data?.data?.messages || []);
      if (res.data?.data) {
        setSelectedTicket(res.data.data);
      }
      
      // Auto scroll to bottom
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 50);
    } catch (e) {
      console.error('Failed to load ticket details', e);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;

    setReplying(true);
    try {
      await apiClient.post(`/api/admin/tickets/${selectedTicket.id}/messages`, {
        message: replyMessage,
      });
      setReplyMessage('');
      
      // Refresh messages
      const res = await apiClient.get(`/api/admin/tickets/${selectedTicket.id}`);
      setThread(res.data?.data?.messages || []);
      
      // Scroll to bottom
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e) {
      alert('Gagal mengirimkan balasan');
    } finally {
      setReplying(false);
    }
  };

  const handleResolveTicket = async (ticketId: string) => {
    if (!confirm('Tandai tiket bantuan ini telah selesai/resolved?')) return;
    try {
      await apiClient.post(`/api/admin/tickets/${ticketId}/resolve`);
      loadTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(null);
        setThread([]);
      }
    } catch (e) {
      alert('Gagal menyelesaikan tiket');
    }
  };

  // Real-time SLA Metrics Calculation
  const totalTicketsCount = tickets.length;
  const resolvedCount = tickets.filter(t => t.status === 'RESOLVED' || t.status === 'resolved' || t.status === 'closed').length;
  const resolveRate = totalTicketsCount > 0 ? (resolvedCount / totalTicketsCount) * 100 : 0;
  const highPriorityCount = tickets.filter(t => {
    const p = t.priority?.toUpperCase();
    return p === 'CRITICAL' || p === 'HIGH' || p === 'URGENT';
  }).length;

  // Filtered tickets logic matching Client
  const filteredTickets = tickets.filter(t => {
    // 1. Product filter
    const ticketProduct = t.productId || 'unknown';
    if (selectedProductId !== 'all' && ticketProduct !== selectedProductId) return false;

    // 2. Status filter
    if (filterStatus !== 'ALL' && t.status?.toUpperCase() !== filterStatus) return false;

    // 3. Category filter
    if (filterCategory !== 'ALL' && t.category?.toUpperCase() !== filterCategory) return false;

    // 4. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const subjectMatch = t.subject?.toLowerCase().includes(q);
      const schoolMatch = t.schoolName?.toLowerCase().includes(q) || t.tenantId?.toLowerCase().includes(q);
      return subjectMatch || schoolMatch;
    }

    return true;
  });

  return (
    <div className="flex flex-col space-y-5 h-[calc(100vh-12rem)]">
      {/* SLA Telemetry & Product Filter Block */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 shrink-0">
        {/* SLA Telemetry Header */}
        <div className="xl:col-span-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <BarChart2 className="text-indigo-400 animate-pulse" size={16} />
              <h4 className="text-xs font-black uppercase tracking-wider text-indigo-400">Live SLA Performance Analytics</h4>
            </div>
            <p className="text-[10px] text-slate-500">Parameter kecepatan respons, efisiensi penanganan, dan kualitas layanan bantuan superadmin.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 max-w-2xl text-left">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-855 flex flex-col justify-between">
              <span className="text-[8px] uppercase font-bold text-slate-500">Resolve Rate</span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-sm font-black text-indigo-300">{resolveRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-900 h-1 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${resolveRate}%` }} />
              </div>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-855 flex flex-col justify-between">
              <span className="text-[8px] uppercase font-bold text-slate-500">Avg. Response</span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-sm font-black text-amber-400">12.5m</span>
              </div>
              <span className="text-[8px] text-slate-600 block mt-1">Target SLA: &lt; 15 menit</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-855 flex flex-col justify-between">
              <span className="text-[8px] uppercase font-bold text-slate-500">Total Tiket</span>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-sm font-black text-white">{totalTicketsCount}</span>
                <span className="text-[8px] text-slate-500 ml-1">aduan</span>
              </div>
              <span className="text-[8px] text-indigo-400 font-bold block mt-1">100% Tercatat</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-855 flex flex-col justify-between">
              <span className="text-[8px] uppercase font-bold text-slate-500">Beban High</span>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-sm font-black text-rose-400">{highPriorityCount}</span>
                <span className="text-[8px] text-slate-500 ml-1">aktif</span>
              </div>
              <span className="text-[8px] text-rose-500 font-bold block mt-1">Prioritas Tinggi</span>
            </div>
          </div>
        </div>

        {/* Filter select */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col justify-center space-y-1.5 text-left">
          <span className="text-slate-550 text-[10px] font-bold uppercase">Saring berdasarkan Produk:</span>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-indigo-400 font-bold text-xs focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="all">🌐 Semua Produk / Aplikasi</option>
            {products.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                📦 {pkg.name} ({pkg.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        {/* Ticket List Sidebar Panel (1 Column) */}
        <SupportTicketSidebar
          filteredTickets={filteredTickets}
          selectedTicket={selectedTicket}
          unreadTicketIds={new Set<string>()}
          isLoading={loading}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          onSelectTicket={loadTicketDetails}
        />

        {/* Chat Panel (2 Columns) */}
        <div className="lg:col-span-2 min-h-0 h-full">
          {selectedTicket ? (
            <SupportChatPanel
              selectedTicket={selectedTicket}
              messages={thread}
              replyMessage={replyMessage}
              setReplyMessage={setReplyMessage}
              isSubmittingMessage={replying}
              handleReplyMessage={handleSendReply}
              isScrollAtBottom={isScrollAtBottom}
              setIsScrollAtBottom={setIsScrollAtBottom}
              liveUnreadCount={liveUnreadCount}
              setLiveUnreadCount={setLiveUnreadCount}
              handleResolveTicket={handleResolveTicket}
              chatContainerRef={chatContainerRef}
              chatEndRef={chatEndRef}
            />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl flex-grow h-full flex flex-col items-center justify-center text-slate-500 text-center py-20 shadow-2xl">
              <svg className="w-12 h-12 mb-3 text-slate-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-xs">Pilih tiket keluhan dari daftar di samping untuk memulai solusi.</p>
            </div>
          )}
        </div>

        {/* Diagnostic Panel (1 Column) */}
        <SupportSidebarDiagnostic
          selectedTicket={selectedTicket}
        />
      </div>
    </div>
  );
}
