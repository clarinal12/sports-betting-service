import { z } from 'zod';

const DEV_SESSION_SECRET = 'dev-session-secret-change-me-please';
const DEV_ENCRYPTION_KEY = 'dev-encryption-key-change-me-please';
const DEV_STAFF_JWT_SECRET = 'dev-staff-jwt-secret-change-me-please';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5003),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine(
      (value) =>
        value.startsWith('postgresql://') || value.startsWith('postgres://'),
      { message: 'DATABASE_URL must be a PostgreSQL connection string' },
    ),
  REDIS_URL: z
    .string()
    .min(1)
    .refine((value) => value.startsWith('redis://'), {
      message: 'REDIS_URL must be a Redis connection string',
    }),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  // --- Observability (Phase 5) ---
  METRICS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  // --- Back office staff auth (Phase 6) ---
  STAFF_JWT_SECRET: z.string().min(16).default(DEV_STAFF_JWT_SECRET),
  STAFF_ACCESS_TTL: z.string().min(1).default('15m'),
  STAFF_REFRESH_TTL: z.string().min(1).default('7d'),

  // --- Auth (Phase 3a) ---
  /// Secret used to sign/verify OUR short-lived player session tokens.
  SESSION_JWT_SECRET: z.string().min(16).default(DEV_SESSION_SECRET),
  /// Session token lifetime (jsonwebtoken `expiresIn` syntax, e.g. "30m").
  SESSION_TTL: z.string().min(1).default('30m'),
  /// Key used to encrypt per-merchant sportsSecret values at rest.
  SECRET_ENCRYPTION_KEY: z.string().min(16).default(DEV_ENCRYPTION_KEY),
  /// Allow the dev-only X-Casino-Group header to resolve a tenant without a token.
  AUTH_ALLOW_HEADER_FALLBACK: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  /// Clock-skew tolerance (seconds) when verifying operator launch tokens.
  OPERATOR_JWT_CLOCK_SKEW: z.coerce.number().int().min(0).max(300).default(5),
  /// Base URL of the external user/wallet service (required when WALLET_PROVIDER=http).
  USER_SERVICE_BASE_URL: z.string().url().optional(),
  /// `stub` = in-memory balance (dev/e2e); `http` = call USER_SERVICE_BASE_URL.
  WALLET_PROVIDER: z.enum(['stub', 'http']).default('stub'),
  /// Starting balance per user for stub wallet (decimal string).
  WALLET_STUB_BALANCE: z.string().default('10000.00'),
  /// Stake bounds for bet placement (decimal strings).
  BET_MIN_STAKE: z.string().default('1.00'),
  BET_MAX_STAKE: z.string().default('10000.00'),
  BET_MAX_PAYOUT: z.string().default('100000.00'),
  /// How often to retry pending wallet outbox entries (seconds).
  WALLET_OUTBOX_POLL_SECONDS: z.coerce.number().int().min(5).max(300).default(30),
  /// When true, polls for ACCEPTED bets on ENDED events and settles them.
  SETTLEMENT_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SETTLEMENT_POLL_SECONDS: z.coerce.number().int().min(15).max(3600).default(60),
  /// Hours after kickoff before flagging ACCEPTED bets awaiting provider results.
  SETTLEMENT_STALE_HOURS: z.coerce.number().int().min(1).max(168).default(6),
  /// When true, polls The Odds API /scores for open bets, then runs settlement.
  RESULTS_INGEST_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  RESULTS_INGEST_POLL_SECONDS: z.coerce
    .number()
    .int()
    .min(30)
    .max(3600)
    .default(120),
  /// Passed to The Odds API GET /scores daysFrom (1–3 per provider docs).
  ODDS_API_SCORES_DAYS_FROM: z.coerce.number().int().min(1).max(3).default(3),

  // --- Real-time (Phase 3b) ---
  /// Max subscribe/unsubscribe operations per casino group per minute (FR-C3).
  REALTIME_SUBSCRIBE_MAX_PER_MINUTE: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(60),

  // --- HTTP CORS (development only — browser clients e.g. sportsbook-player-shell) ---
  /// Comma-separated allowed origins when NODE_ENV=development.
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5001,http://127.0.0.1:5001,http://localhost:5002,http://127.0.0.1:5002')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  // --- Fixture provider (Phase 3c — The Odds API) ---
  /// `mock` for tests/local without API credits; `odds-api` for live data.
  FIXTURE_PROVIDER: z.enum(['mock', 'odds-api']).default('mock'),
  ODDS_API_KEY: z.string().optional(),
  ODDS_API_BASE_URL: z
    .string()
    .url()
    .default('https://api.the-odds-api.com/v4'),
  /// Comma-separated sport keys, group alias (e.g. `basketball`), or `all`.
  ODDS_API_SPORT_KEYS: z
    .string()
    .default('basketball,baseball,americanfootball,soccer')
    .transform((value) =>
      value
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean),
    ),
  /// Bookmaker regions for the odds endpoint: `all` or comma-separated (us, us2, uk, eu, au).
  ODDS_API_REGIONS: z.string().default('all'),
  ODDS_API_MARKETS: z
    .string()
    .default('h2h,spreads,totals')
    .transform((value) =>
      value
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean),
    ),
  ODDS_API_ODDS_FORMAT: z.enum(['decimal', 'american']).default('decimal'),

  /// Minutes before kickoff to include scheduled fixtures on live ingest ticks.
  INGEST_LIVE_PRESTART_MINUTES: z.coerce.number().int().min(0).max(120).default(15),
  /// When true, the API process polls live fixtures on a fixed interval.
  INGEST_LIVE_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /// Seconds between in-process live ingest ticks (CLI `ingest:live` is unaffected).
  INGEST_LIVE_INTERVAL_SECONDS: z.coerce
    .number()
    .int()
    .min(15)
    .max(3600)
    .default(60),
  /// When true, runs full catalog ingest (`ingest:fixtures`) on a cron schedule.
  INGEST_CATALOG_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /// Standard 5-field cron for catalog ingest (default: every 6 hours at :00).
  INGEST_CATALOG_CRON: z.string().min(9).max(100).default('0 */6 * * *'),
  /// Pause Odds API ingest when `x-requests-remaining` drops below this.
  INGEST_ODDS_API_REMAINING_MIN: z.coerce.number().int().min(0).max(10_000).default(20),
  /// Minutes to pause ingest after HTTP 401 from The Odds API.
  INGEST_ODDS_API_PAUSE_MINUTES: z.coerce.number().int().min(1).max(1440).default(30),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${details}`);
  }

  const env = result.data;

  if (env.WALLET_PROVIDER === 'http' && env.NODE_ENV !== 'test') {
    if (!env.USER_SERVICE_BASE_URL?.trim()) {
      throw new Error(
        'Environment validation failed:\n  - USER_SERVICE_BASE_URL is required when WALLET_PROVIDER=http',
      );
    }
  }

  if (env.FIXTURE_PROVIDER === 'odds-api' && env.NODE_ENV !== 'test') {
    if (!env.ODDS_API_KEY?.trim()) {
      throw new Error(
        'Environment validation failed:\n  - ODDS_API_KEY is required when FIXTURE_PROVIDER=odds-api',
      );
    }
  }

  if (
    env.RESULTS_INGEST_ENABLED &&
    env.SETTLEMENT_ENABLED &&
    env.NODE_ENV !== 'test'
  ) {
    console.warn(
      '[env] SETTLEMENT_ENABLED is redundant when RESULTS_INGEST_ENABLED=true; settlement-only worker will not start.',
    );
  }

  if (env.NODE_ENV === 'production') {
    const problems: string[] = [];
    if (env.SESSION_JWT_SECRET === DEV_SESSION_SECRET) {
      problems.push('SESSION_JWT_SECRET must be set (not the dev default)');
    }
    if (env.SECRET_ENCRYPTION_KEY === DEV_ENCRYPTION_KEY) {
      problems.push('SECRET_ENCRYPTION_KEY must be set (not the dev default)');
    }
    if (env.STAFF_JWT_SECRET === DEV_STAFF_JWT_SECRET) {
      problems.push('STAFF_JWT_SECRET must be set (not the dev default)');
    }
    if (env.AUTH_ALLOW_HEADER_FALLBACK) {
      problems.push('AUTH_ALLOW_HEADER_FALLBACK must be false in production');
    }
    if (problems.length > 0) {
      throw new Error(
        `Production environment validation failed:\n${problems
          .map((p) => `  - ${p}`)
          .join('\n')}`,
      );
    }
  }

  return env;
}
