import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BetStatus, WalletOutboxStatus } from '@prisma/client';
import { UserContext } from '../auth/user-context.types';
import { PrismaService } from '../../shared/database/prisma.service';
import { MetricsService } from '../../shared/metrics/metrics.service';
import { stakeLessOrEqualBalance } from '../../shared/decimal/bet-math';
import { WALLET_PORT, WalletReserveError } from '../wallet/wallet.port';
import type { WalletPort } from '../wallet/wallet.port';
import { legSnapshotCreateData } from './bet-leg-snapshot';
import { BetValidationService } from './bet-validation.service';
import { toBetDto } from './bet.mapper';
import { BetResponseDto } from './dto/bet-response.dto';
import { buildBetDebitTransaction } from '../wallet/wallet-transaction.builder';
import { newWalletTransactionCode } from '../wallet/wallet-transaction-code';

const OUTBOX_TYPE_RESERVE = 'WALLET_RESERVE';

interface WalletOutboxPayload {
  transactionCode: string;
}

@Injectable()
export class BetsService {
  private readonly logger = new Logger(BetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: BetValidationService,
    @Inject(WALLET_PORT) private readonly wallet: WalletPort,
    private readonly metrics: MetricsService,
  ) {}

  async placeBet(
    user: UserContext,
    idempotencyKey: string,
    selectionIds: string[],
    stake: string,
  ): Promise<BetResponseDto> {
    const existing = await this.prisma.bet.findUnique({
      where: {
        casinoGroupId_userId_idempotencyKey: {
          casinoGroupId: user.casinoGroupId,
          userId: user.userId,
          idempotencyKey,
        },
      },
      include: { legs: true },
    });

    if (existing) {
      if (existing.status === BetStatus.PENDING) {
        const retried = await this.retryPendingBet(existing.id);
        this.metrics.recordBetPlaced(retried.status);
        return toBetDto(retried);
      }
      this.metrics.recordBetPlaced(existing.status);
      return toBetDto(existing);
    }

    const quote = await this.validation.validatePlacement(
      user.casinoGroupId,
      selectionIds,
      stake,
    );

    const balance = await this.wallet.getBalance(
      user.username,
      user.casinoGroupId,
    );
    if (balance.currency !== user.currency) {
      throw new BadRequestException('Currency mismatch with wallet');
    }
    if (!stakeLessOrEqualBalance(quote.stake, balance.balance)) {
      throw new BadRequestException('Insufficient balance');
    }

    const bet = await this.prisma.bet.create({
      data: {
        casinoGroupId: user.casinoGroupId,
        userId: user.userId,
        username: user.username,
        idempotencyKey,
        stake: quote.stake,
        currency: user.currency,
        status: BetStatus.PENDING,
        combinedOdds: quote.combinedOdds,
        potentialPayout: quote.potentialPayout,
        legs: {
          create: quote.legs.map((leg, index) => ({
            selectionId: leg.selectionId,
            marketId: leg.marketId,
            eventId: leg.eventId,
            selectionName: leg.selectionName,
            priceAtPlacement: leg.price,
            legOrder: index,
            ...legSnapshotCreateData(leg.snapshot),
          })),
        },
      },
      include: { legs: true },
    });

    const transactionCode = newWalletTransactionCode();
    await this.prisma.walletOutbox.create({
      data: {
        betId: bet.id,
        type: OUTBOX_TYPE_RESERVE,
        status: WalletOutboxStatus.PENDING,
        payload: { transactionCode } satisfies WalletOutboxPayload,
      },
    });

    const placed = await this.attemptWalletReserve(bet.id);
    this.metrics.recordBetPlaced(placed.status);
    return toBetDto(placed);
  }

