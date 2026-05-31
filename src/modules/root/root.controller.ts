import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { EnvConfig } from '../../shared/config/env.validation';
import { VersionResponseDto } from './dto/version-response.dto';

@ApiTags('root')
@Controller()
export class RootController {
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  @Get()
  @ApiOperation({ summary: 'Service metadata' })
  @ApiOkResponse({ type: VersionResponseDto })
  getVersion(): VersionResponseDto {
    return {
      name: 'sports-betting-service',
      version: '0.0.1',
      environment: this.configService.get('NODE_ENV', { infer: true }),
    };
  }
}
