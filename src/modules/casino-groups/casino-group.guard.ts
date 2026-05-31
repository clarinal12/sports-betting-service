import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { CASINO_GROUP_HEADER } from './casino-group.types';
import { CasinoGroupsService } from './casino-groups.service';

@Injectable()
export class CasinoGroupGuard implements CanActivate {
  constructor(private readonly casinoGroups: CasinoGroupsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers[CASINO_GROUP_HEADER];
    const slug = Array.isArray(header) ? header[0] : header;

    if (!slug) {
      throw new BadRequestException(`Missing ${CASINO_GROUP_HEADER} header`);
    }

    const group = await this.casinoGroups.resolveActiveBySlug(slug);
    if (!group) {
      throw new ForbiddenException('Unknown or inactive casino group');
    }

    request.casinoGroup = group;
    return true;
  }
}
