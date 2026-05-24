import React, { useEffect, useRef, useState } from 'react';
import { updateContactTags, suggestReply, summarizeConversation, analyzeSentiment, type Message, type Conversation, type Contact } from '../api/client';
import { MessageInput } from './MessageInput';
import { 
  User, Check, CheckCheck, Clock, UserCheck, CheckCircle2, 
  RotateCcw, Upload, Reply, Play, Pause, Plus, X, Eye, 
  FileText, AlertCircle, MessageSquare, Sparkles, Loader2, Tag, ChevronRight, ChevronLeft,
  Smile, Meh, Frown, AlertTriangle, RefreshCw, Maximize2, Download, Lock
} from 'lucide-react';
import { useAgent } from '../context/AgentContext';
import { MediaPreviewModal } from './MediaPreviewModal';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { API_BASE_URL } from '../api/client';

// Normaliza a base URL para servir arquivos de upload sem double-slash
const _rawBase = API_BASE_URL.replace('/api', '');
const UPLOADS_BASE_URL = _rawBase.endsWith('/') ? _rawBase.slice(0, -1) : _rawBase;

/** Constrói URL absoluta para mídia hospedada no backend */
function buildMediaUrl(mediaUrl: string | null | undefined): string {
  if (!mediaUrl) return '';
  if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) return mediaUrl;
  const path = mediaUrl.startsWith('/') ? mediaUrl : `/${mediaUrl}`;
  return `${UPLOADS_BASE_URL}${path}`;
}

/** Formata a data para o separador de grupo — estilo WhatsApp */
function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  if (dayKey(date) === dayKey(now)) return 'Hoje';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
}

const SafeAvatar = ({ src, alt, size = 20, fallback }: { src?: string | null; alt: string; size?: number; fallback?: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  
  if (!src || hasError) {
    return fallback !== undefined ? <>{fallback}</> : <User size={size} className="opacity-50" />;
  }
  
  return (
    <img 
      src={src} 
      alt={alt} 
      className="w-full h-full object-cover" 
      onError={() => setHasError(true)} 
    />
  );
}

/** Verifica se duas datas ISO são do mesmo dia */
function isSameDay(a: string, b: string): boolean {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate();
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const AudioPlayer: React.FC<{ src: string }> = ({ src }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoading, setIsLoading] = useState(false); // false: preload=none, show play button immediately
  const [hasError, setHasError] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState(src);
  const audioRef = useRef<HTMLAudioElement>(null);
  const retryCount = useRef(0);

  // Reset when src changes and clean up active network requests
  React.useEffect(() => {
    setResolvedSrc(src);
    setHasError(false);
    setIsLoading(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    retryCount.current = 0;

    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = "";
          audioRef.current.load(); // Forces browser to abort any active downloads
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [src]);

  // Generate deterministic waveform bars from src string
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

  const togglePlay = async () => {
    if (!audioRef.current || hasError) return;
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // Show brief loading spinner while browser buffers
        if (audioRef.current.readyState < 3) {
          setIsLoading(true);
        }
        await audioRef.current.play();
        setIsLoading(false);
        setIsPlaying(true);
      }
    } catch (err) {
      console.warn('[AudioPlayer] play() failed:', err);
      setIsLoading(false);
      setIsPlaying(false);
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
      setIsLoading(false);
      setHasError(false);
    }
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    // If the media fails to load (e.g. backend is downloading it in background),
    // we retry loading a couple of times before giving up.
    if (retryCount.current < 3) {
      retryCount.current += 1;
      console.warn(`[AudioPlayer] Playback error, retrying (${retryCount.current}/3) in 2 seconds...`);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.load();
          if (isPlaying) {
            audioRef.current.play().catch(() => {});
          }
        }
      }, 2000);
    } else {
      setHasError(true);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="min-w-[260px] py-2 flex items-center gap-3">
      {/* Single audio element with direct src — avoids multi-source abort issue */}
      <audio
        key={resolvedSrc}
        ref={audioRef}
        src={resolvedSrc}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
        onError={handleError}
        className="hidden"
        preload="none"
      />
      <button
        onClick={togglePlay}
        disabled={isLoading && !hasError}
        className={cn(
          "w-10 h-10 text-white rounded-full flex items-center justify-center transition-colors shadow-sm shrink-0",
          hasError
            ? "bg-rose-400 cursor-not-allowed"
            : isLoading
            ? "bg-slate-300 cursor-wait"
            : "bg-fluvius-blue-main hover:bg-blue-700"
        )}
      >
        {hasError ? (
          <span className="text-[10px] font-bold">!</span>
        ) : isLoading ? (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block" />
        ) : isPlaying ? (
          <Pause size={18} fill="currentColor" />
        ) : (
          <Play size={18} fill="currentColor" className="ml-0.5" />
        )}
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
  onSendInternalNote?: (content: string) => Promise<void> | void;
  isTyping?: boolean;
}

