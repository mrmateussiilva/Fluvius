import React, { useState, useEffect } from 'react';
import { Users, MessageSquare, LayoutDashboard, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AgentList } from '../components/Admin/AgentList';
import { GlobalConversations } from '../components/Admin/GlobalConversations';
import { KanbanBoard } from '../components/Admin/KanbanBoard';
import { DashboardOverview } from '../components/Admin/DashboardOverview';

type AdminTab = 'dashboard' | 'agents' | 'conversations' | 'kanban';

export const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  // Collapsible sidebar state loaded from localStorage
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) {
      return saved === 'true';
    }
    // Default to collapsed on small screens and expanded on larger desktop screens
    return window.innerWidth < 1024;
  });

  // Keep preference in localStorage
  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  };

  // Adjust on screen resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-fluvius-bg text-fluvius-text-main">
      {/* Collapsible Sidebar */}
      <div 
        className={`bg-white border-r border-fluvius-border flex flex-col shrink-0 transition-all duration-300 ease-in-out relative ${
          isCollapsed ? 'w-16' : 'w-[260px]'
        }`}
      >
        {/* Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-6 z-20 w-6 h-6 bg-white border border-fluvius-border rounded-full flex items-center justify-center text-slate-400 hover:text-slate-650 hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
          title={isCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        {/* Logo/Inbox link */}
        <div className={`h-[72px] flex items-center border-b border-fluvius-border px-4 transition-all duration-300 ${
          isCollapsed ? 'justify-center' : 'px-6'
        }`}>
          <Link 
            to="/" 
            className={`flex items-center gap-2 text-fluvius-text-sec hover:text-fluvius-blue-main transition-colors font-semibold ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title="Voltar ao Inbox"
          >
            <ArrowLeft size={18} className="shrink-0" />
            {!isCollapsed && <span className="truncate text-sm">Voltar ao Inbox</span>}
          </Link>
        </div>

        {/* Navigation list */}
        <div className="p-3 flex-1 flex flex-col gap-4 overflow-y-auto fluvius-scroll">
          {!isCollapsed && (
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 select-none">
              Painel de Controle
            </h2>
          )}
          
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center rounded-[10px] text-sm font-medium transition-all cursor-pointer ${
                isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
              } ${
                activeTab === 'dashboard' 
                  ? 'bg-fluvius-blue-main/10 text-fluvius-blue-main font-bold' 
                  : 'text-fluvius-text-sec hover:bg-slate-50'
              }`}
              title={isCollapsed ? "Visão Geral" : undefined}
            >
              <LayoutDashboard size={18} className="shrink-0" />
              {!isCollapsed && <span className="truncate">Visão Geral</span>}
            </button>

            <button
              onClick={() => setActiveTab('kanban')}
              className={`w-full flex items-center rounded-[10px] text-sm font-medium transition-all cursor-pointer ${
                isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
              } ${
                activeTab === 'kanban' 
                  ? 'bg-fluvius-blue-main/10 text-fluvius-blue-main font-bold' 
                  : 'text-fluvius-text-sec hover:bg-slate-50'
              }`}
              title={isCollapsed ? "Quadro Kanban" : undefined}
            >
              <LayoutDashboard size={18} className="shrink-0 rotate-90" />
              {!isCollapsed && <span className="truncate">Quadro Kanban</span>}
            </button>

            <button
              onClick={() => setActiveTab('agents')}
              className={`w-full flex items-center rounded-[10px] text-sm font-medium transition-all cursor-pointer ${
                isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
              } ${
                activeTab === 'agents' 
                  ? 'bg-fluvius-blue-main/10 text-fluvius-blue-main font-bold' 
                  : 'text-fluvius-text-sec hover:bg-slate-50'
              }`}
              title={isCollapsed ? "Agentes" : undefined}
            >
              <Users size={18} className="shrink-0" />
              {!isCollapsed && <span className="truncate">Agentes</span>}
            </button>

            <button
              onClick={() => setActiveTab('conversations')}
              className={`w-full flex items-center rounded-[10px] text-sm font-medium transition-all cursor-pointer ${
                isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
              } ${
                activeTab === 'conversations' 
                  ? 'bg-fluvius-blue-main/10 text-fluvius-blue-main font-bold' 
                  : 'text-fluvius-text-sec hover:bg-slate-50'
              }`}
              title={isCollapsed ? "Todas as Conversas" : undefined}
            >
              <MessageSquare size={18} className="shrink-0" />
              {!isCollapsed && <span className="truncate">Todas as Conversas</span>}
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 bg-slate-50 transition-all duration-300 ${
        activeTab === 'kanban' ? 'overflow-hidden flex flex-col h-screen' : 'overflow-y-auto'
      }`}>
        {activeTab === 'dashboard' && <DashboardOverview />}
        {activeTab === 'kanban' && <KanbanBoard />}
        {activeTab === 'agents' && <AgentList />}
        {activeTab === 'conversations' && <GlobalConversations />}
      </div>
    </div>
  );
};
