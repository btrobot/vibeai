import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap, catchError } from 'rxjs';
import { throwError } from 'rxjs';
import type { Request } from 'express';
import { AdminAuditService } from '../modules/admin/services/admin-audit.service';

// Path -> entityType mapping
const ENTITY_TYPE_MAP: Record<string, string> = {
  'admin/users': 'user',
  'admin/orders': 'order',
  'admin/gallery': 'gallery',
  'admin/commerce/products': 'product',
  'admin/commerce/promo-codes': 'promo_code',
  'admin/commerce/categories': 'category',
  'announcements': 'announcement',
  'system-config': 'config',
};

// Specific path patterns -> action mapping
function resolveAction(method: string, path: string): string {
  const lower = path.toLowerCase();
  if (lower.includes('/ban')) return 'ban';
  if (lower.includes('/unban')) return 'unban';
  if (lower.includes('/role')) return 'update_role';
  if (lower.includes('/refund')) return 'refund';
  if (lower.includes('/export')) return 'export';
  if (lower.includes('/notify') || lower.includes('/broadcast')) return 'notify';
  if (method === 'POST') return 'create';
  if (method === 'PATCH' || method === 'PUT') return 'update';
  if (method === 'DELETE') return 'delete';
  return method.toLowerCase();
}

function resolveEntityType(path: string): string {
  for (const [prefix, type] of Object.entries(ENTITY_TYPE_MAP)) {
    if (path.includes(prefix)) return type;
  }
  return 'unknown';
}

function resolveEntityId(path: string): string | null {
  // Extract UUID or key from path segments
  const uuidMatch = path.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuidMatch) return uuidMatch[0];
  // For system-config, the last segment might be a key
  if (path.includes('system-config/')) {
    const segments = path.split('system-config/');
    if (segments[1]) return decodeURIComponent(segments[1].split('/')[0].split('?')[0]);
  }
  return null;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AdminAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;

    // Only log mutations (skip GET)
    if (method === 'GET') {
      return next.handle();
    }

    // Only intercept admin and content management paths
    const path = request.path || request.url || '';
    const isAdminPath =
      path.includes('/api/admin/') ||
      path.includes('/api/announcements') ||
      path.includes('/api/system-config');

    if (!isAdminPath) {
      return next.handle();
    }

    const user = (request as unknown as { user?: { id?: string } }).user;
    const adminId = user?.id;

    // If no authenticated user (e.g. public endpoints), skip
    if (!adminId) {
      return next.handle();
    }

    const action = resolveAction(method, path);
    const entityType = resolveEntityType(path);
    const entityId = resolveEntityId(path);
    const ipAddress =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.socket?.remoteAddress ||
      null;
    const userAgent = request.headers['user-agent'] || null;

    return next.handle().pipe(
      tap(() => {
        // Log successful operation
        this.auditService
          .log({
            adminId,
            action,
            entityType,
            entityId,
            status: 'success',
            ipAddress,
            userAgent,
          })
          .catch((err) => {
            this.logger.error(`Audit log write failed: ${(err as Error).message}`);
          });
      }),
      catchError((err) => {
        // Log failed operation
        this.auditService
          .log({
            adminId,
            action,
            entityType,
            entityId,
            changes: { error: err.message ?? String(err) },
            status: 'failed',
            ipAddress,
            userAgent,
          })
          .catch((logErr) => {
            this.logger.error(`Audit log write failed: ${(logErr as Error).message}`);
          });
        return throwError(() => err);
      }),
    );
  }
}
