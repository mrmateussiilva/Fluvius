/**
 * useWebSocket — Hook robusto de WebSocket com reconexão resiliente
 *
 * Melhorias em relação à versão anterior:
 *  1. Backoff exponencial com jitter: 1s → 2s → 4s → 8s → 16s → 30s (cap)
 *     Evita "thundering herd" quando o servidor volta após uma queda.
 *  2. Heartbeat / ping-pong a cada 25s:
 *     Detecta conexões TCP "zumbi" (encerradas por firewall/NAT sem evento close).
 *  3. Detecção de visibilitychange:
 *     Quando o agente volta para a aba, verifica se o WS ainda está vivo.
 *  4. Limite de tentativas de reconexão (20) para não lopar eternamente
 *     em caso de token inválido ou erro permanente.
 *  5. Indicador de estado exportado: 'connecting' | 'open' | 'closed' | 'reconnecting'
 */

import { useEffect, useRef, useCallback, useState } from 'react';

export type WSEvent = {
  type:
    | 'NEW_MESSAGE'
    | 'CONVERSATION_UPDATED'
    | 'MESSAGE_STATUS_UPDATED'
    | 'CONNECTION_STATUS_UPDATED'
    | 'NEW_CONVERSATION'
    | 'COPILOT_ALERT';
  data: any;
  workspace_id?: string;
};

export type WSStatus = 'connecting' | 'open' | 'closed' | 'reconnecting';

const HEARTBEAT_INTERVAL_MS = 25_000; // 25 segundos
const MAX_RECONNECT_ATTEMPTS = 20;
const BASE_RECONNECT_DELAY_MS = 1_000; // 1 segundo
const MAX_RECONNECT_DELAY_MS = 30_000; // 30 segundos cap

/** Calcula o delay com jitter para evitar thundering herd */
function calcReconnectDelay(attempt: number): number {
  const exponential = Math.min(
    BASE_RECONNECT_DELAY_MS * 2 ** attempt,
    MAX_RECONNECT_DELAY_MS,
  );
  // Adiciona até 20% de jitter aleatório
  const jitter = exponential * 0.2 * Math.random();
  return Math.floor(exponential + jitter);
}

