import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CasinoGroupStatus } from '@prisma/client';

export class PatchTenantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  defaultCurrency?: string;

  @ApiPropertyOptional({ example: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ enum: CasinoGroupStatus })
  @IsOptional()
  @IsEnum(CasinoGroupStatus)
  status?: CasinoGroupStatus;
}
