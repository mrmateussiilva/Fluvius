import React, { useState, useEffect } from 'react';
import { type Queue, getQueues, createQueue, updateQueue, deleteQueue, getQueueAgents, updateQueueAgents, fetchAgents, type Agent } from '../../api/client';
import { Settings, Plus, Edit, Trash2, Users, X, Layers, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import toast from 'react-hot-toast';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

export const QueuesTab: React.FC = () => {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQueue, setEditingQueue] = useState<Queue | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  
  const [isAgentsModalOpen, setIsAgentsModalOpen] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [qRes, aRes] = await Promise.all([getQueues(), fetchAgents()]);
      setQueues(qRes);
      setAgents(aRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (queue?: Queue) => {
    if (queue) {
      setEditingQueue(queue);
      setFormData({ name: queue.name, description: queue.description || '' });
    } else {
      setEditingQueue(null);
      setFormData({ name: '', description: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) return;
    try {
      if (editingQueue) {
        await updateQueue(editingQueue.id, formData);
      } else {
        await createQueue(formData);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta fila? As conversas vinculadas podem ficar sem departamento.')) return;
    try {
      await deleteQueue(id);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenAgentsModal = async (queueId: string) => {
    try {
      setSelectedQueueId(queueId);
      const ids = await getQueueAgents(queueId);
      setSelectedAgentIds(ids);
      setIsAgentsModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAgents = async () => {
    if (!selectedQueueId) return;
    try {
      await updateQueueAgents(selectedQueueId, selectedAgentIds);
      toast.success('Agentes vinculados com sucesso!');
      setIsAgentsModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao vincular agentes');
    }
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds(prev => 
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-slate-100 border-t-fluvius-blue-main rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Carregando filas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center border border-indigo-100">
            <Layers size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Setores</h2>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Encaminhe conversas para equipes especializadas</p>
          </div>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold uppercase tracking-wider transition-colors shadow-sm"
        >
          <Plus size={16} />
          Novo Setor
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-[9px] font-bold uppercase tracking-widest border-b border-slate-100">
                <th className="px-5 py-3">Nome da Equipe</th>
                <th className="px-5 py-3">Descrição</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence>
                {queues.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Layers className="text-slate-200" size={32} />
                        <div className="space-y-1">
                           <p className="text-slate-500 font-bold text-sm">Nenhum setor cadastrado</p>
                           <p className="text-slate-400 text-[11px] max-w-sm mx-auto">Crie filas para organizar o fluxo de atendimento.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : queues.map((q) => (
                  <motion.tr 
                    key={q.id}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0 }}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px] border border-indigo-100">
                          {q.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-[13px] text-slate-800">{q.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[12px] text-slate-500 font-medium truncate max-w-xs">
                      {q.description || <span className="text-slate-300 italic text-[10px]">Sem descrição</span>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenAgentsModal(q.id)} 
                          className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-100 transition-colors"
                        >
                          <Users size={12} />
                          Agentes
                        </button>
                        <button 
                          onClick={() => handleOpenModal(q)} 
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(q.id)} 
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Fila */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 5 }}
              className="bg-white rounded-lg w-full max-w-md shadow-xl relative overflow-hidden border border-slate-200"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-blue-500" />
                  <h3 className="text-sm font-bold text-slate-900">{editingQueue ? 'Editar Setor' : 'Novo Setor'}</h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                  <X size={18}/>
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">Nome do Setor *</label>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] font-medium text-slate-700 outline-none focus:border-blue-500 transition-colors"
                    placeholder="Ex: Vendas"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">Descrição</label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] font-medium text-slate-700 outline-none focus:border-blue-500 transition-colors resize-none h-20"
                    placeholder="Para que serve este setor?"
                  />
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave} 
                  disabled={!formData.name}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-[11px] font-bold uppercase tracking-wider transition-colors shadow-sm"
                >
                  Salvar Setor
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Vincular Agentes */}
      <AnimatePresence>
        {isAgentsModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
              onClick={() => setIsAgentsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 5 }}
              className="bg-white rounded-lg w-full max-w-sm shadow-xl relative overflow-hidden flex flex-col max-h-[80vh] border border-slate-200"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-indigo-500" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Vincular Agentes</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Selecione membros da equipe</p>
                  </div>
                </div>
                <button onClick={() => setIsAgentsModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                  <X size={18}/>
                </button>
              </div>
              
              <div className="p-3 overflow-y-auto fluvius-scroll flex-1">
                {agents.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Nenhum agente encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {agents.map(agent => {
                      const isSelected = selectedAgentIds.includes(agent.id);
                      return (
                        <div 
                          key={agent.id} 
                          onClick={() => toggleAgent(agent.id)}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded cursor-pointer transition-colors border",
                            isSelected ? "bg-blue-50 border-blue-200" : "bg-white border-transparent hover:bg-slate-50"
                          )}
                        >
                          <div className={cn(
                            "w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors",
                            isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300"
                          )}>
                            {isSelected && <CheckCircle2 size={12} strokeWidth={3} />}
                          </div>
                          
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0 border border-slate-200">
                              {agent.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className={cn("text-[13px] font-bold truncate", isSelected ? "text-blue-900" : "text-slate-900")}>
                                {agent.name}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">{agent.email}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
                <button 
                  onClick={() => setIsAgentsModalOpen(false)} 
                  className="px-4 py-2 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveAgents} 
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold uppercase tracking-wider transition-colors shadow-sm"
                >
                  Salvar Alterações
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