export const useWebSocket = (
  token: string | null,
  onEvent: (event: WSEvent) => void,
): WSStatus => {
  const socketRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  const tokenRef = useRef<string | null>(token);

  // Controle de reconexão
  const shouldReconnectRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Heartbeat
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPongRef = useRef<number>(Date.now());

  const [wsStatus, setWsStatus] = useState<WSStatus>('closed');

  // Mantém refs atualizadas sem re-criar connect
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
  useEffect(() => { tokenRef.current = token; }, [token]);

  // --- Helpers ---

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback((ws: WebSocket) => {
    stopHeartbeat();
    lastPongRef.current = Date.now();

    heartbeatTimerRef.current = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        stopHeartbeat();
        return;
      }

      // Verifica se o último pong foi recebido dentro do intervalo esperado
      const timeSinceLastPong = Date.now() - lastPongRef.current;
      if (timeSinceLastPong > HEARTBEAT_INTERVAL_MS * 2) {
        console.warn('[WS] Heartbeat timeout — conexão zumbi detectada. Fechando.');
        stopHeartbeat();
        ws.close(1001, 'Heartbeat timeout');
        return;
      }

      try {
        ws.send(JSON.stringify({ type: 'PING' }));
      } catch {
        // Ignora erro de envio — o onclose vai tratar
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, [stopHeartbeat]);

  // --- Conexão principal ---

  const connect = useCallback(() => {
    const currentToken = tokenRef.current;
    if (!currentToken || !shouldReconnectRef.current) return;

    // Não abre outra conexão se já estiver connecting/open
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.CONNECTING ||
        socketRef.current.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    clearReconnectTimer();

    const configuredWsUrl = import.meta.env.VITE_WS_URL;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const defaultWsHost = window.location.host.includes('localhost')
      ? 'localhost:8000'
      : window.location.host;
    const wsUrl = new URL(configuredWsUrl || `${protocol}//${defaultWsHost}/ws`);
    wsUrl.searchParams.set('token', currentToken);

    const attemptNum = reconnectAttemptRef.current;
    if (attemptNum === 0) {
      console.log(`[WS] Conectando: ${wsUrl.origin}${wsUrl.pathname}`);
      setWsStatus('connecting');
    } else {
      console.log(`[WS] Reconectando (tentativa ${attemptNum}/${MAX_RECONNECT_ATTEMPTS})...`);
      setWsStatus('reconnecting');
    }

    const ws = new WebSocket(wsUrl.toString());
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Conectado ✅');
      reconnectAttemptRef.current = 0; // Reset backoff
      setWsStatus('open');
      startHeartbeat(ws);
    };

    ws.onmessage = (event) => {
      // Resposta ao PING (pong do backend ou qualquer mensagem indica que está vivo)
      lastPongRef.current = Date.now();

      try {
        const payload: WSEvent = JSON.parse(event.data);
        // Filtra pongs e mensagens internas
        if ((payload as any).type === 'PONG') return;
        onEventRef.current(payload);
      } catch {
        // Ignora dados não-JSON (ex: pong em texto puro)
      }
    };

    ws.onclose = (event) => {
      stopHeartbeat();

      if (socketRef.current === ws) {
        socketRef.current = null;
      }

      // Falha de autenticação — não retentar
      if (event.code === 1008) {
        console.error('[WS] Autenticação falhou — sem reconexão.');
        setWsStatus('closed');
        shouldReconnectRef.current = false;
        return;
      }

      // Fechamento intencional (logout/unmount)
      if (!shouldReconnectRef.current) {
        console.log('[WS] Conexão encerrada intencionalmente.');
        setWsStatus('closed');
        return;
      }

      // Limite de tentativas atingido
      if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.error(`[WS] Limite de ${MAX_RECONNECT_ATTEMPTS} tentativas atingido. Desistindo.`);
        setWsStatus('closed');
        shouldReconnectRef.current = false;
        return;
      }

      reconnectAttemptRef.current += 1;
      const delay = calcReconnectDelay(reconnectAttemptRef.current - 1);
      console.log(`[WS] Desconectado (code=${event.code}). Reconectando em ${delay}ms...`);
      setWsStatus('reconnecting');

      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    };

    ws.onerror = () => {
      // O onclose vai tratar — evita logar o mesmo erro duas vezes
      ws.close();
    };
  }, [clearReconnectTimer, startHeartbeat, stopHeartbeat]);

  // --- Efeito principal: abre/fecha conexão quando token muda ---

  useEffect(() => {
    if (!token) {
      // Usuário deslogou — encerra tudo
      shouldReconnectRef.current = false;
      clearReconnectTimer();
      stopHeartbeat();
      if (socketRef.current) {
        const ws = socketRef.current;
        socketRef.current = null;
        ws.close(1000, 'Logout');
      }
      reconnectAttemptRef.current = 0;
      setWsStatus('closed');
      return;
    }

    shouldReconnectRef.current = true;
    reconnectAttemptRef.current = 0;

    // Pequeno delay para evitar conexão dupla durante re-render
    const initTimer = setTimeout(() => connect(), 100);

    return () => {
      clearTimeout(initTimer);
      shouldReconnectRef.current = false;
      clearReconnectTimer();
      stopHeartbeat();
      if (socketRef.current) {
        const ws = socketRef.current;
        socketRef.current = null;
        ws.close(1000, 'Cleanup');
      }
    };
  }, [token, connect, clearReconnectTimer, stopHeartbeat]);

  // --- Detecta quando o usuário volta para a aba ---

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (!shouldReconnectRef.current) return;

      const ws = socketRef.current;
      const isAlive =
        ws &&
        (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING);

      if (!isAlive) {
        console.log('[WS] Aba voltou ao foco — verificando conexão...');
        reconnectAttemptRef.current = 0; // Reset para reconectar rápido
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [connect]);

  return wsStatus;
};
