import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../common/drizzle.constants';
import { users } from '../../db/schema';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';

export interface JwtPayload {
  id: string;  // User ID (same as sub)
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'vibeai-dev-jwt-secret-key-2026',
    });
  }

  async validate(payload: JwtPayload) {
    const [user] = await this.db
      .select({ id: users.id, email: users.email, role: users.role, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('用户不存在或已被禁用');
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}