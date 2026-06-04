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
}
