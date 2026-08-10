import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { systemSettings } from '../../db/schema/content';
import { eq, and } from 'drizzle-orm';
import type { UpsertSettingDto, SettingQueryDto, ImportSettingsDto } from './dto';
import { EmailService } from '../../common/email.service';

@Injectable()
export class SystemConfigService {
  private readonly logger = new Logger(SystemConfigService.name);

  constructor(
    @Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>,
    private readonly emailService: EmailService,
  ) {}

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

  /**
   * 管理员：导出所有配置
   */
  async exportAll() {
    const items = await this.db.select().from(systemSettings);
    return { success: true, data: items };
  }

  /**
   * 管理员：批量导入配置（upsert）
   */
  async importAll(dto: ImportSettingsDto) {
    let created = 0;
    let updated = 0;

    for (const item of dto.settings) {
      const [existing] = await this.db.select().from(systemSettings)
        .where(eq(systemSettings.key, item.key)).limit(1);

      if (existing) {
        await this.db.update(systemSettings)
          .set({
            value: item.value,
            category: item.category,
            description: item.description ?? null,
            isPublic: item.isPublic ?? true,
            updatedAt: new Date(),
          })
          .where(eq(systemSettings.key, item.key));
        updated++;
      } else {
        await this.db.insert(systemSettings).values({
          key: item.key,
          value: item.value,
          category: item.category,
          description: item.description ?? null,
          isPublic: item.isPublic ?? true,
        });
        created++;
      }
    }

    return { success: true, data: { created, updated, total: dto.settings.length } };
  }

  /**
   * 测试邮件连通性
   */
  async testEmail(to: string) {
    const enabled = this.emailService.isEmailEnabled();
    if (!enabled) {
      return {
        success: false,
        message: '邮件服务未配置（缺少 SMTP_HOST/SMTP_USER/SMTP_PASS 环境变量）',
      };
    }

    try {
      const sent = await this.emailService.sendEmail({
        to,
        subject: 'VibeAI 系统配置测试邮件',
        html: '<p>这是一封来自 VibeAI 系统配置管理的测试邮件。</p><p>如果您收到此邮件，说明 SMTP 配置正常。</p>',
      });

      if (sent) {
        return { success: true, message: `测试邮件已发送至 ${to}` };
      }
      return { success: false, message: '邮件发送失败，请检查 SMTP 配置' };
    } catch (err) {
      return { success: false, message: `邮件发送失败: ${(err as Error).message}` };
    }
  }

  /**
   * 测试存储连通性
   */
  async testStorage() {
    const provider = process.env.STORAGE_PROVIDER || 'local';
    const bucket = process.env.S3_BUCKET_NAME || process.env.COZE_BUCKET_NAME;
    const endpoint = process.env.S3_ENDPOINT_URL || process.env.COZE_BUCKET_ENDPOINT_URL;

    if (provider === 's3') {
      if (!bucket || !endpoint) {
        return {
          success: false,
          message: 'S3 存储未完整配置（缺少 S3_BUCKET_NAME 或 S3_ENDPOINT_URL）',
          details: { provider, bucket: bucket ?? null, endpoint: endpoint ?? null },
        };
      }
      return {
        success: true,
        message: 'S3 存储配置正常',
        details: { provider, bucket, endpoint },
      };
    }

    // Local storage
    return {
      success: true,
      message: '本地存储模式（文件存储在服务器本地）',
      details: { provider: 'local' },
    };
  }
}
