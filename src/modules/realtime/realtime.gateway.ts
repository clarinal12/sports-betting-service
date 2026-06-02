import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EnvConfig } from '../../shared/config/env.validation';
import { CasinoGroupsService } from '../casino-groups/casino-groups.service';
import { SessionService } from '../auth/session.service';
import { UserContext } from '../auth/user-context.types';
import { SubscribeDto } from './dto/subscribe.dto';
import { GroupRateLimiter } from './group-rate-limiter';
import {
  REALTIME_NAMESPACE,
  WS_CLIENT_SUBSCRIBE,
  WS_CLIENT_UNSUBSCRIBE,
  WS_SERVER_CONNECTED,
  WS_SERVER_ERROR,
} from './realtime.constants';
import { eventRoom, marketRoom } from './realtime-rooms';
import { RealtimeAccessService } from './realtime-access.service';

interface SocketData {
  user: UserContext;
}

@WebSocketGateway({
  namespace: REALTIME_NAMESPACE,
  cors: { origin: true },
})
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly subscribeLimiter: GroupRateLimiter;

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly sessions: SessionService,
    private readonly casinoGroups: CasinoGroupsService,
    private readonly access: RealtimeAccessService,
    config: ConfigService<EnvConfig, true>,
  ) {
    const max = config.get('REALTIME_SUBSCRIBE_MAX_PER_MINUTE', {
      infer: true,
    });
    this.subscribeLimiter = new GroupRateLimiter(max, 60_000);
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      this.reject(client, 'Authentication required');
      return;
    }

    try {
      const user = this.sessions.verify(token);
      const group = await this.casinoGroups.resolveActiveById(
        user.casinoGroupId,
      );
      if (!group) {
        this.reject(client, 'Unknown or inactive casino group');
        return;
      }
      (client.data as SocketData).user = user;
      client.emit(WS_SERVER_CONNECTED, {
        casinoGroupId: user.casinoGroupId,
        userId: user.userId,
      });
    } catch {
      this.reject(client, 'Invalid or expired session');
    }
  }

  handleDisconnect(): void {
    // Rooms are cleared automatically on disconnect.
  }

  @SubscribeMessage(WS_CLIENT_SUBSCRIBE)
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SubscribeDto,
  ): Promise<void> {
    const user = (client.data as SocketData).user;
    if (!user) {
      client.emit(WS_SERVER_ERROR, { message: 'Not authenticated' });
      return;
    }

    if (!this.subscribeLimiter.tryConsume(user.casinoGroupId)) {
      client.emit(WS_SERVER_ERROR, {
        message: 'Subscribe rate limit exceeded for this casino group',
      });
      return;
    }

    const eventIds = await this.access.filterVisibleEventIds(
      user.casinoGroupId,
      body.eventIds,
    );
    const marketIds = body.marketIds?.length
      ? await this.access.filterVisibleMarketIds(
          user.casinoGroupId,
          body.marketIds,
        )
      : [];

    if (
      eventIds.length !== body.eventIds.length ||
      (body.marketIds?.length ?? 0) !== marketIds.length
    ) {
      client.emit(WS_SERVER_ERROR, {
        message:
          'One or more event/market ids are not available for this group',
      });
      return;
    }

    for (const eventId of eventIds) {
      await client.join(eventRoom(user.casinoGroupId, eventId));
    }
    for (const marketId of marketIds) {
      await client.join(marketRoom(user.casinoGroupId, marketId));
    }

    client.emit(WS_SERVER_CONNECTED, {
      subscribed: { eventIds, marketIds },
    });
  }

  @SubscribeMessage(WS_CLIENT_UNSUBSCRIBE)
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SubscribeDto,
  ): Promise<void> {
    const user = (client.data as SocketData).user;
    if (!user) {
      return;
    }

    for (const eventId of body.eventIds ?? []) {
      await client.leave(eventRoom(user.casinoGroupId, eventId));
    }
    for (const marketId of body.marketIds ?? []) {
      await client.leave(marketRoom(user.casinoGroupId, marketId));
    }
  }

  emitToRoom(room: string, event: string, data: unknown): void {
    if (!this.server) {
      return;
    }
    this.server.to(room).emit(event, data);
  }

  private extractToken(client: Socket): string | undefined {
    const auth = client.handshake.auth as { token?: string };
    if (typeof auth?.token === 'string' && auth.token.length > 0) {
      return auth.token;
    }
    const query = client.handshake.query.token;
    if (typeof query === 'string' && query.length > 0) {
      return query;
    }
    return undefined;
  }

  private reject(client: Socket, message: string): void {
    client.emit(WS_SERVER_ERROR, { message });
    client.disconnect(true);
  }
}
