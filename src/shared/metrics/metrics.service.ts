import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';
import { EnvConfig } from '../config/env.validation';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  private readonly httpRequests: Counter<string>;
  private readonly httpDuration: Histogram<string>;
  private readonly betsPlaced: Counter<string>;
  private readonly betsSettled: Counter<string>;
  private readonly ingestionRuns: Counter<string>;
  private readonly ingestionDuration: Histogram<string>;
  private readonly wsConnections: Gauge<string>;

  constructor(private readonly config: ConfigService<EnvConfig, true>) {
    this.httpRequests = new Counter({
      name: 'sbs_http_requests_total',
      help: 'HTTP requests handled by the API',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpDuration = new Histogram({
      name: 'sbs_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.betsPlaced = new Counter({
      name: 'sbs_bets_placed_total',
      help: 'Bets created or returned from idempotent place',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.betsSettled = new Counter({
      name: 'sbs_bets_settled_total',
      help: 'Bets settled in a batch run',
      labelNames: ['result'],
      registers: [this.registry],
    });

    this.ingestionRuns = new Counter({
      name: 'sbs_ingestion_runs_total',
      help: 'Ingestion jobs completed',
      labelNames: ['kind', 'outcome'],
      registers: [this.registry],
    });

    this.ingestionDuration = new Histogram({
      name: 'sbs_ingestion_duration_seconds',
      help: 'Ingestion job duration in seconds',
      labelNames: ['kind'],
      buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300],
      registers: [this.registry],
    });

    this.wsConnections = new Gauge({
      name: 'sbs_ws_connections_active',
      help: 'Active WebSocket connections on /realtime',
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    if (!this.isEnabled()) {
      return;
    }
    collectDefaultMetrics({ register: this.registry, prefix: 'sbs_' });
  }

  isEnabled(): boolean {
    return this.config.get('METRICS_ENABLED', { infer: true });
  }

  observeHttpRequest(
    method: string,
    route: string,
    status: number,
    durationSeconds: number,
  ): void {
    if (!this.isEnabled()) {
      return;
    }
    const labels = { method, route, status: String(status) };
    this.httpRequests.inc(labels);
    this.httpDuration.observe({ method, route }, durationSeconds);
  }

  recordBetPlaced(status: string): void {
    if (!this.isEnabled()) {
      return;
    }
    this.betsPlaced.inc({ status });
  }

  recordBetSettled(result: string): void {
    if (!this.isEnabled()) {
      return;
    }
    this.betsSettled.inc({ result });
  }

  recordIngestion(
    kind: string,
    outcome: 'success' | 'error',
    durationSeconds: number,
  ): void {
    if (!this.isEnabled()) {
      return;
    }
    this.ingestionRuns.inc({ kind, outcome });
    this.ingestionDuration.observe({ kind }, durationSeconds);
  }

  wsConnected(): void {
    if (!this.isEnabled()) {
      return;
    }
    this.wsConnections.inc();
  }

  wsDisconnected(): void {
    if (!this.isEnabled()) {
      return;
    }
    this.wsConnections.dec();
  }

  async metricsText(): Promise<string> {
    return this.registry.metrics();
  }
}
