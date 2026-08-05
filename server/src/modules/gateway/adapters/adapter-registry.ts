/**
 * 适配器注册表
 *
 * 根据 sdkClient 字段返回对应的 ProtocolAdapter
 * 支持的 sdkClient 值：
 * - 'llm'       → LlmAdapter (Coze SDK)
 * - 'image'     → ImageAdapter (Coze SDK)
 * - 'video'     → VideoAdapter (Coze SDK)
 * - 'replicate' → ReplicateAdapter (纯 REST)
 *
 * 向后兼容：sdkClient 为 'llm'/'image'/'video' 时走原适配器
 */

import { Injectable, Inject } from '@nestjs/common';
import { LlmAdapter } from './llm.adapter';
import { ImageAdapter } from './image.adapter';
import { VideoAdapter } from './video.adapter';
import { ReplicateAdapter } from './replicate.adapter';
import type { ProtocolAdapter } from './protocol-adapter.interface';

@Injectable()
export class AdapterRegistry {
  private readonly adapters: Map<string, ProtocolAdapter>;

  constructor(
    @Inject('LLM_ADAPTER') private readonly llmAdapter: LlmAdapter,
    @Inject('IMAGE_ADAPTER') private readonly imageAdapter: ImageAdapter,
    @Inject('VIDEO_ADAPTER') private readonly videoAdapter: VideoAdapter,
    @Inject('REPLICATE_ADAPTER') private readonly replicateAdapter: ReplicateAdapter,
  ) {
    this.adapters = new Map<string, ProtocolAdapter>([
      ['llm', llmAdapter],
      ['image', imageAdapter],
      ['video', videoAdapter],
      ['replicate', replicateAdapter],
    ]);
  }

  getAdapter(sdkClient: string): ProtocolAdapter {
    const adapter = this.adapters.get(sdkClient);
    if (!adapter) {
      throw new Error(`No adapter registered for sdkClient: ${sdkClient}`);
    }
    return adapter;
  }
}
