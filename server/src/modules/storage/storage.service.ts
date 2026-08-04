import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { files } from '../../db/schema/files';
import { eq, and, like, desc, count, sql } from 'drizzle-orm';
import { IStorageProvider } from './interfaces/storage-provider.interface';
import type { UploadFileInput, ListFilesQuery, FileResponse } from './dto';
import axios from 'axios';

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

  /**
   * Read a file by its storage key (for serving via API)
   * Infers Content-Type from file extension for proper browser rendering.
   */
  async readFile(storageKey: string): Promise<{ data: Buffer; contentType: string } | null> {
    try {
      const result = await this.provider.read(storageKey);
      // Infer content type from extension since local provider returns generic type
      const ext = storageKey.split('.').pop()?.toLowerCase() ?? '';
      const mimeMap: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        mp4: 'video/mp4',
        webm: 'video/webm',
        mov: 'video/quicktime',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        pdf: 'application/pdf',
        json: 'application/json',
        txt: 'text/plain',
        csv: 'text/csv',
      };
      const contentType = mimeMap[ext] ?? result.contentType;
      return { data: result.data, contentType };
    } catch {
      return null;
    }
  }

  /**
   * 从 URL 下载文件并转存到我们的存储
   * 用于 AI 生成结果的持久化（确定性转存）
   */
  async downloadAndStore(
    userId: string,
    sourceUrl: string,
    fileName: string,
    contentType: string,
    category: string = 'generated',
  ): Promise<{ fileId: string; url: string }> {
    this.logger.log(`Downloading from ${sourceUrl} for user ${userId}`);

    // 1. 下载
    const response = await axios.get(sourceUrl, {
      responseType: 'arraybuffer',
      timeout: 120000,
      maxContentLength: 500 * 1024 * 1024, // 500MB max
    });
    const buffer = Buffer.from(response.data);

    // 2. 上传到我们的存储
    const uploadResult = await this.provider.upload({
      fileContent: buffer,
      fileName,
      contentType,
      userId,
      category,
      isPublic: false,
    });

    // 3. 记录到 files 表
    const [record] = await this.db
      .insert(files)
      .values({
        userId,
        originalName: fileName,
        mimeType: contentType,
        size: buffer.length,
        category,
        storageKey: uploadResult.key,
        url: uploadResult.url,
        isPublic: false,
      })
      .returning();

    this.logger.log(`File stored: ${record.id} (${fileName}, ${buffer.length} bytes) by user ${userId}`);

    return { fileId: record.id, url: uploadResult.url };
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