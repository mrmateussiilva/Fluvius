import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Rocket, Wifi, Users, ArrowRight, CheckCircle2, 
  QrCode, Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, fetchConnectionQR, fetchConnectionStatus } from '../api/client';
import { fetchWithAuth } from '../api/client';
import type { Connection } from '../api/client';
import toast from 'react-hot-toast';

export const OnboardingPage: React.FC = () => {
  const [step, setStep] = useState(1);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Connection State
  const [creatingConn, setCreatingConn] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [statusInterval, setStatusInterval] = useState<any | null>(null);

  // Agent State
  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentPassword, setAgentPassword] = useState('');
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [agentCreated, setAgentCreated] = useState(false);

  useEffect(() => {
    // Cleanup interval on unmount
    return () => {
      if (statusInterval) clearInterval(statusInterval);
    };
  }, [statusInterval]);

  const handleCreateConnection = async () => {
    setCreatingConn(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Conexão Principal' }),
      });

      if (!res.ok) throw new Error('Falha ao criar conexão');
      const data = await res.json();
      setConnection(data);
      
      // Get QR Code
      setQrLoading(true);
      const qrData = await fetchConnectionQR(data.id);
      if (qrData.base64) setQrCode(qrData.base64);
      setQrLoading(false);

      // Start status polling & QR refresh
      const interval = setInterval(async () => {
        try {
          const status = await fetchConnectionStatus(data.id);
          if (status?.instance?.state === 'open' || status?.status === 'connected') {
            clearInterval(interval);
            setStep(3); // Move to next step
            return;
          }

          // If still waiting, refresh QR to prevent expiration
          const qrData = await fetchConnectionQR(data.id);
          if (qrData.base64) {
            setQrCode(qrData.base64);
          }
        } catch (e) {
          console.error('Status check or QR fetch failed', e);
        }
      }, 10000);
      setStatusInterval(interval);

    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar conexão');
    } finally {
      setCreatingConn(false);
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingAgent(true);
    try {

      const res = await fetchWithAuth(`${API_BASE_URL}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: agentName, 
          email: agentEmail, 
          password: agentPassword,
          role: 'operator',
          workspace_id: user?.workspace_id
        }),
      });

      if (!res.ok) throw new Error('Erro ao criar agente');
      setAgentCreated(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      toast.error('Erro ao criar agente');
    } finally {
      setCreatingAgent(false);
    }
  };

  return (
    <div className="min-h-screen bg-fluvius-bg flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-fluvius-blue-main/5 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-fluvius-green-water/5 blur-[120px] rounded-full" />

      <div className="w-full max-w-2xl relative z-10">
        {/* Progress Bar */}
        <div className="flex justify-between mb-12 px-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${
                step >= s ? 'bg-fluvius-gradient text-white shadow-lg shadow-blue-500/20 scale-110' : 'bg-white border border-slate-200 text-slate-400'
              }`}>
                {step > s ? <CheckCircle2 size={20} /> : s}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${step >= s ? 'text-fluvius-blue-main' : 'text-slate-400'}`}>
                {s === 1 ? 'Bem-vindo' : s === 2 ? 'WhatsApp' : 'Equipe'}
              </span>
            </div>
          ))}
          {/* Connector Lines */}
          <div className="absolute top-5 left-0 w-full h-[2px] bg-slate-100 -z-10 px-12">
            <motion.div 
              className="h-full bg-fluvius-gradient" 
              initial={{ width: '0%' }}
              animate={{ width: `${(step - 1) * 50}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white p-10 rounded-[32px] border border-fluvius-border shadow-xl text-center"
            >
              <div className="w-20 h-20 bg-blue-50 text-fluvius-blue-main rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Rocket size={40} />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-4">Olá, {user?.name}!</h1>
              <p className="text-slate-500 mb-8 max-w-md mx-auto leading-relaxed">
                O seu workspace está pronto. Agora vamos conectar o seu WhatsApp e configurar a sua equipe para começar os atendimentos.
              </p>
              <button
                onClick={() => setStep(2)}
                className="bg-fluvius-gradient text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 mx-auto hover:opacity-95 transition-all active:scale-95 shadow-lg shadow-blue-500/20"
              >
                Começar Configuração
                <ArrowRight size={20} />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white p-10 rounded-[32px] border border-fluvius-border shadow-xl text-center"
            >
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Wifi size={32} />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Conectar WhatsApp</h1>
              <p className="text-slate-500 mb-8">Escore o QR Code para ativar o atendimento multicanal.</p>

              {!connection ? (
                <button
                  onClick={handleCreateConnection}
                  disabled={creatingConn}
                  className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 mx-auto hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  {creatingConn ? <Loader2 className="animate-spin" size={20} /> : <QrCode size={20} />}
                  Gerar QR Code
                </button>
              ) : (
                <div className="space-y-6">
                  <div className="w-64 h-64 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto border-2 border-dashed border-slate-200 overflow-hidden p-2 relative">
                    {qrLoading ? (
                      <Loader2 className="animate-spin text-fluvius-blue-main" size={40} />
                    ) : qrCode ? (
                      <img src={qrCode} alt="WhatsApp QR" className="w-full h-full object-contain rounded-2xl" />
                    ) : (
                      <span className="text-sm text-slate-400">Falha ao carregar QR</span>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 w-fit mx-auto px-4 py-2 rounded-full text-sm font-bold border border-emerald-100">
                    <Loader2 size={16} className="animate-spin" />
                    Aguardando leitura do QR Code...
                  </div>
                </div>
              )}
              
              <button 
                onClick={() => setStep(3)}
                className="mt-8 text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors"
              >
                Pular esta etapa por enquanto
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white p-10 rounded-[32px] border border-fluvius-border shadow-xl"
            >
              <div className="w-16 h-16 bg-blue-50 text-fluvius-blue-main rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Users size={32} />
              </div>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Sua Equipe</h1>
                <p className="text-slate-500">Crie o seu primeiro agente operador.</p>
              </div>

              {agentCreated ? (
                <div className="text-center py-10">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                    <CheckCircle2 size={40} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Agente Criado!</h2>
                  <p className="text-slate-500">Redirecionando para o seu Inbox...</p>
                </div>
              ) : (
                <form onSubmit={handleCreateAgent} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Nome do Agente</label>
                      <input
                        required
                        value={agentName}
                        onChange={e => setAgentName(e.target.value)}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                        placeholder="Ex: Maria Atendimento"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">E-mail</label>
                      <input
                        required
                        type="email"
                        value={agentEmail}
                        onChange={e => setAgentEmail(e.target.value)}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                        placeholder="maria@suaempresa.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Senha</label>
                      <input
                        required
                        type="password"
                        value={agentPassword}
                        onChange={e => setAgentPassword(e.target.value)}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={creatingAgent}
                    className="w-full bg-fluvius-gradient text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-500/20 hover:opacity-95 transition-all mt-6 disabled:opacity-50"
                  >
                    {creatingAgent ? <Loader2 className="animate-spin mx-auto" /> : 'Finalizar e Ir para o Inbox'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => navigate('/')}
                    className="w-full text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors pt-2"
                  >
                    Pular por agora
                  </button>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Brand Footer */}
        <div className="mt-12 flex items-center justify-center gap-3 opacity-30 grayscale pointer-events-none">
          <img src="/logo.png" alt="Logo" className="h-6" />
          <span className="text-xs font-bold tracking-widest uppercase">Fluvius SaaS Platform</span>
        </div>
      </div>
    </div>
  );
};
