import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchConnections, fetchConnectionQR, fetchConnectionStatus, deleteConnection, logoutConnection, restartConnection, syncConnection, createConnection } from '../api/client';
import type { Connection } from '../api/client';
import {
  Settings, Plus, RefreshCw, Wifi, WifiOff, QrCode, X,
  ArrowLeft, User, CheckCircle, Loader2, Trash2, LogOut, RotateCcw, DownloadCloud, Layers
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { QueuesTab } from '../components/Settings/QueuesTab';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'queues'>('general');

  // Connection state
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connLoading, setConnLoading] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [showCreateConn, setShowCreateConn] = useState(false);
  const [connName, setConnName] = useState('');
  const [creatingConn, setCreatingConn] = useState(false);

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
    if (!confirm(`Remover a conexão "${conn.name}"? Esta ação irá desconectar e apagar a instância.`)) return;
    try {
      await deleteConnection(conn.id);
      loadConnections();
    } catch (err) {
      console.error(err);
      alert('Erro ao remover conexão.');
    }
  };

  const handleLogout = async (conn: Connection) => {
    if (!confirm(`Desconectar "${conn.name}" sem apagar a instância?`)) return;
    try {
      await logoutConnection(conn.id);
      loadConnections();
    } catch (err) {
      console.error(err);
      alert('Erro ao desconectar.');
    }
  };

  const handleRestart = async (conn: Connection) => {
    try {
      await restartConnection(conn.id);
      // After restart, open QR modal
      handleConnect(conn);
    } catch (err) {
      console.error(err);
      alert('Erro ao reconectar.');
    }
  };

  const handleSync = async (conn: Connection) => {
    try {
      await syncConnection(conn.id);
      alert('Sincronização iniciada! Os chats e mensagens aparecerão em alguns instantes no seu Inbox.');
    } catch (err) {
      console.error(err);
      alert('Erro ao iniciar sincronização');
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

  return (
    <div className="flex-1 bg-fluvius-bg min-h-screen p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Back */}
        <div>
          <Link to="/" className="flex items-center gap-2 text-fluvius-text-sec hover:text-fluvius-text-main transition-colors mb-6 group w-fit">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Voltar para o Chat
          </Link>
          <h1 className="text-3xl font-bold text-fluvius-text-main flex items-center gap-3">
            <Settings className="text-fluvius-blue-main" />
            Configurações
          </h1>
        </div>

        {/* Layout */}
        <div className="flex gap-8">
          
          {/* Sidebar */}
          <div className="w-64 shrink-0 space-y-2">
            <button 
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-[12px] font-medium transition-all ${
                activeTab === 'general' ? 'bg-fluvius-surface text-fluvius-blue-deep shadow-sm border border-fluvius-border' : 'text-fluvius-text-sec hover:bg-white hover:text-fluvius-text-main'
              }`}
            >
              <Settings size={18} />
              Geral
            </button>
            <button 
              onClick={() => setActiveTab('queues')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-[12px] font-medium transition-all ${
                activeTab === 'queues' ? 'bg-fluvius-surface text-fluvius-blue-deep shadow-sm border border-fluvius-border' : 'text-fluvius-text-sec hover:bg-white hover:text-fluvius-text-main'
              }`}
            >
              <Layers size={18} />
              Filas / Departamentos
            </button>
          </div>

          <div className="flex-1 space-y-8">
            {activeTab === 'general' && (
              <>
        {/* PROFILE SECTION */}
        <section className="bg-white rounded-[16px] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-fluvius-border overflow-hidden">
          <div className="px-6 py-4 border-b border-fluvius-border bg-fluvius-surface flex justify-between items-center">
            <h2 className="font-semibold text-fluvius-text-main text-lg flex items-center gap-2">
              <User size={18} className="text-fluvius-blue-deep" />
              Meu Perfil
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-fluvius-gradient flex items-center justify-center text-white font-bold text-xl shadow-sm">
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl font-bold text-fluvius-text-main">{user?.name}</h3>
                <p className="text-fluvius-text-sec">{user?.email}</p>
                <span className="inline-block mt-1 text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  {user?.role === 'admin' ? 'Administrador' : 'Operador'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* CONNECTIONS SECTION */}
        <section className="bg-white rounded-[16px] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-fluvius-border overflow-hidden">
          <div className="px-6 py-4 border-b border-fluvius-border bg-fluvius-surface flex justify-between items-center">
            <h2 className="font-semibold text-fluvius-text-main text-lg flex items-center gap-2">
              <Wifi size={18} className="text-fluvius-blue-deep" />
              Conexões WhatsApp
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCreateConn(!showCreateConn)}
                className="flex items-center gap-2 text-sm bg-fluvius-gradient text-white px-3 py-1.5 rounded-[12px] hover:opacity-90 transition-all shadow-sm font-medium"
              >
                <Plus size={16} />
                Nova Conexão
              </button>
              <button onClick={loadConnections} className="text-fluvius-text-sec hover:text-fluvius-text-main transition-colors">
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          {/* Create Connection Form */}
          {showCreateConn && (
            <form onSubmit={handleCreateConnection} className="p-6 border-b border-fluvius-border bg-white">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Nome da conexão (ex: Comercial)"
                  value={connName}
                  onChange={e => setConnName(e.target.value)}
                  required
                  className="flex-1 border border-fluvius-border rounded-[12px] px-3 py-2 text-sm text-fluvius-text-main outline-none focus:border-fluvius-blue-main focus:ring-2 focus:ring-fluvius-blue-main/10"
                />
                <button
                  type="submit"
                  disabled={creatingConn}
                  className="bg-fluvius-gradient text-white px-4 py-2 rounded-[12px] text-sm font-medium hover:opacity-90 transition-all shadow-sm flex items-center gap-2 disabled:opacity-60"
                >
                  {creatingConn ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Criar
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateConn(false)}
                  className="text-fluvius-text-sec hover:text-fluvius-text-main transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </form>
          )}

          <div className="divide-y divide-fluvius-border">
            {connLoading ? (
              <div className="p-12 text-center text-fluvius-text-sec">Carregando conexões...</div>
            ) : connections.length === 0 ? (
              <div className="p-12 text-center text-fluvius-text-sec">Nenhuma conexão configurada.</div>
            ) : (
              connections.map((conn) => (
                <div key={conn.id} className="p-6 flex items-center justify-between hover:bg-fluvius-bg transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm border border-white ${conn.status === 'open' ? 'bg-fluvius-green-water text-white' : 'bg-fluvius-surface text-fluvius-text-sec'}`}>
                      {conn.status === 'open' ? <Wifi size={24} /> : <WifiOff size={24} />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-fluvius-text-main">{conn.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase ${conn.status === 'open' ? 'bg-fluvius-green-water/20 text-fluvius-green-emerald' : 'bg-fluvius-surface text-fluvius-text-sec'}`}>
                          {conn.status === 'open' ? 'Conectado' : 'Desconectado'}
                        </span>
                        <span className="text-xs text-fluvius-text-sec font-mono">{conn.instance_name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleRefreshStatus(conn)} className="p-2 text-fluvius-text-sec hover:text-fluvius-text-main hover:bg-fluvius-surface rounded-full transition-all" title="Atualizar Status">
                      <RefreshCw size={18} />
                    </button>
                    {conn.status === 'open' ? (
                      <>
                        <button onClick={() => handleSync(conn)} className="flex items-center gap-1.5 text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-[12px] text-sm font-medium hover:bg-blue-100 transition-colors" title="Sincronizar Histórico">
                          <DownloadCloud size={15} />
                          Sincronizar
                        </button>
                        <button onClick={() => handleLogout(conn)} className="flex items-center gap-1.5 text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-[12px] text-sm font-medium hover:bg-amber-100 transition-colors" title="Desconectar">
                          <LogOut size={15} />
                          Desconectar
                        </button>
                      </>
                    ) : (
                      <button onClick={() => handleRestart(conn)} className="flex items-center gap-1.5 text-fluvius-blue-main bg-fluvius-blue-main/10 border border-fluvius-blue-main/20 px-3 py-1.5 rounded-[12px] text-sm font-medium hover:bg-fluvius-blue-main/20 transition-colors">
                        <RotateCcw size={15} />
                        Reconectar
                      </button>
                    )}
                    {conn.status !== 'open' && (
                      <button onClick={() => handleConnect(conn)} className="flex items-center gap-1.5 text-white bg-fluvius-gradient px-3 py-1.5 rounded-[12px] text-sm font-medium shadow-sm">
                        <QrCode size={15} />
                        QR Code
                      </button>
                    )}
                    <button onClick={() => handleDelete(conn)} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all" title="Remover conexão">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        </>
      )}

      {activeTab === 'queues' && <QueuesTab />}
      </div>
    </div>

      {/* QR Code Modal */}
      {selectedConnection && (
        <div className="fixed inset-0 bg-fluvius-text-main/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[24px] shadow-2xl max-w-sm w-full overflow-hidden border border-fluvius-border">
            <div className="p-6 border-b border-fluvius-border flex justify-between items-center bg-fluvius-surface">
              <h3 className="font-bold text-fluvius-text-main text-lg">Conectar WhatsApp</h3>
              <button onClick={() => setSelectedConnection(null)} className="text-fluvius-text-sec hover:text-fluvius-text-main transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 flex flex-col items-center text-center bg-white">
              <p className="text-fluvius-text-sec mb-6">Escaneie o QR Code abaixo com o seu WhatsApp.</p>
              <div className="w-64 h-64 bg-fluvius-bg rounded-[16px] flex items-center justify-center border-2 border-dashed border-fluvius-border overflow-hidden">
                {qrLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="animate-spin text-fluvius-blue-main" size={32} />
                    <span className="text-sm text-fluvius-text-sec">Gerando QR...</span>
                  </div>
                ) : qrCode ? (
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-fluvius-text-sec text-sm">Erro ao gerar QR Code</div>
                )}
              </div>
              <div className="mt-6 text-xs text-fluvius-text-sec">
                Instância: <span className="font-mono text-fluvius-text-main">{selectedConnection.instance_name}</span>
              </div>
            </div>
            <div className="p-4 bg-fluvius-surface text-center border-t border-fluvius-border">
              <button onClick={() => setSelectedConnection(null)} className="text-fluvius-text-sec font-medium hover:text-fluvius-text-main transition-colors text-sm">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
};
