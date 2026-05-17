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
import { NewChatModal } from './NewChatModal';
import { MessageSquarePlus } from 'lucide-react';

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
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);

  const filteredConversations = conversations.filter(conv => {
    const contactName = conv.contact?.name || conv.contact?.phone || '';
    return contactName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="w-[300px] flex flex-col bg-white border-r border-slate-200 shrink-0 h-full relative z-20 overflow-hidden">
      {/* Header - Simple & Clean */}
      <div className="px-4 py-3 shrink-0 border-b border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center overflow-hidden">
               <img src="/logo.png" alt="Fluvius" className="w-4 h-4 object-contain brightness-0 invert" />
            </div>
            <h1 className="text-[13px] font-bold tracking-tight text-slate-800">Fluvius</h1>
          </div>
          <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded transition-all">
            <Filter size={14} />
          </button>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search..."
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
      <div className="px-2 py-2 shrink-0 border-b border-slate-100">
        <div className="flex bg-slate-50 rounded-md p-0.5">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all relative",
                activeTab === tab.key
                  ? "text-blue-600 bg-white shadow-sm ring-1 ring-slate-200/50"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
              )}
            >
              {tab.label}
              {tab.key === 'pending' && conversations.filter(c => c.status === 'pending').length > 0 && (
                <span className="w-1 h-1 rounded-full bg-amber-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation List - High Density */}
      <div className="flex-1 overflow-y-auto fluvius-scroll pb-4">
        <AnimatePresence mode="popLayout">
          {filteredConversations.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-[11px] font-medium uppercase tracking-widest">No results</p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedId === conv.id;
              const contactName = conv.contact?.name || conv.contact?.phone || 'Unknown';
              
              let timeStr = '';
              if (conv.last_message_at) {
                try {
                  timeStr = formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: ptBR });
                } catch (e) { timeStr = ''; }
              }

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
                    "group relative flex items-center gap-3 px-3 py-2 cursor-pointer transition-all border-l-2 mb-1 rounded-r",
                    isSelected 
                      ? "bg-slate-100/80 border-slate-800" 
                      : "bg-transparent border-transparent hover:bg-slate-50"
                  )}
                >
                  {/* Compact Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden border border-slate-200">
                      {conv.contact?.avatar_url ? (
                        <img src={conv.contact.avatar_url} alt={contactName} className="w-full h-full object-cover" />
                      ) : (
                        <User size={16} className="opacity-40" />
                      )}
                    </div>
                    <span className={cn(
                      "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white",
                      statusColor[conv.status] || 'bg-slate-300'
                    )} />
                  </div>

                  {/* Dense Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <h3 className={cn(
                        "font-bold truncate text-[13px] tracking-tight",
                        isSelected ? "text-slate-900" : "text-slate-700 group-hover:text-slate-900 transition-colors"
                      )}>
                        {contactName}
                      </h3>
                      <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                        {timeStr}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
                        {conv.assignee ? (
                          <span className="truncate bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">{conv.assignee.name}</span>
                        ) : (
                          <span className="text-slate-400 text-[9px] uppercase tracking-wider font-bold">Unassigned</span>
                        )}
                      </div>
                      
                      {conv.unread_count > 0 && (
                        <span className="bg-slate-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded min-w-[16px] text-center">
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
             <Link to="/settings" className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition-colors">
                <SettingsIcon size={14} />
             </Link>
             <button onClick={logout} className="p-1.5 text-slate-400 hover:text-rose-500 rounded transition-colors">
                <LogOut size={16} />
             </button>
          </div>
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
    </div>
  );
};
