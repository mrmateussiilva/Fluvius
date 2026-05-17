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
      case 'sent': return <Check size={10} className="text-slate-400" />;
      case 'delivered': return <CheckCheck size={10} className="text-slate-400" />;
      case 'read': return <CheckCheck size={10} className="text-blue-500" />;
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
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-[11px] font-bold uppercase tracking-wider hover:bg-blue-700 transition-all"
        >
          <UserCheck size={14} />
          Claim
        </button>
      );
    }

    switch (conversation.status) {
      case 'pending':
        return (
          <button
            onClick={onAssign}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-[11px] font-bold uppercase tracking-wider hover:bg-blue-700 transition-all"
          >
            <UserCheck size={14} />
            Claim
          </button>
        );
        case 'open':
          return (
            <div className="flex items-center gap-2">
              {onTransfer && (
                <button
                  onClick={onTransfer}
                  className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded text-[11px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors"
                >
                  Transfer
                </button>
              )}
              <button
                onClick={onPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded text-[11px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors"
              >
                <RotateCcw size={14} />
                Return
              </button>
              <button
                onClick={onResolve}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded text-[11px] font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all"
              >
                <CheckCircle2 size={14} />
                Resolve
              </button>
            </div>
          );
      case 'resolved':
        return (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600 px-2 py-1 bg-emerald-50 rounded">
              <CheckCircle2 size={12} />
              Resolved
            </div>
            <button
              onClick={onAssign}
              className="text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition-colors"
            >
              Reopen
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className="flex-1 flex flex-col min-w-0 relative bg-slate-50 overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-blue-500/10 flex items-center justify-center border-2 border-dashed border-blue-500/30 m-4 rounded-xl"
          >
            <div className="bg-white p-8 rounded-lg shadow-xl flex flex-col items-center gap-4">
              <Upload size={32} className="text-blue-500" />
              <p className="text-sm font-bold text-slate-700 uppercase tracking-widest">Drop to send</p>
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

      {/* Header - Minimalist & Functional */}
      <div className="h-14 flex items-center justify-between px-6 bg-white border-b border-slate-200 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200/50">
            {conversation.contact?.avatar_url ? (
              <img src={conversation.contact.avatar_url} alt={contactName} className="w-full h-full object-cover rounded" />
            ) : (
              <User size={20} className="opacity-40" />
            )}
          </div>
          
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-slate-800 text-[14px] leading-tight">{contactName}</h2>
              {conversation.assignee && (
                <span className="text-[9px] font-bold text-blue-600 px-1.5 py-0.5 bg-blue-50 rounded uppercase tracking-wider">
                   {conversation.assignee.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {renderActionBar()}
        </div>
      </div>

      {isSpectator && (
        <div className="bg-slate-800 px-6 py-1.5 flex items-center justify-center gap-2 z-20 shrink-0">
          <Eye size={12} className="text-slate-400" />
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.1em]">
            Viewing Mode &bull; Handled by <span className="text-blue-400">{conversation.assignee?.name}</span>
          </span>
        </div>
      )}

      {/* Messages Feed - High Density */}
      <div className="flex-1 overflow-y-auto p-6 z-10 flex flex-col gap-4 fluvius-scroll pb-8">
        <AnimatePresence mode="popLayout">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
              <MessageSquare size={32} className="mb-4" />
              <p className="text-[11px] font-bold uppercase tracking-widest">Start a conversation</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isOutbound = msg.direction === 'outbound';
              const timeString = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const isSameSenderAsPrev = index > 0 && messages[index-1].direction === msg.direction;

              const isMedia = msg.message_type === 'image' || msg.message_type === 'video';

              const renderMessageContent = () => {
                const mediaUrl = msg.media_url?.startsWith('/') ? `${UPLOADS_BASE_URL}${msg.media_url}` : msg.media_url;
                switch (msg.message_type) {
                  case 'audio':
                    return <AudioPlayer src={mediaUrl || ''} />;
                  case 'video':
                    return (
                      <div className="flex flex-col">
                        <div className="bg-black overflow-hidden rounded-sm">
                          <video controls className="w-full max-w-[440px] block max-h-[500px]">
                            <source src={mediaUrl || ''} type={msg.mime_type || 'video/mp4'} />
                          </video>
                        </div>
                        {msg.content && (
                          <div className="px-4 py-3">
                            <p className="text-[13px] leading-relaxed font-medium tracking-tight">{msg.content}</p>
                          </div>
                        )}
                      </div>
                    );
                  case 'image':
                    return (
                      <div className="flex flex-col">
                        <div className="overflow-hidden rounded-sm">
                          <img
                            src={mediaUrl || ''}
                            alt="Media"
                            className="w-full max-w-[440px] h-auto max-h-[500px] object-cover cursor-pointer hover:opacity-95 transition-opacity block"
                            onClick={() => window.open(mediaUrl || '', '_blank')}
                          />
                        </div>
                        {msg.content && (
                          <div className="px-4 py-3">
                            <p className="text-[13px] leading-relaxed font-medium tracking-tight">{msg.content}</p>
                          </div>
                        )}
                      </div>
                    );
                  case 'document':
                    return (
                      <a
                        href={mediaUrl || ''}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors m-1"
                      >
                        <FileText size={20} className="text-slate-400" />
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-slate-700 truncate max-w-[200px]">Document</p>
                          <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Download</p>
                        </div>
                      </a>
                    );
                  default:
                    return (
                      <div className="px-4 py-2.5">
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap font-medium tracking-tight">
                          {msg.content}
                        </p>
                      </div>
                    );
                }
              };

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col max-w-[90%] sm:max-w-[80%]",
                    isOutbound ? "self-end items-end" : "self-start items-start",
                    isSameSenderAsPrev ? "mt-0.5" : "mt-4"
                  )}
                >
                  <div className={cn(
                    "relative overflow-hidden transition-colors shadow-sm group/bubble",
                    isMedia ? "p-1" : "p-0",
                    isOutbound 
                      ? "bg-slate-800 text-white rounded-lg rounded-tr-none" 
                      : "bg-white text-slate-800 rounded-lg rounded-tl-none border border-slate-200"
                  )}>
                    {/* Botão Responder (visível no hover) */}
                    <div className={cn(
                      "absolute top-1 z-10 opacity-0 group-hover/bubble:opacity-100 transition-opacity",
                      isOutbound ? "-left-10" : "-right-10"
                    )}>
                      <button
                        onClick={() => onSetReplyingTo?.(msg)}
                        className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-500 shadow-sm hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Responder"
                      >
                        <Reply size={14} />
                      </button>
                    </div>

                    {msg.quoted_content && (
                      <div className={cn(
                        "rounded p-2 m-2 border-l-2 text-[11px] italic opacity-80",
                        isOutbound ? "bg-black/20 border-white/40" : "bg-slate-50 border-slate-300"
                      )}>
                        "{msg.quoted_content}"
                      </div>
                    )}
                    {renderMessageContent()}
                    <div className={cn(
                      "flex items-center gap-1.5 px-3 pb-1.5 justify-end",
                      isMedia && !msg.content ? "absolute bottom-2 right-2 bg-black/30 backdrop-blur-sm px-1.5 py-0.5 rounded text-white" : "",
                      !isMedia || msg.content ? (isOutbound ? "text-white/60" : "text-slate-400") : "text-white"
                    )}>
                      <span className="text-[9px] font-bold tabular-nums">{timeString}</span>
                      {isOutbound && renderStatusIcon(msg.status)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      {/* Message Input - Integrated & Minimal */}
      <div className="px-6 pb-6 pt-2 shrink-0">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
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
