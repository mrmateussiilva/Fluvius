import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, LayoutDashboard, Filter, Users, 
  Settings, LogOut, Shield, MessageCircle 
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Agent } from '../api/client';
import type { AdminTab } from '../pages/InboxPage';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type GlobalTab = 'chat' | AdminTab;

interface GlobalSidebarProps {
  currentTab: GlobalTab;
  onTabChange: (tab: GlobalTab) => void;
  currentAgent: Agent | null;
  onLogout: () => void;
  onSettings: () => void;
  unreadCount?: number;
}

export const GlobalSidebar: React.FC<GlobalSidebarProps> = ({
  currentTab,
  onTabChange,
  currentAgent,
  onLogout,
  onSettings,
  unreadCount = 0
}) => {
  const isAdmin = currentAgent?.role === 'admin';

  return (
    <div className="w-[68px] h-screen bg-[#0f172a] border-r border-slate-800 flex flex-col items-center py-4 shrink-0 relative z-50 shadow-[4px_0_24px_rgba(0,0,0,0.1)]">
      {/* Logo */}
      <div className="w-10 h-10 bg-gradient-to-br from-fluvius-blue-main to-fluvius-blue-deep rounded-xl flex items-center justify-center shadow-lg shadow-fluvius-blue-main/20 mb-6 shrink-0 relative group cursor-pointer hover:scale-105 transition-transform">
        <img src="/logo.png" alt="Fluvius" className="w-5 h-5 brightness-0 invert" />
        <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-slate-800 text-slate-100 text-[12px] font-semibold px-3 py-1.5 rounded-lg shadow-xl border border-slate-700/50 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all z-50 flex items-center gap-2">
          Fluvius Helpdesk
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex flex-col gap-2 w-full px-2">
        {/* Chat */}
        <button
          onClick={() => onTabChange('chat')}
          className={cn(
            "w-full aspect-square rounded-xl flex items-center justify-center transition-all relative group",
            currentTab === 'chat' 
              ? "bg-slate-800/80 text-fluvius-blue-400" 
              : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
          )}
        >
          {currentTab === 'chat' && (
            <div className="absolute left-0 top-[20%] bottom-[20%] w-[3px] bg-fluvius-blue-main rounded-r-full shadow-[1px_0_8px_rgba(59,130,246,0.5)]" />
          )}
          <MessageSquare size={22} strokeWidth={currentTab === 'chat' ? 2.5 : 2} />
          {unreadCount > 0 && currentTab !== 'chat' && (
            <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-[#0f172a]" />
          )}
          <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-slate-800 text-slate-100 text-[12px] font-semibold px-3 py-1.5 rounded-lg shadow-xl border border-slate-700/50 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all z-50">
            Atendimento {unreadCount > 0 && <span className="ml-1 px-1.5 py-0.5 bg-rose-500 rounded-full text-[10px] text-white">{unreadCount}</span>}
          </div>
        </button>

        {/* Admin Section */}
        {isAdmin && (
          <>
            <div className="w-6 h-px bg-slate-800 mx-auto my-2" />
            
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: 'Visão Geral' },
              { id: 'kanban', icon: Filter, label: 'Kanban', className: "rotate-90" },
              { id: 'agents', icon: Users, label: 'Agentes' },
              { id: 'conversations', icon: MessageCircle, label: 'Conversas Globais' },
            ].map(item => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id as GlobalTab)}
                  className={cn(
                    "w-full aspect-square rounded-xl flex items-center justify-center transition-all relative group",
                    isActive 
                      ? "bg-slate-800/80 text-white" 
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-[25%] bottom-[25%] w-[3px] bg-slate-400 rounded-r-full" />
                  )}
                  <item.icon size={22} className={item.className} strokeWidth={isActive ? 2.5 : 2} />
                  <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-slate-800 text-slate-100 text-[12px] font-semibold px-3 py-1.5 rounded-lg shadow-xl border border-slate-700/50 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all z-50 flex items-center gap-2">
                    <Shield size={12} className="text-slate-400" />
                    {item.label}
                  </div>
                </button>
              );
            })}
          </>
        )}
      </nav>

      {/* Bottom Section */}
      <div className="mt-auto flex flex-col gap-2 w-full px-2">
        <button
          onClick={onSettings}
          className="w-full aspect-square rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-all relative group"
        >
          <Settings size={22} />
          <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-slate-800 text-slate-100 text-[12px] font-semibold px-3 py-1.5 rounded-lg shadow-xl border border-slate-700/50 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all z-50">
            Configurações
          </div>
        </button>

        <button
          onClick={onLogout}
          className="w-full aspect-square rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 transition-all relative group"
        >
          <LogOut size={22} />
          <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-slate-800 text-slate-100 text-[12px] font-semibold px-3 py-1.5 rounded-lg shadow-xl border border-slate-700/50 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all z-50">
            Sair
          </div>
        </button>

        {/* User Avatar */}
        <div className="relative mt-3 mx-auto group cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-[#0f172a] flex items-center justify-center overflow-hidden shadow-sm group-hover:ring-2 group-hover:ring-slate-700 transition-all">
            {currentAgent?.avatar_url ? (
              <img src={currentAgent.avatar_url} alt={currentAgent.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[14px] font-bold text-slate-300">
                {currentAgent?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            )}
          </div>
          {/* Online Indicator */}
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0f172a]" />
          
          <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-slate-800 text-slate-100 text-[12px] font-semibold px-3 py-1.5 rounded-lg shadow-xl border border-slate-700/50 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all z-50">
            {currentAgent?.name || 'Seu Perfil'}
          </div>
        </div>
      </div>
    </div>
  );
};