  async listForUser(
    casinoGroupId: string,
    userId: string,
    limit = 50,
  ): Promise<BetResponseDto[]> {
    const bets = await this.prisma.bet.findMany({
      where: { casinoGroupId, userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      include: { legs: true },
    });
    return bets.map(toBetDto);
  }

  async getForUser(
    casinoGroupId: string,
    userId: string,
    betId: string,
  ): Promise<BetResponseDto> {
    const bet = await this.prisma.bet.findFirst({
      where: { id: betId, casinoGroupId, userId },
      include: { legs: true },
    });
    if (!bet) {
      throw new NotFoundException('Bet not found');
    }
    return toBetDto(bet);
  }

  async processOutboxBatch(limit = 20): Promise<number> {
    const now = new Date();
    const entries = await this.prisma.walletOutbox.findMany({
      where: {
        status: WalletOutboxStatus.PENDING,
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let processed = 0;
    for (const entry of entries) {
      try {
        await this.attemptWalletReserve(entry.betId);
        processed += 1;
      } catch (error) {
        this.logger.warn(
          `Outbox entry ${entry.id} still pending: ${(error as Error).message}`,
        );
      }
    }
    return processed;
  }

  private async retryPendingBet(betId: string) {
    return this.attemptWalletReserve(betId);
  }

  private async attemptWalletReserve(betId: string) {
    const bet = await this.prisma.bet.findUnique({
      where: { id: betId },
      include: { legs: true },
    });
    if (!bet) {
      throw new NotFoundException('Bet not found');
    }
    if (bet.status === BetStatus.ACCEPTED) {
      return bet;
    }
    if (bet.status === BetStatus.REJECTED) {
      return bet;
    }

    const outbox = await this.prisma.walletOutbox.findUnique({
      where: { betId },
    });
    if (!outbox || outbox.status === WalletOutboxStatus.COMPLETED) {
      return bet;
    }

    const payload = outbox.payload as unknown as Partial<WalletOutboxPayload>;
    let transactionCode = payload.transactionCode;
    if (!transactionCode) {
      transactionCode = newWalletTransactionCode();
      await this.prisma.walletOutbox.update({
        where: { id: outbox.id },
        data: { payload: { transactionCode } satisfies WalletOutboxPayload },
      });
    }
    const transaction = buildBetDebitTransaction({
      bet,
      legs: bet.legs,
      transactionCode,
    });

    try {
      const result = await this.wallet.postTransaction(transaction);

      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.bet.update({
          where: { id: betId },
          data: {
            status: BetStatus.ACCEPTED,
            walletReservationId: result.transactionId,
            rejectionReason: null,
          },
          include: { legs: true },
        });
        await tx.walletOutbox.update({
          where: { betId },
          data: { status: WalletOutboxStatus.COMPLETED, lastError: null },
        });
        return updated;
      });
    } catch (error) {
      if (error instanceof WalletReserveError) {
        if (error.code === 'INSUFFICIENT_FUNDS') {
          return this.rejectBet(betId, error.message, outbox.id);
        }
        await this.scheduleOutboxRetry(
          outbox.id,
          outbox.attempts,
          error.message,
        );
        throw new ServiceUnavailableException(
          'Bet accepted locally; wallet debit pending — retry with the same Idempotency-Key',
        );
      }
      await this.scheduleOutboxRetry(
        outbox.id,
        outbox.attempts,
        (error as Error).message,
      );
      throw error;
    }
  }

  private async rejectBet(betId: string, reason: string, outboxId: string) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.bet.update({
        where: { id: betId },
        data: {
          status: BetStatus.REJECTED,
          rejectionReason: reason,
        },
        include: { legs: true },
      });
      await tx.walletOutbox.update({
        where: { id: outboxId },
        data: {
          status: WalletOutboxStatus.FAILED,
          lastError: reason,
        },
      });
      return updated;
    });
  }

  private async scheduleOutboxRetry(
    outboxId: string,
    attempts: number,
    message: string,
  ): Promise<void> {
    const nextAttempts = attempts + 1;
    const delaySeconds = Math.min(60 * nextAttempts, 900);
    await this.prisma.walletOutbox.update({
      where: { id: outboxId },
      data: {
        attempts: nextAttempts,
        lastError: message,
        nextRetryAt: new Date(Date.now() + delaySeconds * 1000),
      },
    });
  }
}
