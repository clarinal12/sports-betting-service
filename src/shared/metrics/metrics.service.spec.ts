import { MetricsService } from './metrics.service';

function makeService(enabled = true): MetricsService {
  return new MetricsService({
    get: (key: string) => (key === 'METRICS_ENABLED' ? enabled : undefined),
  } as never);
}

describe('MetricsService', () => {
  it('records bet and ingestion counters when enabled', async () => {
    const metrics = makeService(true);
    metrics.onModuleInit();
    metrics.recordBetPlaced('ACCEPTED');
    metrics.recordIngestion('catalog', 'success', 1.2);
    const text = await metrics.metricsText();
    expect(text).toContain('sbs_bets_placed_total');
    expect(text).toContain('sbs_ingestion_runs_total');
  });

  it('does not increment when disabled', async () => {
    const metrics = makeService(false);
    metrics.recordBetPlaced('ACCEPTED');
    const text = await metrics.metricsText();
    expect(text).not.toMatch(/sbs_bets_placed_total\{status="ACCEPTED"\} [1-9]/);
  });
});
