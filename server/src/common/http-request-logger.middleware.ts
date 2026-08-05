import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppLoggerService } from './logger.service';

/**
 * HTTP 请求日志中间件
 *
 * 记录每个 HTTP 请求的方法、路径、状态码、耗时。
 * 跳过健康检查端点和静态资源。
 */
@Injectable()
export class HttpRequestLoggerMiddleware implements NestMiddleware {
  constructor(@Inject('APP_LOGGER') private readonly logger: AppLoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Skip health checks and static assets
    if (req.path === '/api/health' || req.path === '/api/health/deep') {
      return next();
    }

    const start = Date.now();
    const { method, path: reqPath } = req;

    // Log response after it's sent
    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;

      const meta = {
        method,
        path: reqPath,
        statusCode,
        durationMs: duration,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      };

      if (statusCode >= 500) {
        this.logger.error(`HTTP ${method} ${reqPath} ${statusCode} ${duration}ms`, undefined, 'HttpRequest', meta);
      } else if (statusCode >= 400) {
        this.logger.warn(`HTTP ${method} ${reqPath} ${statusCode} ${duration}ms`, 'HttpRequest', meta);
      } else {
        this.logger.log(`HTTP ${method} ${reqPath} ${statusCode} ${duration}ms`, 'HttpRequest', meta);
      }
    });

    next();
  }
}
