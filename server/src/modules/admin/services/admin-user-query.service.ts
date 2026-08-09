import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../db/schema';
import { count, eq, sql, desc } from 'drizzle-orm';

@Injectable()
export class AdminUserQueryService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Get dashboard statistics
   */
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

  /**
   * Get paginated user list with optional search
   */
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

  /**
   * Get user by ID with full details
   */
  async getUserById(userId: string) {
    const [user] = await this.db
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
        updatedAt: schema.users.updatedAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    return user;
  }

  /**
   * Get paginated gallery works with optional status filter
   */
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

  /**
   * Search users by keyword (email or name)
   */
  async searchUsers(keyword: string, limit = 10) {
    const conditions = sql`(${schema.users.email} ILIKE ${'%' + keyword + '%'} OR ${schema.users.name} ILIKE ${'%' + keyword + '%'})`;

    const users = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        avatar: schema.users.avatar,
        role: schema.users.role,
      })
      .from(schema.users)
      .where(conditions)
      .limit(limit);

    return users;
  }
}
