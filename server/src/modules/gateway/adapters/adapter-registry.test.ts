import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdapterRegistry } from './adapter-registry';
import type { ProtocolAdapter, Modality } from './protocol-adapter.interface';

// ===== Mock Adapters =====

function createMockAdapter(modality: Modality): ProtocolAdapter {
  return {
    modality,
    protocolKind: modality === 'llm' ? 'SYNC_STREAMING' : modality === 'image' ? 'SYNC_REQUEST_RESPONSE' : 'ASYNC_TASK',
    execute: vi.fn(),
  };
}

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;
  let llmAdapter: ProtocolAdapter;
  let imageAdapter: ProtocolAdapter;
  let videoAdapter: ProtocolAdapter;

  beforeEach(() => {
    llmAdapter = createMockAdapter('llm');
    imageAdapter = createMockAdapter('image');
    videoAdapter = createMockAdapter('video');
    registry = new AdapterRegistry(llmAdapter, imageAdapter, videoAdapter);
  });

  describe('getAdapter', () => {
    it('modality=llm 时应返回 LlmAdapter', () => {
      const adapter = registry.getAdapter('llm');
      expect(adapter).toBe(llmAdapter);
      expect(adapter.modality).toBe('llm');
    });

    it('modality=image 时应返回 ImageAdapter', () => {
      const adapter = registry.getAdapter('image');
      expect(adapter).toBe(imageAdapter);
      expect(adapter.modality).toBe('image');
    });

    it('modality=video 时应返回 VideoAdapter', () => {
      const adapter = registry.getAdapter('video');
      expect(adapter).toBe(videoAdapter);
      expect(adapter.modality).toBe('video');
    });

    it('modality 不存在时应抛出 Error', () => {
      expect(() => registry.getAdapter('audio' as Modality)).toThrow(
        'No adapter registered for modality: audio',
      );
    });

    it('null/undefined modality 应抛出 Error', () => {
      expect(() => registry.getAdapter(null as unknown as Modality)).toThrow();
      expect(() => registry.getAdapter(undefined as unknown as Modality)).toThrow();
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
  });

  describe('适配器隔离性', () => {
    it('每次 getAdapter 返回同一引用（单例）', () => {
      const a1 = registry.getAdapter('llm');
      const a2 = registry.getAdapter('llm');
      expect(a1).toBe(a2);
    });

    it('不同 modality 返回不同适配器实例', () => {
      const llm = registry.getAdapter('llm');
      const image = registry.getAdapter('image');
      const video = registry.getAdapter('video');
      expect(llm).not.toBe(image);
      expect(llm).not.toBe(video);
      expect(image).not.toBe(video);
    });
  });
});
