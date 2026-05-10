import React, { useEffect, useState } from 'react';
import { fetchAgents, type Agent } from '../../api/client';
import { User, Circle, Mail, Calendar } from 'lucide-react';

export const AgentList: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

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
        <button className="px-4 py-2 bg-fluvius-gradient text-white rounded-[12px] text-sm font-medium hover:opacity-90 transition-all shadow-sm">
          + Convidar Agente
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map(agent => (
          <div key={agent.id} className="bg-white p-6 rounded-[24px] border border-fluvius-border shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow relative">
            <div className="absolute top-4 right-4 flex items-center gap-1.5 text-xs font-medium">
              <Circle size={10} className={agent.is_online ? "text-emerald-500 fill-emerald-500" : "text-slate-300 fill-slate-300"} />
              <span className={agent.is_online ? "text-emerald-600" : "text-slate-400"}>
                {agent.is_online ? 'Online' : 'Offline'}
              </span>
            </div>
            
            <div className="w-20 h-20 rounded-full bg-fluvius-bg flex items-center justify-center text-fluvius-text-sec shadow-sm border border-fluvius-border/50 overflow-hidden mb-4">
              {agent.avatar_url ? (
                <img src={agent.avatar_url} alt={agent.name} className="w-full h-full object-cover" />
              ) : (
                <User size={32} />
              )}
            </div>
            
            <h3 className="text-lg font-bold text-[#0F172A] mb-1">{agent.name}</h3>
            
            <div className="flex items-center gap-2 text-sm text-[#64748B] mb-2">
              <Mail size={14} />
              {agent.email}
            </div>
            
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Calendar size={12} />
              Adicionado em {new Date(agent.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
