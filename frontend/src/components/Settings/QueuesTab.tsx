import React, { useState, useEffect } from 'react';
import { type Queue, getQueues, createQueue, updateQueue, deleteQueue, getQueueAgents, updateQueueAgents, fetchAgents, type Agent } from '../../api/client';
import { Settings, Plus, Edit, Trash2, Users, X } from 'lucide-react';

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
    if (!window.confirm('Tem certeza que deseja excluir esta fila?')) return;
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
      setIsAgentsModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds(prev => 
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    );
  };

  if (loading) return <div className="p-4 text-center text-slate-400">Carregando...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            Departamentos / Filas
          </h2>
          <p className="text-sm text-slate-400 mt-1">Crie filas de atendimento e defina os agentes de cada uma.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm transition-colors shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          Nova Fila
        </button>
      </div>

      <div className="bg-[#1C1C24] rounded-2xl overflow-hidden border border-slate-700/50 shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#24242E] text-slate-400 text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-medium">Nome da Fila</th>
              <th className="px-6 py-4 font-medium">Descrição</th>
              <th className="px-6 py-4 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50 text-sm">
            {queues.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                  Nenhuma fila criada.
                </td>
              </tr>
            ) : queues.map((q) => (
              <tr key={q.id} className="hover:bg-[#24242E] transition-colors">
                <td className="px-6 py-4 font-medium text-slate-200">{q.name}</td>
                <td className="px-6 py-4 text-slate-400">{q.description || '-'}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => handleOpenAgentsModal(q.id)} className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors" title="Agentes">
                      <Users className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleOpenModal(q)} className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors" title="Editar">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(q.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[#1C1C24] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-700/50 animate-scale-up">
            <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-[#24242E]">
              <h3 className="text-lg font-semibold text-white">{editingQueue ? 'Editar Fila' : 'Nova Fila'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nome da Fila *</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-[#13131A] text-slate-200 border border-slate-700 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="Ex: Vendas"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Descrição</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-[#13131A] text-slate-200 border border-slate-700 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500 transition-colors resize-none h-24"
                  placeholder="Para que serve esta fila?"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-700/50 flex justify-end gap-3 bg-[#24242E]">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors">Cancelar</button>
              <button onClick={handleSave} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50" disabled={!formData.name}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agents Modal */}
      {isAgentsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[#1C1C24] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-700/50 animate-scale-up">
            <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-[#24242E]">
              <h3 className="text-lg font-semibold text-white">Vincular Agentes</h3>
              <button onClick={() => setIsAgentsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto space-y-2">
              {agents.map(agent => (
                <label key={agent.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#24242E] cursor-pointer transition-colors border border-transparent hover:border-slate-700/50">
                  <input 
                    type="checkbox"
                    checked={selectedAgentIds.includes(agent.id)}
                    onChange={() => toggleAgent(agent.id)}
                    className="w-4 h-4 rounded border-slate-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-[#1C1C24] bg-[#13131A]"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">{agent.name}</p>
                    <p className="text-xs text-slate-400">{agent.email}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="p-4 border-t border-slate-700/50 flex justify-end gap-3 bg-[#24242E]">
              <button onClick={() => setIsAgentsModalOpen(false)} className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors">Cancelar</button>
              <button onClick={handleSaveAgents} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm transition-colors shadow-lg shadow-indigo-500/20">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
