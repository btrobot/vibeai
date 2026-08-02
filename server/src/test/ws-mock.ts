import { vi } from 'vitest';
import type { WebSocket } from 'ws';

/**
 * WebSocket Mock 模板
 *
 * 用于测试 WebSocket 推送逻辑，验证消息发送和连接管理。
 *
 * 使用方式：
 *   const wsMock = createWebSocketMock();
 *   wsModule.sendToUser('user-1', { type: 'task_update', data: {} });
 *   expect(wsMock.send).toHaveBeenCalledWith(
 *     expect.stringContaining('task_update')
 *   );
 */

export function createWebSocketMock() {
  return {
    // WebSocket 实例方法
    send: vi.fn(),
    close: vi.fn(),
    terminate: vi.fn(),
    ping: vi.fn(),
    pong: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    on: vi.fn(),
    // 连接状态
    readyState: 1, // WebSocket.OPEN

    // 模拟事件触发
    emit: vi.fn(),
  } as unknown as WebSocket;
}

/**
 * 创建 WebSocket 服务 Mock
 *
 * 用于模拟 WsService，验证消息广播逻辑
 */
export function createWsServiceMock() {
  return {
    sendToUser: vi.fn(),
    sendToProject: vi.fn(),
    broadcast: vi.fn(),
    getConnections: vi.fn().mockReturnValue([]),
    getConnectionCount: vi.fn().mockReturnValue(0),
    isUserConnected: vi.fn().mockReturnValue(false),
    handleConnection: vi.fn(),
    handleDisconnection: vi.fn(),
  };
}

export type WsServiceMock = ReturnType<typeof createWsServiceMock>;

/**
 * 验证消息内容
 */
export function verifyWsMessage(
  wsMock: { send: ReturnType<typeof vi.fn> },
  expectedType: string,
  expectedData?: Record<string, unknown>,
) {
  const calls = wsMock.send.mock.calls;
  const match = calls.find((call: unknown[]) => {
    const [msg] = call as [string];
    try {
      const parsed = JSON.parse(msg);
      if (parsed.type !== expectedType) return false;
      if (expectedData) {
        return Object.entries(expectedData).every(
          ([key, val]) => parsed[key] === val,
        );
      }
      return true;
    } catch {
      return false;
    }
  });

  return match !== undefined;
}