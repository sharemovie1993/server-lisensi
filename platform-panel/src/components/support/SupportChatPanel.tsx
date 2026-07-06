import React, { useState } from 'react';
import { 
  Send, 
  CheckCircle, 
  AlertCircle, 
  MessageSquare, 
  FileText, 
  User,
  Shield,
  Paperclip,
  Zap
} from 'lucide-react';
import SupportStatusBadge from './SupportStatusBadge';
import SupportPriorityBadge from './SupportPriorityBadge';
import SupportChatBubble from './SupportChatBubble';
import SupportScrollToBottomButton from './SupportScrollToBottomButton';

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

interface SupportTicketMessage {
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

const QUICK_REPLIES = [
  {
    label: '👋 Sapa Klien / Greeting',
    text: 'Halo Bapak/Ibu, terima kasih telah menghubungi customer support Absenta.id. Ada yang bisa kami bantu hari ini?'
  },
  {
    label: '🔍 Verifikasi Bug / Kendala',
    text: 'Laporan kendala Anda telah kami terima dan saat ini sedang kami teruskan ke tim teknis untuk dilakukan pengecekan mendalam. Kami akan segera memberikan update kembali.'
  },
  {
    label: '💳 Konfirmasi Pembayaran',
    text: 'Pembayaran manual Anda telah kami verifikasi secara manual. Masa aktif lisensi dan modul langganan sekolah Anda akan terupdate secara otomatis di dasbor.'
  },
  {
    label: '✅ Kendala Diperbaiki / Solved',
    text: 'Kami informasikan bahwa kendala sistem yang Anda laporkan sebelumnya telah berhasil kami perbaiki. Silakan dicoba kembali pada sistem Anda.'
  },
  {
    label: '🛠️ Perawatan Server / Maintenance',
    text: 'Saat ini sedang dilakukan pemeliharaan sistem terjadwal pada cluster database server lisensi. Beberapa fitur mungkin akan mengalami kendala akses sementara waktu.'
  }
];

export interface SupportChatPanelProps {
  selectedTicket: SupportTicket;
  messages: SupportTicketMessage[];
  replyMessage: string;
  setReplyMessage: (msg: string) => void;
  isSubmittingMessage: boolean;
  handleReplyMessage: (e: React.FormEvent) => void;
  isScrollAtBottom: boolean;
  setIsScrollAtBottom: (val: boolean) => void;
  liveUnreadCount: number;
  setLiveUnreadCount: (val: number) => void;
  handleResolveTicket: (id: string) => void;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}

export default function SupportChatPanel({
  selectedTicket,
  messages,
  replyMessage,
  setReplyMessage,
  isSubmittingMessage,
  handleReplyMessage,
  isScrollAtBottom,
  setIsScrollAtBottom,
  liveUnreadCount,
  setLiveUnreadCount,
  handleResolveTicket,
  chatContainerRef,
  chatEndRef
}: SupportChatPanelProps) {
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  const parseAttachments = (att: any): string[] => {
    if (!att) return [];
    if (Array.isArray(att)) return att;
    if (typeof att === 'string') {
      try {
        return JSON.parse(att);
      } catch (_) {
        return [att];
      }
    }
    return [];
  };

  const handleSelectQuickReply = (text: string) => {
    setReplyMessage(text);
    setShowQuickReplies(false);
  };

  const isClosed = selectedTicket.status?.toUpperCase() === 'CLOSED' || selectedTicket.status?.toUpperCase() === 'RESOLVED';
  const ticketNum = selectedTicket.id.substring(0, 8).toUpperCase();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full shadow-2xl overflow-hidden min-h-0 text-left">
      {/* Header Obrolan CS */}
      <div className="px-5 py-4 bg-slate-950 flex items-center justify-between border-b border-slate-800">
        <div className="space-y-1 flex-1 pr-4">
          <div className="flex items-center space-x-2">
            <span className="text-[9px] font-black tracking-widest text-indigo-400 uppercase bg-indigo-950 px-2 py-0.5 rounded border border-indigo-900">
              {ticketNum}
            </span>
            <span className="text-slate-650">•</span>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase">
              {selectedTicket.category || 'TECHNICAL'}
            </span>
          </div>
          <h2 className="text-xs font-black text-white line-clamp-1">{selectedTicket.subject}</h2>
        </div>
        <div className="flex items-center space-x-3">
          <SupportStatusBadge status={selectedTicket.status} />
          {!isClosed && (
            <button
              onClick={() => handleResolveTicket(selectedTicket.id)}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-semibold flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <CheckCircle className="w-3 h-3" />
              Selesaikan
            </button>
          )}
        </div>
      </div>

      {/* Box Deskripsi Keluhan Awal */}
      <div className="p-4 bg-slate-950/30 border-b border-slate-850 flex items-start space-x-3">
        <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl mt-0.5 border border-indigo-500/10">
          <FileText size={16} />
        </div>
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center justify-between text-[9px] font-bold text-slate-500">
            <span>DESKRIPSI ADUAN AWAL</span>
            <span>{new Date(selectedTicket.createdAt).toLocaleString('id-ID')}</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-semibold whitespace-pre-wrap">
            {selectedTicket.description}
          </p>

          {/* Initial attachments */}
          {parseAttachments(selectedTicket.attachments).length > 0 && (
            <div className="pt-1 flex flex-wrap gap-1.5">
              {parseAttachments(selectedTicket.attachments).map((url, idx) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-indigo-400 hover:border-indigo-500 transition font-mono"
                >
                  <Paperclip className="w-3 h-3" />
                  File_{idx + 1}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Area Obrolan Chat Thread */}
      <div className="relative flex-1 flex flex-col min-h-0 bg-slate-900">
        <div 
          ref={chatContainerRef}
          onScroll={(e) => {
            const target = e.currentTarget;
            const atBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 120;
            setIsScrollAtBottom(atBottom);
            if (atBottom) {
              setLiveUnreadCount(0);
            }
          }}
          className="flex-1 p-4 overflow-y-auto space-y-4 max-h-[360px] min-h-[220px] shadow-inner"
          style={{
            backgroundColor: '#efeae2',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='%23e5ddd5' fill-opacity='0.4'%3E%3Cpath fill-rule='evenodd' d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm1-61c3.148 0 5.7-2.552 5.7-5.7 0-3.148-2.552-5.7-5.7-5.7-3.148 0-5.7 2.552-5.7 5.7 0 3.148 2.552 5.7 5.7 5.7zm43-3c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM25 61c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm21 21c3.148 0 5.7-2.552 5.7-5.7 0-3.148-2.552-5.7-5.7-5.7-3.148 0-5.7 2.552-5.7 5.7 0 3.148 2.552 5.7 5.7 5.7zm-19-8c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm43-15c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z'/%3E%3C/g%3E%3C/svg%3E")`
          }}
        >
          {messages.length === 0 ? (
            <div className="text-center text-slate-500 py-10 flex-grow flex flex-col items-center justify-center bg-white/80 rounded-xl p-6 shadow-sm border border-slate-200">
              <MessageSquare className="w-8 h-8 text-slate-400 mb-2" />
              <span>Belum ada percakapan penyelesaian.</span>
            </div>
          ) : (
            messages.map((msg) => {
              const isAgent = msg.senderRole === 'SUPPORT' || msg.senderRole === 'SUPERADMIN' || msg.sender === 'agent' || msg.sender_type === 'SUPPORT';
              return (
                <SupportChatBubble 
                  key={msg.id}
                  message={msg} 
                  isOutgoing={isAgent} 
                />
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>

        {/* CSAT Rating card if resolved/closed */}
        {(selectedTicket.rating || selectedTicket.ratingComment) && (
          <div className="m-4 p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-1 bg-slate-950 text-left">
            <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wider block">Ulasan Kepuasan Klien (CSAT):</span>
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    className={`w-4 h-4 ${star <= (selectedTicket.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-slate-500 text-[10px] font-mono font-bold">({selectedTicket.rating} / 5)</span>
            </div>
            {selectedTicket.ratingComment && (
              <p className="text-slate-350 text-xs italic">"{selectedTicket.ratingComment}"</p>
            )}
          </div>
        )}

        {/* Floating Scroll to Bottom Button */}
        <SupportScrollToBottomButton
          show={!isScrollAtBottom}
          unreadCount={liveUnreadCount}
          onClick={() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setLiveUnreadCount(0);
            setIsScrollAtBottom(true);
          }}
        />
      </div>

      {/* Reply Input Box */}
      {!isClosed ? (
        <div className="relative border-t border-slate-800">
          {/* Quick replies dropdown */}
          {showQuickReplies && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50 transition-all max-h-48 overflow-y-auto text-left">
              <div className="p-2 bg-slate-900 border-b border-slate-850 flex items-center justify-between">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Zap size={9} className="text-amber-400" />
                  Template Balasan Cepat
                </span>
                <button onClick={() => setShowQuickReplies(false)} className="text-[9px] text-slate-500 hover:text-slate-350">
                  Tutup
                </button>
              </div>
              <div className="divide-y divide-slate-850">
                {QUICK_REPLIES.map((reply, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectQuickReply(reply.text)}
                    className="w-full text-left p-2.5 hover:bg-indigo-600/10 text-[11px] transition cursor-pointer"
                  >
                    <span className="font-extrabold text-indigo-400 block mb-0.5 text-xs">{reply.label}</span>
                    <span className="text-slate-500 line-clamp-1 text-[10px]">{reply.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleReplyMessage} className="p-3 bg-slate-950 flex flex-col gap-2">
            <div className="flex gap-2 justify-start items-center">
              <button
                type="button"
                onClick={() => setShowQuickReplies(!showQuickReplies)}
                className="px-2 py-0.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-indigo-400 hover:text-indigo-300 rounded-lg text-[9px] font-black flex items-center gap-1 uppercase tracking-wider transition cursor-pointer"
              >
                <Zap size={10} className="text-amber-400" />
                Balasan Cepat
              </button>
            </div>

            <div className="flex gap-2.5">
              <input
                type="text"
                required
                placeholder="Ketik balasan solusi admin..."
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-855 rounded-xl text-white placeholder-slate-650 text-xs focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSubmittingMessage}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/25 disabled:opacity-50 cursor-pointer text-xs"
              >
                <Send className="w-3.5 h-3.5" />
                Kirim
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/80 text-center text-emerald-450 text-[9px] font-black tracking-wider flex items-center justify-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5" />
          TIKET TELAH DISELESAIKAN (RESOLVED) DAN DITUTUP.
        </div>
      )}
    </div>
  );
}
