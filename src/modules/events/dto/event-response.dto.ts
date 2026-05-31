import { ApiProperty } from '@nestjs/swagger';
import { EventStatus } from '@prisma/client';
import { FixtureTeamDto } from '../../fixtures/dto/fixture-response.dto';

export class EventResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fixtureId: string;

  @ApiProperty()
  leagueId: string;

  @ApiProperty({ enum: EventStatus })
  status: EventStatus;

  @ApiProperty({ description: 'Kickoff time (ISO 8601, UTC)' })
  startsAt: string;

  @ApiProperty({ nullable: true })
  homeScore: number | null;

  @ApiProperty({ nullable: true })
  awayScore: number | null;

  @ApiProperty({ nullable: true })
  period: string | null;

  @ApiProperty({ nullable: true })
  clock: string | null;

  @ApiProperty({ type: FixtureTeamDto })
  homeTeam: FixtureTeamDto;

  @ApiProperty({ type: FixtureTeamDto })
  awayTeam: FixtureTeamDto;
}
