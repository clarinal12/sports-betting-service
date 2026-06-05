import { ApiPropertyOptional } from '@nestjs/swagger';
import { BetStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchBetsQueryDto {
  @ApiPropertyOptional({ description: 'Required for platform staff; ignored for tenant staff' })
  @IsOptional()
  @IsString()
  casinoGroupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ enum: BetStatus })
  @IsOptional()
  @IsEnum(BetStatus)
  status?: BetStatus;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
