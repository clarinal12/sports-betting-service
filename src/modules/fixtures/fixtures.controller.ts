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
import { PaginatedDto } from '../../shared/dto/pagination';
import { FixtureResponseDto } from './dto/fixture-response.dto';
import { ListFixturesQueryDto } from './dto/list-fixtures-query.dto';
import { FixturesService } from './fixtures.service';

@ApiTags('player')
@ApiHeader({
  name: CASINO_GROUP_HEADER,
  required: true,
  description: 'Casino group slug',
})
@UseGuards(CasinoGroupGuard)
@Controller('fixtures')
export class FixturesController {
  constructor(private readonly fixturesService: FixturesService) {}

  @Get()
  @ApiOperation({ summary: 'List fixtures (schedule) for the casino group' })
  @ApiOkResponse({ type: PaginatedDto<FixtureResponseDto> })
  list(
    @CasinoGroup() group: CasinoGroupContext,
    @Query() query: ListFixturesQueryDto,
  ): Promise<PaginatedDto<FixtureResponseDto>> {
    return this.fixturesService.listForGroup(group.id, query);
  }
}
