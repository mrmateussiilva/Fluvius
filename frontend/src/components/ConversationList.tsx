import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Conversation } from '../api/client';
import { 
  User, MessageCircle, Clock, Settings as SettingsIcon, 
  Inbox, CheckCircle, AlertCircle, LogOut, Shield, Search, 
  ChevronRight, Filter, MoreHorizontal
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAgent } from '../context/AgentContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter(conv => {
    const contactName = conv.contact?.name || conv.contact?.phone || '';
    return contactName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="w-[360px] flex flex-col bg-[#F9FBFC] border-r border-fluvius-border shrink-0 h-full relative z-20">
      {/* Header Premium */}
      <div className="px-5 py-4 shrink-0 space-y-4 bg-white/50 backdrop-blur-sm border-b border-fluvius-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] bg-fluvius-gradient p-[2px]">
              <div className="w-full h-full bg-white rounded-[8px] flex items-center justify-center overflow-hidden">
                <img src="/logo.png" alt="Fluvius" className="w-5 h-5 object-contain" />
              </div>
            </div>
            <h1 className="text-[17px] font-bold tracking-tight text-[#0F172A]">Fluvius</h1>
          </div>
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
            <Filter size={18} />
          </button>
        </div>

        {/* Search Bar Minimalista */}
        <div className="relative group">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-fluvius-blue-main transition-colors" />
          <input 
            type="text" 
            placeholder="Buscar conversas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-100/50 border-none rounded-xl pl-10 pr-4 py-2 text-[14px] text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-fluvius-blue-main/10 focus:bg-white transition-all outline-none"
          />
        </div>
      </div>

      {/* Tabs Estilo Pill */}
      <div className="px-3 py-2 shrink-0">
        <div className="flex p-1 bg-slate-100/80 rounded-xl gap-0.5">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-1.5 text-[12px] font-bold rounded-lg transition-all relative",
                activeTab === tab.key
                  ? "bg-white text-fluvius-blue-deep shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              )}
            >
              {activeTab === tab.key && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute inset-0 bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.06)] -z-10"
                />
              )}
              {tab.label}
              {tab.key === 'pending' && conversations.filter(c => c.status === 'pending').length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation List Refatorada */}
      <div className="flex-1 overflow-y-auto fluvius-scroll px-2 pb-4 space-y-0.5">
        <AnimatePresence mode="popLayout">
          {filteredConversations.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 text-center text-slate-400 flex flex-col items-center gap-3"
            >
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                <MessageCircle size={24} className="text-slate-200" />
              </div>
              <p className="text-[13px] font-medium">Nenhuma conversa encontrada</p>
            </motion.div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedId === conv.id;
              const contactName = conv.contact?.name || conv.contact?.phone || 'Desconhecido';
              
              let timeStr = '';
              if (conv.last_message_at) {
                try {
                  timeStr = formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: ptBR });
                } catch (e) { timeStr = ''; }
              }

              const statusColor: Record<string, string> = {
                pending: 'bg-amber-500',
                open: 'bg-emerald-500',
                bot: 'bg-fluvius-blue-main',
                resolved: 'bg-slate-300',
              };

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={cn(
                    "group relative flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200",
                    isSelected 
                      ? "bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-100" 
                      : "hover:bg-slate-100/80 border border-transparent"
                  )}
                >
                  {/* Status Indicator Bar */}
                  {isSelected && (
                    <motion.div 
                      layoutId="activeBar"
                      className="absolute left-0 top-3 bottom-3 w-1 bg-fluvius-blue-main rounded-full"
                    />
                  )}

                  {/* Avatar Premium */}
                  <div className="relative shrink-0">
                    <div className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center text-slate-400 overflow-hidden shadow-sm border-2 transition-transform duration-300 group-hover:scale-105",
                      isSelected ? "border-fluvius-blue-main/20" : "border-white"
                    )}>
                      {conv.contact?.avatar_url ? (
                        <img src={conv.contact.avatar_url} alt={contactName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                          <User size={20} />
                        </div>
                      )}
                    </div>
                    <span className={cn(
                      "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white shadow-sm transition-colors",
                      statusColor[conv.status] || 'bg-slate-300'
                    )} />
                  </div>

                  {/* Info Hierárquica */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <h3 className={cn(
                        "font-bold truncate pr-2 text-[14px] transition-colors",
                        isSelected ? "text-[#0F172A]" : "text-slate-700"
                      )}>
                        {contactName}
                      </h3>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                        {timeStr}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="text-[12px] text-slate-500 truncate flex items-center gap-1.5">
                        {conv.assignee ? (
                          <>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="truncate">{conv.assignee.name}</span>
                          </>
                        ) : (
                          <span className="text-slate-400">Aguardando...</span>
                        )}
                      </div>
                      
                      {conv.unread_count > 0 && (
                        <span className="bg-fluvius-blue-main text-white text-[10px] font-black px-1.5 py-0.5 rounded-lg shadow-sm min-w-[18px] text-center">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Footer Unificado e Limpo */}
      <div className="mt-auto p-3 bg-white/50 backdrop-blur-md border-t border-fluvius-border/50">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 rounded-xl bg-fluvius-gradient p-[1px] shadow-sm">
                <div className="w-full h-full bg-white rounded-[11px] flex items-center justify-center text-fluvius-blue-deep font-black text-xs">
                  {currentAgent?.name.charAt(0).toUpperCase()}
                </div>
             </div>
             <div className="flex flex-col">
                <span className="text-[13px] font-bold text-slate-800 leading-tight">{currentAgent?.name}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Online</span>
             </div>
          </div>
          <div className="flex items-center gap-1">
             <Link to="/settings" className="p-2 text-slate-400 hover:text-fluvius-blue-main hover:bg-fluvius-blue-main/5 rounded-lg transition-all">
                <SettingsIcon size={18} />
             </Link>
             <button onClick={logout} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                <LogOut size={18} />
             </button>
          </div>
        </div>

        {currentAgent?.role === 'admin' && (
          <Link
            to="/admin"
            className={cn(
              "flex items-center justify-center gap-2 w-full py-2 rounded-xl transition-all font-bold text-[12px] uppercase tracking-wide",
              location.pathname.startsWith('/admin') 
                ? "bg-slate-800 text-white shadow-lg" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            <Shield size={14} />
            Painel Administrativo
          </Link>
        )}
      </div>
    </div>
  );
};
