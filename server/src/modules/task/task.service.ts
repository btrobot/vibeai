import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DrizzleService } from '../../common/drizzle.service';
import { tasks, executionStates } from '../../db/schema/task-engine';
import { eq, and, desc, count, asc } from 'drizzle-orm';
import type { TaskResponse, ExecutionStateResponse } from '@shared/index';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(private readonly drizzle: DrizzleService) {}

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
  }): Promise<TaskResponse> {
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
    const [task] = await this.drizzle.db
      .update(tasks)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(tasks.id, taskId))
      .returning();

    if (!task) throw new NotFoundException('任务不存在');
    return this.toTaskResponse(task);
  }

  async cancelTask(taskId: string, userId: string): Promise<TaskResponse> {
    const [task] = await this.drizzle.db
      .update(tasks)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning();

    if (!task) throw new NotFoundException('任务不存在');
    this.logger.log(`Task cancelled: ${taskId}`);
    return this.toTaskResponse(task);
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