import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CasinoGroup } from '../casino-groups/casino-group.decorator';
import { type CasinoGroupContext } from '../casino-groups/casino-group.types';
import { PlayerAuth } from '../auth/player-auth.decorator';
import { LeagueResponseDto } from './dto/league-response.dto';
import { ListLeaguesQueryDto } from './dto/list-leagues-query.dto';
import { LeaguesService } from './leagues.service';

@ApiTags('player')
@PlayerAuth()
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
