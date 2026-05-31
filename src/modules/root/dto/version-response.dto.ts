import { ApiProperty } from '@nestjs/swagger';

export class VersionResponseDto {
  @ApiProperty({ example: 'sports-betting-service' })
  name: string;

  @ApiProperty({ example: '0.0.1' })
  version: string;

  @ApiProperty({ example: 'development' })
  environment: string;
}
