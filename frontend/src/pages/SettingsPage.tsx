import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchConnections, fetchConnectionQR, fetchConnectionStatus, deleteConnection, logoutConnection, restartConnection, syncConnection, createConnection, updateConnection } from '../api/client';
import type { Connection } from '../api/client';
import {
  Settings, Plus, RefreshCw, Wifi, WifiOff, QrCode, X,
  ArrowLeft, User, CheckCircle, Loader2, Trash2, LogOut, RotateCcw, DownloadCloud, Layers, Edit3, MessageSquare, Bot, Sparkles, AlertCircle, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { useAuth } from '../context/AuthContext';
import { QueuesTab } from '../components/Settings/QueuesTab';
import { QuickRepliesTab } from '../components/Settings/QuickRepliesTab';
import toast from 'react-hot-toast';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'queues' | 'quick-replies'>('general');

  // Connection state
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connLoading, setConnLoading] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [showCreateConn, setShowCreateConn] = useState(false);
  const [connName, setConnName] = useState('');
  const [creatingConn, setCreatingConn] = useState(false);
  
  // Edit state
  const [editingConn, setEditingConn] = useState<Connection | null>(null);
  const [savingConn, setSavingConn] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    welcome_message: '',
    default_bot_active: true,
    bot_type: 'menu' as 'menu' | 'ai',
    ai_instructions: ''
  });

  const loadConnections = async () => {
    try {
      const data = await fetchConnections();
      setConnections(data);
    } catch (err) {
      console.error(err);
    } finally {
      setConnLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  // Poll status and refresh QR code every 15s while modal is open
  useEffect(() => {
    let intervalId: number;

    if (selectedConnection) {
      intervalId = window.setInterval(async () => {
        try {
          const statusRes = await fetchConnectionStatus(selectedConnection.id);
          if (statusRes.status === 'open' || statusRes.status === 'connected') {
            toast.success('WhatsApp conectado com sucesso!');
            setSelectedConnection(null);
            loadConnections();
            return;
          }
          
          // Refresh QR code to prevent silent expiration
          const qrData = await fetchConnectionQR(selectedConnection.id);
          if (qrData.base64) {
            setQrCode(qrData.base64);
          }
        } catch (err) {
          console.error('QR polling error:', err);
        }
      }, 15000);
    }

    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [selectedConnection]);

  const handleConnect = async (conn: Connection) => {
    setSelectedConnection(conn);
    setQrLoading(true);
    setQrCode(null);
    try {
      const data = await fetchConnectionQR(conn.id);
      if (data.base64) setQrCode(data.base64);
    } catch (err) {
      console.error(err);
    } finally {
      setQrLoading(false);
    }
  };

  const handleRefreshStatus = async (conn: Connection) => {
    try {
      await fetchConnectionStatus(conn.id);
      loadConnections();
    } catch (err) {
      console.error(err);
    }
  };


  const handleDelete = async (conn: Connection) => {
    toast((t) => (
      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium">Remove connection "{conn.name}"?</span>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await deleteConnection(conn.id);
                loadConnections();
              } catch (err) {
                console.error(err);
                toast.error('Erro ao remover conexão.');
              }
            }}
            className="px-3 py-1.5 bg-rose-500 text-white rounded text-xs font-bold"
          >
            Yes, delete
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold"
          >
            Cancelar
          </button>
        </div>
      </div>
    ), { duration: 8000 });
  };
  const handleLogout = async (conn: Connection) => {
    toast((t) => (
      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium">Desconectar "{conn.name}" sem excluir?</span>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await logoutConnection(conn.id);
                loadConnections();
              } catch (err) {
                console.error(err);
                toast.error('Erro ao desconectar.');
              }
            }}
            className="px-3 py-1.5 bg-amber-500 text-white rounded text-xs font-bold"
          >
            Sim, desconectar
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold"
          >
            Cancelar
          </button>
        </div>
      </div>
    ), { duration: 8000 });
  };

  const handleRestart = async (conn: Connection) => {
    try {
      await restartConnection(conn.id);
      // After restart, open QR modal
      handleConnect(conn);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao reconectar.');
    }
  };

  const handleSync = async (conn: Connection) => {
    try {
      await syncConnection(conn.id);
      toast.success('Sync started! Messages will appear soon.', { duration: 6000 });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao iniciar sincronização.');
    }
  };

  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingConn(true);
    try {
      await createConnection({ name: connName });
      setConnName('');
      setShowCreateConn(false);
      loadConnections();
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingConn(false);
    }
  };

  const handleEdit = (conn: Connection) => {
    setEditingConn(conn);
    setEditFormData({
      name: conn.name,
      welcome_message: conn.welcome_message || '',
      default_bot_active: conn.default_bot_active ?? true,
      bot_type: (conn.bot_type as 'menu' | 'ai') || 'menu',
      ai_instructions: conn.ai_instructions || ''
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConn) return;
    setSavingConn(true);
    try {
      await updateConnection(editingConn.id, editFormData);
      toast.success('Connection updated!');
      setEditingConn(null);
      loadConnections();
    } catch (err: any) {
      toast.error(err.message || 'Error updating connection');
    } finally {
      setSavingConn(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 min-h-screen p-6 overflow-y-auto fluvius-scroll">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <Link to="/" className="flex items-center gap-1.5 text-slate-400 hover:text-blue-600 transition-all mb-2 group w-fit font-bold uppercase text-[9px] tracking-wider">
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
              Espaço de Trabalho
            </Link>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <Settings className="text-blue-600" size={20} />
              Configurações
            </h1>
          </div>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-12 gap-6">
          
          {/* Settings Navigation */}
          <div className="col-span-3 space-y-1 bg-white p-2 rounded-xl border border-slate-200/60 shadow-sm h-fit">
            {[
              { id: 'general', label: 'Geral', icon: Settings },
              { id: 'queues', label: 'Setores', icon: Layers },
              { id: 'quick-replies', label: 'Respostas Rápidas', icon: Zap },
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-bold text-[12px] transition-all overflow-hidden group",
                  activeTab === tab.id 
                    ? "bg-fluvius-blue-50/50 text-fluvius-blue-deep" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                )}
              >
                {activeTab === tab.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-fluvius-gradient" />
                )}
                <tab.icon size={16} className={cn("transition-colors", activeTab === tab.id ? "text-fluvius-blue-main" : "text-slate-400 group-hover:text-slate-600")} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="col-span-9 space-y-6">
            {activeTab === 'general' && (
              <>
                {/* Profile Card */}
                <section className="bg-white rounded-xl border border-slate-200/60 overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-fluvius-blue-50/30 to-transparent">
                    <h2 className="font-bold text-fluvius-blue-deep text-[11px] uppercase tracking-wider flex items-center gap-2">
                      <User size={16} className="text-fluvius-blue-main" />
                      Perfil do Usuário
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-6">
                      <div className="w-20 h-20 rounded-full bg-fluvius-gradient flex items-center justify-center text-white font-bold text-3xl shadow-md ring-4 ring-white">
                        {user?.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-1">{user?.name}</h3>
                        <p className="text-slate-500 text-sm font-medium mb-3">{user?.email}</p>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-fluvius-blue-50 text-fluvius-blue-deep rounded-full font-bold text-[10px] uppercase tracking-wider border border-fluvius-blue-100 shadow-sm">
                          {user?.role === 'admin' ? 'Administrador' : 'Atendente'}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Connections Card */}
                <section className="bg-white rounded-xl border border-slate-200/60 overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/30 to-transparent flex justify-between items-center">
                    <h2 className="font-bold text-emerald-700 text-[11px] uppercase tracking-wider flex items-center gap-2">
                      <Wifi size={16} className="text-emerald-500" />
                      Conexões de WhatsApp
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowCreateConn(!showCreateConn)}
                        className="flex items-center gap-1.5 text-[11px] bg-fluvius-blue-main text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-fluvius-blue-deep transition-all hover:shadow-md active:scale-95"
                      >
                        <Plus size={16} />
                        Nova Conexão
                      </button>
                      <button onClick={loadConnections} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                        <RefreshCw size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Create Form */}
                  <AnimatePresence>
                    {showCreateConn && (
                      <motion.form 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        onSubmit={handleCreateConnection} 
                        className="p-5 border-b border-slate-100 bg-slate-50/30 overflow-hidden"
                      >
                        <div className="flex gap-3">
                          <input
                            type="text"
                            placeholder="Nome da conexão..."
                            value={connName}
                            onChange={e => setConnName(e.target.value)}
                            required
                            className="flex-1 border border-slate-200 rounded px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 transition-colors"
                          />
                          <button
                            type="submit"
                            disabled={creatingConn}
                            className="bg-blue-600 text-white px-4 py-2 rounded text-[11px] font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors disabled:opacity-50"
                          >
                            {creatingConn ? <Loader2 size={16} className="animate-spin" /> : "Criar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowCreateConn(false)}
                            className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <X size={20} />
                          </button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  <div className="divide-y divide-slate-100">
                    {connLoading ? (
                      <div className="p-12 text-center flex flex-col items-center gap-3">
                        <Loader2 className="animate-spin text-blue-500" size={24} />
                        <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest">Carregando...</p>
                      </div>
                    ) : connections.length === 0 ? (
                      <div className="p-12 text-center flex flex-col items-center gap-3">
                        <WifiOff className="text-slate-200" size={32} />
                        <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest">Nenhuma conexão</p>
                      </div>
                    ) : (
                      connections.map((conn) => (
                        <div key={conn.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center border shadow-sm transition-all",
                              (conn.status === 'open' || conn.status === 'connected') ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400'
                            )}>
                              {(conn.status === 'open' || conn.status === 'connected') ? <Wifi size={24} className="drop-shadow-sm" /> : <WifiOff size={24} />}
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 text-[14px]">{conn.name}</h3>
                              <div className="flex items-center gap-3 mt-1">
                                <span className={cn(
                                  "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border flex items-center gap-1",
                                  (conn.status === 'open' || conn.status === 'connected') ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200'
                                )}>
                                  {(conn.status === 'open' || conn.status === 'connected') && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                  {(conn.status === 'open' || conn.status === 'connected') ? 'Conectado' : 'Offline'}
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium truncate max-w-[150px] bg-slate-100 px-2 py-0.5 rounded-md">Inst: {conn.instance_name}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleEdit(conn)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => handleRefreshStatus(conn)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors" title="Refresh">
                              <RefreshCw size={14} />
                            </button>
                            {(conn.status === 'open' || conn.status === 'connected') ? (
                              <>
                                <button onClick={() => handleSync(conn)} className="text-[10px] font-bold uppercase tracking-wider text-slate-600 border border-slate-200 px-2 py-1 rounded hover:bg-slate-50 transition-colors" title="Sync">
                                  Sincronizar
                                </button>
                                <button onClick={() => handleLogout(conn)} className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-1 rounded hover:bg-amber-100 transition-colors" title="Logout">
                                  Sair
                                </button>
                              </>
                            ) : (
                              <button onClick={() => handleRestart(conn)} className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors">
                                Reconectar
                              </button>
                            )}
                            {conn.status !== 'open' && conn.status !== 'connected' && (
                              <button onClick={() => handleConnect(conn)} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white bg-slate-900 px-3 py-1 rounded hover:bg-slate-800 transition-colors">
                                <QrCode size={12} />
                                QR Code
                              </button>
                            )}
                            <button onClick={() => handleDelete(conn)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </>
            )}

            <AnimatePresence mode="wait">
              {activeTab === 'queues' && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} key="queues">
                  <QueuesTab />
                </motion.div>
              )}
              {activeTab === 'quick-replies' && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} key="quick-replies">
                  <QuickRepliesTab />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Connection QR Modal */}
      {selectedConnection && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-6">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-sm w-full overflow-hidden border border-slate-200"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Conectar WhatsApp</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{selectedConnection.instance_name}</p>
              </div>
              <button onClick={() => setSelectedConnection(null)} className="p-1 text-slate-400 hover:text-slate-900 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-8 flex flex-col items-center gap-6">
              <div className="p-4 bg-slate-50 rounded border border-slate-100">
                {qrLoading ? (
                  <div className="w-[200px] h-[200px] flex items-center justify-center">
                    <Loader2 size={32} className="animate-spin text-blue-500" />
                  </div>
                ) : qrCode ? (
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <img src={qrCode} alt="QR Code" className="w-[200px] h-[200px]" />
                  </div>
                ) : (
                  <div className="w-[200px] h-[200px] flex flex-col items-center justify-center gap-2 text-slate-400">
                    <AlertCircle size={32} />
                    <p className="text-[9px] font-bold uppercase tracking-wider">Falha ao carregar QR</p>
                  </div>
                )}
              </div>
              
              <div className="text-center space-y-1">
                <p className="text-slate-900 font-bold text-sm">Escanear QR Code</p>
                <p className="text-slate-400 text-[11px] leading-relaxed max-w-[200px] mx-auto">
                  Abra o WhatsApp no seu celular e conecte este dispositivo.
                </p>
              </div>
              
              <div className="w-full flex items-center justify-center gap-2 py-2 bg-blue-50 rounded text-blue-600">
                <RefreshCw size={12} className="animate-spin" />
                <span className="text-[9px] font-bold uppercase tracking-widest">Aguardando...</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Connection Modal */}
      {editingConn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-6">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-xl w-full overflow-hidden border border-slate-200"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Configuração da Instância</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{editingConn.instance_name}</p>
              </div>
              <button onClick={() => setEditingConn(null)} className="p-1 text-slate-400 hover:text-slate-900 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="max-h-[80vh] overflow-y-auto fluvius-scroll">
              <div className="p-8 space-y-8">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Settings size={12} className="text-blue-500" />
                    Identidade
                  </h4>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Nome Amigável</label>
                    <input
                      type="text"
                      value={editFormData.name}
                      onChange={e => setEditFormData({...editFormData, name: e.target.value})}
                      className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] font-medium text-slate-700 outline-none focus:border-blue-500 transition-colors"
                      placeholder="Ex: Vendas"
                    />
                  </div>
                </div>

                {/* Bot Configuration */}
                <div className="space-y-6 pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Bot size={14} className="text-indigo-500" />
                      Automação
                    </h4>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={editFormData.default_bot_active}
                        onChange={e => setEditFormData({...editFormData, default_bot_active: e.target.checked})}
                      />
                      <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {editFormData.default_bot_active && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Mensagem de Boas-vindas</label>
                        <textarea
                          value={editFormData.welcome_message}
                          onChange={e => setEditFormData({...editFormData, welcome_message: e.target.value})}
                          placeholder="Olá! Seja bem-vindo à..."
                          rows={2}
                          className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] outline-none focus:border-blue-500 transition-colors resize-none"
                        />
                      </div>

                      <div className="space-y-2.5">
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Tipo de Bot</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setEditFormData({...editFormData, bot_type: 'menu'})}
                            className={`p-3 rounded border text-left transition-all ${
                              editFormData.bot_type === 'menu' 
                                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                : 'border-slate-200 bg-white text-slate-500 hover:border-blue-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <MessageSquare size={16} />
                              <span className="text-[12px] font-bold">Menu Padrão</span>
                            </div>
                            <p className="text-[10px] opacity-70 leading-relaxed">Seleção por opções (1, 2, 3...)</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditFormData({...editFormData, bot_type: 'ai'})}
                            className={`p-3 rounded border text-left transition-all ${
                              editFormData.bot_type === 'ai' 
                                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                : 'border-slate-200 bg-white text-slate-500 hover:border-blue-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Sparkles size={16} />
                              <span className="text-[12px] font-bold">Agente de IA</span>
                            </div>
                            <p className="text-[10px] opacity-70 leading-relaxed">Conversa natural usando Inteligência Artificial</p>
                          </button>
                        </div>
                      </div>

                      {editFormData.bot_type === 'ai' && (
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Instruções da IA (System Prompt)</label>
                          <textarea
                            value={editFormData.ai_instructions}
                            onChange={e => setEditFormData({...editFormData, ai_instructions: e.target.value})}
                            placeholder="Você é um assistente prestativo para..."
                            rows={4}
                            className="w-full border border-slate-200 rounded px-3 py-2 text-[12px] outline-none focus:border-blue-500 transition-colors resize-none font-mono"
                          />
                          <p className="text-[10px] text-slate-400">Descreva a personalidade do bot, objetivos e base de conhecimento.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingConn(null)}
                  className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingConn}
                  className="px-6 py-2 bg-blue-600 text-white rounded text-[11px] font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {savingConn ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Salvar Alterações
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
