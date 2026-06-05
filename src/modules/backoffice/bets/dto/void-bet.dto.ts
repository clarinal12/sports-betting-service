import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VoidBetDto {
  @ApiProperty({ example: 'Duplicate bet placed in error' })
  @IsString()
  @MinLength(3)
  reason!: string;
}
