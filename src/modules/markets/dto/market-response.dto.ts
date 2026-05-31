import { ApiProperty } from '@nestjs/swagger';
import { MarketStatus, MarketType, SelectionStatus } from '@prisma/client';

export class SelectionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Home' })
  name: string;

  @ApiProperty({ enum: SelectionStatus })
  status: SelectionStatus;

  @ApiProperty({
    description: 'Decimal odds as a string to preserve precision',
    example: '2.10',
  })
  price: string;
}

export class MarketResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  eventId: string;

  @ApiProperty({ enum: MarketType })
  type: MarketType;

  @ApiProperty({ enum: MarketStatus })
  status: MarketStatus;

  @ApiProperty({
    nullable: true,
    description: 'Handicap/total line as a string when applicable',
    example: '2.50',
  })
  line: string | null;

  @ApiProperty({ type: SelectionResponseDto, isArray: true })
  selections: SelectionResponseDto[];
}
