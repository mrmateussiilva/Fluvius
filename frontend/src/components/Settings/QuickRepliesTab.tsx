import React, { useEffect, useState } from 'react';
import { fetchQuickReplies, createQuickReply, updateQuickReply, deleteQuickReply } from '../../api/client';
import type { QuickReply } from '../../api/client';
import { Plus, Trash2, Edit3, CheckCircle, X, Loader2, MessageSquare, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const QuickRepliesTab: React.FC = () => {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [formData, setFormData] = useState({ shortcut: '', content: '' });
  const [saving, setSaving] = useState(false);

  const loadReplies = async () => {
    try {
      setLoading(true);
      const data = await fetchQuickReplies();
      setReplies(data);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar mensagens rápidas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReplies();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingReply) {
        await updateQuickReply(editingReply.id, formData);
        toast.success('Mensagem rápida atualizada');
      } else {
        await createQuickReply(formData);
        toast.success('Mensagem rápida criada');
      }
      setShowAdd(false);
      setEditingReply(null);
      setFormData({ shortcut: '', content: '' });
      loadReplies();
    } catch (err) {
      toast.error('Erro ao salvar mensagem rápida');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta mensagem rápida?')) return;
    try {
      await deleteQuickReply(id);
      toast.success('Mensagem excluída');
      loadReplies();
    } catch (err) {
      toast.error('Erro ao excluir');
    }
  };

  const handleEdit = (reply: QuickReply) => {
    setEditingReply(reply);
    setFormData({ shortcut: reply.shortcut, content: reply.content });
    setShowAdd(true);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h2 className="font-bold text-slate-500 text-[10px] uppercase tracking-wider flex items-center gap-2">
            <Zap size={14} className="text-blue-500" />
            Quick Replies
          </h2>
          <button
            onClick={() => {
              setEditingReply(null);
              setFormData({ shortcut: '', content: '' });
              setShowAdd(!showAdd);
            }}
            className="flex items-center gap-1.5 text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            New Reply
          </button>
        </div>

        <AnimatePresence>
          {showAdd && (
            <motion.form 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleSubmit} 
              className="p-5 border-b border-slate-100 bg-slate-50/30 overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Shortcut</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">/</span>
                    <input
                      type="text"
                      required
                      value={formData.shortcut}
                      onChange={e => setFormData({ ...formData, shortcut: e.target.value })}
                      placeholder="hi"
                      className="w-full border border-slate-200 rounded px-3 py-2 pl-6 text-[13px] font-medium text-slate-700 outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Message Content</label>
                  <textarea
                    required
                    value={formData.content}
                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Hello! How can I help you?"
                    rows={1}
                    className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] font-medium text-slate-700 outline-none focus:border-blue-500 transition-colors resize-none"
                  />
                </div>
                <div className="md:col-span-1 flex items-end gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded text-[11px] font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-12 text-center flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-blue-500" size={24} />
              <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest">Loading...</p>
            </div>
          ) : replies.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center gap-4">
              <MessageSquare className="text-slate-200" size={32} />
              <div className="space-y-1">
                <p className="text-slate-500 font-bold text-sm">No quick replies</p>
                <p className="text-slate-400 text-[11px] max-w-[200px] mx-auto">Create shortcuts to speed up your workflow.</p>
              </div>
            </div>
          ) : (
            <div className="p-3 grid grid-cols-1 gap-1">
              {replies.map((reply) => (
                <motion.div 
                  layout
                  key={reply.id} 
                  className="p-4 flex items-center justify-between hover:bg-slate-50 rounded transition-colors group"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[12px] shrink-0 border border-blue-100">
                      /{reply.shortcut}
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-bold text-slate-800 leading-tight">{reply.content}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Shortcut: {reply.shortcut}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(reply)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => handleDelete(reply.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
