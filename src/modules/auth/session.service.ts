import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { EnvConfig } from '../../shared/config/env.validation';
import { SessionTokenClaims, UserContext } from './user-context.types';

export interface IssuedSession {
  sessionToken: string;
  expiresIn: string;
}

/**
 * Mints and verifies OUR short-lived player session tokens (HS256). These are
 * the credential the SPA presents on every REST/WS call after launch.
 */
@Injectable()
export class SessionService {
  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  mint(user: UserContext): IssuedSession {
    const secret = this.config.get('SESSION_JWT_SECRET', { infer: true });
    const expiresIn = this.config.get('SESSION_TTL', { infer: true });
    const claims: SessionTokenClaims = {
      sub: user.userId,
      username: user.username,
      casinoGroupId: user.casinoGroupId,
      currency: user.currency,
    };
    const sessionToken = jwt.sign(claims, secret, {
      algorithm: 'HS256',
      expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    });
    return { sessionToken, expiresIn };
  }

  verify(token: string): UserContext {
    const secret = this.config.get('SESSION_JWT_SECRET', { infer: true });
    let payload: jwt.JwtPayload | string;
    try {
      payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }

    if (typeof payload === 'string') {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const { sub, username, casinoGroupId, currency } = payload;
    if (
      typeof sub !== 'string' ||
      typeof username !== 'string' ||
      typeof casinoGroupId !== 'string' ||
      typeof currency !== 'string'
    ) {
      throw new UnauthorizedException('Invalid session claims');
    }

    return { userId: sub, username, casinoGroupId, currency };
  }
}
