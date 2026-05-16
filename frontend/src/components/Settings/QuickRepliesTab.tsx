import React, { useEffect, useState } from 'react';
import { fetchQuickReplies, createQuickReply, updateQuickReply, deleteQuickReply } from '../../api/client';
import type { QuickReply } from '../../api/client';
import { Plus, Trash2, Edit3, CheckCircle, X, Loader2, MessageSquare, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

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
    <div className="space-y-6">
      <div className="bg-white rounded-[16px] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-fluvius-border overflow-hidden">
        <div className="px-6 py-4 border-b border-fluvius-border bg-fluvius-surface flex justify-between items-center">
          <h2 className="font-semibold text-fluvius-text-main text-lg flex items-center gap-2">
            <Zap size={18} className="text-fluvius-blue-deep" />
            Mensagens Rápidas
          </h2>
          <button
            onClick={() => {
              setEditingReply(null);
              setFormData({ shortcut: '', content: '' });
              setShowAdd(!showAdd);
            }}
            className="flex items-center gap-2 text-sm bg-fluvius-gradient text-white px-3 py-1.5 rounded-[12px] hover:opacity-90 transition-all shadow-sm font-medium"
          >
            <Plus size={16} />
            Nova Mensagem
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleSubmit} className="p-6 border-b border-fluvius-border bg-fluvius-bg/10 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-fluvius-text-sec uppercase mb-1">Atalho (sem /)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fluvius-text-sec">/</span>
                  <input
                    type="text"
                    required
                    value={formData.shortcut}
                    onChange={e => setFormData({ ...formData, shortcut: e.target.value })}
                    placeholder="oi"
                    className="w-full border border-fluvius-border rounded-[12px] pl-6 pr-3 py-2 text-sm outline-none focus:border-fluvius-blue-main"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-fluvius-text-sec uppercase mb-1">Conteúdo da Mensagem</label>
                <textarea
                  required
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Olá! Como posso ajudar você hoje?"
                  rows={1}
                  className="w-full border border-fluvius-border rounded-[12px] px-3 py-2 text-sm outline-none focus:border-fluvius-blue-main resize-none"
                />
              </div>
              <div className="md:col-span-1 flex items-end gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-fluvius-gradient text-white px-4 py-2 rounded-[12px] text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="p-2 text-fluvius-text-sec hover:text-fluvius-text-main transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="divide-y divide-fluvius-border">
          {loading ? (
            <div className="p-12 text-center text-fluvius-text-sec flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-fluvius-blue-main" size={32} />
              <p>Carregando mensagens rápidas...</p>
            </div>
          ) : replies.length === 0 ? (
            <div className="p-12 text-center text-fluvius-text-sec">
              <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
              <p>Você ainda não criou nenhuma mensagem rápida.</p>
              <p className="text-xs mt-2">Dica: Use / no chat para acessá-las rapidamente.</p>
            </div>
          ) : (
            replies.map((reply) => (
              <div key={reply.id} className="p-4 flex items-center justify-between hover:bg-fluvius-bg transition-colors group">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-[12px] bg-fluvius-blue-main/10 text-fluvius-blue-deep flex items-center justify-center font-bold text-sm shrink-0">
                    /{reply.shortcut}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-fluvius-text-main line-clamp-2">{reply.content}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(reply)} className="p-2 text-fluvius-blue-main hover:bg-fluvius-blue-main/10 rounded-full transition-all">
                    <Edit3 size={16} />
                  </button>
                  <button onClick={() => handleDelete(reply.id)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-full transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
