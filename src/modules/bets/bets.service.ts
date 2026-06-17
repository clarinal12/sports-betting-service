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
import { WalletOutboxService } from '../wallet/wallet-outbox.service';
import { WALLET_OUTBOX_DEBIT } from '../wallet/wallet-outbox.types';
import { newWalletTransactionCode } from '../wallet/wallet-transaction-code';
import { legSnapshotCreateData } from './bet-leg-snapshot';
import { BetValidationService } from './bet-validation.service';
import { toBetDto } from './bet.mapper';
import { BetResponseDto } from './dto/bet-response.dto';

@Injectable()
export class BetsService {
  private readonly logger = new Logger(BetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: BetValidationService,
    @Inject(WALLET_PORT) private readonly wallet: WalletPort,
    private readonly walletOutbox: WalletOutboxService,
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

    const transactionCode = newWalletTransactionCode();
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
        walletOutbox: {
          create: {
            casinoGroupId: user.casinoGroupId,
            type: WALLET_OUTBOX_DEBIT,
            transactionCode,
            payload: {},
            status: WalletOutboxStatus.PENDING,
          },
        },
      },
      include: { legs: true },
    });

    const placed = await this.attemptWalletDebit(bet.id);
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

  private async retryPendingBet(betId: string) {
    return this.attemptWalletDebit(betId);
  }

  private async attemptWalletDebit(betId: string) {
    try {
      return await this.walletOutbox.processDebitForBet(betId);
    } catch (error) {
      if (error instanceof WalletReserveError) {
        throw new ServiceUnavailableException(
          'Bet accepted locally; wallet debit pending — retry with the same Idempotency-Key',
        );
      }
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.warn(
        `Wallet debit pending for bet ${betId}: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'Bet accepted locally; wallet debit pending — retry with the same Idempotency-Key',
      );
    }
  }
}
