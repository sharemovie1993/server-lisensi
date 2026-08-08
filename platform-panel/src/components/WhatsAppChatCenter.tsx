import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { Search, RefreshCw, MessageSquare, CheckCheck, Smartphone, User, AlertCircle, Image as ImageIcon } from 'lucide-react';

interface Conversation {
  recipient: string;
  schoolName: string;
  lastMessage: string;
  lastStatus: string;
  lastTriggerType: string;
  lastCreatedAt: string;
  totalMessages: number;
}

interface ChatMessage {
  id: string;
  recipient: string;
  message: string;
  status: string; // RECEIVED, SENT, FAILED
  errorMessage?: string | null;
  triggerType: string;
  createdAt: string;
}

export default function WhatsAppChatCenter() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);
  
  // Selected conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedSchoolName, setSelectedSchoolName] = useState<string>('');

  const loadConversations = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/admin/whatsapp/conversations');
      if (res.data?.success) {
        const convs: Conversation[] = res.data.data || [];
        setConversations(convs);
        if (!selectedRecipient && convs.length > 0) {
          setSelectedRecipient(convs[0].recipient);
          setSelectedSchoolName(convs[0].schoolName);
        }
      }
    } catch (e) {
      console.error('Failed to load WA conversations', e);
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (recipient: string) => {
    setMessagesLoading(true);
    try {
      const res = await apiClient.get(`/api/admin/whatsapp/conversations/${recipient}`);
      if (res.data?.success) {
        setMessages(res.data.data || []);
        if (res.data.schoolName) {
          setSelectedSchoolName(res.data.schoolName);
        }
      }
    } catch (e) {
      console.error('Failed to load thread for recipient:', recipient, e);
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedRecipient) {
      loadThread(selectedRecipient);
    }
  }, [selectedRecipient]);

  const filteredConversations = conversations.filter(c => {
    const query = searchQuery.toLowerCase();
    return c.recipient.toLowerCase().includes(query) || c.schoolName.toLowerCase().includes(query) || c.lastMessage.toLowerCase().includes(query);
  });

  const activeConv = conversations.find(c => c.recipient === selectedRecipient);

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDateLabel = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) return 'Hari Ini';
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[750px] text-left">
      
      {/* ── PANEL KIRI: DAFTAR PERCAKAPAN ────────────────────────────────── */}
      <div className="w-full md:w-80 lg:w-96 border-r border-slate-800 flex flex-col bg-slate-950/60">
        
        {/* Header Panel Kiri */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base leading-tight">WhatsApp Center</h3>
              <p className="text-slate-400 text-xs">{conversations.length} Percakapan</p>
            </div>
          </div>
          <button
            onClick={loadConversations}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
            title="Refresh Percakapan"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-800/80">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Cari nama atau nomor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
        </div>

        {/* List Percakapan */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
          {loading && conversations.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">Memuat daftar obrolan...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              {searchQuery ? 'Tidak ada percakapan yang cocok' : 'Belum ada percakapan WhatsApp'}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.recipient === selectedRecipient;
              const initial = conv.schoolName ? conv.schoolName.charAt(0).toUpperCase() : 'W';

              return (
                <button
                  key={conv.recipient}
                  onClick={() => {
                    setSelectedRecipient(conv.recipient);
                    setSelectedSchoolName(conv.schoolName);
                  }}
                  className={`w-full p-3.5 flex items-start gap-3 text-left transition ${
                    isSelected
                      ? 'bg-emerald-950/30 border-l-4 border-emerald-500'
                      : 'hover:bg-slate-800/40'
                  }`}
                >
                  {/* Avatar Inisial */}
                  <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-sm ${
                    isSelected ? 'bg-emerald-600 text-white' : 'bg-indigo-600/80 text-white'
                  }`}>
                    {initial}
                  </div>

                  {/* Body Item */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <h4 className="text-white font-semibold text-xs truncate">{conv.schoolName}</h4>
                      <span className="text-[10px] text-slate-500 shrink-0">{formatTime(conv.lastCreatedAt)}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] truncate leading-tight mb-1">
                      {conv.lastMessage.startsWith('[IMAGE:') ? '📷 Gambar' : (conv.lastMessage || '_Pesan Kosong_')}
                    </p>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 font-mono">{conv.recipient}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                        conv.lastStatus === 'RECEIVED' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        conv.lastStatus === 'SENT' ? 'bg-emerald-500/10 text-emerald-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>
                        {conv.lastStatus}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── PANEL KANAN: THREAD CHAT BUBBLE (WA WEB STYLE) ──────────────────── */}
      <div className="flex-1 flex flex-col bg-[#0b141a] relative">
        
        {selectedRecipient ? (
          <>
            {/* Header Chat Selected */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow">
                  {selectedSchoolName ? selectedSchoolName.charAt(0).toUpperCase() : 'W'}
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm leading-snug">{selectedSchoolName}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-mono text-emerald-400">{selectedRecipient}</span>
                    <span>•</span>
                    <span>{messages.length} Pesan</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => loadThread(selectedRecipient)}
                disabled={messagesLoading}
                className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl transition"
                title="Refresh Thread Chat"
              >
                <RefreshCw className={`w-4 h-4 ${messagesLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Chat Thread Messages View */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:16px_16px]">
              {messagesLoading && messages.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">Memuat riwayat percakapan...</div>
              ) : messages.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">Belum ada riwayat percakapan untuk kontak ini.</div>
              ) : (
                messages.map((msg, index) => {
                  const isIncoming = msg.status === 'RECEIVED' || msg.triggerType === 'INCOMING_CHAT' || msg.triggerType === 'INCOMING_MEDIA';
                  const isMedia = msg.triggerType === 'INCOMING_MEDIA' || msg.message.startsWith('[Media') || msg.message.startsWith('[IMAGE:');
                  const imageMatch = msg.message.match(/^\[IMAGE:(.*?)\](.*)$/);
                  const dateLabel = formatDateLabel(msg.createdAt);
                  const showDate = index === 0 || formatDateLabel(messages[index - 1].createdAt) !== dateLabel;

                  return (
                    <React.Fragment key={msg.id || index}>
                      {showDate && (
                        <div className="flex justify-center my-3">
                          <span className="bg-slate-800/90 text-slate-400 text-[10px] px-3 py-1 rounded-full shadow border border-slate-700/50 uppercase tracking-wide">
                            {dateLabel}
                          </span>
                        </div>
                      )}

                      <div className={`flex ${isIncoming ? 'justify-start' : 'justify-end'} mb-2`}>
                        <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-lg text-xs leading-relaxed ${
                          isIncoming
                            ? 'bg-slate-800 text-slate-100 border border-slate-700/60 rounded-tl-none'
                            : 'bg-[#005c4b] text-emerald-50 rounded-tr-none border border-emerald-600/30'
                        }`}>
                          {/* Indicator trigger type */}
                          {msg.triggerType && (
                            <div className={`text-[9px] font-semibold tracking-wider uppercase mb-1 ${
                              isIncoming ? 'text-blue-400' : 'text-emerald-200/80'
                            }`}>
                              {msg.triggerType.replace(/_/g, ' ')}
                            </div>
                          )}

                          {/* Message Content */}
                          <div className="whitespace-pre-wrap break-words font-sans">
                            {imageMatch ? (
                              <div className="space-y-1.5">
                                <img
                                  src={imageMatch[1]}
                                  alt="WhatsApp Media"
                                  className="max-w-xs md:max-w-sm max-h-72 object-cover rounded-xl border border-slate-700/80 shadow-md cursor-pointer hover:opacity-90 transition"
                                  onClick={() => window.open(imageMatch[1], '_blank')}
                                  title="Klik untuk memperbesar gambar"
                                />
                                {imageMatch[2] && imageMatch[2].trim() && (
                                  <p className="text-slate-100 text-xs pt-1">{imageMatch[2].trim()}</p>
                                )}
                              </div>
                            ) : isMedia ? (
                              <div className="flex items-center gap-2 p-2 bg-black/20 rounded-lg mb-1">
                                <ImageIcon className="w-4 h-4 text-emerald-300" />
                                <span className="italic">{msg.message}</span>
                              </div>
                            ) : (
                              msg.message
                            )}
                          </div>

                          {/* Footer time & status icon */}
                          <div className={`flex items-center justify-end gap-1 text-[9px] mt-1.5 ${
                            isIncoming ? 'text-slate-400' : 'text-emerald-200/70'
                          }`}>
                            <span>{formatTime(msg.createdAt)}</span>
                            {!isIncoming && (
                              <CheckCheck className={`w-3 h-3 ${msg.status === 'SENT' ? 'text-emerald-300' : 'text-red-400'}`} />
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
            </div>

            {/* Read-Only Bottom Banner */}
            <div className="p-3 bg-slate-900 border-t border-slate-800 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-emerald-400" />
              <span>Hanya baca — ini adalah monitor log percakapan chatbot & notifikasi server lisensi</span>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center space-y-3">
            <Smartphone className="w-16 h-16 text-slate-700 stroke-1" />
            <h4 className="text-white text-base font-bold">WhatsApp Center Server Lisensi</h4>
            <p className="text-xs max-w-sm">Pilih percakapan pada daftar di sebelah kiri untuk membaca seluruh riwayat percakapan chatbot & notifikasi.</p>
          </div>
        )}

      </div>

    </div>
  );
}
