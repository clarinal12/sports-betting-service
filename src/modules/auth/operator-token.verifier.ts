import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { EnvConfig } from '../../shared/config/env.validation';
import {
  CasinoGroupsService,
  MerchantCredentials,
} from '../casino-groups/casino-groups.service';
import { OperatorTokenPayload } from './user-context.types';

export interface VerifiedLaunch {
  payload: OperatorTokenPayload;
  credentials: MerchantCredentials;
}

/**
 * Verifies an operator launch token:
 *   1. decode (unverified) to read merchantId
 *   2. load that merchant's secret (HS256 key)
 *   3. verify signature + expiry with the merchant secret
 * Any failure surfaces as 401 to avoid leaking which step failed.
 */
@Injectable()
export class OperatorTokenVerifier {
  private readonly logger = new Logger(OperatorTokenVerifier.name);

  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly casinoGroups: CasinoGroupsService,
  ) {}

  async verify(token: string): Promise<VerifiedLaunch> {
    const decoded = jwt.decode(token);
    const merchantId =
      decoded && typeof decoded === 'object'
        ? (decoded as Record<string, unknown>).merchantId
        : undefined;

    if (typeof merchantId !== 'string' || merchantId.length === 0) {
      throw new UnauthorizedException('Invalid launch token');
    }

    const credentials =
      await this.casinoGroups.getMerchantCredentials(merchantId);
    if (!credentials) {
      throw new UnauthorizedException('Invalid launch token');
    }

    const clockTolerance = this.config.get('OPERATOR_JWT_CLOCK_SKEW', {
      infer: true,
    });

    let payload: jwt.JwtPayload | string;
    try {
      payload = jwt.verify(token, credentials.sportsSecret, {
        algorithms: ['HS256'],
        clockTolerance,
      });
    } catch (error) {
      this.logger.warn(
        `Launch token verification failed for merchant ${merchantId}: ${
          (error as Error).message
        }`,
      );
      throw new UnauthorizedException('Invalid launch token');
    }

    if (typeof payload === 'string') {
      throw new UnauthorizedException('Invalid launch token');
    }

    const userId = payload.userId as unknown;
    const username = payload.username as unknown;
    if (typeof userId !== 'string' || typeof username !== 'string') {
      throw new UnauthorizedException('Invalid launch token');
    }

    return {
      payload: {
        userId,
        username,
        merchantId,
        iat: payload.iat,
        exp: payload.exp,
      },
      credentials,
    };
  }
}
