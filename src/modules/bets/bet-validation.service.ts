import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventStatus,
  MarketStatus,
  Prisma,
  SelectionStatus,
} from '@prisma/client';
import { EnvConfig } from '../../shared/config/env.validation';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  combinedOddsFromPrices,
  potentialPayout,
} from '../../shared/decimal/bet-math';

export interface ValidatedLeg {
  selectionId: string;
  marketId: string;
  eventId: string;
  selectionName: string;
  price: Prisma.Decimal;
}

export interface ValidatedBetQuote {
  stake: Prisma.Decimal;
  combinedOdds: Prisma.Decimal;
  potentialPayout: Prisma.Decimal;
  legs: ValidatedLeg[];
}

@Injectable()
export class BetValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async validatePlacement(
    casinoGroupId: string,
    selectionIds: string[],
    stakeRaw: string,
  ): Promise<ValidatedBetQuote> {
    const uniqueIds = [...new Set(selectionIds)];
    if (uniqueIds.length !== selectionIds.length) {
      throw new BadRequestException('Duplicate selection ids are not allowed');
    }

    const stake = new Prisma.Decimal(stakeRaw);
    const minStake = new Prisma.Decimal(
      this.config.get('BET_MIN_STAKE', { infer: true }),
    );
    const maxStake = new Prisma.Decimal(
      this.config.get('BET_MAX_STAKE', { infer: true }),
    );
    if (stake.lt(minStake) || stake.gt(maxStake)) {
      throw new BadRequestException(
        `Stake must be between ${minStake.toFixed(2)} and ${maxStake.toFixed(2)}`,
      );
    }

    const selections = await this.prisma.selection.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        name: true,
        status: true,
        price: true,
        market: {
          select: {
            id: true,
            status: true,
            eventId: true,
            event: {
              select: {
                id: true,
                status: true,
                fixture: {
                  select: {
                    league: {
                      select: {
                        groups: {
                          where: { enabled: true },
                          select: { casinoGroupId: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (selections.length !== uniqueIds.length) {
      throw new NotFoundException('One or more selections were not found');
    }

    const legs: ValidatedLeg[] = [];
    const eventIds = new Set<string>();

    for (const selection of selections) {
      const { market } = selection;
      if (
        !market.event.fixture.league.groups.some(
          (g) => g.casinoGroupId === casinoGroupId,
        )
      ) {
        throw new NotFoundException('Selection not available for this casino group');
      }
      if (selection.status !== SelectionStatus.OPEN) {
        throw new BadRequestException(
          `Selection ${selection.name} is not open for betting`,
        );
      }
      if (market.status !== MarketStatus.OPEN) {
        throw new BadRequestException('Market is not open for betting');
      }
      if (
        market.event.status === EventStatus.ENDED ||
        market.event.status === EventStatus.CANCELLED ||
        market.event.status === EventStatus.SUSPENDED
      ) {
        throw new BadRequestException('Event is not open for betting');
      }
      eventIds.add(market.eventId);
      legs.push({
        selectionId: selection.id,
        marketId: market.id,
        eventId: market.eventId,
        selectionName: selection.name,
        price: selection.price,
      });
    }

    const combinedOdds = combinedOddsFromPrices(legs.map((l) => l.price));
    const payout = potentialPayout(stake, combinedOdds);
    const maxPayout = new Prisma.Decimal(
      this.config.get('BET_MAX_PAYOUT', { infer: true }),
    );
    if (payout.gt(maxPayout)) {
      throw new BadRequestException(
        `Potential payout exceeds maximum of ${maxPayout.toFixed(2)}`,
      );
    }

    return {
      stake,
      combinedOdds,
      potentialPayout: payout,
      legs,
    };
  }
}
