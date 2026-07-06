import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';

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

interface SupportChatBubbleProps {
  message: SupportTicketMessage;
  isNew?: boolean;
  isOutgoing?: boolean;
}

export default function SupportChatBubble({ message, isNew = false, isOutgoing = false }: SupportChatBubbleProps) {
  const isCS = message.senderRole === 'SUPPORT' || message.senderRole === 'SUPERADMIN' || message.sender === 'agent' || message.sender_type === 'SUPPORT';
  const [isHighlighted, setIsHighlighted] = useState(isNew);
  const [checkStatus, setCheckStatus] = useState<'sent' | 'delivered' | 'read'>('read');

  useEffect(() => {
    if (isNew) {
      setIsHighlighted(true);
      const timer = setTimeout(() => {
        setIsHighlighted(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  const msgTime = message.createdAt || message.created_at;

  useEffect(() => {
    if (isOutgoing || isCS) {
      const messageAgeMs = Date.now() - new Date(msgTime).getTime();
      
      if (messageAgeMs < 1000) {
        setCheckStatus('sent');
        
        const deliverTimer = setTimeout(() => {
          setCheckStatus('delivered');
        }, 1200);

        const readTimer = setTimeout(() => {
          setCheckStatus('read');
        }, 3200);

        return () => {
          clearTimeout(deliverTimer);
          clearTimeout(readTimer);
        };
      } else if (messageAgeMs < 3200) {
        setCheckStatus('delivered');
        
        const readTimer = setTimeout(() => {
          setCheckStatus('read');
        }, 3200 - messageAgeMs);

        return () => clearTimeout(readTimer);
      } else {
        setCheckStatus('read');
      }
    }
  }, [isOutgoing, isCS, msgTime]);

  const isInternal = message.is_internal === true;

  const renderCheckmarks = () => {
    if (isInternal) return null;
    if (!isOutgoing) return null;

    if (checkStatus === 'sent') {
      return (
        <svg viewBox="0 0 16 15" width="11" height="10" className="inline-block align-middle ml-1 text-slate-400 fill-current opacity-60">
          <path d="M15.01 3.3a.75.75 0 0 1 .08 1.06l-8 9a.75.75 0 0 1-1.12.01l-4.5-5a.75.75 0 1 1 1.12-1l3.92 4.36 7.42-8.35a.75.75 0 0 1 1.08-.08z" />
        </svg>
      );
    }

    if (checkStatus === 'delivered') {
      return (
        <svg viewBox="0 0 16 15" width="13" height="11" className="inline-block align-middle ml-1 text-slate-400 fill-current opacity-60">
          <path d="M11.01 3.3a.75.75 0 0 1 .08 1.06l-6.2 6.98-3.08-3.42a.75.75 0 1 0-1.12 1l3.64 4.05a.75.75 0 0 0 1.12-.01l6.76-7.6a.75.75 0 0 1 1.08-.08zm4.08 0a.75.75 0 0 1 .08 1.06l-8 9a.75.75 0 0 1-1.12.01l-2.08-2.31a.75.75 0 1 1 1.12-1l1.52 1.69 7.42-8.35a.75.75 0 0 1 1.08-.08z" />
        </svg>
      );
    }

    return (
      <svg viewBox="0 0 16 15" width="13" height="11" className="inline-block align-middle ml-1 text-[#53bdeb] fill-current animate-scale-in">
        <path d="M11.01 3.3a.75.75 0 0 1 .08 1.06l-6.2 6.98-3.08-3.42a.75.75 0 1 0-1.12 1l3.64 4.05a.75.75 0 0 0 1.12-.01l6.76-7.6a.75.75 0 0 1 1.08-.08zm4.08 0a.75.75 0 0 1 .08 1.06l-8 9a.75.75 0 0 1-1.12.01l-2.08-2.31a.75.75 0 1 1 1.12-1l1.52 1.69 7.42-8.35a.75.75 0 0 1 1.08-.08z" />
      </svg>
    );
  };

  const bubbleText = message.message || message.messageContent || '';

  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} w-full mb-2.5`}>
      <div className={`flex items-start max-w-[75%] relative ${isHighlighted ? 'animate-pulse' : ''}`}>
        
        <div className="flex flex-col space-y-1 w-full text-left">
          <div className={`p-3 pb-5 rounded-xl text-[13px] font-semibold leading-relaxed shadow-sm transition-all duration-1000 relative ${
            isInternal
              ? 'bg-[#fffbeb] text-amber-950 border border-amber-200/80 rounded-tr-none shadow-sm'
              : isOutgoing 
                ? 'bg-[#d9fdd3] text-slate-800 border border-[#b2e5a6]/40 rounded-tr-none' 
                : 'bg-white text-slate-800 border border-slate-200/60 rounded-tl-none'
          } ${isHighlighted ? 'bg-amber-100/90 text-amber-950 border-amber-300' : ''}`}>
            
            {isInternal && (
              <div className="flex items-center space-x-1 text-[10px] font-extrabold text-amber-700 mb-1.5 tracking-wider uppercase">
                <Shield className="w-3.5 h-3.5 text-amber-600 fill-amber-100" />
                <span>🔒 Catatan Internal Staf</span>
              </div>
            )}

            <p className="whitespace-pre-wrap pr-14 break-words">{bubbleText}</p>
            
            <span className="absolute bottom-1 right-2.5 text-[9px] text-slate-400 flex items-center space-x-0.5 selection:bg-transparent">
              <span>{new Date(msgTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
              {renderCheckmarks()}
            </span>
            
          </div>
        </div>

      </div>
    </div>
  );
}
