import { useEffect, useRef, useCallback } from 'react';

export type WSEvent = {
  type: 'NEW_MESSAGE' | 'CONVERSATION_UPDATED' | 'MESSAGE_STATUS_UPDATED' | 'CONNECTION_STATUS_UPDATED';
  data: any;
  workspace_id?: string;
};

export const useWebSocket = (token: string | null, onEvent: (event: WSEvent) => void) => {
  const socketRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  const connectTimeoutRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(false);
  const tokenRef = useRef<string | null>(token);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    const currentToken = tokenRef.current;
    if (!currentToken) return;

    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.CONNECTING ||
        socketRef.current.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    const configuredWsUrl = import.meta.env.VITE_WS_URL;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const defaultWsHost = window.location.host.includes('localhost') ? 'localhost:8000' : window.location.host;
    const wsUrl = new URL(configuredWsUrl || `${protocol}//${defaultWsHost}/ws`);
    wsUrl.searchParams.set('token', currentToken);

    console.log(`Connecting to WebSocket: ${wsUrl.origin}${wsUrl.pathname}`);
    const ws = new WebSocket(wsUrl.toString());
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const payload: WSEvent = JSON.parse(event.data);
        if (onEventRef.current) {
          onEventRef.current(payload);
        }
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    };

    ws.onclose = (event) => {
      if (event.code === 1008) {
        if (socketRef.current === ws) {
          socketRef.current = null;
        }
        console.error('WebSocket Authentication failed.');
        return;
      }
      // If the socket in the ref is not this socket, it means we intentionally
      // replaced it or unmounted, so don't reconnect.
      if (socketRef.current !== ws) {
        console.log('Old WebSocket intentionally closed.');
        return;
      }

      socketRef.current = null;
      if (!shouldReconnectRef.current) {
        console.log('WebSocket closed.');
        return;
      }
      
      console.log('WebSocket disconnected. Reconnecting in 3s...');
      reconnectTimeoutRef.current = window.setTimeout(() => {
        reconnectTimeoutRef.current = null;
        connect();
      }, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      ws.close();
    };
  }, []);

  useEffect(() => {
    shouldReconnectRef.current = Boolean(token);
    if (token) {
      connectTimeoutRef.current = window.setTimeout(() => {
        connectTimeoutRef.current = null;
        connect();
      }, 100);
    }
    return () => {
      shouldReconnectRef.current = false;
      if (connectTimeoutRef.current) {
        window.clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (socketRef.current) {
        const ws = socketRef.current;
        socketRef.current = null;
        ws.close();
      }
    };
  }, [connect, token]);

  return socketRef.current;
};
