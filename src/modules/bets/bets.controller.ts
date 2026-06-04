import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlayerAuth } from '../auth/player-auth.decorator';
import type { UserContext } from '../auth/user-context.types';
import { BetsService } from './bets.service';
import { BetResponseDto } from './dto/bet-response.dto';
import { PlaceBetDto } from './dto/place-bet.dto';
import { IDEMPOTENCY_HEADER, IdempotencyKey } from './idempotency-key.decorator';

@ApiTags('player')
@PlayerAuth()
@Controller('bets')
export class BetsController {
  constructor(private readonly bets: BetsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Place a bet (requires session token)' })
  @ApiHeader({
    name: IDEMPOTENCY_HEADER,
    required: true,
    description: 'Client-generated idempotency key (max 128 chars)',
  })
  @ApiCreatedResponse({ type: BetResponseDto })
  placeBet(
    @CurrentUser() user: UserContext,
    @IdempotencyKey() idempotencyKey: string,
    @Body() body: PlaceBetDto,
  ): Promise<BetResponseDto> {
    return this.bets.placeBet(
      user,
      idempotencyKey,
      body.selectionIds,
      body.stake,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List bets for the authenticated player' })
  @ApiOkResponse({ type: BetResponseDto, isArray: true })
  listBets(
    @CurrentUser() user: UserContext,
    @Query('limit') limit?: string,
  ): Promise<BetResponseDto[]> {
    const parsed = limit ? Number.parseInt(limit, 10) : 50;
    return this.bets.listForUser(
      user.casinoGroupId,
      user.userId,
      Number.isFinite(parsed) ? parsed : 50,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get bet detail' })
  @ApiOkResponse({ type: BetResponseDto })
  getBet(
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
  ): Promise<BetResponseDto> {
    return this.bets.getForUser(user.casinoGroupId, user.userId, id);
  }
}
