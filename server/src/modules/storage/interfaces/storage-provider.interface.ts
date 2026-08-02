export interface UploadOptions {
  fileContent: Buffer | Uint8Array;
  fileName: string;
  contentType: string;
  userId: string;
  category?: string;
  isPublic?: boolean;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
}

export interface ReadResult {
  data: Buffer;
  contentType: string;
}

export interface FileInfo {
  key: string;
  size: number;
  mimeType: string;
  createdAt: Date;
}

export interface ListOptions {
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface ListResult {
  keys: string[];
  isTruncated: boolean;
  nextContinuationToken?: string;
}

export interface StorageStats {
  totalFiles: number;
  totalSize: number;
  byCategory: Record<string, { count: number; size: number }>;
}

export interface IStorageProvider {
  upload(options: UploadOptions): Promise<UploadResult>;
  read(key: string): Promise<ReadResult>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  list(options?: ListOptions): Promise<ListResult>;
  getSignedUrl(key: string, expireTime?: number): Promise<string>;
  getStats(): Promise<StorageStats>;
  getKeyPrefix(userId: string, category: string): string;
}