/**
 * Seeds Data Integrity Tests
 *
 * 验证种子数据的完整性和一致性
 * 覆盖：SEED_MODELS + SEED_RECIPES
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import {
  SEED_MODELS,
  SEED_PLATFORMS,
  SEED_CHANNELS,
  SEED_MODEL_ROUTES,
  SEED_RECIPES,
} from './model-seeds';
import { builtInCapabilities } from '../capabilities/index';

describe('Seeds Data Integrity', () => {
  // ===== SEED_MODELS 完整性 =====

  describe('SEED_MODELS', () => {
    it('包含 15 个模型', () => {
      expect(SEED_MODELS).toHaveLength(15);
    });

    it('每个模型有唯一 slug', () => {
      const slugs = SEED_MODELS.map((m) => m.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('每个模型有唯一 sdkModelId', () => {
      const ids = SEED_MODELS.map((m) => m.sdkModelId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('包含 7 个 LLM 模型', () => {
      const llmModels = SEED_MODELS.filter((m) => m.modality === 'llm');
      expect(llmModels).toHaveLength(7);
    });

    it('包含 6 个图片模型', () => {
      const imageModels = SEED_MODELS.filter((m) => m.modality === 'image');
      expect(imageModels).toHaveLength(6);
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
        // LLM 可走 Coze 协议（llm）或 OpenAI 协议（openai，如 pptoken 网关）
        const allowedClients =
          m.modality === 'llm' ? ['llm', 'openai'] :
          m.modality === 'image' ? ['image', 'openai', 'replicate'] :
          ['video'];
        expect(allowedClients).toContain(m.sdkClient);
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

    it('图片模型的 inputSchema 包含 prompt 字段（纯抠图模型 rmbg-2-0 除外，输入为 image）', () => {
      const imageModels = SEED_MODELS.filter((m) => m.modality === 'image');
      for (const m of imageModels) {
        if (m.slug === 'rmbg-2-0') continue; // 白底抠图模型无 prompt，输入契约 = image + backgroundColor
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
    it('验证模型渠道/路由种子引用完整且使用冲突跳过策略', () => {
      const modelSlugs = new Set(SEED_MODELS.map((model) => model.slug));
      expect(SEED_CHANNELS.every((channel) => modelSlugs.has(channel.modelSlug))).toBe(true);
      expect(SEED_CHANNELS.every((channel) => SEED_PLATFORMS.some((p) => p.name === channel.platformName))).toBe(true);
      expect(SEED_MODEL_ROUTES.every((route) => modelSlugs.has(route.modelSlug))).toBe(true);

      const gatewayServiceSource = fs.readFileSync(
        path.resolve(__dirname, '../gateway.service.ts'),
        'utf8',
      );
      const seedScriptSource = fs.readFileSync(
        path.resolve(__dirname, '../../../scripts/seed.ts'),
        'utf8',
      );
      const modelConfigSeedSource = seedScriptSource.split('// ===== Seed Subscription Plans =====')[0];
      expect(gatewayServiceSource).toContain('onConflictDoNothing');
      expect(modelConfigSeedSource).toContain('onConflictDoNothing');
      expect(gatewayServiceSource).not.toContain('onConflictDoUpdate');
      expect(modelConfigSeedSource).not.toContain('onConflictDoUpdate');
    });

    it('电商工具主路由存在且无 doubao：L2 三能力 → gpt-image-2，详情页 → kimi/gpt-5.6-sol', () => {
      // 2026-08-19 doubao 平台无渠道凭证，已从路由表移除；
      // L2 工具页直接走 pptoken/openai（gpt-image-2），详情页走 kimi → gpt-5.6-sol。
      // 防误删防线：这些能力必须保留可用主路由。
      const routes = SEED_MODEL_ROUTES.filter((r) => r.isActive);
      const hasRoute = (cap: string, model: string, prio: number) =>
        routes.some((r) => r.capabilitySlug === cap && r.modelSlug === model && r.priority === prio);

      for (const l2 of ['background-removal', 'scene-composition', 'model-dressing']) {
        expect(hasRoute(l2, 'gpt-image-2', 1), `${l2} 主路由 gpt-image-2`).toBe(true);
        expect(routes.some((r) => r.capabilitySlug === l2 && r.modelSlug.includes('doubao')), `${l2} 不应残留 doubao 路由`).toBe(false);
      }
      expect(hasRoute('detail-page-generation', 'kimi-k2-5', 1), '详情页主路由 kimi-k2-5').toBe(true);
      expect(hasRoute('detail-page-generation', 'gpt-5.6-sol', 2), '详情页 fallback gpt-5.6-sol').toBe(true);
      expect(routes.some((r) => r.capabilitySlug === 'detail-page-generation' && r.modelSlug.includes('doubao')), '详情页不应残留 doubao 路由').toBe(false);
    });

    it('模型配置迁移不会静默删除现有 Provider', () => {
      const migrationSource = fs.readFileSync(
        path.resolve(__dirname, '../../../../drizzle/0011_model_configuration_chain.sql'),
        'utf8',
      );

      expect(migrationSource).not.toMatch(/DELETE\s+FROM\s+"model_providers"/i);
      expect(migrationSource).toContain('ADD COLUMN IF NOT EXISTS "cost_per_second"');
    });

    it('平台维度迁移 0012 先搬迁数据再删旧表（不丢渠道与密钥）', () => {
      const migrationSource = fs.readFileSync(
        path.resolve(__dirname, '../../../../drizzle/0012_platform_dimension.sql'),
        'utf8',
      );

      expect(migrationSource).toContain('CREATE TABLE IF NOT EXISTS "ai_platforms"');
      expect(migrationSource).toContain('CREATE TABLE IF NOT EXISTS "model_channels"');
      // 数据搬迁逻辑：先插平台/渠道，再 DROP 旧表
      const insertIdx = migrationSource.indexOf('INSERT INTO model_channels');
      const dropIdx = migrationSource.indexOf('DROP TABLE IF EXISTS "model_providers"');
      expect(insertIdx).toBeGreaterThan(-1);
      expect(dropIdx).toBeGreaterThan(insertIdx);
      // key 提升逻辑存在（共享账号 → 平台级）
      expect(migrationSource).toContain('SET base_url');
    });

    it('每个模型至少有一个渠道种子', () => {
      for (const model of SEED_MODELS) {
        expect(SEED_CHANNELS.some((channel) => channel.modelSlug === model.slug)).toBe(true);
      }
    });

    it('每个路由引用存在且支持该能力的模型', () => {
      for (const route of SEED_MODEL_ROUTES) {
        const model = SEED_MODELS.find((candidate) => candidate.slug === route.modelSlug);
        expect(model).toBeDefined();
        expect(model?.capabilities).toContain(route.capabilitySlug);
      }
    });

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

  // ===== pptoken OpenAI 协议集成（gpt-5.6-sol）=====

  describe('pptoken OpenAI 协议集成', () => {
    it('平台种子包含 pptoken', () => {
      expect(SEED_PLATFORMS.some((p) => p.name === 'pptoken')).toBe(true);
    });

    it('gpt-5.6-sol 渠道指向 pptoken 且走 openai 协议', () => {
      const channel = SEED_CHANNELS.find((c) => c.modelSlug === 'gpt-5.6-sol');
      expect(channel).toBeDefined();
      expect(channel!.platformName).toBe('pptoken');
      expect(channel!.sdkClient).toBe('openai');
      expect(channel!.sdkModelId).toBe('gpt-5.6-sol');
      expect(channel!.priority).toBe(1);
    });

    it('text-generation 默认路由为 gpt-5.6-sol（priority 1）', () => {
      const textRoutes = SEED_MODEL_ROUTES.filter((r) => r.capabilitySlug === 'text-generation')
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
      expect(textRoutes[0].modelSlug).toBe('gpt-5.6-sol');
    });

    it('gpt-5.6-sol 模型定义为 LLM 且支持文本生成', () => {
      const model = SEED_MODELS.find((m) => m.slug === 'gpt-5.6-sol');
      expect(model).toBeDefined();
      expect(model!.modality).toBe('llm');
      expect(model!.outputType).toBe('text');
      expect(model!.sdkClient).toBe('openai');
      expect(model!.capabilities).toContain('text-generation');
      expect(model!.capabilities).toContain('detail-page-generation');
    });

    it('gpt-image-2 图片渠道优先走 pptoken（openai 协议，priority 1）', () => {
      const imgChannels = SEED_CHANNELS.filter((c) => c.modelSlug === 'gpt-image-2')
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
      expect(imgChannels[0].platformName).toBe('pptoken');
      expect(imgChannels[0].sdkClient).toBe('openai');
      expect(imgChannels[0].sdkModelId).toBe('gpt-image-2');
      // replicate 渠道保留为备用
      expect(imgChannels.some((c) => c.sdkClient === 'replicate')).toBe(true);
    });

    it('密钥不硬编码进种子（defaultParams/config 无 apiKey/baseUrl）', () => {
      const model = SEED_MODELS.find((m) => m.slug === 'gpt-5.6-sol');
      const params = (model!.defaultParams ?? {}) as Record<string, unknown>;
      expect(params.apiKey).toBeUndefined();
      expect(params.baseUrl).toBeUndefined();

      const channel = SEED_CHANNELS.find((c) => c.modelSlug === 'gpt-5.6-sol');
      const config = (channel!.config ?? {}) as Record<string, unknown>;
      expect(config.apiKey).toBeUndefined();
      expect(config.baseUrl).toBeUndefined();

      const platform = SEED_PLATFORMS.find((p) => p.name === 'pptoken');
      expect(platform!.apiKey).toBeUndefined();
    });
  });

  // ===== Spec 一致性（gateway.spec.yaml 是 SOT，防种子漂移） =====

  describe('Spec 一致性（gateway.spec.yaml = SOT）', () => {
    interface SpecModelSeed { slug: string }
    interface SpecRouteSeed { capabilitySlug: string; modelSlug: string; priority: number }
    interface SpecChannelSeed { platformName: string; modelSlug: string; sdkModelId: string; sdkClient: string; priority: number }

    let spec: Record<string, unknown>;
    let seedData: {
      models: SpecModelSeed[];
      routes: SpecRouteSeed[];
      channels: SpecChannelSeed[];
    };

    beforeAll(() => {
      const specPath = path.resolve(__dirname, '../../../../../specs/gateway.spec.yaml');
      spec = yaml.load(fs.readFileSync(specPath, 'utf8')) as Record<string, unknown>;
      seedData = spec.seed_data as {
        models: SpecModelSeed[];
        routes: SpecRouteSeed[];
        channels: SpecChannelSeed[];
      };
    });

    it('SEED_MODELS 与 spec models 列表一一对应（双向，防再漏模型）', () => {
      const codeSlugs = SEED_MODELS.map((m) => m.slug as string).sort();
      const specSlugs = seedData.models.map((m) => m.slug).sort();
      expect(specSlugs).toEqual(codeSlugs);
    });

    it('SEED_MODEL_ROUTES 与 spec routes 一一对应（capability+model+priority 元组）', () => {
      const codeRoutes = SEED_MODEL_ROUTES
        .map((r) => `${r.capabilitySlug}|${r.modelSlug}|${r.priority}`)
        .sort();
      const specRoutes = seedData.routes
        .map((r) => `${r.capabilitySlug}|${r.modelSlug}|${r.priority}`)
        .sort();
      expect(specRoutes).toEqual(codeRoutes);
    });

    it('SEED_CHANNELS 与 spec channels 一一对应（platform+model+sdkModelId+sdkClient+priority 元组）', () => {
      const codeChannels = SEED_CHANNELS
        .map((c) => `${c.platformName}|${c.modelSlug}|${c.sdkModelId}|${c.sdkClient}|${c.priority}`)
        .sort();
      const specChannels = seedData.channels
        .map((c) => `${c.platformName}|${c.modelSlug}|${c.sdkModelId}|${c.sdkClient}|${c.priority}`)
        .sort();
      expect(specChannels).toEqual(codeChannels);
    });
  });
});
