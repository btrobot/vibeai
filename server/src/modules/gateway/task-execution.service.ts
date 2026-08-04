import { Injectable, Logger, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { tasks } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { WsService } from '../ws/ws.service';
import { StorageService } from '../storage/storage.service';
import { BillingService } from '../billing/billing.service';
import { CreateService } from '../create/create.service';
import { AdapterRegistry } from './adapters/adapter-registry';
import type { AdapterModel, ExecutionContext } from './adapters/protocol-adapter.interface';

@Injectable()
export class TaskExecutionService {
  private readonly logger = new Logger(TaskExecutionService.name);

  constructor(
    @Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>,
    @Inject(WsService) private wsService: WsService,
    @Inject(StorageService) private storageService: StorageService,
    @Inject(BillingService) private billingService: BillingService,
    @Inject(CreateService) private createService: CreateService,
    @Inject(AdapterRegistry) private adapterRegistry: AdapterRegistry,
  ) {}

  async executeTask(
    taskId: string,
    userId: string,
    capabilitySlug: string,
    input: Record<string, unknown>,
    model: AdapterModel,
  ): Promise<void> {
    const adapter = this.adapterRegistry.getAdapter(model.modality);

    // Fetch createId for create-level WS events
    const [taskRow] = await this.db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    const createId = taskRow?.createId ?? null;

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
      // Execute via adapter
      const result = await adapter.execute(input, model, context);

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
