import { useEffect, useRef, useCallback } from 'react';

export interface CreateWsEvent {
  type: 'create:status' | 'create:progress';
  payload: {
    createId: string;
    status?: string;
    output?: Record<string, unknown>;
    errorMessage?: string;
    progress?: number;
    message?: string;
  };
}

interface UseCreateWebSocketOptions {
  userId: string | undefined;
  onEvent: (event: CreateWsEvent) => void;
  enabled?: boolean;
}

/**
 * WebSocket hook for real-time Create status updates.
 *
 * Connects to /ws/tasks, authenticates with userId, and forwards
 * create:* events to the provided callback.
 *
 * Features:
 * - Auto-reconnect with exponential backoff (1s → 2s → 4s, max 30s)
 * - Reconnect resets on manual page focus (catches up missed events)
 * - Cleanup on unmount
 */
export function useCreateWebSocket({ userId, onEvent, enabled = true }: UseCreateWebSocketOptions): void {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1000);
  const onEventRef = useRef(onEvent);

  // Keep callback ref fresh without triggering reconnect
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!userId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/tasks`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectDelayRef.current = 1000; // Reset backoff on success
      ws.send(JSON.stringify({ type: 'auth', payload: { userId } }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (typeof msg.type === 'string' && msg.type.startsWith('create:')) {
          onEventRef.current(msg as CreateWsEvent);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      // Schedule reconnect with exponential backoff
      const delay = Math.min(reconnectDelayRef.current, 30000);
      reconnectTimerRef.current = setTimeout(() => {
        reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000);
        connect();
      }, delay);
    };

    ws.onerror = () => {
      // onclose will handle reconnect
    };
  }, [userId]);

  useEffect(() => {
    if (!enabled || !userId) return;

    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on manual close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, enabled, userId]);
}
