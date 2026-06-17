import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { EnvConfig } from '../../shared/config/env.validation';
import { stakeLessOrEqualBalance } from '../../shared/decimal/bet-math';
import {
  WalletBalance,
  WalletBatchTransactionRequest,
  WalletBatchTransactionResult,
  WalletPort,
  WalletReserveError,
  WalletTransactionRequest,
  WalletTransactionResult,
} from './wallet.port';

/**
 * In-memory wallet for local dev and e2e when no user service is configured.
 */
@Injectable()
export class WalletStubClient implements WalletPort {
  private readonly logger = new Logger(WalletStubClient.name);
  private readonly balances = new Map<string, Prisma.Decimal>();
  private readonly postedCodes = new Set<string>();

  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  async getBalance(
    userCode: string,
    _casinoGroupId: string,
  ): Promise<WalletBalance> {
    const balance = this.balanceFor(userCode);
    return {
      balance: balance.toFixed(2),
      currency: 'USD',
    };
  }

  async postTransaction(
    request: WalletTransactionRequest,
  ): Promise<WalletTransactionResult> {
    if (this.postedCodes.has(request.transactionCode)) {
      return { transactionId: request.transactionCode };
    }

    const amount = new Prisma.Decimal(request.amount);
    const balance = this.balanceFor(request.userCode);

    if (amount.lt(0)) {
      const stake = amount.abs();
      if (!stakeLessOrEqualBalance(stake, balance.toFixed(2))) {
        throw new WalletReserveError('Insufficient balance', 'INSUFFICIENT_FUNDS');
      }
      this.balances.set(request.userCode, balance.minus(stake));
    } else if (amount.gt(0)) {
      this.balances.set(request.userCode, balance.plus(amount));
    }

    this.postedCodes.add(request.transactionCode);
    this.logger.debug(
      `Stub wallet tx ${request.transactionCode} ${request.amount} for ${request.userCode} (${request.detail})`,
    );
    return { transactionId: request.transactionCode };
  }

  async postTransactionBatch(
    request: WalletBatchTransactionRequest,
  ): Promise<WalletBatchTransactionResult> {
    for (const transaction of request.transactions) {
      await this.postTransaction(transaction);
    }
    return { batchId: request.batchId };
  }

  private balanceFor(userCode: string): Prisma.Decimal {
    const existing = this.balances.get(userCode);
    if (existing) {
      return existing;
    }
    const initial = this.config.get('WALLET_STUB_BALANCE', { infer: true });
    return new Prisma.Decimal(initial);
  }
}
