import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Loader2, Building2, User, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';

export const SignupPage: React.FC = () => {
  const [companyName, setCompanyName] = useState('');
  const [agentName, setAgentName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: companyName, agent_name: agentName, email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Erro ao realizar o cadastro');
      }

      const data = await response.json();
      login(data.access_token, data.agent);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 relative overflow-x-hidden overflow-y-auto font-sans pt-12 pb-12 sm:pt-20 px-4 sm:px-8">
      {/* Background Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-fluvius-blue-main/20 blur-[120px] rounded-full pointer-events-none animate-pulse" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-fluvius-green-water/10 blur-[120px] rounded-full pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto relative z-10"
      >
        <div className="text-center mb-8 flex flex-col items-center">
          <img src="/logo.png" alt="Fluvius Logo" className="h-20 mb-4 object-contain drop-shadow-sm brightness-0 invert" />
          <h1 className="text-3xl font-bold text-white tracking-tight">Criar Conta</h1>
          <p className="text-blue-200 mt-2 font-medium">Comece a usar o Fluvius hoje mesmo</p>
        </div>

        <div className="bg-white/95 backdrop-blur-xl border border-white/20 p-8 rounded-[24px] shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-fluvius-text-sec mb-1.5 ml-1">Nome da Empresa</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-fluvius-text-sec" size={18} />
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-white border border-fluvius-border rounded-[12px] py-3 pl-10 pr-4 text-fluvius-text-main placeholder-fluvius-border outline-none focus:border-fluvius-blue-main focus:ring-4 focus:ring-fluvius-blue-main/10 transition-all shadow-sm"
                  placeholder="Acme Corp"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-fluvius-text-sec mb-1.5 ml-1">Seu Nome</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-fluvius-text-sec" size={18} />
                <input
                  type="text"
                  required
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="w-full bg-white border border-fluvius-border rounded-[12px] py-3 pl-10 pr-4 text-fluvius-text-main placeholder-fluvius-border outline-none focus:border-fluvius-blue-main focus:ring-4 focus:ring-fluvius-blue-main/10 transition-all shadow-sm"
                  placeholder="João Silva"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-fluvius-text-sec mb-1.5 ml-1">E-mail corporativo</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-fluvius-text-sec" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-fluvius-border rounded-[12px] py-3 pl-10 pr-4 text-fluvius-text-main placeholder-fluvius-border outline-none focus:border-fluvius-blue-main focus:ring-4 focus:ring-fluvius-blue-main/10 transition-all shadow-sm"
                  placeholder="exemplo@acme.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-fluvius-text-sec mb-1.5 ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-fluvius-text-sec" size={18} />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-fluvius-border rounded-[12px] py-3 pl-10 pr-4 text-fluvius-text-main placeholder-fluvius-border outline-none focus:border-fluvius-blue-main focus:ring-4 focus:ring-fluvius-blue-main/10 transition-all shadow-sm"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-rose-50 border border-rose-100 text-rose-600 text-sm p-3 rounded-lg text-center font-medium"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-fluvius-gradient hover:opacity-95 text-white font-semibold py-3.5 rounded-[12px] shadow-lg shadow-fluvius-blue-main/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 mt-4"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  Criar minha conta
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-fluvius-text-sec">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-fluvius-blue-main font-medium hover:text-fluvius-blue-deep hover:underline">
                Faça login
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
