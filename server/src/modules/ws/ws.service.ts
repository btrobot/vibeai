import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';

interface WsMessage<T = unknown> {
  type: string;
  payload: T;
}

@Injectable()
export class WsService implements OnModuleDestroy {
  private readonly logger = new Logger(WsService.name);
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, Set<WebSocket>>(); // userId -> ws connections

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws/tasks' });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.logger.log(`WebSocket client connected from ${req.socket.remoteAddress}`);

      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 30000);

      ws.on('message', (raw: Buffer) => {
        try {
          const msg: WsMessage = JSON.parse(raw.toString());
          this.handleMessage(ws, msg);
        } catch {
          ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message format' } }));
        }
      });

      ws.on('close', () => {
        clearInterval(heartbeat);
        this.removeClient(ws);
        this.logger.log('WebSocket client disconnected');
      });

      ws.on('error', (err) => {
        this.logger.error(`WebSocket error: ${err.message}`);
      });
    });

    this.logger.log('WebSocket server initialized on /ws/tasks');
  }

  private handleMessage(ws: WebSocket, msg: WsMessage): void {
    switch (msg.type) {
      case 'auth':
        // Authenticate with userId
        if (msg.payload && typeof msg.payload === 'object' && 'userId' in msg.payload) {
          const userId = String((msg.payload as { userId: string }).userId);
          this.registerClient(userId, ws);
          ws.send(JSON.stringify({ type: 'auth:ok', payload: { userId } }));
        }
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', payload: null }));
        break;
      default:
        break;
    }
  }

  private registerClient(userId: string, ws: WebSocket): void {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(ws);
  }

  private removeClient(ws: WebSocket): void {
    for (const [, connections] of this.clients) {
      connections.delete(ws);
    }
  }

  /** Send a message to a specific user (all their connections) */
  sendToUser(userId: string, message: WsMessage): void {
    const connections = this.clients.get(userId);
    if (!connections) return;
    const data = JSON.stringify(message);
    for (const ws of connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  /** Broadcast a message to all connected clients */
  broadcast(message: WsMessage): void {
    if (!this.wss) return;
    const data = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  onModuleDestroy(): void {
    this.wss?.close();
  }
}