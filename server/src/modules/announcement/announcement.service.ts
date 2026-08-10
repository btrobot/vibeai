import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { announcements } from '../../db/schema/content';
import { eq, and, desc, sql, count, or, isNull, gt, lte } from 'drizzle-orm';
import type { CreateAnnouncementDto, UpdateAnnouncementDto, AnnouncementQueryDto } from './dto';

@Injectable()
export class AnnouncementService {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>) {}

  /**
   * 管理员：创建公告
   */
  async create(dto: CreateAnnouncementDto, createdBy?: string) {
    const [announcement] = await this.db.insert(announcements).values({
      title: dto.title,
      content: dto.content,
      type: dto.type,
      isActive: dto.isActive ?? true,
      isPinned: dto.isPinned ?? false,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      createdBy: createdBy ?? null,
    }).returning();

    return { success: true, data: announcement };
  }

  /**
   * 管理员：更新公告
   */
  async update(id: string, dto: UpdateAnnouncementDto) {
    const [existing] = await this.db.select().from(announcements)
      .where(eq(announcements.id, id)).limit(1);
    if (!existing) throw new NotFoundException('公告不存在');

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.content !== undefined) updateData.content = dto.content;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.isPinned !== undefined) updateData.isPinned = dto.isPinned;
    if (dto.scheduledAt !== undefined) updateData.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (dto.expiresAt !== undefined) updateData.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    const [updated] = await this.db.update(announcements)
      .set(updateData)
      .where(eq(announcements.id, id))
      .returning();

    return { success: true, data: updated };
  }

  /**
   * 管理员：删除公告
   */
  async delete(id: string) {
    const [existing] = await this.db.select().from(announcements)
      .where(eq(announcements.id, id)).limit(1);
    if (!existing) throw new NotFoundException('公告不存在');

    await this.db.delete(announcements).where(eq(announcements.id, id));
    return { success: true, message: '已删除' };
  }

  /**
   * 管理员：获取公告列表（含未发布）
   */
  async listForAdmin(query: AnnouncementQueryDto) {
    const page = query.page ? parseInt(query.page) : 1;
    const limit = query.limit ? parseInt(query.limit) : 20;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (query.type) conditions.push(eq(announcements.type, query.type));
    if (query.activeOnly === true) conditions.push(eq(announcements.isActive, true));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalResult] = await Promise.all([
      this.db.select().from(announcements)
        .where(where)
        .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(announcements).where(where),
    ]);

    const total = totalResult[0]?.total ?? 0;
    return {
      success: true,
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * 公开：获取当前生效的公告列表
   * - isActive = true
   * - scheduledAt 为 null 或 <= now
   * - expiresAt 为 null 或 > now
   */
  async listActive() {
    const now = new Date();
    const items = await this.db.select().from(announcements)
      .where(and(
        eq(announcements.isActive, true),
        or(isNull(announcements.scheduledAt), lte(announcements.scheduledAt, now)),
        or(isNull(announcements.expiresAt), gt(announcements.expiresAt, now)),
      ))
      .orderBy(desc(announcements.isPinned), desc(announcements.createdAt));

    return { success: true, data: items };
  }

  /**
   * 公开：获取单条公告
   */
  async getById(id: string) {
    const [item] = await this.db.select().from(announcements)
      .where(eq(announcements.id, id)).limit(1);
    if (!item) throw new NotFoundException('公告不存在');
    return { success: true, data: item };
  }
}
