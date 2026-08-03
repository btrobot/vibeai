import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { galleryWorks, galleryLikes } from '../../db/schema/gallery';
import { eq, and, desc, asc, sql, count } from 'drizzle-orm';

@Injectable()
export class GalleryService {
  constructor(
    @Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>,
  ) {}

  async listWorks(params: {
    type?: string;
    sort?: string;
    page?: number;
    limit?: number;
    userId?: string;
  }) {
    const { type, sort = 'latest', page = 1, limit = 20, userId } = params;
    const offset = (page - 1) * limit;

    const conditions = [eq(galleryWorks.isPublished, true)];
    if (type) conditions.push(eq(galleryWorks.type, type));
    if (userId) conditions.push(eq(galleryWorks.userId, userId));

    const orderBy = sort === 'popular'
      ? desc(galleryWorks.likes)
      : desc(galleryWorks.createdAt);

    const [works, totalResult] = await Promise.all([
      this.db.select().from(galleryWorks)
        .where(and(...conditions))
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(galleryWorks)
        .where(and(...conditions)),
    ]);

    const total = totalResult[0]?.total ?? 0;

    return {
      success: true,
      data: works,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getWork(workId: string) {
    const [work] = await this.db.select().from(galleryWorks)
      .where(eq(galleryWorks.id, workId))
      .limit(1);

    if (!work) {
      return { success: false, message: '作品不存在' };
    }

    // Increment views
    await this.db.update(galleryWorks)
      .set({ views: work.views + 1 })
      .where(eq(galleryWorks.id, workId));

    return { success: true, data: { ...work, views: work.views + 1 } };
  }

  async publishWork(userId: string, input: {
    taskId?: string;
    title?: string;
    imageUrl?: string;
    videoUrl?: string;
    type: string;
    prompt?: string;
    modelSlug?: string;
    capabilitySlug?: string;
    thumbnailUrl?: string;
  }) {
    const [work] = await this.db.insert(galleryWorks).values({
      userId,
      title: input.title || '',
      imageUrl: input.imageUrl || null,
      videoUrl: input.videoUrl || null,
      type: input.type,
      prompt: input.prompt || null,
      modelSlug: input.modelSlug || null,
      capabilitySlug: input.capabilitySlug || null,
      thumbnailUrl: input.thumbnailUrl || null,
      isPublished: true,
    }).returning();

    return { success: true, data: work };
  }

  async toggleLike(workId: string, userId: string) {
    const [work] = await this.db.select().from(galleryWorks)
      .where(eq(galleryWorks.id, workId))
      .limit(1);

    if (!work) {
      return { success: false, message: '作品不存在' };
    }

    const [existingLike] = await this.db.select().from(galleryLikes)
      .where(and(
        eq(galleryLikes.workId, workId),
        eq(galleryLikes.userId, userId),
      ))
      .limit(1);

    if (existingLike) {
      // Unlike
      await this.db.delete(galleryLikes)
        .where(and(
          eq(galleryLikes.workId, workId),
          eq(galleryLikes.userId, userId),
        ));
      await this.db.update(galleryWorks)
        .set({ likes: Math.max(0, work.likes - 1) })
        .where(eq(galleryWorks.id, workId));
      return { success: true, data: { liked: false, likes: work.likes - 1 } };
    } else {
      // Like
      await this.db.insert(galleryLikes).values({ workId, userId });
      await this.db.update(galleryWorks)
        .set({ likes: work.likes + 1 })
        .where(eq(galleryWorks.id, workId));
      return { success: true, data: { liked: true, likes: work.likes + 1 } };
    }
  }

  async checkLike(workId: string, userId: string) {
    const [like] = await this.db.select().from(galleryLikes)
      .where(and(
        eq(galleryLikes.workId, workId),
        eq(galleryLikes.userId, userId),
      ))
      .limit(1);
    return { success: true, data: { liked: !!like } };
  }

  async deleteWork(workId: string, userId: string) {
    const [work] = await this.db.select().from(galleryWorks)
      .where(eq(galleryWorks.id, workId))
      .limit(1);

    if (!work) {
      return { success: false, message: '作品不存在' };
    }
    if (work.userId !== userId) {
      return { success: false, message: '无权删除此作品' };
    }

    await this.db.delete(galleryWorks).where(eq(galleryWorks.id, workId));
    return { success: true, message: '已删除' };
  }
}