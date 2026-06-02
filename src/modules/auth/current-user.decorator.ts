import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { UserContext } from './user-context.types';

/**
 * Injects the authenticated player resolved by PlayerAuthGuard. Use only on
 * routes that require a real user (not the dev header-fallback path); throws
 * 401 if no user is present.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }
    return request.user;
  },
);
