import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CasinoGroup } from '../casino-groups/casino-group.decorator';
import { type CasinoGroupContext } from '../casino-groups/casino-group.types';
import { PlayerAuth } from '../auth/player-auth.decorator';
import { MarketResponseDto } from './dto/market-response.dto';
import { MarketsService } from './markets.service';

@ApiTags('player')
@PlayerAuth()
@Controller('markets')
export class MarketsController {
  constructor(private readonly marketsService: MarketsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get a single market with selections and odds' })
  @ApiOkResponse({ type: MarketResponseDto })
  getById(
    @CasinoGroup() group: CasinoGroupContext,
    @Param('id') id: string,
  ): Promise<MarketResponseDto> {
    return this.marketsService.getById(group.id, id);
  }
}
