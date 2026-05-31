import { Injectable, NotFoundException } from '@nestjs/common';
import { EventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { EventResponseDto } from './dto/event-response.dto';

const eventSelect = {
  id: true,
  fixtureId: true,
  status: true,
  homeScore: true,
  awayScore: true,
  period: true,
  clock: true,
  fixture: {
    select: {
      leagueId: true,
      startsAt: true,
      homeTeam: { select: { id: true, name: true, shortName: true } },
      awayTeam: { select: { id: true, name: true, shortName: true } },
    },
  },
} satisfies Prisma.EventSelect;

type EventRow = Prisma.EventGetPayload<{ select: typeof eventSelect }>;

function toEventDto(event: EventRow): EventResponseDto {
  return {
    id: event.id,
    fixtureId: event.fixtureId,
    leagueId: event.fixture.leagueId,
    status: event.status,
    startsAt: event.fixture.startsAt.toISOString(),
    homeScore: event.homeScore,
    awayScore: event.awayScore,
    period: event.period,
    clock: event.clock,
    homeTeam: event.fixture.homeTeam,
    awayTeam: event.fixture.awayTeam,
  };
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Live events for the tenant (leagues the group enables).
   */
  async listLive(casinoGroupId: string): Promise<EventResponseDto[]> {
    const events = await this.prisma.event.findMany({
      where: {
        status: EventStatus.LIVE,
        fixture: {
          league: { groups: { some: { casinoGroupId, enabled: true } } },
        },
      },
      orderBy: { fixture: { startsAt: 'asc' } },
      select: eventSelect,
    });
    return events.map(toEventDto);
  }

  async getById(
    casinoGroupId: string,
    eventId: string,
  ): Promise<EventResponseDto> {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        fixture: {
          league: { groups: { some: { casinoGroupId, enabled: true } } },
        },
      },
      select: eventSelect,
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return toEventDto(event);
  }
}
