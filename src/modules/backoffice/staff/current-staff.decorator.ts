import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { StaffContext } from './staff-context.types';

export const CurrentStaff = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StaffContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.staff) {
      throw new Error('CurrentStaff used without StaffAuthGuard');
    }
    return request.staff;
  },
);
