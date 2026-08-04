import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DrizzleService } from '../../common/drizzle.service';
import { tasks } from '../../db/schema/task-engine';
import { aiModels, aiCapabilities } from '../../db/schema/gateway';
import { builtInCapabilityMap } from './capabilities/index';
import { builtInModelMap } from './models/index';
import { routeCapability, getModelsForCapability } from './router/index';
import type { CapabilityDefinition } from './capabilities/index';
import type { ModelDefinition } from './models/index';
import { eq, and, sql } from 'drizzle-orm';
import { TaskExecutionService } from './task-execution.service';
import { BillingService } from '../billing/billing.service';
import { SEED_MODELS, SEED_RECIPES } from './seeds/model-seeds';
import type { AdapterModel } from './adapters/protocol-adapter.interface';

// ===== Gateway Types =====
export interface GenerationTaskResponse {
  taskId: string;
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
    private readonly drizzle: DrizzleService,
    private readonly taskExecution: TaskExecutionService,
    private readonly billingService: BillingService,
  ) {}

  // ===== Seed =====

  async seedModels(): Promise<void> {
    const existing = await this.drizzle.db.select().from(aiModels).limit(1);
    if (existing.length > 0) {
      this.logger.log('AI 模型种子数据已存在，跳过');
      return;
    }

    for (const model of SEED_MODELS) {
      await this.drizzle.db.insert(aiModels).values(model);
    }
    this.logger.log(`已初始化 ${SEED_MODELS.length} 个 AI 模型种子数据`);
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
      let query = this.drizzle.db.select().from(aiModels).where(eq(aiModels.isActive, true));
      let rows;

      if (capability) {
        rows = await this.drizzle.db
          .select()
          .from(aiModels)
          .where(and(eq(aiModels.isActive, true), sql`${aiModels.capabilities} @> ARRAY[${capability}]::text[]`));
      } else {
        rows = await this.drizzle.db.select().from(aiModels).where(eq(aiModels.isActive, true));
      }

      if (rows.length === 0) {
        // Fallback to in-memory
        return this.listModelsFromMemory(capability);
      }

      return rows
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((r) => this.toAdapterModel(r));
    } catch (e) {
      this.logger.warn(`DB query failed, falling back to in-memory: ${(e as Error).message}`);
      return this.listModelsFromMemory(capability);
    }
  }

  async getModel(slug: string): Promise<AdapterModel | null> {
    try {
      const [row] = await this.drizzle.db.select().from(aiModels).where(eq(aiModels.slug, slug)).limit(1);
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
      constraints: m.config,
      defaultParams: {},
      costCredits: 1,
      sortOrder: m.sortOrder,
    };
  }

  // ===== Generation =====

  async submitGeneration(
    userId: string,
    capabilitySlug: string,
    input: Record<string, unknown>,
    preferredModel?: string,
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
      'pending',
      model.costCredits,
      `任务预扣: ${model.name}`,
    );
    if (!reserved) {
      throw new BadRequestException('信用额度不足');
    }

    // Create task record in unified tasks table
    const taskId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 min timeout

    try {
      await this.drizzle.db.insert(tasks).values({
        id: taskId,
        userId,
        type: capabilitySlug,
        capabilitySlug,
        modelSlug: model.slug,
        input,
        status: 'queued',
        creditsCost: model.costCredits,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      } as any);
    } catch (error) {
      this.logger.error(`Failed to create task: ${error}`);
      // Refund if task creation failed
      await this.billingService.refundCredits(userId, 'pending', model.costCredits, '任务创建失败退款');
      throw new BadRequestException('任务创建失败');
    }

    this.logger.log(`Generation task ${taskId}: ${capabilitySlug} → ${model.slug} (credits: ${model.costCredits})`);

    // Trigger async execution
    this.taskExecution.executeTask(taskId, userId, capabilitySlug, input, model).catch((err) => {
      this.logger.error(`Async execution failed for task ${taskId}: ${err.message}`);
    });

    return {
      taskId,
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
    recipeId: string,
    input?: Record<string, unknown>,
  ): Promise<GenerationTaskResponse> {
    const recipe = SEED_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) {
      throw new NotFoundException(`快捷创作方案 "${recipeId}" 不存在`);
    }

    // Merge default input with user input
    const mergedInput = { ...recipe.defaultInput, ...input };

    return this.submitGeneration(userId, recipe.capabilitySlug, mergedInput, recipe.modelSlug);
  }

  // ===== Task Query =====

  async getTask(taskId: string): Promise<Record<string, unknown> | null> {
    try {
      const [task] = await this.drizzle.db
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
