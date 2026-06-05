import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { StaffJwtService } from './staff-jwt.service';
import { STAFF_PERMISSION_KEY } from './require-permission.decorator';
import { StaffPermission, hasPermission } from './staff-permissions';

@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: StaffJwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.bearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Staff authentication required');
    }

    const staff = this.jwt.verifyAccessToken(token);
    request.staff = staff;

    const required = this.reflector.getAllAndOverride<StaffPermission | undefined>(
      STAFF_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (required && !hasPermission(staff.permissions, required)) {
      throw new ForbiddenException(`Missing permission: ${required}`);
    }

    return true;
  }

  private bearerToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) {
      return undefined;
    }
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
  }
}
