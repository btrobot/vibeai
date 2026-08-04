/**
 * 适配器注册表
 *
 * 根据 model.modality 返回对应的 ProtocolAdapter
 */

import { Injectable } from '@nestjs/common';
import { LlmAdapter } from './llm.adapter';
import { ImageAdapter } from './image.adapter';
import { VideoAdapter } from './video.adapter';
import type { ProtocolAdapter, Modality } from './protocol-adapter.interface';

@Injectable()
export class AdapterRegistry {
  private readonly adapters: Map<Modality, ProtocolAdapter>;

  constructor(
    private readonly llmAdapter: LlmAdapter,
    private readonly imageAdapter: ImageAdapter,
    private readonly videoAdapter: VideoAdapter,
  ) {
    this.adapters = new Map<Modality, ProtocolAdapter>([
      ['llm', llmAdapter],
      ['image', imageAdapter],
      ['video', videoAdapter],
    ]);
  }

  getAdapter(modality: Modality): ProtocolAdapter {
    const adapter = this.adapters.get(modality);
    if (!adapter) {
      throw new Error(`No adapter registered for modality: ${modality}`);
    }
    return adapter;
  }
}
