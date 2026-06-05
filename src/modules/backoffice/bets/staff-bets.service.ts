import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BetLegOutcome, BetStatus } from '@prisma/client';
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
