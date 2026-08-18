import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../../common/drizzle.constants';
import * as schema from '../../db/schema';
import { aiModels, aiPlatforms, capabilityModelRoutes, modelChannels } from '../../db/schema/gateway';
import { builtInCapabilities, builtInCapabilityMap } from './capabilities';
import type {
  CreateChannelInput,
  CreateModelInput,
  CreatePlatformInput,
  UpdateChannelInput,
  UpdateModelInput,
  UpdatePlatformInput,
} from './dto/model-config';

const sensitiveKeyPattern = /(api[-_]?key|token|secret|password|authorization|credential)/i;

function omitSensitiveConfig(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitSensitiveConfig);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !sensitiveKeyPattern.test(key))
      .map(([key, nested]) => [key, omitSensitiveConfig(nested)]),
  );
}

function hasApiKeyConfigured(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const apiKey = (value as Record<string, unknown>).apiKey;
  return typeof apiKey === 'string' && apiKey.trim().length > 0;
}

function sanitizeChannel<T extends { config: unknown }>(channel: T): Omit<T, 'config'> & {
  config: Record<string, unknown>;
  apiKeyConfigured: boolean;
} {
  return {
    ...channel,
    config: omitSensitiveConfig(channel.config) as Record<string, unknown>,
    apiKeyConfigured: hasApiKeyConfigured(channel.config),
  };
}

function sanitizePlatform<T extends { apiKey: string | null }>(platform: T): Omit<T, 'apiKey'> & {
  apiKeyConfigured: boolean;
} {
  const { apiKey, ...rest } = platform;
  return {
    ...rest,
    apiKeyConfigured: typeof apiKey === 'string' && apiKey.trim().length > 0,
  };
}

@Injectable()
export class ModelConfigService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async getConfiguration() {
    const [models, platforms, channelsRows, routes] = await Promise.all([
      this.db.select().from(aiModels).orderBy(asc(aiModels.sortOrder), asc(aiModels.slug)),
      this.db.select().from(aiPlatforms).orderBy(asc(aiPlatforms.name)),
      this.db
        .select({ channel: modelChannels, platformName: aiPlatforms.name })
        .from(modelChannels)
        .innerJoin(aiPlatforms, eq(modelChannels.platformId, aiPlatforms.id))
        .orderBy(asc(aiPlatforms.name), asc(modelChannels.modelSlug), asc(modelChannels.priority)),
      this.db.select().from(capabilityModelRoutes).orderBy(
        asc(capabilityModelRoutes.capabilitySlug),
        asc(capabilityModelRoutes.priority),
      ),
    ]);

