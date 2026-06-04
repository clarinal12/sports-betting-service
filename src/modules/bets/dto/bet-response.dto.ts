import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BetLegResponseDto } from './bet-leg-response.dto';

export class BetResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'WON', 'LOST', 'VOID'],
  })
  status!: string;

  @ApiProperty({ example: '10.00' })
  stake!: string;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ example: '4.200' })
  combinedOdds!: string;

  @ApiProperty({ example: '42.00' })
  potentialPayout!: string;

  @ApiPropertyOptional()
  rejectionReason?: string | null;

  @ApiPropertyOptional({
    description:
      'Set when results are overdue from the provider; cleared when settled.',
  })
  settlementNote?: string | null;

  @ApiPropertyOptional({ example: '42.00' })
  payoutAmount?: string | null;

  @ApiPropertyOptional()
  settledAt?: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ type: [BetLegResponseDto] })
  legs!: BetLegResponseDto[];
}
