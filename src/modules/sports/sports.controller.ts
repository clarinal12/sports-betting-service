import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CasinoGroup } from '../casino-groups/casino-group.decorator';
import type { CasinoGroupContext } from '../casino-groups/casino-group.types';
import { PlayerAuth } from '../auth/player-auth.decorator';
import { SportResponseDto } from './dto/sport-response.dto';
import { SportsService } from './sports.service';

@ApiTags('player')
@PlayerAuth()
@Controller('sports')
export class SportsController {
  constructor(private readonly sportsService: SportsService) {}

  @Get()
  @ApiOperation({ summary: 'List sports offered to the casino group' })
  @ApiOkResponse({ type: SportResponseDto, isArray: true })
  list(@CasinoGroup() group: CasinoGroupContext): Promise<SportResponseDto[]> {
    return this.sportsService.listForGroup(group.id);
  }
}
