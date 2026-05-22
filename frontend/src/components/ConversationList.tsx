import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Conversation } from '../api/client';
import { 
  User, MessageCircle, Clock, Settings as SettingsIcon, 
  Inbox, CheckCircle, AlertCircle, LogOut, Shield, Search, 
  ChevronRight, Filter, MoreHorizontal, ChevronLeft
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAgent } from '../context/AgentContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { NewChatModal } from './NewChatModal';
import { MessageSquarePlus } from 'lucide-react';
import { APP_VERSION } from '../version';
import { CopilotPanel, type CopilotAlert } from './CopilotPanel';

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

const ConversationSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-50/50 mb-0.5 animate-pulse">
    <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200/40 shrink-0" />
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-center mb-1.5">
        <div className="h-3.5 bg-slate-100 rounded w-1/3" />
        <div className="h-2.5 bg-slate-100 rounded w-1/8" />
      </div>
      <div className="h-3 bg-slate-50 rounded w-2/3" />
    </div>
  </div>
);

function formatSmartTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    
    const isToday = date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
      
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();
      
    if (isYesterday) {
      return 'Ontem';
    }
    
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 7) {
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      return days[date.getDay()];
    }
    
    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  } catch (e) {
    return '';
  }
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  activeTab: TabFilter;
  onTabChange: (tab: TabFilter) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  copilotAlerts: CopilotAlert[];
  onSelectCopilotConversation: (id: string) => void;
  onDismissCopilotAlert: (conversationId: string) => void;
  onClearAllCopilotAlerts: () => void;
  isLoading?: boolean;
  typingState?: Record<string, boolean>;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations, selectedId, onSelect, activeTab, onTabChange, isCollapsed = false, onToggleCollapse,
  copilotAlerts, onSelectCopilotConversation, onDismissCopilotAlert, onClearAllCopilotAlerts, isLoading = false,
  typingState = {}
}) => {
  const location = useLocation();
  const { currentAgent } = useAgent();
  const { logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);

  const filteredConversations = conversations.filter(conv => {
    const contactName = conv.contact?.name || conv.contact?.phone || '';
    return contactName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div 
      className={cn(
        "flex flex-col bg-white border-r border-slate-200 shrink-0 h-full relative z-20 overflow-hidden transition-all duration-300",
        isCollapsed ? "w-[72px]" : "w-[300px]"
      )}
    >
      {isCollapsed ? (
        /* ==================== COLLAPSED VIEW (72px) ==================== */
        <>
          {/* Header */}
          <div className="py-3 border-b border-slate-100 flex flex-col items-center gap-3 shrink-0">
            <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center overflow-hidden shrink-0">
               <img src="/logo.png" alt="Fluvius" className="w-4 h-4 object-contain brightness-0 invert" />
            </div>
            <button 
              onClick={onToggleCollapse} 
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-all"
              title="Expandir Menu"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* New Chat Button */}
          <div className="px-2 py-2 border-b border-slate-100 flex justify-center shrink-0">
            <button 
              onClick={() => setIsNewChatModalOpen(true)}
              className="w-9 h-9 flex items-center justify-center shrink-0 bg-fluvius-blue-main hover:bg-fluvius-blue-dark text-white rounded-lg transition-colors group relative"
            >
              <MessageSquarePlus size={16} />
              {/* Tooltip */}
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-[11px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                Nova Conversa
              </div>
            </button>
          </div>

          {/* Tabs Selector - Vertical Compact Icons */}
          <div className="px-2 py-3 border-b border-slate-100 flex flex-col items-center gap-2 shrink-0 bg-slate-50/30">
            {TABS.map(tab => {
              const isSelected = activeTab === tab.key;
              const hasPending = tab.key === 'pending' && conversations.filter(c => c.status === 'pending').length > 0;
              return (
                <button
                  key={tab.key}
                  onClick={() => onTabChange(tab.key)}
                  className={cn(
                    "relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 group border",
                    isSelected
                      ? "text-blue-600 bg-white border-slate-200/80 shadow-sm shadow-slate-100"
                      : "text-slate-400 bg-transparent border-transparent hover:text-slate-600 hover:bg-slate-100/50"
                  )}
                >
                  {tab.icon}
                  {hasPending && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 border border-white animate-pulse" />
                  )}
                  {/* Tooltip */}
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                    {tab.label}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Collapsed Conversation List */}
          <div className="flex-1 overflow-y-auto fluvius-scroll pb-4 flex flex-col items-center py-2 gap-2">
            <AnimatePresence mode="popLayout">
              {filteredConversations.length === 0 ? (
                <div className="py-8 text-center text-slate-300">
                  <MessageCircle size={18} className="mx-auto opacity-30 mb-1" />
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isSelected = selectedId === conv.id;
                  const contactName = conv.contact?.name || conv.contact?.phone || 'Desconhecido';
                  
                  const statusColor: Record<string, string> = {
                    pending: 'bg-amber-500',
                    open: 'bg-emerald-500',
                    bot: 'bg-blue-500',
                    resolved: 'bg-slate-300',
                  };

                  return (
                    <button
                      key={conv.id}
                      onClick={() => onSelect(conv.id)}
                      className={cn(
                        "relative group flex items-center justify-center p-1 cursor-pointer transition-all rounded-full w-12 h-12 hover:bg-slate-50 border shrink-0",
                        isSelected 
                          ? "bg-slate-100 border-slate-200 shadow-sm" 
                          : "bg-transparent border-transparent"
                      )}
                    >
                      {/* Active indicator bar */}
                      {isSelected && <div className="active-indicator !h-5" />}

                      {/* Compact Avatar with status indicator */}
                      <div className="relative shrink-0 w-9 h-9">
                        <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden border border-slate-200/60 shadow-sm">
                          {conv.contact?.avatar_url ? (
                            <img src={conv.contact.avatar_url} alt={contactName} className="w-full h-full object-cover" />
                          ) : (
                            <User size={16} className="opacity-40" />
                          )}
                        </div>
                        <span className={cn(
                          "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm",
                          statusColor[conv.status] || 'bg-slate-300'
                        )} />
                      </div>

                      {/* Unread Count Badge overlay */}
                      {conv.unread_count > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 bg-emerald-500 text-white text-[9px] font-extrabold px-1 py-0.5 rounded-full min-w-[16px] text-center border-2 border-white shadow-sm z-10">
                          {conv.unread_count}
                        </span>
                      )}


                      {/* Tooltip with details */}
                      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-[11px] font-bold p-2.5 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 flex flex-col gap-1 min-w-[140px] text-left">
                        <span className="font-extrabold text-[12px] truncate leading-tight border-b border-slate-700 pb-0.5 mb-0.5">{contactName}</span>
                        {conv.assignee ? (
                          <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400">Atribuído: {conv.assignee.name}</span>
                        ) : (
                          <span className="text-[9px] font-medium uppercase tracking-wider text-slate-500">Sem Atribuição</span>
                        )}
                        {conv.unread_count > 0 && (
                          <span className="text-[9px] font-bold text-amber-400 mt-0.5">{conv.unread_count} não lidas</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </AnimatePresence>
          </div>

          {/* Footer - Vertical Compact Agent Profile */}
          <div className="mt-auto border-t border-slate-100 bg-slate-50/50 py-3 flex flex-col items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-white font-extrabold text-[12px] shrink-0" title={currentAgent?.name}>
              {currentAgent?.name.charAt(0).toUpperCase()}
            </div>
            
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <CopilotPanel
                alerts={copilotAlerts}
                onSelectConversation={onSelectCopilotConversation}
                onDismissAlert={onDismissCopilotAlert}
                onClearAll={onClearAllCopilotAlerts}
                variant="compact"
              />
              
              <Link to="/settings" className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition-colors group relative">
                <SettingsIcon size={16} />
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                  Configurações
                </div>
              </Link>
              
              {currentAgent?.role === 'admin' && (
                <Link to="/admin" className="p-1.5 text-slate-400 hover:text-slate-800 rounded transition-colors group relative">
                  <Shield size={16} />
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                    Painel Admin
                  </div>
                </Link>
              )}

              <button onClick={logout} className="p-1.5 text-slate-400 hover:text-rose-500 rounded transition-colors group relative">
                <LogOut size={16} />
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                  Sair
                </div>
              </button>
            </div>
          </div>
        </>
      ) : (
        /* ==================== EXPANDED VIEW (300px) ==================== */
        <>
          {/* Header - Simple & Clean */}
          <div className="px-4 py-3 shrink-0 border-b border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 group cursor-pointer">
                <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center overflow-hidden">
                   <img src="/logo.png" alt="Fluvius" className="w-4 h-4 object-contain brightness-0 invert" />
                </div>
                <h1 className="text-[13px] font-bold tracking-tight text-slate-800">Fluvius</h1>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded transition-all" title="Filtros">
                  <Filter size={14} />
                </button>
                <button 
                  onClick={onToggleCollapse} 
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded transition-all"
                  title="Recolher Menu"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>
            </div>

            {/* Search & Actions */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-md pl-8 pr-3 py-1.5 text-[12px] text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-blue-200 transition-all outline-none"
                />
              </div>
              <button 
                onClick={() => setIsNewChatModalOpen(true)}
                className="w-8 h-8 flex items-center justify-center shrink-0 bg-fluvius-blue-main hover:bg-fluvius-blue-dark text-white rounded-md transition-colors"
                title="Nova Conversa"
              >
                <MessageSquarePlus size={14} />
              </button>
            </div>
          </div>

          {/* Tabs - Minimalist Selectors */}
          <div className="px-3 py-2 shrink-0 border-b border-slate-100 bg-white">
            <div className="flex gap-1 overflow-x-auto scrollbar-none">
              {TABS.map(tab => {
                const isSelected = activeTab === tab.key;
                const hasPending = tab.key === 'pending' && conversations.filter(c => c.status === 'pending').length > 0;
                return (
                  <button
                    key={tab.key}
                    onClick={() => onTabChange(tab.key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all whitespace-nowrap relative shrink-0",
                      isSelected
                        ? "text-slate-800 bg-slate-100"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {tab.label}
                    {hasPending && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conversation List - High Density */}
          <div className="flex-1 overflow-y-auto fluvius-scroll pb-4">
            {isLoading ? (
              <div className="flex flex-col">
                <ConversationSkeleton />
                <ConversationSkeleton />
                <ConversationSkeleton />
                <ConversationSkeleton />
                <ConversationSkeleton />
                <ConversationSkeleton />
                <ConversationSkeleton />
                <ConversationSkeleton />
              </div>
            ) : (
            <AnimatePresence mode="popLayout">
              {filteredConversations.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-[11px] font-medium uppercase tracking-widest">Nenhum resultado</p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isSelected = selectedId === conv.id;
                  const contactName = conv.contact?.name || conv.contact?.phone || 'Desconhecido';
                  const isTyping = typingState[conv.id];
                  const timeStr = formatSmartTime(conv.last_message_at);

                  const statusColor: Record<string, string> = {
                    pending: 'bg-amber-500',
                    open: 'bg-emerald-500',
                    bot: 'bg-blue-500',
                    resolved: 'bg-slate-300',
                  };

                  return (
                    <div
                      key={conv.id}
                      onClick={() => onSelect(conv.id)}
                      className={cn(
                        "group relative flex items-center gap-3 px-4 py-3 cursor-pointer transition-all border-b border-slate-50/50 mb-0.5",
                        isSelected 
                          ? "bg-slate-100/70" 
                          : "bg-transparent hover:bg-slate-50/60"
                      )}
                    >
                      {/* Active indicator bar */}
                      {isSelected && <div className="active-indicator" />}

                      {/* Compact Avatar */}
                      <div className="relative shrink-0">
                        <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden border border-slate-200/60 shadow-sm">
                          {conv.contact?.avatar_url ? (
                            <img src={conv.contact.avatar_url} alt={contactName} className="w-full h-full object-cover" />
                          ) : (
                            <User size={18} className="opacity-45" />
                          )}
                        </div>
                        <span className={cn(
                          "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white shadow-sm",
                          statusColor[conv.status] || 'bg-slate-300'
                        )} />
                      </div>

                      {/* Dense Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <h3 className={cn(
                            "font-semibold truncate text-[14px] tracking-tight leading-snug",
                            isSelected ? "text-slate-900" : "text-slate-700 group-hover:text-slate-900 transition-colors"
                          )}>
                            {contactName}
                          </h3>
                          <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                            {timeStr}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <div className="text-[12px] text-slate-500 truncate flex-1 mr-2">
                            {isTyping ? (
                              <span className="text-emerald-600 font-semibold animate-pulse flex items-center gap-1">
                                <span className="inline-block w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="inline-block w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="inline-block w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" />
                                digitando...
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[12.5px] leading-tight block truncate">
                                {conv.last_message_preview || (
                                  conv.assignee ? (
                                    <span className="text-[11px] font-medium text-slate-400">Atribuído a {conv.assignee.name}</span>
                                  ) : (
                                    <span className="text-slate-400 text-[11px] font-medium italic">Sem atendente</span>
                                  )
                                )}
                              </span>
                            )}
                          </div>
                          
                          {conv.unread_count > 0 && (
                            <span className="bg-emerald-500 text-white text-[10px] font-bold h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.05)] shrink-0">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </AnimatePresence>
            )}
          </div>


          {/* Footer - Minimalist Identity */}
          <div className="mt-auto border-t border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                 <div className="w-7 h-7 rounded bg-slate-800 flex items-center justify-center text-white font-bold text-[10px]">
                   {currentAgent?.name.charAt(0).toUpperCase()}
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-700 leading-none">{currentAgent?.name}</span>
                    <span className="text-[9px] font-medium text-slate-400 mt-0.5">Online</span>
                 </div>
              </div>
              <div className="flex items-center gap-0.5">
                 <CopilotPanel
                   alerts={copilotAlerts}
                   onSelectConversation={onSelectCopilotConversation}
                   onDismissAlert={onDismissCopilotAlert}
                   onClearAll={onClearAllCopilotAlerts}
                   variant="compact"
                 />
                 <Link to="/settings" className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition-colors">
                    <SettingsIcon size={14} />
                 </Link>
                 <button onClick={logout} className="p-1.5 text-slate-400 hover:text-rose-500 rounded transition-colors">
                    <LogOut size={16} />
                 </button>
              </div>
            </div>
            {/* Version badge */}
            <div className="px-3 pb-2 flex items-center gap-1.5">
              <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">v{APP_VERSION}</span>
              <span className="w-1 h-1 rounded-full bg-emerald-400" title="Sistema online" />
            </div>

            {/* Modals */}
            <NewChatModal 
              isOpen={isNewChatModalOpen} 
              onClose={() => setIsNewChatModalOpen(false)} 
              onSuccess={(convId) => {
                onSelect(convId);
              }}
            />

            {currentAgent?.role === 'admin' && (
              <div className="px-2 pb-2">
                <Link
                  to="/admin"
                  className={cn(
                    "flex items-center justify-center gap-2 w-full py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all",
                    location.pathname.startsWith('/admin') 
                      ? "bg-slate-800 text-white" 
                      : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  )}
                >
                  <Shield size={12} />
                  Admin
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
