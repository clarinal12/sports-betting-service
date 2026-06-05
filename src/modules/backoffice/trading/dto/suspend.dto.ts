import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SuspendReasonDto {
  @ApiProperty({ example: 'Suspicious betting pattern' })
  @IsString()
  @MinLength(3)
  reason!: string;
}
