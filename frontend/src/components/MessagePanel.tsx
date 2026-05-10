import React, { useEffect, useRef, useState } from 'react';
import type { Message, Conversation } from '../api/client';
import { MessageInput } from './MessageInput';
import { User, Check, CheckCheck, Clock, UserCheck, CheckCircle2, RotateCcw, Upload, Reply, Play, Pause } from 'lucide-react';
import { MediaPreviewModal } from './MediaPreviewModal';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { API_BASE_URL } from '../api/client';

const UPLOADS_BASE_URL = API_BASE_URL.replace('/api', '');

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const AudioPlayer: React.FC<{ src: string }> = ({ src }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="min-w-[240px] py-1 flex items-center gap-3">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
      <button 
        onClick={togglePlay}
        className="w-10 h-10 bg-fluvius-blue-main/10 text-fluvius-blue-main rounded-full flex items-center justify-center hover:bg-fluvius-blue-main/20 transition-colors shrink-0"
      >
        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
      </button>
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="h-1 bg-slate-200 rounded-full w-full relative">
          <div 
            className="absolute left-0 top-0 h-full bg-fluvius-blue-main rounded-full transition-all duration-100" 
            style={{ width: `${progress}%` }} 
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

interface MessagePanelProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  onSendMedia: (media: string, mediaType: string, mimetype: string, caption?: string) => void;
  conversation: Conversation;
  onAssign: () => void;
  onResolve: () => void;
  onPending: () => void;
  replyingTo?: Message | null;
  onSetReplyingTo?: (msg: Message | null) => void;
}

