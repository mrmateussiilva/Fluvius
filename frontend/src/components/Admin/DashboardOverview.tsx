import React, { useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Clock, MessageCircle, Radio, RefreshCw, Users, UserRoundCheck } from 'lucide-react';
import { fetchDashboard, type DashboardData, type DashboardRecentConversation } from '../../api/client';

const statusLabel: Record<string, string> = {
  bot: 'Bot',
  pending: 'Fila',
  open: 'Em aberto',
  resolved: 'Resolvidas',
};

const statusStyle: Record<string, string> = {
  bot: 'bg-violet-50 text-violet-700 border-violet-100',
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  open: 'bg-blue-50 text-blue-700 border-blue-100',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const StatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; detail: string }> = ({ label, value, icon, detail }) => (
  <div className="bg-white border border-fluvius-border rounded-[8px] p-5 shadow-sm">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase">{label}</p>
        <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
      </div>
      <div className="w-10 h-10 rounded-[8px] bg-slate-100 text-slate-700 flex items-center justify-center">
        {icon}
      </div>
    </div>
    <p className="mt-3 text-sm text-slate-500">{detail}</p>
  </div>
);

const ConversationRow: React.FC<{ conversation: DashboardRecentConversation }> = ({ conversation }) => (
  <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 border-b border-slate-100 last:border-b-0">
    <div className="min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{conversation.contact_name}</p>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusStyle[conversation.status] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
          {statusLabel[conversation.status] || conversation.status}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500 truncate">{conversation.contact_phone}</p>
    </div>
    <div className="text-right">
      <p className="text-xs text-slate-500">{conversation.assignee_name || 'Sem atendente'}</p>
      <p className="mt-1 text-xs font-medium text-slate-700">
        {conversation.last_message_at ? new Date(conversation.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sem mensagem'}
      </p>
    </div>
  </div>
);

export const DashboardOverview: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      setError(null);
      const dashboard = await fetchDashboard();
      setData(dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const maxStatus = useMemo(() => {
    if (!data) return 1;
    return Math.max(...Object.values(data.statuses), 1);
  }, [data]);

  const maxAgentLoad = useMemo(() => {
    if (!data) return 1;
    return Math.max(...data.agents.map(agent => agent.open + agent.resolved), 1);
  }, [data]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-fluvius-blue-main border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <div className="rounded-[8px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error || 'Dashboard indisponível'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Visão Geral</h1>
          <p className="mt-1 text-sm text-slate-500">Resumo operacional do atendimento no workspace.</p>
        </div>
        <button
          onClick={loadDashboard}
          className="inline-flex items-center gap-2 rounded-[8px] border border-fluvius-border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard label="Conversas" value={data.totals.conversations} icon={<MessageCircle size={20} />} detail={`${data.statuses.open} abertas agora`} />
        <StatCard label="Na fila" value={data.statuses.pending} icon={<Clock size={20} />} detail="Aguardando atendimento" />
        <StatCard label="Não lidas" value={data.totals.unread} icon={<Activity size={20} />} detail="Mensagens pendentes" />
        <StatCard label="Contatos" value={data.totals.contacts} icon={<Users size={20} />} detail={`${data.totals.groups} grupos sincronizados`} />
        <StatCard label="Agentes" value={data.totals.agents} icon={<UserRoundCheck size={20} />} detail={`${data.agents.filter(agent => agent.is_online).length} online`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <section className="bg-white border border-fluvius-border rounded-[8px] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-fluvius-border">
            <h2 className="text-sm font-bold text-slate-900">Distribuição por status</h2>
          </div>
          <div className="p-5 space-y-4">
            {Object.entries(data.statuses).map(([status, value]) => (
              <div key={status} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{statusLabel[status]}</span>
                  <span className="font-semibold text-slate-900">{value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-fluvius-blue-main" style={{ width: `${(value / maxStatus) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-fluvius-border rounded-[8px] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-fluvius-border flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Mensagens</h2>
            <Radio size={16} className="text-slate-400" />
          </div>
          <div className="grid grid-cols-2 gap-px bg-fluvius-border">
            <div className="bg-white p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase">Hoje</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{data.messages.today}</p>
            </div>
            <div className="bg-white p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase">7 dias</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{data.messages.last_7_days}</p>
            </div>
            <div className="bg-white p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase">Recebidas</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{data.messages.inbound}</p>
            </div>
            <div className="bg-white p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase">Enviadas</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{data.messages.outbound}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
        <section className="bg-white border border-fluvius-border rounded-[8px] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-fluvius-border">
            <h2 className="text-sm font-bold text-slate-900">Carga por agente</h2>
          </div>
          <div className="p-5 space-y-4">
            {data.agents.map(agent => {
              const load = agent.open + agent.resolved;
              return (
                <div key={agent.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2.5 w-2.5 rounded-full ${agent.is_online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span className="text-sm font-medium text-slate-800 truncate">{agent.name}</span>
                    </div>
                    <span className="text-xs text-slate-500">{agent.open} abertas</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${(load / maxAgentLoad) * 100}%` }} />
                  </div>
                </div>
              );
            })}
            {data.agents.length === 0 && <p className="text-sm text-slate-500">Nenhum agente cadastrado.</p>}
          </div>
        </section>

        <section className="bg-white border border-fluvius-border rounded-[8px] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-fluvius-border flex items-center gap-2">
            <CheckCircle2 size={16} className="text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">Atividade recente</h2>
          </div>
          <div>
            {data.recent_conversations.map(conversation => (
              <ConversationRow key={conversation.id} conversation={conversation} />
            ))}
            {data.recent_conversations.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-slate-500">Nenhuma conversa sincronizada.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
