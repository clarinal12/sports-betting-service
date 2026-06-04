import { Injectable } from '@nestjs/common';
import { MarketType } from '@prisma/client';

export type LegResult = 'WON' | 'LOST' | 'VOID';

export interface LegSettlementInput {
  marketType: MarketType;
  marketStatus: string;
  marketLine: string | null;
  selectionName: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
}

@Injectable()
export class LegOutcomeService {
  evaluate(input: LegSettlementInput): LegResult | null {
    if (input.marketStatus === 'VOID') {
      return 'VOID';
    }
    if (input.homeScore === null || input.awayScore === null) {
      return null;
    }

    switch (input.marketType) {
      case MarketType.MATCH_RESULT:
        return this.matchResult(input);
      case MarketType.TOTAL:
        return this.total(input);
      case MarketType.HANDICAP:
        return this.handicap(input);
      case MarketType.BOTH_TEAMS_SCORE:
        return this.bothTeamsScore(input);
      default:
        return null;
    }
  }

  private matchResult(input: LegSettlementInput): LegResult {
    const { homeScore, awayScore, selectionName, homeTeamName, awayTeamName } =
      input;
    const name = selectionName.trim().toLowerCase();
    const homeWins = homeScore! > awayScore!;
    const awayWins = awayScore! > homeScore!;
    const draw = homeScore === awayScore;

    if (name === 'draw' || name === 'x') {
      return draw ? 'WON' : 'LOST';
    }
    if (name === homeTeamName.trim().toLowerCase()) {
      return homeWins ? 'WON' : 'LOST';
    }
    if (name === awayTeamName.trim().toLowerCase()) {
      return awayWins ? 'WON' : 'LOST';
    }
    return 'LOST';
  }

  private total(input: LegSettlementInput): LegResult | null {
    const line = Number(input.marketLine);
    if (!Number.isFinite(line)) {
      return null;
    }
    const totalScore = input.homeScore! + input.awayScore!;
    const name = input.selectionName.toLowerCase();
    if (totalScore === line) {
      return 'VOID';
    }
    if (name.includes('over')) {
      return totalScore > line ? 'WON' : 'LOST';
    }
    if (name.includes('under')) {
      return totalScore < line ? 'WON' : 'LOST';
    }
    return null;
  }

  private handicap(input: LegSettlementInput): LegResult | null {
    const line = Number(input.marketLine);
    if (!Number.isFinite(line)) {
      return null;
    }
    const name = input.selectionName.toLowerCase();
    const homeName = input.homeTeamName.toLowerCase();
    const awayName = input.awayTeamName.toLowerCase();

    if (name.includes(homeName)) {
      const adjustedHome = input.homeScore! + line;
      if (adjustedHome === input.awayScore!) {
        return 'VOID';
      }
      return adjustedHome > input.awayScore! ? 'WON' : 'LOST';
    }
    if (name.includes(awayName)) {
      const adjustedAway = input.awayScore! - line;
      if (input.homeScore! === adjustedAway) {
        return 'VOID';
      }
      return adjustedAway > input.homeScore! ? 'WON' : 'LOST';
    }
    return null;
  }

  private bothTeamsScore(input: LegSettlementInput): LegResult {
    const bothScored = input.homeScore! > 0 && input.awayScore! > 0;
    const yes = input.selectionName.toLowerCase().includes('yes');
    const no = input.selectionName.toLowerCase().includes('no');
    if (yes) {
      return bothScored ? 'WON' : 'LOST';
    }
    if (no) {
      return bothScored ? 'LOST' : 'WON';
    }
    return 'LOST';
  }
}