    return {
      models: models.map((m) => ({
        ...m,
        defaultParams: omitSensitiveConfig(m.defaultParams) as Record<string, unknown>,
      })),
      platforms: platforms.map(sanitizePlatform),
      channels: channelsRows.map(({ channel, platformName }) => ({
        ...sanitizeChannel(channel),
        platformName,
      })),
      routes,
      capabilities: [...builtInCapabilities].sort((a, b) => a.sortOrder - b.sortOrder),
    };
  }

  // ===== 模型 =====

  async createModel(input: CreateModelInput) {
    const [existing] = await this.db
      .select({ id: aiModels.id })
      .from(aiModels)
      .where(eq(aiModels.slug, input.slug))
      .limit(1);
    if (existing) throw new ConflictException('模型 slug 已存在');

    this.assertCapabilitiesExist(input.capabilities);
    const [created] = await this.db.insert(aiModels).values({
      ...input,
      providerName: 'unconfigured',
      sdkModelId: input.slug,
      sdkClient: input.modality,
    }).returning();
    return created;
  }

  async updateModel(slug: string, input: UpdateModelInput) {
    const model = await this.requireModel(slug);
    if (input.capabilities) {
      this.assertCapabilitiesExist(input.capabilities);
      const activeRoutes = await this.db
        .select({ capabilitySlug: capabilityModelRoutes.capabilitySlug })
        .from(capabilityModelRoutes)
        .where(and(
          eq(capabilityModelRoutes.modelSlug, slug),
          eq(capabilityModelRoutes.isActive, true),
        ));
      const incompatible = activeRoutes.find((route) => !input.capabilities?.includes(route.capabilitySlug));
      if (incompatible) {
        throw new UnprocessableEntityException(
          `模型仍用于能力 "${incompatible.capabilitySlug}" 的路由，请先调整路由`,
        );
      }
    }

    // defaultParams 合并语义：只覆盖传入字段，保留模型已有业务参数。
    // 模型不再参与 key 配置，key 只存平台/渠道两级。
    const mergedDefaultParams = input.defaultParams
      ? { ...(model.defaultParams ?? {}), ...input.defaultParams }
      : undefined;

    const [updated] = await this.db
      .update(aiModels)
      .set({
        ...input,
        ...(mergedDefaultParams !== undefined && { defaultParams: mergedDefaultParams }),
        updatedAt: new Date(),
      })
      .where(eq(aiModels.slug, model.slug))
      .returning();
    return updated;
  }

  async setModelStatus(slug: string, isActive: boolean) {
    const model = await this.requireModel(slug);
    if (!isActive && model.isActive) await this.assertDefaultRoutesRemainAvailable(slug);

    const [updated] = await this.db
      .update(aiModels)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(aiModels.slug, slug))
      .returning();
    return updated;
  }

  // ===== 平台（ai_platforms）=====

  async createPlatform(input: CreatePlatformInput) {
    await this.assertPlatformNameAvailable(input.name);

    const [created] = await this.db.insert(aiPlatforms).values({
      name: input.name,
      ...(input.baseUrl ? { baseUrl: input.baseUrl } : {}),
      ...(input.apiKey ? { apiKey: input.apiKey } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    }).returning();
    return sanitizePlatform(created);
  }

  async updatePlatform(id: string, input: UpdatePlatformInput) {
    const platform = await this.requirePlatform(id);
    if (input.name && input.name !== platform.name) {
      await this.assertPlatformNameAvailable(input.name);
    }

    // 合并语义：baseUrl/apiKey 留空不传即保留旧值（无法回显 key，空串视为不修改）
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) values.name = input.name;
    if (input.baseUrl !== undefined && input.baseUrl.trim() !== '') values.baseUrl = input.baseUrl;
    if (input.apiKey !== undefined && input.apiKey.trim() !== '') values.apiKey = input.apiKey;
    if (input.isActive !== undefined) values.isActive = input.isActive;

    const [updated] = await this.db
      .update(aiPlatforms)
      .set(values)
      .where(eq(aiPlatforms.id, id))
      .returning();
    return sanitizePlatform(updated);
  }

  async setPlatformStatus(id: string, isActive: boolean) {
    await this.requirePlatform(id);
    const [updated] = await this.db
      .update(aiPlatforms)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(aiPlatforms.id, id))
      .returning();
    return sanitizePlatform(updated);
  }

  async deletePlatform(id: string) {
    const platform = await this.requirePlatform(id);
    // 渠道随平台级联删除（FK ON DELETE CASCADE）
    await this.db.delete(aiPlatforms).where(eq(aiPlatforms.id, id));
    return platform;
  }

  // ===== 渠道（model_channels）=====

  async createChannel(input: CreateChannelInput) {
    await this.requirePlatform(input.platformId);
    await this.requireModel(input.modelSlug);
    await this.assertChannelIdentityAvailable({
      platformId: input.platformId,
      modelSlug: input.modelSlug,
      sdkModelId: input.sdkModelId,
    });

    // copyFromId：复制同平台已有渠道的完整 config（含 apiKey），前端无需重新填写密钥。
    // 前端显式传入的 config 字段可覆盖复制的值。
    const { copyFromId, config: inputConfig, ...rest } = input;
    let config = inputConfig;
    if (copyFromId) {
      const source = await this.requireChannel(copyFromId);
      config = { ...(source.config ?? {}), ...(inputConfig ?? {}) };
    }

    const [created] = await this.db.insert(modelChannels).values({
      ...rest,
      ...(config !== undefined && { config }),
      priority: input.priority ?? 1,
      costPerCall: input.costPerCall == null ? null : String(input.costPerCall),
      costPerSecond: input.costPerSecond == null ? null : String(input.costPerSecond),
    }).returning();
    const platform = await this.requirePlatform(input.platformId);
    return { ...sanitizeChannel(created), platformName: platform.name };
  }

  async updateChannel(id: string, input: UpdateChannelInput) {
    const channel = await this.requireChannel(id);
    const platformId = input.platformId ?? channel.platformId;
    const sdkModelId = input.sdkModelId ?? channel.sdkModelId;
    if (platformId !== channel.platformId || sdkModelId !== channel.sdkModelId) {
      await this.assertChannelIdentityAvailable(
        { platformId, modelSlug: channel.modelSlug, sdkModelId },
        id,
      );
    }

    // config 合并语义：只覆盖传入字段，保留渠道已有配置（含 apiKey）。
    const mergedConfig = input.config
      ? { ...(channel.config ?? {}), ...input.config }
      : undefined;
    const values: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    for (const key of ['platformId', 'sdkClient', 'sdkModelId', 'priority'] as const) {
      if (input[key] !== undefined) values[key] = input[key];
    }
    if (input.isActive !== undefined) values.isActive = input.isActive;
    if (mergedConfig !== undefined) values.config = mergedConfig;
    if (input.costPerCall !== undefined) {
      values.costPerCall = input.costPerCall == null ? null : String(input.costPerCall);
    }
    if (input.costPerSecond !== undefined) {
      values.costPerSecond = input.costPerSecond == null ? null : String(input.costPerSecond);
    }

    const [updated] = await this.db
      .update(modelChannels)
      .set(values)
      .where(eq(modelChannels.id, id))
      .returning();
    const platform = await this.requirePlatform(platformId);
    return { ...sanitizeChannel(updated), platformName: platform.name };
  }

  async setChannelStatus(id: string, isActive: boolean) {
    await this.requireChannel(id);
    const [updated] = await this.db
      .update(modelChannels)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(modelChannels.id, id))
      .returning();
    return sanitizeChannel(updated);
  }

  async deleteChannel(id: string) {
    const channel = await this.requireChannel(id);
    await this.db.delete(modelChannels).where(eq(modelChannels.id, id));
    return channel;
  }

  // ===== 能力路由 =====

  async replaceCapabilityRoutes(capabilitySlug: string, modelSlugs: string[]) {
    if (!builtInCapabilityMap.has(capabilitySlug)) {
      throw new NotFoundException(`能力 "${capabilitySlug}" 不存在`);
    }
    if (modelSlugs.length === 0 || new Set(modelSlugs).size !== modelSlugs.length) {
      throw new UnprocessableEntityException('路由配置无效');
    }

    const models = await this.db
      .select()
      .from(aiModels)
      .where(inArray(aiModels.slug, modelSlugs));
    const modelsBySlug = new Map(models.map((model) => [model.slug, model]));
    const invalidSlug = modelSlugs.find((slug) => {
      const model = modelsBySlug.get(slug);
      return !model || !model.isActive || !(model.capabilities ?? []).includes(capabilitySlug);
    });
    if (invalidSlug) {
      throw new UnprocessableEntityException(
        `模型 "${invalidSlug}" 不存在、已停用或不支持能力 "${capabilitySlug}"`,
      );
    }

    const routes = modelSlugs.map((modelSlug, index) => ({
      capabilitySlug,
      modelSlug,
      priority: index + 1,
      isActive: true,
    }));

    await this.db.transaction(async (tx) => {
      await tx.update(capabilityModelRoutes)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(capabilityModelRoutes.capabilitySlug, capabilitySlug));
      await tx.insert(capabilityModelRoutes)
        .values(routes)
        .onConflictDoUpdate({
          target: [capabilityModelRoutes.capabilitySlug, capabilityModelRoutes.modelSlug],
          set: {
            priority: sql`excluded.priority`,
            isActive: true,
            updatedAt: new Date(),
          },
        });
    });

    return routes;
  }

  // ===== 私有辅助 =====

  private assertCapabilitiesExist(capabilitySlugs: string[]): void {
    const invalid = capabilitySlugs.find((slug) => !builtInCapabilityMap.has(slug));
    if (invalid) throw new UnprocessableEntityException(`能力 "${invalid}" 不存在`);
  }

  private async requireModel(slug: string) {
    const [model] = await this.db
      .select()
      .from(aiModels)
      .where(eq(aiModels.slug, slug))
      .limit(1);
    if (!model) throw new NotFoundException(`模型 "${slug}" 不存在`);
    return model;
  }

  private async requirePlatform(id: string) {
    const [platform] = await this.db
      .select()
      .from(aiPlatforms)
      .where(eq(aiPlatforms.id, id))
      .limit(1);
    if (!platform) throw new NotFoundException(`平台 "${id}" 不存在`);
    return platform;
  }

  private async requireChannel(id: string) {
    const [channel] = await this.db
      .select()
      .from(modelChannels)
      .where(eq(modelChannels.id, id))
      .limit(1);
    if (!channel) throw new NotFoundException(`渠道 "${id}" 不存在`);
    return channel;
  }

  private async assertPlatformNameAvailable(name: string): Promise<void> {
    const [duplicate] = await this.db
      .select({ id: aiPlatforms.id })
      .from(aiPlatforms)
      .where(eq(aiPlatforms.name, name))
      .limit(1);
    if (duplicate) throw new ConflictException('平台名称已存在');
  }

  private async assertChannelIdentityAvailable(
    identity: Pick<CreateChannelInput, 'platformId' | 'modelSlug' | 'sdkModelId'>,
    excludeId?: string,
  ): Promise<void> {
    const conditions = [
      eq(modelChannels.platformId, identity.platformId),
      eq(modelChannels.modelSlug, identity.modelSlug),
      eq(modelChannels.sdkModelId, identity.sdkModelId),
    ];
    if (excludeId) conditions.push(ne(modelChannels.id, excludeId));

    const [duplicate] = await this.db
      .select({ id: modelChannels.id })
      .from(modelChannels)
      .where(and(...conditions))
      .limit(1);
    if (duplicate) throw new ConflictException('渠道组合标识（平台 × 模型 × sdkModelId）已存在');
  }

  private async assertDefaultRoutesRemainAvailable(modelSlug: string): Promise<void> {
    const routes = await this.db
      .select({ capabilitySlug: capabilityModelRoutes.capabilitySlug })
      .from(capabilityModelRoutes)
      .where(and(
        eq(capabilityModelRoutes.modelSlug, modelSlug),
        eq(capabilityModelRoutes.isActive, true),
      ));

    for (const capabilitySlug of new Set(routes.map((route) => route.capabilitySlug))) {
      const [alternative] = await this.db
        .select({ modelSlug: capabilityModelRoutes.modelSlug })
        .from(capabilityModelRoutes)
        .innerJoin(aiModels, eq(capabilityModelRoutes.modelSlug, aiModels.slug))
        .where(and(
          eq(capabilityModelRoutes.capabilitySlug, capabilitySlug),
          eq(capabilityModelRoutes.isActive, true),
          eq(aiModels.isActive, true),
          sql`${aiModels.capabilities} @> ARRAY[${capabilitySlug}]::text[]`,
          ne(capabilityModelRoutes.modelSlug, modelSlug),
        ))
        .limit(1);
      if (!alternative) throw new ConflictException('请先配置替代默认模型');
    }
  }
}
