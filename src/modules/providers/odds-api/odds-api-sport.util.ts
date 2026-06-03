import type { OddsApiSport } from './odds-api.types';

/** Minimal catalog row for mapping when `/sports` is not called on a live tick. */
export function syntheticOddsApiSport(sportKey: string): OddsApiSport {
  const group = sportKey.split('_')[0] ?? sportKey;
  return {
    key: sportKey,
    group: group.charAt(0).toUpperCase() + group.slice(1),
    title: sportKey,
    description: '',
    active: true,
    has_outrights: false,
  };
}
