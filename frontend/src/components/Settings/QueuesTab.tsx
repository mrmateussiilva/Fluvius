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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[24px] border border-fluvius-border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-[16px] flex items-center justify-center">
            <Layers size={24} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Departamentos / Filas</h2>
            <p className="text-[14px] text-slate-500 font-medium">Organize o roteamento de atendimentos para sua equipe.</p>
          </div>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-[14px] text-sm font-bold transition-all shadow-sm shadow-indigo-600/20"
        >
          <Plus size={18} />
          Nova Fila
        </button>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-[24px] overflow-hidden border border-fluvius-border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-4">Nome do Departamento</th>
                <th className="px-6 py-4">Descrição</th>
                <th className="px-6 py-4 text-right">Configurações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence>
                {queues.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                          <Layers size={24} />
                        </div>
                        <p className="text-sm font-bold text-slate-500">Nenhuma fila criada</p>
                        <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">Crie departamentos (ex: Vendas, Suporte) para direcionar as conversas para os agentes certos.</p>
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
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                        <span className="font-bold text-[14px] text-slate-900">{q.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[13px] text-slate-500 font-medium max-w-xs truncate">
                      {q.description || <span className="text-slate-300 italic">Sem descrição</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenAgentsModal(q.id)} 
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                        >
                          <Users size={14} />
                          Agentes
                        </button>
                        <div className="w-px h-4 bg-slate-200 mx-2" />
                        <button 
                          onClick={() => handleOpenModal(q)} 
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(q.id)} 
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
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
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[24px] w-full max-w-md shadow-2xl relative overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Layers size={16} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{editingQueue ? 'Editar Fila' : 'Nova Fila'}</h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100">
                  <X size={20}/>
                </button>
              </div>
              
              <div className="p-6 space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-bold text-slate-700">Nome do Departamento *</label>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-[14px] px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-sm"
                    placeholder="Ex: Suporte Técnico"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-bold text-slate-700">Descrição Opcional</label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-[14px] px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-sm resize-none h-24"
                    placeholder="Para que serve este departamento?"
                  />
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-slate-50 bg-slate-50/50 flex justify-end gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-[12px] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave} 
                  disabled={!formData.name}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none text-white rounded-[12px] text-sm font-bold transition-colors shadow-sm shadow-indigo-600/20"
                >
                  Salvar Fila
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
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[24px] w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Users size={16} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Vincular Agentes</h3>
                    <p className="text-[11px] font-medium text-slate-500">Selecione quem atenderá nesta fila</p>
                  </div>
                </div>
                <button onClick={() => setIsAgentsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100">
                  <X size={20}/>
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto fluvius-scroll flex-1 bg-slate-50/50">
                {agents.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-500">Nenhum agente cadastrado</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {agents.map(agent => {
                      const isSelected = selectedAgentIds.includes(agent.id);
                      return (
                        <div 
                          key={agent.id} 
                          onClick={() => toggleAgent(agent.id)}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-[16px] cursor-pointer transition-all border",
                            isSelected ? "bg-indigo-50/50 border-indigo-200" : "bg-white border-slate-100 hover:border-slate-300 shadow-sm"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors",
                            isSelected ? "bg-indigo-600 text-white" : "border-2 border-slate-300"
                          )}>
                            {isSelected && <CheckCircle2 size={14} strokeWidth={3} />}
                          </div>
                          
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-slate-100 border border-white shadow-sm flex items-center justify-center text-[12px] font-bold text-slate-600 shrink-0">
                              {agent.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className={cn("text-[14px] font-bold truncate", isSelected ? "text-indigo-900" : "text-slate-900")}>
                                {agent.name}
                              </p>
                              <p className="text-[12px] text-slate-500 font-medium truncate">{agent.email}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
                <button 
                  onClick={() => setIsAgentsModalOpen(false)} 
                  className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-[12px] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveAgents} 
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[12px] text-sm font-bold transition-colors shadow-sm shadow-indigo-600/20"
                >
                  Salvar Vínculos
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
