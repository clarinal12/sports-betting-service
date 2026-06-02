import { z } from 'zod';

const DEV_SESSION_SECRET = 'dev-session-secret-change-me-please';
const DEV_ENCRYPTION_KEY = 'dev-encryption-key-change-me-please';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
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
  /// Base URL of the external user/wallet service (used from Phase 4).
  USER_SERVICE_BASE_URL: z.string().url().optional(),

  // --- Real-time (Phase 3b) ---
  /// Max subscribe/unsubscribe operations per casino group per minute (FR-C3).
  REALTIME_SUBSCRIBE_MAX_PER_MINUTE: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(60),
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
  if (env.NODE_ENV === 'production') {
    const problems: string[] = [];
    if (env.SESSION_JWT_SECRET === DEV_SESSION_SECRET) {
      problems.push('SESSION_JWT_SECRET must be set (not the dev default)');
    }
    if (env.SECRET_ENCRYPTION_KEY === DEV_ENCRYPTION_KEY) {
      problems.push('SECRET_ENCRYPTION_KEY must be set (not the dev default)');
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
