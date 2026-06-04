import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { Request } from 'express';

export const IDEMPOTENCY_HEADER = 'idempotency-key';

export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const raw = request.headers[IDEMPOTENCY_HEADER];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const key = value?.trim();
    if (!key || key.length > 128) {
      throw new BadRequestException(
        'Idempotency-Key header is required (max 128 characters)',
      );
    }
    return key;
  },
);
