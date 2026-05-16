import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Paperclip, Image as ImageIcon, Music, FileText, Camera, Mic, Square, AlertCircle, X } from 'lucide-react';
import type { Message } from '../api/client';
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
}

export const MessageInput: React.FC<MessageInputProps> = ({ onSend, onSendMedia, replyingTo, onCancelReply }) => {
  const [text, setText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ file: File; preview: string; type: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const attachmentOptions = [
    { id: 'document', icon: <FileText size={22} />, label: 'Documento', color: 'bg-indigo-500', accept: '*' },
    { id: 'camera', icon: <Camera size={22} />, label: 'Câmera', color: 'bg-rose-500', accept: 'image/*;capture=camera' },
    { id: 'gallery', icon: <ImageIcon size={22} />, label: 'Galeria', color: 'bg-purple-500', accept: 'image/*,video/*' },
    { id: 'audio', icon: <Music size={22} />, label: 'Áudio', color: 'bg-orange-500', accept: 'audio/*' },
  ];

  return (
    <div className="relative flex flex-col w-full">
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

      {/* Attachment Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-20 left-4 z-40 bg-white rounded-2xl shadow-2xl p-4 border border-slate-100 flex flex-col gap-4 min-w-[160px]"
          >
            {attachmentOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleFileSelect(opt.accept)}
                className="flex items-center gap-3 w-full hover:bg-slate-50 p-2 rounded-xl transition-colors group"
              >
                <div className={`${opt.color} text-white p-2.5 rounded-full shadow-sm group-hover:scale-110 transition-transform`}>
                  {opt.icon}
                </div>
                <span className="text-sm font-medium text-slate-600">{opt.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 bg-rose-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium"
          >
            <AlertCircle size={16} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply Preview */}
      {replyingTo && (
        <div className="bg-[#F8FAFC] border-t border-fluvius-border/50 px-4 py-2 flex items-center justify-between relative z-10">
          <div className="flex flex-col flex-1 border-l-4 border-fluvius-blue-main pl-3">
            <span className="text-xs font-semibold text-fluvius-blue-main">
              {replyingTo.direction === 'inbound' ? 'Cliente' : 'Você'}
            </span>
            <span className="text-[13px] text-slate-600 truncate">
              {replyingTo.message_type === 'text' ? replyingTo.content : 'Mídia'}
            </span>
          </div>
          <button onClick={onCancelReply} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/50 transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      <div className={cn(
        "px-4 py-3 flex items-center gap-2 shrink-0 border-t border-[#DCE7F0] transition-colors duration-300",
        isRecording ? "bg-rose-50" : "bg-white"
      )}>
        {!isRecording ? (
          <>
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={cn(
                "p-2 transition-all rounded-full",
                isMenuOpen ? "bg-[#EFF6FF] text-[#1EA7FF]" : "text-[#64748B] hover:text-[#1EA7FF] hover:bg-[#F8FAFC]"
              )}
            >
              <Paperclip size={24} className={isMenuOpen ? 'rotate-45 transition-transform' : 'transition-transform'} />
            </button>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            <button type="button" className="p-2 text-[#64748B] hover:text-[#1EA7FF] transition-colors rounded-full hover:bg-[#F8FAFC]">
              <Smile size={24} />
            </button>
            
            <div className="flex-1 bg-[#F8FAFC] rounded-[14px] flex items-center border border-[#DCE7F0] focus-within:border-[#1EA7FF] focus-within:ring-2 focus-within:ring-[#1EA7FF]/10 transition-all overflow-hidden">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite uma mensagem..."
                className="w-full bg-transparent outline-none px-4 py-3 text-[#0F172A] placeholder-[#64748B] text-[15px]"
              />
            </div>
            
            {text.trim() ? (
              <button
                type="button"
                onClick={handleSend}
                className="p-3 rounded-full flex items-center justify-center bg-fluvius-gradient text-white hover:opacity-90 shadow-[0_4px_12px_rgba(30,167,255,0.2)] transform hover:scale-105 active:scale-95 transition-all"
              >
                <Send size={20} className="ml-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="p-3 rounded-full flex items-center justify-center bg-fluvius-gradient text-white hover:opacity-90 shadow-[0_4px_12px_rgba(30,167,255,0.2)] transform hover:scale-105 active:scale-95 transition-all"
              >
                <Mic size={24} />
              </button>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-between bg-rose-100 rounded-xl px-4 py-2 border border-rose-200">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-rose-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-rose-700">Gravando áudio...</span>
                <span className="text-sm font-bold text-rose-600 ml-2">{formatDuration(recordingDuration)}</span>
              </div>
            <button
              type="button"
              onClick={stopRecording}
              className="p-2 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-colors shadow-sm"
            >
              <Square size={18} fill="currentColor" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
