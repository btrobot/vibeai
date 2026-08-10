import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { galleryWorks, galleryLikes } from '../../db/schema/gallery';
import { galleryPublications } from '../../db/schema/content';
import { creates } from '../../db/schema/task-engine';
import { eq, and, desc, asc, sql, count, or, isNull, gt, inArray } from 'drizzle-orm';
import type { StorageService } from '../storage/storage.service';

@Injectable()
export class GalleryService {
  constructor(
    @Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>,
    @Inject('STORAGE_SERVICE') private storageService: StorageService,
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

    const resolvedWorks = await this.resolveWorksUrls(works);

    return {
      success: true,
      data: resolvedWorks,
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

    const [resolved] = await this.resolveWorksUrls([work]);
    return { success: true, data: { ...resolved, views: work.views + 1 } };
  }

  /**
   * Resolve imageFileId/videoFileId to URLs for a list of works.
   * Falls back to legacy imageUrl/videoUrl if fileId is null.
   */
  private async resolveWorksUrls(works: Array<typeof galleryWorks.$inferSelect>): Promise<Array<typeof galleryWorks.$inferSelect & { imageUrl: string | null; videoUrl: string | null }>> {
    const fileIds: string[] = [];
    for (const w of works) {
      if (w.imageFileId) fileIds.push(w.imageFileId);
      if (w.videoFileId) fileIds.push(w.videoFileId);
    }

    if (fileIds.length === 0) {
      return works as Array<typeof galleryWorks.$inferSelect & { imageUrl: string | null; videoUrl: string | null }>;
    }

    const urlMap = await this.storageService.resolveUrls(fileIds);

    return works.map((w) => ({
      ...w,
      imageUrl: (w.imageFileId && urlMap.get(w.imageFileId)) || w.imageUrl,
      videoUrl: (w.videoFileId && urlMap.get(w.videoFileId)) || w.videoUrl,
    })) as Array<typeof galleryWorks.$inferSelect & { imageUrl: string | null; videoUrl: string | null }>;
  }

  async publishWork(userId: string, input: {
    createId?: string;
    taskId?: string;
    title?: string;
    imageFileId?: string;
    videoFileId?: string;
    imageUrl?: string;
    videoUrl?: string;
    type: string;
    prompt?: string;
    modelSlug?: string;
    capabilitySlug?: string;
    thumbnailUrl?: string;
  }) {
    // If createId is provided, auto-populate fields from the Create record
    let autoTitle = input.title;
    let autoPrompt = input.prompt;
    let autoModelSlug = input.modelSlug;
    let autoCapabilitySlug = input.capabilitySlug;
    let autoImageFileId = input.imageFileId ?? null;
    let autoVideoFileId = input.videoFileId ?? null;
    let autoImageUrl = input.imageUrl ?? null;
    let autoVideoUrl = input.videoUrl ?? null;

    if (input.createId) {
      const [create] = await this.db.select().from(creates)
        .where(and(eq(creates.id, input.createId), eq(creates.userId, userId)))
        .limit(1);

      if (create) {
        autoPrompt = autoPrompt || create.prompt;
        autoModelSlug = autoModelSlug || create.modelSlug || undefined;
        autoCapabilitySlug = autoCapabilitySlug || create.capabilitySlug;

        // Extract fileIds from create output (transferResult stores { url, fileId })
        const output = (create.output ?? {}) as Record<string, unknown>;
        if (!autoImageFileId && Array.isArray(output.images) && output.images.length > 0) {
          const firstImage = (output.images as Array<{ fileId?: string; url?: string }>)[0];
          if (firstImage?.fileId) {
            autoImageFileId = firstImage.fileId;
          } else if (firstImage?.url) {
            autoImageUrl = firstImage.url;
          }
        }
        if (!autoVideoFileId && output.video && typeof output.video === 'object') {
          const video = output.video as { fileId?: string; url?: string };
          if (video.fileId) {
            autoVideoFileId = video.fileId;
          } else if (video.url) {
            autoVideoUrl = video.url;
          }
        }
        if (!autoTitle) {
          autoTitle = create.prompt.slice(0, 50);
        }
      }
    }

    const [work] = await this.db.insert(galleryWorks).values({
      userId,
      title: autoTitle || '',
      imageFileId: autoImageFileId,
      videoFileId: autoVideoFileId,
      imageUrl: autoImageUrl,
      videoUrl: autoVideoUrl,
      type: input.type,
      prompt: autoPrompt || null,
      modelSlug: autoModelSlug || null,
      capabilitySlug: autoCapabilitySlug || null,
      thumbnailUrl: input.thumbnailUrl || null,
      isPublished: true,
    }).returning();

    const [resolved] = await this.resolveWorksUrls([work]);
    return { success: true, data: resolved };
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
  // ===== Gallery Publication Management =====

  /**
   * 发布作品到公开画廊（创建 publication 记录）
   */
  async publishWorkToGallery(workId: string, options?: { isFeatured?: boolean; featuredOrder?: number; expiresAt?: string }) {
    const [work] = await this.db.select().from(galleryWorks)
      .where(eq(galleryWorks.id, workId)).limit(1);
    if (!work) return { success: false, message: '作品不存在' };

    // 确保 work 已标记为 published
    if (!work.isPublished) {
      await this.db.update(galleryWorks)
        .set({ isPublished: true })
        .where(eq(galleryWorks.id, workId));
    }

    // upsert publication
    const [existingPub] = await this.db.select().from(galleryPublications)
      .where(eq(galleryPublications.workId, workId)).limit(1);

    if (existingPub) {
      const [updated] = await this.db.update(galleryPublications)
        .set({
          isFeatured: options?.isFeatured ?? existingPub.isFeatured,
          featuredOrder: options?.featuredOrder ?? existingPub.featuredOrder,
          expiresAt: options?.expiresAt ? new Date(options.expiresAt) : existingPub.expiresAt,
        })
        .where(eq(galleryPublications.workId, workId))
        .returning();
      return { success: true, data: updated };
    }

    const [created] = await this.db.insert(galleryPublications).values({
      workId,
      isFeatured: options?.isFeatured ?? false,
      featuredOrder: options?.featuredOrder ?? 0,
      expiresAt: options?.expiresAt ? new Date(options.expiresAt) : null,
    }).returning();

    return { success: true, data: created };
  }

  /**
   * 从公开画廊下架作品（删除 publication 记录）
   */
  async unpublishFromGallery(workId: string) {
    const [work] = await this.db.select().from(galleryWorks)
      .where(eq(galleryWorks.id, workId)).limit(1);
    if (!work) return { success: false, message: '作品不存在' };

    await this.db.update(galleryWorks)
      .set({ isPublished: false })
      .where(eq(galleryWorks.id, workId));

    await this.db.delete(galleryPublications)
      .where(eq(galleryPublications.workId, workId));

    return { success: true, message: '已下架' };
  }

  /**
   * 获取推荐作品列表
   */
  async listFeaturedWorks(limit = 10) {
    const now = new Date();
    const publications = await this.db.select().from(galleryPublications)
      .where(and(
        eq(galleryPublications.isFeatured, true),
        or(isNull(galleryPublications.expiresAt), gt(galleryPublications.expiresAt, now)),
      ))
      .orderBy(asc(galleryPublications.featuredOrder), desc(galleryPublications.publishedAt))
      .limit(limit);

    if (publications.length === 0) {
      return { success: true, data: [] };
    }

    const workIds = publications.map(p => p.workId);
    const works = await this.db.select().from(galleryWorks)
      .where(inArray(galleryWorks.id, workIds));

    const resolvedWorks = await this.resolveWorksUrls(works);
    return { success: true, data: resolvedWorks };
  }

  /**
   * 检查访问权限
   */
  async canAccessWork(workId: string, userId?: string): Promise<boolean> {
    const [pub] = await this.db.select().from(galleryPublications)
      .where(eq(galleryPublications.workId, workId)).limit(1);

    if (pub) {
      if (!pub.expiresAt || pub.expiresAt > new Date()) {
        return true;
      }
    }

    if (userId) {
      const [work] = await this.db.select().from(galleryWorks)
        .where(and(eq(galleryWorks.id, workId), eq(galleryWorks.userId, userId)))
        .limit(1);
      return !!work;
    }

    return false;
  }
}
