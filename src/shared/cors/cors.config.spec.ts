import {
  httpCorsOptions,
  isDevelopmentEnv,
  parseCorsOrigins,
  socketIoCorsOptions,
} from './cors.config';

describe('cors.config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('enables CORS in development', () => {
    process.env.NODE_ENV = 'development';
    expect(isDevelopmentEnv()).toBe(true);
    const http = httpCorsOptions();
    expect(http?.origin).toContain('http://localhost:3000');
    expect(http?.allowedHeaders).toContain('Idempotency-Key');
    expect(socketIoCorsOptions()).toEqual({
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
    });
  });

  it('disables CORS in production', () => {
    process.env.NODE_ENV = 'production';
    expect(httpCorsOptions()).toBeUndefined();
    expect(socketIoCorsOptions()).toBe(false);
  });

  it('parses custom origins from env', () => {
    process.env.CORS_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173';
    expect(parseCorsOrigins()).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]);
  });
});
