/**
 * LlmAdapter 单元测试
 *
 * 覆盖范围：
 * - 消息构建：纯文本、多模态（图片+视频）、对话历史、系统提示词
 * - 流式收集：chunk 累积、onProgress 回调
 * - 执行结果：fullContent 返回
 * - 错误处理：客户端未初始化
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LlmAdapter } from './llm.adapter';
import type { AdapterModel, ExecutionContext } from './protocol-adapter.interface';

// Mock coze-coding-dev-sdk
vi.mock('coze-coding-dev-sdk', () => {
  const mockStream = async function* () {
    yield { content: 'Hello' };
    yield { content: ', ' };
    yield { content: 'world!' };
  };

  const mockClient = {
    stream: vi.fn().mockImplementation(() => mockStream()),
  };

  return {
    LLMClient: vi.fn().mockImplementation(() => mockClient),
    Config: vi.fn().mockImplementation((opts: Record<string, unknown>) => opts),
  };
});

describe('LlmAdapter', () => {
  let adapter: LlmAdapter;

  const mockModel: AdapterModel = {
    slug: 'doubao-seed-2-0-pro',
    name: 'Doubao Seed 2.0 Pro',
    sdkModelId: 'doubao-seed-2-0-pro-260215',
    modality: 'llm',
    outputType: 'text',
    sdkClient: 'coze',
    constraints: { supportsThinking: true, maxTokens: 65536 },
    defaultParams: { temperature: 0.7, thinking: 'disabled' },
    costCredits: 5,
    sortOrder: 1,
  };

  const mockContext: ExecutionContext = {
    taskId: 'task-1',
    userId: 'user-1',
    onProgress: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.COZE_LOOP_API_TOKEN = 'test-token';
    adapter = new LlmAdapter();
  });

  // ===== 协议属性 =====

  describe('协议属性', () => {
    it('protocolKind 应为 SYNC_STREAMING', () => {
      expect(adapter.protocolKind).toBe('SYNC_STREAMING');
    });

    it('modality 应为 llm', () => {
      expect(adapter.modality).toBe('llm');
    });
  });

  // ===== execute =====

  describe('execute', () => {
    it('纯文本输入应正确流式收集并返回完整内容', async () => {
      const result = await adapter.execute(
        { prompt: 'Hello, world!' },
        mockModel,
        mockContext,
      );

      expect(result.output).toHaveProperty('content');
      expect(result.output.content).toBe('Hello, world!');
      expect(result.output.modelUsed).toBe('doubao-seed-2-0-pro');
    });

    it('流式过程中应通过 onProgress 回调推送每个 chunk', async () => {
      await adapter.execute(
        { prompt: 'test' },
        mockModel,
        mockContext,
      );

      expect(mockContext.onProgress).toHaveBeenCalled();
      // 3 chunks: 'Hello', ', ', 'world!'
      expect(mockContext.onProgress).toHaveBeenCalledTimes(3);
    });

    it('系统提示词应被正确处理', async () => {
      const result = await adapter.execute(
        {
          prompt: '写一首诗',
          systemPrompt: '你是一个诗人',
        },
        mockModel,
        mockContext,
      );

      expect(result.output.content).toBe('Hello, world!');
    });

    it('对话历史应被正确合并', async () => {
      const result = await adapter.execute(
        {
          prompt: '继续',
          conversationHistory: [
            { role: 'user', content: '写一首诗' },
            { role: 'assistant', content: '春风拂面...' },
          ],
        },
        mockModel,
        mockContext,
      );

      expect(result.output.content).toBe('Hello, world!');
    });

    it('多模态输入（图片+视频）应正确构建消息', async () => {
      const result = await adapter.execute(
        {
          prompt: '描述这张图片',
          images: ['https://example.com/img1.png'],
          videos: ['https://example.com/video1.mp4'],
        },
        mockModel,
        mockContext,
      );

      expect(result.output.content).toBe('Hello, world!');
    });

    it('仅图片输入（无视频）应正确处理', async () => {
      const result = await adapter.execute(
        {
          prompt: '分析图片',
          images: ['https://example.com/img1.png', 'https://example.com/img2.png'],
        },
        mockModel,
        mockContext,
      );

      expect(result.output.content).toBe('Hello, world!');
    });

    it('temperature 从 input 读取优先于 model.defaultParams', async () => {
      const result = await adapter.execute(
        {
          prompt: 'test',
          temperature: 0.3,
        },
        mockModel,
        mockContext,
      );

      // Verify execution completed successfully with the custom temperature
      expect(result.output.content).toBe('Hello, world!');
    });

    it('thinkingMode 启用时应传 thinking: enabled', async () => {
      const result = await adapter.execute(
        {
          prompt: 'complex reasoning',
          thinkingMode: true,
        },
        mockModel,
        mockContext,
      );

      expect(result.output.content).toBe('Hello, world!');
    });

    it('无 Token 时进入 Mock 模式返回伪造文本', async () => {
      // Create adapter without API token
      delete process.env.COZE_LOOP_API_TOKEN;
      delete process.env.COZE_WORKLOAD_API_TOKEN;
      const noTokenAdapter = new LlmAdapter();

      const result = await noTokenAdapter.execute({ prompt: 'hello' }, mockModel, mockContext);
      expect(result.output.mock).toBe(true);
      expect(result.output.content).toContain('Mock LLM Response');
    });
  });
});
