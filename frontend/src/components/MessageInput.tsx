import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Paperclip, Image as ImageIcon, Music, FileText, Camera, Mic, Square, AlertCircle, X, Sparkles, Loader2, Zap } from 'lucide-react';
import { suggestReply, type Message, fetchQuickReplies, type QuickReply } from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { MediaPreviewModal } from './MediaPreviewModal';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB

interface MessageInputProps {
  onSend: (content: string) => Promise<void> | void;
  onSendMedia: (media: string, mediaType: string, mimetype: string, caption?: string) => Promise<void> | void;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  conversationId?: string;
  contactName?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({ onSend, onSendMedia, replyingTo, onCancelReply, conversationId, contactName }) => {
  const [text, setText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [previewFile, setPreviewFile] = useState<{ file: File; preview: string; type: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Quick Replies state
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [filteredQuickReplies, setFilteredQuickReplies] = useState<QuickReply[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch quick replies
  useEffect(() => {
    const loadQuickReplies = async () => {
      try {
        const data = await fetchQuickReplies();
        setQuickReplies(data);
      } catch (err) {
        console.error('Failed to load quick replies', err);
      }
    };
    loadQuickReplies();
  }, []);

  // Filter quick replies based on input
  useEffect(() => {
    if (text.startsWith('/')) {
      const search = text.slice(1).toLowerCase();
      const filtered = quickReplies.filter(qr => 
        qr.shortcut.toLowerCase().includes(search) || 
        qr.content.toLowerCase().includes(search)
      );
      setFilteredQuickReplies(filtered);
      setShowQuickReplies(filtered.length > 0);
      setSelectedIndex(0);
    } else {
      setShowQuickReplies(false);
    }
  }, [text, quickReplies]);

  // Recording Timer
  useEffect(() => {
    let interval: number;
    if (isRecording) {
      interval = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const showError = (message: string) => {
    setError(message);
    setTimeout(() => setError(null), 4000);
  };

  const handleSend = async () => {
    if (text.trim()) {
      try {
        await onSend(text.trim());
        setText('');
        inputRef.current?.focus();
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Erro ao enviar mensagem');
      }
    }
  };

  const handleSuggestReply = async () => {
    if (!conversationId || isGeneratingSuggestion) return;
    
    setIsGeneratingSuggestion(true);
    setSuggestions([]);
    try {
      const res = await suggestReply(conversationId);
      if (res.suggestions && res.suggestions.length > 0) {
        setSuggestions(res.suggestions);
      } else if (res.suggestion) {
        setSuggestions([res.suggestion]);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao gerar sugestões');
    } finally {
      setIsGeneratingSuggestion(false);
    }
  };

  const handleSelectQuickReply = (qr: QuickReply) => {
    setText(qr.content);
    setShowQuickReplies(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showQuickReplies) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredQuickReplies.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredQuickReplies.length) % filteredQuickReplies.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelectQuickReply(filteredQuickReplies[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowQuickReplies(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (accept: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
    setIsMenuOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      showError(`Arquivo muito grande! O limite é ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
      e.target.value = '';
      return;
    }

    let type = 'document';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('audio/')) type = 'audio';
    else if (file.type.startsWith('video/')) type = 'video';

    const preview = URL.createObjectURL(file);
    setPreviewFile({ file, preview, type });
    
    // Reset input value to allow selecting same file again
    e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg; codecs=opus' });
        const file = new File([audioBlob], 'voice_note.ogg', { type: 'audio/ogg' });
        const preview = URL.createObjectURL(audioBlob);
        setPreviewFile({ file, preview, type: 'audio' });
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied', err);
      showError('Acesso ao microfone negado');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFinalSend = (caption: string) => {
    if (!previewFile) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      Promise.resolve(onSendMedia(base64String, previewFile.type, previewFile.file.type, caption))
        .then(() => setPreviewFile(null))
        .catch((err) => showError(err instanceof Error ? err.message : 'Erro ao enviar mídia'));
    };
    reader.readAsDataURL(previewFile.file);
  };


  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault(); // Stop text paste

          if (file.size > MAX_FILE_SIZE) {
            showError(`Arquivo muito grande! O limite é ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
            return;
          }

          let type = 'document';
          if (file.type.startsWith('image/')) type = 'image';
          else if (file.type.startsWith('audio/')) type = 'audio';
          else if (file.type.startsWith('video/')) type = 'video';

          const preview = URL.createObjectURL(file);
          setPreviewFile({ file, preview, type });
          return; // Process only the first file
        }
      }
    }
  };

  const attachmentOptions = [
    { id: 'document', icon: <FileText size={18} />, label: 'Documento', color: 'text-indigo-600', bg: 'bg-indigo-50', accept: '*' },
    { id: 'gallery', icon: <ImageIcon size={18} />, label: 'Mídia', color: 'text-blue-600', bg: 'bg-blue-50', accept: 'image/*,video/*' },
    { id: 'camera', icon: <Camera size={18} />, label: 'Câmera', color: 'text-rose-600', bg: 'bg-rose-50', accept: 'image/*;capture=camera' },
  ];

  return (
    <div className="relative flex flex-col w-full bg-white">
      {/* Media Preview Modal */}
      {previewFile && (
        <MediaPreviewModal
          file={previewFile.file}
          preview={previewFile.preview}
          type={previewFile.type}
          onClose={() => setPreviewFile(null)}
          onSend={handleFinalSend}
        />
      )}

      {/* Attachment Menu - Functional List */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full left-2 mb-2 z-40 bg-white rounded-md shadow-lg border border-slate-200 p-1 min-w-[140px]"
          >
            {attachmentOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleFileSelect(opt.accept)}
                className="flex items-center gap-2.5 w-full hover:bg-slate-50 px-3 py-2 rounded transition-colors text-left"
              >
                <div className={cn(opt.color, opt.bg, "p-1.5 rounded")}>
                  {opt.icon}
                </div>
                <span className="text-[12px] font-bold text-slate-700">{opt.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 z-40 bg-rose-600 text-white px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 mb-2"
          >
            <AlertCircle size={14} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply Preview - Discrete */}
      {replyingTo && (
        <div className="mx-2 mb-1 bg-slate-50 border-x border-t border-slate-200 px-3 py-2 flex items-center justify-between rounded-t-md">
          <div className="flex flex-col flex-1 border-l-2 border-blue-500 pl-3">
            <div className="text-[10px] text-slate-500 font-medium">Respondendo a <span className="font-bold text-slate-700">{replyingTo.direction === 'outbound' ? 'Você' : (contactName || 'Contato')}</span></div>
            <span className="text-[12px] text-slate-600 truncate mt-0.5">
              {replyingTo.message_type === 'text' ? replyingTo.content : replyingTo.message_type.toUpperCase()}
            </span>
          </div>
          <button onClick={onCancelReply} className="p-1 text-slate-400 hover:text-rose-500 transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Quick Replies - Obsidian Style */}
      <AnimatePresence>
        {showQuickReplies && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full left-0 w-full bg-white border border-slate-200 shadow-xl overflow-hidden z-50 rounded-t-md"
          >
            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Respostas Rápidas</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredQuickReplies.map((qr, index) => (
                <button
                  key={qr.id}
                  onClick={() => handleSelectQuickReply(qr)}
                  className={cn(
                    "w-full text-left px-3 py-2 flex items-center gap-3 border-l-2 transition-colors",
                    index === selectedIndex ? "bg-blue-50 border-blue-500" : "border-transparent hover:bg-slate-50"
                  )}
                >
                  <span className="text-[11px] font-bold text-blue-600 shrink-0">/{qr.shortcut}</span>
                  <span className="text-[12px] text-slate-700 truncate">{qr.content}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Smart Replies Suggestions - Premium & Horizontal */}
      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.98 }}
            className="mx-2 mb-2 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 backdrop-blur-md border border-blue-100 rounded-xl p-3 flex flex-col gap-2 shadow-sm z-30"
          >
            <div className="flex items-center justify-between border-b border-blue-100/50 pb-1.5">
              <div className="flex items-center gap-1.5 text-blue-700">
                <Sparkles size={13} className="animate-pulse" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider">Sugestões do Copiloto de IA</span>
              </div>
              <button 
                onClick={() => setSuggestions([])} 
                className="p-1 rounded-full text-slate-400 hover:text-rose-500 hover:bg-white/80 transition-colors"
                title="Limpar sugestões"
              >
                <X size={12} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {suggestions.map((suggestion, idx) => {
                const label = idx === 0 ? "⚡ Resposta Curta" : idx === 1 ? "📝 Resposta Completa" : "💡 Adaptada / Híbrida";
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setText(suggestion);
                      setSuggestions([]);
                      inputRef.current?.focus();
                    }}
                    className="group relative flex flex-col text-left p-2.5 bg-white/90 hover:bg-white border border-blue-100 hover:border-blue-400 rounded-lg shadow-sm hover:shadow transition-all duration-200"
                  >
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-blue-600 mb-1 flex items-center justify-between">
                      {label}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[8px] font-bold text-slate-400">Usar ➜</span>
                    </span>
                    <span className="text-[11px] text-slate-700 font-medium line-clamp-3 leading-relaxed">
                      {suggestion}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Input Area */}
      <div className={cn(
        "flex items-center gap-1 p-1 transition-colors",
        isRecording ? "bg-rose-50" : "bg-white"
      )}>
        {!isRecording ? (
          <>
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={cn(
                "p-2 rounded transition-colors",
                isMenuOpen ? "bg-slate-100 text-slate-800" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              )}
            >
              <Paperclip size={18} />
            </button>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={handleSuggestReply}
              disabled={isGeneratingSuggestion || !conversationId}
              className="p-2 text-amber-500 hover:bg-amber-50 rounded transition-colors"
              title="Sugestão com IA"
            >
              {isGeneratingSuggestion ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Sparkles size={18} />
              )}
            </button>
            
            <div className="flex-1 flex items-center mx-1">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Digite uma mensagem... (Use / para respostas rápidas)"
                className="w-full bg-transparent outline-none px-2 py-2 text-[13px] text-slate-800 placeholder:text-slate-400"
              />
            </div>
            
            <div className="flex items-center gap-1">
              <button type="button" className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                <Smile size={18} />
              </button>
              
              {text.trim() ? (
                <button
                  type="button"
                  onClick={handleSend}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-[11px] font-bold uppercase tracking-wider hover:bg-blue-700 transition-all"
                >
                  Enviar
                </button>
              ) : (
                <>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:text-fluvius-blue-main hover:bg-slate-50 px-2 py-1.5 rounded transition-colors flex items-center gap-1.5">
                  <ImageIcon size={14} /> Anexo
                </button>
                <button type="button" onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1.5 rounded transition-colors flex items-center gap-1.5 ${isRecording ? 'text-rose-500 bg-rose-50 animate-pulse' : 'text-slate-500 hover:text-fluvius-blue-main hover:bg-slate-50'}`}>
                  <Mic size={14} /> Áudio
                </button>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-between px-3 py-1.5">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-widest tabular-nums">
                {formatDuration(recordingDuration)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setIsRecording(false);
                  mediaRecorderRef.current?.stop();
                  setPreviewFile(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={16} />
              </button>
              <button
                onClick={stopRecording}
                className="px-3 py-1 bg-rose-600 text-white rounded text-[10px] font-bold uppercase tracking-wider"
              >
                Feito
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
