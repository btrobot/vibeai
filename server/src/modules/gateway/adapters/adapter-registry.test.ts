import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdapterRegistry } from './adapter-registry';
import type { ProtocolAdapter, Modality } from './protocol-adapter.interface';

// ===== Mock Adapters =====

function createMockAdapter(modality: Modality, sdkClient: string): ProtocolAdapter {
  return {
    modality,
    sdkClient,
    protocolKind: modality === 'llm' ? 'SYNC_STREAMING' : modality === 'image' ? 'SYNC_REQUEST_RESPONSE' : 'ASYNC_TASK',
    execute: vi.fn(),
  };
}

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;
  let llmAdapter: ProtocolAdapter;
  let imageAdapter: ProtocolAdapter;
  let videoAdapter: ProtocolAdapter;
  let replicateAdapter: ProtocolAdapter;

  beforeEach(() => {
    llmAdapter = createMockAdapter('llm', 'llm');
    imageAdapter = createMockAdapter('image', 'image');
    videoAdapter = createMockAdapter('video', 'video');
    replicateAdapter = {
      modality: 'image',
      sdkClient: 'replicate',
      protocolKind: 'ASYNC_TASK' as const,
      execute: vi.fn(),
    };
    registry = new AdapterRegistry(llmAdapter, imageAdapter, videoAdapter, replicateAdapter);
  });

  describe('getAdapter', () => {
    it('sdkClient=llm 时应返回 LlmAdapter', () => {
      const adapter = registry.getAdapter('llm');
      expect(adapter).toBe(llmAdapter);
      expect(adapter.sdkClient).toBe('llm');
    });

    it('sdkClient=image 时应返回 ImageAdapter', () => {
      const adapter = registry.getAdapter('image');
      expect(adapter).toBe(imageAdapter);
      expect(adapter.sdkClient).toBe('image');
    });

    it('sdkClient=video 时应返回 VideoAdapter', () => {
      const adapter = registry.getAdapter('video');
      expect(adapter).toBe(videoAdapter);
      expect(adapter.sdkClient).toBe('video');
    });

    it('sdkClient=replicate 时应返回 ReplicateAdapter', () => {
      const adapter = registry.getAdapter('replicate');
      expect(adapter).toBe(replicateAdapter);
      expect(adapter.sdkClient).toBe('replicate');
    });

    it('sdkClient 不存在时应抛出 Error', () => {
      expect(() => registry.getAdapter('audio')).toThrow(
        'No adapter registered for sdkClient: audio',
      );
    });

    it('null/undefined sdkClient 应抛出 Error', () => {
      expect(() => registry.getAdapter(null as unknown as string)).toThrow();
      expect(() => registry.getAdapter(undefined as unknown as string)).toThrow();
    });
  });

  describe('协议属性一致性', () => {
    it('LLM 适配器应为 SYNC_STREAMING 协议', () => {
      const adapter = registry.getAdapter('llm');
      expect(adapter.protocolKind).toBe('SYNC_STREAMING');
    });

    it('Image 适配器应为 SYNC_REQUEST_RESPONSE 协议', () => {
      const adapter = registry.getAdapter('image');
      expect(adapter.protocolKind).toBe('SYNC_REQUEST_RESPONSE');
    });

    it('Video 适配器应为 ASYNC_TASK 协议', () => {
      const adapter = registry.getAdapter('video');
      expect(adapter.protocolKind).toBe('ASYNC_TASK');
    });

    it('Replicate 适配器应为 ASYNC_TASK 协议', () => {
      const adapter = registry.getAdapter('replicate');
      expect(adapter.protocolKind).toBe('ASYNC_TASK');
    });
  });

  describe('适配器隔离性', () => {
    it('每次 getAdapter 返回同一引用（单例）', () => {
      const a1 = registry.getAdapter('llm');
      const a2 = registry.getAdapter('llm');
      expect(a1).toBe(a2);
    });

    it('不同 sdkClient 返回不同适配器实例', () => {
      const llm = registry.getAdapter('llm');
      const image = registry.getAdapter('image');
      const video = registry.getAdapter('video');
      const replicate = registry.getAdapter('replicate');
      expect(llm).not.toBe(image);
      expect(llm).not.toBe(video);
      expect(llm).not.toBe(replicate);
      expect(image).not.toBe(video);
      expect(image).not.toBe(replicate);
      expect(video).not.toBe(replicate);
    });
  });

  describe('向后兼容', () => {
    it('modality 值作为 sdkClient 仍可正常路由（llm/image/video）', () => {
      // 现有模型的 sdkClient === modality，确保向后兼容
      expect(registry.getAdapter('llm')).toBe(llmAdapter);
      expect(registry.getAdapter('image')).toBe(imageAdapter);
      expect(registry.getAdapter('video')).toBe(videoAdapter);
    });
  });
});
