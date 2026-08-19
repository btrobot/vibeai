/**
 * ReplicateAdapter 单元测试
 *
 * 覆盖范围：
 * - 未配置 REPLICATE_API_TOKEN 时渠道不完整 → 显式抛错（不 Mock）
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

// ===== 未配置 Token Tests (no REPLICATE_API_TOKEN → 显式抛错) =====

describe('ReplicateAdapter - 未配置 token', () => {
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

  it('无 API token 时标记为未配置', () => {
    expect((adapter as any).isConfigured).toBe(false);
  });

  it('未配置 token 时图片生成直接抛错（不再 Mock）', async () => {
    const model = createMockModel();
    const context = createMockContext();

    await expect(adapter.execute({ prompt: 'a cat' }, model, context)).rejects.toThrow(
      /Replicate 渠道配置不完整：未设置 REPLICATE_API_TOKEN/,
    );
  });

  it('未配置 token 时视频生成直接抛错（不再 Mock）', async () => {
    const model = createMockModel({ outputType: 'video' });
    const context = createMockContext();

    await expect(adapter.execute({ prompt: 'sunset' }, model, context)).rejects.toThrow(
      /Replicate 渠道配置不完整：未设置 REPLICATE_API_TOKEN/,
    );
  });

  it('未配置 token 时文本生成直接抛错（不再 Mock）', async () => {
    const model = createMockModel({ outputType: 'text' });
    const context = createMockContext();

    await expect(adapter.execute({ prompt: 'hello' }, model, context)).rejects.toThrow(
      /Replicate 渠道配置不完整：未设置 REPLICATE_API_TOKEN/,
    );
  });

  it('未配置 token 时不推送任何进度', async () => {
    const model = createMockModel();
    const context = createMockContext();

    await expect(adapter.execute({ prompt: 'test' }, model, context)).rejects.toThrow(
      /Replicate 渠道配置不完整/,
    );
    expect(context.progressCalls.length).toBe(0);
  });

  it('未配置 token 时不产生 providerTaskId', async () => {
    const model = createMockModel();
    const context = createMockContext();

    await expect(adapter.execute({ prompt: 'test' }, model, context)).rejects.toThrow(
      /Replicate 渠道配置不完整/,
    );
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

  it('有 API token 时进入真实模式（未配置标记为 false）', () => {
    adapter = new ReplicateAdapter();
    expect((adapter as any).isConfigured).toBe(true);
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

  it('rmbg-2-0 白底抠图：映射 image/background_color/width/height → model endpoint predictions', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel({
      slug: 'rmbg-2-0',
      name: 'Bria RMBG 2.0',
      sdkModelId: 'bria/remove-background',
    });
    const context = createMockContext();

    const requestBodies: Array<{ url: string; body?: Record<string, unknown> }> = [];
    let callIndex = 0;
    global.fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/predictions') && init?.method === 'POST') {
        requestBodies.push({ url: u, body: JSON.parse(String(init.body)) });
      }
      const responses = [
        { status: 201, body: { id: 'pred-rmbg', status: 'starting', output: null, error: null, logs: null } },
        {
          status: 200,
          body: {
            id: 'pred-rmbg',
            status: 'succeeded',
            output: 'https://replicate.delivery/whitebg.png',
            error: null,
            logs: null,
          },
        },
      ];
      const resp = responses[callIndex] || responses[responses.length - 1];
      callIndex++;
      return {
        ok: resp.status >= 200 && resp.status < 300,
        status: resp.status,
        json: async () => resp.body,
        text: async () => JSON.stringify(resp.body),
      } as Response;
    }) as typeof global.fetch;

    const result = await adapter.execute(
      {
        referenceImages: ['https://cdn.example.com/product.png'],
        backgroundColor: '#000000',
        width: 1024,
        height: 1024,
      },
      model,
      context,
    );

    // 走 model endpoint（owner/model 形式，非 version hash）
    expect(requestBodies[0].url).toBe('https://api.replicate.com/v1/models/bria/remove-background/predictions');
    expect(requestBodies[0].body).toEqual({
      input: { image: 'https://cdn.example.com/product.png', background_color: '#000000', width: 1024, height: 1024 },
    });
    expect(result.output.images[0].url).toBe('https://replicate.delivery/whitebg.png');
  });

  it('rmbg-2-0 缺商品图时显性报错（不静默走文生图）', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel({
      slug: 'rmbg-2-0',
      sdkModelId: 'bria/remove-background',
    });
    await expect(adapter.execute({ prompt: '随便画' }, model, createMockContext())).rejects.toThrow(
      /rmbg-2-0 需要商品图/,
    );
  });

  it('rmbg-2-0 backgroundColor 非法值显性报错', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel({
      slug: 'rmbg-2-0',
      sdkModelId: 'bria/remove-background',
    });
    await expect(
      adapter.execute(
        { referenceImages: ['https://cdn.example.com/product.png'], backgroundColor: 'rainbow' },
        model,
        createMockContext(),
      ),
    ).rejects.toThrow(/rmbg-2-0 background invalid: rainbow/);
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

  it('create prediction HTTP 401 时应提示 Token 无效', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel();
    const context = createMockContext();

    mockFetch([
      { status: 401, body: { detail: 'Invalid token' } },
    ]);

    await expect(adapter.execute({ prompt: 'test' }, model, context)).rejects.toThrow(
      'Replicate API Token 无效或已过期，请检查 REPLICATE_API_TOKEN 配置',
    );
  });

  it('create prediction HTTP 402 时应提示余额不足', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel();
    const context = createMockContext();

    mockFetch([
      { status: 402, body: { detail: 'Payment required' } },
    ]);

    await expect(adapter.execute({ prompt: 'test' }, model, context)).rejects.toThrow(
      'Replicate 账户余额不足，请到 Replicate 后台充值后重试',
    );
  });

  it('create prediction HTTP 429 时应提示限流', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel();
    const context = createMockContext();

    mockFetch([
      { status: 429, body: { detail: 'Rate limit exceeded' } },
    ]);

    await expect(adapter.execute({ prompt: 'test' }, model, context)).rejects.toThrow(
      'Replicate 请求过于频繁（触发限流），请稍后重试',
    );
  });

  it('create prediction HTTP 404 时应提示模型不存在', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel();
    const context = createMockContext();

    mockFetch([
      { status: 404, body: { detail: 'Model not found' } },
    ]);

    await expect(adapter.execute({ prompt: 'test' }, model, context)).rejects.toThrow(
      'Replicate 创建 prediction 失败：模型不存在（stability-ai/sdxl），请检查模型 ID 配置',
    );
  });

  it('create prediction HTTP 422 时应透出参数校验详情', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel();
    const context = createMockContext();

    mockFetch([
      { status: 422, body: { detail: 'prompt is required' } },
    ]);

    await expect(adapter.execute({ prompt: 'test' }, model, context)).rejects.toThrow(
      'Replicate 请求参数无效：prompt is required',
    );
  });

  it('create prediction HTTP 500 时应提示服务不可用', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel();
    const context = createMockContext();

    mockFetch([
      { status: 500, body: { detail: 'Internal error' } },
    ]);

    await expect(adapter.execute({ prompt: 'test' }, model, context)).rejects.toThrow(
      'Replicate 服务暂时不可用（HTTP 500），请稍后重试',
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

// ===== buildPredictionInput 回归测试 =====
//
// REG-018: buildPredictionInput 参数合并正确性
//
// 重构背景: 移除了 buildPredictionInput 中读取 model.config 的死代码。
//   原代码: const config = (model as AdapterModel & { config?: ... }).config;
//   该值永远 undefined，因为 provider config 已由 TaskExecutionService
//   在 task-execution.service.ts:102 合并到 model.defaultParams 中。
//   移除后，buildPredictionInput 只从 input 和 model.defaultParams 读取参数。
//
// 验证点:
// 1. defaultParams 中的值在 input 缺失时作为默认值
// 2. input 中的值覆盖 defaultParams
// 3. internal keys (maxWaitTime, referenceImage, referenceImages) 不出现在 prediction input
// 4. AdapterModel 接口不包含 config 字段（类型安全）

describe('ReplicateAdapter - buildPredictionInput 回归', () => {
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

  function capturePostBody(): { postBody: unknown } {
    const state = { postBody: null as unknown };
    global.fetch = vi.fn(async (_url: string, init: RequestInit) => {
      if (init?.method === 'POST') {
        state.postBody = JSON.parse(init.body as string);
        return {
          ok: true, status: 201,
          json: async () => ({ id: 'pred-test', status: 'starting', output: null, error: null, logs: null }),
          text: async () => '',
        } as Response;
      }
      return {
        ok: true, status: 200,
        json: async () => ({ id: 'pred-test', status: 'succeeded', output: 'https://x.com/img.jpg', error: null, logs: null }),
        text: async () => '',
      } as Response;
    }) as typeof global.fetch;
    return state;
  }

  it('defaultParams 中的值在 input 缺失时作为默认值传入', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel({
      defaultParams: { maxWaitTime: 10, width: 1024, seed: 42 },
    });
    const context = createMockContext();
    const state = capturePostBody();

    await adapter.execute({ prompt: 'test' }, model, context);

    const input = (state.postBody as { input: Record<string, unknown> }).input;
    expect(input.width).toBe(1024);
    expect(input.seed).toBe(42);
  });

  it('input 中的值覆盖 defaultParams', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel({
      defaultParams: { maxWaitTime: 10, width: 512, height: 512 },
    });
    const context = createMockContext();
    const state = capturePostBody();

    await adapter.execute({ prompt: 'test', width: 1024, height: 768 }, model, context);

    const input = (state.postBody as { input: Record<string, unknown> }).input;
    expect(input.width).toBe(1024); // input 覆盖 defaultParams
    expect(input.height).toBe(768);
  });

  it('maxWaitTime 不出现在 prediction input 中（internal key 排除）', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel({
      defaultParams: { maxWaitTime: 10, width: 1024 },
    });
    const context = createMockContext();
    const state = capturePostBody();

    await adapter.execute({ prompt: 'test', maxWaitTime: 20 }, model, context);

    const input = (state.postBody as { input: Record<string, unknown> }).input;
    expect(input).not.toHaveProperty('maxWaitTime');
    expect(input.prompt).toBe('test');
    expect(input.width).toBe(1024);
  });

  it('referenceImage/referenceImages 不出现在 prediction input 中', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel({
      defaultParams: { maxWaitTime: 10 },
    });
    const context = createMockContext();
    const state = capturePostBody();

    await adapter.execute({
      prompt: 'test',
      referenceImage: { fileId: 'uuid-1' },
      referenceImages: [{ fileId: 'uuid-2' }],
    }, model, context);

    const input = (state.postBody as { input: Record<string, unknown> }).input;
    expect(input).not.toHaveProperty('referenceImage');
    expect(input).not.toHaveProperty('referenceImages');
    expect(input.prompt).toBe('test');
  });

  it('prompt 始终包含在 prediction input 中', async () => {
    adapter = new ReplicateAdapter();
    const model = createMockModel();
    const context = createMockContext();
    const state = capturePostBody();

    await adapter.execute({ prompt: 'a beautiful sunset' }, model, context);

    const input = (state.postBody as { input: Record<string, unknown> }).input;
    expect(input.prompt).toBe('a beautiful sunset');
  });

  it('AdapterModel 接口不包含 config 字段（类型安全验证）', () => {
    // 验证移除死代码后，AdapterModel 类型上没有 config 属性
    // 这是一个编译时保证，这里做运行时 sanity check
    const model = createMockModel();
    expect(model).not.toHaveProperty('config');
    expect(model.defaultParams).toBeDefined();
  });
});
