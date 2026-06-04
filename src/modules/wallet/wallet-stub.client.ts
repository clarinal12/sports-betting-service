import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { EnvConfig } from '../../shared/config/env.validation';
import { stakeLessOrEqualBalance } from '../../shared/decimal/bet-math';
import {
  WalletBalance,
  WalletCreditRequest,
  WalletCreditResult,
  WalletPort,
  WalletReserveError,
  WalletReserveRequest,
  WalletReserveResult,
} from './wallet.port';

/**
 * In-memory wallet for local dev and e2e when no user service is configured.
 */
@Injectable()
export class WalletStubClient implements WalletPort {
  private readonly logger = new Logger(WalletStubClient.name);
  private readonly balances = new Map<string, Prisma.Decimal>();
  private readonly creditIds = new Map<string, string>();

  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  async getBalance(
    userId: string,
    _casinoGroupId: string,
  ): Promise<WalletBalance> {
    const balance = this.balanceFor(userId);
    return {
      balance: balance.toFixed(2),
      currency: 'USD',
    };
  }

  async reserve(request: WalletReserveRequest): Promise<WalletReserveResult> {
    const stake = new Prisma.Decimal(request.amount);
    const balance = this.balanceFor(request.userId);

    if (!stakeLessOrEqualBalance(stake, balance.toFixed(2))) {
      throw new WalletReserveError('Insufficient balance', 'INSUFFICIENT_FUNDS');
    }

    this.balances.set(
      request.userId,
      balance.minus(stake),
    );
    this.logger.debug(
      `Stub reserve ${request.amount} for user ${request.userId} (ref ${request.reference})`,
    );

    return { reservationId: `stub-${request.reference}` };
  }

  async creditPayout(request: WalletCreditRequest): Promise<WalletCreditResult> {
    const existing = this.creditIds.get(request.idempotencyKey);
    if (existing) {
      return { transactionId: existing };
    }

    const amount = new Prisma.Decimal(request.amount);
    const balance = this.balanceFor(request.userId);
    this.balances.set(request.userId, balance.plus(amount));
    const transactionId = `stub-credit-${request.reference}`;
    this.creditIds.set(request.idempotencyKey, transactionId);
    this.logger.debug(
      `Stub ${request.type} ${request.amount} for user ${request.userId} (ref ${request.reference})`,
    );
    return { transactionId };
  }

  private balanceFor(userId: string): Prisma.Decimal {
    const existing = this.balances.get(userId);
    if (existing) {
      return existing;
    }
    const initial = this.config.get('WALLET_STUB_BALANCE', { infer: true });
    return new Prisma.Decimal(initial);
  }
}
