import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchConnections, fetchConnectionQR, fetchConnectionStatus } from '../api/client';
import type { Connection } from '../api/client';
import {
  Settings, Plus, RefreshCw, Wifi, WifiOff, QrCode, X,
  ArrowLeft, User, CheckCircle, Loader2,
} from 'lucide-react';
import { useAgent } from '../context/AgentContext';
import { API_BASE_URL } from '../api/client';

export const SettingsPage: React.FC = () => {
  const { agents, currentAgent, setCurrentAgent, reloadAgents } = useAgent();

  // Connection state
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connLoading, setConnLoading] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [showCreateConn, setShowCreateConn] = useState(false);
  const [connName, setConnName] = useState('');
  const [creatingConn, setCreatingConn] = useState(false);

  // Agent creation state
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

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

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const workspaceId = agents[0]?.workspace_id || connections[0]?.workspace_id;
      if (!workspaceId) {
        setCreateError('Workspace não encontrado.');
        return;
      }
      
      const token = localStorage.getItem('fluvius_token');
      const res = await fetch(`${API_BASE_URL}/agents`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: agentName, email: agentEmail, workspace_id: workspaceId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setCreateError(data.detail || 'Erro ao criar agente.');
        return;
      }
      setAgentName('');
      setAgentEmail('');
      setShowCreateAgent(false);
      await reloadAgents();
    } catch (err) {
      setCreateError('Erro de conexão.');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingConn(true);
    try {
      const token = localStorage.getItem('fluvius_token');
      const res = await fetch(`${API_BASE_URL}/connections`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: connName }),
      });

      if (!res.ok) throw new Error('Falha ao criar conexão');
      
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
    <div className="flex-1 bg-slate-50 min-h-screen p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Back */}
        <div>
          <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors mb-6 group w-fit">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Voltar para o Chat
          </Link>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Settings className="text-slate-400" />
            Configurações
          </h1>
        </div>

        {/* AGENTS SECTION */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h2 className="font-semibold text-slate-700 text-lg flex items-center gap-2">
              <User size={18} className="text-slate-400" />
              Agentes
            </h2>
            <button
              onClick={() => setShowCreateAgent(!showCreateAgent)}
              className="flex items-center gap-2 text-sm bg-emerald-500 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition-colors font-medium"
            >
              <Plus size={16} />
              Novo Agente
            </button>
          </div>

          {/* Create form */}
          {showCreateAgent && (
            <form onSubmit={handleCreateAgent} className="p-6 border-b border-slate-100 bg-slate-50/30">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Nome do agente"
                  value={agentName}
                  onChange={e => setAgentName(e.target.value)}
                  required
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <input
                  type="email"
                  placeholder="Email do agente"
                  value={agentEmail}
                  onChange={e => setAgentEmail(e.target.value)}
                  required
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2 disabled:opacity-60"
                >
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Criar
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateAgent(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              {createError && <p className="text-red-500 text-sm mt-2">{createError}</p>}
            </form>
          )}

          {/* Agents list */}
          <div className="divide-y divide-slate-100">
            {agents.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">Nenhum agente cadastrado.</div>
            ) : (
              agents.map(agent => {
                const isActive = currentAgent?.id === agent.id;
                return (
                  <div key={agent.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {agent.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-800">{agent.name}</p>
                        {isActive && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                            Você
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 truncate">{agent.email}</p>
                    </div>
                    {!isActive && (
                      <button
                        onClick={() => setCurrentAgent(agent)}
                        className="text-sm text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors font-medium"
                      >
                        Trocar para este
                      </button>
                    )}
                    {isActive && (
                      <CheckCircle size={20} className="text-emerald-500 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* CONNECTIONS SECTION */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h2 className="font-semibold text-slate-700 text-lg flex items-center gap-2">
              <Wifi size={18} className="text-slate-400" />
              Conexões WhatsApp
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCreateConn(!showCreateConn)}
                className="flex items-center gap-2 text-sm bg-emerald-500 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition-colors font-medium"
              >
                <Plus size={16} />
                Nova Conexão
              </button>
              <button onClick={loadConnections} className="text-slate-400 hover:text-slate-600 transition-colors">
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          {/* Create Connection Form */}
          {showCreateConn && (
            <form onSubmit={handleCreateConnection} className="p-6 border-b border-slate-100 bg-slate-50/30">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Nome da conexão (ex: Comercial)"
                  value={connName}
                  onChange={e => setConnName(e.target.value)}
                  required
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <button
                  type="submit"
                  disabled={creatingConn}
                  className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2 disabled:opacity-60"
                >
                  {creatingConn ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Criar
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateConn(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </form>
          )}

          <div className="divide-y divide-slate-100">
            {connLoading ? (
              <div className="p-12 text-center text-slate-400">Carregando conexões...</div>
            ) : connections.length === 0 ? (
              <div className="p-12 text-center text-slate-400">Nenhuma conexão configurada.</div>
            ) : (
              connections.map((conn) => (
                <div key={conn.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${conn.status === 'open' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      {conn.status === 'open' ? <Wifi size={24} /> : <WifiOff size={24} />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{conn.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase ${conn.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {conn.status === 'open' ? 'Conectado' : 'Desconectado'}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">{conn.instance_name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleRefreshStatus(conn)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-all" title="Atualizar Status">
                      <RefreshCw size={20} />
                    </button>
                    {conn.status !== 'open' && (
                      <button onClick={() => handleConnect(conn)} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-100 transition-colors">
                        <QrCode size={18} />
                        Conectar
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* QR Code Modal */}
      {selectedConnection && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-lg">Conectar WhatsApp</h3>
              <button onClick={() => setSelectedConnection(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 flex flex-col items-center text-center">
              <p className="text-slate-600 mb-6">Escaneie o QR Code abaixo com o seu WhatsApp.</p>
              <div className="w-64 h-64 bg-slate-100 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden">
                {qrLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="animate-spin text-indigo-500" size={32} />
                    <span className="text-sm text-slate-400">Gerando QR...</span>
                  </div>
                ) : qrCode ? (
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-slate-400 text-sm">Erro ao gerar QR Code</div>
                )}
              </div>
              <div className="mt-6 text-xs text-slate-400">
                Instância: <span className="font-mono text-slate-600">{selectedConnection.instance_name}</span>
              </div>
            </div>
            <div className="p-4 bg-slate-50 text-center">
              <button onClick={() => setSelectedConnection(null)} className="text-slate-500 font-medium hover:text-slate-700 transition-colors text-sm">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
