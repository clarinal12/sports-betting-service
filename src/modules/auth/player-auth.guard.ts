import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { EnvConfig } from '../../shared/config/env.validation';
import { CasinoGroupsService } from '../casino-groups/casino-groups.service';
import { CASINO_GROUP_HEADER } from '../casino-groups/casino-group.types';
import { SessionService } from './session.service';

/**
 * Protects player routes. Resolution order:
 *   1. `Authorization: Bearer <sessionToken>` → verified user + tenant (the
 *      production path).
 *   2. Dev-only `X-Casino-Group` slug header (when AUTH_ALLOW_HEADER_FALLBACK
 *      is on) → tenant only, anonymous user.
 *   3. Otherwise 401.
 */
@Injectable()
export class PlayerAuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly casinoGroups: CasinoGroupsService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.bearerToken(request);

    if (token) {
      const user = this.sessions.verify(token);
      const group = await this.casinoGroups.resolveActiveById(
        user.casinoGroupId,
      );
      if (!group) {
        throw new ForbiddenException('Unknown or inactive casino group');
      }
      request.user = user;
      request.casinoGroup = group;
      return true;
    }

    if (this.config.get('AUTH_ALLOW_HEADER_FALLBACK', { infer: true })) {
      const header = request.headers[CASINO_GROUP_HEADER];
      const slug = Array.isArray(header) ? header[0] : header;
      if (slug) {
        const group = await this.casinoGroups.resolveActiveBySlug(slug);
        if (!group) {
          throw new ForbiddenException('Unknown or inactive casino group');
        }
        request.casinoGroup = group;
        return true;
      }
    }

    throw new UnauthorizedException('Authentication required');
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
