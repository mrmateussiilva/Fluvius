import React, { useEffect, useRef } from 'react';
import type { Message, Conversation } from '../api/client';
import { MessageInput } from './MessageInput';
import { User, Check, CheckCheck, Clock, UserCheck, CheckCircle2, RotateCcw } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MessagePanelProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  onSendMedia: (media: string, mediaType: string, mimetype: string, caption?: string) => void;
  conversation: Conversation;
  onAssign: () => void;
  onResolve: () => void;
  onPending: () => void;
}

export const MessagePanel: React.FC<MessagePanelProps> = ({
  messages,
  onSendMessage,
  onSendMedia,
  conversation,
  onAssign,
  onResolve,
  onPending,
}) => {
  const endRef = useRef<HTMLDivElement>(null);

  const contactName = conversation.contact?.name || conversation.contact?.phone || 'Unknown Contact';
  const contactPhone = conversation.contact?.phone || '';

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={12} className="text-slate-400" />;
      case 'sent': return <Check size={14} className="text-slate-400" />;
      case 'delivered': return <CheckCheck size={14} className="text-slate-400" />;
      case 'read': return <CheckCheck size={14} className="text-blue-500" />;
      case 'failed': return <span className="text-red-500 text-xs">!</span>;
      default: return null;
    }
  };

  const renderActionBar = () => {
    switch (conversation.status) {
      case 'pending':
        return (
          <button
            onClick={onAssign}
            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-500 text-white rounded-full text-sm font-medium hover:bg-indigo-600 transition-colors shadow-sm"
          >
            <UserCheck size={16} />
            Assumir
          </button>
        );
      case 'open':
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={onPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              <RotateCcw size={14} />
              Devolver à fila
            </button>
            <button
              onClick={onResolve}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 text-white rounded-full text-sm font-medium hover:bg-emerald-600 transition-colors shadow-sm"
            >
              <CheckCircle2 size={16} />
              Resolver
            </button>
          </div>
        );
      case 'resolved':
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle2 size={14} />
              Resolvida
            </span>
            <button
              onClick={onAssign}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              Reabrir
            </button>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-w-0 relative">
      {/* Texture */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none z-0"
        style={{
          backgroundImage: 'url("https://web.whatsapp.com/img/bg-chat-tile-dark_a4be512e7195b6b733d9110b408f075d.png")',
          backgroundSize: '400px',
        }}
      />

      {/* Header */}
      <div className="h-16 flex items-center justify-between px-5 bg-white border-b border-slate-200 z-10 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shrink-0">
            {conversation.contact?.avatar_url ? (
              <img src={conversation.contact.avatar_url} alt={contactName} className="w-full h-full rounded-full object-cover" />
            ) : (
              <User size={18} />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 text-sm leading-tight">{contactName}</h2>
            {contactPhone && <p className="text-xs text-slate-400">{contactPhone}</p>}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-3 shrink-0">
          {conversation.assignee && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              <User size={12} />
              {conversation.assignee.name}
            </div>
          )}
          {renderActionBar()}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 z-10 flex flex-col">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-400 text-sm">Nenhuma mensagem ainda.</p>
          </div>
        )}
        {messages.map((msg) => {
          const isOutbound = msg.direction === 'outbound';
          const timeString = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          const renderMessageContent = () => {
            switch (msg.message_type) {
              case 'image':
                return (
                  <div className="space-y-1">
                    {msg.media_url && (
                      <img
                        src={msg.media_url}
                        alt="Imagem do WhatsApp"
                        className="rounded-lg max-w-full cursor-pointer hover:opacity-95 transition-opacity"
                        onClick={() => window.open(msg.media_url!, '_blank')}
                      />
                    )}
                    {msg.content && <div className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.content}</div>}
                  </div>
                );
              case 'audio':
                return (
                  <div className="min-w-[200px] py-1">
                    <audio controls className="h-8 w-full">
                      <source src={msg.media_url || ''} type={msg.mime_type || 'audio/ogg'} />
                    </audio>
                  </div>
                );
              case 'video':
                return (
                  <div className="space-y-1">
                    <video controls className="rounded-lg max-w-full">
                      <source src={msg.media_url || ''} type={msg.mime_type || 'video/mp4'} />
                    </video>
                    {msg.content && <div className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.content}</div>}
                  </div>
                );
              case 'document':
                return (
                  <a
                    href={msg.media_url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-2 bg-slate-50/50 rounded-lg border border-slate-200 text-indigo-600 hover:bg-slate-100 transition-colors"
                  >
                    <span className="text-xs font-medium truncate max-w-[150px]">{msg.content || 'Documento'}</span>
                  </a>
                );
              default:
                return <div className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</div>;
            }
          };

          return (
            <div
              key={msg.id}
              className={cn(
                "flex w-full mb-2",
                isOutbound ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[75%] px-3 py-2 rounded-2xl relative shadow-sm",
                  isOutbound
                    ? "bg-emerald-100 text-slate-800 rounded-tr-sm"
                    : "bg-white text-slate-800 rounded-tl-sm"
                )}
              >
                {renderMessageContent()}
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  <span className="text-[10px] text-slate-400">{timeString}</span>
                  {isOutbound && renderStatusIcon(msg.status)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} className="h-2" />
      </div>

      {/* Input — disable if resolved */}
      <div className="z-10 shrink-0">
        {conversation.status === 'resolved' ? (
          <div className="bg-slate-100 px-4 py-3 text-center text-sm text-slate-500 border-t border-slate-200">
            Esta conversa foi resolvida. Reabra para responder.
          </div>
        ) : (
          <MessageInput onSend={onSendMessage} onSendMedia={onSendMedia} />
        )}
      </div>
    </div>
  );
};
