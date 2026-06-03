const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
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

/** HTTP CORS options for Nest `enableCors`. Disabled outside development. */
export function httpCorsOptions():
  | {
      origin: string[];
      credentials: true;
      allowedHeaders: string[];
      methods: string[];
    }
  | undefined {
  if (!isDevelopmentEnv()) {
    return undefined;
  }
  return {
    origin: parseCorsOrigins(),
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Casino-Group'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  };
}

/** Socket.IO CORS setting for the realtime gateway. Disabled outside development. */
export function socketIoCorsOptions():
  | { origin: string[]; credentials: true }
  | false {
  if (!isDevelopmentEnv()) {
    return false;
  }
  return {
    origin: parseCorsOrigins(),
    credentials: true,
  };
}
