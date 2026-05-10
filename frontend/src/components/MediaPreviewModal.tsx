import React, { useState, useEffect } from 'react';
import { X, Send, Music, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MediaPreviewModalProps {
  file: File;
  preview: string;
  type: string;
  onClose: () => void;
  onSend: (caption: string) => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  file,
  preview,
  type,
  onClose,
  onSend,
}) => {
  const [caption, setCaption] = useState('');

  // Auto-focus the caption input
  useEffect(() => {
    const timer = setTimeout(() => {
      document.getElementById('caption-input')?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleSend = () => {
    onSend(caption);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col bg-white/95 backdrop-blur-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 text-fluvius-text-main border-b border-fluvius-border/30">
          <button onClick={onClose} className="p-2 hover:bg-fluvius-surface rounded-full transition-colors text-fluvius-text-sec hover:text-fluvius-text-main">
            <X size={24} />
          </button>
          <div className="text-sm font-semibold truncate max-w-[200px]">
            {file.name}
          </div>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Media Preview Area */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-full max-h-full flex items-center justify-center"
          >
            {type === 'image' ? (
              <img src={preview} alt="Preview" className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-2xl" />
            ) : type === 'video' ? (
              <video src={preview} controls className="max-w-full max-h-[70vh] rounded-xl shadow-2xl" />
            ) : type === 'audio' ? (
              <div className="bg-fluvius-surface p-12 rounded-[24px] flex flex-col items-center gap-6 border border-fluvius-border">
                <Music size={80} className="text-fluvius-blue-main" />
                <audio src={preview} controls className="h-10" />
              </div>
            ) : file.type === 'application/pdf' ? (
              <div className="w-full h-full max-w-4xl flex flex-col items-center gap-4">
                 <embed src={preview} type="application/pdf" className="w-full h-[65vh] rounded-[24px] shadow-2xl bg-white border border-fluvius-border" />
                 <p className="text-fluvius-text-sec text-sm font-medium">{file.name}</p>
              </div>
            ) : (
              <div className="bg-fluvius-surface p-12 rounded-[24px] flex flex-col items-center gap-6 border border-fluvius-border">
                <FileText size={80} className="text-fluvius-blue-main" />
                <div className="text-center">
                  <p className="text-fluvius-text-main font-semibold text-lg">{file.name}</p>
                  <p className="text-fluvius-text-sec text-sm">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Caption & Send Area */}
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="bg-white p-6 border-t border-fluvius-border shadow-[0_-8px_30px_rgb(0,0,0,0.04)]"
        >
          <div className="max-w-3xl mx-auto flex items-center gap-4">
            <div className="flex-1 bg-fluvius-bg rounded-[16px] flex items-center px-4 py-1 border border-fluvius-border focus-within:border-fluvius-blue-main focus-within:ring-2 focus-within:ring-fluvius-blue-main/10 transition-colors">
              <input
                id="caption-input"
                type="text"
                placeholder="Adicionar legenda..."
                className="w-full bg-transparent outline-none py-3 text-fluvius-text-main placeholder-fluvius-text-sec text-[15px]"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <button
              onClick={handleSend}
              className="w-14 h-14 bg-fluvius-gradient text-white rounded-full flex items-center justify-center shadow-lg hover:opacity-90 transition-all hover:scale-105 active:scale-95"
            >
              <Send size={24} className="ml-1" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
