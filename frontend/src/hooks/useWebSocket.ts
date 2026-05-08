import { useEffect, useRef, useCallback } from 'react';

export type WSEvent = {
  type: 'NEW_MESSAGE' | 'CONVERSATION_UPDATED' | 'MESSAGE_STATUS_UPDATED';
  data: any;
  workspace_id?: string;
};

export const useWebSocket = (token: string | null, onEvent: (event: WSEvent) => void) => {
  const socketRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = 'localhost:8000'; 
    const url = `${protocol}//${host}/ws?token=${token}`;

    console.log('Connecting to WebSocket...');
    const ws = new WebSocket(url);

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
        console.error('WebSocket Authentication failed.');
        return;
      }
      // If the socket in the ref is not this socket, it means we intentionally
      // replaced it or unmounted, so don't reconnect.
      if (socketRef.current !== ws) {
        console.log('Old WebSocket intentionally closed.');
        return;
      }
      
      console.log('WebSocket disconnected. Reconnecting in 3s...');
      setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      ws.close();
    };

    socketRef.current = ws;
  }, [token]);

  useEffect(() => {
    if (token) {
      connect();
    }
    return () => {
      if (socketRef.current) {
        const ws = socketRef.current;
        socketRef.current = null;
        ws.close();
      }
    };
  }, [connect, token]);

  return socketRef.current;
};
