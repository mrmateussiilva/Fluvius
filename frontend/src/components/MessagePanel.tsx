import React, { useEffect, useRef, useState } from 'react';
import { updateContactTags, suggestReply, summarizeConversation, analyzeSentiment, type Message, type Conversation, type Contact } from '../api/client';
import { MessageInput } from './MessageInput';
import { 
  User, Check, CheckCheck, Clock, UserCheck, CheckCircle2, 
  RotateCcw, Upload, Reply, Play, Pause, Plus, X, Eye, 
  FileText, AlertCircle, MessageSquare, Sparkles, Loader2, Tag, ChevronRight, ChevronLeft,
  Smile, Meh, Frown, AlertTriangle, RefreshCw, Maximize2, Download
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
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Generate some deterministic random heights for the waveform based on src
  const waveformBars = React.useMemo(() => {
    let seed = 0;
    for (let i = 0; i < src.length; i++) {
      seed = src.charCodeAt(i) + ((seed << 5) - seed);
    }
    const bars = [];
    for (let i = 0; i < 40; i++) {
      const height = 20 + Math.abs((Math.sin(seed + i) * 80));
      bars.push(height);
    }
    return bars;
  }, [src]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const cyclePlaybackRate = () => {
    if (audioRef.current) {
      const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
      audioRef.current.playbackRate = nextRate;
      setPlaybackRate(nextRate);
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
    <div className="min-w-[260px] py-2 flex items-center gap-3">
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
        className="w-10 h-10 bg-fluvius-blue-main text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors shadow-sm shrink-0"
      >
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>
      
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-end gap-0.5 h-6 w-full cursor-pointer relative group" onClick={(e) => {
            if (audioRef.current && duration) {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              audioRef.current.currentTime = pos * duration;
            }
          }}>
          {waveformBars.map((height, i) => {
            const barProgress = (i / waveformBars.length) * 100;
            const isPlayed = progress >= barProgress;
            return (
              <div 
                key={i} 
                className={cn(
                  "flex-1 rounded-full transition-all duration-100",
                  isPlayed ? "bg-fluvius-blue-main" : "bg-slate-200 group-hover:bg-slate-300"
                )} 
                style={{ height: `${height}%`, minHeight: '4px' }} 
              />
            );
          })}
        </div>
        
        <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold tracking-wider mt-1">
          <span className="tabular-nums">{formatTime(currentTime)}</span>
          <div className="flex items-center gap-2">
            <button 
              onClick={cyclePlaybackRate}
              className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[9px] transition-colors"
            >
              {playbackRate}x
            </button>
            <span className="tabular-nums opacity-60">{formatTime(duration)}</span>
          </div>
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
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
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
  onLoadMore,
  hasMore,
  isLoadingMore,
}) => {
  const { currentAgent } = useAgent();
  const isSpectator = !!(conversation.assignee_id && currentAgent && conversation.assignee_id !== currentAgent.id);
  
  const [isDragging, setIsDragging] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<{ file: File; preview: string; type: string }[] | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');
  const [isUpdatingTags, setIsUpdatingTags] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // AI Details Sidebar states
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Sentiment Analysis states
  const [sentiment, setSentiment] = useState<string | null>(null);
  const [isLoadingSentiment, setIsLoadingSentiment] = useState(false);
  const [sentimentError, setSentimentError] = useState<string | null>(null);

  // Contact Notepad state
  const [contactNotes, setContactNotes] = useState('');

  // Load local contact notes
  useEffect(() => {
    if (conversation.contact?.id) {
      const savedNotes = localStorage.getItem(`notes_${conversation.contact.id}`) || '';
      setContactNotes(savedNotes);
    } else {
      setContactNotes('');
    }
  }, [conversation.contact?.id]);

  const handleSaveNotes = (val: string) => {
    setContactNotes(val);
    if (conversation.contact?.id) {
      localStorage.setItem(`notes_${conversation.contact.id}`, val);
    }
  };

  const handleAnalyzeSentiment = async () => {
    setIsLoadingSentiment(true);
    setSentimentError(null);
    try {
      const sentimentResult = await analyzeSentiment(conversation.id);
      setSentiment(sentimentResult);
    } catch (err) {
      setSentimentError(err instanceof Error ? err.message : 'Falha ao analisar sentimento.');
    } finally {
      setIsLoadingSentiment(false);
    }
  };

  // Reset summary and sentiment states when selected conversation changes
  useEffect(() => {
    setSummary(null);
    setSummaryError(null);
    setSentiment(null);
    setSentimentError(null);
  }, [conversation.id]);

  // Auto-trigger sentiment analysis when sidebar is opened
  useEffect(() => {
    if (isSidebarOpen && !sentiment && !isLoadingSentiment && !sentimentError) {
      handleAnalyzeSentiment();
    }
  }, [isSidebarOpen, conversation.id]);

  const handleGenerateSummary = async () => {
    setIsLoadingSummary(true);
    setSummaryError(null);
    try {
      const summaryText = await summarizeConversation(conversation.id);
      setSummary(summaryText);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Falha ao resumir conversa.');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const contactName = conversation.contact?.name || conversation.contact?.phone || 'Desconhecido';
  const contactPhone = conversation.contact?.phone || '';
  const contactTags = conversation.contact?.tags || [];

  // Scroll to bottom only if we are at the bottom or it's a new message
  useEffect(() => {
    if (!isLoadingMore) {
       endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoadingMore]);

  const handleScroll = () => {
    if (containerRef.current) {
      if (containerRef.current.scrollTop === 0 && hasMore && !isLoadingMore && onLoadMore) {
        onLoadMore();
      }
    }
  };

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

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const newPreviewFiles: { file: File; preview: string; type: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let type = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('audio/')) type = 'audio';
      else if (file.type.startsWith('video/')) type = 'video';

      const preview = URL.createObjectURL(file);
      newPreviewFiles.push({ file, preview, type });
    }

    if (newPreviewFiles.length > 0) {
      setPreviewFiles((prev) => prev ? [...prev, ...newPreviewFiles] : newPreviewFiles);
    }
  };

  const handleFinalSend = async (filesToSend: { file: File; preview: string; type: string; caption: string }[]) => {
    setPreviewFiles(null);
    for (const item of filesToSend) {
      try {
        await new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64String = reader.result as string;
              await onSendMedia(base64String, item.type, item.file.type, item.caption);
              resolve();
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
          reader.readAsDataURL(item.file);
        });
      } catch (err) {
        console.error('Erro ao enviar mídia:', err);
      }
    }
  };

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={10} className="text-slate-400" />;
      case 'sent': return <Check size={10} className="text-slate-400" />;
      case 'delivered': return <CheckCheck size={10} className="text-slate-400" />;
      case 'read': return <CheckCheck size={10} className="text-[#53bdeb]" />;
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
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-fluvius-blue-main text-white rounded-md text-[12px] font-semibold hover:bg-fluvius-blue-dark transition-all shadow-sm shadow-blue-100"
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-fluvius-blue-main hover:bg-fluvius-blue-dark text-white rounded-md text-[12px] font-semibold transition-all shadow-sm shadow-blue-100"
          >
            <UserCheck size={14} />
            Assumir
          </button>
        );
      case 'open':
        return (
          <div className="flex items-center gap-2">
            {onTransfer && (
              <button
                onClick={onTransfer}
                className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-md text-[12px] font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
              >
                Transferir
              </button>
            )}
            <button
              onClick={onPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-md text-[12px] font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            >
              <RotateCcw size={14} />
              Pausar
            </button>
            <button
              onClick={onResolve}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 text-white rounded-md text-[12px] font-semibold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-100"
            >
              <CheckCircle2 size={14} />
              Resolver
            </button>
          </div>
        );
      case 'resolved':
        return (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 px-2.5 py-1 bg-emerald-50 rounded-md border border-emerald-100/50">
              <CheckCircle2 size={13} />
              Resolvido
            </div>
            <button
              onClick={onAssign}
              className="text-[12px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
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
    <div className="flex-1 flex overflow-hidden bg-slate-50 relative">
      {/* Main Chat Area */}
      <div 
        className="flex-1 flex flex-col min-w-0 relative bg-whatsapp-doodle overflow-hidden"
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

        {previewFiles && (
          <MediaPreviewModal
            files={previewFiles}
            onClose={() => setPreviewFiles(null)}
            onSend={handleFinalSend}
          />
        )}

        {/* Lightbox for Images */}
        <AnimatePresence>
          {lightboxImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
              onClick={() => setLightboxImage(null)}
            >
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute top-6 right-6 text-white/70 hover:text-white p-2 bg-black/50 hover:bg-black/80 rounded-full transition-all"
              >
                <X size={24} />
              </button>
              <img
                src={lightboxImage}
                alt="Fullscreen Media"
                className="max-w-full max-h-full object-contain cursor-default"
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header - Minimalist & Functional */}
        <div className="h-14 flex items-center justify-between px-6 bg-white border-b border-slate-200/80 z-20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200/60 shadow-sm overflow-hidden">
              {conversation.contact?.avatar_url ? (
                <img src={conversation.contact.avatar_url} alt={contactName} className="w-full h-full object-cover" />
              ) : (
                <User size={20} className="opacity-45" />
              )}
            </div>
            
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-800 text-[14px] leading-tight">{contactName}</h2>
                {conversation.assignee && (
                  <span className="text-[10px] font-semibold text-blue-600 px-1.5 py-0.5 bg-blue-50/80 border border-blue-100/30 rounded uppercase tracking-wider">
                     {conversation.assignee.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {renderActionBar()}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={cn(
                "flex items-center justify-center p-2 rounded-md transition-all border shrink-0",
                isSidebarOpen 
                  ? "bg-amber-50 border-amber-200 text-amber-600 shadow-sm shadow-amber-50/50" 
                  : "bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              )}
              title="Detalhes & IA Resumo"
            >
              <Sparkles size={15} />
            </button>
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
        <div 
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-6 z-10 flex flex-col gap-4 fluvius-scroll pb-8"
        >
          {isLoadingMore && (
             <div className="flex justify-center py-2">
               <span className="w-4 h-4 border-2 border-fluvius-blue-main border-t-transparent rounded-full animate-spin"></span>
             </div>
          )}
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
                            <video controls controlsList="nodownload" disablePictureInPicture={false} className="w-full max-w-[440px] block max-h-[500px]">
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
                          <div className="overflow-hidden rounded-sm relative group/image">
                            <img
                              src={mediaUrl || ''}
                              alt="Media"
                              className="w-full max-w-[440px] h-auto max-h-[500px] object-cover cursor-pointer hover:opacity-95 transition-opacity block"
                              onClick={() => setLightboxImage(mediaUrl || '')}
                            />
                            <button
                              onClick={(e) => { e.stopPropagation(); setLightboxImage(mediaUrl || ''); }}
                              className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover/image:opacity-100 transition-opacity backdrop-blur-sm hover:bg-black/70 shadow-sm"
                            >
                              <Maximize2 size={16} />
                            </button>
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
                        <div className="flex flex-col gap-2 p-1 m-1">
                          <div className="bg-slate-100 rounded-md border border-slate-200 flex items-center justify-center p-6 mb-1">
                             <FileText size={40} className="text-slate-400 opacity-50" />
                          </div>
                          <div className="flex items-center justify-between gap-3 px-2">
                            <div className="min-w-0">
                              <p className="text-[12px] font-bold text-slate-700 truncate max-w-[180px]">Documento</p>
                              <p className="text-[9px] text-slate-400 font-medium truncate uppercase">{msg.mime_type?.split('/')[1]?.toUpperCase() || 'PDF'}</p>
                            </div>
                            <a
                              href={mediaUrl || ''}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 bg-white border border-slate-200 text-slate-500 rounded-full hover:text-fluvius-blue-main hover:bg-fluvius-blue-main/5 transition-colors shrink-0 shadow-sm"
                              title="Baixar ou Visualizar"
                            >
                              <Download size={14} />
                            </a>
                          </div>
                        </div>
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
                      "flex flex-col max-w-[78%] md:max-w-[70%]",
                      isOutbound ? "self-end items-end" : "self-start items-start",
                      isSameSenderAsPrev ? "mt-0.5" : "mt-3"
                    )}
                  >
                    <div className={cn(
                      "relative transition-all shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] group/bubble",
                      isMedia ? "p-1 rounded-lg" : "p-0 rounded-lg",
                      isOutbound ? "bubble-out" : "bubble-in",
                      !isSameSenderAsPrev ? (isOutbound ? "bubble-out-tail" : "bubble-in-tail") : (isOutbound ? "rounded-tr-lg" : "rounded-tl-lg")
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
                          isOutbound ? "bg-black/5 border-slate-400/30 text-slate-700" : "bg-slate-50 border-slate-300 text-slate-600"
                        )}>
                          "{msg.quoted_content}"
                        </div>
                      )}
                      {renderMessageContent()}
                      <div className={cn(
                        "flex items-center gap-1.5 px-3 pb-1.5 justify-end",
                        isMedia && !msg.content ? "absolute bottom-2 right-2 bg-black/30 backdrop-blur-sm px-1.5 py-0.5 rounded text-white" : "",
                        !isMedia || msg.content ? "text-[#667781]" : "text-white"
                      )}>
                        <span className="text-[9px] font-medium tabular-nums">{timeString}</span>
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
        <div className="shrink-0 z-20">
          <MessageInput
            onSend={onSendMessage}
            onSendMedia={onSendMedia}
            conversationId={conversation.id}
            replyingTo={replyingTo}
            onCancelReply={() => onSetReplyingTo?.(null)}
            contactName={conversation.contact?.name || conversation.contact?.phone || 'Contato'}
          />
        </div>
      </div>

      {/* Right Sidebar: Contact Info, AI Summary & Tags */}
      <div 
        className={cn(
          "bg-[#faf9f6]/95 border-l border-slate-200/50 flex flex-col shrink-0 transition-all duration-300 relative h-full overflow-hidden z-20",
          isSidebarOpen ? "w-[300px]" : "w-[64px]"
        )}
      >
        {isSidebarOpen ? (
          <div className="flex flex-col h-full overflow-y-auto w-full fluvius-scroll">
            {/* Header */}
            <div className="h-14 border-b border-slate-200/40 flex items-center justify-between px-4 shrink-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <User size={13} className="text-slate-400" /> Informações
              </span>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md transition-all duration-200 hover:bg-slate-200/30"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Contact Details Card */}
            <div className="p-4 border-b border-slate-100/60 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200/70 shadow-sm mb-3 relative overflow-hidden bg-white">
                {conversation.contact?.avatar_url ? (
                  <img src={conversation.contact.avatar_url} alt={contactName} className="w-full h-full object-cover" />
                ) : (
                  <User size={36} className="opacity-30" />
                )}
              </div>
              <h3 className="font-semibold text-slate-855 text-[15px] leading-snug tracking-tight mb-0.5">{contactName}</h3>
              <p className="text-[11px] font-mono text-slate-400/90">{contactPhone}</p>
              
              {/* Dynamic Status Subtitle */}
              {(() => {
                const statusInfo: Record<string, { label: string; dot: string; text: string }> = {
                  pending: { label: 'Pendente', dot: 'bg-amber-500', text: 'text-amber-600/90' },
                  open: { label: 'Em atendimento', dot: 'bg-emerald-500', text: 'text-emerald-600/90' },
                  bot: { label: 'Com Robô', dot: 'bg-blue-500', text: 'text-blue-600/90' },
                  resolved: { label: 'Resolvido', dot: 'bg-slate-300', text: 'text-slate-400' },
                };
                const currentStatus = statusInfo[conversation.status] || { label: 'Desconhecido', dot: 'bg-slate-300', text: 'text-slate-400' };
                return (
                  <div className="flex items-center gap-1.5 mt-2 bg-white/50 border border-slate-200/30 rounded-full px-2.5 py-0.5 shadow-sm">
                    <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", currentStatus.dot)} />
                    <span className={cn("text-[9px] font-bold uppercase tracking-wider", currentStatus.text)}>
                      {currentStatus.label}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* AI Sentiment Analysis Section */}
            <div className="p-3.5 border-b border-slate-100/60 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400/90 tracking-widest uppercase flex items-center gap-1.5">
                  <Sparkles size={11} className="text-blue-500" /> Humor do Cliente
                </span>
                <button
                  onClick={handleAnalyzeSentiment}
                  disabled={isLoadingSentiment}
                  className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors disabled:opacity-50 hover:bg-slate-200/30"
                  title="Analisar novamente"
                >
                  <RefreshCw size={11} className={cn(isLoadingSentiment && "animate-spin")} />
                </button>
              </div>

              {isLoadingSentiment && (
                <div className="bg-white/40 border border-slate-100/60 rounded-xl p-2.5 flex items-center gap-2.5 animate-pulse">
                  <Loader2 size={13} className="text-slate-400 animate-spin shrink-0" />
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </div>
              )}

              {!isLoadingSentiment && sentimentError && (
                <div className="bg-rose-50/50 border border-rose-100/30 text-rose-600 rounded-xl p-2.5 text-[11px] font-medium flex items-center gap-2">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{sentimentError}</span>
                </div>
              )}

              {!isLoadingSentiment && !sentiment && !sentimentError && (
                <button
                  onClick={handleAnalyzeSentiment}
                  className="w-full py-1.5 bg-white/60 hover:bg-white border border-slate-200/50 rounded-xl text-[11px] font-semibold text-slate-600 transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Smile size={13} className="text-slate-400" /> Analisar Sentimento
                </button>
              )}

              {!isLoadingSentiment && sentiment && (
                <div className={cn(
                  "border rounded-xl p-2.5 flex items-center gap-2.5 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.01)]",
                  sentiment === 'POSITIVE' && "bg-emerald-500/5 border-emerald-500/10 text-emerald-800",
                  sentiment === 'NEUTRAL' && "bg-slate-500/5 border-slate-500/10 text-slate-750",
                  sentiment === 'NEGATIVE' && "bg-rose-500/5 border-rose-500/10 text-rose-800",
                  sentiment === 'URGENT' && "bg-amber-500/5 border-amber-500/10 text-amber-800"
                )}>
                  <span className="text-[16px] shrink-0 leading-none">
                    {sentiment === 'POSITIVE' && '😊'}
                    {sentiment === 'NEUTRAL' && '😐'}
                    {sentiment === 'NEGATIVE' && '😢'}
                    {sentiment === 'URGENT' && '🚨'}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="text-[11.5px] font-semibold tracking-tight text-slate-800 leading-tight">
                      {sentiment === 'POSITIVE' && 'Cliente Satisfeito'}
                      {sentiment === 'NEUTRAL' && 'Cliente Neutro'}
                      {sentiment === 'NEGATIVE' && 'Cliente Frustrado'}
                      {sentiment === 'URGENT' && 'Humor Urgente'}
                    </div>
                    <span className="text-[9px] text-slate-400/90 block leading-none mt-0.5 font-medium">Análise de Humor via IA</span>
                  </div>
                </div>
              )}
            </div>

            {/* AI Summary Section */}
            <div className="p-3.5 border-b border-slate-100/60 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400/90 tracking-widest uppercase flex items-center gap-1.5">
                  <Sparkles size={11} className="text-amber-500" /> Resumo de Conversa
                </span>
                {summary && (
                  <button
                    onClick={handleGenerateSummary}
                    disabled={isLoadingSummary}
                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 disabled:opacity-50 transition-colors"
                  >
                    {isLoadingSummary ? <Loader2 size={10} className="animate-spin" /> : 'Atualizar'}
                  </button>
                )}
              </div>

              {isLoadingSummary && (
                <div className="bg-white/40 border border-slate-100/60 rounded-xl p-3 flex flex-col gap-2 animate-pulse">
                  <div className="h-2.5 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-2 bg-slate-200 rounded w-full"></div>
                </div>
              )}

              {!isLoadingSummary && summaryError && (
                <div className="bg-rose-50/50 border border-rose-100/30 text-rose-600 rounded-xl p-2.5 text-[11px] font-medium flex items-center gap-2">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{summaryError}</span>
                </div>
              )}

              {!isLoadingSummary && !summary && !summaryError && (
                <button
                  onClick={handleGenerateSummary}
                  className="w-full py-1.5 bg-white/60 hover:bg-white border border-slate-200/50 rounded-xl text-[11px] font-semibold text-slate-600 transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Sparkles size={13} className="text-amber-500" /> Gerar Resumo com IA
                </button>
              )}

              {!isLoadingSummary && summary && (
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-[12px] text-slate-700 leading-relaxed font-medium shadow-[0_1px_2px_rgba(0,0,0,0.01)] max-h-[120px] overflow-y-auto fluvius-scroll select-text">
                  <div className="whitespace-pre-line text-slate-650 leading-relaxed text-[11.5px]">
                    {summary}
                  </div>
                </div>
              )}
            </div>

            {/* Contact Notepad (Obsidian-Style Anotações Rápidas) */}
            <div className="p-3.5 border-b border-slate-100/60 flex flex-col">
              <span className="text-[10px] font-bold text-slate-400/90 tracking-widest uppercase flex items-center gap-1.5 mb-2">
                <FileText size={11} className="text-slate-400" /> Anotações do Contato
              </span>
              <textarea
                value={contactNotes}
                onChange={(e) => handleSaveNotes(e.target.value)}
                placeholder="Notas internas sobre o contato (salvas automaticamente)..."
                className="w-full h-20 bg-white/50 border border-slate-200/50 hover:border-slate-300 focus:border-blue-400 focus:bg-white rounded-xl p-2.5 text-[11.5px] text-slate-750 placeholder:text-slate-400 outline-none resize-none transition-all duration-200 shadow-sm"
              />
            </div>

            {/* Tags / Marcadores Section */}
            <div className="p-3.5 flex flex-col flex-1">
              <span className="text-[10px] font-bold text-slate-400/90 tracking-widest uppercase flex items-center gap-1.5 mb-2">
                <Tag size={11} className="text-slate-400" /> Marcadores
              </span>

              {/* Marcadores List */}
              <div className="flex flex-wrap gap-1 mb-2.5">
                {contactTags.length === 0 ? (
                  <span className="text-[11.5px] text-slate-400 italic font-medium">Nenhum marcador.</span>
                ) : (
                  contactTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-600 bg-slate-200/50 hover:bg-slate-200/80 px-2.5 py-0.5 rounded-full transition-colors duration-150"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        disabled={isUpdatingTags}
                        className="text-slate-400 hover:text-rose-500 transition-colors shrink-0 disabled:opacity-50 ml-0.5"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Add Tag Form */}
              <form onSubmit={handleAddTag} className="flex gap-1.5">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Novo marcador..."
                  disabled={isUpdatingTags || !conversation.contact}
                  className="flex-1 px-3 py-1.5 border border-slate-200/60 rounded-xl text-[11px] placeholder:text-slate-400 outline-none focus:border-blue-400 focus:bg-white bg-white/60 transition-all font-medium"
                />
                <button
                  type="submit"
                  disabled={isUpdatingTags || !newTag.trim() || !conversation.contact}
                  className="w-7 h-7 flex items-center justify-center bg-blue-650 text-white rounded-full hover:bg-blue-700 transition-colors disabled:bg-slate-100 disabled:text-slate-450 shrink-0 shadow-sm"
                >
                  {isUpdatingTags ? <Loader2 size={12} className="animate-spin" /> : <Plus size={13} />}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Collapsed Sidebar - Ultra Premium Vertical Icon Bar */
          <div className="flex flex-col items-center py-4 gap-5 h-full bg-slate-50/30 w-full overflow-y-auto overflow-x-hidden shrink-0 fluvius-scroll">
            {/* Toggle Expand Button */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-slate-400 hover:text-blue-650 hover:bg-slate-200/40 rounded-full transition-all duration-200"
              title="Expandir Detalhes"
            >
              <ChevronLeft size={18} className="hover:scale-110 transition-transform" />
            </button>

            {/* Profile Avatar */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-400 border border-slate-200/80 shadow-sm relative group hover:border-blue-400 transition-colors shrink-0 overflow-hidden"
            >
              {conversation.contact?.avatar_url ? (
                <img src={conversation.contact.avatar_url} alt={contactName} className="w-full h-full object-cover" />
              ) : (
                <User size={18} className="opacity-40" />
              )}
              {/* Tooltip */}
              <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-[11px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                {contactName}
              </div>
            </button>

            {/* Sentiment Indicators */}
            {sentiment && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border shadow-sm relative group transition-all duration-300 animate-pulse hover:scale-105 shrink-0",
                  sentiment === 'POSITIVE' && "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 shadow-emerald-100/50",
                  sentiment === 'NEUTRAL' && "bg-slate-500/5 border-slate-500/20 text-slate-500",
                  sentiment === 'NEGATIVE' && "bg-rose-500/5 border-rose-500/20 text-rose-600 shadow-rose-100/50",
                  sentiment === 'URGENT' && "bg-amber-500/5 border-amber-500/20 text-amber-600 shadow-amber-100/50"
                )}
              >
                {sentiment === 'POSITIVE' && <Smile size={18} />}
                {sentiment === 'NEUTRAL' && <Meh size={18} />}
                {sentiment === 'NEGATIVE' && <Frown size={18} />}
                {sentiment === 'URGENT' && <AlertTriangle size={18} />}

                {/* Tooltip */}
                <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                  <span className="flex items-center gap-1.5">
                    Humor: 
                    <span className="underline">
                      {sentiment === 'POSITIVE' && 'Amigável'}
                      {sentiment === 'NEUTRAL' && 'Neutro'}
                      {sentiment === 'NEGATIVE' && 'Frustrado'}
                      {sentiment === 'URGENT' && 'Urgente'}
                    </span>
                  </span>
                </div>
              </button>
            )}

            {/* Summary Indicator */}
            {summary && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="w-10 h-10 rounded-full bg-amber-500/5 border border-amber-500/20 text-amber-600 flex items-center justify-center shadow-sm relative group hover:bg-amber-500/10 transition-colors shrink-0"
              >
                <Sparkles size={16} className="animate-pulse" />
                <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                  Resumo de IA Disponível
                </div>
              </button>
            )}

            {/* Tags Indicator Dots */}
            {contactTags.length > 0 && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="flex flex-col items-center gap-1 p-2 bg-slate-100/50 rounded-full border border-slate-200/50 relative group hover:border-blue-400 transition-colors shrink-0 w-10 h-10 justify-center"
              >
                <Tag size={12} className="text-slate-400" />
                {/* Tooltip listing tags */}
                <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-[11px] font-bold px-2.5 py-1.5 rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 flex flex-col gap-1 min-w-[100px]">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider font-extrabold border-b border-slate-700 pb-0.5 mb-0.5">Tags ({contactTags.length})</span>
                  {contactTags.map((tag, i) => (
                    <span key={i} className="text-[10px] leading-tight">• {tag}</span>
                  ))}
                </div>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
