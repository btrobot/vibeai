import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DrizzleService } from '../../common/drizzle.service';
import { projects, tasks } from '../../db/schema/task-engine';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import type { CreateProjectInput, UpdateProjectInput, ProjectResponse } from '@shared/index';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(private readonly drizzle: DrizzleService) {}

  private toResponse(p: typeof projects.$inferSelect): ProjectResponse {
    return {
      id: p.id,
      userId: p.userId,
      name: p.name,
      description: p.description,
      coverImage: p.coverImage,
      status: p.status as ProjectResponse['status'],
      tags: p.tags ?? [],
      totalTasks: p.totalTasks,
      completedTasks: p.completedTasks,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
      updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt),
    };
  }

  async create(userId: string, input: CreateProjectInput): Promise<ProjectResponse> {
    const [p] = await this.drizzle.db
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

  async list(userId: string, page = 1, pageSize = 20): Promise<{ items: ProjectResponse[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const [totalResult] = await this.drizzle.db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.userId, userId));

    const items = await this.drizzle.db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.updatedAt))
      .limit(pageSize)
      .offset(offset);

    return {
      items: items.map((p) => this.toResponse(p)),
      total: totalResult?.count ?? 0,
    };
  }

  async getById(id: string, userId: string): Promise<ProjectResponse> {
    const [p] = await this.drizzle.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)));

    if (!p) throw new NotFoundException('项目不存在');
    return this.toResponse(p);
  }

  async update(id: string, userId: string, input: UpdateProjectInput): Promise<ProjectResponse> {
    const [p] = await this.drizzle.db
      .update(projects)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();

    if (!p) throw new NotFoundException('项目不存在');
    return this.toResponse(p);
  }

  async delete(id: string, userId: string): Promise<void> {
    const [p] = await this.drizzle.db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning({ id: projects.id });

    if (!p) throw new NotFoundException('项目不存在');
    this.logger.log(`Project deleted: ${id}`);
  }

  async updateTaskCounts(projectId: string): Promise<void> {
    const [result] = await this.drizzle.db
      .select({
        total: count(),
        completed: sql<number>`count(*) filter (where ${tasks.status} = 'completed')`,
      })
      .from(tasks)
      .where(eq(tasks.projectId, projectId));

    if (result) {
      await this.drizzle.db
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