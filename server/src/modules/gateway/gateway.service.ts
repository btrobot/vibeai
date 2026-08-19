import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { tasks } from '../../db/schema/task-engine';
import { aiModels, aiPlatforms, capabilityModelRoutes, modelChannels } from '../../db/schema/gateway';
import { builtInCapabilityMap } from './capabilities/index';
import type { CapabilityDefinition } from './capabilities/index';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { TaskExecutionService, stripKeysFromDefaultParams } from './task-execution.service';
import { ProviderService } from './provider.service';
import { AdapterRegistry } from './adapters/adapter-registry';
import { BillingService } from '../billing/billing.service';
import { CreateService } from '../create/create.service';
import { StorageService } from '../storage/storage.service';
import { SEED_MODELS, SEED_RECIPES, SEED_PLATFORMS, SEED_CHANNELS, SEED_MODEL_ROUTES } from './seeds/model-seeds';
import type { AdapterModel } from './adapters/protocol-adapter.interface';
import { ModelRoutingService } from './model-routing.service';
import { toAdapterModel } from './model-mapper';

const sensitiveKeyPattern = /(api[-_]?key|token|secret|password|authorization|credential|baseurl)/i;

/**
 * 模型 HTTP 出口脱敏：移除 defaultParams 中的密钥字段（token/secret 等）。
 * 模型层不再配置 key（key 仅存平台/渠道两级），此函数仅作为安全兜底。
 * 注意：getModel/listModels 内部返回仍含完整 defaultParams（chat 等内部链路需要）。
 */
export function sanitizeModelForClient<T extends { defaultParams?: Record<string, unknown> }>(model: T): T {
  if (!model.defaultParams || typeof model.defaultParams !== 'object') return model;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(model.defaultParams)) {
    if (!sensitiveKeyPattern.test(key)) cleaned[key] = value;
  }
  return { ...model, defaultParams: cleaned };
}

