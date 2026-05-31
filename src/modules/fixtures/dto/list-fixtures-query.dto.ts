import { ApiPropertyOptional } from '@nestjs/swagger';
import { FixtureStatus } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../shared/dto/pagination';

export class ListFixturesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Earliest kickoff (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Latest kickoff (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ description: 'Filter by league id' })
  @IsOptional()
  @IsString()
  leagueId?: string;

  @ApiPropertyOptional({ enum: FixtureStatus })
  @IsOptional()
  @IsEnum(FixtureStatus)
  status?: FixtureStatus;
}
