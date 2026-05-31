import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListLeaguesQueryDto {
  @ApiPropertyOptional({ description: 'Filter by sport id' })
  @IsOptional()
  @IsString()
  sportId?: string;
}