export const MessagePanel: React.FC<MessagePanelProps> = ({
  messages,
  onSendMessage,
  onSendInternalNote,
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
  isTyping,
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
  // Scroll management refs
  const isLoadingMoreRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const isFirstLoadRef = useRef(true);
  const lastConversationIdRef = useRef<string | null>(null);

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

  // ── Scroll inteligente ──────────────────────────────────────────────────────
  // 1. Ao trocar de conversa: sempre vai para o fundo
  // 2. Ao receber nova mensagem: só vai para o fundo se o usuário estiver perto
  // 3. Ao carregar mensagens antigas (loadMore): preserva posição de scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const conversationChanged = lastConversationIdRef.current !== conversation.id;
    if (conversationChanged) {
      lastConversationIdRef.current = conversation.id;
      isFirstLoadRef.current = true;
    }

    // Se estamos carregando mensagens antigas, restaurar posição relativa
    if (isLoadingMoreRef.current) {
      const newScrollHeight = container.scrollHeight;
      const diff = newScrollHeight - prevScrollHeightRef.current;
      container.scrollTop = diff;
      isLoadingMoreRef.current = false;
      return;
    }

    // Primeira carga da conversa ou troca de conversa: ir para baixo
    if (isFirstLoadRef.current) {
      endRef.current?.scrollIntoView({ behavior: 'instant' });
      isFirstLoadRef.current = false;
      return;
    }

    // Nova mensagem: só auto-scroll se o usuário estiver perto do fundo (< 150px)
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 150) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, conversation.id]);

  // Rastreia quando loadMore é chamado para capturar scrollHeight antes do update
  useEffect(() => {
    if (isLoadingMore) {
      isLoadingMoreRef.current = true;
      prevScrollHeightRef.current = containerRef.current?.scrollHeight || 0;
    }
  }, [isLoadingMore]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    if (container.scrollTop === 0 && hasMore && !isLoadingMore && onLoadMore) {
      onLoadMore();
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
      case 'pending': return <Clock size={10} className="opacity-70" />;
      case 'sent': return <Check size={10} className="opacity-70" />;
      case 'delivered': return <CheckCheck size={10} className="opacity-70" />;
      case 'read': return <CheckCheck size={10} className="text-fluvius-green-water drop-shadow-sm" />;
      case 'failed': return <AlertCircle size={10} className="text-rose-300" />;
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
        className="flex-1 flex flex-col min-w-0 relative bg-chat-pattern overflow-hidden"
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

        {/* Header — estilo Premium SaaS */}
        <div className="h-[64px] flex items-center justify-between px-5 bg-white/80 backdrop-blur-md border-b border-slate-200/60 z-20 shrink-0 shadow-sm">
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="relative shrink-0 group"
            >
              <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden ring-2 ring-transparent group-hover:ring-fluvius-blue-main/30 shadow-sm transition-all">
                <SafeAvatar src={conversation.contact?.avatar_url} alt={contactName} size={20} />
              </div>
            </button>

            <div className="min-w-0 cursor-pointer" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <div className="flex items-center gap-2.5">
                <h2 className="font-bold text-slate-900 text-[15px] leading-tight tracking-tight">{contactName}</h2>
                {conversation.assignee && (
                  <span className="text-[9px] font-bold text-fluvius-blue-deep px-1.5 py-0.5 bg-fluvius-blue-50 border border-fluvius-blue-100 rounded uppercase tracking-wider shadow-sm">
                    {conversation.assignee.name}
                  </span>
                )}
              </div>
              {contactPhone && contactPhone !== contactName && (
                <p className="text-[12px] text-[#667781] leading-none mt-0.5">{contactPhone}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {renderActionBar()}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={cn(
                "flex items-center justify-center w-9 h-9 rounded-full transition-all",
                isSidebarOpen
                  ? "bg-fluvius-blue-50 text-fluvius-blue-main shadow-inner"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              )}
              title="Detalhes &amp; IA Resumo"
            >
              <Sparkles size={18} />
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
              <div className="flex-1 flex flex-col items-center justify-center text-center mt-12 mb-auto opacity-70">
                <div className="w-20 h-20 bg-fluvius-blue-50 text-fluvius-blue-main rounded-full flex items-center justify-center shadow-sm mb-5 border border-fluvius-blue-100/50">
                  <MessageSquare size={36} className="opacity-90" />
                </div>
                <h3 className="text-[18px] font-bold text-slate-700 tracking-tight mb-2">Nenhuma mensagem ainda</h3>
                <p className="text-[13px] text-slate-500 font-medium max-w-[260px] leading-relaxed">
                  Este é o início do histórico com o cliente. Mande um olá para começar o atendimento.
                </p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isOutbound = msg.direction === 'outbound';
                const timeString = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const isSameSenderAsPrev = index > 0 && messages[index-1].direction === msg.direction;
                const prevMsg = index > 0 ? messages[index - 1] : null;
                const showDateSep = !prevMsg || !isSameDay(prevMsg.created_at, msg.created_at);
                const isMedia = msg.message_type === 'image' || msg.message_type === 'video';

                const renderMessageContent = () => {
                  const mediaUrl = buildMediaUrl(msg.media_url);
                  const isDocImage = msg.message_type === 'document' && msg.mime_type?.startsWith('image/');
                  const fileName = msg.media_url
                    ? decodeURIComponent(msg.media_url.split('/').pop() || 'arquivo')
                    : 'arquivo';
                  const fileExt = msg.mime_type?.split('/')[1]?.toUpperCase() || fileName.split('.').pop()?.toUpperCase() || 'DOC';

                  switch (msg.message_type) {
                    case 'audio': {
                      return <AudioPlayer src={mediaUrl} />;
                    }
                    case 'video':
                      return (
                        <div className="flex flex-col">
                          <div className="bg-black overflow-hidden rounded-sm">
                            <video controls controlsList="nodownload" disablePictureInPicture={false} className="w-full max-w-[440px] block max-h-[500px]">
                              <source src={mediaUrl} type={msg.mime_type || 'video/mp4'} />
                              <source src={mediaUrl} type="video/mp4" />
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
                              src={mediaUrl}
                              alt="Media"
                              className="w-full max-w-[440px] h-auto max-h-[500px] object-cover cursor-pointer hover:opacity-95 transition-opacity block"
                              onClick={() => setLightboxImage(mediaUrl)}
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                                e.currentTarget.parentElement?.classList.add('hidden');
                              }}
                            />
                            <button
                              onClick={(e) => { e.stopPropagation(); setLightboxImage(mediaUrl); }}
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
                      // Se o documento for uma imagem (ex: jpeg enviado como documento), mostrar preview
                      if (isDocImage) {
                        return (
                          <div className="flex flex-col">
                            <div className="overflow-hidden rounded-sm relative group/image">
                              <img
                                src={mediaUrl}
                                alt={fileName}
                                className="w-full max-w-[440px] h-auto max-h-[500px] object-cover cursor-pointer hover:opacity-95 transition-opacity block"
                                onClick={() => setLightboxImage(mediaUrl)}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                              />
                              <button
                                onClick={(e) => { e.stopPropagation(); setLightboxImage(mediaUrl); }}
                                className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover/image:opacity-100 transition-opacity backdrop-blur-sm hover:bg-black/70 shadow-sm"
                              >
                                <Maximize2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center gap-3 p-3 m-1 bg-black/5 rounded-lg min-w-[220px]">
                          <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                            <FileText size={20} className="text-fluvius-blue-main" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold text-slate-700 truncate max-w-[160px]" title={fileName}>{fileName}</p>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-0.5">{fileExt}</p>
                          </div>
                          <a
                            href={mediaUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 bg-white border border-slate-200 text-slate-500 rounded-full hover:text-fluvius-blue-main hover:bg-fluvius-blue-main/5 transition-colors shrink-0 shadow-sm"
                            title="Baixar ou Visualizar"
                          >
                            <Download size={14} />
                          </a>
                        </div>
                      );
                    default:
                      return (
                        <div className={cn("px-4 pt-3 pb-1.5", isOutbound ? "tracking-[-0.1px]" : "")}>
                          <p className={cn(
                            "text-[13.5px] leading-[1.55] whitespace-pre-wrap break-words font-sans",
                            isOutbound ? "font-normal text-white" : "font-[450] text-slate-800"
                          )}>
                            {msg.content}
                          </p>
                        </div>
                      );
                  }
                };

                return (
                  <motion.div
                    layout="position"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={msg.id}
                    className="w-full flex flex-col"
                  >
                    {/* Separador de data — estilo WhatsApp */}
                    {showDateSep && (
                      <div className="flex items-center justify-center my-4 self-center w-full relative">
                        <div className="absolute inset-x-12 top-1/2 -translate-y-1/2 h-[1px] bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                        <span className="date-separator-badge relative z-10 px-4 py-1">
                          {formatDateLabel(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <div
                      className={cn(
                        "flex flex-col max-w-[80%] md:max-w-[72%]",
                        isOutbound ? "self-end items-end" : "self-start items-start",
                        isSameSenderAsPrev ? "mt-[2px]" : "mt-3"
                      )}
                    >
                    <div className={cn(
                      "relative transition-all group/bubble overflow-hidden",
                      isMedia ? "p-0.5" : "p-0",
                      msg.is_internal
                        ? "bg-amber-50 border border-amber-200/80 text-amber-900 shadow-[0_2px_8px_rgba(245,158,11,0.08)]"
                        : (isOutbound ? "bubble-out" : "bubble-in"),
                      !isSameSenderAsPrev
                        ? (isOutbound ? "rounded-[18px] rounded-br-[4px] bubble-out-tail" : "rounded-[18px] rounded-bl-[4px] bubble-in-tail")
                        : "rounded-[18px]"
                    )}>
                      {msg.is_internal && (
                        <div className="flex items-center gap-1.5 text-amber-600 bg-amber-100/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-b border-amber-200/60">
                          <Lock size={9} />
                          Nota Interna — visível apenas para a equipe
                        </div>
                      )}

                      {/* Ação de Responder — aparece no hover ao lado da bolha */}
                      <div className={cn(
                        "absolute top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover/bubble:opacity-100 transition-all duration-150 scale-90 group-hover/bubble:scale-100",
                        isOutbound ? "-left-11" : "-right-11"
                      )}>
                        <button
                          onClick={() => onSetReplyingTo?.(msg)}
                          className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200/80 rounded-full text-slate-400 shadow-md hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/80 transition-all duration-150"
                          title="Responder"
                        >
                          <Reply size={13} />
                        </button>
                      </div>

                      {msg.quoted_content && (
                        <div className={cn(
                          "mx-3 mt-3 mb-1 rounded-lg px-3 py-2 border-l-[3px] text-[11.5px]",
                          isOutbound
                            ? "bg-white/10 border-white/40 text-white/75 italic"
                            : "bg-slate-50 border-fluvius-blue-main/30 text-slate-500 italic"
                        )}>
                          {msg.quoted_content}
                        </div>
                      )}

                      {renderMessageContent()}

                      {/* Timestamp + Status integrado na base da bolha */}
                      <div className={cn(
                        "flex items-center gap-1.5 px-3 pb-2 justify-end",
                        isMedia && !msg.content
                          ? "absolute bottom-2 right-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full"
                          : "",
                        !isMedia || msg.content
                          ? (isOutbound ? "text-white/55" : "text-slate-400/80")
                          : "text-white"
                      )}>
                        <span className="text-[10px] font-medium tabular-nums">{timeString}</span>
                        {isOutbound && <span className="ml-0.5">{renderStatusIcon(msg.status)}</span>}
                      </div>
                    </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
          {isTyping && (
             <div className="self-start mt-2 ml-2 flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl rounded-bl-sm text-slate-500 shadow-sm w-fit group">
               <div className="flex gap-1.5 items-center">
                 <span className="w-1.5 h-1.5 bg-fluvius-blue-main/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                 <span className="w-1.5 h-1.5 bg-fluvius-blue-main/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                 <span className="w-1.5 h-1.5 bg-fluvius-blue-main/60 rounded-full animate-bounce"></span>
               </div>
               <span className="text-[11px] font-semibold text-slate-400 ml-1.5 animate-pulse">Digitando...</span>
             </div>
          )}
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
          "bg-white border-l border-slate-200/80 flex flex-col shrink-0 transition-all duration-300 relative h-full overflow-hidden z-20 shadow-[-4px_0_15px_rgba(0,0,0,0.02)]",
          isSidebarOpen ? "w-[320px]" : "w-[64px]"
        )}
      >
        {isSidebarOpen ? (
          <div className="flex flex-col h-full overflow-y-auto w-full fluvius-scroll">
            {/* Header da Sidebar */}
            <div className="h-14 border-b border-slate-100 flex items-center justify-between px-5 shrink-0 bg-white">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <User size={12} className="text-fluvius-blue-main" /> Perfil do Contato
              </span>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-all duration-150 hover:bg-slate-100"
                title="Fechar painel"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Contact Details Card — Hero Section */}
            <div className="relative flex flex-col items-center text-center border-b border-slate-100 overflow-hidden">
              {/* Background decorativo */}
              <div className="absolute inset-0 bg-gradient-to-br from-fluvius-blue-50 via-slate-50 to-white pointer-events-none"></div>
              <div className="absolute inset-0 bg-chat-pattern opacity-20 mix-blend-multiply pointer-events-none"></div>

              {/* Avatar com anel de status */}
              <div className="relative mt-7 mb-4 z-10">
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center text-slate-400 overflow-hidden ring-4 shadow-lg",
                  conversation.status === 'open' ? 'ring-emerald-400/40' :
                  conversation.status === 'pending' ? 'ring-amber-400/40' :
                  conversation.status === 'bot' ? 'ring-fluvius-blue-200' :
                  'ring-slate-200/60',
                  "bg-white"
                )}>
                  <SafeAvatar 
                    src={conversation.contact?.avatar_url} 
                    alt={contactName} 
                    fallback={
                      <div className="w-full h-full bg-gradient-to-br from-fluvius-blue-100 to-fluvius-blue-200 flex items-center justify-center">
                        <span className="text-[28px] font-bold text-fluvius-blue-deep">
                          {contactName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    } 
                  />
                </div>
                {/* Bolinha de status */}
                {(() => {
                  const dotColor = conversation.status === 'open' ? 'bg-emerald-500' :
                    conversation.status === 'pending' ? 'bg-amber-400' :
                    conversation.status === 'bot' ? 'bg-fluvius-blue-main' : 'bg-slate-300';
                  return (
                    <span className={cn(
                      "absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-white shadow-sm",
                      dotColor
                    )} />
                  );
                })()}
              </div>

              <h3 className="font-bold text-slate-900 text-[15px] leading-tight tracking-tight mb-0.5 z-10 px-4">{contactName}</h3>
              <p className="text-[12px] font-mono text-slate-400 mb-1 z-10">{contactPhone}</p>

              {/* Status pill */}
              {(() => {
                const statusInfo: Record<string, { label: string; bg: string; text: string; border: string }> = {
                  pending:  { label: 'Aguardando', bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200' },
                  open:     { label: 'Em atendimento', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
                  bot:      { label: 'Com Bot', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
                  resolved: { label: 'Resolvido', bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' },
                };
                const s = statusInfo[conversation.status] || statusInfo.resolved;
                return (
                  <div className={cn("flex items-center gap-1.5 mb-6 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider z-10", s.bg, s.text, s.border)}>
                    {s.label}
                  </div>
                );
              })()}
            </div>

            {/* AI Sentiment Analysis Section */}
            <div className="px-4 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-slate-600 tracking-wide flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-blue-50 flex items-center justify-center">
                    <Sparkles size={11} className="text-fluvius-blue-main" />
                  </span>
                  Humor do Cliente
                </span>
                <button
                  onClick={handleAnalyzeSentiment}
                  disabled={isLoadingSentiment}
                  className="p-1.5 text-slate-400 hover:text-fluvius-blue-main rounded-lg transition-all disabled:opacity-40 hover:bg-blue-50"
                  title="Reanalisar"
                >
                  <RefreshCw size={11} className={cn(isLoadingSentiment && "animate-spin")} />
                </button>
              </div>

              {isLoadingSentiment && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex items-center gap-3 animate-pulse">
                  <Loader2 size={14} className="text-slate-300 animate-spin shrink-0" />
                  <div className="flex flex-col gap-1.5 flex-1">
                    <div className="h-2.5 bg-slate-200 rounded-full w-2/3"></div>
                    <div className="h-2 bg-slate-100 rounded-full w-1/2"></div>
                  </div>
                </div>
              )}

              {!isLoadingSentiment && sentimentError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-600 rounded-xl p-3 text-[11px] font-medium flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{sentimentError}</span>
                </div>
              )}

              {!isLoadingSentiment && !sentiment && !sentimentError && (
                <button
                  onClick={handleAnalyzeSentiment}
                  className="w-full py-2.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl text-[11.5px] font-semibold text-slate-600 hover:text-fluvius-blue-main transition-all duration-200 flex items-center justify-center gap-2 shadow-sm"
                >
                  <Smile size={14} className="text-slate-400" /> Analisar agora
                </button>
              )}

              {!isLoadingSentiment && sentiment && (() => {
                const sentimentMap: Record<string, { emoji: string; label: string; sub: string; bg: string; border: string; text: string; accent: string }> = {
                  POSITIVE: { emoji: '😊', label: 'Satisfeito',  sub: 'Cliente feliz e engajado',  bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', accent: 'bg-emerald-500' },
                  NEUTRAL:  { emoji: '😐', label: 'Neutro',      sub: 'Tom objetivo e tranquilo',  bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-700',  accent: 'bg-slate-400' },
                  NEGATIVE: { emoji: '😞', label: 'Insatisfeito', sub: 'Cliente precisa de atenção', bg: 'bg-rose-50',    border: 'border-rose-200',   text: 'text-rose-900',   accent: 'bg-rose-500' },
                  URGENT:   { emoji: '🚨', label: 'Urgente',     sub: 'Requer ação imediata',      bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-900',  accent: 'bg-amber-500' },
                };
                const s = sentimentMap[sentiment] || sentimentMap.NEUTRAL;
                return (
                  <div className={cn("rounded-xl border p-3 flex items-center gap-3", s.bg, s.border, s.text)}>
                    <span className="text-[22px] leading-none shrink-0">{s.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold leading-tight">{s.label}</p>
                      <p className="text-[10.5px] opacity-70 mt-0.5 font-medium">{s.sub}</p>
                    </div>
                    <span className={cn("w-1.5 h-8 rounded-full shrink-0 opacity-40", s.accent)} />
                  </div>
                );
              })()}
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
                  contactTags.map((tag) => {
                    const tagHash = Array.from(tag).reduce((acc, char) => acc + char.charCodeAt(0), 0);
                    const hue = tagHash % 360;
                    return (
                    <span
                      key={tag}
                      style={{ backgroundColor: `hsla(${hue}, 80%, 90%, 0.8)`, color: `hsla(${hue}, 85%, 25%, 1)`, border: `1px solid hsla(${hue}, 80%, 80%, 0.5)` }}
                      className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2.5 py-0.5 rounded-md transition-all duration-150 shadow-sm hover:shadow"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        disabled={isUpdatingTags}
                        className="hover:text-rose-500 transition-colors shrink-0 disabled:opacity-50 ml-0.5 opacity-60 hover:opacity-100"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  )})
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
              <SafeAvatar src={conversation.contact?.avatar_url} alt={contactName} size={18} />
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
