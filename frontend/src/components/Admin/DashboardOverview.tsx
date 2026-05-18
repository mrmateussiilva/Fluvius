import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, CheckCircle2, Clock, MessageCircle, Radio, 
  RefreshCw, Users, UserRoundCheck, ShieldCheck, Zap, 
  ArrowUpRight, ArrowDownLeft, AlertCircle, Share2, Sparkles
} from 'lucide-react';
import { fetchDashboard, type DashboardData, type DashboardRecentConversation } from '../../api/client';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const statusLabel: Record<string, string> = {
  bot: 'Bot',
  pending: 'Fila',
  open: 'Em aberto',
  resolved: 'Resolvidas',
};

const statusStyle: Record<string, string> = {
  bot: 'bg-purple-50 text-purple-700 border-purple-100',
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  open: 'bg-blue-50 text-blue-700 border-blue-100',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: "easeOut" }
  }
} as const;

const StatCard: React.FC<{ 
  label: string; 
  value: string | number; 
  icon: React.ReactNode; 
  detail: string; 
  trend?: { val: string; pos: boolean };
  gradient?: string;
}> = ({ label, value, icon, detail, trend, gradient }) => (
  <motion.div 
    variants={itemVariants}
    whileHover={{ y: -4, transition: { duration: 0.2 } }}
    className="group bg-white border border-fluvius-border rounded-[20px] p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden"
  >
    {gradient && (
      <div className={cn("absolute top-0 right-0 w-32 h-32 opacity-[0.03] -mr-8 -mt-8 rounded-full", gradient)} />
    )}
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{value}</h3>
          {trend && (
            <span className={cn(
              "flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full",
              trend.pos ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            )}>
              {trend.pos ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
              {trend.val}
            </span>
          )}
        </div>
      </div>
      <div className="w-12 h-12 rounded-[14px] bg-slate-50 text-slate-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
    </div>
    <p className="mt-4 text-[13px] text-slate-500 font-medium flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-fluvius-blue-main animate-pulse" />
      {detail}
    </p>
  </motion.div>
);

const ProgressBar: React.FC<{ label: string; value: number; total: number; color: string }> = ({ label, value, total, color }) => {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className="font-bold text-slate-900">{value} <span className="text-[11px] text-slate-400 font-medium">({Math.round(percentage)}%)</span></span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          className={cn("h-full rounded-full shadow-[0_0_10px_rgba(0,0,0,0.05)]", color)}
        />
      </div>
    </div>
  );
};

