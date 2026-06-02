import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { LaunchResponseDto } from './dto/launch-response.dto';
import { OperatorTokenVerifier } from './operator-token.verifier';
import { SessionService } from './session.service';
import { UserContext } from './user-context.types';

@ApiTags('auth')
@Controller('launch')
export class LaunchController {
  constructor(
    private readonly verifier: OperatorTokenVerifier,
    private readonly sessions: SessionService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Exchange an operator launch token for a player session token',
  })
  @ApiQuery({
    name: 'token',
    required: true,
    description: 'Operator launch JWT',
  })
  @ApiOkResponse({ type: LaunchResponseDto })
  async launch(@Query('token') token?: string): Promise<LaunchResponseDto> {
    if (!token) {
      throw new BadRequestException('Missing launch token');
    }

    const { payload, credentials } = await this.verifier.verify(token);
    const user: UserContext = {
      userId: payload.userId,
      username: payload.username,
      casinoGroupId: credentials.group.id,
      currency: credentials.group.defaultCurrency,
    };

    const { sessionToken, expiresIn } = this.sessions.mint(user);
    return { sessionToken, expiresIn, user };
  }
}
