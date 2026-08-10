import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { systemSettings } from '../../db/schema/content';
import { eq, and } from 'drizzle-orm';
import type { UpsertSettingDto, SettingQueryDto } from './dto';

@Injectable()
export class SystemConfigService {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>) {}

  /**
   * 管理员：创建或更新配置（upsert）
   */
  async upsert(dto: UpsertSettingDto) {
    const [existing] = await this.db.select().from(systemSettings)
      .where(eq(systemSettings.key, dto.key)).limit(1);

    if (existing) {
      const [updated] = await this.db.update(systemSettings)
        .set({
          value: dto.value,
          category: dto.category,
          description: dto.description ?? null,
          isPublic: dto.isPublic ?? true,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.key, dto.key))
        .returning();
      return { success: true, data: updated };
    }

    const [created] = await this.db.insert(systemSettings).values({
      key: dto.key,
      value: dto.value,
      category: dto.category,
      description: dto.description ?? null,
      isPublic: dto.isPublic ?? true,
    }).returning();

    return { success: true, data: created };
  }

  /**
   * 管理员：获取所有配置
   */
  async listForAdmin(query: SettingQueryDto) {
    const conditions = [];
    if (query.category) conditions.push(eq(systemSettings.category, query.category));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const items = await this.db.select().from(systemSettings).where(where);
    return { success: true, data: items };
  }

  /**
   * 公开：获取公开配置（按分类）
   */
  async listPublic(category?: string) {
    const conditions = [eq(systemSettings.isPublic, true)];
    if (category) conditions.push(eq(systemSettings.category, category));

    const items = await this.db.select().from(systemSettings)
      .where(and(...conditions));
    return { success: true, data: items };
  }

  /**
   * 公开：获取单个配置
   */
  async getByKey(key: string) {
    const [item] = await this.db.select().from(systemSettings)
      .where(eq(systemSettings.key, key)).limit(1);
    if (!item) throw new NotFoundException(`配置 ${key} 不存在`);
    return { success: true, data: item };
  }

  /**
   * 管理员：删除配置
   */
  async delete(key: string) {
    const [existing] = await this.db.select().from(systemSettings)
      .where(eq(systemSettings.key, key)).limit(1);
    if (!existing) throw new NotFoundException(`配置 ${key} 不存在`);

    await this.db.delete(systemSettings).where(eq(systemSettings.key, key));
    return { success: true, message: '已删除' };
  }
}
