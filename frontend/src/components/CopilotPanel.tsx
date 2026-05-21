/**
 * CopilotPanel — Painel do Bot Observador
 *
 * Drawer lateral que exibe em tempo real todos os alertas do copiloto de IA.
 * Cada alerta mostra: sentimento, intenção, urgência, sugestão de intervenção
 * e um botão para assumir a conversa diretamente.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, ChevronRight, Clock, AlertTriangle, Zap, Info, MessageSquare, ArrowRight } from 'lucide-react';

export type CopilotAlert = {
  conversation_id: string;
  contact_name: string;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'URGENT';
  intent: string | null;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  trigger: string;
  minutes_waiting: number;
  suggestion: string;
  assignee_id: string | null;
  timestamp: number; // Date.now()
};

interface CopilotPanelProps {
  alerts: CopilotAlert[];
  onSelectConversation: (id: string) => void;
  onDismissAlert: (conversationId: string) => void;
  onClearAll: () => void;
  variant?: 'default' | 'compact';
}

const urgencyConfig = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    badge: 'bg-red-100 text-red-700',
    icon: <AlertTriangle size={14} className="text-red-600" />,
    label: 'Crítico',
    dot: 'bg-red-500',
  },
  high: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
    icon: <Zap size={14} className="text-orange-500" />,
    label: 'Alto',
    dot: 'bg-orange-500',
  },
  medium: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    icon: <Clock size={14} className="text-amber-500" />,
    label: 'Médio',
    dot: 'bg-amber-400',
  },
  low: {
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    badge: 'bg-blue-100 text-blue-600',
    icon: <Info size={14} className="text-blue-400" />,
    label: 'Baixo',
    dot: 'bg-blue-400',
  },
};

const sentimentEmoji: Record<string, string> = {
  POSITIVE: '😊',
  NEUTRAL: '😐',
  NEGATIVE: '😠',
  URGENT: '🚨',
};

const intentLabel: Record<string, string> = {
  complaint: 'Reclamação',
  cancellation: 'Cancelamento',
  purchase_intent: 'Intenção de compra',
  urgent_support: 'Suporte urgente',
  escalation_request: 'Pedido de escalonamento',
};

function timeAgo(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  return `${Math.floor(diff / 3600)}h atrás`;
}

const AlertCard: React.FC<{
  alert: CopilotAlert;
  onSelect: () => void;
  onDismiss: () => void;
}> = ({ alert, onSelect, onDismiss }) => {
  const cfg = urgencyConfig[alert.urgency];
  const [expanded, setExpanded] = useState(alert.urgency === 'critical');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
      className={`rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden mb-2 shadow-sm`}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Urgency dot */}
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot} ${alert.urgency === 'critical' ? 'animate-pulse' : ''}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-slate-800 truncate">{alert.contact_name}</span>
            <span className="text-[10px]">{sentimentEmoji[alert.sentiment]}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex items-center gap-1 ${cfg.badge}`}>
              {cfg.icon}
              {cfg.label}
            </span>
            {alert.intent && (
              <span className="text-[9px] text-slate-500 font-medium">
                {intentLabel[alert.intent] ?? alert.intent}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[9px] text-slate-400">{timeAgo(alert.timestamp)}</span>
          <button
            onClick={e => { e.stopPropagation(); onDismiss(); }}
            className="p-1 text-slate-300 hover:text-slate-500 transition-colors rounded"
          >
            <X size={12} />
          </button>
          <ChevronRight
            size={14}
            className={`text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          />
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              {/* Suggestion */}
              <p className="text-[11px] text-slate-700 leading-relaxed bg-white/70 rounded-lg p-2 border border-slate-100">
                {alert.suggestion}
              </p>

              {/* Meta info */}
              {alert.minutes_waiting > 1 && (
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Clock size={10} />
                  <span>Aguardando há <strong>{alert.minutes_waiting.toFixed(0)} min</strong></span>
                </div>
              )}

              {/* Actions */}
              <button
                onClick={onSelect}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition-colors"
              >
                <MessageSquare size={12} />
                Abrir conversa
                <ArrowRight size={11} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const CopilotPanel: React.FC<CopilotPanelProps> = ({
  alerts,
  onSelectConversation,
  onDismissAlert,
  onClearAll,
  variant = 'default',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const criticalCount = alerts.filter(a => a.urgency === 'critical').length;
  const highCount = alerts.filter(a => a.urgency === 'high').length;
  const totalAlerts = alerts.length;

  // Sort: critical first, then high, then by timestamp desc
  const sortedAlerts = [...alerts].sort((a, b) => {
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const uDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (uDiff !== 0) return uDiff;
    return b.timestamp - a.timestamp;
  });

  const renderButton = () => {
    if (variant === 'compact') {
      return (
        <button
          onClick={() => setIsOpen(o => !o)}
          className={`relative p-1.5 rounded transition-all flex items-center justify-center group
            ${totalAlerts > 0
              ? 'text-[#6366f1] bg-[#6366f1]/10 border border-[#6366f1]/20 hover:bg-[#6366f1]/20'
              : 'text-slate-400 hover:text-[#6366f1] hover:bg-slate-50'
            }`}
          title="Copiloto de IA"
        >
          <Bot size={15} className={totalAlerts > 0 ? 'animate-pulse' : ''} />
          {totalAlerts > 0 && (
            <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${criticalCount > 0 ? 'bg-rose-500 animate-ping' : 'bg-amber-500'}`} />
          )}
          {/* Tooltip para a sidebar */}
          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-[11px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
            Copiloto ({totalAlerts} alerta{totalAlerts !== 1 ? 's' : ''})
          </div>
        </button>
      );
    }

    return (
      <button
        onClick={() => setIsOpen(o => !o)}
        className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border
          ${totalAlerts > 0
            ? 'bg-indigo-600 text-white border-indigo-700 shadow-md hover:bg-indigo-700'
            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        title="Painel do Copiloto"
      >
        <Bot size={14} />
        <span className="hidden sm:inline">Copiloto</span>
        {totalAlerts > 0 && (
          <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black
            ${criticalCount > 0 ? 'bg-red-400 animate-pulse' : 'bg-amber-400'}
            text-white`}
          >
            {totalAlerts}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {renderButton()}

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed top-14 right-4 w-80 max-h-[calc(100vh-80px)] z-50 flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            >
              {/* Panel Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50">
                <div className="flex items-center gap-2">
                  <Bot size={16} className="text-indigo-600" />
                  <span className="text-[13px] font-bold text-slate-800">Bot Copiloto</span>
                  {totalAlerts > 0 && (
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-full">
                      {totalAlerts} alerta{totalAlerts !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {totalAlerts > 0 && (
                    <button
                      onClick={onClearAll}
                      className="text-[10px] text-slate-400 hover:text-rose-500 font-medium px-2 py-1 rounded transition-colors"
                    >
                      Limpar tudo
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 transition-colors rounded"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Alerts list */}
              <div className="flex-1 overflow-y-auto p-3">
                {sortedAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3">
                      <Bot size={24} className="text-green-400" />
                    </div>
                    <p className="text-[12px] font-semibold text-slate-500">Tudo tranquilo!</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      O copiloto está monitorando todas as conversas.
                    </p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {sortedAlerts.map(alert => (
                      <AlertCard
                        key={alert.conversation_id}
                        alert={alert}
                        onSelect={() => {
                          onSelectConversation(alert.conversation_id);
                          setIsOpen(false);
                        }}
                        onDismiss={() => onDismissAlert(alert.conversation_id)}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
                <p className="text-[9px] text-slate-400 text-center">
                  Monitorando todas as conversas em tempo real · Gemini AI
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
