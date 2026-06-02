import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { RedisService } from '../../shared/cache/redis.service';
import { decimalToString } from '../../shared/decimal/decimal.util';
import { SelectionStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  REALTIME_REDIS_CHANNEL,
  WS_SERVER_EVENT_UPDATE,
  WS_SERVER_SELECTION_ODDS,
} from './realtime.constants';
import { eventRoom, marketRoom } from './realtime-rooms';
import {
  EventUpdatePayload,
  RealtimeBroadcastMessage,
  SelectionOddsPayload,
} from './realtime.types';
import { RealtimeAccessService } from './realtime-access.service';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimePubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimePubSubService.name);
  private subscriber?: Redis;

  constructor(
    private readonly redis: RedisService,
    private readonly access: RealtimeAccessService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly gateway: RealtimeGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    const client = this.redis.getClient();
    this.subscriber = client.duplicate();
    this.subscriber.on('error', (error: Error) => {
      this.logger.warn(`Realtime Redis subscriber error: ${error.message}`);
    });
    if (this.subscriber.status === 'wait' || this.subscriber.status === 'end') {
      await this.subscriber.connect();
    }
    await this.subscriber.subscribe(REALTIME_REDIS_CHANNEL);
    this.subscriber.on('message', (_channel, payload) => {
      try {
        const message = JSON.parse(payload) as RealtimeBroadcastMessage;
        this.gateway.emitToRoom(message.room, message.type, message.data);
      } catch (error) {
        this.logger.warn(
          `Ignored invalid realtime message: ${(error as Error).message}`,
        );
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit();
  }

  async publishEventUpdate(
    eventId: string,
    data: Omit<EventUpdatePayload, 'eventId'>,
  ): Promise<void> {
    const payload: EventUpdatePayload = { eventId, ...data };
    const groupIds = await this.access.groupIdsForEvent(eventId);
    await Promise.all(
      groupIds.map((casinoGroupId) =>
        this.publish({
          room: eventRoom(casinoGroupId, eventId),
          type: WS_SERVER_EVENT_UPDATE,
          data: payload,
        }),
      ),
    );
  }

  async publishSelectionOdds(
    marketId: string,
    selectionId: string,
    price: Prisma.Decimal,
    status: SelectionStatus,
  ): Promise<void> {
    const payload: SelectionOddsPayload = {
      marketId,
      selectionId,
      price: decimalToString(price),
      status,
    };
    const groupIds = await this.access.groupIdsForMarket(marketId);
    await Promise.all(
      groupIds.map((casinoGroupId) =>
        this.publish({
          room: marketRoom(casinoGroupId, marketId),
          type: WS_SERVER_SELECTION_ODDS,
          data: payload,
        }),
      ),
    );
  }

  private async publish(message: RealtimeBroadcastMessage): Promise<void> {
    await this.redis
      .getClient()
      .publish(REALTIME_REDIS_CHANNEL, JSON.stringify(message));
  }
}
