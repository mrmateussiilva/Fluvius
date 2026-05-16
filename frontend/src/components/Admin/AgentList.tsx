import React, { useEffect, useState } from 'react';
import { fetchAgents, updateAgent, deleteAgent, type Agent } from '../../api/client';
import { User, Circle, Mail, Shield, UserCheck, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

export const AgentList: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const data = await fetchAgents();
      setAgents(data);
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (agentId: string, newRole: 'admin' | 'operator') => {
    try {
      await updateAgent(agentId, { role: newRole });
      loadAgents();
    } catch (error) {
      toast.error('Falha ao atualizar papel do agente');
    }
  };

  const handleDelete = async (agentId: string) => {
    if (!confirm('Tem certeza que deseja remover este agente do workspace?')) return;
    try {
      await deleteAgent(agentId);
      loadAgents();
    } catch (error) {
      toast.error('Falha ao remover agente');
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-fluvius-blue-main border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Agentes da Equipe</h1>
          <p className="text-[#64748B]">Gerencie os membros do seu workspace.</p>
        </div>
        <button 
          onClick={() => setShowInvite(true)}
          className="px-4 py-2 bg-fluvius-gradient text-white rounded-[12px] text-sm font-medium hover:opacity-90 transition-all shadow-sm"
        >
          + Convidar Agente
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map(agent => (
          <div key={agent.id} className="bg-white p-6 rounded-[24px] border border-fluvius-border shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow relative overflow-hidden">
            {/* Background Role Badge */}
            <div className={`absolute top-0 left-0 w-full h-1 ${agent.role === 'admin' ? 'bg-fluvius-blue-main' : 'bg-slate-200'}`} />
            
            <div className="absolute top-4 right-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              <Circle size={8} className={agent.is_online ? "text-emerald-500 fill-emerald-500" : "text-slate-300 fill-slate-300"} />
              <span className={agent.is_online ? "text-emerald-600" : "text-slate-400"}>
                {agent.is_online ? 'Online' : 'Offline'}
              </span>
            </div>
            
            <div className="w-16 h-16 rounded-full bg-fluvius-bg flex items-center justify-center text-fluvius-text-sec shadow-sm border border-fluvius-border/50 overflow-hidden mb-4 mt-2">
              {agent.avatar_url ? (
                <img src={agent.avatar_url} alt={agent.name} className="w-full h-full object-cover" />
              ) : (
                <User size={28} />
              )}
            </div>
            
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-[#0F172A]">{agent.name}</h3>
              {agent.role === 'admin' && (
                <div className="p-1 bg-blue-100 text-blue-600 rounded-md" title="Administrador">
                  <Shield size={12} />
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-xs text-[#64748B] mb-4">
              <Mail size={12} />
              {agent.email}
            </div>

            <div className="w-full border-t border-slate-100 pt-4 mt-auto flex items-center justify-center gap-2">
              {agent.role === 'admin' ? (
                <button 
                  onClick={() => handleUpdateRole(agent.id, 'operator')}
                  className="flex-1 py-2 px-3 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5"
                >
                  <UserCheck size={14} />
                  Rebaixar
                </button>
              ) : (
                <button 
                  onClick={() => handleUpdateRole(agent.id, 'admin')}
                  className="flex-1 py-2 px-3 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Shield size={14} />
                  Promover
                </button>
              )}
              <button 
                onClick={() => handleDelete(agent.id)}
                className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors"
                title="Remover agente"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Invite Modal (Mini) */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900">Novo Agente</h2>
              <button onClick={() => setShowInvite(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              try {
                const { inviteAgent } = await import('../../api/client');
                await inviteAgent({
                  name: formData.get('name') as string,
                  email: formData.get('email') as string,
                  role: formData.get('role') as any,
                  password: formData.get('password') as string,
                });
                setShowInvite(false);
                loadAgents();
              } catch (error) {
                toast.error('Erro ao criar agente');
              }
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Nome Completo</label>
                <input name="name" required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-fluvius-blue-main/20 focus:border-fluvius-blue-main outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">E-mail Profissional</label>
                <input name="email" type="email" required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-fluvius-blue-main/20 focus:border-fluvius-blue-main outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Papel no Workspace</label>
                <select name="role" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-fluvius-blue-main/20 focus:border-fluvius-blue-main outline-none transition-all">
                  <option value="operator">Operador (Apenas atende)</option>
                  <option value="admin">Administrador (Gestão total)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Senha de Acesso</label>
                <input name="password" type="password" required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-fluvius-blue-main/20 focus:border-fluvius-blue-main outline-none transition-all" placeholder="Mínimo 6 caracteres" />
              </div>
              <button type="submit" className="w-full py-4 bg-fluvius-gradient text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:opacity-95 transition-all mt-4">
                Confirmar Criação
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
