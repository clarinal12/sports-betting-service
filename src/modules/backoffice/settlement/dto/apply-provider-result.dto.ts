import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class ApplyProviderResultDto {
  @ApiProperty({
    example: 'fd1e64710aa2e27f2e169c43a290c3c3',
    description: 'Event providerRef from the feed',
  })
  @IsString()
  @MinLength(3)
  providerRef!: string;

  @ApiProperty({ example: 102 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  homeScore!: number;

  @ApiProperty({ example: 98 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  awayScore!: number;
}
