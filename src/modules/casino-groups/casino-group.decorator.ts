import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request } from 'express';
import { CasinoGroupContext } from './casino-group.types';

/**
 * Injects the tenant resolved by CasinoGroupGuard. Routes using this decorator
 * must be protected by the guard.
 */
export const CasinoGroup = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CasinoGroupContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.casinoGroup) {
      throw new InternalServerErrorException(
        'Casino group not resolved; is CasinoGroupGuard applied?',
      );
    }
    return request.casinoGroup;
  },
);
