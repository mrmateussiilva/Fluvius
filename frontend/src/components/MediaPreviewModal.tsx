import React, { useState, useEffect } from 'react';
import { X, Send, Music, FileText, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface PreviewFileItem {
  file: File;
  preview: string;
  type: string;
  caption: string;
}

interface MediaPreviewModalProps {
  files: { file: File; preview: string; type: string }[];
  onClose: () => void;
  onSend: (filesWithCaptions: PreviewFileItem[]) => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  files: initialFiles,
  onClose,
  onSend,
}) => {
  const [files, setFiles] = useState<PreviewFileItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Initialize state with empty captions
  useEffect(() => {
    setFiles(
      initialFiles.map((f) => ({
        ...f,
        caption: '',
      }))
    );
    setActiveIndex(0);
  }, [initialFiles]);

  // Auto-focus the caption input when active item changes
  useEffect(() => {
    const timer = setTimeout(() => {
      document.getElementById('caption-input')?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, [activeIndex]);

  if (files.length === 0) return null;

  const currentItem = files[activeIndex];

  const handleSend = () => {
    onSend(files);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCaptionChange = (val: string) => {
    setFiles((prev) =>
      prev.map((item, idx) =>
        idx === activeIndex ? { ...item, caption: val } : item
      )
    );
  };

  const handleRemoveFile = (idxToRemove: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (files.length === 1) {
      onClose();
      return;
    }
    setFiles((prev) => prev.filter((_, idx) => idx !== idxToRemove));
    if (activeIndex >= files.length - 1) {
      setActiveIndex(files.length - 2 >= 0 ? files.length - 2 : 0);
    }
  };

  const handleNext = () => {
    if (activeIndex < files.length - 1) {
      setActiveIndex(activeIndex + 1);
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col bg-white/98 backdrop-blur-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 text-slate-800 border-b border-slate-100">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-800">
            <X size={24} />
          </button>
          <div className="text-sm font-semibold truncate max-w-[300px]">
            Visualizar Envio ({activeIndex + 1} de {files.length})
          </div>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Media Preview Area */}
        <div className="flex-1 flex items-center justify-between p-4 overflow-hidden relative">
          {/* Navigation - Prev */}
          {activeIndex > 0 && (
            <button
              onClick={handlePrev}
              className="absolute left-6 z-10 p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-all hover:scale-105 active:scale-95 shadow-md"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden h-full">
            <motion.div
              key={activeIndex}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="max-w-full max-h-full flex items-center justify-center"
            >
              {currentItem.type === 'image' ? (
                <img src={currentItem.preview} alt="Preview" className="max-w-full max-h-[55vh] object-contain rounded-xl shadow-2xl" />
              ) : currentItem.type === 'video' ? (
                <video src={currentItem.preview} controls className="max-w-full max-h-[55vh] rounded-xl shadow-2xl" />
              ) : currentItem.type === 'audio' ? (
                <div className="bg-slate-50 p-12 rounded-[24px] flex flex-col items-center gap-6 border border-slate-200 shadow-xl">
                  <Music size={80} className="text-blue-600" />
                  <audio src={currentItem.preview} controls className="h-10" />
                  <p className="text-slate-500 text-sm font-medium">{currentItem.file.name}</p>
                </div>
              ) : currentItem.file.type === 'application/pdf' ? (
                <div className="w-full h-full max-w-4xl flex flex-col items-center gap-4">
                  <embed src={currentItem.preview} type="application/pdf" className="w-full h-[50vh] rounded-[24px] shadow-2xl bg-white border border-slate-200" />
                  <p className="text-slate-500 text-sm font-medium">{currentItem.file.name}</p>
                </div>
              ) : (
                <div className="bg-slate-50 p-12 rounded-[24px] flex flex-col items-center gap-6 border border-slate-200 shadow-xl">
                  <FileText size={80} className="text-blue-600" />
                  <div className="text-center">
                    <p className="text-slate-800 font-semibold text-lg">{currentItem.file.name}</p>
                    <p className="text-slate-500 text-sm">{(currentItem.file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Navigation - Next */}
          {activeIndex < files.length - 1 && (
            <button
              onClick={handleNext}
              className="absolute right-6 z-10 p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-all hover:scale-105 active:scale-95 shadow-md"
            >
              <ChevronRight size={24} />
            </button>
          )}
        </div>

        {/* Carousel of Files & Captions Bottom Area */}
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="bg-white p-6 border-t border-slate-100 shadow-[0_-8px_30px_rgb(0,0,0,0.04)]"
        >
          {/* Caption Input */}
          <div className="max-w-3xl mx-auto flex items-center gap-4 mb-6">
            <div className="flex-1 bg-slate-50 rounded-[16px] flex items-center px-4 py-1 border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-colors">
              <input
                id="caption-input"
                type="text"
                placeholder={`Adicionar legenda para ${currentItem.file.name}...`}
                className="w-full bg-transparent outline-none py-3 text-slate-800 placeholder-slate-400 text-[15px]"
                value={currentItem.caption}
                onChange={(e) => handleCaptionChange(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <button
              onClick={handleSend}
              className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-all hover:scale-105 active:scale-95 shrink-0"
              title="Enviar todos"
            >
              <Send size={24} className="ml-1" />
            </button>
          </div>

          {/* Thumbnail Strip */}
          <div className="max-w-3xl mx-auto flex items-center gap-3 overflow-x-auto py-2 px-1">
            {files.map((item, idx) => (
              <div
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={`relative w-20 h-20 rounded-xl overflow-hidden cursor-pointer border-2 transition-all flex-shrink-0 flex items-center justify-center bg-slate-50 group ${
                  idx === activeIndex
                    ? 'border-blue-600 shadow-md ring-2 ring-blue-500/10 scale-105'
                    : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                {item.type === 'image' ? (
                  <img src={item.preview} alt="Thumbnail" className="w-full h-full object-cover" />
                ) : item.type === 'video' ? (
                  <div className="w-full h-full relative flex items-center justify-center bg-slate-900">
                    <span className="text-[10px] text-white font-extrabold uppercase bg-slate-800/80 px-1 py-0.5 rounded absolute z-10">VIDEO</span>
                  </div>
                ) : item.type === 'audio' ? (
                  <Music size={24} className="text-slate-400 animate-pulse" />
                ) : (
                  <FileText size={24} className="text-slate-400" />
                )}

                {/* Remove button */}
                <button
                  onClick={(e) => handleRemoveFile(idx, e)}
                  className="absolute top-1 right-1 bg-black/60 hover:bg-rose-600 text-white p-1 rounded-full transition-colors opacity-0 group-hover:opacity-100 md:opacity-100 shadow-sm z-20"
                  title="Remover arquivo"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
