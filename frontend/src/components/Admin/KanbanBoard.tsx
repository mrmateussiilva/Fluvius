import React, { useEffect, useState } from 'react';
import { fetchKanban, type KanbanResponse, type Conversation } from '../../api/client';
import { User, Clock, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const ConversationCard: React.FC<{ conversation: Conversation }> = ({ conversation }) => {
  const navigate = useNavigate();
  const contactName = conversation.contact?.name || conversation.contact?.phone || 'Desconhecido';
  const time = conversation.last_message_at 
    ? formatDistanceToNow(new Date(conversation.last_message_at), { locale: ptBR, addSuffix: true })
    : 'Sem data';

  return (
    <motion.div
      layout
      onClick={() => navigate(`/?c=${conversation.id}`)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-4 rounded-[16px] border border-fluvius-border shadow-sm hover:shadow-md transition-all cursor-pointer group mb-3"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 shrink-0 border border-slate-100">
          {conversation.contact?.avatar_url ? (
            <img src={conversation.contact.avatar_url} alt={contactName} className="w-full h-full object-cover rounded-full" />
          ) : (
            <User size={20} />
          )}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-slate-800 truncate">{contactName}</h4>
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <Clock size={10} />
            {time}
          </p>
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-auto">
        <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
          conversation.status === 'pending' ? 'bg-amber-100 text-amber-700' :
          conversation.status === 'open' ? 'bg-blue-100 text-blue-700' :
          'bg-emerald-100 text-emerald-700'
        }`}>
          {conversation.status === 'pending' ? 'Fila' : 
           conversation.status === 'open' ? 'Em Aberto' : 'Resolvido'}
        </div>
        {conversation.unread_count > 0 && (
          <span className="w-5 h-5 bg-fluvius-blue-main text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {conversation.unread_count}
          </span>
        )}
      </div>
    </motion.div>
  );
};

export const KanbanBoard: React.FC = () => {
  const [data, setData] = useState<KanbanResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Auto refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const kanban = await fetchKanban();
      setData(kanban);
    } catch (error) {
      console.error('Failed to load kanban:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="w-10 h-10 border-4 border-fluvius-blue-main border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-8 pb-4 shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Painel Kanban</h1>
        <p className="text-slate-500 text-sm">Visualize o fluxo de conversas em tempo real por agente.</p>
      </div>

      <div className="flex-1 overflow-x-auto p-8 pt-0">
        <div className="flex gap-6 h-full min-w-max pb-8">
          {/* Column: Queue */}
          <div className="w-[300px] flex flex-col shrink-0">
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                  <Clock size={16} />
                </div>
                <h3 className="font-bold text-slate-700">Aguardando (Fila)</h3>
              </div>
              <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {data.queue.length}
              </span>
            </div>
            <div className="flex-1 bg-slate-100/50 rounded-[24px] p-3 overflow-y-auto border border-dashed border-slate-300">
              {data.queue.map(c => <ConversationCard key={c.id} conversation={c} />)}
              {data.queue.length === 0 && (
                <div className="h-20 flex items-center justify-center text-slate-400 text-xs italic">
                  Fila vazia
                </div>
              )}
            </div>
          </div>

          {/* Columns: By Agent */}
          {data.by_agent.map(group => (
            <div key={group.agent.id} className="w-[300px] flex flex-col shrink-0">
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-fluvius-blue-main text-white flex items-center justify-center text-xs font-bold shrink-0 border border-white shadow-sm uppercase">
                    {group.agent.name.charAt(0)}
                  </div>
                  <h3 className="font-bold text-slate-700 truncate">{group.agent.name}</h3>
                </div>
                <span className="bg-blue-200 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {group.open.length}
                </span>
              </div>
              <div className="flex-1 bg-blue-50/30 rounded-[24px] p-3 overflow-y-auto border border-blue-100/50">
                {group.open.map(c => <ConversationCard key={c.id} conversation={c} />)}
                {group.open.length === 0 && (
                  <div className="h-20 flex items-center justify-center text-slate-400 text-xs italic">
                    Sem atendimentos ativos
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Column: Resolved */}
          <div className="w-[300px] flex flex-col shrink-0">
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                  <CheckCircle2 size={16} />
                </div>
                <h3 className="font-bold text-slate-700">Resolvidas</h3>
              </div>
            </div>
            <div className="flex-1 bg-emerald-50/20 rounded-[24px] p-3 overflow-y-auto border border-emerald-100/30">
              {data.by_agent.flatMap(g => g.resolved).map(c => (
                <ConversationCard key={c.id} conversation={c} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