export interface GatewayModelSummary extends AdapterModel {
  description: string | null;
  tags: string[];
  isFeatured: boolean;
  isDefault: boolean;
}

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
    @Optional() @Inject('MODEL_ROUTING_SERVICE') modelRoutingService?: ModelRoutingService,
    @Optional() @Inject('PROVIDER_SERVICE') private readonly providerService?: ProviderService,
    @Optional() @Inject('ADAPTER_REGISTRY') private readonly adapterRegistry?: AdapterRegistry,
  ) {
    this.modelRoutingService = modelRoutingService ?? new ModelRoutingService(this.providerService!, db);
  }

  private readonly modelRoutingService: ModelRoutingService;

  // ===== Seed =====

  async seedModels(): Promise<void> {
    for (const model of SEED_MODELS) {
      await this.db.insert(aiModels).values(model).onConflictDoUpdate({ target: aiModels.slug, set: { capabilities: model.capabilities } });
    }

    for (const platform of SEED_PLATFORMS) {
      await this.db.insert(aiPlatforms).values(platform).onConflictDoNothing({ target: aiPlatforms.name });
    }
    const platformRows = await this.db
      .select()
      .from(aiPlatforms)
      .where(inArray(aiPlatforms.name, SEED_PLATFORMS.map((p) => p.name)));
    const platformIdByName = new Map(platformRows.map((p) => [p.name, p.id]));

    for (const channel of SEED_CHANNELS) {
      const platformId = platformIdByName.get(channel.platformName);
      if (!platformId) continue;
      await this.db.insert(modelChannels).values({ ...channel, platformId }).onConflictDoNothing();
    }

    for (const route of SEED_MODEL_ROUTES) {
      await this.db.insert(capabilityModelRoutes).values(route).onConflictDoNothing();
    }

    this.logger.log(
      `已检查 ${SEED_MODELS.length} 个模型、${SEED_PLATFORMS.length} 个平台、${SEED_CHANNELS.length} 个渠道和 ${SEED_MODEL_ROUTES.length} 条能力路由`,
    );
  }

  // ===== Capabilities =====

  listCapabilities(): CapabilityDefinition[] {
    // 2026-08-19 起全量开放：L1（文生图/图片编辑）为工作区自动识别两条路；
    // L2（白底/场景/换装）经独立工具页（/tools/*）开放新建（spec enabled: true，见 specs/gateway.spec.yaml）。
    return Array.from(builtInCapabilityMap.values())
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  getCapability(slug: string): CapabilityDefinition | null {
    return builtInCapabilityMap.get(slug) ?? null;
  }

  // ===== Models (database source of truth) =====

  async listModels(capability?: string, modality?: string): Promise<GatewayModelSummary[]> {
    try {
      const conditions = [eq(aiModels.isActive, true)];
      if (capability) {
        conditions.push(sql`${aiModels.capabilities} @> ARRAY[${capability}]::text[]`);
      }
      if (modality) {
        conditions.push(eq(aiModels.modality, modality));
      }
      const rows = await this.db
        .select()
        .from(aiModels)
        .where(and(...conditions));

      const defaultModel = capability
        ? await this.modelRoutingService.getDefaultModel(capability)
        : null;

      return rows
        .sort((a: typeof aiModels.$inferSelect, b: typeof aiModels.$inferSelect) => a.sortOrder - b.sortOrder)
        .map((r: typeof aiModels.$inferSelect) => ({
          ...toAdapterModel(r),
          description: r.description,
          tags: r.tags ?? [],
          isFeatured: r.isFeatured,
          isDefault: r.slug === defaultModel?.slug,
        }));
    } catch (e) {
      this.logger.error(`DB model query failed: ${(e as Error).message}`);
      throw new ServiceUnavailableException('模型配置暂时不可用');
    }
  }

  async getModel(slug: string): Promise<AdapterModel | null> {
    try {
      const [row] = await this.db
        .select()
        .from(aiModels)
        .where(and(eq(aiModels.slug, slug), eq(aiModels.isActive, true)))
        .limit(1);
      if (row) {
        return toAdapterModel(row);
      }
    } catch (error) {
      this.logger.error(`DB model lookup failed for "${slug}": ${(error as Error).message}`);
      throw new ServiceUnavailableException('模型配置暂时不可用');
    }
    return null;
  }

  async toggleModelActive(slug: string): Promise<{ slug: string; isActive: boolean } | null> {
    try {
      const [row] = await this.db.select().from(aiModels).where(eq(aiModels.slug, slug)).limit(1);
      if (!row) return null;
      const next = !row.isActive;
      await this.db
        .update(aiModels)
        .set({ isActive: next, updatedAt: new Date() })
        .where(eq(aiModels.slug, slug));
      this.logger.warn(`Admin toggled model "${slug}" → isActive=${next}`);
      return { slug, isActive: next };
    } catch (e) {
      this.logger.error(`toggleModelActive failed for "${slug}": ${(e as Error).message}`);
      return null;
    }
  }

  async toggleChannelActive(id: string): Promise<{ id: string; isActive: boolean } | null> {
    try {
      const [row] = await this.db.select().from(modelChannels).where(eq(modelChannels.id, id)).limit(1);
      if (!row) return null;
      const next = !row.isActive;
      await this.db
        .update(modelChannels)
        .set({ isActive: next, updatedAt: new Date() })
        .where(eq(modelChannels.id, id));
      this.logger.warn(`Admin toggled channel "${id}" → isActive=${next}`);
      return { id, isActive: next };
    } catch (e) {
      this.logger.error(`toggleChannelActive failed for "${id}": ${(e as Error).message}`);
      return null;
    }
  }

  async getDefaultModel(capabilitySlug: string): Promise<AdapterModel | null> {
    return this.modelRoutingService.getDefaultModel(capabilitySlug);
  }

  /**
   * chat（LLM SSE）渠道解析执行——与 generate 对齐（P0 修复）：
   * 1. 解析模型（显式或 text-generation 默认路由）
   * 2. ProviderService 获取启用渠道列表（平台默认 + 渠道覆盖合并，按 priority 排序）
   * 3. 逐个渠道 fallback：key 合并 = stripKeys(模型 defaultParams) + provider.config（渠道 > 平台）
   * 4. 流式期间（已推送内容后）失败不 fallback，直接抛错由 controller 以 SSE error 返回
   * 5. 成功后返回模型信息供 controller 结算信用（LLM 后扣）
   */
  async chatStream(
    userId: string,
    input: Record<string, unknown>,
    preferredModel?: string,
    onProgress?: (progress: number, text: string) => void,
  ): Promise<{ modelUsed: string; modelName: string; costCredits: number; content: string }> {
    const model = preferredModel
      ? await this.getModel(preferredModel)
      : await this.getDefaultModel('text-generation');

    if (!model) {
      throw new NotFoundException('没有可用的文本生成模型');
    }

    if (!this.providerService || !this.adapterRegistry) {
      throw new Error('ProviderService/AdapterRegistry 未注入，无法解析渠道');
    }

    const providers = await this.providerService.getAvailableProviders(model.slug);
    if (providers.length === 0) {
      throw new NotFoundException(`模型 "${model.slug}" 没有可用的渠道`);
    }

    let lastError: Error | null = null;
    let hasStreamed = false;
    for (const provider of providers) {
      try {
        const adapter = this.adapterRegistry.getAdapter(provider.sdkClient);
        const providerModel: AdapterModel = {
          ...model,
          sdkModelId: provider.sdkModelId,
          providerName: provider.platformName,
          // 与 TaskExecutionService 一致的 key 合并：渠道 config（覆盖平台）> 平台默认，模型不参与 key
          defaultParams: {
            ...stripKeysFromDefaultParams(model.defaultParams),
            ...provider.config,
          },
        };
        this.logger.log(
          `Chat: trying provider "${provider.platformName}" (sdkClient=${provider.sdkClient}, priority=${provider.priority})`,
        );
        const result = await adapter.execute(input, providerModel, {
          taskId: `llm-${Date.now()}`,
          userId,
          onProgress: (progress: number, text: string) => {
            hasStreamed = true;
            onProgress?.(progress, text);
          },
        });
        const content = (result.output as { content?: string } | undefined)?.content ?? '';
        return {
          modelUsed: model.slug,
          modelName: model.name,
          costCredits: model.costCredits,
          content,
        };
      } catch (e) {
        lastError = e as Error;
        if (hasStreamed) {
          // 已推送内容，无法安全切换渠道（会导致内容拼接混乱），直接抛错
          throw lastError;
        }
        this.logger.warn(`Chat: provider "${provider.platformName}" failed: ${lastError.message}`);
      }
    }

    throw new Error(`所有渠道均失败: ${lastError?.message || '未知错误'}`);
  }

  // ===== Model Resolution Helpers =====

  /**
   * Resolve a user-specified preferred model to an AdapterModel.
   *
   * Explicit model selection is strict: it must be active and support the
   * requested capability. Defaults are resolved separately from the route table.
   */
  private async resolvePreferredModel(
    preferredModel: string,
    capabilitySlug: string,
  ): Promise<AdapterModel> {
    const dbModel = await this.getModel(preferredModel);
    if (!dbModel) {
      throw new BadRequestException(`模型 "${preferredModel}" 不存在或已停用`);
    }
    if (!dbModel.capabilities.includes(capabilitySlug)) {
      throw new BadRequestException(`模型 "${preferredModel}" 不支持能力 "${capabilitySlug}"`);
    }
    return dbModel;
  }

  /**
   * Resolve the default model through the database route table.
   */
  private async resolveDefaultModel(capabilitySlug: string): Promise<AdapterModel> {
    const model = await this.modelRoutingService.getDefaultModel(capabilitySlug);
    if (!model) {
      throw new BadRequestException(`能力 "${capabilitySlug}" 没有可用的模型`);
    }
    return model;
  }

  // ===== Input Media Resolution (fileId → URL, at system boundary) =====

  /**
   * Resolve fileId references in input to URLs before passing to AI adapter.
   * Supports both new format ({ fileId: "uuid" }) and legacy format (plain URL strings).
   *
   * Array fields: images, referenceImages, referenceVideos, referenceAudios
   * Single fields: firstFrame, lastFrame, referenceImage, imageUrl
   */
  private async resolveInputForAdapter(
    input: Record<string, unknown>,
    fallbackDomain?: string,
  ): Promise<Record<string, unknown>> {
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
    const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT?.trim() || fallbackDomain?.trim();
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
    fallbackDomain?: string,
  ): Promise<GenerationTaskResponse> {
    // Validate capability
    const capability = builtInCapabilityMap.get(capabilitySlug);
    if (!capability) {
      throw new NotFoundException(`能力 "${capabilitySlug}" 不存在`);
    }

    // Resolve explicit selections or the database-backed capability default.
    const model = preferredModel
      ? await this.resolvePreferredModel(preferredModel, capabilitySlug)
      : await this.resolveDefaultModel(capabilitySlug);

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
    const resolvedInput = await this.resolveInputForAdapter(input, fallbackDomain);

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
    fallbackDomain?: string,
  ): Promise<GenerationTaskResponse> {
    const recipe = SEED_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) {
      throw new NotFoundException(`快捷创作方案 "${recipeId}" 不存在`);
    }

    // Merge default input with user input
    const mergedInput = { ...recipe.defaultInput, ...input };

    return this.submitGeneration(userId, projectId, recipe.capabilitySlug, mergedInput, recipe.modelSlug, undefined, fallbackDomain);
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
