import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class ApplyEventResultDto {
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
