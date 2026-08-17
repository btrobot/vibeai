/**
 * Multer（文件上传）异常过滤器
 *
 * 将文件上传错误映射为友好的中文 HTTP 响应：
 * - 超限（PayloadTooLargeException / LIMIT_FILE_SIZE）→ 413 + 大小上限提示
 * - 其他 Multer LIMIT_* → 400 Bad Request
 *
 * 注意: @nestjs/platform-express 的 transformException 会把 MulterError
 * LIMIT_FILE_SIZE 转换为 PayloadTooLargeException 再抛出，因此必须同时
 * 捕获两者才能拦截上传超限错误。
 *
 * 上传大小限制由 StorageController 的 FileInterceptor limits 配置，
 * 默认 20MB，可通过环境变量 MAX_UPLOAD_SIZE_MB 覆盖。
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { MulterError } from 'multer';
import type { Response } from 'express';

@Catch(MulterError, PayloadTooLargeException)
export class MulterExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MulterExceptionFilter.name);

  catch(exception: MulterError | PayloadTooLargeException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const maxMb = Number(process.env.MAX_UPLOAD_SIZE_MB) || 20;

    // platform-express 转换后的 413：重写为含大小上限的中文提示
    if (exception instanceof PayloadTooLargeException) {
      return response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        message: `文件大小超过限制（最大 ${maxMb}MB）`,
        error: 'Payload Too Large',
        code: 'LIMIT_FILE_SIZE',
      });
    }

    switch (exception.code) {
      case 'LIMIT_FILE_SIZE':
        return response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
          statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
          message: `文件大小超过限制（最大 ${maxMb}MB）`,
          error: 'Payload Too Large',
          code: exception.code,
        });
      case 'LIMIT_FILE_COUNT':
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: '上传文件数量超过限制',
          error: 'Bad Request',
          code: exception.code,
        });
      case 'LIMIT_FIELD_COUNT':
      case 'LIMIT_FIELD_KEY':
      case 'LIMIT_FIELD_VALUE':
      case 'LIMIT_PART_COUNT':
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: `上传表单格式错误（${exception.code}）`,
          error: 'Bad Request',
          code: exception.code,
        });
      default:
        this.logger.warn(`Multer upload error: ${exception.code} - ${exception.message}`);
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: `上传失败：${exception.message}`,
          error: 'Bad Request',
          code: exception.code,
        });
    }
  }
}
