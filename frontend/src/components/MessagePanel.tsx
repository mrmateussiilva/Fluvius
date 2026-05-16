import React, { useEffect, useRef, useState } from 'react';
import { updateContactTags, suggestReply, type Message, type Conversation, type Contact } from '../api/client';
import { MessageInput } from './MessageInput';
import { 
  User, Check, CheckCheck, Clock, UserCheck, CheckCircle2, 
  RotateCcw, Upload, Reply, Play, Pause, Plus, X, Eye, 
  FileText, AlertCircle, MessageSquare
} from 'lucide-react';
import { useAgent } from '../context/AgentContext';
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
  onTransfer?: () => void;
  onContactUpdated?: (contact: Contact) => void;
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
  onTransfer,
  onContactUpdated,
  replyingTo,
  onSetReplyingTo,
}) => {
  const { currentAgent } = useAgent();
  const isSpectator = !!(conversation.assignee_id && currentAgent && conversation.assignee_id !== currentAgent.id);
  
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ file: File; preview: string; type: string } | null>(null);
  const [newTag, setNewTag] = useState('');
  const [isUpdatingTags, setIsUpdatingTags] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const contactName = conversation.contact?.name || conversation.contact?.phone || 'Desconhecido';
  const contactPhone = conversation.contact?.phone || '';
  const contactTags = conversation.contact?.tags || [];

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
      case 'pending': return <Clock size={10} className="text-slate-400" />;
      case 'sent': return <Check size={12} className="text-slate-400" />;
      case 'delivered': return <CheckCheck size={12} className="text-slate-400" />;
      case 'read': return <CheckCheck size={12} className="text-fluvius-blue-main" />;
      case 'failed': return <AlertCircle size={10} className="text-rose-500" />;
      default: return null;
    }
  };

  const updateTags = async (tags: string[]) => {
    if (!conversation.contact) return;
    setIsUpdatingTags(true);
    try {
      const updatedContact = await updateContactTags(conversation.contact.id, tags);
      onContactUpdated?.(updatedContact);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingTags(false);
    }
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const tag = newTag.trim();
    if (!tag || contactTags.some(existing => existing.toLowerCase() === tag.toLowerCase())) {
      setNewTag('');
      return;
    }
    setNewTag('');
    await updateTags([...contactTags, tag]);
  };

  const handleRemoveTag = async (tag: string) => {
    await updateTags(contactTags.filter(existing => existing !== tag));
  };

  const renderActionBar = () => {
    if (isSpectator) {
      return (
        <button
          onClick={onAssign}
          className="flex items-center gap-2 px-5 py-2 bg-fluvius-gradient text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-md active:scale-95"
        >
          <UserCheck size={18} />
          Assumir Atendimento
        </button>
      );
    }

    switch (conversation.status) {
      case 'pending':
        return (
          <button
            onClick={onAssign}
            className="flex items-center gap-2 px-5 py-2 bg-fluvius-gradient text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-md active:scale-95"
          >
            <UserCheck size={18} />
            Assumir
          </button>
        );
        case 'open':
          return (
            <div className="flex items-center gap-2">
              {onTransfer && (
                <button
                  onClick={onTransfer}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors active:scale-95"
                >
                  Transferir
                </button>
              )}
              <button
                onClick={onPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors active:scale-95"
              >
                <RotateCcw size={16} />
                Devolver
              </button>
              <button
                onClick={onResolve}
                className="flex items-center gap-2 px-5 py-2 bg-fluvius-gradient text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-md active:scale-95"
              >
                <CheckCircle2 size={18} />
                Resolver
              </button>
            </div>
          );
      case 'resolved':
        return (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100">
              <CheckCircle2 size={14} />
              Resolvida
            </div>
            <button
              onClick={onAssign}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
            >
              Reabrir
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className="flex-1 flex flex-col min-w-0 relative bg-[#F4F7F9]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none z-0"
        style={{
          backgroundImage: 'url("https://web.whatsapp.com/img/bg-chat-tile-dark_a4be512e7195b6b733d9110b408f075d.png")',
          backgroundSize: '400px',
        }}
      />

      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-fluvius-blue-main/5 backdrop-blur-[4px] flex items-center justify-center border-4 border-dashed border-fluvius-blue-main/30 m-6 rounded-[32px]"
          >
            <div className="bg-white p-10 rounded-[32px] shadow-2xl flex flex-col items-center gap-5 border border-slate-100">
              <div className="w-20 h-20 bg-fluvius-blue-main/10 text-fluvius-blue-main rounded-full flex items-center justify-center shadow-inner">
                <Upload size={40} className="animate-bounce" />
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-slate-800">Solte para enviar</p>
                <p className="text-sm text-slate-500 font-medium mt-1">Imagens, vídeos ou documentos</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {previewFile && (
        <MediaPreviewModal
          file={previewFile.file}
          preview={previewFile.preview}
          type={previewFile.type}
          onClose={() => setPreviewFile(null)}
          onSend={handleFinalSend}
        />
      )}

      <div className="h-[76px] flex items-center justify-between px-8 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 z-20 shrink-0 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="relative group cursor-pointer">
            <div className="w-[46px] h-[46px] rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 shadow-sm border-2 border-white overflow-hidden transition-transform group-hover:scale-105">
              {conversation.contact?.avatar_url ? (
                <img src={conversation.contact.avatar_url} alt={contactName} className="w-full h-full object-cover" />
              ) : (
                <User size={24} />
              )}
            </div>
            <span className={cn(
              "absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-[2.5px] border-white shadow-sm",
              conversation.status === 'open' ? 'bg-emerald-500' : 'bg-amber-500'
            )} />
          </div>
          
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-black text-slate-800 text-[16px] leading-tight tracking-tight">{contactName}</h2>
              {conversation.assignee && (
                <span className="hidden md:flex items-center gap-1 text-[10px] font-black text-fluvius-blue-main bg-fluvius-blue-main/5 px-2 py-0.5 rounded-full uppercase tracking-wider border border-fluvius-blue-main/10">
                   {conversation.assignee.name}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              {contactTags.length > 0 ? (
                contactTags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-100/80 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200/50 transition-colors hover:bg-slate-200/80 group"
                  >
                    #{tag}
                    {!isSpectator && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        disabled={isUpdatingTags}
                        className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all ml-0.5"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-slate-400 font-medium italic">Sem etiquetas</span>
              )}
              {conversation.contact && !isSpectator && (
                <form onSubmit={handleAddTag} className="inline-flex items-center h-5 rounded-lg border border-dashed border-slate-300 bg-white/50 hover:bg-white transition-all overflow-hidden pl-1 pr-0.5 group-focus-within:border-fluvius-blue-main">
                  <input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    disabled={isUpdatingTags}
                    maxLength={30}
                    placeholder="Add tag"
                    className="w-14 bg-transparent text-[10px] outline-none text-slate-600 font-bold placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={isUpdatingTags}
                    className="h-4 w-4 flex items-center justify-center text-slate-400 hover:text-fluvius-blue-main hover:bg-slate-100 rounded-md transition-all"
                  >
                    <Plus size={10} />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {renderActionBar()}
        </div>
      </div>

      {isSpectator && (
        <div className="bg-indigo-600 px-6 py-2 flex items-center justify-center gap-3 z-20 shrink-0 shadow-lg">
          <Eye size={16} className="text-white animate-pulse" />
          <span className="text-xs font-black text-white uppercase tracking-widest">
            Modo Espectador &bull; Atendimento de {conversation.assignee?.name}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 z-10 flex flex-col gap-4 fluvius-scroll pb-10">
        <AnimatePresence mode="popLayout">
          {messages.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center py-20"
            >
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 mb-4">
                <MessageSquare size={32} className="text-slate-200" />
              </div>
              <p className="text-slate-400 text-sm font-medium">Inicie uma conversa agora</p>
            </motion.div>
          ) : (
            messages.map((msg, index) => {
              const isOutbound = msg.direction === 'outbound';
              const timeString = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const isSameSenderAsPrev = index > 0 && messages[index-1].direction === msg.direction;

              const renderMessageContent = () => {
                const mediaUrl = msg.media_url?.startsWith('/') ? `${UPLOADS_BASE_URL}${msg.media_url}` : msg.media_url;
                switch (msg.message_type) {
                  case 'audio':
                    return <AudioPlayer src={mediaUrl || ''} />;
                  case 'video':
                    return (
                      <div className="space-y-2">
                        <div className="relative rounded-2xl overflow-hidden shadow-sm border border-black/5 bg-black">
                          <video controls className="w-full max-w-sm block">
                            <source src={mediaUrl || ''} type={msg.mime_type || 'video/mp4'} />
                          </video>
                        </div>
                        {msg.content && <p className="text-sm leading-relaxed font-medium px-1">{msg.content}</p>}
                      </div>
                    );
                  case 'image':
                    return (
                      <div className="space-y-2">
                        <img
                          src={mediaUrl || ''}
                          alt="Mídia"
                          className="rounded-2xl max-w-sm w-full shadow-sm border border-black/5 cursor-pointer hover:scale-[1.01] transition-transform"
                          onClick={() => window.open(mediaUrl || '', '_blank')}
                        />
                        {msg.content && <p className="text-sm leading-relaxed font-medium px-1">{msg.content}</p>}
                      </div>
                    );
                  case 'document':
                    return (
                      <a
                        href={mediaUrl || ''}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 p-3 bg-white/50 rounded-xl border border-black/5 hover:bg-white transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-indigo-500 text-white flex items-center justify-center">
                          <FileText size={20} />
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="text-sm font-bold text-slate-800 truncate max-w-[200px]">Documento</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase">Download</p>
                        </div>
                      </a>
                    );
                  default:
                    return (
                      <p className="text-[14.5px] leading-[1.6] whitespace-pre-wrap font-medium tracking-tight">
                        {msg.content}
                      </p>
                    );
                }
              };

              return (
                <motion.div
                  key={msg.id}
                  layout
                  initial={{ opacity: 0, x: isOutbound ? 10 : -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "flex flex-col max-w-[75%] sm:max-w-[65%]",
                    isOutbound ? "self-end items-end" : "self-start items-start",
                    isSameSenderAsPrev ? "mt-[-8px]" : "mt-2"
                  )}
                >
                  <div className={cn(
                    "relative px-4 py-3 shadow-sm transition-all group",
                    isOutbound 
                      ? "bg-fluvius-gradient text-white rounded-2xl rounded-tr-none shadow-blue-500/10" 
                      : "bg-white text-slate-800 rounded-2xl rounded-tl-none border border-slate-100 shadow-slate-200/50"
                  )}>
                    {msg.quoted_content && (
                      <div className={cn(
                        "rounded-lg p-2 mb-2 border-l-4 text-[12px] opacity-80",
                        isOutbound ? "bg-white/10 border-white/30" : "bg-slate-50 border-fluvius-blue-main"
                      )}>
                        <span className="truncate block">{msg.quoted_content}</span>
                      </div>
                    )}
                    {renderMessageContent()}
                    <div className={cn(
                      "flex items-center gap-1 mt-1 justify-end",
                      isOutbound ? "text-white/70" : "text-slate-400"
                    )}>
                      <span className="text-[9px] font-black uppercase tracking-tighter">{timeString}</span>
                      {isOutbound && renderStatusIcon(msg.status)}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      <div className="px-6 pb-6 pt-2 z-20">
        <div className="bg-white/80 backdrop-blur-xl rounded-[24px] shadow-2xl shadow-blue-500/5 border border-slate-200/50 p-2 overflow-hidden">
          <MessageInput
            onSend={onSendMessage}
            onSendMedia={onSendMedia}
            conversationId={conversation.id}
            replyingTo={replyingTo}
            onCancelReply={() => onSetReplyingTo?.(null)}
          />
        </div>
      </div>
    </div>
  );
};
