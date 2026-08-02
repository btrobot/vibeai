import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
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
export class LocalStorageProvider implements IStorageProvider {
  private basePath: string;

  constructor() {
    const env = process.env.COZE_PROJECT_ENV || 'DEV';
    if (env === 'PROD') {
      this.basePath = '/tmp/vibeai-storage';
    } else {
      this.basePath = process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), 'storage');
    }
    this.ensureDir(this.basePath);
  }

  private ensureDir(dir: string) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private async ensureParentDir(filePath: string) {
    const dir = path.dirname(filePath);
    this.ensureDir(dir);
  }

  getKeyPrefix(userId: string, category: string): string {
    return `users/${userId}/${category}`;
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    const prefix = this.getKeyPrefix(options.userId, options.category || 'temp');
    const uniqueId = uuidv4().slice(0, 8);
    const safeName = `${uniqueId}_${options.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const relativePath = `${prefix}/${safeName}`;
    const fullPath = path.join(this.basePath, relativePath);

    await this.ensureParentDir(fullPath);
    await fs.writeFile(fullPath, Buffer.from(options.fileContent));

    const stats = await fs.stat(fullPath);

    return {
      key: relativePath,
      url: `/api/storage/files/${relativePath.replace(/\\/g, '/')}`,
      size: stats.size,
    };
  }

  async read(key: string): Promise<ReadResult> {
    const fullPath = path.join(this.basePath, key);
    const data = await fs.readFile(fullPath);
    return {
      data,
      contentType: 'application/octet-stream',
    };
  }

  async delete(key: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, key);
    try {
      await fs.unlink(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, key);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async list(options?: ListOptions): Promise<ListResult> {
    const searchDir = options?.prefix
      ? path.join(this.basePath, options.prefix)
      : this.basePath;

    try {
      const entries = await this.walkDir(searchDir);
      const maxKeys = options?.maxKeys || 100;
      const truncated = entries.length > maxKeys;

      return {
        keys: entries.slice(0, maxKeys).map((e) => path.relative(this.basePath, e).replace(/\\/g, '/')),
        isTruncated: truncated,
        nextContinuationToken: truncated ? String(maxKeys) : undefined,
      };
    } catch {
      return { keys: [], isTruncated: false };
    }
  }

  private async walkDir(dir: string): Promise<string[]> {
    const results: string[] = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const sub = await this.walkDir(fullPath);
          results.push(...sub);
        } else {
          results.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist
    }
    return results;
  }

  async getSignedUrl(key: string, _expireTime = 86400): Promise<string> {
    // Local storage: return the API proxy URL
    return `/api/storage/files/${key.replace(/\\/g, '/')}`;
  }

  async getStats(): Promise<StorageStats> {
    return {
      totalFiles: 0,
      totalSize: 0,
      byCategory: {},
    };
  }
}