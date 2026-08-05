import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { tasks } from '../../db/schema/task-engine';
import { aiModels, aiCapabilities, modelProviders } from '../../db/schema/gateway';
import { builtInCapabilityMap } from './capabilities/index';
import { builtInModelMap } from './models/index';
import { routeCapability, getModelsForCapability } from './router/index';
import type { CapabilityDefinition } from './capabilities/index';
import type { ModelDefinition } from './models/index';
import { eq, and, sql } from 'drizzle-orm';
import { TaskExecutionService } from './task-execution.service';
import { BillingService } from '../billing/billing.service';
import { CreateService } from '../create/create.service';
import { StorageService } from '../storage/storage.service';
import { SEED_MODELS, SEED_RECIPES, SEED_MODEL_PROVIDERS } from './seeds/model-seeds';
import type { AdapterModel } from './adapters/protocol-adapter.interface';

// ===== Gateway Types =====
export interface GenerationTaskResponse {
  taskId: string;
  createId: string;
  capabilitySlug: string;
  modelSlug: string;
  status: 'queued' | 'submitting' | 'completing' | 'completed' | 'failed';
  createdAt: string;
  estimatedCompletionAt?: string;
}

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);

  constructor(
    @Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>,
    @Inject('TASK_EXECUTION_SERVICE') private readonly taskExecution: TaskExecutionService,
    @Inject('BILLING_SERVICE') private readonly billingService: BillingService,
    @Inject('CREATE_SERVICE') private readonly createService: CreateService,
    @Inject('STORAGE_SERVICE') private readonly storageService: StorageService,
  ) {}

  // ===== Seed =====

  async seedModels(): Promise<void> {
    // Per-slug idempotent seeding (supports incremental model additions)
    let insertedCount = 0;
    for (const model of SEED_MODELS) {
      const [existing] = await this.db.select().from(aiModels).where(eq(aiModels.slug, model.slug as string)).limit(1);
      if (!existing) {
        await this.db.insert(aiModels).values(model);
        insertedCount++;
      }
    }
    if (insertedCount > 0) {
      this.logger.log(`已初始化 ${insertedCount} 个 AI 模型种子数据`);
    }

    // Seed model providers (idempotent per modelSlug + providerName)
    let providerCount = 0;
    for (const provider of SEED_MODEL_PROVIDERS) {
      const [existing] = await this.db
        .select()
        .from(modelProviders)
        .where(
          and(
            eq(modelProviders.modelSlug, provider.modelSlug as string),
            eq(modelProviders.providerName, provider.providerName as string),
          ),
        )
        .limit(1);
      if (!existing) {
        await this.db.insert(modelProviders).values(provider);
        providerCount++;
      }
    }
    if (providerCount > 0) {
      this.logger.log(`已初始化 ${providerCount} 个 Model Provider 渠道数据`);
    }
  }

  // ===== Capabilities =====

  listCapabilities(): CapabilityDefinition[] {
    return Array.from(builtInCapabilityMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  getCapability(slug: string): CapabilityDefinition | null {
    return builtInCapabilityMap.get(slug) ?? null;
  }

  getModelsForCapability(capabilitySlug: string): ModelDefinition[] {
    return Array.from(builtInModelMap.values())
      .filter((m) => m.capabilities.includes(capabilitySlug))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // ===== Models (DB-backed with in-memory fallback) =====

  async listModels(capability?: string): Promise<AdapterModel[]> {
    try {
      let query = this.db.select().from(aiModels).where(eq(aiModels.isActive, true));
      let rows;

      if (capability) {
        rows = await this.db
          .select()
          .from(aiModels)
          .where(and(eq(aiModels.isActive, true), sql`${aiModels.capabilities} @> ARRAY[${capability}]::text[]`));
      } else {
        rows = await this.db.select().from(aiModels).where(eq(aiModels.isActive, true));
      }

      if (rows.length === 0) {
        // Fallback to in-memory
        return this.listModelsFromMemory(capability);
      }

      return rows
        .sort((a: typeof aiModels.$inferSelect, b: typeof aiModels.$inferSelect) => a.sortOrder - b.sortOrder)
        .map((r: typeof aiModels.$inferSelect) => this.toAdapterModel(r));
    } catch (e) {
      this.logger.warn(`DB query failed, falling back to in-memory: ${(e as Error).message}`);
      return this.listModelsFromMemory(capability);
    }
  }

  async getModel(slug: string): Promise<AdapterModel | null> {
    try {
      const [row] = await this.db.select().from(aiModels).where(eq(aiModels.slug, slug)).limit(1);
      if (row) {
        return this.toAdapterModel(row);
      }
    } catch {
      // fall through to in-memory
    }

    // Fallback
    const model = builtInModelMap.get(slug);
    return model ? this.modelDefToAdapterModel(model) : null;
  }

  async getDefaultModel(capabilitySlug: string): Promise<AdapterModel | null> {
    const models = await this.listModels(capabilitySlug);
    return models[0] ?? null;
  }

  private listModelsFromMemory(capability?: string): AdapterModel[] {
    const models = Array.from(builtInModelMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);
    const filtered = capability
      ? models.filter((m) => m.capabilities.includes(capability))
      : models;
    return filtered.map((m) => this.modelDefToAdapterModel(m));
  }

  private toAdapterModel(row: typeof aiModels.$inferSelect): AdapterModel {
    return {
      slug: row.slug,
      name: row.name,
      sdkModelId: row.sdkModelId,
      modality: row.modality as AdapterModel['modality'],
      outputType: row.outputType,
      providerName: row.providerName,
      sdkClient: row.sdkClient,
      constraints: row.constraints as Record<string, unknown>,
      defaultParams: row.defaultParams as Record<string, unknown>,
      costCredits: row.costCredits,
      sortOrder: row.sortOrder,
    };
  }

  private modelDefToAdapterModel(m: ModelDefinition): AdapterModel {
    // Derive modality from outputTypes
    const modality: AdapterModel['modality'] =
      m.outputTypes.includes('video') ? 'video' :
      m.outputTypes.includes('image') ? 'image' : 'llm';

    // Use slug as sdkModelId for in-memory fallback (old slugs ARE the SDK model IDs)
    return {
      slug: m.slug,
      name: m.name,
      sdkModelId: m.slug,
      modality,
      outputType: m.outputTypes[0] || 'text',
      providerName: 'coze',
      sdkClient: modality,
      constraints: m.config,
      defaultParams: {},
      costCredits: 1,
      sortOrder: m.sortOrder,
    };
  }

  // ===== Input Media Resolution (fileId → URL, at system boundary) =====

  /**
   * Resolve fileId references in input to URLs before passing to AI adapter.
   * Supports both new format ({ fileId: "uuid" }) and legacy format (plain URL strings).
   *
   * Array fields: images, referenceImages, referenceVideos, referenceAudios
   * Single fields: firstFrame, lastFrame, referenceImage, imageUrl
   */
  private async resolveInputForAdapter(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const resolved = { ...input };

    // Collect all fileIds to resolve in batch
    const fileIds: string[] = [];

    const arrayFields = ['images', 'referenceImages', 'referenceVideos', 'referenceAudios'];
    for (const field of arrayFields) {
      const val = resolved[field];
      if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === 'object' && item !== null && 'fileId' in item) {
            fileIds.push((item as { fileId: string }).fileId);
          }
        }
      }
    }

    const singleFields = ['firstFrame', 'lastFrame', 'referenceImage', 'imageUrl'];
    for (const field of singleFields) {
      const val = resolved[field];
      if (typeof val === 'object' && val !== null && 'fileId' in val) {
        fileIds.push((val as { fileId: string }).fileId);
      }
    }

    if (fileIds.length === 0) return resolved;

    // Batch resolve
    const urlMap = await this.storageService.resolveUrls(fileIds);

    // Replace in resolved input
    for (const field of arrayFields) {
      const val = resolved[field];
      if (Array.isArray(val)) {
        resolved[field] = val
          .map((item) => {
            if (typeof item === 'object' && item !== null && 'fileId' in item) {
              return urlMap.get((item as { fileId: string }).fileId) ?? null;
            }
            return item; // already a string URL (legacy)
          })
          .filter((v) => v !== null);
      }
    }

    for (const field of singleFields) {
      const val = resolved[field];
      if (typeof val === 'object' && val !== null && 'fileId' in val) {
        resolved[field] = urlMap.get((val as { fileId: string }).fileId) ?? null;
      }
    }

    // Convert relative URLs to absolute for external AI API consumption
    const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT;
    if (domain) {
      const toAbsolute = (url: unknown): unknown => {
        if (typeof url === 'string' && url.startsWith('/')) {
          return `${domain}${url}`;
        }
        return url;
      };
      for (const field of [...arrayFields, ...singleFields]) {
        if (Array.isArray(resolved[field])) {
          resolved[field] = (resolved[field] as unknown[]).map(toAbsolute);
        } else {
          resolved[field] = toAbsolute(resolved[field]);
        }
      }
    }

    return resolved;
  }

  // ===== Generation =====

  async submitGeneration(
    userId: string,
    projectId: string,
    capabilitySlug: string,
    input: Record<string, unknown>,
    preferredModel?: string,
    sourceCreateId?: string,
  ): Promise<GenerationTaskResponse> {
    // Validate capability
    const capability = builtInCapabilityMap.get(capabilitySlug);
    if (!capability) {
      throw new NotFoundException(`能力 "${capabilitySlug}" 不存在`);
    }

    // Get model (from DB or in-memory)
    let model: AdapterModel;
    if (preferredModel) {
      // Check if preferredModel supports this capability via in-memory router
      const route = routeCapability(capabilitySlug, preferredModel);
      if (route && route.modelSlug === preferredModel) {
        // Preferred model supports this capability
        const found = await this.getModel(preferredModel);
        if (found) {
          model = found;
        } else {
          const memModel = builtInModelMap.get(preferredModel);
          if (!memModel) {
            throw new BadRequestException(`模型 "${preferredModel}" 不存在`);
          }
          model = this.modelDefToAdapterModel(memModel);
        }
      } else {
        // Preferred model doesn't support this capability, fallback to default
        const defaultRoute = routeCapability(capabilitySlug);
        if (!defaultRoute) {
          throw new BadRequestException(`能力 "${capabilitySlug}" 没有可用的模型`);
        }
        const found = await this.getModel(defaultRoute.modelSlug);
        if (found) {
          model = found;
        } else {
          const memModel = builtInModelMap.get(defaultRoute.modelSlug);
          if (!memModel) {
            throw new BadRequestException(`模型 "${defaultRoute.modelSlug}" 不存在`);
          }
          model = this.modelDefToAdapterModel(memModel);
        }
      }
    } else {
      // Route via in-memory router, then resolve to AdapterModel
      const route = routeCapability(capabilitySlug);
      if (!route) {
        throw new BadRequestException(`能力 "${capabilitySlug}" 没有可用的模型`);
      }
      const found = await this.getModel(route.modelSlug);
      if (!found) {
        // Use in-memory definition
        const memModel = builtInModelMap.get(route.modelSlug);
        if (!memModel) {
          throw new BadRequestException(`模型 "${route.modelSlug}" 不存在`);
        }
        model = this.modelDefToAdapterModel(memModel);
      } else {
        model = found;
      }
    }

    // Credit pre-deduction (reserve)
    const reserved = await this.billingService.reserveCredits(
      userId,
      null,
      model.costCredits,
      `任务预扣: ${model.name}`,
    );
    if (!reserved) {
      throw new BadRequestException('信用额度不足');
    }

    // Create Create record (user's creative intent) — stores original input with fileIds
    const prompt = (input.prompt as string) || JSON.stringify(input);
    const { id: createId } = await this.createService.createCreate({
      projectId,
      userId,
      capabilitySlug,
      prompt,
      input,
      modelSlug: model.slug,
      sourceCreateId: sourceCreateId ?? null,
    });

    // Resolve fileId references to URLs for adapter consumption (boundary: system → external API)
    const resolvedInput = await this.resolveInputForAdapter(input);

    // Create task record linked to the Create
    const taskId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 min timeout

    try {
      await this.db.insert(tasks).values({
        id: taskId,
        createId,
        projectId,
        userId,
        type: capabilitySlug,
        capabilitySlug,
        modelSlug: model.slug,
        input, // store original input with fileIds
        status: 'queued',
        creditsCost: model.costCredits,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      } as any);

      // Update Create status to processing + increment task count
      await this.createService.updateStatus(createId, 'processing' as any);
      await this.createService.incrementTaskCount(createId);
    } catch (error) {
      this.logger.error(`Failed to create task: ${error}`);
      // Refund if task creation failed
      await this.billingService.refundCredits(userId, null, model.costCredits, '任务创建失败退款');
      await this.createService.updateStatus(createId, 'failed' as any, { errorMessage: '任务创建失败' });
      throw new BadRequestException('任务创建失败');
    }

    this.logger.log(`Generation task ${taskId}: ${capabilitySlug} → ${model.slug} (credits: ${model.costCredits})`);

    // Trigger async execution with resolved input (URLs, not fileIds)
    this.taskExecution.executeTask(taskId, userId, capabilitySlug, resolvedInput, model).catch((err) => {
      this.logger.error(`Async execution failed for task ${taskId}: ${err.message}`);
    });

    return {
      taskId,
      createId,
      status: 'queued',
      capabilitySlug,
      modelSlug: model.slug,
      createdAt: now.toISOString(),
      estimatedCompletionAt: expiresAt.toISOString(),
    };
  }

  // ===== Quick Create =====

  async quickCreate(
    userId: string,
    projectId: string,
    recipeId: string,
    input?: Record<string, unknown>,
  ): Promise<GenerationTaskResponse> {
    const recipe = SEED_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) {
      throw new NotFoundException(`快捷创作方案 "${recipeId}" 不存在`);
    }

    // Merge default input with user input
    const mergedInput = { ...recipe.defaultInput, ...input };

    return this.submitGeneration(userId, projectId, recipe.capabilitySlug, mergedInput, recipe.modelSlug);
  }

  // ===== Task Query =====

  async getTask(taskId: string): Promise<Record<string, unknown> | null> {
    try {
      const [task] = await this.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, taskId))
        .limit(1);

      if (!task) return null;

      return {
        id: task.id,
        status: task.status,
        capabilitySlug: task.capabilitySlug ?? task.type,
        modelSlug: task.modelSlug,
        input: task.input,
        output: task.output,
        errorMessage: task.errorMessage,
        creditsCost: task.creditsCost,
        startedAt: task.startedAt?.toISOString() ?? null,
        completedAt: task.completedAt?.toISOString() ?? null,
        createdAt: task.createdAt.toISOString(),
      };
    } catch {
      return null;
    }
  }

  // ===== Recipes =====

  listRecipes() {
    return [...SEED_RECIPES].sort((a, b) => a.sortOrder - b.sortOrder);
  }
}
