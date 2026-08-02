import { Injectable } from '@nestjs/common';
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
  private storage: S3Storage;

  constructor() {
    this.storage = new S3Storage({
      endpointUrl: process.env.S3_ENDPOINT_URL,
      accessKey: process.env.S3_ACCESS_KEY || '',
      secretKey: process.env.S3_SECRET_KEY || '',
      bucketName: process.env.S3_BUCKET_NAME || 'vibeai',
      region: process.env.S3_REGION || 'cn-beijing',
    });
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

    const url = await this.storage.generatePresignedUrl({
      key,
      expireTime: 86400,
    });

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

  async getSignedUrl(key: string, expireTime = 86400): Promise<string> {
    return this.storage.generatePresignedUrl({ key, expireTime });
  }

  async getStats(): Promise<StorageStats> {
    return {
      totalFiles: 0,
      totalSize: 0,
      byCategory: {},
    };
  }
}