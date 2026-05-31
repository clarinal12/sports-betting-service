import { ApiProperty } from '@nestjs/swagger';
import { FixtureStatus } from '@prisma/client';

export class FixtureTeamDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  shortName: string | null;
}

export class FixtureResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  leagueId: string;

  @ApiProperty()
  startsAt: string;

  @ApiProperty({ enum: FixtureStatus })
  status: FixtureStatus;

  @ApiProperty({ type: FixtureTeamDto })
  homeTeam: FixtureTeamDto;

  @ApiProperty({ type: FixtureTeamDto })
  awayTeam: FixtureTeamDto;
}
