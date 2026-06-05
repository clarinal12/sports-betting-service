import { Body, Controller, Get, Header, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { StaffAuthService } from './staff-auth.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { CurrentStaff } from './current-staff.decorator';
import {
  StaffLoginDto,
  StaffLogoutDto,
  StaffRefreshDto,
} from './dto/staff-login.dto';
import type { StaffContext } from './staff-context.types';

@ApiTags('backoffice-auth')
@Controller('backoffice/auth')
export class StaffAuthController {
  constructor(private readonly auth: StaffAuthService) {}

  @Post('login')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ description: 'Staff access + refresh tokens' })
  login(@Body() body: StaffLoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Post('refresh')
  @Header('Cache-Control', 'no-store')
  refresh(@Body() body: StaffRefreshDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @Header('Cache-Control', 'no-store')
  logout(@Body() body: StaffLogoutDto) {
    return this.auth.logout(body.refreshToken);
  }

  @Get('me')
  @UseGuards(StaffAuthGuard)
  @ApiBearerAuth()
  me(@CurrentStaff() staff: StaffContext) {
    return {
      id: staff.staffUserId,
      email: staff.email,
      casinoGroupId: staff.casinoGroupId,
      roles: staff.roles,
      permissions: staff.permissions,
    };
  }
}
