import { ApiProperty } from '@nestjs/swagger';

export class LaunchUserDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  casinoGroupId: string;

  @ApiProperty({ example: 'USD' })
  currency: string;
}

export class LaunchResponseDto {
  @ApiProperty({ description: 'Session token for Authorization: Bearer' })
  sessionToken: string;

  @ApiProperty({ example: '30m' })
  expiresIn: string;

  @ApiProperty({ type: LaunchUserDto })
  user: LaunchUserDto;
}
