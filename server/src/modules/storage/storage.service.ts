import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { files } from '../../db/schema/files';
import { eq, and, like, desc, count, sql, inArray } from 'drizzle-orm';
import { IStorageProvider } from './interfaces/storage-provider.interface';
import type { UploadFileInput, ListFilesQuery, FileResponse } from './dto';
import axios from 'axios';
import sharp from 'sharp';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    @Inject('STORAGE_PROVIDER') private readonly provider: IStorageProvider,
  ) {}

  // ===== URL Resolution (runtime, not persisted) =====

  /**
   * Resolve a single fileId to a URL.
   * storage → /api/storage/serve/{storageKey}
   * external → externalUrl
   */
  async resolveUrl(fileId: string): Promise<string | null> {
    const [record] = await this.db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (!record) return null;
    return this.resolveUrlFromRecord(record);
  }

  /**
   * Batch resolve multiple fileIds to URLs.
   * Returns a Map<fileId, url>.
   */
  async resolveUrls(fileIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (fileIds.length === 0) return result;

    const records = await this.db
      .select()
      .from(files)
      .where(inArray(files.id, fileIds));

    for (const record of records) {
      const url = this.resolveUrlFromRecord(record);
      if (url) result.set(record.id, url);
    }
    return result;
  }

  private resolveUrlFromRecord(record: typeof files.$inferSelect): string | null {
    // External files: return externalUrl
    if (record.source === 'external') {
      return record.externalUrl;
    }
    // Storage files: prefer explicit url (e.g. signed URL), fallback to serve URL from storageKey
    if (record.url) return record.url;
    if (record.storageKey) return `/api/storage/serve/${record.storageKey}`;
    return null;
  }

  // ===== External File Registration (virtual file) =====

  /**
   * Register an external URL as a virtual file record.
   * No physical download — just a metadata entry with source='external'.
   */
  async registerExternalFile(
    userId: string,
    externalUrl: string,
    options?: { originalName?: string; mimeType?: string; category?: string },
  ): Promise<{ fileId: string; url: string }> {
    const [record] = await this.db
      .insert(files)
      .values({
        userId,
        originalName: options?.originalName || externalUrl.split('/').pop()?.split('?')[0] || 'external',
        mimeType: options?.mimeType || 'application/octet-stream',
        size: 0,
        category: options?.category || 'temp',
        source: 'external',
        storageKey: null,
        externalUrl,
        url: null,
        isPublic: true,
      })
      .returning();

    this.logger.log(`External file registered: ${record.id} → ${externalUrl}`);
    return { fileId: record.id, url: externalUrl };
  }

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
        source: 'storage',
        storageKey: uploadResult.key,
        externalUrl: null,
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

    // External files: URL is the externalUrl directly
    if (record.source === 'external') {
      return this.toResponse(record);
    }

    // Storage files: resolve signed URL
    const signedUrl = record.storageKey
      ? await this.provider.getSignedUrl(record.storageKey)
      : record.url;
    return this.toResponse({ ...record, url: signedUrl });
  }

  async deleteFile(userId: string, fileId: string): Promise<boolean> {
    const [record] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
      .limit(1);

    if (!record) return false;

    // Only delete physical file for storage source
    if (record.source === 'storage' && record.storageKey) {
      await this.provider.delete(record.storageKey);
    }

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

    // External files: return externalUrl directly
    if (record.source === 'external') {
      return record.externalUrl;
    }

    // Storage files: get signed URL from provider
    if (!record.storageKey) return record.url;
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

  // ===== 图片变体（?w= 动态缩放，sharp） =====

  /** 支持 ?w= 动态缩放的图片类型（其余类型原样返回） */
  static isResizableImage(contentType: string): boolean {
    return ['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(contentType);
  }

  /** 解析 ?w= 参数：整数且在 [16, 4096] 内才生效，否则视为未指定（返回 undefined） */
  static parseResizeWidth(w: unknown): number | undefined {
    if (typeof w !== 'string' || !/^\d+$/.test(w)) return undefined;
    const n = Number(w);
    if (!Number.isInteger(n) || n < 16 || n > 4096) return undefined;
    return n;
  }

  /** 缩放到指定宽度并转 WebP（不放大、保留 EXIF 方向） */
  async resizeToWebp(data: Buffer, width: number): Promise<Buffer> {
    return sharp(data)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
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
    // 日志脱敏：data URL（如 AI 返回的 b64_json 转存）可能含整幅图像，只打类型与长度
    const logSource = sourceUrl.startsWith('data:')
      ? `data:…(${sourceUrl.length} chars)`
      : sourceUrl;
    this.logger.log(`Downloading from ${logSource} for user ${userId}`);

    // 1. 下载
    // 某些 AI 平台返回的 URL（如 Replicate 的 replicate.delivery）会重定向到 CDN，
    // 且部分 CDN 会拒绝无 User-Agent 的请求，因此显式设置 UA 提升兼容性
    const response = await axios.get(sourceUrl, {
      responseType: 'arraybuffer',
      timeout: 120000,
      maxContentLength: 500 * 1024 * 1024, // 500MB max
      maxRedirects: 5,
      headers: { 'User-Agent': 'VibeAI/1.0 (+https://github.com/btrobot/vibeai)' },
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
        source: 'storage',
        storageKey: uploadResult.key,
        externalUrl: null,
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
    // Resolve URL at response time
    const url = this.resolveUrlFromRecord(record) ?? record.url ?? null;
    return {
      id: record.id,
      userId: record.userId,
      originalName: record.originalName,
      mimeType: record.mimeType,
      size: record.size,
      category: record.category as FileResponse['category'],
      source: (record.source as 'storage' | 'external') ?? 'storage',
      storageKey: record.storageKey,
      externalUrl: record.externalUrl,
      url,
      isPublic: record.isPublic,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}