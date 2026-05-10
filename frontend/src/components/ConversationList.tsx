import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Conversation } from '../api/client';
import { User, MessageCircle, Clock, Settings as SettingsIcon, Inbox, CheckCircle, AlertCircle, LogOut, Shield } from 'lucide-react';
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
    <div className="w-[360px] flex flex-col bg-white border-r border-fluvius-border shrink-0 h-full">
      {/* Header */}
      <div className="h-16 flex items-center px-4 bg-white border-b border-fluvius-border shrink-0">
        <h1 className="text-xl font-semibold text-fluvius-text-main flex items-center gap-2">
          <img src="/logo.png" alt="Fluvius Logo" className="h-8 object-contain" />
          Fluvius
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex p-2 gap-1 border-b border-fluvius-border bg-white shrink-0 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "flex items-center justify-center flex-1 gap-1.5 px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors relative",
              activeTab === tab.key
                ? "bg-[#EFF6FF] text-[#0F5CC0] rounded-[10px]"
                : "text-fluvius-text-sec hover:text-fluvius-text-main hover:bg-[#F8FAFC] rounded-[10px]"
            )}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-4 right-4 h-[3px] rounded-t-full bg-fluvius-gradient" />
            )}
          </button>
        ))}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto fluvius-scroll">
        {conversations.length === 0 ? (
          <div className="p-8 text-center text-fluvius-text-sec flex flex-col items-center gap-3">
            <Clock size={32} className="text-fluvius-border" />
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
              open: 'bg-fluvius-blue-main',
              resolved: 'bg-slate-300',
            };

            return (
              <div
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 min-h-[72px] cursor-pointer transition-all border-b border-fluvius-border/50",
                  isSelected ? "bg-[#EEF8FF] border-l-[3px] border-l-[#1EA7FF] shadow-[0_2px_8px_rgba(30,167,255,0.08)]" : "border-l-[3px] border-l-transparent hover:bg-[#F8FAFC]"
                )}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full bg-fluvius-bg flex items-center justify-center text-fluvius-text-sec overflow-hidden shadow-sm border border-fluvius-border/50">
                    {conv.contact?.avatar_url ? (
                      <img src={conv.contact.avatar_url} alt={contactName} className="w-full h-full object-cover" />
                    ) : (
                      <User size={24} />
                    )}
                  </div>
                  <span className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white", statusColor[conv.status] || 'bg-slate-300')} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className={cn("font-semibold truncate pr-2 text-[15px]", isSelected ? "text-[#0F172A]" : "text-fluvius-text-main")}>{contactName}</h3>
                    {timeStr && <span className="text-[11px] text-fluvius-text-sec whitespace-nowrap font-medium">{timeStr}</span>}
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-fluvius-text-sec truncate">
                      {conv.assignee ? `👤 ${conv.assignee.name}` : 'Sem agente'}
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="bg-fluvius-gradient text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
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
      <div className="border-t border-fluvius-border shrink-0">
        {/* Current Agent Badge */}
        {currentAgent && (
          <Link
            to="/settings"
            className="flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAFC] transition-colors border-b border-fluvius-border"
            title="Trocar agente em Configurações"
          >
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm"
              style={{ background: 'linear-gradient(135deg, #1EA7FF, #34D399)' }}
            >
              {currentAgent.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-fluvius-text-main truncate">{currentAgent.name}</p>
              <p className="text-xs text-fluvius-text-sec truncate">{currentAgent.email}</p>
            </div>
          </Link>
        )}
        <div className="p-3">
          <Link
            to="/settings"
            className={cn(
              "flex items-center gap-3 w-full p-2 rounded-lg transition-colors font-medium text-sm",
              location.pathname === '/settings' ? "bg-[#EFF6FF] text-[#1EA7FF]" : "text-fluvius-text-sec hover:bg-[#F8FAFC]"
            )}
          >
            <SettingsIcon size={18} />
            Configurações
          </Link>
          {currentAgent?.role === 'admin' && (
            <Link
              to="/admin"
              className={cn(
                "flex items-center gap-3 w-full p-2 mt-1 rounded-lg transition-colors font-medium text-sm",
                location.pathname.startsWith('/admin') ? "bg-[#EFF6FF] text-[#1EA7FF]" : "text-fluvius-text-sec hover:bg-[#F8FAFC]"
              )}
            >
              <Shield size={18} />
              Painel Admin
            </Link>
          )}
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
