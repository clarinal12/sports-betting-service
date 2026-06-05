import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { NBA_LEAGUE_KEY } from '../../../casino-groups/tenant-offering.config';

export class CreateMerchantDto {
  @ApiProperty({ example: 'luckystar' })
  @IsString()
  @Matches(/^[a-z][a-z0-9-]{1,48}$/)
  slug!: string;

  @ApiProperty({ example: 'LuckyStar Casino' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    example: 'luckystar-merchant',
    description:
      'Operator id in the player launch JWT. Defaults to {slug}-merchant when omitted.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  merchantId?: string;

  @ApiPropertyOptional({ example: 'EUR' })
  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @ApiPropertyOptional({
    description:
      'Plaintext launch secret shown once in the response; stored encrypted',
  })
  @IsOptional()
  @IsString()
  @MinLength(16)
  sportsSecret?: string;

  @ApiPropertyOptional({
    description: 'League keys to enable (defaults to NBA only)',
    example: [NBA_LEAGUE_KEY],
  })
  @IsOptional()
  @IsString({ each: true })
  enabledLeagueKeys?: string[];
}
