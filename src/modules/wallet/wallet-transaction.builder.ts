import { Bet, BetLeg, Prisma } from '@prisma/client';
import { decimalToString } from '../../shared/decimal/decimal.util';
import { eventWalletHistoryId } from './wallet-event-history';
import {
  WALLET_GAME_TYPE,
  WALLET_UNKNOWN_GAME_CODE,
  WALLET_VENDOR_CODE,
} from './wallet.constants';
import type { WalletTransactionRequest } from './wallet.port';

export type WalletSettlementOutcome = 'WON' | 'LOST' | 'VOID';

export type { WalletTransactionRequest };

export type BetLegWalletSnapshot = Pick<
  BetLeg,
  | 'legOrder'
  | 'eventId'
  | 'selectionName'
  | 'marketType'
  | 'marketLine'
  | 'homeTeamName'
  | 'awayTeamName'
  | 'sportKey'
  | 'sportName'
  | 'leagueKey'
  | 'leagueName'
  | 'priceAtPlacement'
>;

function primaryLeg(legs: BetLegWalletSnapshot[]): BetLegWalletSnapshot {
  return [...legs].sort((a, b) => a.legOrder - b.legOrder)[0]!;
}

export function gameCodeFromLegs(legs: BetLegWalletSnapshot[]): string {
  const leg = primaryLeg(legs);
  return leg.leagueKey?.trim() || WALLET_UNKNOWN_GAME_CODE;
}

export function historyIdFromLegs(legs: BetLegWalletSnapshot[]): number {
  return eventWalletHistoryId(primaryLeg(legs).eventId);
}

function formatMarketType(marketType: string | null): string {
  if (!marketType) {
    return 'market';
  }
  return marketType.replaceAll('_', ' ');
}

function formatOdds(price: Prisma.Decimal | string): string {
  const value =
    typeof price === 'string' ? price : decimalToString(price as Prisma.Decimal);
  return value;
}

function legLine(leg: BetLegWalletSnapshot): string {
  const sport = leg.sportName ?? leg.sportKey ?? 'Sport';
  const league = leg.leagueName ?? leg.leagueKey ?? 'League';
  const matchup = `${leg.homeTeamName ?? '?'} vs ${leg.awayTeamName ?? '?'}`;
  const market = formatMarketType(leg.marketType);
  const line =
    leg.marketLine !== null && leg.marketLine !== undefined
      ? ` ${decimalToString(leg.marketLine)}`
      : '';
  return `${sport} · ${league} · ${matchup} · ${market}${line} · ${leg.selectionName} @ ${formatOdds(leg.priceAtPlacement)}`;
}

export function buildPlacementDetail(
  bet: Pick<Bet, 'stake' | 'currency'>,
  legs: BetLegWalletSnapshot[],
): string {
  const stake = decimalToString(bet.stake);
  if (legs.length === 1) {
    return `${legLine(primaryLeg(legs))} · stake ${stake} ${bet.currency}`;
  }
  const legSummaries = [...legs]
    .sort((a, b) => a.legOrder - b.legOrder)
    .map((leg, index) => `(${index + 1}) ${legLine(leg)}`)
    .join(' · ');
  return `${legSummaries} · stake ${stake} ${bet.currency}`;
}

export function buildSettlementDetail(
  bet: Pick<Bet, 'id' | 'currency'>,
  legs: BetLegWalletSnapshot[],
  outcome: WalletSettlementOutcome,
  payoutAmount: Prisma.Decimal,
): string {
  const primary = primaryLeg(legs);
  const sport = primary.sportName ?? primary.sportKey ?? 'Sport';
  const league = primary.leagueName ?? primary.leagueKey ?? 'League';
  const matchup = `${primary.homeTeamName ?? '?'} vs ${primary.awayTeamName ?? '?'}`;
  const payout = decimalToString(payoutAmount);

  if (outcome === 'WON') {
    return `${sport} · ${league} · ${matchup} · Bet WON · payout ${payout} ${bet.currency} · slip ${bet.id}`;
  }
  if (outcome === 'VOID') {
    return `${sport} · ${league} · ${matchup} · Bet VOID · stake refund ${payout} ${bet.currency} · slip ${bet.id}`;
  }
  return `${sport} · ${league} · ${matchup} · Bet LOST · slip ${bet.id}`;
}

export function buildBetDebitTransaction(input: {
  bet: Pick<Bet, 'id' | 'username' | 'casinoGroupId' | 'stake' | 'currency' | 'createdAt'>;
  legs: BetLegWalletSnapshot[];
  transactionCode: string;
}): WalletTransactionRequest {
  const stake = decimalToString(input.bet.stake);
  return {
    userCode: input.bet.username,
    casinoGroupId: input.bet.casinoGroupId,
    roundId: input.bet.id,
    transactionCode: input.transactionCode,
    historyId: historyIdFromLegs(input.legs),
    gameCode: gameCodeFromLegs(input.legs),
    gameType: WALLET_GAME_TYPE,
    isFinished: false,
    isCanceled: false,
    amount: `-${stake}`,
    detail: buildPlacementDetail(input.bet, input.legs),
    createdAt: input.bet.createdAt,
  };
}

export function buildSettlementTransaction(input: {
  bet: Pick<
    Bet,
    'id' | 'username' | 'casinoGroupId' | 'stake' | 'currency' | 'createdAt'
  >;
  legs: BetLegWalletSnapshot[];
  outcome: WalletSettlementOutcome;
  payoutAmount: Prisma.Decimal;
  transactionCode: string;
  createdAt?: Date;
}): WalletTransactionRequest {
  const isVoid = input.outcome === 'VOID';
  const isFinished =
    input.outcome === 'WON' ||
    input.outcome === 'LOST' ||
    isVoid;

  let amount: string;
  if (input.outcome === 'LOST') {
    amount = '0';
  } else {
    amount = decimalToString(input.payoutAmount);
  }

  return {
    userCode: input.bet.username,
    casinoGroupId: input.bet.casinoGroupId,
    roundId: input.bet.id,
    transactionCode: input.transactionCode,
    historyId: historyIdFromLegs(input.legs),
    gameCode: gameCodeFromLegs(input.legs),
    gameType: WALLET_GAME_TYPE,
    isFinished,
    isCanceled: isVoid,
    amount,
    detail: buildSettlementDetail(
      input.bet,
      input.legs,
      input.outcome,
      input.payoutAmount,
    ),
    createdAt: input.createdAt ?? new Date(),
  };
}

export function toMerchantTransactionBody(
  request: WalletTransactionRequest,
): Record<string, unknown> {
  return {
    userCode: request.userCode,
    vendorCode: WALLET_VENDOR_CODE,
    gameCode: request.gameCode,
    historyId: request.historyId,
    roundId: request.roundId,
    gameType: request.gameType,
    transactionCode: request.transactionCode,
    isFinished: request.isFinished,
    isCanceled: request.isCanceled,
    amount: Number.parseFloat(request.amount),
    detail: request.detail,
    createdAt: request.createdAt.toISOString(),
  };
}
