import React, { useEffect, useState } from 'react';
import { fetchConversations, type Conversation } from '../../api/client';
import { MessageSquare, Clock, CheckCircle2, User } from 'lucide-react';

export const GlobalConversations: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      // By not passing a status, the backend will return all conversations for admins
      const data = await fetchConversations();
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><Clock size={12}/> Pendente</span>;
      case 'open':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><MessageSquare size={12}/> Aberta</span>;
      case 'resolved':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"><CheckCircle2 size={12}/> Resolvida</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">{status}</span>;
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Todas as Conversas</h1>
        <p className="text-[#64748B]">Monitore todos os atendimentos do workspace.</p>
      </div>

      <div className="bg-white rounded-[24px] border border-fluvius-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-fluvius-border">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contato</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Atendente</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Última Mensagem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fluvius-border">
              {conversations.map((conv) => (
                <tr key={conv.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-fluvius-bg flex items-center justify-center text-slate-400 overflow-hidden">
                        {conv.contact?.avatar_url ? (
                          <img
                            src={conv.contact.avatar_url}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <User size={16} />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-[#0F172A]">{conv.contact?.name || conv.contact?.phone}</span>
                        <span className="text-xs text-slate-500">{conv.contact?.phone}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(conv.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {conv.assignee ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                          {conv.assignee.name.charAt(0)}
                        </div>
                        <span className="text-sm text-slate-700">{conv.assignee.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400 italic">Sem atendente</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {conv.last_message_at ? new Date(conv.last_message_at).toLocaleString() : 'N/A'}
                  </td>
                </tr>
              ))}
              {conversations.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    Nenhuma conversa encontrada no momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
