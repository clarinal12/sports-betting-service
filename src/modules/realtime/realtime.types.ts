import {
  WS_SERVER_EVENT_UPDATE,
  WS_SERVER_SELECTION_ODDS,
} from './realtime.constants';

export interface EventUpdatePayload {
  eventId: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  period: string | null;
  clock: string | null;
}

export interface SelectionOddsPayload {
  marketId: string;
  selectionId: string;
  price: string;
  status: string;
}

export interface RealtimeBroadcastMessage {
  room: string;
  type: typeof WS_SERVER_EVENT_UPDATE | typeof WS_SERVER_SELECTION_ODDS;
  data: EventUpdatePayload | SelectionOddsPayload;
}
