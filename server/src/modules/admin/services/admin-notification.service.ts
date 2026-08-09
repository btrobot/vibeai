import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../db/schema';
import { eq, sql } from 'drizzle-orm';
import { NotificationType } from '../dto/user/notification.dto';

@Injectable()
export class AdminNotificationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Send notification to a specific user
   */
  async sendNotificationToUser(
    userId: string,
    data: {
      type?: NotificationType;
      title: string;
      content: string;
      link?: string;
      icon?: string;
    },
    operatorId: string
  ) {
    // Check if user exists
    const [user] = await this.db
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const { type = NotificationType.IN_APP, title, content, link, icon } = data;

    // Create in-app notification
    if (type === NotificationType.IN_APP || type === NotificationType.BOTH) {
      await this.db.insert(schema.notifications).values({
        userId,
        title,
        content,
        link,
        icon,
        isRead: false,
        createdAt: new Date(),
      });
    }

    // Send email notification
    if (type === NotificationType.EMAIL || type === NotificationType.BOTH) {
      // TODO: Implement email sending logic
      // For now, just log it
      console.log(`[Email Notification] To: ${user.email}, Subject: ${title}`);
    }

    return {
      success: true,
      userId,
      type,
      title,
      sentAt: new Date(),
    };
  }

  /**
   * Broadcast notification to multiple users by role
   */
  async broadcastNotification(
    data: {
      targetRole?: 'user' | 'admin' | 'all';
      type?: NotificationType;
      title: string;
      content: string;
      link?: string;
      icon?: string;
    },
    operatorId: string
  ) {
    const { targetRole = 'all', type = NotificationType.IN_APP, title, content, link, icon } = data;

    // Get target users
    let users;
    if (targetRole === 'all') {
      users = await this.db
        .select({ id: schema.users.id, email: schema.users.email })
        .from(schema.users);
    } else {
      users = await this.db
        .select({ id: schema.users.id, email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.role, targetRole));
    }

    // Create notifications
    const results = {
      totalRecipients: users.length,
      inAppSent: 0,
      emailSent: 0,
      failed: 0,
    };

    for (const user of users) {
      try {
        // Create in-app notification
        if (type === NotificationType.IN_APP || type === NotificationType.BOTH) {
          await this.db.insert(schema.notifications).values({
            userId: user.id,
            title,
            content,
            link,
            icon,
            isRead: false,
            createdAt: new Date(),
          });
          results.inAppSent++;
        }

        // Send email notification
        if (type === NotificationType.EMAIL || type === NotificationType.BOTH) {
          // TODO: Implement email sending logic
          console.log(`[Email Notification] To: ${user.email}, Subject: ${title}`);
          results.emailSent++;
        }
      } catch (error) {
        results.failed++;
        console.error(`Failed to send notification to user ${user.id}:`, error);
      }
    }

    return {
      success: true,
      ...results,
      sentAt: new Date(),
    };
  }

  /**
   * Get user's notification history
   */
  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const notifications = await this.db
      .select({
        id: schema.notifications.id,
        title: schema.notifications.title,
        content: schema.notifications.content,
        link: schema.notifications.link,
        icon: schema.notifications.icon,
        isRead: schema.notifications.isRead,
        createdAt: schema.notifications.createdAt,
      })
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .limit(limit)
      .offset(offset);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId));

    const total = Number(countResult?.count || 0);

    return {
      notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    const [notification] = await this.db
      .select({ id: schema.notifications.id, userId: schema.notifications.userId })
      .from(schema.notifications)
      .where(eq(schema.notifications.id, notificationId))
      .limit(1);

    if (!notification) {
      throw new NotFoundException('通知不存在');
    }

    if (notification.userId !== userId) {
      throw new Error('无权限操作此通知');
    }

    await this.db
      .update(schema.notifications)
      .set({ isRead: true })
      .where(eq(schema.notifications.id, notificationId));

    return { success: true };
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    await this.db
      .update(schema.notifications)
      .set({ isRead: true })
      .where(eq(schema.notifications.userId, userId));

    return { success: true };
  }
}
