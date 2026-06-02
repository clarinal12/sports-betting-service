import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CasinoGroup } from '../casino-groups/casino-group.decorator';
import { type CasinoGroupContext } from '../casino-groups/casino-group.types';
import { PlayerAuth } from '../auth/player-auth.decorator';
import { MarketResponseDto } from '../markets/dto/market-response.dto';
import { MarketsService } from '../markets/markets.service';
import { EventResponseDto } from './dto/event-response.dto';
import { EventsService } from './events.service';

@ApiTags('player')
@PlayerAuth()
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly marketsService: MarketsService,
  ) {}

  @Get('live')
  @ApiOperation({ summary: 'List live events for the casino group' })
  @ApiOkResponse({ type: EventResponseDto, isArray: true })
  listLive(
    @CasinoGroup() group: CasinoGroupContext,
  ): Promise<EventResponseDto[]> {
    return this.eventsService.listLive(group.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event detail and live state' })
  @ApiOkResponse({ type: EventResponseDto })
  getById(
    @CasinoGroup() group: CasinoGroupContext,
    @Param('id') id: string,
  ): Promise<EventResponseDto> {
    return this.eventsService.getById(group.id, id);
  }

  @Get(':id/markets')
  @ApiOperation({ summary: 'List markets and selections for an event' })
  @ApiOkResponse({ type: MarketResponseDto, isArray: true })
  listMarkets(
    @CasinoGroup() group: CasinoGroupContext,
    @Param('id') id: string,
  ): Promise<MarketResponseDto[]> {
    return this.marketsService.listForEvent(group.id, id);
  }
}
