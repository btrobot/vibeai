/**
 * MulterExceptionFilter 单元测试
 *
 * 覆盖：
 * - LIMIT_FILE_SIZE → 413 + 中文提示（含大小）
 * - 文件数量/表单字段超限 → 400
 * - 未知错误 → 400（透出 multer 消息）
 * - MAX_UPLOAD_SIZE_MB 环境变量覆盖提示文案
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpStatus, PayloadTooLargeException } from '@nestjs/common';
import { MulterError } from 'multer';
import { MulterExceptionFilter } from './multer-exception.filter';

function createResponse() {
  const json = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json } as unknown as any;
}

function createHost(response: any) {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  } as any;
}

function capture(filter: MulterExceptionFilter, err: MulterError) {
  const res = createResponse();
  filter.catch(err, createHost(res));
  const statusCode = res.status.mock.calls[0][0];
  const body = res.json.mock.calls[0][0];
  return { statusCode, body };
}

describe('MulterExceptionFilter', () => {
  let originalMax: string | undefined;

  beforeEach(() => {
    originalMax = process.env.MAX_UPLOAD_SIZE_MB;
  });

  afterEach(() => {
    if (originalMax !== undefined) {
      process.env.MAX_UPLOAD_SIZE_MB = originalMax;
    } else {
      delete process.env.MAX_UPLOAD_SIZE_MB;
    }
  });

  it('LIMIT_FILE_SIZE 应返回 413 与中文提示（默认 20MB）', () => {
    delete process.env.MAX_UPLOAD_SIZE_MB;
    const filter = new MulterExceptionFilter();
    const { statusCode, body } = capture(filter, new MulterError('LIMIT_FILE_SIZE'));

    expect(statusCode).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(body.message).toBe('文件大小超过限制（最大 20MB）');
    expect(body.code).toBe('LIMIT_FILE_SIZE');
  });

  it('MAX_UPLOAD_SIZE_MB 应覆盖提示文案中的大小', () => {
    process.env.MAX_UPLOAD_SIZE_MB = '5';
    const filter = new MulterExceptionFilter();
    const { statusCode, body } = capture(filter, new MulterError('LIMIT_FILE_SIZE'));

    expect(statusCode).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(body.message).toBe('文件大小超过限制（最大 5MB）');
  });

  it('platform-express 转换的 PayloadTooLargeException 应返回 413 中文提示', () => {
    const filter = new MulterExceptionFilter();
    const { statusCode, body } = capture(filter, new PayloadTooLargeException('File too large'));

    expect(statusCode).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(body.message).toBe('文件大小超过限制（最大 20MB）');
    expect(body.code).toBe('LIMIT_FILE_SIZE');
  });

  it('LIMIT_FILE_COUNT 应返回 400', () => {
    const filter = new MulterExceptionFilter();
    const { statusCode, body } = capture(filter, new MulterError('LIMIT_FILE_COUNT'));

    expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(body.message).toContain('数量超过限制');
  });

  it('LIMIT_FIELD_COUNT 应返回 400 表单格式错误', () => {
    const filter = new MulterExceptionFilter();
    const { statusCode, body } = capture(filter, new MulterError('LIMIT_FIELD_COUNT'));

    expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(body.message).toContain('表单格式错误');
  });

  it('未知错误码应返回 400 并透出 multer 消息', () => {
    const filter = new MulterExceptionFilter();
    const err = new MulterError('LIMIT_UNEXPECTED_FILE' as any);
    const { statusCode, body } = capture(filter, err);

    expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(body.message).toContain('上传失败');
  });
});
