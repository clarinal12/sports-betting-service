import { ApiProperty } from '@nestjs/swagger';

export class BetLegResponseDto {
  @ApiProperty()
  selectionId!: string;

  @ApiProperty()
  marketId!: string;

  @ApiProperty()
  eventId!: string;

  @ApiProperty()
  selectionName!: string;

  @ApiProperty({ example: '2.10' })
  priceAtPlacement!: string;

  @ApiProperty({ enum: ['PENDING', 'WON', 'LOST', 'VOID'] })
  outcome!: string;

  @ApiProperty({
    required: false,
    enum: ['MATCH_RESULT', 'HANDICAP', 'TOTALS'],
    description: 'Frozen at placement for settlement grading',
  })
  marketType?: string | null;

  @ApiProperty({
    required: false,
    example: '2.50',
    description: 'Handicap/totals line at placement',
  })
  marketLine?: string | null;

  @ApiProperty({ required: false })
  homeTeamName?: string | null;

  @ApiProperty({ required: false })
  awayTeamName?: string | null;

  @ApiProperty({
    required: false,
    description: 'Provider event id at placement (e.g. Odds API event id)',
  })
  eventProviderRef?: string | null;
}
