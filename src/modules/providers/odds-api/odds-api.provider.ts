import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse, isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { IngestQuotaService } from '../../ingestion/ingest-quota.service';
import { EnvConfig } from '../../../shared/config/env.validation';
import {
  EMPTY_PROVIDER_SNAPSHOT,
  FixtureProviderPort,
  LiveIngestScope,
  ProviderSnapshot,
} from '../provider.types';
import {
  ODDS_API_MARKET_TYPE_MAP,
  type OddsApiMarketKey,
  resolveSportConfig,
  resolveSportKeys,
  resolveRegions,
} from './odds-api.config';
import { mapOddsApiToSnapshot } from './odds-api.mapper';
import { syntheticOddsApiSport } from './odds-api-sport.util';
import type {
  OddsApiEventOdds,
  OddsApiEventScore,
  OddsApiSport,
} from './odds-api.types';

const REQUEST_TIMEOUT_MS = 15_000;

@Injectable()
export class OddsApiProvider implements FixtureProviderPort {
  private readonly logger = new Logger(OddsApiProvider.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly quota: IngestQuotaService,
  ) {}

  async fetchSnapshot(): Promise<ProviderSnapshot> {
    const apiKey = this.requireApiKey();
    const baseUrl = this.config.get('ODDS_API_BASE_URL', { infer: true });
    const configuredSportKeys = this.config.get('ODDS_API_SPORT_KEYS', {
      infer: true,
    });

    const apiSports = await this.fetchSports(apiKey, baseUrl);
    const sportKeys = resolveSportKeys(configuredSportKeys, apiSports);

    this.logger.log(
      `Odds API catalog ingest: ${sportKeys.length} sport(s) (configured=${configuredSportKeys.join(',')})`,
    );

    return this.buildSnapshot(apiKey, baseUrl, sportKeys, apiSports);
  }

  async fetchLiveSnapshot(scope: LiveIngestScope): Promise<ProviderSnapshot> {
    if (scope.sportKeys.length === 0) {
      return EMPTY_PROVIDER_SNAPSHOT;
    }

    const apiKey = this.requireApiKey();
    const baseUrl = this.config.get('ODDS_API_BASE_URL', { infer: true });
    const apiSports = scope.sportKeys.map(syntheticOddsApiSport);

    this.logger.log(
      `Odds API live tick: ${scope.sportKeys.length} sport(s) (${scope.sportKeys.join(',')})`,
    );

    return this.buildSnapshot(apiKey, baseUrl, scope.sportKeys, apiSports);
  }

  private async buildSnapshot(
    apiKey: string,
    baseUrl: string,
    sportKeys: string[],
    apiSports: OddsApiSport[],
  ): Promise<ProviderSnapshot> {
    const globalRegions = resolveRegions(
      this.config.get('ODDS_API_REGIONS', { infer: true }),
    );
    const marketKeys = this.config.get('ODDS_API_MARKETS', {
      infer: true,
    }) as OddsApiMarketKey[];
    const oddsFormat = this.config.get('ODDS_API_ODDS_FORMAT', { infer: true });

    const oddsBySport = new Map<string, OddsApiEventOdds[]>();
    const scoresBySport = new Map<string, OddsApiEventScore[]>();

    for (const sportKey of sportKeys) {
      const sportConfig = resolveSportConfig(
        sportKey,
        apiSports.find((sport) => sport.key === sportKey),
      );
      const regions = sportConfig.region
        ? resolveRegions(sportConfig.region)
        : globalRegions;

      try {
        const odds = await this.fetchOdds(
          apiKey,
          baseUrl,
          sportKey,
          regions,
          marketKeys,
          oddsFormat,
        );
        oddsBySport.set(sportKey, odds);
      } catch (error) {
        this.logger.warn(
          `Skipping ${sportKey} odds: ${(error as Error).message}`,
        );
        oddsBySport.set(sportKey, []);
      }

      try {
        const scores = await this.fetchScores(apiKey, baseUrl, sportKey);
        scoresBySport.set(sportKey, scores);
      } catch (error) {
        this.logger.warn(
          `Skipping ${sportKey} scores: ${(error as Error).message}`,
        );
        scoresBySport.set(sportKey, []);
      }
    }

    const snapshot = mapOddsApiToSnapshot({
      sportKeys,
      apiSports,
      oddsBySport,
      scoresBySport,
      marketKeys: marketKeys.filter(
        (key): key is OddsApiMarketKey => key in ODDS_API_MARKET_TYPE_MAP,
      ),
    });

    this.logger.log(
      `Odds API snapshot: sports=${snapshot.sports.length} leagues=${snapshot.leagues.length} fixtures=${snapshot.fixtures.length} markets=${snapshot.markets.length}`,
    );

    return snapshot;
  }

  private requireApiKey(): string {
    const apiKey = this.config.get('ODDS_API_KEY', { infer: true });
    if (!apiKey) {
      throw new Error('ODDS_API_KEY is required for OddsApiProvider');
    }
    return apiKey;
  }

  private async fetchSports(
    apiKey: string,
    baseUrl: string,
  ): Promise<OddsApiSport[]> {
    const response = await this.get<OddsApiSport[]>(
      `${baseUrl}/sports`,
      { apiKey },
      'sports catalog',
    );
    return response.data;
  }

  private async fetchOdds(
    apiKey: string,
    baseUrl: string,
    sportKey: string,
    regions: string,
    markets: string[],
    oddsFormat: string,
  ): Promise<OddsApiEventOdds[]> {
    const response = await this.get<OddsApiEventOdds[]>(
      `${baseUrl}/sports/${sportKey}/odds`,
      {
        apiKey,
        regions,
        markets: markets.join(','),
        oddsFormat,
      },
      `${sportKey} odds`,
    );
    return response.data;
  }

  private async fetchScores(
    apiKey: string,
    baseUrl: string,
    sportKey: string,
  ): Promise<OddsApiEventScore[]> {
    const response = await this.get<OddsApiEventScore[]>(
      `${baseUrl}/sports/${sportKey}/scores`,
      { apiKey, daysFrom: 1 },
      `${sportKey} scores`,
    );
    return response.data;
  }

  private async get<T>(
    url: string,
    params: Record<string, string | number>,
    label: string,
  ): Promise<AxiosResponse<T>> {
    try {
      const response = await firstValueFrom(
        this.http.get<T>(url, {
          params,
          timeout: REQUEST_TIMEOUT_MS,
        }),
      );
      this.logQuotaHeaders(label, response.headers);
      await this.quota.recordQuotaHeaders(response.headers);
      return response;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        await this.quota.pauseForAuthFailure();
      }
      throw error;
    }
  }

  private logQuotaHeaders(
    label: string,
    headers: AxiosResponse['headers'],
  ): void {
    const remaining = headers['x-requests-remaining'];
    const used = headers['x-requests-used'];
    if (remaining !== undefined || used !== undefined) {
      this.logger.log(
        `Odds API quota (${label}): remaining=${remaining ?? '?'} used=${used ?? '?'}`,
      );
    }
  }
}
