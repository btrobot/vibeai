import { Injectable, Logger, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { tasks } from '../../db/schema';
import { providerAttempts } from '../../db/schema/gateway';
import { eq } from 'drizzle-orm';
import { WsService } from '../ws/ws.service';
import { StorageService } from '../storage/storage.service';
import { BillingService } from '../billing/billing.service';
import { CreateService } from '../create/create.service';
import { AdapterRegistry } from './adapters/adapter-registry';
import { ProviderService } from './provider.service';
import type { AdapterModel, ExecutionContext, ExecutionResult } from './adapters/protocol-adapter.interface';

/** 任务被用户取消时抛出的错误（执行器据此走取消分支而非失败分支） */
export class TaskCancelledError extends Error {
  constructor(taskId: string) {
    super(`任务 ${taskId} 已被取消`);
    this.name = 'TaskCancelledError';
  }
}


/** 剔除模型 defaultParams 中的密钥字段（模型层不再允许配置 key；仅保留业务参数） */
function stripKeysFromDefaultParams(params: Record<string, unknown>): Record<string, unknown> {
  if (!params || typeof params !== 'object') return {};
  const sensitive = /(api[-_]?key|token|secret|password|authorization|credential|baseurl)/i;
  return Object.fromEntries(
    Object.entries(params).filter(([key]) => !sensitive.test(key)),
  );
}

@Injectable()
export class TaskExecutionService {
  private readonly logger = new Logger(TaskExecutionService.name);

  /** 在途任务 → AbortController 注册表：供 task.service 取消时中断适配器网络请求 */
  private static controllers = new Map<string, AbortController>();

  /** 中止在途任务的网络请求（由 TaskService.cancelTask 调用） */
  static cancelTaskInFlight(taskId: string): boolean {
    const controller = TaskExecutionService.controllers.get(taskId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }

  constructor(
    @Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>,
    @Inject('WS_SERVICE') private wsService: WsService,
    @Inject('STORAGE_SERVICE') private storageService: StorageService,
    @Inject('BILLING_SERVICE') private billingService: BillingService,
    @Inject('CREATE_SERVICE') private createService: CreateService,
    @Inject('ADAPTER_REGISTRY') private adapterRegistry: AdapterRegistry,
    @Inject('PROVIDER_SERVICE') private providerService: ProviderService,
  ) {}

  /** 查询任务是否已被用户取消（DB 是取消状态真相源） */
  private async isTaskCancelled(taskId: string): Promise<boolean> {
    const [row] = await this.db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    return row?.status === 'cancelled';
  }

  async executeTask(
    taskId: string,
    userId: string,
    capabilitySlug: string,
    input: Record<string, unknown>,
    model: AdapterModel,
  ): Promise<void> {
    // Fetch createId for create-level WS events
    const [taskRow] = await this.db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    const createId = taskRow?.createId ?? null;

    // 执行前检查：任务在入队后被取消（queued → cancelled）→ 直接退款，不执行
    if (taskRow?.status === 'cancelled') {
      this.logger.log(`Task ${taskId} already cancelled before execution, refunding credits`);
      try {
        await this.billingService.refundCredits(userId, taskId, model.costCredits, '任务取消退款');
      } catch (refundErr) {
        this.logger.error(`Failed to refund credits for cancelled task ${taskId}: ${refundErr}`);
      }
      return;
    }

    // 取消协调：注册 AbortController，取消时中断适配器网络请求
    const controller = new AbortController();
    TaskExecutionService.controllers.set(taskId, controller);
    try {
      await this.executeTaskInner(taskId, userId, capabilitySlug, input, model, createId, controller);
    } finally {
      TaskExecutionService.controllers.delete(taskId);
    }
  }

  private async executeTaskInner(
    taskId: string,
    userId: string,
    capabilitySlug: string,
    input: Record<string, unknown>,
    model: AdapterModel,
    createId: string | null,
    controller: AbortController,
  ): Promise<void> {
    // Transition: queued → submitting
    await this.db.update(tasks)
      .set({ status: 'submitting', startedAt: new Date(), updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    this.wsService.sendToUser(userId, {
      type: 'task:status',
      payload: { taskId, status: 'submitting' },
    });

    if (createId) {
      this.wsService.sendToUser(userId, {
        type: 'create:status',
        payload: { createId, status: 'processing' },
      });
    }

    const context: ExecutionContext = {
      taskId,
      userId,
      signal: controller.signal,
      onProgress: (progress: number, message: string) => {
        this.wsService.sendToUser(userId, {
          type: 'task:progress',
          payload: { taskId, progress, message },
        });
        if (createId) {
          this.wsService.sendToUser(userId, {
            type: 'create:progress',
            payload: { createId, progress, message },
          });
        }
      },
    };

    try {
      // ===== Multi-Provider Routing + Fallback =====
      const providers = await this.providerService.getAvailableProviders(model.slug);

      if (providers.length === 0) {
        throw new Error(`模型 "${model.slug}" 没有可用的渠道`);
      }

      let result: ExecutionResult | null = null;
      let lastError: Error | null = null;

      for (let i = 0; i < providers.length; i++) {
        const provider = providers[i];
        const attemptNumber = i + 1;
        const attemptStart = Date.now();

        try {
          // 取消检查点：用户在 fallback 期间取消 → 立即中止后续渠道尝试
          if (await this.isTaskCancelled(taskId)) {
            throw new TaskCancelledError(taskId);
          }

          const adapter = this.adapterRegistry.getAdapter(provider.sdkClient);

          const providerModel: AdapterModel = {
            ...model,
            sdkModelId: provider.sdkModelId,
            providerName: provider.platformName,
            // 二级 key：渠道 config（覆盖平台）> 平台默认（ProviderService 已合并渠道覆盖）。
            // 模型不再参与 key 配置 —— 模型必然基于某个渠道，key 只存平台/渠道两级。
            // 保留模型 defaultParams 的业务参数（temperature/size/duration 等），但剔除其内嵌的密钥字段。
            defaultParams: {
              ...stripKeysFromDefaultParams(model.defaultParams),
              ...provider.config,
            },
          };

          this.logger.log(
            `Task ${taskId}: trying provider "${provider.platformName}" (sdkClient=${provider.sdkClient}, priority=${provider.priority}, attempt=${attemptNumber}/${providers.length})`,
          );

          result = await adapter.execute(input, providerModel, context);

          // 取消检查点：适配器返回后若已取消 → 丢弃结果，走取消分支
          if (await this.isTaskCancelled(taskId)) {
            throw new TaskCancelledError(taskId);
          }

          // Record successful attempt
          await this.recordProviderAttempt({
            taskId,
            modelSlug: model.slug,
            providerName: provider.platformName,
            sdkClient: provider.sdkClient,
            requestPayload: input,
            responsePayload: result.output,
            status: 'success',
            durationMs: Date.now() - attemptStart,
            attemptNumber,
            costPerCall: provider.costPerCall,
            costPerSecond: provider.costPerSecond,
          });

          this.logger.log(
            `Task ${taskId}: provider "${provider.platformName}" succeeded (${Date.now() - attemptStart}ms)`,
          );

          break; // Success, stop trying
        } catch (e: any) {
          // 用户取消：立即向上传播，不视为渠道失败继续 fallback
          if (e instanceof TaskCancelledError) {
            throw e;
          }
          lastError = e;

          // Record failed attempt
          await this.recordProviderAttempt({
            taskId,
            modelSlug: model.slug,
            providerName: provider.platformName,
            sdkClient: provider.sdkClient,
            requestPayload: input,
            status: 'failed',
            errorMessage: e.message,
            durationMs: Date.now() - attemptStart,
            attemptNumber,
            costPerCall: provider.costPerCall,
            costPerSecond: provider.costPerSecond,
          });

          this.logger.warn(
            `Task ${taskId}: provider "${provider.platformName}" failed: ${e.message}`,
          );
          // Continue to next provider
        }
      }

      if (!result) {
        throw new Error(
          `所有渠道均失败: ${lastError?.message || '未知错误'}`,
        );
      }

      // Transition: submitting → completing
      await this.db.update(tasks)
        .set({ status: 'completing', output: result.output, updatedAt: new Date() })
        .where(eq(tasks.id, taskId));

      this.wsService.sendToUser(userId, {
        type: 'task:status',
        payload: { taskId, status: 'completing' },
      });

      // Transfer results to our storage (deterministic persistence)
      const transferredOutput = await this.transferResult(userId, taskId, result.output);

      // 取消检查点：转存完成、落库 completed 前若已取消 → 丢弃结果并退款
      if (await this.isTaskCancelled(taskId)) {
        throw new TaskCancelledError(taskId);
      }

      // Transition: completing → completed
      await this.db.update(tasks)
        .set({
          status: 'completed',
          output: transferredOutput,
          progress: 100,
          providerTaskId: result.providerTaskId ?? null,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId));

      // Settle credits (confirm deduction)
      await this.billingService.settleCredits(taskId);

      // ENG-012: Sync Create status
      const [completedTask] = await this.db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      if (completedTask?.createId) {
        await this.createService.syncCreateStatus(completedTask.createId, 'completed', transferredOutput);
        this.wsService.sendToUser(userId, {
          type: 'create:status',
          payload: { createId: completedTask.createId, status: 'completed', output: transferredOutput },
        });
      }

      this.wsService.sendToUser(userId, {
        type: 'task:completed',
        payload: { taskId, output: transferredOutput },
      });

      this.logger.log(`Task ${taskId} completed successfully (${model.slug})`);
    } catch (e: any) {
      // ===== 取消分支：用户取消的任务不覆盖 cancelled 状态、不标记 failed =====
      const cancelled = e instanceof TaskCancelledError || await this.isTaskCancelled(taskId);
      if (cancelled) {
        this.logger.log(`Task ${taskId} cancelled by user`);

        // Refund reserved credits（预扣在 submitGeneration，取消需退还）
        try {
          await this.billingService.refundCredits(userId, taskId, model.costCredits, '任务取消退款');
        } catch (refundErr) {
          this.logger.error(`Failed to refund credits for cancelled task ${taskId}: ${refundErr}`);
        }

        // ENG-012: Sync Create status → cancelled
        try {
          if (createId) {
            await this.createService.syncCreateStatus(createId, 'cancelled');
            this.wsService.sendToUser(userId, {
              type: 'create:status',
              payload: { createId, status: 'cancelled' },
            });
          }
        } catch (syncErr) {
          this.logger.error(`Failed to sync create status for task ${taskId}: ${syncErr}`);
        }

        this.wsService.sendToUser(userId, {
          type: 'task:cancelled',
          payload: { taskId },
        });
        return;
      }

      // ===== 失败分支 =====
      this.logger.error(`Task ${taskId} execution failed: ${e.message}`);

      await this.db.update(tasks)
        .set({
          status: 'failed',
          errorMessage: e.message,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId));

      // Refund credits on failure
      try {
        await this.billingService.refundCredits(userId, taskId, model.costCredits, '任务失败退款');
      } catch (refundErr) {
        this.logger.error(`Failed to refund credits for task ${taskId}: ${refundErr}`);
      }

      // ENG-012: Sync Create status
      try {
        const [failedTask] = await this.db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
        if (failedTask?.createId) {
          await this.createService.syncCreateStatus(failedTask.createId, 'failed', undefined, e.message);
          this.wsService.sendToUser(userId, {
            type: 'create:status',
            payload: { createId: failedTask.createId, status: 'failed', errorMessage: e.message },
          });
        }
      } catch (syncErr) {
        this.logger.error(`Failed to sync create status for task ${taskId}: ${syncErr}`);
      }

      this.wsService.sendToUser(userId, {
        type: 'task:failed',
        payload: { taskId, error: e.message },
      });
    }
  }

  /**
   * 记录 Provider 调用审计日志
   */
  private async recordProviderAttempt(params: {
    taskId: string;
    modelSlug: string;
    providerName: string;
    sdkClient: string;
    requestPayload: Record<string, unknown>;
    responsePayload?: Record<string, unknown>;
    status: 'success' | 'failed' | 'timeout';
    errorMessage?: string;
    durationMs: number;
    attemptNumber: number;
    costPerCall: number | null;
    costPerSecond: number | null;
  }): Promise<void> {
    try {
      await this.db.insert(providerAttempts).values({
        taskId: params.taskId,
        modelSlug: params.modelSlug,
        providerName: params.providerName,
        sdkClient: params.sdkClient,
        requestPayload: params.requestPayload,
        responsePayload: params.responsePayload ?? null,
        status: params.status,
        errorMessage: params.errorMessage ?? null,
        durationMs: params.durationMs,
        attemptNumber: params.attemptNumber,
        costPerCall: params.costPerCall?.toString() ?? null,
        costPerSecond: params.costPerSecond?.toString() ?? null,
        startedAt: new Date(Date.now() - params.durationMs),
        completedAt: new Date(),
      } as any);
    } catch (e) {
      this.logger.warn(`Failed to record provider attempt: ${(e as Error).message}`);
    }
  }

  /**
   * 结果转存：将 AI 生成的 URL 下载并持久化到我们的 StorageObject
   * 确保产物不因第三方 URL 过期而丢失
   */
  private async transferResult(
    userId: string,
    taskId: string,
    output: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const result = { ...output };

    // 图片转存
    if (result.images && Array.isArray(result.images)) {
      for (let i = 0; i < (result.images as Array<{ url?: string }>).length; i++) {
        const img = (result.images as Array<{ url?: string; fileId?: string }>)[i];
        if (img.url) {
          try {
            const stored = await this.storageService.downloadAndStore(
              userId, img.url, `task-${taskId}-img-${i}.png`, 'image/png', 'generated',
            );
            (result.images as Array<{ url?: string; fileId?: string }>)[i] = {
              ...img,
              url: stored.url,
              fileId: stored.fileId,
            };
          } catch (e) {
            this.logger.warn(`Failed to transfer image ${i} for task ${taskId}: ${(e as Error).message}`);
          }
        }
      }
    }

    // 视频转存
    if (result.video && typeof result.video === 'object' && (result.video as { url?: string }).url) {
      const video = result.video as { url: string; fileId?: string };
      try {
        const stored = await this.storageService.downloadAndStore(
          userId, video.url, `task-${taskId}.mp4`, 'video/mp4', 'generated',
        );
        result.video = { ...video, url: stored.url, fileId: stored.fileId };
      } catch (e) {
        this.logger.warn(`Failed to transfer video for task ${taskId}: ${(e as Error).message}`);
      }
    }

    // 尾帧转存
    if (result.lastFrameUrl && typeof result.lastFrameUrl === 'string') {
      try {
        const stored = await this.storageService.downloadAndStore(
          userId, result.lastFrameUrl, `task-${taskId}-lastframe.png`, 'image/png', 'generated',
        );
        result.lastFrameUrl = stored.url;
      } catch (e) {
        this.logger.warn(`Failed to transfer last frame for task ${taskId}: ${(e as Error).message}`);
      }
    }

    return result;
  }
}
