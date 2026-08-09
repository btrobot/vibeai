import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DRIZZLE } from '../../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type * as bcryptjs from 'bcryptjs';

@Injectable()
export class AdminUserMutationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Ban a user and revoke all active sessions
   */
  async banUser(userId: string) {
    const [user] = await this.db
      .select({ id: schema.users.id, isActive: schema.users.isActive, role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    if (user.role === 'admin') {
      throw new ForbiddenException('不能封禁管理员账户');
    }
    if (!user.isActive) {
      throw new BadRequestException('用户已被封禁');
    }

    const [updated] = await this.db
      .update(schema.users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        isActive: schema.users.isActive,
      });

    // Revoke all active sessions
    await this.db
      .update(schema.sessions)
      .set({ isRevoked: true })
      .where(and(eq(schema.sessions.userId, userId), eq(schema.sessions.isRevoked, false)));

    return updated;
  }

  /**
   * Unban a user
   */
  async unbanUser(userId: string) {
    const [user] = await this.db
      .select({ id: schema.users.id, isActive: schema.users.isActive })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    if (user.isActive) {
      throw new BadRequestException('用户未被封禁');
    }

    const [updated] = await this.db
      .update(schema.users)
      .set({ isActive: true, failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        isActive: schema.users.isActive,
      });

    return updated;
  }

  /**
   * Update user role
   */
  async updateUserRole(userId: string, role: string) {
    if (role !== 'user' && role !== 'admin') {
      throw new BadRequestException('角色只能是 user 或 admin');
    }

    const [user] = await this.db
      .select({ id: schema.users.id, role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    if (user.role === role) {
      throw new BadRequestException(`用户角色已为 ${role}`);
    }

    const [updated] = await this.db
      .update(schema.users)
      .set({ role, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
      });

    return updated;
  }

  /**
   * Unpublish a gallery work
   */
  async unpublishWork(workId: string) {
    const [work] = await this.db
      .select({ id: schema.galleryWorks.id, isPublished: schema.galleryWorks.isPublished })
      .from(schema.galleryWorks)
      .where(eq(schema.galleryWorks.id, workId))
      .limit(1);

    if (!work) {
      throw new NotFoundException('作品不存在');
    }
    if (!work.isPublished) {
      throw new BadRequestException('作品未发布');
    }

    const [updated] = await this.db
      .update(schema.galleryWorks)
      .set({ isPublished: false, updatedAt: new Date() })
      .where(eq(schema.galleryWorks.id, workId))
      .returning({
        id: schema.galleryWorks.id,
        title: schema.galleryWorks.title,
        isPublished: schema.galleryWorks.isPublished,
      });

    return updated;
  }

  /**
   * Delete a gallery work
   */
  async deleteWork(workId: string) {
    const [work] = await this.db
      .select({ id: schema.galleryWorks.id })
      .from(schema.galleryWorks)
      .where(eq(schema.galleryWorks.id, workId))
      .limit(1);

    if (!work) {
      throw new NotFoundException('作品不存在');
    }

    await this.db
      .delete(schema.galleryWorks)
      .where(eq(schema.galleryWorks.id, workId));

    return { id: workId, deleted: true };
  }

  /**
   * Create a new user (admin operation)
   */
  async createUser(data: {
    email: string;
    name: string;
    password: string;
    role?: 'user' | 'admin';
    credits?: number;
  }) {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(data.password, 12);

    const [user] = await this.db
      .insert(schema.users)
      .values({
        email: data.email,
        name: data.name,
        passwordHash: hashedPassword,
        role: data.role || 'user',
        credits: data.credits || 0,
        isActive: true,
        isEmailVerified: true, // Admin-created users are verified by default
      })
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        credits: schema.users.credits,
        isActive: schema.users.isActive,
        createdAt: schema.users.createdAt,
      });

    return user;
  }

  /**
   * Update user information
   */
  async updateUser(userId: string, data: {
    name?: string;
    avatar?: string;
    role?: 'user' | 'admin';
    isActive?: boolean;
  }) {
    const [user] = await this.db
      .update(schema.users)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.avatar !== undefined && { avatar: data.avatar }),
        ...(data.role && { role: data.role }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        avatar: schema.users.avatar,
        role: schema.users.role,
        isActive: schema.users.isActive,
        updatedAt: schema.users.updatedAt,
      });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  /**
   * Adjust user credits (add or deduct)
   */
  async adjustCredits(userId: string, amount: number, reason: string, operatorId: string) {
    const [user] = await this.db
      .select({ id: schema.users.id, credits: schema.users.credits })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const newCredits = Number(user.credits) + amount;
    if (newCredits < 0) {
      throw new BadRequestException('余额不足');
    }

    const [updated] = await this.db
      .update(schema.users)
      .set({ credits: newCredits, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        credits: schema.users.credits,
      });

    // TODO: Create credit history record in audit log

    return updated;
  }
}
