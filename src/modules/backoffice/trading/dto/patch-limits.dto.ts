import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class PatchRiskLimitsDto {
  @ApiPropertyOptional({ example: '1.00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  minStake?: string;

  @ApiPropertyOptional({ example: '10000.00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  maxStake?: string;

  @ApiPropertyOptional({ example: '100000.00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  maxPayout?: string;
}
