/** Redis channel for cross-instance Socket.IO fan-out. */
export const REALTIME_REDIS_CHANNEL = 'sports:realtime';

/** Socket.IO namespace (client path: `/realtime`). */
export const REALTIME_NAMESPACE = '/realtime';

/** Client → server */
export const WS_CLIENT_SUBSCRIBE = 'subscribe';
export const WS_CLIENT_UNSUBSCRIBE = 'unsubscribe';

/** Server → client */
export const WS_SERVER_CONNECTED = 'connected';
export const WS_SERVER_EVENT_UPDATE = 'event.update';
export const WS_SERVER_SELECTION_ODDS = 'selection.odds';
export const WS_SERVER_ERROR = 'error';
