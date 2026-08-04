import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { creates, tasks } from '../../db/schema/task-engine';
import { eq, and, desc, count, asc, sql } from 'drizzle-orm';
import type { CreateResponse, CreateStatus, TaskStatus } from '../../shared-types';

@Injectable()
export class CreateService {
  private readonly logger = new Logger(CreateService.name);

  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  private toResponse(c: typeof creates.$inferSelect, latestTask?: typeof tasks.$inferSelect | null): CreateResponse {
    return {
      id: c.id,
      projectId: c.projectId,
      userId: c.userId,
      capabilitySlug: c.capabilitySlug,
      prompt: c.prompt,
      sourceCreateId: c.sourceCreateId,
      status: c.status as CreateStatus,
      output: c.output as Record<string, unknown> | null,
      modelSlug: c.modelSlug,
      taskCount: c.taskCount,
      errorMessage: c.errorMessage,
      taskStatus: latestTask ? (latestTask.status as TaskStatus) : null,
      taskProgress: latestTask?.progress ?? 0,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  /**
   * Create a new Create record (called by GatewayService.submitGeneration)
   */
  async createCreate(params: {
    projectId: string;
    userId: string;
    capabilitySlug: string;
    prompt: string;
    modelSlug?: string;
    sourceCreateId?: string | null;
  }): Promise<{ id: string }> {
    const [created] = await this.db
      .insert(creates)
      .values({
        projectId: params.projectId,
        userId: params.userId,
        capabilitySlug: params.capabilitySlug,
        prompt: params.prompt,
        modelSlug: params.modelSlug ?? null,
        sourceCreateId: params.sourceCreateId ?? null,
        status: 'draft',
      })
      .returning();

    this.logger.log(`Create record: ${created.id} (${params.capabilitySlug})`);
    return { id: created.id };
  }

  /**
   * Update create status (called when task transitions)
   */
  async updateStatus(createId: string, status: CreateStatus, extra?: { output?: Record<string, unknown>; errorMessage?: string }): Promise<void> {
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };
    if (extra?.output !== undefined) updateData.output = extra.output;
    if (extra?.errorMessage !== undefined) updateData.errorMessage = extra.errorMessage;

    await this.db
      .update(creates)
      .set(updateData)
      .where(eq(creates.id, createId));

    this.logger.log(`Create ${createId} status → ${status}`);
  }

  /**
   * Increment task count (called when a new task is created for this create)
   */
  async incrementTaskCount(createId: string): Promise<void> {
    await this.db
      .update(creates)
      .set({
        taskCount: sql`${creates.taskCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(creates.id, createId));
  }

  /**
   * Sync create status based on latest task status (ENG-012)
   */
  async syncCreateStatus(createId: string, taskStatus: string, taskOutput?: Record<string, unknown>, errorMessage?: string): Promise<void> {
    const statusMap: Record<string, CreateStatus> = {
      queued: 'processing' as CreateStatus,
      submitting: 'processing' as CreateStatus,
      completing: 'processing' as CreateStatus,
      completed: 'completed' as CreateStatus,
      failed: 'failed' as CreateStatus,
      cancelled: 'cancelled' as CreateStatus,
    };

    const newStatus = statusMap[taskStatus];
    if (!newStatus) return;

    const extra: { output?: Record<string, unknown>; errorMessage?: string } = {};
    if (taskStatus === 'completed' && taskOutput) extra.output = taskOutput;
    if (taskStatus === 'failed' && errorMessage) extra.errorMessage = errorMessage;

    await this.updateStatus(createId, newStatus, extra);
  }

  /**
   * List creates in a project
   */
  async listCreates(
    projectId: string,
    userId: string,
    options: { status?: string; page?: number; pageSize?: number } = {},
  ): Promise<{ items: CreateResponse[]; total: number }> {
    const { status, page = 1, pageSize = 50 } = options;
    const offset = (page - 1) * pageSize;
    const conditions = [eq(creates.projectId, projectId), eq(creates.userId, userId)];

    if (status) conditions.push(eq(creates.status, status));

    const [totalResult] = await this.db
      .select({ count: count() })
      .from(creates)
      .where(and(...conditions));

    const items = await this.db
      .select()
      .from(creates)
      .where(and(...conditions))
      .orderBy(desc(creates.createdAt))
      .limit(pageSize)
      .offset(offset);

    // Fetch latest task for each create
    const result: CreateResponse[] = [];
    for (const c of items) {
      const [latestTask] = await this.db
        .select()
        .from(tasks)
        .where(eq(tasks.createId, c.id))
        .orderBy(desc(tasks.createdAt))
        .limit(1);
      result.push(this.toResponse(c, latestTask));
    }

    return {
      items: result,
      total: totalResult?.count ?? 0,
    };
  }

  /**
   * Get a single create with its latest task status
   */
  async getCreate(createId: string, userId: string): Promise<CreateResponse> {
    const [c] = await this.db
      .select()
      .from(creates)
      .where(and(eq(creates.id, createId), eq(creates.userId, userId)));

    if (!c) throw new NotFoundException('创作记录不存在');

    const [latestTask] = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.createId, createId))
      .orderBy(desc(tasks.createdAt))
      .limit(1);

    return this.toResponse(c, latestTask);
  }

  /**
   * List all creates for a user (across all projects) — used by Dashboard
   */
  async listAllCreates(
    userId: string,
    options: { status?: string; page?: number; pageSize?: number } = {},
  ): Promise<{ items: CreateResponse[]; total: number }> {
    const { status, page = 1, pageSize = 20 } = options;
    const offset = (page - 1) * pageSize;
    const conditions = [eq(creates.userId, userId)];

    if (status) conditions.push(eq(creates.status, status));

    const [totalResult] = await this.db
      .select({ count: count() })
      .from(creates)
      .where(and(...conditions));

    const items = await this.db
      .select()
      .from(creates)
      .where(and(...conditions))
      .orderBy(desc(creates.createdAt))
      .limit(pageSize)
      .offset(offset);

    const result: CreateResponse[] = [];
    for (const c of items) {
      const [latestTask] = await this.db
        .select()
        .from(tasks)
        .where(eq(tasks.createId, c.id))
        .orderBy(desc(tasks.createdAt))
        .limit(1);
      result.push(this.toResponse(c, latestTask));
    }

    return {
      items: result,
      total: totalResult?.count ?? 0,
    };
  }

  /**
   * Retry a failed create (failed → processing, creates a new task)
   */
  async retryCreate(createId: string, userId: string): Promise<CreateResponse> {
    const c = await this.getCreate(createId, userId);

    if (c.status !== 'failed' as CreateStatus) {
      throw new BadRequestException('只有失败的创作可以重试');
    }

    await this.updateStatus(createId, 'processing' as CreateStatus);

    return this.getCreate(createId, userId);
  }
}
