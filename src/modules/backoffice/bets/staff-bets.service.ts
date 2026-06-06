import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BetLegOutcome, BetStatus, WalletOutboxStatus } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { decimalToString } from '../../../shared/decimal/decimal.util';
import { AuditService } from '../../../shared/audit/audit.service';
import { toBetDto } from '../../bets/bet.mapper';
import { WALLET_PORT } from '../../wallet/wallet.port';
import type { WalletPort } from '../../wallet/wallet.port';
import { SearchBetsQueryDto } from './dto/search-bets.dto';

@Injectable()
export class StaffBetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(WALLET_PORT) private readonly wallet: WalletPort,
  ) {}

  async search(casinoGroupId: string, query: SearchBetsQueryDto) {
    const limit = query.limit ?? 50;
    const bets = await this.prisma.bet.findMany({
      where: {
        casinoGroupId,
        ...(query.userId ? { userId: query.userId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.eventId
          ? { legs: { some: { eventId: query.eventId } } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { legs: true },
    });

    return bets.map((bet) => ({
      ...toBetDto(bet),
      userId: bet.userId,
    }));
  }

  async getById(casinoGroupId: string, betId: string) {
    const bet = await this.prisma.bet.findFirst({
      where: { id: betId, casinoGroupId },
      include: { legs: true },
    });
    if (!bet) {
      throw new NotFoundException('Bet not found');
    }
    return {
      ...toBetDto(bet),
      userId: bet.userId,
      walletReservationId: bet.walletReservationId,
      idempotencyKey: bet.idempotencyKey,
    };
  }

  async listExceptions(casinoGroupId: string) {
    const [pendingPlacement, settlementFlags, failedOutboxRows] =
      await Promise.all([
        this.prisma.bet.findMany({
          where: { casinoGroupId, status: BetStatus.PENDING },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            userId: true,
            status: true,
            stake: true,
            currency: true,
            rejectionReason: true,
            createdAt: true,
          },
        }),
        this.prisma.bet.findMany({
          where: {
            casinoGroupId,
            status: BetStatus.ACCEPTED,
            settlementNote: { not: null },
          },
          orderBy: { updatedAt: 'desc' },
          take: 50,
          select: {
            id: true,
            userId: true,
            status: true,
            stake: true,
            currency: true,
            settlementNote: true,
            updatedAt: true,
          },
        }),
        this.prisma.walletOutbox.findMany({
          where: {
            status: { in: [WalletOutboxStatus.FAILED, WalletOutboxStatus.PENDING] },
          },
          orderBy: { updatedAt: 'desc' },
          take: 100,
          select: {
            id: true,
            betId: true,
            status: true,
            attempts: true,
            lastError: true,
            nextRetryAt: true,
            updatedAt: true,
          },
        }),
      ]);

    const betIds = failedOutboxRows.map((row) => row.betId);
    const outboxBets =
      betIds.length > 0
        ? await this.prisma.bet.findMany({
            where: { id: { in: betIds }, casinoGroupId },
            select: {
              id: true,
              userId: true,
              status: true,
              stake: true,
              currency: true,
            },
          })
        : [];
    const betById = new Map(outboxBets.map((bet) => [bet.id, bet]));

    const walletFailures = failedOutboxRows
      .filter((row) => betById.has(row.betId))
      .map((row) => ({
        outboxId: row.id,
        betId: row.betId,
        outboxStatus: row.status,
        attempts: row.attempts,
        lastError: row.lastError,
        nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
        bet: betById.get(row.betId)!,
      }));

    return {
      casinoGroupId,
      pendingPlacement: pendingPlacement.map((bet) => ({
        ...bet,
        stake: decimalToString(bet.stake),
        createdAt: bet.createdAt.toISOString(),
      })),
      settlementFlags: settlementFlags.map((bet) => ({
        ...bet,
        stake: decimalToString(bet.stake),
        updatedAt: bet.updatedAt.toISOString(),
      })),
      walletFailures,
      totalCount:
        pendingPlacement.length +
        settlementFlags.length +
        walletFailures.length,
    };
  }

  async voidBet(
    casinoGroupId: string,
    betId: string,
    reason: string,
    staffUserId: string,
  ) {
    const bet = await this.prisma.bet.findFirst({
      where: { id: betId, casinoGroupId },
      include: { legs: true },
    });
    if (!bet) {
      throw new NotFoundException('Bet not found');
    }
    if (bet.status !== BetStatus.ACCEPTED) {
      throw new BadRequestException('Only ACCEPTED bets can be voided');
    }
    if (reason.startsWith('other:') && !reason.includes(' — ')) {
      throw new BadRequestException(
        'A note is required when void reason code is other',
      );
    }

    await this.wallet.creditPayout({
      userId: bet.userId,
      casinoGroupId: bet.casinoGroupId,
      amount: decimalToString(bet.stake),
      currency: bet.currency,
      reference: bet.id,
      idempotencyKey: `void-${bet.id}`,
      type: 'REFUND',
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const leg of bet.legs) {
        await tx.betLeg.update({
          where: { id: leg.id },
          data: { outcome: BetLegOutcome.VOID },
        });
      }
      return tx.bet.update({
        where: { id: bet.id },
        data: {
          status: BetStatus.VOID,
          payoutAmount: bet.stake,
          settledAt: new Date(),
          settlementNote: `Voided by staff: ${reason}`,
        },
        include: { legs: true },
      });
    });

    await this.audit.record({
      actorType: 'staff',
      actorId: staffUserId,
      casinoGroupId,
      action: 'bets.voided',
      entityType: 'Bet',
      entityId: betId,
      before: { status: bet.status },
      after: { status: BetStatus.VOID },
      reason,
    });

    return {
      ...toBetDto(updated),
      userId: updated.userId,
    };
  }
}
