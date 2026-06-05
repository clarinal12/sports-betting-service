import { BetLeg, MarketType, Prisma } from '@prisma/client';
import { LegSettlementInput } from '../settlement/leg-outcome.service';

export interface LegPlacementSnapshot {
  marketType: MarketType;
  marketLine: string | null;
  homeTeamName: string;
  awayTeamName: string;
  eventProviderRef: string;
}

export function hasLegSnapshot(
  leg: Pick<BetLeg, 'marketType' | 'homeTeamName' | 'awayTeamName'>,
): boolean {
  return (
    leg.marketType !== null &&
    leg.homeTeamName !== null &&
    leg.awayTeamName !== null
  );
}

/** Prisma create input for snapshot columns on BetLeg. */
export function legSnapshotCreateData(
  snapshot: LegPlacementSnapshot,
): Pick<
  Prisma.BetLegCreateWithoutBetInput,
  | 'marketType'
  | 'marketLine'
  | 'homeTeamName'
  | 'awayTeamName'
  | 'eventProviderRef'
> {
  return {
    marketType: snapshot.marketType,
    marketLine: snapshot.marketLine
      ? new Prisma.Decimal(snapshot.marketLine)
      : null,
    homeTeamName: snapshot.homeTeamName,
    awayTeamName: snapshot.awayTeamName,
    eventProviderRef: snapshot.eventProviderRef,
  };
}

/**
 * Builds settlement grading input from frozen leg data + live result state on Event/Market.
 */
export function buildLegSettlementInput(
  leg: Pick<
    BetLeg,
    | 'selectionName'
    | 'marketType'
    | 'marketLine'
    | 'homeTeamName'
    | 'awayTeamName'
  >,
  snapshot: LegPlacementSnapshot,
  live: {
    marketStatus: string;
    eventStatus: string;
    homeScore: number | null;
    awayScore: number | null;
  },
): LegSettlementInput {
  return {
    marketType: snapshot.marketType,
    marketStatus: live.marketStatus,
    marketLine: snapshot.marketLine,
    selectionName: leg.selectionName,
    homeTeamName: snapshot.homeTeamName,
    awayTeamName: snapshot.awayTeamName,
    homeScore: live.homeScore,
    awayScore: live.awayScore,
  };
}
