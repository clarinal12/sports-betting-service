import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CasinoGroup } from '../casino-groups/casino-group.decorator';
import { CasinoGroupGuard } from '../casino-groups/casino-group.guard';
import {
  CASINO_GROUP_HEADER,
  type CasinoGroupContext,
} from '../casino-groups/casino-group.types';
import { LeagueResponseDto } from './dto/league-response.dto';
import { ListLeaguesQueryDto } from './dto/list-leagues-query.dto';
import { LeaguesService } from './leagues.service';

@ApiTags('player')
@ApiHeader({
  name: CASINO_GROUP_HEADER,
  required: true,
  description: 'Casino group slug',
})
@UseGuards(CasinoGroupGuard)
@Controller('leagues')
export class LeaguesController {
  constructor(private readonly leaguesService: LeaguesService) {}

  @Get()
  @ApiOperation({ summary: 'List leagues offered to the casino group' })
  @ApiOkResponse({ type: LeagueResponseDto, isArray: true })
  list(
    @CasinoGroup() group: CasinoGroupContext,
    @Query() query: ListLeaguesQueryDto,
  ): Promise<LeagueResponseDto[]> {
    return this.leaguesService.listForGroup(group.id, query.sportId);
  }
}
