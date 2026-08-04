import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DrizzleService } from '../../common/drizzle.service';
import { tasks, executionStates } from '../../db/schema/task-engine';
import { eq, and, desc, count, asc } from 'drizzle-orm';
import type { TaskResponse, ExecutionStateResponse } from '../../shared-types';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly billing: BillingService,
  ) {}

  private toTaskResponse(t: typeof tasks.$inferSelect): TaskResponse {
    return {
      id: t.id,
      projectId: t.projectId,
      userId: t.userId,
      type: t.type,
      status: t.status as TaskResponse['status'],
      priority: t.priority,
      progress: t.progress,
      input: t.input as Record<string, unknown>,
      output: t.output as Record<string, unknown> | null,
      result: t.result as Record<string, unknown> | null,
      modelSlug: t.modelSlug,
      capabilitySlug: t.capabilitySlug,
      creditsCost: t.creditsCost,
      providerTaskId: t.providerTaskId,
      sourceTaskId: t.sourceTaskId,
      expiresAt: t.expiresAt?.toISOString() ?? null,
      errorMessage: t.errorMessage,
      startedAt: t.startedAt?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      estimatedCompletionAt: t.estimatedCompletionAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  private toExecutionStateResponse(e: typeof executionStates.$inferSelect): ExecutionStateResponse {
    return {
      id: e.id,
      taskId: e.taskId,
      step: e.step,
      status: e.status as ExecutionStateResponse['status'],
      progress: e.progress,
      message: e.message,
      metadata: e.metadata as Record<string, unknown> | null,
      startedAt: e.startedAt?.toISOString() ?? null,
      completedAt: e.completedAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
    };
  }

  async createTask(params: {
    userId: string;
    projectId?: string;
    type: string;
    input: Record<string, unknown>;
    modelSlug?: string;
    priority?: number;
    creditCost?: number;
  }): Promise<TaskResponse> {
    // Check credits if creditCost is specified
    if (params.creditCost && params.creditCost > 0) {
      const hasCredits = await this.billing.checkCredits(params.userId, params.creditCost);
      if (!hasCredits) {
        throw new BadRequestException('信用额度不足，请升级套餐或等待额度恢复');
      }
    }

    const [task] = await this.drizzle.db
      .insert(tasks)
      .values({
        userId: params.userId,
        projectId: params.projectId ?? null,
        type: params.type,
        input: params.input,
        modelSlug: params.modelSlug ?? null,
        priority: params.priority ?? 0,
        status: 'queued',
      })
      .returning();

    this.logger.log(`Task created: ${task.id} (${task.type})`);
    return this.toTaskResponse(task);
  }

  async listTasks(
    userId: string,
    options: { projectId?: string; status?: string; type?: string; page?: number; pageSize?: number } = {},
  ): Promise<{ items: TaskResponse[]; total: number }> {
    const { projectId, status, type, page = 1, pageSize = 20 } = options;
    const offset = (page - 1) * pageSize;
    const conditions = [eq(tasks.userId, userId)];

    if (projectId) conditions.push(eq(tasks.projectId, projectId));
    if (status) conditions.push(eq(tasks.status, status));
    if (type) conditions.push(eq(tasks.type, type));

    const [totalResult] = await this.drizzle.db
      .select({ count: count() })
      .from(tasks)
      .where(and(...conditions));

    const items = await this.drizzle.db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      items: items.map((t) => this.toTaskResponse(t)),
      total: totalResult?.count ?? 0,
    };
  }

  async getTask(taskId: string, userId: string): Promise<TaskResponse> {
    const [task] = await this.drizzle.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

    if (!task) throw new NotFoundException('任务不存在');
    return this.toTaskResponse(task);
  }

  async updateTaskStatus(
    taskId: string,
    update: Partial<{
      status: string;
      progress: number;
      output: Record<string, unknown>;
      result: Record<string, unknown>;
      errorMessage: string;
      startedAt: Date;
      completedAt: Date;
      estimatedCompletionAt: Date;
    }>,
  ): Promise<TaskResponse> {
    const updateData: Record<string, unknown> = { ...update, updatedAt: new Date() };

    // ENG-004: progress must be clamped to 0-100
    if (updateData.progress !== undefined) {
      updateData.progress = Math.max(0, Math.min(100, Number(updateData.progress)));
    }

    const [task] = await this.drizzle.db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, taskId))
      .returning();

    if (!task) throw new NotFoundException('任务不存在');
    return this.toTaskResponse(task);
  }

  async cancelTask(taskId: string, userId: string): Promise<TaskResponse> {
    // ENG-002: task_owner_only — check ownership first
    const task = await this.getTask(taskId, userId);

    // ENG-003: task_status_guard — only queued/submitting tasks can be cancelled
    const cancellableStates = ['queued', 'submitting'];
    if (!cancellableStates.includes(task.status)) {
      throw new BadRequestException('任务已完成或已取消，无法取消');
    }

    const [updated] = await this.drizzle.db
      .update(tasks)
      .set({ status: 'cancelled', updatedAt: new Date(), completedAt: new Date() })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning();

    this.logger.log(`Task cancelled: ${taskId}`);
    return this.toTaskResponse(updated);
  }

  /**
   * Retry a failed task (ENG: failed → queued)
   */
  async retryTask(taskId: string, userId: string): Promise<TaskResponse> {
    // ENG-002: task_owner_only
    const task = await this.getTask(taskId, userId);

    // State machine: only failed tasks can be retried
    if (task.status !== 'failed') {
      throw new BadRequestException('只有失败的任务可以重试');
    }

    const [updated] = await this.drizzle.db
      .update(tasks)
      .set({
        status: 'queued',
        progress: 0,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning();

    this.logger.log(`Task retried: ${taskId}`);
    return this.toTaskResponse(updated);
  }

  /**
   * Complete a task with credit deduction
   * Deducts credits from user's account on successful completion
   */
  async completeTaskWithCredits(
    taskId: string,
    userId: string,
    creditCost: number,
    result: Record<string, unknown>,
    output?: Record<string, unknown>,
  ): Promise<TaskResponse> {
    const task = await this.updateTaskStatus(taskId, {
      status: 'completed',
      progress: 100,
      result,
      output: output ?? result,
      completedAt: new Date(),
    });

    // Deduct credits
    if (creditCost > 0) {
      const deducted = await this.billing.deductCredits(
        userId,
        taskId,
        creditCost,
        `任务执行消耗: ${task.type}`,
      );
      if (!deducted) {
        this.logger.warn(`用户 ${userId} 额度不足，但任务已完成: ${taskId}`);
      }
    }

    return task;
  }

  /**
   * Fail a task with credit refund
   */
  async failTaskWithRefund(
    taskId: string,
    userId: string,
    creditCost: number,
    errorMessage: string,
  ): Promise<TaskResponse> {
    const task = await this.updateTaskStatus(taskId, {
      status: 'failed',
      errorMessage,
      completedAt: new Date(),
    });

    // Refund credits if task failed
    if (creditCost > 0) {
      await this.billing.refundCredits(userId, taskId, creditCost, '任务失败额度返还');
    }

    return task;
  }

  // ===== Execution States =====

  async createExecutionState(taskId: string, step: string): Promise<ExecutionStateResponse> {
    const [state] = await this.drizzle.db
      .insert(executionStates)
      .values({ taskId, step, status: 'running', startedAt: new Date() })
      .returning();

    return this.toExecutionStateResponse(state);
  }

  async updateExecutionState(
    stateId: string,
    update: Partial<{
      status: string;
      progress: number;
      message: string;
      metadata: Record<string, unknown>;
      completedAt: Date;
    }>,
  ): Promise<ExecutionStateResponse> {
    const [state] = await this.drizzle.db
      .update(executionStates)
      .set(update)
      .where(eq(executionStates.id, stateId))
      .returning();

    if (!state) throw new NotFoundException('执行状态不存在');
    return this.toExecutionStateResponse(state);
  }

  async getExecutionStates(taskId: string): Promise<ExecutionStateResponse[]> {
    const states = await this.drizzle.db
      .select()
      .from(executionStates)
      .where(eq(executionStates.taskId, taskId))
      .orderBy(asc(executionStates.createdAt));

    return states.map((s) => this.toExecutionStateResponse(s));
  }
}