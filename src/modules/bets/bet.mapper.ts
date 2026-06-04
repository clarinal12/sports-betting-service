import { Bet, BetLeg, Prisma } from '@prisma/client';
import { decimalToString } from '../../shared/decimal/decimal.util';
import { BetLegResponseDto } from './dto/bet-leg-response.dto';
import { BetResponseDto } from './dto/bet-response.dto';

type BetWithLegs = Bet & { legs: BetLeg[] };

export function toBetDto(bet: BetWithLegs): BetResponseDto {
  return {
    id: bet.id,
    status: bet.status,
    stake: decimalToString(bet.stake),
    currency: bet.currency,
    combinedOdds: decimalToString(bet.combinedOdds),
    potentialPayout: decimalToString(bet.potentialPayout),
    payoutAmount:
      bet.payoutAmount !== null ? decimalToString(bet.payoutAmount) : null,
    settledAt: bet.settledAt?.toISOString() ?? null,
    rejectionReason: bet.rejectionReason,
    settlementNote: bet.settlementNote,
    createdAt: bet.createdAt.toISOString(),
    legs: bet.legs
      .sort((a, b) => a.legOrder - b.legOrder)
      .map(toBetLegDto),
  };
}

function toBetLegDto(leg: BetLeg): BetLegResponseDto {
  return {
    selectionId: leg.selectionId,
    marketId: leg.marketId,
    eventId: leg.eventId,
    selectionName: leg.selectionName,
    priceAtPlacement: decimalToString(leg.priceAtPlacement),
    outcome: leg.outcome,
  };
}
