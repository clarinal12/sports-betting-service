import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StaffUserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../../shared/database/prisma.service';
import { EnvConfig } from '../../../shared/config/env.validation';
import { StaffJwtService } from './staff-jwt.service';

export interface StaffLoginResult {
  accessToken: string;
  expiresIn: string;
  refreshToken: string;
  refreshExpiresIn: string;
  staff: {
    id: string;
    email: string;
    casinoGroupId: string | null;
    roles: string[];
    permissions: string[];
  };
}

@Injectable()
export class StaffAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: StaffJwtService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async login(email: string, password: string): Promise<StaffLoginResult> {
    const user = await this.prisma.staffUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user || user.status !== StaffUserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const refreshToken = randomBytes(32).toString('base64url');
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const refreshTtl = this.config.get('STAFF_REFRESH_TTL', { infer: true });
    const expiresAt = new Date(
      Date.now() + this.parseDurationMs(refreshTtl),
    );

    await this.prisma.staffSession.create({
      data: {
        staffUserId: user.id,
        refreshTokenHash,
        expiresAt,
      },
    });

    const { accessToken, expiresIn } = this.jwt.mintAccessToken(user);
    const permissions = this.jwt
      .verifyAccessToken(accessToken)
      .permissions.map(String);

    return {
      accessToken,
      expiresIn,
      refreshToken,
      refreshExpiresIn: refreshTtl,
      staff: {
        id: user.id,
        email: user.email,
        casinoGroupId: user.casinoGroupId,
        roles: user.roles.map(String),
        permissions,
      },
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const hash = this.hashRefreshToken(refreshToken);
    await this.prisma.staffSession.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async refresh(refreshToken: string): Promise<StaffLoginResult> {
    const hash = this.hashRefreshToken(refreshToken);
    const session = await this.prisma.staffSession.findUnique({
      where: { refreshTokenHash: hash },
      include: { staffUser: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      session.staffUser.status !== StaffUserStatus.ACTIVE
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.staffSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const user = session.staffUser;
    const newRefresh = randomBytes(32).toString('base64url');
    const refreshTtl = this.config.get('STAFF_REFRESH_TTL', { infer: true });
    await this.prisma.staffSession.create({
      data: {
        staffUserId: user.id,
        refreshTokenHash: this.hashRefreshToken(newRefresh),
        expiresAt: new Date(Date.now() + this.parseDurationMs(refreshTtl)),
      },
    });

    const { accessToken, expiresIn } = this.jwt.mintAccessToken(user);
    const permissions = this.jwt
      .verifyAccessToken(accessToken)
      .permissions.map(String);

    return {
      accessToken,
      expiresIn,
      refreshToken: newRefresh,
      refreshExpiresIn: refreshTtl,
      staff: {
        id: user.id,
        email: user.email,
        casinoGroupId: user.casinoGroupId,
        roles: user.roles.map(String),
        permissions,
      },
    };
  }

  /** Hash a plaintext password for storage (seed / staff create). */
  async hashPassword(plaintext: string): Promise<string> {
    return argon2.hash(plaintext);
  }

  async changePassword(
    staffUserId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.staffUser.findUnique({
      where: { id: staffUserId },
      select: { id: true, passwordHash: true, status: true },
    });
    if (!user || user.status !== StaffUserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await this.hashPassword(newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.staffUser.update({
        where: { id: staffUserId },
        data: { passwordHash },
      });
      await tx.staffSession.deleteMany({ where: { staffUserId } });
    });
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDurationMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) {
      throw new ForbiddenException('Invalid STAFF_REFRESH_TTL configuration');
    }
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return value * multipliers[unit];
  }
}
