/**
 * ReplicateAdapter 单元测试
 *
 * 覆盖范围：
 * - Mock 模式（REPLICATE_API_TOKEN 未设置）
 * - Mock 图片/视频/文本输出
 * - Mock 进度推送
 * - Real 模式（fetch mock）：create prediction / poll / extract output
 * - 错误处理：prediction failed / HTTP error / timeout
 * - output 映射：image / video / text
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReplicateAdapter } from './replicate.adapter';
import type { AdapterModel, ExecutionContext } from './protocol-adapter.interface';

// ===== Helper: Mock Model =====
function createMockModel(overrides: Partial<AdapterModel> = {}): AdapterModel {
  return {
    slug: 'sdxl',
    name: 'Stable Diffusion XL',
    sdkModelId: 'stability-ai/sdxl',
    modality: 'image',
    outputType: 'image',
    providerName: 'replicate',
    sdkClient: 'replicate',
    constraints: {},
    defaultParams: { maxWaitTime: 10 },
    costCredits: 5,
    sortOrder: 31,
    ...overrides,
  };
}

// ===== Helper: Mock Context =====
function createMockContext(): ExecutionContext & { progressCalls: Array<{ progress: number; message: string }> } {
  const progressCalls: Array<{ progress: number; message: string }> = [];
  return {
    taskId: 'task-test-1',
    userId: 'user-test-1',
    onProgress: (progress: number, message: string) => {
      progressCalls.push({ progress, message });
    },
    progressCalls,
  };
}

// ===== Mock Mode Tests (no REPLICATE_API_TOKEN) =====

describe('ReplicateAdapter - Mock 模式', () => {
  let adapter: ReplicateAdapter;
  let originalToken: string | undefined;

  beforeEach(() => {
    originalToken = process.env.REPLICATE_API_TOKEN;
    delete process.env.REPLICATE_API_TOKEN;
    adapter = new ReplicateAdapter();
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.REPLICATE_API_TOKEN = originalToken;
    } else {
      delete process.env.REPLICATE_API_TOKEN;
    }
  });

  it('无 API token 时应进入 Mock 模式', () => {
    expect((adapter as any).isMockMode).toBe(true);
  });

  it('Mock 图片生成应返回 picsum URL', async () => {
    const model = createMockModel();
    const context = createMockContext();

    const result = await adapter.execute({ prompt: 'a cat' }, model, context);

    expect(result.output.images).toBeDefined();
    expect(result.output.images).toHaveLength(1);
    expect(result.output.images[0].url).toContain('picsum.photos');
    expect(result.output.mock).toBe(true);
    expect(result.output.modelUsed).toBe('sdxl');
  });

  it('Mock 视频生成应返回 Big Buck Bunny URL', async () => {
    const model = createMockModel({ outputType: 'video' });
    const context = createMockContext();

    const result = await adapter.execute({ prompt: 'sunset' }, model, context);

    expect(result.output.video).toBeDefined();
    expect(result.output.video.url).toContain('BigBuckBunny');
    expect(result.output.mock).toBe(true);
  });

  it('Mock 文本生成应返回模拟文本', async () => {
    const model = createMockModel({ outputType: 'text' });
    const context = createMockContext();

    const result = await adapter.execute({ prompt: 'hello' }, model, context);

    expect(result.output.content).toBeDefined();
    expect(typeof result.output.content).toBe('string');
    expect(result.output.mock).toBe(true);
  });

  it('Mock 模式应推送进度', async () => {
    const model = createMockModel();
    const context = createMockContext();

    await adapter.execute({ prompt: 'test' }, model, context);

    expect(context.progressCalls.length).toBeGreaterThan(0);
    expect(context.progressCalls.some((c) => c.progress === 100)).toBe(true);
  });

  it('Mock 模式应返回 providerTaskId', async () => {
    const model = createMockModel();
    const context = createMockContext();

    const result = await adapter.execute({ prompt: 'test' }, model, context);

    expect(result.providerTaskId).toBeDefined();
    expect(result.providerTaskId).toContain('mock-replicate-');
  });
});

// ===== Real Mode Tests (fetch mock) =====

describe('ReplicateAdapter - Real 模式', () => {
  let adapter: ReplicateAdapter;
  let originalToken: string | undefined;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalToken = process.env.REPLICATE_API_TOKEN;
    originalFetch = global.fetch;
    process.env.REPLICATE_API_TOKEN = 'r8_test_token_123';
    process.env.REPLICATE_BASE_URL = 'https://api.replicate.com';
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.REPLICATE_API_TOKEN = originalToken;
    } else {
      delete process.env.REPLICATE_API_TOKEN;
    }
    global.fetch = originalFetch;
  });

  function mockFetch(responses: Array<{ status: number; body: unknown }>): void {
    let callIndex = 0;
    global.fetch = vi.fn(async () => {
      const resp = responses[callIndex] || responses[responses.length - 1];
      callIndex++;
      return {
        ok: resp.status >= 200 && resp.status < 300,
        status: resp.status,
        json: async () => resp.body,
        text: async () => JSON.stringify(resp.body),
      } as Response;
    }) as typeof global.fetch;
  }

  it('有 API token 时不应进入 Mock 模式', () => {
    adapter = new ReplicateAdapter();
    expect((adapter as any).isMockMode).toBe(false);
  });

  it('create prediction + poll succeeded → 图片 URL 输出', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel();
    const context = createMockContext();

    // First call: POST /v1/predictions → starting
    // Second call: GET /v1/predictions/{id} → succeeded
    mockFetch([
      {
        status: 201,
        body: { id: 'pred-123', status: 'starting', output: null, error: null, logs: null },
      },
      {
        status: 200,
        body: {
          id: 'pred-123',
          status: 'succeeded',
          output: 'https://replicate.delivery/output.jpg',
          error: null,
          logs: 'done',
        },
      },
    ]);

    const result = await adapter.execute({ prompt: 'a dog' }, model, context);

    expect(result.output.images).toBeDefined();
    expect(result.output.images[0].url).toBe('https://replicate.delivery/output.jpg');
    expect(result.output.modelUsed).toBe('sdxl');
    expect(result.output.providerName).toBe('replicate');
    expect(result.providerTaskId).toBe('pred-123');
  });

  it('output 为数组时应正确映射多张图片', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel();
    const context = createMockContext();

    mockFetch([
      { status: 201, body: { id: 'pred-456', status: 'starting', output: null, error: null, logs: null } },
      {
        status: 200,
        body: {
          id: 'pred-456',
          status: 'succeeded',
          output: ['https://replicate.delivery/img1.jpg', 'https://replicate.delivery/img2.jpg'],
          error: null,
          logs: null,
        },
      },
    ]);

    const result = await adapter.execute({ prompt: 'multiple' }, model, context);

    expect(result.output.images).toHaveLength(2);
    expect(result.output.images[0].url).toBe('https://replicate.delivery/img1.jpg');
    expect(result.output.images[1].url).toBe('https://replicate.delivery/img2.jpg');
  });

  it('prediction failed 时应抛出错误', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel();
    const context = createMockContext();

    mockFetch([
      { status: 201, body: { id: 'pred-fail', status: 'starting', output: null, error: null, logs: null } },
      {
        status: 200,
        body: {
          id: 'pred-fail',
          status: 'failed',
          output: null,
          error: 'CUDA out of memory',
          logs: 'error',
        },
      },
    ]);

    await expect(adapter.execute({ prompt: 'test' }, model, context)).rejects.toThrow(
      'Replicate 生成失败: CUDA out of memory',
    );
  });

  it('create prediction HTTP 错误时应抛出错误', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel();
    const context = createMockContext();

    mockFetch([
      { status: 401, body: { detail: 'Invalid token' } },
    ]);

    await expect(adapter.execute({ prompt: 'test' }, model, context)).rejects.toThrow(
      'Replicate 创建 prediction 失败 (HTTP 401)',
    );
  });

  it('video outputType 应映射为 video 对象', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel({ outputType: 'video' });
    const context = createMockContext();

    mockFetch([
      { status: 201, body: { id: 'pred-vid', status: 'starting', output: null, error: null, logs: null } },
      {
        status: 200,
        body: {
          id: 'pred-vid',
          status: 'succeeded',
          output: 'https://replicate.delivery/video.mp4',
          error: null,
          logs: null,
        },
      },
    ]);

    const result = await adapter.execute({ prompt: 'sunset' }, model, context);

    expect(result.output.video).toBeDefined();
    expect(result.output.video.url).toBe('https://replicate.delivery/video.mp4');
  });

  it('text outputType 应映射为 content 字符串', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel({ outputType: 'text' });
    const context = createMockContext();

    mockFetch([
      { status: 201, body: { id: 'pred-txt', status: 'starting', output: null, error: null, logs: null } },
      {
        status: 200,
        body: {
          id: 'pred-txt',
          status: 'succeeded',
          output: 'Generated text content',
          error: null,
          logs: null,
        },
      },
    ]);

    const result = await adapter.execute({ prompt: 'write' }, model, context);

    expect(result.output.content).toBe('Generated text content');
  });

  it('prediction canceled 时应抛出错误', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel();
    const context = createMockContext();

    mockFetch([
      { status: 201, body: { id: 'pred-cancel', status: 'starting', output: null, error: null, logs: null } },
      {
        status: 200,
        body: {
          id: 'pred-cancel',
          status: 'canceled',
          output: null,
          error: null,
          logs: null,
        },
      },
    ]);

    await expect(adapter.execute({ prompt: 'test' }, model, context)).rejects.toThrow(
      'Replicate prediction 已被取消',
    );
  });

  it('应将 provider config 合并到 predictionInput', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel({
      defaultParams: { maxWaitTime: 10, width: 1024 },
    });
    const context = createMockContext();

    let capturedBody: unknown = null;
    global.fetch = vi.fn(async (url: string, init: RequestInit) => {
      if (init.method === 'POST') {
        capturedBody = JSON.parse(init.body as string);
      }
      return {
        ok: true,
        status: 201,
        json: async () => ({ id: 'pred-cfg', status: 'starting', output: null, error: null, logs: null }),
        text: async () => '',
      } as Response;
    }) as typeof global.fetch;

    // Second call for polling - succeeded
    const realFetch = global.fetch;
    global.fetch = vi.fn(async (url: string, init: RequestInit) => {
      if (init?.method === 'POST') {
        capturedBody = JSON.parse(init.body as string);
        return {
          ok: true, status: 201,
          json: async () => ({ id: 'pred-cfg', status: 'starting', output: null, error: null, logs: null }),
          text: async () => '',
        } as Response;
      }
      return {
        ok: true, status: 200,
        json: async () => ({ id: 'pred-cfg', status: 'succeeded', output: 'https://x.com/img.jpg', error: null, logs: null }),
        text: async () => '',
      } as Response;
    }) as typeof global.fetch;

    await adapter.execute({ prompt: 'test', height: 768 }, model, context);

    // sdkModelId contains '/', so model endpoint is used (no version field in body)
    expect(capturedBody).toEqual(
      expect.objectContaining({
        input: expect.objectContaining({
          prompt: 'test',
          width: 1024,
          height: 768,
        }),
      }),
    );
    expect(capturedBody).not.toHaveProperty('version');
  });
});
