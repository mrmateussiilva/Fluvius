import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Paperclip, X, Image as ImageIcon, Music, FileText, Camera, Video, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MediaPreviewModal } from './MediaPreviewModal';

interface MessageInputProps {
  onSend: (content: string) => void;
  onSendMedia: (media: string, mediaType: string, mimetype: string, caption?: string) => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({ onSend, onSendMedia }) => {
  const [text, setText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ file: File; preview: string; type: string } | null>(null);
  
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

  const handleSend = () => {
    if (text.trim()) {
      onSend(text.trim());
      setText('');
      inputRef.current?.focus();
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

    let type = 'document';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('audio/')) type = 'audio';
    else if (file.type.startsWith('video/')) type = 'video';

    const preview = URL.createObjectURL(file);
    setPreviewFile({ file, preview, type });
    
    // Reset input value to allow selecting same file again
    e.target.value = '';
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
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

      <div className="bg-slate-50 px-4 py-3 flex items-center gap-2 shrink-0 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`p-2 transition-all rounded-full ${isMenuOpen ? 'bg-slate-200 text-slate-700' : 'text-slate-500 hover:text-slate-600 hover:bg-slate-200'}`}
        >
          <Paperclip size={24} className={isMenuOpen ? 'rotate-45 transition-transform' : 'transition-transform'} />
        </button>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        <button type="button" className="p-2 text-slate-500 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-200">
          <Smile size={24} />
        </button>
        
        <div className="flex-1 bg-white rounded-xl flex items-center shadow-sm border border-slate-200 focus-within:border-emerald-500/50 transition-colors overflow-hidden">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem..."
            className="w-full bg-transparent outline-none px-4 py-3 text-slate-800 placeholder-slate-400 text-[15px]"
          />
        </div>
        
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim()}
          className={`p-3 rounded-full flex items-center justify-center transition-all ${
            text.trim()
              ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md transform hover:scale-105 active:scale-95' 
              : 'bg-slate-200 text-slate-400 cursor-default'
          }`}
        >
          <Send size={20} className={text.trim() ? "ml-0.5" : ""} />
        </button>
      </div>
    </div>
  );
};
