process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.PORT = process.env.PORT ?? '3000';
/**
 * Use a separate DB for e2e when set, so mock ingest never wipes dev odds-api data.
 * Example: TEST_DATABASE_URL=postgresql://sports:sports@localhost:5432/sports_betting_test
 */
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://sports:sports@localhost:5432/sports_betting';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
/** Always mock for e2e — never inherit odds-api from `.env`. */
process.env.FIXTURE_PROVIDER = 'mock';
process.env.INGEST_LIVE_ENABLED = 'false';
process.env.INGEST_CATALOG_ENABLED = 'false';
process.env.RESULTS_INGEST_ENABLED = 'false';
process.env.SETTLEMENT_ENABLED = 'false';
process.env.WALLET_PROVIDER = 'stub';
process.env.METRICS_ENABLED = 'false';
