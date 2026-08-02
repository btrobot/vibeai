import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WsService } from './ws.service';
import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';

// ── Mock ws module ──

vi.mock('ws', () => {
  const MockWebSocketServer = vi.fn().mockImplementation(() => {
    const instance: any = {
      clients: new Set(),
      on: vi.fn((event: string, handler: any) => {
        if (event === 'connection') {
          instance._connectionHandler = handler;
        }
      }),
      _connectionHandler: null,
      close: vi.fn(),
    };
    return instance;
  });

  const MockWebSocket = vi.fn().mockImplementation(() => {
    const instance: any = {
      readyState: 1,
      send: vi.fn(),
      ping: vi.fn(),
      on: vi.fn((event: string, handler: any) => {
        instance._handlers ??= {};
        instance._handlers[event] = handler;
      }),
      close: vi.fn(),
      _handlers: {},
    };
    return instance;
  });

  MockWebSocket.OPEN = 1;
  MockWebSocket.CONNECTING = 0;
  MockWebSocket.CLOSING = 2;
  MockWebSocket.CLOSED = 3;

  return {
    WebSocket: MockWebSocket,
    WebSocketServer: MockWebSocketServer,
  };
});

describe('WsService', () => {
  let service: WsService;
  let mockWss: any;

  function createMockWs(overrides?: any) {
    const ws = new (WebSocket as any)();
    ws.readyState = overrides?.readyState ?? 1;
    ws.send = vi.fn();
    ws.ping = vi.fn();
    ws.on = vi.fn((event: string, handler: any) => {
      ws._handlers ??= {};
      ws._handlers[event] = handler;
    });
    ws.close = vi.fn();
    ws._handlers = {};
    return ws;
  }

  function simulateConnection(ws: any) {
    mockWss?._connectionHandler?.(ws, { socket: { remoteAddress: '127.0.0.1' } });
  }

  function simulateMessage(ws: any, data: string) {
    ws._handlers?.['message']?.({ toString: () => data });
  }

  function simulateClose(ws: any) {
    ws._handlers?.['close']?.();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WsService();
    service.initialize({} as Server);
    mockWss = (WebSocketServer as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('initialize', () => {
    it('should create WebSocketServer with correct path', () => {
      expect(WebSocketServer).toHaveBeenCalledWith({
        server: {} as Server,
        path: '/ws/tasks',
      });
    });

    it('should register connection handler', () => {
      expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('sendToUser', () => {
    it('should send message to all connections of a user', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      const wsOther = createMockWs();

      simulateConnection(ws1);
      simulateConnection(ws2);
      simulateConnection(wsOther);

      simulateMessage(ws1, JSON.stringify({ type: 'auth', payload: { userId: 'user-1' } }));
      simulateMessage(ws2, JSON.stringify({ type: 'auth', payload: { userId: 'user-1' } }));
      simulateMessage(wsOther, JSON.stringify({ type: 'auth', payload: { userId: 'user-2' } }));

      // Reset send calls to ignore auth:ok responses
      ws1.send.mockClear();
      ws2.send.mockClear();
      wsOther.send.mockClear();

      service.sendToUser('user-1', { type: 'task:progress', payload: { progress: 50 } });

      expect(ws1.send).toHaveBeenCalledWith(expect.stringContaining('task:progress'));
      expect(ws2.send).toHaveBeenCalledWith(expect.stringContaining('task:progress'));
      expect(wsOther.send).not.toHaveBeenCalled();
    });

    it('should not send to closed connections', () => {
      const ws = createMockWs({ readyState: 3 });
      simulateConnection(ws);
      simulateMessage(ws, JSON.stringify({ type: 'auth', payload: { userId: 'user-1' } }));

      ws.send.mockClear();

      service.sendToUser('user-1', { type: 'task:progress', payload: { progress: 50 } });

      expect(ws.send).not.toHaveBeenCalled();
    });

    it('should do nothing if user has no connections', () => {
      expect(() => {
        service.sendToUser('nonexistent', { type: 'test', payload: null });
      }).not.toThrow();
    });
  });

  describe('broadcast', () => {
    it('should send message to all connected clients', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();

      mockWss.clients.add(ws1);
      mockWss.clients.add(ws2);

      service.broadcast({ type: 'system:notice', payload: { message: '维护通知' } });

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });

    it('should skip closed clients', () => {
      const wsOpen = createMockWs();
      const wsClosed = createMockWs({ readyState: 3 });

      mockWss.clients.add(wsOpen);
      mockWss.clients.add(wsClosed);

      service.broadcast({ type: 'system:notice', payload: { message: 'test' } });

      expect(wsOpen.send).toHaveBeenCalled();
      expect(wsClosed.send).not.toHaveBeenCalled();
    });
  });

  describe('handleMessage', () => {
    it('should handle ping message', () => {
      const ws = createMockWs();
      simulateConnection(ws);

      simulateMessage(ws, JSON.stringify({ type: 'ping', payload: null }));

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'pong', payload: null }),
      );
    });

    it('should handle invalid message format', () => {
      const ws = createMockWs();
      simulateConnection(ws);

      simulateMessage(ws, 'invalid json');

      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('Invalid message format'),
      );
    });

    it('should handle auth message', () => {
      const ws = createMockWs();
      simulateConnection(ws);

      simulateMessage(ws, JSON.stringify({ type: 'auth', payload: { userId: 'user-1' } }));

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'auth:ok', payload: { userId: 'user-1' } }),
      );
    });

    it('should handle client disconnect', () => {
      const ws = createMockWs();
      simulateConnection(ws);

      simulateMessage(ws, JSON.stringify({ type: 'auth', payload: { userId: 'user-1' } }));
      expect(ws.send).toHaveBeenCalledTimes(1);

      simulateClose(ws);

      service.sendToUser('user-1', { type: 'test', payload: null });
      expect(ws.send).toHaveBeenCalledTimes(1);
    });

    it('should handle heartbeat interval', () => {
      vi.useFakeTimers();
      const ws = createMockWs();
      simulateConnection(ws);

      vi.advanceTimersByTime(30000);

      expect(ws.ping).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle error event without crashing', () => {
      const ws = createMockWs();
      simulateConnection(ws);

      ws._handlers?.['error']?.({ message: 'test error' });

      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should close the WebSocket server', () => {
      service.onModuleDestroy();
      expect(mockWss.close).toHaveBeenCalled();
    });
  });
});