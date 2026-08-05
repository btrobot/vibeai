import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

/**
 * 结构化日志服务
 *
 * 基于 NestJS Logger，增加：
 * - JSON 结构化输出（生产环境）
 * - 请求 ID 追踪
 * - 统一的字段格式（timestamp, level, context, message, meta）
 * - 敏感字段脱敏
 */

export type LogLevel = 'debug' | 'verbose' | 'log' | 'warn' | 'error';

export interface LogMeta {
  [key: string]: unknown;
}

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'authorization', 'apiKey', 'refreshToken'];

function sanitize(meta: LogMeta): LogMeta {
  const sanitized: LogMeta = {};
  for (const [key, value] of Object.entries(meta)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some(s => lowerKey.includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitize(value as LogMeta);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

@Injectable()
export class AppLoggerService implements NestLoggerService {
  private isProduction = process.env.NODE_ENV === 'production';

  private format(context: string, level: LogLevel, message: string, meta?: LogMeta): string {
    const timestamp = new Date().toISOString();

    if (this.isProduction) {
      // JSON structured logging for production (parseable by log aggregators)
      return JSON.stringify({
        timestamp,
        level,
        context,
        message,
        ...(meta ? { meta: sanitize(meta) } : {}),
      });
    }

    // Human-readable for development
    const metaStr = meta ? ` ${JSON.stringify(sanitize(meta))}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}${metaStr}`;
  }

  log(message: string, context?: string, meta?: LogMeta) {
    console.log(this.format(context || 'App', 'log', message, meta));
  }

  error(message: string, trace?: string, context?: string, meta?: LogMeta) {
    const formatted = this.format(context || 'App', 'error', message, { ...meta, ...(trace ? { trace } : {}) });
    console.error(formatted);
  }

  warn(message: string, context?: string, meta?: LogMeta) {
    console.warn(this.format(context || 'App', 'warn', message, meta));
  }

  debug(message: string, context?: string, meta?: LogMeta) {
    if (!this.isProduction) {
      console.debug(this.format(context || 'App', 'debug', message, meta));
    }
  }

  verbose(message: string, context?: string, meta?: LogMeta) {
    if (!this.isProduction) {
      console.log(this.format(context || 'App', 'verbose', message, meta));
    }
  }
}
