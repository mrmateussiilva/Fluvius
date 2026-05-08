import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Conversation } from '../api/client';
import { User, MessageCircle, Clock, Settings as SettingsIcon, Inbox, CheckCircle, AlertCircle, LogOut } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAgent } from '../context/AgentContext';
import { useAuth } from '../context/AuthContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type TabFilter = 'all' | 'pending' | 'mine' | 'resolved';

const TABS: { key: TabFilter; label: string; icon: React.ReactNode }[] = [
  { key: 'pending', label: 'Pendentes', icon: <AlertCircle size={14} /> },
  { key: 'mine', label: 'Minhas', icon: <Inbox size={14} /> },
  { key: 'all', label: 'Todas', icon: <MessageCircle size={14} /> },
  { key: 'resolved', label: 'Resolvidas', icon: <CheckCircle size={14} /> },
];

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  activeTab: TabFilter;
  onTabChange: (tab: TabFilter) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations, selectedId, onSelect, activeTab, onTabChange,
}) => {
  const location = useLocation();
  const { currentAgent } = useAgent();
  const { logout } = useAuth();

  return (
    <div className="w-[360px] flex flex-col bg-white border-r border-slate-200 shrink-0 h-full">
      {/* Header */}
      <div className="h-16 flex items-center px-4 bg-slate-50 border-b border-slate-200 shrink-0">
        <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
          <MessageCircle className="text-emerald-500" />
          Fluvius
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white shrink-0 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
              activeTab === tab.key
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-3">
            <Clock size={32} className="text-slate-300" />
            <p className="text-sm">Nenhuma conversa nesta fila.</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isSelected = selectedId === conv.id;
            const contactName = conv.contact?.name || conv.contact?.phone || 'Unknown Contact';

            let timeStr = '';
            if (conv.last_message_at) {
              try {
                timeStr = formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: ptBR });
              } catch (e) {
                timeStr = '';
              }
            }

            const statusColor: Record<string, string> = {
              pending: 'bg-amber-400',
              open: 'bg-emerald-500',
              resolved: 'bg-slate-300',
            };

            return (
              <div
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "flex items-center gap-3 p-3 cursor-pointer transition-colors border-b border-slate-100",
                  isSelected ? "bg-slate-100" : "hover:bg-slate-50"
                )}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 overflow-hidden">
                    {conv.contact?.avatar_url ? (
                      <img src={conv.contact.avatar_url} alt={contactName} className="w-full h-full object-cover" />
                    ) : (
                      <User size={22} />
                    )}
                  </div>
                  <span className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white", statusColor[conv.status] || 'bg-slate-300')} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className="font-medium text-slate-900 truncate pr-2 text-sm">{contactName}</h3>
                    {timeStr && <span className="text-xs text-slate-400 whitespace-nowrap">{timeStr}</span>}
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-slate-500 truncate">
                      {conv.assignee ? `👤 ${conv.assignee.name}` : 'Sem agente'}
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="border-t border-slate-200 shrink-0">
        {/* Current Agent Badge */}
        {currentAgent && (
          <Link
            to="/settings"
            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-100 transition-colors border-b border-slate-100"
            title="Trocar agente em Configurações"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
              {currentAgent.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{currentAgent.name}</p>
              <p className="text-xs text-slate-400 truncate">{currentAgent.email}</p>
            </div>
          </Link>
        )}
        <div className="p-3">
          <Link
            to="/settings"
            className={cn(
              "flex items-center gap-3 w-full p-2 rounded-lg transition-colors font-medium text-sm",
              location.pathname === '/settings' ? "bg-indigo-100 text-indigo-700" : "text-slate-600 hover:bg-slate-200"
            )}
          >
            <SettingsIcon size={18} />
            Configurações
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full p-2 mt-1 rounded-lg transition-colors font-medium text-sm text-rose-600 hover:bg-rose-50"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
};
