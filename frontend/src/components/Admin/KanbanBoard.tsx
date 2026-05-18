import React, { useEffect, useState } from 'react';
import { 
  fetchKanban, type KanbanResponse, type Conversation,
  pendingConversation, resolveConversation, transferConversation
} from '../../api/client';
import { User, Clock, CheckCircle2, GripVertical, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-white p-3.5 rounded-[16px] border border-slate-200/80 shadow-sm mb-3 flex flex-col gap-3 group transition-all relative overflow-hidden",
        isDragging && !isOverlay ? "opacity-30 border-blue-400 bg-blue-50/30 scale-[0.98]" : "hover:shadow-md hover:border-slate-300",
        isOverlay && "shadow-2xl scale-105 border-blue-500 bg-white ring-4 ring-blue-500/20 cursor-grabbing"
      )}
    >
      {/* Drag Handle & Info */}
      <div className="flex items-start gap-3">
        <button 
          className={cn(
            "mt-1 cursor-grab text-slate-300 hover:text-slate-500 transition-colors",
            isOverlay && "cursor-grabbing"
          )}
          {...listeners}
          {...attributes}
        >
          <GripVertical size={16} />
        </button>

        <div 
          className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200 relative cursor-pointer"
          onClick={() => !isOverlay && navigate(`/?c=${conversation.id}`)}
        >
          {conversation.contact?.avatar_url ? (
            <img src={conversation.contact.avatar_url} alt={contactName} className="w-full h-full object-cover rounded-full" />
          ) : (
            <User size={18} />
          )}
          {/* Status Indicator */}
          <span className={cn(
            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white",
            conversation.status === 'pending' ? 'bg-amber-500' :
            conversation.status === 'open' ? 'bg-emerald-500' :
            'bg-slate-300'
          )} />
        </div>

        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => !isOverlay && navigate(`/?c=${conversation.id}`)}>
          <div className="flex justify-between items-start mb-0.5">
            <h4 className="text-[13px] font-extrabold text-slate-800 truncate leading-tight group-hover:text-blue-600 transition-colors">
              {contactName}
            </h4>
            {conversation.unread_count > 0 && (
              <span className="bg-slate-800 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md min-w-[18px] text-center shadow-sm">
                {conversation.unread_count}
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5 tabular-nums">
            <Clock size={10} className="text-slate-400" />
            {time}
          </p>
        </div>
      </div>

      {/* Tags Row */}
      {conversation.contact?.tags && conversation.contact.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 pl-6 cursor-pointer" onClick={() => !isOverlay && navigate(`/?c=${conversation.id}`)}>
          {conversation.contact.tags.slice(0, 3).map((tag, i) => (
            <span key={i} className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider truncate max-w-[80px]">
              {tag}
            </span>
          ))}
          {conversation.contact.tags.length > 3 && (
            <span className="text-[9px] text-slate-400 font-extrabold px-1 py-0.5">
              +{conversation.contact.tags.length - 3}
            </span>
          )}
        </div>
      )}
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
      header: 'bg-amber-50 border-amber-100 text-amber-800',
      icon: 'bg-amber-100 text-amber-600',
      badge: 'bg-amber-200 text-amber-800',
      zone: 'bg-amber-50/30 border-amber-200/50',
      over: 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20',
      agent: 'bg-amber-500 border-amber-600'
    },
    blue: {
      header: 'bg-blue-50 border-blue-100 text-blue-800',
      icon: 'bg-blue-100 text-blue-600',
      badge: 'bg-blue-200 text-blue-800',
      zone: 'bg-blue-50/30 border-blue-200/50',
      over: 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20',
      agent: 'bg-fluvius-blue-main border-blue-700'
    },
    emerald: {
      header: 'bg-emerald-50 border-emerald-100 text-emerald-800',
      icon: 'bg-emerald-100 text-emerald-600',
      badge: 'bg-emerald-200 text-emerald-800',
      zone: 'bg-emerald-50/30 border-emerald-200/50',
      over: 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20',
      agent: 'bg-emerald-500 border-emerald-600'
    }
  };

  const theme = colors[colorScheme];

  return (
    <div className="w-[320px] flex flex-col shrink-0 h-full">
      {/* Sticky Premium Header */}
      <div className={cn("px-4 py-3 rounded-t-[20px] border-x border-t flex items-center justify-between mb-0 shadow-sm z-10 relative", theme.header)}>
        <div className="flex items-center gap-2.5 min-w-0">
          {agentInitial ? (
            <div className={cn("w-8 h-8 rounded-full text-white flex items-center justify-center text-[11px] font-extrabold shrink-0 border shadow-sm uppercase", theme.agent)}>
              {agentInitial}
            </div>
          ) : (
            <div className={cn("p-1.5 rounded-lg shadow-sm", theme.icon)}>
              {icon}
            </div>
          )}
          <h3 className="font-extrabold text-[13px] truncate">{title}</h3>
        </div>
        <span className={cn("text-[10px] font-extrabold px-2 py-1 rounded-md shadow-sm", theme.badge)}>
          {count}
        </span>
      </div>

      {/* Droppable Zone */}
      <div 
        ref={setNodeRef}
        className={cn(
          "flex-1 p-3 pt-4 border-x border-b border-dashed rounded-b-[20px] overflow-y-auto transition-all duration-200 fluvius-scroll relative",
          theme.zone,
          isOver && theme.over
        )}
      >
        {isOver && (
          <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-0 rounded-b-[20px]" />
        )}
        <div className="relative z-10 h-full flex flex-col">
          {conversations.map(c => <DraggableCard key={c.id} conversation={c} />)}
          {conversations.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400/80 gap-2 min-h-[100px]">
              <div className="w-12 h-12 rounded-full bg-white/60 flex items-center justify-center shadow-sm border border-slate-200/50">
                <Sparkles size={16} className="opacity-50" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider">Vazio</span>
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

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      <div className="p-8 pb-6 shrink-0 bg-white border-b border-slate-200/60 shadow-sm z-10 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1.5 tracking-tight flex items-center gap-2">
            Painel Kanban
            <span className="bg-fluvius-blue-main/10 text-fluvius-blue-main text-[10px] uppercase tracking-widest px-2 py-0.5 rounded font-bold border border-fluvius-blue-main/20">
              Arrastar e Soltar
            </span>
          </h1>
          <p className="text-slate-500 text-[13px] font-medium">Gerencie visualmente o fluxo de conversas da sua equipe. Arraste cards entre as colunas para atribuir ou finalizar contatos instantaneamente.</p>
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
