import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlayerAuth } from '../auth/player-auth.decorator';
import type { UserContext } from '../auth/user-context.types';
import { WalletBalanceResponseDto } from './dto/wallet-balance-response.dto';
import { WalletService } from './wallet.service';

@ApiTags('player')
@PlayerAuth()
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get the authenticated player wallet balance' })
  @ApiOkResponse({ type: WalletBalanceResponseDto })
  getBalance(@CurrentUser() user: UserContext): Promise<WalletBalanceResponseDto> {
    return this.wallet.getBalance(user);
  }
}
