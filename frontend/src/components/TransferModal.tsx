import React, { useState, useEffect } from 'react';
import { type Queue, type Agent, getQueues, fetchAgents, transferConversation } from '../api/client';
import { X, Users, Layers, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface TransferModalProps {
  conversationId: string;
  onClose: () => void;
  onTransferred: (updated: Conversation) => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({ conversationId, onClose, onTransferred }) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'agent'>('queue');
  const [queues, setQueues] = useState<Queue[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState<string>('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [qRes, aRes] = await Promise.all([getQueues(), fetchAgents()]);
      setQueues(qRes);
      setAgents(aRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    try {
      setTransferring(true);
      let updated: Conversation | null = null;
      if (activeTab === 'queue' && selectedQueueId) {
        updated = await transferConversation(conversationId, { queue_id: selectedQueueId });
      } else if (activeTab === 'agent' && selectedAgentId) {
        updated = await transferConversation(conversationId, { agent_id: selectedAgentId });
      }
      if (updated) {
        onTransferred(updated);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao transferir conversa');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-fluvius-text-main/20 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-fluvius-border animate-scale-up">
        
        <div className="flex items-center justify-between p-4 border-b border-fluvius-border bg-fluvius-surface">
          <h3 className="text-lg font-semibold text-fluvius-text-main">Transferir Conversa</h3>
          <button onClick={onClose} className="text-fluvius-text-sec hover:text-fluvius-text-main transition-colors">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center text-fluvius-blue-main">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex p-4 gap-2 border-b border-fluvius-border">
              <button 
                onClick={() => setActiveTab('queue')}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeTab === 'queue' ? 'bg-fluvius-blue-main/10 text-fluvius-blue-deep' : 'text-fluvius-text-sec hover:bg-fluvius-surface'
                }`}
              >
                <Layers className="w-4 h-4" /> Fila
              </button>
              <button 
                onClick={() => setActiveTab('agent')}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeTab === 'agent' ? 'bg-fluvius-blue-main/10 text-fluvius-blue-deep' : 'text-fluvius-text-sec hover:bg-fluvius-surface'
                }`}
              >
                <Users className="w-4 h-4" /> Agente
              </button>
            </div>

            <div className="p-4 space-y-4">
              {activeTab === 'queue' ? (
                <div>
                  <label className="block text-sm font-medium text-fluvius-text-main mb-2">Selecione a Fila</label>
                  <select 
                    value={selectedQueueId}
                    onChange={(e) => setSelectedQueueId(e.target.value)}
                    className="w-full bg-white text-fluvius-text-main border border-fluvius-border rounded-xl px-4 py-3 focus:outline-none focus:border-fluvius-blue-main transition-colors"
                  >
                    <option value="">Selecione...</option>
                    {queues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-fluvius-text-main mb-2">Selecione o Agente</label>
                  <select 
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full bg-white text-fluvius-text-main border border-fluvius-border rounded-xl px-4 py-3 focus:outline-none focus:border-fluvius-blue-main transition-colors"
                  >
                    <option value="">Selecione...</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-fluvius-border flex justify-end gap-3 bg-fluvius-surface">
              <button onClick={onClose} className="px-4 py-2 text-sm text-fluvius-text-sec hover:text-fluvius-text-main transition-colors">Cancelar</button>
              <button 
                onClick={handleTransfer} 
                disabled={transferring || (activeTab === 'queue' && !selectedQueueId) || (activeTab === 'agent' && !selectedAgentId)}
                className="px-6 py-2 bg-fluvius-gradient text-white rounded-xl text-sm font-medium shadow-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {transferring && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar Transferência
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
