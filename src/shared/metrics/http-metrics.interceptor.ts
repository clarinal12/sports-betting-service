import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.metrics.isEnabled()) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const started = process.hrtime.bigint();
    const route = this.normalizeRoute(request);

    return next.handle().pipe(
      tap({
        next: () => this.record(request, response, route, started),
        error: () => this.record(request, response, route, started),
      }),
    );
  }

  private record(
    request: Request,
    response: Response,
    route: string,
    started: bigint,
  ): void {
    const elapsedNs = process.hrtime.bigint() - started;
    const durationSeconds = Number(elapsedNs) / 1e9;
    const status = response.statusCode || 500;
    this.metrics.observeHttpRequest(request.method, route, status, durationSeconds);
  }

  private normalizeRoute(request: Request): string {
    const path =
      (request.route as { path?: string } | undefined)?.path ??
      request.path ??
      request.url.split('?')[0];
    return path || 'unknown';
  }
}
