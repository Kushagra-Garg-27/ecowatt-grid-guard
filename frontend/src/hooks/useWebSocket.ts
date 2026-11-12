import { useEffect, useRef, useState } from 'react';

export function useWebSocket(onMessage: (data: any) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let unmounted = false;

    function connect() {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = window.location.port === '5173'
        ? `${protocol}//${window.location.hostname}:8000/ws/live`
        : `${protocol}//${window.location.host}/ws/live`;
      const ws = new WebSocket(wsUrl);
      let heartbeatTimer: number | null = null;

      ws.onopen = () => {
        setIsConnected(true);
        try { ws.send('ping'); } catch (e) {}
        heartbeatTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try { ws.send('ping'); } catch (e) {}
          }
        }, 10000);
      };

      ws.onmessage = (event) => {
        try {
          if (event.data === 'pong') return;
          const parsed = JSON.parse(event.data);
          onMessage(parsed);
        } catch (e) {
          // ignore non-json
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (!unmounted) {
          reconnectTimeoutRef.current = window.setTimeout(connect, 2500);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    }

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [onMessage]);

  return { isConnected };
}

