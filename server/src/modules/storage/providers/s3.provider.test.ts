/**
 * S3StorageProvider 单元测试
 *
 * 覆盖范围：
 * - 构造参数（endpointUrl/accessKey/secretKey/bucketName/region）透传给 SDK
 * - upload 返回 serve 路径 URL（不依赖 coze 云平台 presigned，兼容 MinIO）
 * - read/delete/exists/list 透传 SDK
 * - getSignedUrl 降级为 serve 路径（自建 S3/MinIO 下 coze presigned 不可用）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = {
  uploadFile: vi.fn(),
  readFile: vi.fn(),
  deleteFile: vi.fn(),
  fileExists: vi.fn(),
  listFiles: vi.fn(),
  generatePresignedUrl: vi.fn(),
};

vi.mock('coze-coding-dev-sdk', () => ({
  S3Storage: vi.fn().mockImplementation(() => mocks),
}));

import { S3StorageProvider } from './s3.provider';
import { S3Storage } from 'coze-coding-dev-sdk';

const S3StorageMock = S3Storage as unknown as ReturnType<typeof vi.fn>;

describe('S3StorageProvider', () => {
  let provider: S3StorageProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new S3StorageProvider();
  });

  it('构造时将 S3 配置透传给 SDK（含自定义 endpoint，兼容 MinIO）', () => {
    expect(S3StorageMock).toHaveBeenCalledWith({
      endpointUrl: undefined,
      accessKey: '',
      secretKey: '',
      bucketName: 'vibeai',
      region: 'cn-beijing',
    });
  });

  it('upload 调用 SDK 上传并返回 serve 路径 URL（不调 coze presigned）', async () => {
    mocks.uploadFile.mockResolvedValue('users/u1/generated/a.png');
    mocks.generatePresignedUrl.mockRejectedValue(new Error('coze platform only'));

    const result = await provider.upload({
      fileContent: Buffer.from('x'),
      fileName: 'a.png',
      contentType: 'image/png',
      userId: 'u1',
      category: 'generated',
    });

    expect(mocks.uploadFile).toHaveBeenCalledWith({
      fileContent: expect.any(Buffer),
      fileName: 'users/u1/generated/a.png',
      contentType: 'image/png',
    });
    expect(mocks.generatePresignedUrl).not.toHaveBeenCalled();
    expect(result.key).toBe('users/u1/generated/a.png');
    expect(result.url).toBe('/api/storage/serve/users/u1/generated/a.png');
    expect(result.size).toBe(1);
  });

  it('read 透传 SDK 并返回 Buffer', async () => {
    mocks.readFile.mockResolvedValue(Buffer.from('data'));
    const result = await provider.read('users/u1/temp/a.txt');
    expect(mocks.readFile).toHaveBeenCalledWith({ fileKey: 'users/u1/temp/a.txt' });
    expect(result.data.toString()).toBe('data');
  });

  it('delete 透传 SDK', async () => {
    mocks.deleteFile.mockResolvedValue(true);
    const result = await provider.delete('users/u1/temp/a.txt');
    expect(mocks.deleteFile).toHaveBeenCalledWith({ fileKey: 'users/u1/temp/a.txt' });
    expect(result).toBe(true);
  });

  it('exists 透传 SDK', async () => {
    mocks.fileExists.mockResolvedValue(false);
    const result = await provider.exists('users/u1/temp/a.txt');
    expect(mocks.fileExists).toHaveBeenCalledWith({ fileKey: 'users/u1/temp/a.txt' });
    expect(result).toBe(false);
  });

  it('list 透传 SDK 并转换字段', async () => {
    mocks.listFiles.mockResolvedValue({ keys: ['k1', 'k2'], isTruncated: false });
    const result = await provider.list({ prefix: 'users/u1/' });
    expect(mocks.listFiles).toHaveBeenCalledWith({ prefix: 'users/u1/', maxKeys: 100, continuationToken: undefined });
    expect(result).toEqual({ keys: ['k1', 'k2'], isTruncated: false });
  });

  it('getSignedUrl 降级为 serve 路径（不依赖 coze 平台）', async () => {
    const url = await provider.getSignedUrl('users/u1/temp/a.txt');
    expect(mocks.generatePresignedUrl).not.toHaveBeenCalled();
    expect(url).toBe('/api/storage/serve/users/u1/temp/a.txt');
  });

  it('getKeyPrefix 按 userId/category 组织', () => {
    expect(provider.getKeyPrefix('u1', 'generated')).toBe('users/u1/generated');
  });
});
