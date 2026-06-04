import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, Matches } from 'class-validator';

export class PlaceBetDto {
  @ApiProperty({
    description: 'Selection ids (single or accumulator, max 12 legs)',
    example: ['clxyz123'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsString({ each: true })
  selectionIds!: string[];

  @ApiProperty({
    description: 'Stake amount as decimal string',
    example: '10.00',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'stake must be a positive decimal with up to 2 fractional digits',
  })
  stake!: string;
}
