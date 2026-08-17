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
import { aiModels, capabilityModelRoutes, modelProviders } from '../../db/schema/gateway';
import { builtInCapabilities, builtInCapabilityMap } from './capabilities';
import type {
  CreateModelInput,
  CreateProviderInput,
  UpdateModelInput,
  UpdateProviderInput,
} from './dto/model-config';

const sensitiveKeyPattern = /(api[-_]?key|token|secret|password|authorization|credential)/i;
const supportedSdkClients = ['llm', 'image', 'video', 'replicate'] as const;
type SupportedSdkClient = typeof supportedSdkClients[number];

function isSupportedSdkClient(value: string): value is SupportedSdkClient {
  return supportedSdkClients.some((client) => client === value);
}

function omitSensitiveConfig(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitSensitiveConfig);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !sensitiveKeyPattern.test(key))
      .map(([key, nested]) => [key, omitSensitiveConfig(nested)]),
  );
}

function sanitizeProvider<T extends { config: unknown }>(provider: T): Omit<T, 'config'> & {
  config: Record<string, unknown>;
} {
  return {
    ...provider,
    config: omitSensitiveConfig(provider.config) as Record<string, unknown>,
  };
}

@Injectable()
export class ModelConfigService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async getConfiguration() {
    const [models, providers, routes] = await Promise.all([
      this.db.select().from(aiModels).orderBy(asc(aiModels.sortOrder), asc(aiModels.slug)),
      this.db.select().from(modelProviders).orderBy(asc(modelProviders.modelSlug), asc(modelProviders.priority)),
      this.db.select().from(capabilityModelRoutes).orderBy(
        asc(capabilityModelRoutes.capabilitySlug),
        asc(capabilityModelRoutes.priority),
      ),
    ]);

    return {
      models,
      providers: providers.map(sanitizeProvider),
      routes,
      capabilities: [...builtInCapabilities].sort((a, b) => a.sortOrder - b.sortOrder),
    };
  }

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

    const [updated] = await this.db
      .update(aiModels)
      .set({ ...input, updatedAt: new Date() })
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

  async createProvider(input: CreateProviderInput) {
    await this.requireModel(input.modelSlug);
    await this.assertProviderIdentityAvailable(input);

    const [created] = await this.db.insert(modelProviders).values({
      ...input,
      costPerCall: input.costPerCall == null ? null : String(input.costPerCall),
      costPerSecond: input.costPerSecond == null ? null : String(input.costPerSecond),
    }).returning();
    return sanitizeProvider(created);
  }

  async updateProvider(id: string, input: UpdateProviderInput) {
    const provider = await this.requireProvider(id);
    const sdkClient = input.sdkClient ?? provider.sdkClient;
    if (!isSupportedSdkClient(sdkClient)) {
      throw new UnprocessableEntityException(`不支持的 SDK 客户端 "${sdkClient}"`);
    }
    const identity = {
      modelSlug: provider.modelSlug,
      providerName: input.providerName ?? provider.providerName,
      sdkClient,
      sdkModelId: input.sdkModelId ?? provider.sdkModelId,
    };
    await this.assertProviderIdentityAvailable(identity, id);

    const { costPerCall, costPerSecond, ...editableFields } = input;
    const values = {
      ...editableFields,
      ...(costPerCall !== undefined && {
        costPerCall: costPerCall == null ? null : String(costPerCall),
      }),
      ...(costPerSecond !== undefined && {
        costPerSecond: costPerSecond == null ? null : String(costPerSecond),
      }),
      updatedAt: new Date(),
    };
    const [updated] = await this.db
      .update(modelProviders)
      .set(values)
      .where(eq(modelProviders.id, id))
      .returning();
    return sanitizeProvider(updated);
  }

  async setProviderStatus(id: string, isActive: boolean) {
    await this.requireProvider(id);
    const [updated] = await this.db
      .update(modelProviders)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(modelProviders.id, id))
      .returning();
    return sanitizeProvider(updated);
  }

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

  private async requireProvider(id: string) {
    const [provider] = await this.db
      .select()
      .from(modelProviders)
      .where(eq(modelProviders.id, id))
      .limit(1);
    if (!provider) throw new NotFoundException(`Provider "${id}" 不存在`);
    return provider;
  }

  private async assertProviderIdentityAvailable(
    identity: Pick<CreateProviderInput, 'modelSlug' | 'providerName' | 'sdkClient' | 'sdkModelId'>,
    excludeId?: string,
  ): Promise<void> {
    const conditions = [
      eq(modelProviders.modelSlug, identity.modelSlug),
      eq(modelProviders.providerName, identity.providerName),
      eq(modelProviders.sdkClient, identity.sdkClient),
      eq(modelProviders.sdkModelId, identity.sdkModelId),
    ];
    if (excludeId) conditions.push(ne(modelProviders.id, excludeId));

    const [duplicate] = await this.db
      .select({ id: modelProviders.id })
      .from(modelProviders)
      .where(and(...conditions))
      .limit(1);
    if (duplicate) throw new ConflictException('Provider 组合标识已存在');
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
