import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { count, eq, sql, desc, and } from 'drizzle-orm';

@Injectable()
export class AdminService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  // ===== Dashboard Stats =====

  async getStats() {
    const [userCount] = await this.db
      .select({ value: count() })
      .from(schema.users);

    const [activeUserCount] = await this.db
      .select({ value: count() })
      .from(schema.users)
      .where(
        sql`${schema.users.updatedAt} > NOW() - INTERVAL '30 days'`,
      );

    const [projectCount] = await this.db
      .select({ value: count() })
      .from(schema.projects);

    const [taskCount] = await this.db
      .select({ value: count() })
      .from(schema.tasks);

    const [failedTaskCount] = await this.db
      .select({ value: count() })
      .from(schema.tasks)
      .where(eq(schema.tasks.status, 'failed'));

    const [storageResult] = await this.db
      .select({ value: sql<number>`COALESCE(SUM(${schema.files.size}), 0)` })
      .from(schema.files);

    const [galleryCount] = await this.db
      .select({ value: count() })
      .from(schema.galleryWorks);

    const [publishedGalleryCount] = await this.db
      .select({ value: count() })
      .from(schema.galleryWorks)
      .where(eq(schema.galleryWorks.isPublished, true));

    const [creditsResult] = await this.db
      .select({ value: sql<number>`COALESCE(SUM(${schema.users.credits}), 0)` })
      .from(schema.users);

    const [bannedUserCount] = await this.db
      .select({ value: count() })
      .from(schema.users)
      .where(eq(schema.users.isActive, false));

    return {
      totalUsers: userCount?.value ?? 0,
      activeUsers: activeUserCount?.value ?? 0,
      totalProjects: projectCount?.value ?? 0,
      totalTasks: taskCount?.value ?? 0,
      failedTasks: failedTaskCount?.value ?? 0,
      totalStorage: Number(storageResult?.value ?? 0),
      totalGalleryWorks: galleryCount?.value ?? 0,
      publishedGalleryWorks: publishedGalleryCount?.value ?? 0,
      totalCreditsInCirculation: Number(creditsResult?.value ?? 0),
      bannedUsers: bannedUserCount?.value ?? 0,
    };
  }

  // ===== User Management =====

  async getUsers(page = 1, limit = 20, search?: string) {
    const offset = (page - 1) * limit;

    const conditions = search
      ? sql`(${schema.users.email} ILIKE ${'%' + search + '%'} OR ${schema.users.name} ILIKE ${'%' + search + '%'})`
      : sql`TRUE`;

    const users = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        avatar: schema.users.avatar,
        role: schema.users.role,
        credits: schema.users.credits,
        isActive: schema.users.isActive,
        isEmailVerified: schema.users.isEmailVerified,
        lastLoginAt: schema.users.lastLoginAt,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(conditions)
      .orderBy(desc(schema.users.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await this.db
      .select({ value: count() })
      .from(schema.users)
      .where(conditions);
    const total = Number(countResult[0]?.value ?? 0);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async banUser(userId: string) {
    const [user] = await this.db
      .select({ id: schema.users.id, isActive: schema.users.isActive, role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    if (user.role === 'admin') {
      throw new ForbiddenException('不能封禁管理员账户');
    }
    if (!user.isActive) {
      throw new BadRequestException('用户已被封禁');
    }

    const [updated] = await this.db
      .update(schema.users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        isActive: schema.users.isActive,
      });

    // Revoke all active sessions
    await this.db
      .update(schema.sessions)
      .set({ isRevoked: true })
      .where(and(eq(schema.sessions.userId, userId), eq(schema.sessions.isRevoked, false)));

    return updated;
  }

  async unbanUser(userId: string) {
    const [user] = await this.db
      .select({ id: schema.users.id, isActive: schema.users.isActive })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    if (user.isActive) {
      throw new BadRequestException('用户未被封禁');
    }

    const [updated] = await this.db
      .update(schema.users)
      .set({ isActive: true, failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        isActive: schema.users.isActive,
      });

    return updated;
  }

  async updateUserRole(userId: string, role: string) {
    if (role !== 'user' && role !== 'admin') {
      throw new BadRequestException('角色只能是 user 或 admin');
    }

    const [user] = await this.db
      .select({ id: schema.users.id, role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    if (user.role === role) {
      throw new BadRequestException(`用户角色已为 ${role}`);
    }

    const [updated] = await this.db
      .update(schema.users)
      .set({ role, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
      });

    return updated;
  }

  // ===== Gallery Moderation =====

  async getGalleryWorks(page = 1, limit = 20, status?: 'published' | 'unpublished') {
    const offset = (page - 1) * limit;

    const condition = status === 'published'
      ? eq(schema.galleryWorks.isPublished, true)
      : status === 'unpublished'
        ? eq(schema.galleryWorks.isPublished, false)
        : sql`TRUE`;

    const works = await this.db
      .select({
        id: schema.galleryWorks.id,
        userId: schema.galleryWorks.userId,
        title: schema.galleryWorks.title,
        type: schema.galleryWorks.type,
        prompt: schema.galleryWorks.prompt,
        modelSlug: schema.galleryWorks.modelSlug,
        isPublished: schema.galleryWorks.isPublished,
        likes: schema.galleryWorks.likes,
        views: schema.galleryWorks.views,
        createdAt: schema.galleryWorks.createdAt,
      })
      .from(schema.galleryWorks)
      .where(condition)
      .orderBy(desc(schema.galleryWorks.createdAt))
      .limit(limit)
      .offset(offset);

    const galleryCountResult = await this.db
      .select({ value: count() })
      .from(schema.galleryWorks)
      .where(condition);
    const galleryTotal = Number(galleryCountResult[0]?.value ?? 0);

    return {
      works,
      total: galleryTotal,
      page,
      limit,
      totalPages: Math.ceil(galleryTotal / limit),
    };
  }

  async unpublishWork(workId: string) {
    const [work] = await this.db
      .select({ id: schema.galleryWorks.id, isPublished: schema.galleryWorks.isPublished })
      .from(schema.galleryWorks)
      .where(eq(schema.galleryWorks.id, workId))
      .limit(1);

    if (!work) {
      throw new NotFoundException('作品不存在');
    }
    if (!work.isPublished) {
      throw new BadRequestException('作品未发布');
    }

    const [updated] = await this.db
      .update(schema.galleryWorks)
      .set({ isPublished: false, updatedAt: new Date() })
      .where(eq(schema.galleryWorks.id, workId))
      .returning({
        id: schema.galleryWorks.id,
        title: schema.galleryWorks.title,
        isPublished: schema.galleryWorks.isPublished,
      });

    return updated;
  }

  async deleteWork(workId: string) {
    const [work] = await this.db
      .select({ id: schema.galleryWorks.id })
      .from(schema.galleryWorks)
      .where(eq(schema.galleryWorks.id, workId))
      .limit(1);

    if (!work) {
      throw new NotFoundException('作品不存在');
    }

    await this.db
      .delete(schema.galleryWorks)
      .where(eq(schema.galleryWorks.id, workId));

    return { id: workId, deleted: true };
  }
}
