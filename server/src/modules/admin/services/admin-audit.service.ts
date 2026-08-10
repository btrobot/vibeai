import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE } from '../../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../db/schema';
import { auditLogs } from '../../../db/schema/audit';
import { desc, eq, and, sql, count } from 'drizzle-orm';

export interface AuditLogEntry {
  adminId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  changes?: Record<string, unknown> | null;
  status: 'success' | 'failed';
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  adminId?: string;
  action?: string;
  entityType?: string;
  status?: string;
}

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(
    @Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>,
  ) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.db.insert(auditLogs).values({
        adminId: entry.adminId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        changes: entry.changes ?? null,
        status: entry.status,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      });
    } catch (err) {
      // Audit logging should never break the main operation
      this.logger.error(`Failed to write audit log: ${(err as Error).message}`);
    }
  }

  async list(query: AuditLogQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (query.adminId) conditions.push(eq(auditLogs.adminId, query.adminId));
    if (query.action) conditions.push(eq(auditLogs.action, query.action));
    if (query.entityType) conditions.push(eq(auditLogs.entityType, query.entityType));
    if (query.status) conditions.push(eq(auditLogs.status, query.status));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalResult] = await Promise.all([
      this.db
        .select({
          id: auditLogs.id,
          adminId: auditLogs.adminId,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          changes: auditLogs.changes,
          status: auditLogs.status,
          ipAddress: auditLogs.ipAddress,
          userAgent: auditLogs.userAgent,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(auditLogs).where(where),
    ]);

    const total = totalResult[0]?.total ?? 0;
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getStats() {
    const totalResult = await this.db.select({ total: count() }).from(auditLogs);
    const total = totalResult[0]?.total ?? 0;

    const byAction = await this.db
      .select({
        action: auditLogs.action,
        count: count(),
      })
      .from(auditLogs)
      .groupBy(auditLogs.action);

    const byEntityType = await this.db
      .select({
        entityType: auditLogs.entityType,
        count: count(),
      })
      .from(auditLogs)
      .groupBy(auditLogs.entityType);

    const failedResult = await this.db
      .select({ total: count() })
      .from(auditLogs)
      .where(eq(auditLogs.status, 'failed'));
    const failed = failedResult[0]?.total ?? 0;

    return {
      total,
      failed,
      byAction: byAction.reduce((acc, r) => {
        acc[r.action] = r.count;
        return acc;
      }, {} as Record<string, number>),
      byEntityType: byEntityType.reduce((acc, r) => {
        acc[r.entityType] = r.count;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}
