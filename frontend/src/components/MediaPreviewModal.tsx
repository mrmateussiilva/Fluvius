import React, { useState, useEffect } from 'react';
import { X, Send, Image as ImageIcon, Music, FileText, Video } from 'lucide-react';
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
        className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur-sm"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 text-white">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} />
          </button>
          <div className="text-sm font-medium opacity-80 truncate max-w-[200px]">
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
              <img src={preview} alt="Preview" className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl" />
            ) : type === 'video' ? (
              <video src={preview} controls className="max-w-full max-h-[70vh] rounded-lg shadow-2xl" />
            ) : type === 'audio' ? (
              <div className="bg-white/10 p-12 rounded-3xl flex flex-col items-center gap-6 backdrop-blur-md border border-white/10">
                <Music size={80} className="text-emerald-400" />
                <audio src={preview} controls className="h-10" />
              </div>
            ) : (
              <div className="bg-white/10 p-12 rounded-3xl flex flex-col items-center gap-6 backdrop-blur-md border border-white/10">
                <FileText size={80} className="text-blue-400" />
                <div className="text-center">
                  <p className="text-white font-medium text-lg">{file.name}</p>
                  <p className="text-white/50 text-sm">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Caption & Send Area */}
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="bg-black/20 p-6 backdrop-blur-lg border-t border-white/5"
        >
          <div className="max-w-3xl mx-auto flex items-center gap-4">
            <div className="flex-1 bg-white/10 rounded-2xl flex items-center px-4 py-1 border border-white/10 focus-within:border-emerald-500/50 transition-colors">
              <input
                id="caption-input"
                type="text"
                placeholder="Adicionar legenda..."
                className="w-full bg-transparent outline-none py-3 text-white placeholder-white/40"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <button
              onClick={handleSend}
              className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-emerald-600 transition-all hover:scale-105 active:scale-95"
            >
              <Send size={24} className="ml-1" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
