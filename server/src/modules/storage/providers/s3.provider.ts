import { Injectable, Logger } from '@nestjs/common';
import { S3Storage } from 'coze-coding-dev-sdk';
import type {
  IStorageProvider,
  UploadOptions,
  UploadResult,
  ReadResult,
  ListOptions,
  ListResult,
  StorageStats,
} from '../interfaces/storage-provider.interface';

@Injectable()
export class S3StorageProvider implements IStorageProvider {
  /**
   * 基于 coze-coding-dev-sdk 的 S3Storage（AWS S3 协议），兼容自建 S3 服务（MinIO 等）。
   * 已验证：upload/read/delete/exists/list 走标准 S3 协议，对 MinIO 可用。
   *
   * 注意：SDK 的 generatePresignedUrl 依赖 coze 云平台（x-storage-token），
   * 自建 S3/MinIO 下不可用。因此本 Provider 统一返回 serve 路径
   * （/api/storage/serve/{key}，经 readFile → GetObject 转发），
   * 与 LocalStorageProvider 行为一致，且 URL 永不过期。
   */
  private readonly logger = new Logger(S3StorageProvider.name);
  private storage: S3Storage;

  constructor() {
    // SDK reads COZE_BUCKET_ENDPOINT_URL / COZE_BUCKET_NAME as defaults.
    // Explicit env vars (S3_*) take precedence for backward compatibility.
    const endpointUrl = process.env.S3_ENDPOINT_URL || process.env.COZE_BUCKET_ENDPOINT_URL;
    const bucketName = process.env.S3_BUCKET_NAME || process.env.COZE_BUCKET_NAME || 'vibeai';
    const accessKey = process.env.S3_ACCESS_KEY || '';
    const secretKey = process.env.S3_SECRET_KEY || '';
    const region = process.env.S3_REGION || 'cn-beijing';

    if (!endpointUrl) {
      this.logger.warn(
        'S3 endpoint URL not configured. Set S3_ENDPOINT_URL or COZE_BUCKET_ENDPOINT_URL. ' +
        'Storage operations will fail until configured.',
      );
    }

    this.storage = new S3Storage({
      endpointUrl,
      accessKey,
      secretKey,
      bucketName,
      region,
    });

    this.logger.log(`S3 storage provider initialized (bucket: ${bucketName}, region: ${region})`);
  }

  getKeyPrefix(userId: string, category: string): string {
    return `users/${userId}/${category}`;
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    const prefix = this.getKeyPrefix(options.userId, options.category || 'temp');
    const fileName = `${prefix}/${options.fileName}`;

    const key = await this.storage.uploadFile({
      fileContent: Buffer.from(options.fileContent),
      fileName,
      contentType: options.contentType,
    });

    // 不使用 SDK 的 generatePresignedUrl（依赖 coze 平台，自建 MinIO 不可用），
    // 统一返回 serve 路径，经 readFile → S3 GetObject 转发，永不过期。
    const url = `/api/storage/serve/${key}`;

    return {
      key,
      url,
      size: options.fileContent.length,
    };
  }

  async read(key: string): Promise<ReadResult> {
    const data = await this.storage.readFile({ fileKey: key });
    return {
      data,
      contentType: 'application/octet-stream',
    };
  }

  async delete(key: string): Promise<boolean> {
    return this.storage.deleteFile({ fileKey: key });
  }

  async exists(key: string): Promise<boolean> {
    return this.storage.fileExists({ fileKey: key });
  }

  async list(options?: ListOptions): Promise<ListResult> {
    const result = await this.storage.listFiles({
      prefix: options?.prefix,
      maxKeys: options?.maxKeys || 100,
      continuationToken: options?.continuationToken,
    });

    return {
      keys: result.keys,
      isTruncated: result.isTruncated,
      nextContinuationToken: result.nextContinuationToken,
    };
  }

  async getSignedUrl(key: string, _expireTime = 86400): Promise<string> {
    // coze SDK 的 presigned 依赖云平台，自建 S3/MinIO 下降级为 serve 路径（永不过期）
    return `/api/storage/serve/${key}`;
  }

  async getStats(): Promise<StorageStats> {
    return {
      totalFiles: 0,
      totalSize: 0,
      byCategory: {},
    };
  }
}