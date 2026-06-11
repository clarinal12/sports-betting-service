import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateIf,
} from 'class-validator';
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

  @ApiPropertyOptional({
    example: 'https://wallet.client.example.com/api',
    description:
      'Client wallet API base URL (calls /balance, /transaction, /batch-transactions)',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @IsUrl({ require_tld: false })
  walletApiUrl?: string | null;
}
