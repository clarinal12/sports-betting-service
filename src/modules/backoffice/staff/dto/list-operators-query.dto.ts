import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ListOperatorsQueryDto {
  @ApiProperty({ description: 'Casino group id for the merchant tenant' })
  @IsString()
  @MinLength(1)
  casinoGroupId!: string;
}
