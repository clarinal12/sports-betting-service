import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CASINO_GROUP_HEADER } from '../casino-groups/casino-group.types';
import { CasinoGroup } from '../casino-groups/casino-group.decorator';
import { CasinoGroupGuard } from '../casino-groups/casino-group.guard';
import type { CasinoGroupContext } from '../casino-groups/casino-group.types';
import { SportResponseDto } from './dto/sport-response.dto';
import { SportsService } from './sports.service';

@ApiTags('player')
@ApiHeader({
  name: CASINO_GROUP_HEADER,
  required: true,
  description: 'Casino group slug',
})
@UseGuards(CasinoGroupGuard)
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
