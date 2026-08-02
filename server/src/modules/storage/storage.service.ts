import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { files } from '../../db/schema/files';
import { eq, and, like, desc, count, sql } from 'drizzle-orm';
import { IStorageProvider } from './interfaces/storage-provider.interface';
import type { UploadFileInput, ListFilesQuery, FileResponse } from './dto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    @Inject('STORAGE_PROVIDER') private readonly provider: IStorageProvider,
  ) {}

  async uploadFile(
    userId: string,
    file: Express.Multer.File,
    input: UploadFileInput,
  ): Promise<FileResponse> {
    const category = input.category || 'temp';
    const uploadResult = await this.provider.upload({
      fileContent: file.buffer,
      fileName: file.originalname,
      contentType: file.mimetype,
      userId,
      category,
      isPublic: input.isPublic,
    });

    const [record] = await this.db
      .insert(files)
      .values({
        userId,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        category,
        storageKey: uploadResult.key,
        url: uploadResult.url,
        isPublic: input.isPublic ?? false,
      })
      .returning();

    this.logger.log(`File uploaded: ${record.id} by user ${userId}`);
    return this.toResponse(record);
  }

  async listFiles(userId: string, query: ListFilesQuery) {
    const { category, page, pageSize, search } = query;
    const conditions = [eq(files.userId, userId)];

    if (category) {
      conditions.push(eq(files.category, category));
    }

    if (search) {
      conditions.push(like(files.originalName, `%${search}%`));
    }

    const whereClause = and(...conditions);

    const [totalResult] = await this.db
      .select({ total: count() })
      .from(files)
      .where(whereClause);

    const total = Number(totalResult?.total || 0);
    const offset = (page - 1) * pageSize;

    const records = await this.db
      .select()
      .from(files)
      .where(whereClause)
      .orderBy(desc(files.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      items: records.map((r) => this.toResponse(r)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getFileDetail(userId: string, fileId: string): Promise<FileResponse | null> {
    const [record] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
      .limit(1);

    if (!record) return null;

    const signedUrl = await this.provider.getSignedUrl(record.storageKey);
    return this.toResponse({ ...record, url: signedUrl });
  }

  async deleteFile(userId: string, fileId: string): Promise<boolean> {
    const [record] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
      .limit(1);

    if (!record) return false;

    await this.provider.delete(record.storageKey);

    await this.db.delete(files).where(eq(files.id, fileId));

    this.logger.log(`File deleted: ${fileId} by user ${userId}`);
    return true;
  }

  async getSignedUrl(userId: string, fileId: string): Promise<string | null> {
    const [record] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
      .limit(1);

    if (!record) return null;

    return this.provider.getSignedUrl(record.storageKey);
  }

  async getStorageStats(userId: string) {
    const result = await this.db
      .select({
        category: files.category,
        count: count(),
        totalSize: sql<number>`COALESCE(SUM(${files.size}), 0)::bigint`,
      })
      .from(files)
      .where(eq(files.userId, userId))
      .groupBy(files.category);

    const totalFiles = result.reduce((acc, r) => acc + Number(r.count), 0);
    const totalSize = result.reduce((acc, r) => acc + Number(r.totalSize), 0);

    const byCategory: Record<string, { count: number; size: number }> = {};
    for (const row of result) {
      byCategory[row.category] = {
        count: Number(row.count),
        size: Number(row.totalSize),
      };
    }

    return { totalFiles, totalSize, byCategory };
  }

  private toResponse(
    record: typeof files.$inferSelect,
  ): FileResponse {
    return {
      id: record.id,
      userId: record.userId,
      originalName: record.originalName,
      mimeType: record.mimeType,
      size: record.size,
      category: record.category as FileResponse['category'],
      storageKey: record.storageKey,
      url: record.url,
      isPublic: record.isPublic,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}