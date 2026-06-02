import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Server, ServerOptions } from 'socket.io';

/**
 * Socket.IO adapter backed by Redis pub/sub so room membership and emits work
 * across multiple app instances (FR-R3).
 */
export class RedisIoAdapter extends IoAdapter {
  constructor(
    app: INestApplication,
    private readonly pubClient: Redis,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    const subClient = this.pubClient.duplicate();
    server.adapter(createAdapter(this.pubClient, subClient));
    return server;
  }
}
