import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OpenAIAdapter } from './openai.adapter';
import type { AdapterModel, ExecutionContext } from './protocol-adapter.interface';

function model(overrides: Partial<AdapterModel> = {}): AdapterModel {
  return {
    slug: 'gpt-image-2',
    name: 'GPT Image 2',
    sdkModelId: 'gpt-image-2',
    modality: 'image',
    outputType: 'image',
    providerName: 'pptoken',
    sdkClient: 'openai',
    capabilities: ['image-generation'],
    constraints: {},
    defaultParams: {
      baseUrl: 'https://cn.pptoken.cc/v1',
      apiKey: 'sk-test-key',
      timeoutMs: 30_000,
    },
    costCredits: 10,
    sortOrder: 1,
    ...overrides,
  };
}

function ctx(): ExecutionContext {
  return { taskId: 'task-1', userId: 'user-1', onProgress: vi.fn() };
}

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new OpenAIAdapter();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function jsonResponse(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  function sseResponse(chunks: string[], status = 200): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const c of chunks) controller.enqueue(encoder.encode(c));
        controller.close();
      },
    });
    return new Response(stream, { status, headers: { 'Content-Type': 'text/event-stream' } });
  }

  it('按 OpenAI 标准协议构造请求（URL/鉴权头/请求体）', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ url: 'https://cdn.example.com/a.png' }] }));

    await adapter.execute({ prompt: '一只猫', size: '1024x1024', count: 2 }, model(), ctx());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://cn.pptoken.cc/v1/images/generations');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer sk-test-key');
    expect(init.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body);
    expect(body).toEqual({ model: 'gpt-image-2', prompt: '一只猫', size: '1024x1024', n: 2 });
  });

  it('input.ratio 归一化为 OpenAI size（规范输入 aspect_ratio）', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ url: 'https://cdn.example.com/a.png' }] }));

    await adapter.execute({ prompt: '海报', ratio: '9:16' }, model(), ctx());

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toEqual({ model: 'gpt-image-2', prompt: '海报', size: '1024x1536', n: 1 });
  });

  it('input.quality 透传到请求体（gpt-image-2 inputSchema 声明参数生效）', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ url: 'https://cdn.example.com/a.png' }] }));

    await adapter.execute({ prompt: '产品图', ratio: '16:9', quality: 'high' }, model(), ctx());

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toEqual({ model: 'gpt-image-2', prompt: '产品图', size: '1536x1024', n: 1, quality: 'high' });
  });

  it('未提供 quality 时不带该字段（保持向后兼容请求体）', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ url: 'https://cdn.example.com/a.png' }] }));

    await adapter.execute({ prompt: '猫' }, model(), ctx());

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toEqual({ model: 'gpt-image-2', prompt: '猫', size: '1024x1024', n: 1 });
  });

  it('去尾斜杠拼接 baseUrl', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ url: 'https://cdn.example.com/a.png' }] }));

    await adapter.execute({ prompt: 'cat' }, model({ defaultParams: { baseUrl: 'https://cn.pptoken.cc/v1/', apiKey: 'k' } }), ctx());

    expect(fetchMock.mock.calls[0][0]).toBe('https://cn.pptoken.cc/v1/images/generations');
  });

  it('解析 url 响应为统一 images 输出', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ url: 'https://cdn.example.com/a.png' }] }));

    const result = await adapter.execute({ prompt: 'cat' }, model(), ctx());

    expect(result.output).toMatchObject({
      images: [{ url: 'https://cdn.example.com/a.png' }],
      modelUsed: 'gpt-image-2',
    });
  });

  it('解析 b64_json 响应为 data URL 兜底', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ b64_json: 'QUJD' }] }));

    const result = await adapter.execute({ prompt: 'cat' }, model(), ctx());

    expect(result.output.images).toEqual([{ url: 'data:image/png;base64,QUJD', embedded: true }]);
  });

  it('非 2xx 响应时抛出带状态码与网关错误信息的异常', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'Insufficient quota' } }, 429));

    await expect(adapter.execute({ prompt: 'cat' }, model(), ctx())).rejects.toThrow(/429.*Insufficient quota/);
  });

  it('非 JSON 响应时抛出明确错误', async () => {
    fetchMock.mockResolvedValue(new Response('gateway error', { status: 502 }));

    await expect(adapter.execute({ prompt: 'cat' }, model(), ctx())).rejects.toThrow(/非 JSON 响应/);
  });

  it('data 为空时抛出错误', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));

    await expect(adapter.execute({ prompt: 'cat' }, model(), ctx())).rejects.toThrow(/未返回任何图片数据/);
  });

  it('渠道未配置 apiKey 时直接抛错（不再 Mock）', async () => {
    await expect(
      adapter.execute(
        { prompt: 'cat' },
        model({ defaultParams: { baseUrl: 'https://cn.pptoken.cc/v1' } }),
        ctx(),
      ),
    ).rejects.toThrow(/OpenAI 兼容网关渠道配置不完整：未设置 apiKey/);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('请求超时时抛出超时错误', async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      // 模拟 AbortController 中止
      const signal = init.signal as AbortSignal;
      signal.addEventListener('abort', () => reject(new Error('The operation was aborted')));
    }));

    await expect(
      adapter.execute({ prompt: 'cat' }, model({ defaultParams: { baseUrl: 'https://cn.pptoken.cc/v1', apiKey: 'k', timeoutMs: 50 } }), ctx()),
    ).rejects.toThrow(/请求超时/);
  });

  // ===== LLM: chat completions =====

  describe('图片编辑 — 有参考图走 images/edits multipart（多参考图契约）', () => {
    function imageResponse(): Response {
      return new Response(new Uint8Array([1, 2, 3, 4]), {
        headers: { 'Content-Type': 'image/webp' },
      });
    }

    afterEach(() => {
      delete process.env.COZE_PROJECT_DOMAIN_DEFAULT;
    });

    it('有 referenceImages 时走 /images/edits，multipart 携带每张参考图（image 字段 × N）', async () => {
      fetchMock
        .mockResolvedValueOnce(imageResponse()) // 下载 ref1
        .mockResolvedValueOnce(imageResponse()) // 下载 ref2
        .mockResolvedValueOnce(jsonResponse({ data: [{ url: 'https://cdn.example.com/edit.png' }] })); // edits

      const result = await adapter.execute(
        {
          prompt: '将图一的连衣裙、开衫换到图二 图二模特动作姿势不改变',
          referenceImages: [
            'https://cdn.example.com/ref1.webp',
            'https://cdn.example.com/ref2.webp',
          ],
        },
        model(),
        ctx(),
      );

      expect(fetchMock).toHaveBeenCalledTimes(3);
      // 前两次为参考图下载
      expect(fetchMock.mock.calls[0][0]).toBe('https://cdn.example.com/ref1.webp');
      expect(fetchMock.mock.calls[1][0]).toBe('https://cdn.example.com/ref2.webp');
      // 第三次为 edits 提交
      const [url, init] = fetchMock.mock.calls[2];
      expect(url).toBe('https://cn.pptoken.cc/v1/images/edits');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Bearer sk-test-key');
      // multipart：Content-Type 由 fetch 自动生成（boundary），不可手动设置
      expect(init.headers['Content-Type']).toBeUndefined();
      const fd = init.body as FormData;
      expect(fd.get('model')).toBe('gpt-image-2');
      expect(fd.get('prompt')).toBe('将图一的连衣裙、开衫换到图二 图二模特动作姿势不改变');
      expect(fd.get('n')).toBe('1');
      expect(fd.get('size')).toBeNull(); // 未显式 size 时不强制（沿用参考图比例）
      const images = fd.getAll('image');
      expect(images).toHaveLength(2);
      expect((images[0] as Blob).type).toBe('image/webp');
      expect((images[0] as Blob).size).toBe(4);
      expect(result.output.images).toHaveLength(1);
      expect(result.output.modelUsed).toBe('gpt-image-2');
    });

    it('编辑响应 b64_json 解析为 data URL 兜底', async () => {
      fetchMock
        .mockResolvedValueOnce(imageResponse())
        .mockResolvedValueOnce(jsonResponse({ data: [{ b64_json: 'QUJD' }] }));

      const result = await adapter.execute(
        { prompt: '换装', referenceImages: ['https://cdn.example.com/ref.webp'] },
        model(),
        ctx(),
      );

      expect(result.output.images).toEqual([{ url: 'data:image/png;base64,QUJD', embedded: true }]);
    });

    it('无 referenceImages 时维持 /images/generations JSON（不触发参考图下载）', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ data: [{ url: 'https://cdn.example.com/a.png' }] }));

      await adapter.execute({ prompt: '猫' }, model(), ctx());

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe('https://cn.pptoken.cc/v1/images/generations');
      const [, init] = fetchMock.mock.calls[0];
      expect(init.headers['Content-Type']).toBe('application/json');
    });

    it('参考图下载失败时显性报错（绝不静默丢弃参考图继续文生图）', async () => {
      fetchMock
        .mockResolvedValueOnce(new Response('not found', { status: 404 }))
        .mockResolvedValueOnce(jsonResponse({ data: [{ url: 'https://cdn.example.com/x.png' }] }));

      await expect(
        adapter.execute(
          { prompt: '换装', referenceImages: ['https://cdn.example.com/ref.webp'] },
          model(),
          ctx(),
        ),
      ).rejects.toThrow(/参考图下载失败（HTTP 404）/);
      expect(fetchMock).toHaveBeenCalledTimes(1); // 下载失败即中止，不再提交
    });

    it('相对路径参考图 + 未配置 COZE_PROJECT_DOMAIN_DEFAULT → 显性报错', async () => {
      delete process.env.COZE_PROJECT_DOMAIN_DEFAULT;

      await expect(
        adapter.execute(
          { prompt: '换装', referenceImages: ['/api/storage/serve/users/1/ref.webp'] },
          model(),
          ctx(),
        ),
      ).rejects.toThrow(/COZE_PROJECT_DOMAIN_DEFAULT/);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('相对路径参考图 + COZE_PROJECT_DOMAIN_DEFAULT → 拼接绝对 URL 下载并走 edits', async () => {
      process.env.COZE_PROJECT_DOMAIN_DEFAULT = 'https://app.example.com';
      fetchMock
        .mockResolvedValueOnce(imageResponse())
        .mockResolvedValueOnce(jsonResponse({ data: [{ url: 'https://cdn.example.com/edit.png' }] }));

      const result = await adapter.execute(
        { prompt: '换装', referenceImages: ['/api/storage/serve/users/1/ref.webp'] },
        model(),
        ctx(),
      );

      expect(fetchMock.mock.calls[0][0]).toBe('https://app.example.com/api/storage/serve/users/1/ref.webp');
      expect(fetchMock.mock.calls[1][0]).toBe('https://cn.pptoken.cc/v1/images/edits');
      expect(result.output.images).toHaveLength(1);
    });
  });

  describe('LLM chat completions', () => {
    const llmModel = () => model({ outputType: 'text', modality: 'llm' });

    it('按 chat completions 协议构造流式请求并解析 SSE 输出', async () => {
      fetchMock.mockResolvedValue(sseResponse([
        'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
        'data: [DONE]\n\n',
      ]));
      const progress = vi.fn();

      const result = await adapter.execute(
        { prompt: 'hi', systemPrompt: '你是助手', temperature: 0.5 },
        llmModel(),
        { taskId: 't1', userId: 'u1', onProgress: progress },
      );

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://cn.pptoken.cc/v1/chat/completions');
      const body = JSON.parse(init.body);
      expect(body.model).toBe('gpt-image-2');
      expect(body.messages).toEqual([
        { role: 'system', content: '你是助手' },
        { role: 'user', content: 'hi' },
      ]);
      expect(body.stream).toBe(true);
      expect(body.temperature).toBe(0.5);
      expect(result.output.content).toBe('你好');
      expect(progress).toHaveBeenCalled();
    });

    it('解析 conversationHistory 到 messages', async () => {
      // 空内容流 → 抛"流式响应为空"，借以捕获请求体后结束
      fetchMock.mockResolvedValue(sseResponse(['data: [DONE]\n\n']));
      const history = [
        { role: 'user', content: '第一问' },
        { role: 'assistant', content: '第一答' },
      ];

      await expect(adapter.execute(
        { prompt: '再问', conversationHistory: history },
        llmModel(),
        ctx(),
      )).rejects.toThrow(/流式响应为空/);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.messages).toEqual([
        { role: 'user', content: '第一问' },
        { role: 'assistant', content: '第一答' },
        { role: 'user', content: '再问' },
      ]);
    });

    it('网关忽略 stream 时按非流式 JSON 解析', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: '一次返回' } }] }));

      const result = await adapter.execute({ prompt: 'hi' }, llmModel(), ctx());

      expect(result.output.content).toBe('一次返回');
    });

    it('非 2xx 时抛出带状态码与网关错误信息的异常', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'Invalid API key' } }, 401));

      await expect(adapter.execute({ prompt: 'hi' }, llmModel(), ctx())).rejects.toThrow(/401.*Invalid API key/);
    });

    it('流式响应为空时抛出明确错误', async () => {
      fetchMock.mockResolvedValue(sseResponse(['data: [DONE]\n\n']));

      await expect(adapter.execute({ prompt: 'hi' }, llmModel(), ctx())).rejects.toThrow(/流式响应为空/);
    });

    it('未配置 apiKey 时直接抛错（不再 Mock）', async () => {
      const progress = vi.fn();
      await expect(
        adapter.execute(
          { prompt: 'hi' },
          model({ outputType: 'text', modality: 'llm', defaultParams: { baseUrl: 'https://cn.pptoken.cc/v1' } }),
          { taskId: 't1', userId: 'u1', onProgress: progress },
        ),
      ).rejects.toThrow(/OpenAI 兼容网关渠道配置不完整：未设置 apiKey/);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(progress).not.toHaveBeenCalled();
    });
  });
});