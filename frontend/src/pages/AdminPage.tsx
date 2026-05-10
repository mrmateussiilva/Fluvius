import React, { useState } from 'react';
import { Users, MessageSquare, LayoutDashboard, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AgentList } from '../components/Admin/AgentList';
import { GlobalConversations } from '../components/Admin/GlobalConversations';
import { KanbanBoard } from '../components/Admin/KanbanBoard';

type AdminTab = 'dashboard' | 'agents' | 'conversations' | 'kanban';

export const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('kanban');

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-fluvius-bg text-fluvius-text-main">
      {/* Sidebar */}
      <div className="w-[260px] bg-white border-r border-fluvius-border flex flex-col shrink-0">
        <div className="h-[72px] flex items-center px-6 border-b border-fluvius-border">
          <Link to="/" className="flex items-center gap-2 text-fluvius-text-sec hover:text-fluvius-blue-main transition-colors font-medium">
            <ArrowLeft size={18} />
            Voltar ao Inbox
          </Link>
        </div>
        <div className="p-4 flex-1">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Painel de Controle</h2>
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-sm font-medium transition-colors ${
                activeTab === 'dashboard' ? 'bg-fluvius-blue-main/10 text-fluvius-blue-main' : 'text-fluvius-text-sec hover:bg-slate-50'
              }`}
            >
              <LayoutDashboard size={18} />
              Visão Geral
            </button>
            <button
              onClick={() => setActiveTab('kanban')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-sm font-medium transition-colors ${
                activeTab === 'kanban' ? 'bg-fluvius-blue-main/10 text-fluvius-blue-main' : 'text-fluvius-text-sec hover:bg-slate-50'
              }`}
            >
              <LayoutDashboard size={18} />
              Quadro Kanban
            </button>
            <button
              onClick={() => setActiveTab('agents')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-sm font-medium transition-colors ${
                activeTab === 'agents' ? 'bg-fluvius-blue-main/10 text-fluvius-blue-main' : 'text-fluvius-text-sec hover:bg-slate-50'
              }`}
            >
              <Users size={18} />
              Agentes
            </button>
            <button
              onClick={() => setActiveTab('conversations')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-sm font-medium transition-colors ${
                activeTab === 'conversations' ? 'bg-fluvius-blue-main/10 text-fluvius-blue-main' : 'text-fluvius-text-sec hover:bg-slate-50'
              }`}
            >
              <MessageSquare size={18} />
              Todas as Conversas
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {activeTab === 'dashboard' && (
          <div className="p-8">
            <h1 className="text-2xl font-bold mb-6">Visão Geral</h1>
            <p className="text-slate-500">Dashboard em construção...</p>
          </div>
        )}
        {activeTab === 'kanban' && <KanbanBoard />}
        {activeTab === 'agents' && <AgentList />}
        {activeTab === 'conversations' && <GlobalConversations />}
      </div>
    </div>
  );
};
