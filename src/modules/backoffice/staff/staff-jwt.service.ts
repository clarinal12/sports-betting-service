import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StaffRole } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import { EnvConfig } from '../../../shared/config/env.validation';
import { StaffPermission, permissionsForRoles } from './staff-permissions';
import { StaffContext, StaffTokenClaims } from './staff-context.types';

@Injectable()
export class StaffJwtService {
  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  mintAccessToken(user: {
    id: string;
    email: string;
    casinoGroupId: string | null;
    roles: StaffRole[];
  }): { accessToken: string; expiresIn: string } {
    const secret = this.config.get('STAFF_JWT_SECRET', { infer: true });
    const expiresIn = this.config.get('STAFF_ACCESS_TTL', { infer: true });
    const permissions = permissionsForRoles(user.roles);
    const claims: StaffTokenClaims = {
      sub: user.id,
      email: user.email,
      casinoGroupId: user.casinoGroupId,
      roles: user.roles,
      permissions,
      typ: 'staff',
    };
    const accessToken = jwt.sign(claims, secret, {
      algorithm: 'HS256',
      expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    });
    return { accessToken, expiresIn };
  }

  verifyAccessToken(token: string): StaffContext {
    const secret = this.config.get('STAFF_JWT_SECRET', { infer: true });
    let payload: jwt.JwtPayload | string;
    try {
      payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('Invalid or expired staff session');
    }
    if (typeof payload === 'string') {
      throw new UnauthorizedException('Invalid or expired staff session');
    }
    if (payload.typ !== 'staff') {
      throw new UnauthorizedException('Invalid or expired staff session');
    }
    const sub = payload.sub;
    const email = payload.email;
    const casinoGroupId = payload.casinoGroupId as string | null | undefined;
    const roles = payload.roles as StaffRole[] | undefined;
    const permissions = payload.permissions as StaffPermission[] | undefined;
    if (
      typeof sub !== 'string' ||
      typeof email !== 'string' ||
      !Array.isArray(roles) ||
      !Array.isArray(permissions)
    ) {
      throw new UnauthorizedException('Invalid or expired staff session');
    }
    return {
      staffUserId: sub,
      email,
      casinoGroupId:
        casinoGroupId === undefined || casinoGroupId === null
          ? null
          : casinoGroupId,
      roles,
      permissions,
    };
  }
}
