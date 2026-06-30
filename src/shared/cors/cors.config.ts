const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5001',
  'http://127.0.0.1:5001',
  'http://localhost:5002',
  'http://127.0.0.1:5002',
];

export function isDevelopmentEnv(): boolean {
  return (process.env.NODE_ENV ?? 'development') === 'development';
}

export function parseCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS;
  if (!raw) {
    return DEFAULT_DEV_ORIGINS;
  }
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** True when browser CORS should be enabled (local dev or explicit HTTPS origins). */
export function isCorsEnabled(): boolean {
  return isDevelopmentEnv() || Boolean(process.env.CORS_ORIGINS?.trim());
}

const CORS_OPTIONS = {
  credentials: true as const,
  allowedHeaders: [
    'Authorization',
    'Content-Type',
    'X-Casino-Group',
    'Idempotency-Key',
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

/** HTTP CORS options for Nest `enableCors`. */
export function httpCorsOptions():
  | {
      origin: string[];
      credentials: true;
      allowedHeaders: string[];
      methods: string[];
    }
  | undefined {
  if (!isCorsEnabled()) {
    return undefined;
  }
  return {
    origin: parseCorsOrigins(),
    ...CORS_OPTIONS,
  };
}

/** Socket.IO CORS setting for the realtime gateway. */
export function socketIoCorsOptions():
  | { origin: string[]; credentials: true }
  | false {
  if (!isCorsEnabled()) {
    return false;
  }
  return {
    origin: parseCorsOrigins(),
    credentials: true,
  };
}
