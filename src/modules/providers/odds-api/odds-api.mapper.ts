import {
  NormalizedEvent,
  NormalizedFixture,
  NormalizedLeague,
  NormalizedMarket,
  NormalizedSelection,
  NormalizedSport,
  NormalizedTeam,
  ProviderSnapshot,
} from '../provider.types';
import {
  ODDS_API_MARKET_TYPE_MAP,
  type OddsApiMarketKey,
  resolveSportConfig,
  slugify,
} from './odds-api.config';
import type {
  OddsApiBookmaker,
  OddsApiEventOdds,
  OddsApiEventScore,
  OddsApiMarket,
  OddsApiOutcome,
  OddsApiSport,
} from './odds-api.types';

function teamKey(sportKey: string, teamName: string): string {
  return `${sportKey}_${slugify(teamName)}`;
}

function pickBookmaker(
  bookmakers: OddsApiBookmaker[],
  preferredKey: string,
): OddsApiBookmaker | undefined {
  if (bookmakers.length === 0) {
    return undefined;
  }
  if (preferredKey) {
    const preferred = bookmakers.find((b) => b.key === preferredKey);
    if (preferred) {
      return preferred;
    }
  }
  return bookmakers[0];
}

function parseScore(
  scores: OddsApiEventScore['scores'],
  homeTeam: string,
  awayTeam: string,
): { homeScore?: number; awayScore?: number } {
  if (!scores?.length) {
    return {};
  }
  const homeEntry = scores.find((s) => s.name === homeTeam);
  const awayEntry = scores.find((s) => s.name === awayTeam);
  const homeScore = homeEntry ? Number.parseInt(homeEntry.score, 10) : NaN;
  const awayScore = awayEntry ? Number.parseInt(awayEntry.score, 10) : NaN;
  return {
    homeScore: Number.isFinite(homeScore) ? homeScore : undefined,
    awayScore: Number.isFinite(awayScore) ? awayScore : undefined,
  };
}

function hasStarted(commenceTime: string): boolean {
  const startsAt = Date.parse(commenceTime);
  return Number.isFinite(startsAt) && startsAt <= Date.now();
}

function fixtureStatus(
  commenceTime: string,
  score?: OddsApiEventScore,
): NormalizedFixture['status'] {
  if (score?.completed) {
    return 'ENDED';
  }
  if (!hasStarted(commenceTime)) {
    return 'SCHEDULED';
  }
  // Kickoff passed and not completed — LIVE even when /scores has no numeric scores.
  return 'LIVE';
}

function eventStatus(
  commenceTime: string,
  score?: OddsApiEventScore,
): NormalizedEvent['status'] {
  const fixture = fixtureStatus(commenceTime, score);
  if (fixture === 'ENDED') {
    return 'ENDED';
  }
  if (fixture === 'LIVE') {
    return 'LIVE';
  }
  return 'SCHEDULED';
}

function selectionLabel(outcome: OddsApiOutcome): string {
  if (outcome.point !== undefined && outcome.point !== null) {
    const hasPoint = outcome.name.match(/over|under/i);
    if (hasPoint) {
      return `${outcome.name} ${outcome.point}`;
    }
    return `${outcome.name} ${outcome.point > 0 ? '+' : ''}${outcome.point}`;
  }
  return outcome.name;
}

function marketLine(market: OddsApiMarket): string | undefined {
  const point = market.outcomes.find(
    (o) => o.point !== undefined && o.point !== null,
  )?.point;
  return point !== undefined && point !== null ? String(point) : undefined;
}

function selectionProviderRef(
  eventId: string,
  bookmakerKey: string,
  marketKey: string,
  outcome: OddsApiOutcome,
): string {
  const pointPart =
    outcome.point !== undefined && outcome.point !== null
      ? String(outcome.point)
      : 'np';
  return `${eventId}:${bookmakerKey}:${marketKey}:${slugify(outcome.name)}:${pointPart}`;
}

