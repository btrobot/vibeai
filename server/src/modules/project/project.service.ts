import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { projects, creates } from '../../db/schema/task-engine';
import { eq, and, desc, count, ilike, or, sql } from 'drizzle-orm';
import type { CreateProjectInput, UpdateProjectInput, ProjectResponse } from '../../shared-types';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  private toResponse(p: typeof projects.$inferSelect): ProjectResponse {
    return {
      id: p.id,
      userId: p.userId,
      name: p.name,
      description: p.description,
      coverImage: p.coverImage,
      status: p.status as ProjectResponse['status'],
      tags: p.tags ?? [],
      totalCreates: p.totalTasks,
      completedCreates: p.completedTasks,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
      updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt),
    };
  }

  async getDefaultProject(userId: string): Promise<ProjectResponse> {
    // 导航电商工具（白底图/场景合成/模特换装/详情页）直通入口：跳过用户手工建项目，
    // 统一归属到每用户的工具箱项目（template='toolbox'），无则幂等创建一次。
    const existing = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), eq(projects.template, 'toolbox')))
      .limit(1);

    if (existing.length > 0) {
      return this.toResponse(existing[0]);
    }

    const [p] = await this.db
      .insert(projects)
      .values({
        userId,
        name: '我的工具创作',
        description: '电商工具（白底图/场景合成/模特换装/详情页）生成的作品',
        template: 'toolbox',
      })
      .returning();

    this.logger.log(`Toolbox project created: ${p.id} (${p.name})`);
    return this.toResponse(p);
  }

  async create(userId: string, input: CreateProjectInput): Promise<ProjectResponse> {
    const [p] = await this.db
      .insert(projects)
      .values({
        userId,
        name: input.name,
        description: input.description ?? null,
        template: input.template ?? null,
        tags: input.tags ?? [],
      })
      .returning();

    this.logger.log(`Project created: ${p.id} (${p.name})`);
    return this.toResponse(p);
  }

  async list(
    userId: string,
    page = 1,
    pageSize = 20,
    search?: string,
    status?: string,
  ): Promise<{ items: ProjectResponse[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const conditions = [eq(projects.userId, userId)];
    const keyword = search?.trim();
    if (keyword) {
      const pattern = `%${keyword}%`;
      conditions.push(or(
        ilike(projects.name, pattern),
        ilike(projects.description, pattern),
      )!);
    }
    if (status && status !== 'all') {
      conditions.push(eq(projects.status, status as typeof projects.$inferSelect.status));
    }
    const where = and(...conditions);

    const [totalResult] = await this.db
      .select({ count: count() })
      .from(projects)
      .where(where);

    const items = await this.db
      .select()
      .from(projects)
      .where(where)
      .orderBy(desc(projects.updatedAt))
      .limit(pageSize)
      .offset(offset);

    return {
      items: items.map((p) => this.toResponse(p)),
      total: totalResult?.count ?? 0,
    };
  }

  async getById(id: string, userId: string): Promise<ProjectResponse> {
    const [p] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)));

    if (!p) throw new NotFoundException('项目不存在');
    return this.toResponse(p);
  }

  async update(id: string, userId: string, input: UpdateProjectInput): Promise<ProjectResponse> {
    // Filter out undefined values to avoid overwriting existing fields
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }
    updateData.updatedAt = new Date();

    const [p] = await this.db
      .update(projects)
      .set(updateData)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();

    if (!p) throw new NotFoundException('项目不存在');
    return this.toResponse(p);
  }

  async delete(id: string, userId: string): Promise<void> {
    const [p] = await this.db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning({ id: projects.id });

    if (!p) throw new NotFoundException('项目不存在');
    this.logger.log(`Project deleted: ${id}`);
  }

  async updateCreateCounts(projectId: string): Promise<void> {
    const [result] = await this.db
      .select({
        total: count(),
        completed: sql<number>`count(*) filter (where ${creates.status} = 'completed')`,
      })
      .from(creates)
      .where(eq(creates.projectId, projectId));

    if (result) {
      await this.db
        .update(projects)
        .set({
          totalTasks: Number(result.total),
          completedTasks: Number(result.completed),
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId));
    }
  }
}