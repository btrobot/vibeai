import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../db/schema';
import { sql, desc } from 'drizzle-orm';
import { generateCsv, CsvExportOptions } from './utils/csv-export.util';

@Injectable()
export class AdminExportService {
  private static readonly MAX_EXPORT_ROWS = 10000;

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Export users to CSV
   */
  async exportUsersToCsv(options: {
    search?: string;
    role?: 'user' | 'admin';
    status?: 'active' | 'banned';
    limit?: number;
    includeBOM?: boolean;
  } = {}) {
    const {
      search,
      role,
      status,
      limit = AdminExportService.MAX_EXPORT_ROWS,
      includeBOM = true,
    } = options;

    // Build conditions
    const conditions: any[] = [];

    if (search) {
      conditions.push(
        sql`(${schema.users.email} ILIKE ${'%' + search + '%'} OR ${schema.users.name} ILIKE ${'%' + search + '%'})`
      );
    }

    if (role) {
      conditions.push(sql`${schema.users.role} = ${role}`);
    }

    if (status === 'active') {
      conditions.push(sql`${schema.users.isActive} = true`);
    } else if (status === 'banned') {
      conditions.push(sql`${schema.users.isActive} = false`);
    }

    // Combine conditions
    const whereClause = conditions.length > 0
      ? sql`${conditions.reduce((acc, cond) => sql`${acc} AND ${cond}`)}`
      : sql`TRUE`;

    // Query users
    const users = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        credits: schema.users.credits,
        isActive: schema.users.isActive,
        isEmailVerified: schema.users.isEmailVerified,
        lastLoginAt: schema.users.lastLoginAt,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(whereClause)
      .orderBy(desc(schema.users.createdAt))
      .limit(Math.min(limit, AdminExportService.MAX_EXPORT_ROWS));

    // Get total count
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users)
      .where(whereClause);
    
    const totalCount = Number(countResult?.count ?? 0);

    // Transform data for CSV
    const csvData = users.map(user => ({
      ID: user.id,
      邮箱: user.email,
      姓名: user.name || '',
      角色: user.role,
      信用额度: user.credits,
      状态: user.isActive ? '正常' : '已封禁',
      邮箱验证: user.isEmailVerified ? '已验证' : '未验证',
      最后登录: user.lastLoginAt ? user.lastLoginAt.toISOString() : '从未登录',
      注册时间: user.createdAt.toISOString(),
    }));

    // Generate CSV
    const csvOptions: CsvExportOptions = {
      delimiter: ',',
      includeBOM,
    };

    const csv = generateCsv(csvData, csvOptions);

    // Add truncation warning if needed
    const totalRows = totalCount;
    const exportedRows = users.length;
    const truncated = totalRows > limit;

    let finalCsv = csv;
    if (truncated) {
      finalCsv += `\n"# 警告: 共 ${totalRows} 条数据，已截断为 ${exportedRows} 条，请缩小筛选范围"`;
    }

    return {
      csv: finalCsv,
      totalRows,
      exportedRows,
      truncated,
      filename: `users_${new Date().toISOString().split('T')[0]}.csv`,
    };
  }

  /**
   * Export gallery works to CSV
   */
  async exportGalleryToCsv(options: {
    status?: 'published' | 'unpublished';
    type?: string;
    limit?: number;
    includeBOM?: boolean;
  } = {}) {
    const {
      status,
      type,
      limit = AdminExportService.MAX_EXPORT_ROWS,
      includeBOM = true,
    } = options;

    // Build conditions
    const conditions: any[] = [];

    if (status === 'published') {
      conditions.push(sql`${schema.galleryWorks.isPublished} = true`);
    } else if (status === 'unpublished') {
      conditions.push(sql`${schema.galleryWorks.isPublished} = false`);
    }

    if (type) {
      conditions.push(sql`${schema.galleryWorks.type} = ${type}`);
    }

    const whereClause = conditions.length > 0
      ? sql`${conditions.reduce((acc, cond) => sql`${acc} AND ${cond}`)}`
      : sql`TRUE`;

    // Query works
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
      .where(whereClause)
      .orderBy(desc(schema.galleryWorks.createdAt))
      .limit(Math.min(limit, AdminExportService.MAX_EXPORT_ROWS));

    // Get total count
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.galleryWorks)
      .where(whereClause);
    
    const totalCount = Number(countResult?.count ?? 0);

    // Transform data for CSV
    const csvData = works.map(work => ({
      ID: work.id,
      用户ID: work.userId,
      标题: work.title || '',
      类型: work.type,
      提示词: work.prompt || '',
      模型: work.modelSlug || '',
      发布状态: work.isPublished ? '已发布' : '未发布',
      点赞数: work.likes,
      浏览量: work.views,
      创建时间: work.createdAt.toISOString(),
    }));

    // Generate CSV
    const csv = generateCsv(csvData, {
      delimiter: ',',
      includeBOM,
    });

    const totalRows = totalCount;
    const exportedRows = works.length;
    const truncated = totalRows > limit;

    let finalCsv = csv;
    if (truncated) {
      finalCsv += `\n"# 警告: 共 ${totalRows} 条数据，已截断为 ${exportedRows} 条，请缩小筛选范围"`;
    }

    return {
      csv: finalCsv,
      totalRows,
      exportedRows,
      truncated,
      filename: `gallery_${new Date().toISOString().split('T')[0]}.csv`,
    };
  }
}