export interface MapOddsApiInput {
  sportKeys: string[];
  apiSports: OddsApiSport[];
  oddsBySport: Map<string, OddsApiEventOdds[]>;
  scoresBySport: Map<string, OddsApiEventScore[]>;
  marketKeys: OddsApiMarketKey[];
}

export function mapOddsApiToSnapshot(input: MapOddsApiInput): ProviderSnapshot {
  const sports = new Map<string, NormalizedSport>();
  const leagues = new Map<string, NormalizedLeague>();
  const teams = new Map<string, NormalizedTeam>();
  const fixtures = new Map<string, NormalizedFixture>();
  const events = new Map<string, NormalizedEvent>();
  const markets = new Map<string, NormalizedMarket>();
  const selections = new Map<string, NormalizedSelection>();

  const apiSportByKey = new Map(
    input.apiSports.map((sport) => [sport.key, sport] as const),
  );

  const scoresByEventId = new Map<string, OddsApiEventScore>();
  for (const sportKey of input.sportKeys) {
    for (const score of input.scoresBySport.get(sportKey) ?? []) {
      scoresByEventId.set(score.id, score);
    }
  }

  for (const sportKey of input.sportKeys) {
    const apiSport = apiSportByKey.get(sportKey);
    const config = resolveSportConfig(sportKey, apiSport);

    if (!sports.has(config.groupSportKey)) {
      sports.set(config.groupSportKey, {
        key: config.groupSportKey,
        name: apiSport?.group ?? config.groupSportKey,
        slug: config.groupSportKey,
      });
    }

    leagues.set(sportKey, {
      key: sportKey,
      sportKey: config.groupSportKey,
      name: config.leagueName,
      region: config.regionName || undefined,
    });

    for (const event of input.oddsBySport.get(sportKey) ?? []) {
      const score = scoresByEventId.get(event.id);
      const homeKey = teamKey(sportKey, event.home_team);
      const awayKey = teamKey(sportKey, event.away_team);

      teams.set(homeKey, {
        key: homeKey,
        sportKey: config.groupSportKey,
        name: event.home_team,
      });
      teams.set(awayKey, {
        key: awayKey,
        sportKey: config.groupSportKey,
        name: event.away_team,
      });

      const status = fixtureStatus(event.commence_time, score);
      fixtures.set(event.id, {
        providerRef: event.id,
        leagueKey: sportKey,
        homeTeamKey: homeKey,
        awayTeamKey: awayKey,
        startsAt: event.commence_time,
        status,
      });

      const { homeScore, awayScore } = parseScore(
        score?.scores ?? null,
        event.home_team,
        event.away_team,
      );

      events.set(event.id, {
        providerRef: event.id,
        fixtureProviderRef: event.id,
        status: eventStatus(event.commence_time, score),
        homeScore,
        awayScore,
      });

      const bookmaker = pickBookmaker(event.bookmakers, config.bookmaker);
      if (!bookmaker) {
        continue;
      }

      for (const market of bookmaker.markets) {
        if (!input.marketKeys.includes(market.key as OddsApiMarketKey)) {
          continue;
        }
        const type =
          ODDS_API_MARKET_TYPE_MAP[market.key as OddsApiMarketKey];
        if (!type) {
          continue;
        }

        const marketRef = `${event.id}:${bookmaker.key}:${market.key}`;
        markets.set(marketRef, {
          providerRef: marketRef,
          eventProviderRef: event.id,
          type,
          status: 'OPEN',
          line: marketLine(market),
        });

        for (const outcome of market.outcomes) {
          const selRef = selectionProviderRef(
            event.id,
            bookmaker.key,
            market.key,
            outcome,
          );
          selections.set(selRef, {
            providerRef: selRef,
            marketProviderRef: marketRef,
            name: selectionLabel(outcome),
            status: 'OPEN',
            price: String(outcome.price),
          });
        }
      }
    }
  }

  return {
    sports: [...sports.values()],
    leagues: [...leagues.values()],
    teams: [...teams.values()],
    fixtures: [...fixtures.values()],
    events: [...events.values()],
    markets: [...markets.values()],
    selections: [...selections.values()],
  };
}
