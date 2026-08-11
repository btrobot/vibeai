import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { notifications } from '../../db/schema/notifications';
import { and, desc, eq, sql } from 'drizzle-orm';

export interface NotificationListItem {
  id: string;
  type: string;
  title: string;
  content: string;
  link: string | null;
  icon: string | null;
  isRead: boolean;
  createdAt: string;
}

@Injectable()
export class NotificationService {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  async listForUser(
    userId: string,
    opts: { limit?: number; offset?: number; unreadOnly?: boolean } = {},
  ): Promise<NotificationListItem[]> {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
    const offset = Math.max(opts.offset ?? 0, 0);

    const conditions = [eq(notifications.userId, userId)];
    if (opts.unreadOnly) conditions.push(eq(notifications.isRead, false));

    const rows = await this.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      content: r.content,
      link: r.link ?? null,
      icon: r.icon ?? null,
      isRead: r.isRead,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async unreadCount(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return Number(row?.count ?? 0);
  }

  async markRead(userId: string, notificationId: string): Promise<{ id: string; isRead: boolean }> {
    const [row] = await this.db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning({ id: notifications.id, isRead: notifications.isRead });

    if (!row) throw new NotFoundException('通知不存在或无权访问');
    return row;
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const updated = await this.db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .returning({ id: notifications.id });
    return { updated: updated.length };
  }
}