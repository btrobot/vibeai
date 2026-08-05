/**
 * Seeds Data Integrity Tests
 *
 * 验证种子数据的完整性和一致性
 * 覆盖：SEED_MODELS + SEED_RECIPES
 */

import { describe, it, expect } from 'vitest';
import { SEED_MODELS, SEED_RECIPES } from './model-seeds';
import { builtInCapabilities } from '../capabilities/index';

describe('Seeds Data Integrity', () => {
  // ===== SEED_MODELS 完整性 =====

  describe('SEED_MODELS', () => {
    it('包含 13 个模型', () => {
      expect(SEED_MODELS).toHaveLength(13);
    });

    it('每个模型有唯一 slug', () => {
      const slugs = SEED_MODELS.map((m) => m.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('每个模型有唯一 sdkModelId', () => {
      const ids = SEED_MODELS.map((m) => m.sdkModelId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('包含 6 个 LLM 模型', () => {
      const llmModels = SEED_MODELS.filter((m) => m.modality === 'llm');
      expect(llmModels).toHaveLength(6);
    });

    it('包含 5 个图片模型', () => {
      const imageModels = SEED_MODELS.filter((m) => m.modality === 'image');
      expect(imageModels).toHaveLength(5);
    });

    it('包含 2 个视频模型', () => {
      const videoModels = SEED_MODELS.filter((m) => m.modality === 'video');
      expect(videoModels).toHaveLength(2);
    });

    it('每个模型的 costCredits > 0', () => {
      for (const m of SEED_MODELS) {
        expect(m.costCredits).toBeGreaterThan(0);
      }
    });

    it('每个模型的 sdkClient 与 modality 一致（Replicate 模型除外）', () => {
      for (const m of SEED_MODELS) {
        if (m.sdkClient === 'replicate') {
          // Replicate 模型使用独立 sdkClient
          expect(m.providerName).toBe('replicate');
          continue;
        }
        const expectedClient =
          m.modality === 'llm' ? 'llm' :
          m.modality === 'image' ? 'image' :
          'video';
        expect(m.sdkClient).toBe(expectedClient);
      }
    });

    it('每个模型的 capabilities 引用已存在的能力 slug', () => {
      const capabilitySlugs = new Set(builtInCapabilities.map((c) => c.slug));
      for (const m of SEED_MODELS) {
        for (const cap of m.capabilities ?? []) {
          expect(capabilitySlugs.has(cap)).toBe(true);
        }
      }
    });

    it('每个模型有 sortOrder 且唯一', () => {
      const sortOrders = SEED_MODELS.map((m) => m.sortOrder);
      expect(new Set(sortOrders).size).toBe(sortOrders.length);
    });

    it('每个模型有 inputSchema (JSON Schema 格式)', () => {
      for (const m of SEED_MODELS) {
        expect(m.inputSchema).toBeDefined();
        const schema = m.inputSchema as Record<string, unknown>;
        expect(schema.type).toBe('object');
        expect(schema.properties).toBeDefined();
      }
    });

    it('LLM 模型的 inputSchema 包含 prompt 字段', () => {
      const llmModels = SEED_MODELS.filter((m) => m.modality === 'llm');
      for (const m of llmModels) {
        const schema = m.inputSchema as Record<string, any>;
        expect(schema.properties.prompt).toBeDefined();
        expect(schema.required).toContain('prompt');
      }
    });

    it('图片模型的 inputSchema 包含 prompt 字段', () => {
      const imageModels = SEED_MODELS.filter((m) => m.modality === 'image');
      for (const m of imageModels) {
        const schema = m.inputSchema as Record<string, any>;
        expect(schema.properties.prompt).toBeDefined();
        expect(schema.required).toContain('prompt');
      }
    });

    it('视频模型的 inputSchema 包含 prompt 字段', () => {
      const videoModels = SEED_MODELS.filter((m) => m.modality === 'video');
      for (const m of videoModels) {
        const schema = m.inputSchema as Record<string, any>;
        expect(schema.properties.prompt).toBeDefined();
        expect(schema.required).toContain('prompt');
      }
    });

    it('featured 模型至少 3 个', () => {
      const featured = SEED_MODELS.filter((m) => m.isFeatured);
      expect(featured.length).toBeGreaterThanOrEqual(3);
    });

    it('所有模型 isActive=true', () => {
      for (const m of SEED_MODELS) {
        expect(m.isActive).toBe(true);
      }
    });

    it('LLM 模型有 defaultParams.temperature', () => {
      const llmModels = SEED_MODELS.filter((m) => m.modality === 'llm');
      for (const m of llmModels) {
        const params = m.defaultParams as Record<string, unknown>;
        expect(params.temperature).toBeDefined();
      }
    });

    it('大部分 LLM 模型有 defaultParams.thinking（非强制）', () => {
      const llmModels = SEED_MODELS.filter((m) => m.modality === 'llm');
      const withThinking = llmModels.filter((m) => {
        const params = m.defaultParams as Record<string, unknown>;
        return params.thinking !== undefined;
      });
      // 6 个 LLM 中至少 5 个有 thinking（GLM-5 可能没有）
      expect(withThinking.length).toBeGreaterThanOrEqual(5);
    });
  });

  // ===== SEED_RECIPES 完整性 =====

  describe('SEED_RECIPES', () => {
    it('包含 6 个快捷创作方案', () => {
      expect(SEED_RECIPES).toHaveLength(6);
    });

    it('每个 recipe 有唯一 id', () => {
      const ids = SEED_RECIPES.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个 recipe 有 sortOrder 且唯一', () => {
      const sortOrders = SEED_RECIPES.map((r) => r.sortOrder);
      expect(new Set(sortOrders).size).toBe(sortOrders.length);
    });

    it('每个 recipe 引用的 capabilitySlug 已存在', () => {
      const capabilitySlugs = new Set(builtInCapabilities.map((c) => c.slug));
      for (const r of SEED_RECIPES) {
        expect(capabilitySlugs.has(r.capabilitySlug)).toBe(true);
      }
    });

    it('每个 recipe 引用的 modelSlug 在 SEED_MODELS 中存在', () => {
      const modelSlugs = new Set(SEED_MODELS.map((m) => m.slug));
      for (const r of SEED_RECIPES) {
        expect(modelSlugs.has(r.modelSlug)).toBe(true);
      }
    });

    it('每个 recipe 有 defaultInput', () => {
      for (const r of SEED_RECIPES) {
        expect(r.defaultInput).toBeDefined();
        expect(typeof r.defaultInput).toBe('object');
      }
    });

    it('text-to-image recipe 使用图片模型', () => {
      const recipe = SEED_RECIPES.find((r) => r.id === 'text-to-image');
      expect(recipe).toBeDefined();
      expect(recipe!.capabilitySlug).toBe('image-generation');
      const model = SEED_MODELS.find((m) => m.slug === recipe!.modelSlug);
      expect(model!.modality).toBe('image');
    });

    it('text-to-video recipe 使用视频模型', () => {
      const recipe = SEED_RECIPES.find((r) => r.id === 'text-to-video');
      expect(recipe).toBeDefined();
      expect(recipe!.capabilitySlug).toBe('video-generation');
      const model = SEED_MODELS.find((m) => m.slug === recipe!.modelSlug);
      expect(model!.modality).toBe('video');
    });

    it('prompt-enhance recipe 使用 LLM 模型', () => {
      const recipe = SEED_RECIPES.find((r) => r.id === 'prompt-enhance');
      expect(recipe).toBeDefined();
      expect(recipe!.capabilitySlug).toBe('text-generation');
      const model = SEED_MODELS.find((m) => m.slug === recipe!.modelSlug);
      expect(model!.modality).toBe('llm');
    });

    it('detail-page-copy recipe 使用 LLM 模型', () => {
      const recipe = SEED_RECIPES.find((r) => r.id === 'detail-page-copy');
      expect(recipe).toBeDefined();
      const model = SEED_MODELS.find((m) => m.slug === recipe!.modelSlug);
      expect(model!.modality).toBe('llm');
    });
  });

  // ===== 跨数据一致性 =====

  describe('跨数据一致性', () => {
    it('recipe 引用的 model 的 capability 包含 recipe 的 capabilitySlug', () => {
      for (const r of SEED_RECIPES) {
        const model = SEED_MODELS.find((m) => m.slug === r.modelSlug);
        expect(model).toBeDefined();
        expect(model!.capabilities).toContain(r.capabilitySlug);
      }
    });

    it('SEED_MODELS 按 sortOrder 升序排列', () => {
      for (let i = 1; i < SEED_MODELS.length; i++) {
        expect(SEED_MODELS[i].sortOrder).toBeGreaterThan(SEED_MODELS[i - 1].sortOrder);
      }
    });

    it('SEED_RECIPES 按 sortOrder 升序排列', () => {
      for (let i = 1; i < SEED_RECIPES.length; i++) {
        expect(SEED_RECIPES[i].sortOrder).toBeGreaterThan(SEED_RECIPES[i - 1].sortOrder);
      }
    });
  });
});