export const MessagePanel: React.FC<MessagePanelProps> = ({
  messages,
  onSendMessage,
  onSendMedia,
  conversation,
  onAssign,
  onResolve,
  onPending,
  replyingTo,
  onSetReplyingTo,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ file: File; preview: string; type: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const contactName = conversation.contact?.name || conversation.contact?.phone || 'Unknown Contact';
  const contactPhone = conversation.contact?.phone || '';

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (conversation.status === 'resolved') return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (conversation.status === 'resolved') return;

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    let type = 'document';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('audio/')) type = 'audio';
    else if (file.type.startsWith('video/')) type = 'video';

    const preview = URL.createObjectURL(file);
    setPreviewFile({ file, preview, type });
  };

  const handleFinalSend = (caption: string) => {
    if (!previewFile) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      onSendMedia(base64String, previewFile.type, previewFile.file.type, caption);
      setPreviewFile(null);
    };
    reader.readAsDataURL(previewFile.file);
  };

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
            className="flex items-center gap-2 px-4 py-1.5 bg-fluvius-gradient text-white rounded-[12px] text-sm font-medium hover:opacity-90 transition-all shadow-sm"
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
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#DCE7F0] text-[#64748B] rounded-[12px] text-sm font-medium hover:bg-[#F8FAFC] transition-colors"
              >
                <RotateCcw size={14} />
                Devolver à fila
              </button>
              <button
                onClick={onResolve}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-fluvius-gradient text-white rounded-[12px] text-sm font-medium hover:opacity-90 transition-all shadow-sm"
              >
                <CheckCircle2 size={16} />
                Resolver
              </button>
            </div>
          );
      case 'resolved':
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-fluvius-text-sec font-medium flex items-center gap-1">
              <CheckCircle2 size={14} />
              Resolvida
            </span>
            <button
              onClick={onAssign}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-fluvius-border text-fluvius-text-sec rounded-[12px] text-sm font-medium hover:bg-fluvius-bg transition-colors"
            >
              Reabrir
            </button>
          </div>
        );
    }
  };

  return (
    <div 
      className="flex-1 flex flex-col min-w-0 relative"
      style={{ background: 'radial-gradient(circle at top right, rgba(30, 167, 255, 0.08), transparent 32%), radial-gradient(circle at bottom left, rgba(52, 211, 153, 0.08), transparent 28%), linear-gradient(180deg, #F8FAFC 0%, #F1F7FB 100%)' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Texture */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none z-0"
        style={{
          backgroundImage: 'url("https://web.whatsapp.com/img/bg-chat-tile-dark_a4be512e7195b6b733d9110b408f075d.png")',
          backgroundSize: '400px',
        }}
      />

      {/* Drag & Drop Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-fluvius-blue-main/10 backdrop-blur-[2px] flex items-center justify-center border-2 border-dashed border-fluvius-blue-main m-4 rounded-[24px]"
          >
            <div className="bg-white p-8 rounded-[24px] shadow-2xl flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-fluvius-surface text-fluvius-blue-main rounded-full flex items-center justify-center">
                <Upload size={32} />
              </div>
              <p className="text-lg font-semibold text-fluvius-text-main">Solte o arquivo para enviar</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media Preview Modal (from Drag & Drop) */}
      {previewFile && (
        <MediaPreviewModal
          file={previewFile.file}
          preview={previewFile.preview}
          type={previewFile.type}
          onClose={() => setPreviewFile(null)}
          onSend={handleFinalSend}
        />
      )}

      {/* Header */}
      <div className="h-[72px] flex items-center justify-between px-6 bg-white/80 backdrop-blur-md border-b border-fluvius-border/50 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-fluvius-bg flex items-center justify-center text-fluvius-text-sec shrink-0 shadow-sm border border-fluvius-border/50 overflow-hidden">
            {conversation.contact?.avatar_url ? (
              <img src={conversation.contact.avatar_url} alt={contactName} className="w-full h-full object-cover" />
            ) : (
              <User size={22} />
            )}
          </div>
          <div>
            <h2 className="font-bold text-[#0F172A] text-[15px] leading-tight">{contactName}</h2>
            {contactPhone && <p className="text-xs text-[#64748B] mt-0.5">{contactPhone}</p>}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-3 shrink-0">
          {conversation.assignee && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-fluvius-text-sec bg-fluvius-surface px-2.5 py-1 rounded-full border border-fluvius-border/50">
              <User size={12} />
              {conversation.assignee.name}
            </div>
          )}
          {renderActionBar()}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 z-10 flex flex-col fluvius-scroll">
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
              case 'audio':
                return (
                  <AudioPlayer 
                    src={msg.media_url?.startsWith('/') ? `${UPLOADS_BASE_URL}${msg.media_url}` : msg.media_url || ''} 
                  />
                );
              case 'video':
                const videoSrc = msg.media_url?.startsWith('/') ? `${UPLOADS_BASE_URL}${msg.media_url}` : msg.media_url || '';
                return (
                  <div className="space-y-1 relative group/video">
                    <div className="relative rounded-[16px] overflow-hidden max-w-[520px]">
                      <video 
                        controls 
                        className="w-full bg-black shadow-sm block"
                        poster={videoSrc + '#t=0.1'}
                      >
                        <source src={videoSrc} type={msg.mime_type || 'video/mp4'} />
                      </video>
                    </div>
                    {msg.content && <div className="text-[14px] leading-relaxed whitespace-pre-wrap mt-2">{msg.content}</div>}
                  </div>
                );
              case 'image':
                const imgOriginalSrc = msg.media_url?.startsWith('/') ? `${UPLOADS_BASE_URL}${msg.media_url}` : msg.media_url || '';
                return (
                  <div className="space-y-1">
                    {msg.media_url && (
                      <img
                        src={imgOriginalSrc}
                        alt="Imagem do WhatsApp"
                        className="rounded-[16px] max-w-[520px] w-full overflow-hidden bg-white shadow-sm cursor-pointer hover:opacity-95 transition-opacity"
                        onClick={() => window.open(imgOriginalSrc, '_blank')}
                      />
                    )}
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
                "flex w-full mb-2 group items-center",
                isOutbound ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[75%] px-[12px] py-[10px] relative",
                  isOutbound
                    ? "text-[#0F172A] rounded-[16px_16px_6px_16px]"
                    : "bg-[#FFFFFF] text-[#0F172A] rounded-[16px_16px_16px_6px] border border-[#E2E8F0] shadow-[0_4px_12px_rgba(15,23,42,0.06)]"
                )}
                style={isOutbound ? {
                  background: 'linear-gradient(135deg, #E0F7FF 0%, #DDFBF1 100%)',
                  border: '1px solid rgba(30, 167, 255, 0.14)',
                  boxShadow: '0 4px 12px rgba(30, 167, 255, 0.08)'
                } : undefined}
              >
                {/* Quoted Message Block */}
                {msg.quoted_content && (
                  <div className="bg-black/5 rounded-lg p-2 mb-2 border-l-4 border-fluvius-blue-main text-[13px] opacity-80">
                    <span className="font-semibold block text-xs mb-0.5 opacity-90">Respondendo a</span>
                    <span className="truncate block max-w-[200px] sm:max-w-[300px]">{msg.quoted_content}</span>
                  </div>
                )}
                {renderMessageContent()}
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  <span className="text-[10px] text-slate-400">{timeString}</span>
                  {isOutbound && renderStatusIcon(msg.status)}
                </div>
              </div>
              
              {/* Reply Button on Hover */}
              <div className={cn(
                "opacity-0 group-hover:opacity-100 transition-opacity flex items-center px-2",
                isOutbound ? "order-first" : "order-last"
              )}>
                <button
                  onClick={() => onSetReplyingTo?.(msg)}
                  className="p-1.5 text-slate-400 hover:text-fluvius-blue-main hover:bg-slate-100 rounded-full transition-colors"
                  title="Responder"
                >
                  <Reply size={18} />
                </button>
              </div>
            </div>
          );
        })}
        <div ref={endRef} className="h-2" />
      </div>

      {/* Input — disable if resolved */}
      <div className="z-10 shrink-0">
        {conversation.status === 'resolved' ? (
          <div className="bg-fluvius-surface px-4 py-3 text-center text-sm text-fluvius-text-sec border-t border-fluvius-border">
            Esta conversa foi resolvida. Reabra para responder.
          </div>
        ) : (
          <MessageInput 
            onSend={onSendMessage} 
            onSendMedia={onSendMedia} 
            replyingTo={replyingTo}
            onCancelReply={() => onSetReplyingTo?.(null)}
          />
        )}
      </div>
    </div>
  );
};
