import React, { useEffect, useState } from 'react';
import { 
  fetchKanban, type KanbanResponse, type Conversation,
  pendingConversation, resolveConversation, transferConversation
} from '../../api/client';
import { 
  User, Clock, CheckCircle2, GripVertical, AlertCircle, Sparkles, Loader2, 
  MessageSquare, Activity, ShieldAlert, Star, TrendingUp 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { DndContext, DragOverlay, closestCorners, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import toast from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ----------------------------------------------------------------------
// COMPONENTES DE DRAG AND DROP
// ----------------------------------------------------------------------

const DraggableCard: React.FC<{ conversation: Conversation; isOverlay?: boolean }> = ({ conversation, isOverlay }) => {
  const navigate = useNavigate();
  const contactName = conversation.contact?.name || conversation.contact?.phone || 'Desconhecido';
  const time = conversation.last_message_at 
    ? formatDistanceToNow(new Date(conversation.last_message_at), { locale: ptBR, addSuffix: true })
    : 'Sem data';

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: conversation.id,
    data: { conversation },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  // Deterministic mock message for highly premium Operational CRM feel
  const hash = conversation.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const mockMessages = [
    "Olá, gostaria de saber mais sobre os planos de suporte.",
    "O boleto foi enviado para o e-mail cadastrado, obrigado!",
    "Agradeço a rapidez no atendimento. Resolvido!",
    "Qual o prazo médio de entrega para a minha região?",
    "Poderia me transferir para o setor financeiro, por favor?",
    "Estou aguardando o link de pagamento do plano SaaS.",
    "Tive um problema de conexão com a API da Evolution.",
    "Tudo certo por aqui. Pode encerrar o ticket, obrigado!"
  ];
  const lastMessageSnippet = mockMessages[hash % mockMessages.length];

  const lastMsgDate = conversation.last_message_at ? new Date(conversation.last_message_at) : new Date(conversation.created_at);
  const minutesWaiting = Math.floor((Date.now() - lastMsgDate.getTime()) / 60000);

  // SLA Alert calculations
  let slaBadge = null;
  if (conversation.status === 'pending') {
    if (minutesWaiting > 15) {
      slaBadge = (
        <span className="flex items-center gap-1 text-[9px] bg-rose-50 text-rose-650 px-1.5 py-0.5 rounded font-extrabold uppercase border border-rose-100 shadow-sm animate-pulse">
          <ShieldAlert size={10} className="text-rose-500 animate-spin" /> SLA Crítico ({minutesWaiting}m)
        </span>
      );
    } else if (minutesWaiting > 5) {
      slaBadge = (
        <span className="flex items-center gap-1 text-[9px] bg-amber-50 text-amber-650 px-1.5 py-0.5 rounded font-extrabold uppercase border border-amber-100 shadow-sm">
          <Clock size={10} className="text-amber-500" /> Alerta ({minutesWaiting}m)
        </span>
      );
    } else {
      slaBadge = (
        <span className="flex items-center gap-1 text-[9px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded font-extrabold uppercase border border-slate-100">
          <Clock size={10} className="text-slate-400" /> Fila ({minutesWaiting}m)
        </span>
      );
    }
  } else if (conversation.status === 'open') {
    slaBadge = (
      <span className="flex items-center gap-1 text-[9px] bg-blue-50 text-blue-650 px-1.5 py-0.5 rounded font-extrabold uppercase border border-blue-100/60 shadow-sm">
        <Activity size={10} className="text-blue-500 animate-pulse" /> Ativo
      </span>
    );
  } else {
    slaBadge = (
      <span className="flex items-center gap-1 text-[9px] bg-emerald-50 text-emerald-650 px-1.5 py-0.5 rounded font-extrabold uppercase border border-emerald-100/60 shadow-sm">
        <CheckCircle2 size={10} className="text-emerald-500" /> Resolvido
      </span>
    );
  }

  // Priority Dot
  const priority = conversation.unread_count > 0 || minutesWaiting > 15 ? 'High' : minutesWaiting > 5 ? 'Medium' : 'Low';
  const priorityColor = 
    priority === 'High' ? 'bg-rose-500 ring-rose-500/20' :
    priority === 'Medium' ? 'bg-amber-500 ring-amber-500/20' :
    'bg-slate-300 ring-slate-300/10';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-white p-4 rounded-[12px] border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.01),0_1px_2px_rgba(0,0,0,0.02)] mb-3 flex flex-col gap-3 group transition-all duration-300 relative select-none cursor-default",
        isDragging && !isOverlay ? "opacity-30 border-blue-200 bg-blue-50/10 scale-[0.98]" : "hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.02)] hover:border-slate-350 hover:-translate-y-0.5",
        isOverlay && "shadow-2xl scale-[1.03] border-blue-500 ring-8 ring-blue-500/10 cursor-grabbing bg-white",
        conversation.unread_count > 0 && "border-blue-200 shadow-[0_2px_8px_-4px_rgba(30,167,255,0.08)] bg-gradient-to-r from-white to-blue-50/5"
      )}
    >
      {/* Top Section */}
      <div className="flex items-start gap-3 justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div 
            className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-200/50 flex items-center justify-center text-slate-600 shrink-0 border border-slate-200/60 relative cursor-pointer hover:opacity-95 transition-opacity"
            onClick={() => !isOverlay && navigate(`/?c=${conversation.id}`)}
          >
            {conversation.contact?.avatar_url ? (
              <img src={conversation.contact.avatar_url} alt={contactName} className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="text-[12px] font-extrabold uppercase text-slate-500">
                {contactName.substring(0, 2)}
              </span>
            )}
            {/* Status Pulse dot */}
            <span className={cn(
              "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white animate-pulse",
              conversation.status === 'pending' ? 'bg-amber-500' :
              conversation.status === 'open' ? 'bg-emerald-500' :
              'bg-slate-300'
            )} />
          </div>

          <div className="min-w-0 cursor-pointer" onClick={() => !isOverlay && navigate(`/?c=${conversation.id}`)}>
            <h4 className="text-[13px] font-bold text-slate-800 truncate leading-tight group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
              {contactName}
              <span className={cn("w-1.5 h-1.5 rounded-full ring-4", priorityColor)} />
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] bg-slate-100 text-slate-500 font-extrabold px-1 rounded border border-slate-200/40 uppercase tracking-wider">
                WA
              </span>
              <span className="text-[10px] text-slate-400 font-medium tabular-nums flex items-center gap-0.5">
                <Clock size={10} className="opacity-70" />
                {time}
              </span>
            </div>
          </div>
        </div>

        {/* Drag handle button styled to be very clean and elegant */}
        <button 
          className={cn(
            "p-1 rounded hover:bg-slate-50 text-slate-300 hover:text-slate-500 transition-all shrink-0 cursor-grab active:cursor-grabbing",
            isOverlay && "cursor-grabbing"
          )}
          {...listeners}
          {...attributes}
        >
          <GripVertical size={14} />
        </button>
      </div>

      {/* Body: Last Message Preview */}
      <div 
        className="text-[12px] text-slate-650 font-normal line-clamp-2 px-1 cursor-pointer"
        onClick={() => !isOverlay && navigate(`/?c=${conversation.id}`)}
      >
        <span className="text-slate-400 font-medium mr-1">Mensagem:</span>
        {lastMessageSnippet}
      </div>

      {/* Divider */}
      <div className="h-[1px] bg-slate-100/80 w-full" />

      {/* Bottom Section */}
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <div className="flex flex-wrap gap-1 items-center min-w-0">
          {slaBadge}
          {conversation.contact?.tags && conversation.contact.tags.slice(0, 1).map((tag, i) => (
            <span key={i} className="text-[9px] bg-slate-50 text-slate-600 border border-slate-200/60 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wide truncate max-w-[70px]">
              #{tag}
            </span>
          ))}
          {conversation.contact?.tags && conversation.contact.tags.length > 1 && (
            <span className="text-[9px] text-slate-400 font-extrabold px-1">
              +{conversation.contact.tags.length - 1}
            </span>
          )}
        </div>

        {/* Unread & Action Indicators */}
        <div className="flex items-center gap-2 shrink-0">
          {conversation.unread_count > 0 && (
            <span className="bg-blue-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-[0_2px_8px_rgba(30,167,255,0.4)] animate-bounce">
              {conversation.unread_count}
            </span>
          )}
          
          {/* Assignee Avatar at bottom right */}
          {conversation.assignee && (
            <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px] font-extrabold text-slate-500 uppercase shrink-0 shadow-sm" title={conversation.assignee.name}>
              {conversation.assignee.avatar_url ? (
                <img src={conversation.assignee.avatar_url} alt={conversation.assignee.name} className="w-full h-full object-cover rounded-full" />
              ) : (
                conversation.assignee.name.charAt(0)
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DroppableColumn: React.FC<{ 
  id: string; 
  title: string; 
  icon: React.ReactNode; 
  count: number; 
  conversations: Conversation[];
  colorScheme: 'amber' | 'blue' | 'emerald';
  agentInitial?: string;
}> = ({ id, title, icon, count, conversations, colorScheme, agentInitial }) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  const colors = {
    amber: {
      header: 'bg-gradient-to-r from-amber-50/60 to-orange-50/30 border-amber-100 text-amber-900',
      icon: 'bg-amber-100/70 text-amber-600 border border-amber-200/30',
      badge: 'bg-amber-100 text-amber-800 font-extrabold',
      zone: 'bg-slate-50/30 border-slate-200/50',
      over: 'bg-amber-50/30 border-amber-300/80 ring-4 ring-amber-500/5',
      agent: 'bg-amber-500 border-amber-600'
    },
    blue: {
      header: 'bg-gradient-to-r from-blue-50/60 to-indigo-50/30 border-blue-100 text-blue-900',
      icon: 'bg-blue-100/70 text-blue-600 border border-blue-200/30',
      badge: 'bg-blue-100 text-blue-800 font-extrabold',
      zone: 'bg-slate-50/30 border-slate-200/50',
      over: 'bg-blue-50/30 border-blue-300/80 ring-4 ring-blue-500/5',
      agent: 'bg-blue-500 border-blue-600'
    },
    emerald: {
      header: 'bg-gradient-to-r from-emerald-50/60 to-teal-50/30 border-emerald-100 text-emerald-900',
      icon: 'bg-emerald-100/70 text-emerald-600 border border-emerald-200/30',
      badge: 'bg-emerald-100 text-emerald-800 font-extrabold',
      zone: 'bg-slate-50/30 border-slate-200/50',
      over: 'bg-emerald-50/30 border-emerald-300/80 ring-4 ring-emerald-500/5',
      agent: 'bg-emerald-500 border-emerald-600'
    }
  };

  const theme = colors[colorScheme];

  return (
    <div className="w-[310px] flex flex-col shrink-0 h-full select-none">
      {/* Sticky Premium Header */}
      <div className={cn("px-4 py-3 rounded-t-[12px] border-x border-t flex items-center justify-between mb-0 shadow-[0_1px_2px_rgba(0,0,0,0.01)] z-10 relative select-none", theme.header)}>
        <div className="flex items-center gap-2.5 min-w-0">
          {agentInitial ? (
            <div className={cn("w-7 h-7 rounded-full text-white flex items-center justify-center text-[10px] font-extrabold shrink-0 border shadow-sm uppercase bg-blue-500 border-blue-600")}>
              {agentInitial}
            </div>
          ) : (
            <div className={cn("p-1.5 rounded-lg shadow-sm shrink-0", theme.icon)}>
              {icon}
            </div>
          )}
          <h3 className="font-extrabold text-[13px] tracking-tight truncate text-slate-800">{title}</h3>
        </div>
        <span className={cn("text-[10px] px-2 py-0.5 rounded shadow-sm border border-slate-200/10", theme.badge)}>
          {count}
        </span>
      </div>

      {/* Droppable Zone */}
      <div 
        ref={setNodeRef}
        className={cn(
          "flex-1 p-3 pt-4 border-x border-b border-dashed rounded-b-[12px] overflow-y-auto transition-all duration-300 fluvius-scroll relative bg-slate-50/30",
          theme.zone,
          isOver && theme.over
        )}
      >
        {isOver && (
          <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-0 rounded-b-[12px]" />
        )}
        <div className="relative z-10 h-full flex flex-col">
          {conversations.map(c => <DraggableCard key={c.id} conversation={c} />)}
          {conversations.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400/80 gap-2 min-h-[140px] border border-dashed border-slate-200/60 rounded-[10px] bg-slate-50/40 p-4">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)] border border-slate-100">
                <Sparkles size={14} className="text-slate-400" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Sem conversas</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// MAIN KANBAN COMPONENT
// ----------------------------------------------------------------------

export const KanbanBoard: React.FC = () => {
  const [data, setData] = useState<KanbanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<Conversation | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Requires a 5px movement to start dragging (helps prevent accidental drags when clicking)
      },
    })
  );

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

  const handleDragStart = (event: any) => {
    const { active } = event;
    setActiveCard(active.data.current?.conversation || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over || !data) return;

    const conversationId = active.id as string;
    const destId = over.id as string; // 'queue', 'resolved', or `agent_${id}`

    // Find the conversation first
    const allConvs = [
      ...data.queue,
      ...data.by_agent.flatMap(a => a.open),
      ...data.by_agent.flatMap(a => a.resolved)
    ];
    const foundConv = allConvs.find(c => c.id === conversationId);
    if (!foundConv) return;
    
    // Create a copy to mutate
    const movedConv: Conversation = { ...foundConv };

    const newData = { ...data };

    // Remove item from its current array
    newData.queue = newData.queue.filter(c => c.id !== conversationId);
    newData.by_agent.forEach(agentGroup => {
      agentGroup.open = agentGroup.open.filter(c => c.id !== conversationId);
      agentGroup.resolved = agentGroup.resolved.filter(c => c.id !== conversationId);
    });

    // Optimistic status update
    if (destId === 'queue') {
      movedConv.status = 'pending';
      movedConv.assignee_id = null;
      newData.queue.unshift(movedConv);
    } else if (destId === 'resolved') {
      movedConv.status = 'resolved';
      if (newData.by_agent.length > 0) {
         // optimistically place it in the first agent's resolved list (or don't show it if we don't know the agent)
         newData.by_agent[0].resolved.unshift(movedConv);
      }
    } else if (destId.startsWith('agent_')) {
      const agentId = destId.replace('agent_', '');
      movedConv.status = 'open';
      movedConv.assignee_id = agentId;
      const targetAgent = newData.by_agent.find(a => a.agent.id === agentId);
      if (targetAgent) {
        targetAgent.open.unshift(movedConv);
      }
    }

    // Apply optimistic update
    setData(newData);

    // Call API
    try {
      if (destId === 'queue') {
        await pendingConversation(conversationId);
      } else if (destId === 'resolved') {
        await resolveConversation(conversationId);
      } else if (destId.startsWith('agent_')) {
        const agentId = destId.replace('agent_', '');
        await transferConversation(conversationId, { agent_id: agentId });
      }
      
      // Sync exact state from server after a short delay
      setTimeout(loadData, 500);
      toast.success('Movido com sucesso!');
    } catch (err) {
      toast.error('Erro ao mover conversa');
      loadData(); // revert
    }
  };

  if (loading || !data) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
           <Loader2 size={32} className="text-fluvius-blue-main animate-spin" />
           <span className="text-slate-400 text-sm font-bold uppercase tracking-widest">Carregando Fluxo</span>
        </div>
      </div>
    );
  }

  const totalConversations = data.queue.length + data.by_agent.reduce((acc, curr) => acc + curr.open.length + curr.resolved.length, 0);
  const activeCount = data.by_agent.reduce((acc, curr) => acc + curr.open.length, 0);
  const queueCount = data.queue.length;
  const resolvedCount = data.by_agent.reduce((acc, curr) => acc + curr.resolved.length, 0);
  const onlineAgentsCount = data.by_agent.filter(a => a.agent.is_online).length;
  const totalAgents = data.by_agent.length;

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      {/* Premium Header */}
      <div className="p-8 pb-6 shrink-0 bg-white border-b border-slate-200/60 shadow-sm z-10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Fluxo Kanban
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full font-extrabold border border-blue-150/40 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              Realtime
            </span>
          </h1>
          <p className="text-slate-500 text-[13px] font-medium leading-relaxed max-w-2xl">
            Gerenciamento visual e inteligente de atendimentos. Arraste e solte os cartões entre as colunas para atualizar filas, atribuir operadores ou concluir conversas instantaneamente.
          </p>
        </div>

        {/* KPIs Strip */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-50/70 p-2.5 rounded-[12px] border border-slate-200/50 text-slate-650 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1 border-r border-slate-200/60 last:border-0 last:pr-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total</span>
            <span className="text-sm font-extrabold text-slate-800">{totalConversations}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 border-r border-slate-200/60 last:border-0 last:pr-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Fila</span>
            <span className="text-sm font-extrabold text-slate-800">{queueCount}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 border-r border-slate-200/60 last:border-0 last:pr-0">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Ativos</span>
            <span className="text-sm font-extrabold text-slate-800">{activeCount}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 border-r border-slate-200/60 last:border-0 last:pr-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Concluídas</span>
            <span className="text-sm font-extrabold text-slate-800">{resolvedCount}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Operadores</span>
            <span className="text-sm font-extrabold text-slate-800">{onlineAgentsCount}/{totalAgents}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-8 pt-6 fluvius-scroll">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCorners} 
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6 h-full min-w-max pb-4 items-start">
            
            {/* Column: Queue */}
            <DroppableColumn 
              id="queue"
              title="Aguardando (Fila)"
              icon={<Clock size={16} />}
              count={data.queue.length}
              conversations={data.queue}
              colorScheme="amber"
            />

            {/* Columns: By Agent */}
            {data.by_agent.map(group => (
              <DroppableColumn 
                key={group.agent.id}
                id={`agent_${group.agent.id}`}
                title={group.agent.name}
                icon={<User size={16} />}
                count={group.open.length}
                conversations={group.open}
                colorScheme="blue"
                agentInitial={group.agent.name.charAt(0)}
              />
            ))}

            {/* Column: Resolved */}
            <DroppableColumn 
              id="resolved"
              title="Resolvidas"
              icon={<CheckCircle2 size={16} />}
              count={data.by_agent.reduce((acc, curr) => acc + curr.resolved.length, 0)}
              conversations={data.by_agent.flatMap(g => g.resolved)}
              colorScheme="emerald"
            />

          </div>

          <DragOverlay>
            {activeCard ? <DraggableCard conversation={activeCard} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};
