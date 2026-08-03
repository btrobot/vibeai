import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../common/drizzle.constants';
import { users, sessions, loginLogs } from '../../db/schema';
import { RegisterDto, LoginDto, UpdateProfileDto, ChangePasswordDto } from './dto';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';

@Injectable()
export class AuthService {
  private readonly saltRounds: number;
  private readonly refreshExpiresIn: string;

  constructor(
    @Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>,
    @Inject(JwtService) private jwtService: JwtService,
  ) {
    this.saltRounds = 12;
    this.refreshExpiresIn = '7d';
  }

  async register(dto: RegisterDto) {
    const existing = await this.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('该邮箱已被注册');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);

    const [user] = await this.db
      .insert(users)
      .values({
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: 'user',
        credits: 100,
      })
      .returning();

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        credits: user.credits,
        createdAt: user.createdAt,
      },
      message: '注册成功',
    };
  }

  async login(dto: LoginDto, ipAddress: string, deviceInfo: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (!user) {
      await this.logLogin(null, dto.email, 'login', ipAddress, deviceInfo, false, '用户不存在');
      throw new UnauthorizedException('邮箱或密码错误');
    }

    if (!user.isActive) {
      throw new ForbiddenException('账户已被禁用');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000 / 60);
      throw new ForbiddenException(`账户已被锁定，请 ${remaining} 分钟后重试`);
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      const newAttempts = user.failedLoginAttempts + 1;
      const updateData: Record<string, unknown> = { failedLoginAttempts: newAttempts };

      if (newAttempts >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min lock
      }

      await this.db.update(users).set(updateData).where(eq(users.id, user.id));
      await this.logLogin(user.id, dto.email, 'login', ipAddress, deviceInfo, false, '密码错误');
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // Reset failed attempts
    await this.db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      })
      .where(eq(users.id, user.id));

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Store session
    const refreshExpiresAt = new Date();
    const match = this.refreshExpiresIn.match(/^(\d+)([dhms])$/);
    if (match) {
      const num = parseInt(match[1], 10);
      const unit = match[2];
      const multipliers: Record<string, number> = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
      refreshExpiresAt.setTime(refreshExpiresAt.getTime() + num * (multipliers[unit] || 86400000));
    }

    await this.db.insert(sessions).values({
      userId: user.id,
      refreshToken: tokens.refreshToken,
      deviceInfo,
      ipAddress,
      expiresAt: refreshExpiresAt,
    });

    await this.logLogin(user.id, dto.email, 'login', ipAddress, deviceInfo, true, null);

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          credits: user.credits,
          createdAt: user.createdAt,
        },
        tokens,
      },
      message: '登录成功',
    };
  }

  async refresh(refreshToken: string) {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.refreshToken, refreshToken),
          eq(sessions.isRevoked, false),
        ),
      )
      .limit(1);

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await this.db.update(sessions).set({ isRevoked: true }).where(eq(sessions.id, session.id));
      }
      throw new UnauthorizedException('refreshToken 无效或已过期');
    }

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('用户不存在或已被禁用');
    }

    // Revoke old session
    await this.db.update(sessions).set({ isRevoked: true }).where(eq(sessions.id, session.id));

    // Generate new tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    const refreshExpiresAt = new Date();
    const match = this.refreshExpiresIn.match(/^(\d+)([dhms])$/);
    if (match) {
      const num = parseInt(match[1], 10);
      const unit = match[2];
      const multipliers: Record<string, number> = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
      refreshExpiresAt.setTime(refreshExpiresAt.getTime() + num * (multipliers[unit] || 86400000));
    }

    await this.db.insert(sessions).values({
      userId: user.id,
      refreshToken: tokens.refreshToken,
      expiresAt: refreshExpiresAt,
    });

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          credits: user.credits,
          createdAt: user.createdAt,
        },
        tokens,
      },
    };
  }

  async logout(refreshToken: string) {
    await this.db
      .update(sessions)
      .set({ isRevoked: true })
      .where(eq(sessions.refreshToken, refreshToken));

    return { success: true, message: '已登出' };
  }

  async getProfile(userId: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        credits: user.credits,
        createdAt: user.createdAt,
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.avatar !== undefined) updateData.avatar = dto.avatar;

    await this.db.update(users).set(updateData).where(eq(users.id, userId));

    return this.getProfile(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('当前密码错误');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, this.saltRounds);
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { success: true, message: '密码已修改' };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const now = Date.now();
    const payload = { sub: userId, email, role, jti: `${userId}-${now}-${Math.random().toString(36).slice(2, 8)}` };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET || 'vibeai-jwt-secret-key-2024',
      expiresIn: this.refreshExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    return { accessToken, refreshToken, expiresIn: 900 };
  }

  private async logLogin(
    userId: string | null,
    email: string,
    action: string,
    ipAddress: string,
    deviceInfo: string,
    success: boolean,
    failReason: string | null,
  ) {
    try {
      await this.db.insert(loginLogs).values({
        userId,
        email,
        action,
        ipAddress,
        deviceInfo,
        success,
        failReason,
      });
    } catch {
      // Non-critical, ignore logging errors
    }
  }
}