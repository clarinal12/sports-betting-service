import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LeagueResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'soccer_epl' })
  key: string;

  @ApiProperty({ example: 'Premier League' })
  name: string;

  @ApiPropertyOptional({ example: 'England' })
  region: string | null;

  @ApiProperty()
  sportId: string;
}
