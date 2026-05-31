import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CASINO_GROUP_HEADER } from '../casino-groups/casino-group.types';
import { CasinoGroup } from '../casino-groups/casino-group.decorator';
import { CasinoGroupGuard } from '../casino-groups/casino-group.guard';
import { type CasinoGroupContext } from '../casino-groups/casino-group.types';
import { MarketResponseDto } from './dto/market-response.dto';
import { MarketsService } from './markets.service';

@ApiTags('player')
@ApiHeader({
  name: CASINO_GROUP_HEADER,
  required: true,
  description: 'Casino group slug',
})
@UseGuards(CasinoGroupGuard)
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
