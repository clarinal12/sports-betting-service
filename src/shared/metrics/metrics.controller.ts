import { Controller, Get, Header, NotFoundException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';

@ApiExcludeController()
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async prometheus(): Promise<string> {
    if (!this.metrics.isEnabled()) {
      throw new NotFoundException();
    }
    return this.metrics.metricsText();
  }
}
