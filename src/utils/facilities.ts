import type { FacilitiesState, StadiumStands, StandKey } from '@/types/game';
import { FACILITY_MAX_LEVEL } from '@/config/gameBalance';

/** Effective stadium level = average of all 4 stands (floored). Used for income, sponsor unlocks, etc. */
export function getEffectiveStadiumLevel(facilities: FacilitiesState): number {
  const s = facilities.stadiumStands;
  return Math.floor((s.north + s.south + s.east + s.west) / 4);
}

/** Sum of all stand levels — useful for total capacity / revenue display */
export function getTotalStandLevels(stands: StadiumStands): number {
  return stands.north + stands.south + stands.east + stands.west;
}

/** Calculate dynamic stadium capacity based on stand levels. Up to +50% over base. */
export function getStadiumCapacity(baseCapacity: number, stands: StadiumStands): number {
  const total = getTotalStandLevels(stands);
  // total ranges 0-40. At 20 (all level 5) = +25%, at 40 (all max) = +50%
  return Math.round(baseCapacity * (1 + (total / 40) * 0.5));
}

export const STAND_INFO = {
  north: { label: 'North Stand', subtitle: 'Main Stand' },
  south: { label: 'South Stand', subtitle: 'The Kop' },
  east: { label: 'East Stand', subtitle: 'Family Stand' },
  west: { label: 'West Stand', subtitle: 'Away End' },
} as const;

const STAND_KEYS: StandKey[] = ['north', 'south', 'east', 'west'];

/** Named tier progression — surfaced in the headline so players see the next milestone. */
export const STADIUM_TIERS = [
  { min: 0, label: 'Empty Lot' },
  { min: 1, label: 'Basic' },
  { min: 4, label: 'Covered' },
  { min: 7, label: 'Modern' },
  { min: 9, label: 'Iconic' },
  { min: 10, label: 'World-Class' },
] as const;

export function getStadiumTier(effectiveLevel: number): { current: string; next: string | null; nextAt: number | null } {
  let currentIdx = 0;
  for (let i = 0; i < STADIUM_TIERS.length; i++) {
    if (effectiveLevel >= STADIUM_TIERS[i].min) currentIdx = i;
  }
  const next = STADIUM_TIERS[currentIdx + 1] || null;
  return {
    current: STADIUM_TIERS[currentIdx].label,
    next: next?.label || null,
    nextAt: next?.min ?? null,
  };
}

/**
 * Pick the stand the player should upgrade next. Prefers the lowest level so
 * the stadium grows evenly (effective level is the floor of the average).
 * Ties broken by a fixed clockwise order so the recommendation is stable.
 */
export function getRecommendedStand(stands: StadiumStands): StandKey | null {
  let best: StandKey | null = null;
  let bestLevel = FACILITY_MAX_LEVEL + 1;
  for (const key of STAND_KEYS) {
    if (stands[key] >= FACILITY_MAX_LEVEL) continue;
    if (stands[key] < bestLevel) {
      best = key;
      bestLevel = stands[key];
    }
  }
  return best;
}