const ConversationRow: React.FC<{ conversation: DashboardRecentConversation }> = ({ conversation }) => (
  <motion.div 
    variants={itemVariants}
    className="flex items-center gap-4 px-5 py-4 border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 transition-colors"
  >
    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 border border-white shadow-sm">
      <Users size={20} />
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <p className="text-[14px] font-bold text-slate-900 truncate">{conversation.contact_name}</p>
        <span className={cn(
          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter", 
          statusStyle[conversation.status] || 'bg-slate-50 text-slate-600 border-slate-100'
        )}>
          {statusLabel[conversation.status] || conversation.status}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-slate-500 font-medium">{conversation.contact_phone}</p>
    </div>
    <div className="text-right shrink-0">
      <div className="flex items-center justify-end gap-1.5 text-slate-400">
        <UserRoundCheck size={12} />
        <p className="text-[11px] font-semibold">{conversation.assignee_name || 'Sem fila'}</p>
      </div>
      <p className="mt-1 text-[11px] font-bold text-slate-700">
        {conversation.last_message_at ? new Date(conversation.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
      </p>
    </div>
  </motion.div>
);

export const DashboardOverview: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      setError(null);
      const dashboard = await fetchDashboard();
      setData(dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(() => loadDashboard(), 30000); // Auto refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const totals = data?.totals;
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
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-[5px] border-slate-100 rounded-full" />
          <div className="w-16 h-16 border-[5px] border-fluvius-blue-main border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
        </div>
        <p className="text-sm font-bold text-slate-400 animate-pulse uppercase tracking-widest">Carregando painel...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 h-full flex items-center justify-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-rose-50 border border-rose-100 p-8 rounded-[24px] text-center"
        >
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-rose-900 mb-2">Ops! Algo deu errado</h2>
          <p className="text-rose-700 text-sm mb-6">{error || 'Não foi possível conectar ao servidor de dados.'}</p>
          <button 
            onClick={() => loadDashboard(true)}
            className="w-full bg-rose-600 text-white font-bold py-3 rounded-[14px] hover:bg-rose-700 transition-colors"
          >
            Tentar novamente
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-8 space-y-8 max-w-[1600px] mx-auto fluvius-scroll h-full overflow-y-auto"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-fluvius-blue-main/10 rounded-[12px] flex items-center justify-center text-fluvius-blue-main">
              <Zap size={24} />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Painel de Controle</h1>
          </div>
          <p className="mt-1.5 text-[15px] text-slate-500 font-medium">Acompanhe o desempenho do seu atendimento em tempo real.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-full hidden lg:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[13px] font-bold text-slate-600">Sistema Online</span>
          </div>
          <button
            onClick={() => loadDashboard(true)}
            className={cn(
              "inline-flex items-center gap-2.5 rounded-[14px] border border-fluvius-border bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95",
              refreshing && "opacity-50 pointer-events-none"
            )}
          >
            <RefreshCw size={18} className={cn(refreshing && "animate-spin")} />
            {refreshing ? "Atualizando..." : "Sincronizar"}
          </button>
        </div>
      </div>

      {/* Grid de Stats Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-5">
        <StatCard 
          label="Conversas Totais" 
          value={totals!.conversations} 
          icon={<MessageCircle size={22} />} 
          detail={`${data.statuses.open} em atendimento`}
          gradient="bg-blue-500"
        />
        <StatCard 
          label="Em Espera" 
          value={data.statuses.pending} 
          icon={<Clock size={22} />} 
          detail="Aguardando agente"
          gradient="bg-amber-500"
        />
        <StatCard 
          label="Não Lidas" 
          value={totals!.unread} 
          icon={<Activity size={22} />} 
          detail="Mensagens pendentes"
          gradient="bg-rose-500"
        />
        <StatCard 
          label="Contatos" 
          value={totals!.contacts} 
          icon={<Users size={22} />} 
          detail={`${totals!.groups} grupos ativos`}
          gradient="bg-emerald-500"
        />
        <StatCard 
          label="Agentes" 
          value={totals!.agents} 
          icon={<UserRoundCheck size={22} />} 
          detail={`${totals!.online_agents} conectados agora`}
          gradient="bg-indigo-500"
        />
        <StatCard 
          label="Primeira Resposta" 
          value={data.sla.avg_response_minutes > 0 ? `${data.sla.avg_response_minutes} min` : 'Sem dados'} 
          icon={<Zap size={22} />} 
          detail="Meta: < 15 min"
          gradient="bg-orange-500"
        />
        <StatCard 
          label="Tempo Resolução" 
          value={data.sla.avg_resolution_minutes > 0 ? `${data.sla.avg_resolution_minutes} min` : 'Sem dados'} 
          icon={<Clock size={22} />} 
          detail="Meta: < 2 horas"
          gradient="bg-violet-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Distribuição por Status */}
        <motion.section 
          variants={itemVariants}
          className="lg:col-span-3 bg-white border border-fluvius-border rounded-[24px] shadow-sm overflow-hidden flex flex-col"
        >
          <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-slate-900">Funil de Atendimento</h2>
            <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="p-7 space-y-6 flex-1">
            {Object.entries(data.statuses).map(([status, value], idx) => (
              <ProgressBar 
                key={status} 
                label={statusLabel[status]} 
                value={value} 
                total={totals!.conversations}
                color={idx === 0 ? "bg-purple-500" : idx === 1 ? "bg-amber-500" : idx === 2 ? "bg-blue-500" : "bg-emerald-500"}
              />
            ))}
          </div>
        </motion.section>

        {/* Distribuição por Sentimento */}
        <motion.section 
          variants={itemVariants}
          className="lg:col-span-3 bg-white border border-fluvius-border rounded-[24px] shadow-sm overflow-hidden flex flex-col"
        >
          <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-slate-900">Humor da Carteira (IA)</h2>
            <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400">
              <Sparkles size={16} className="text-blue-500 animate-pulse" />
            </div>
          </div>
          <div className="p-7 space-y-6 flex-1 flex flex-col justify-between">
            {/* Segmented Sentiment Bar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">Humor Geral</span>
                <span className="font-bold text-slate-700">Últimas 30 Conversas</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 flex overflow-hidden shadow-inner">
                {(() => {
                  const s = data.sentiments;
                  const total = s.POSITIVE + s.NEUTRAL + s.NEGATIVE + s.URGENT || 1;
                  const posPct = (s.POSITIVE / total) * 100;
                  const neuPct = (s.NEUTRAL / total) * 100;
                  const negPct = (s.NEGATIVE / total) * 100;
                  const urgPct = (s.URGENT / total) * 100;
                  
                  return (
                    <>
                      {s.POSITIVE > 0 && <div style={{ width: `${posPct}%` }} className="bg-emerald-500 h-full transition-all" title="Amigável" />}
                      {s.NEUTRAL > 0 && <div style={{ width: `${neuPct}%` }} className="bg-slate-400 h-full transition-all" title="Neutro" />}
                      {s.NEGATIVE > 0 && <div style={{ width: `${negPct}%` }} className="bg-rose-500 h-full transition-all" title="Frustrado" />}
                      {s.URGENT > 0 && <div style={{ width: `${urgPct}%` }} className="bg-amber-500 h-full transition-all" title="Urgente" />}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Sentiment Legend / Breakdown */}
            <div className="space-y-3">
              {[
                { label: 'Amigável', val: data.sentiments.POSITIVE, color: 'bg-emerald-500', emoji: '😊' },
                { label: 'Neutro', val: data.sentiments.NEUTRAL, color: 'bg-slate-400', emoji: '😐' },
                { label: 'Frustrado', val: data.sentiments.NEGATIVE, color: 'bg-rose-500', emoji: '😠' },
                { label: 'Urgente', val: data.sentiments.URGENT, color: 'bg-amber-500', emoji: '⚠️' }
              ].map((item, idx) => {
                const s = data.sentiments;
                const total = s.POSITIVE + s.NEUTRAL + s.NEGATIVE + s.URGENT || 1;
                const pct = Math.round((item.val / total) * 100);
                
                return (
                  <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                    <div className="flex items-center gap-2">
                      <span className={cn("w-2.5 h-2.5 rounded-full", item.color)} />
                      <span className="text-slate-400 text-[13px]">{item.emoji}</span>
                      <span className="font-semibold text-slate-600">{item.label}</span>
                    </div>
                    <span className="font-bold text-slate-800">
                      {item.val} <span className="text-[10px] text-slate-400 font-medium">({pct}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* Mensagens e Conexões */}
        <div className="lg:col-span-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Mensagens */}
          <motion.section 
            variants={itemVariants}
            className="bg-white border border-fluvius-border rounded-[24px] shadow-sm overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-slate-900">Volume de Mensagens</h2>
              <Radio size={16} className="text-fluvius-blue-main animate-pulse" />
            </div>
            <div className="grid grid-cols-2 gap-px bg-slate-100">
              {[
                { label: 'Hoje', val: data.messages.today, color: 'text-slate-900' },
                { label: '7 dias', val: data.messages.last_7_days, color: 'text-slate-900' },
                { label: 'Recebidas', val: data.messages.inbound, color: 'text-emerald-600' },
                { label: 'Enviadas', val: data.messages.outbound, color: 'text-blue-600' }
              ].map((m, i) => (
                <div key={i} className="bg-white p-6">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.label}</p>
                  <p className={cn("mt-2 text-3xl font-extrabold tracking-tighter", m.color)}>{m.val}</p>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Conexões (Saúde do Sistema) */}
          <motion.section 
            variants={itemVariants}
            className="bg-white border border-fluvius-border rounded-[24px] shadow-sm overflow-hidden flex flex-col"
          >
            <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-slate-900">Saúde das Instâncias</h2>
              <Share2 size={16} className="text-slate-400" />
            </div>
            <div className="p-6 space-y-4 flex-1">
              {data.connections.map((conn, idx) => (
                <div key={idx} className="p-4 rounded-[16px] bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{conn.name}</p>
                    <p className="text-[11px] text-slate-500 font-medium">ID: {conn.instance}</p>
                  </div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-extrabold uppercase",
                    conn.status === 'open' ? "bg-emerald-100 text-emerald-700" : 
                    conn.status === 'connecting' ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"
                  )}>
                    {conn.status}
                  </span>
                </div>
              ))}
              {data.connections.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <div className="p-3 bg-amber-50 text-amber-500 rounded-full mb-3">
                    <AlertCircle size={24} />
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Nenhuma instância vinculada</p>
                </div>
              )}
            </div>
          </motion.section>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[4.5fr_7.5fr] gap-8">
        {/* Performance por Agente */}
        <motion.section 
          variants={itemVariants}
          className="bg-white border border-fluvius-border rounded-[24px] shadow-sm overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-slate-900">Atividade dos Agentes</h2>
          </div>
          <div className="p-7 space-y-6">
            {data.agents.map(agent => {
              const load = agent.open + agent.resolved;
              return (
                <div key={agent.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[10px] font-bold text-slate-500">
                          {agent.name.charAt(0)}
                        </div>
                        <span className={cn(
                          "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white",
                          agent.is_online ? "bg-emerald-500" : "bg-slate-300"
                        )} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-900 truncate">{agent.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{agent.is_online ? 'Disponível' : 'Ausente'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-bold text-slate-900">{agent.open}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Abertas</p>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-slate-50 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(load / maxAgentLoad) * 100}%` }}
                      className="h-full bg-emerald-500" 
                    />
                  </div>
                </div>
              );
            })}
            {data.agents.length === 0 && (
              <p className="text-sm font-medium text-slate-400 text-center py-4">Nenhum agente cadastrado.</p>
            )}
          </div>
        </motion.section>

        {/* Atividade Recente (Feed) */}
        <motion.section 
          variants={itemVariants}
          className="bg-white border border-fluvius-border rounded-[24px] shadow-sm overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-slate-900">Histórico de Atividade</h2>
            <span className="text-[11px] font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase">Tempo Real</span>
          </div>
          <div className="max-h-[500px] overflow-y-auto fluvius-scroll">
            <AnimatePresence mode="popLayout">
              {data.recent_conversations.map(conversation => (
                <ConversationRow key={conversation.id} conversation={conversation} />
              ))}
            </AnimatePresence>
            {data.recent_conversations.length === 0 && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                  <RefreshCw size={24} />
                </div>
                <p className="text-sm font-bold text-slate-400 uppercase">Aguardando interações...</p>
              </div>
            )}
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
};
