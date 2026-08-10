import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// Re-export JwtPayload type from auth module
export type { JwtPayload } from '../../modules/auth/jwt.strategy';

/**
 * Current User decorator - extracts user from request
 * Compatible with JwtAuthGuard which sets request.user
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user;
  },
);

