import type { FacilitiesState, StadiumStands } from '@/types/game';

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

export const FACILITY_MILESTONES: Record<string, { level: number; label: string }[]> = {
  training: [
    { level: 3, label: 'Advanced drills unlocked' },
    { level: 5, label: '+100% training effectiveness' },
    { level: 7, label: 'Elite coaching methods' },
    { level: 10, label: 'World-class facility' },
  ],
  youth: [
    { level: 3, label: 'Better prospect intake' },
    { level: 5, label: 'Academy sponsor slot' },
    { level: 7, label: 'Elite development rate' },
    { level: 10, label: 'World-class academy' },
  ],
  medical: [
    { level: 3, label: 'Faster recovery times' },
    { level: 5, label: 'Advanced injury prevention' },
    { level: 7, label: 'Elite medical care' },
    { level: 10, label: 'World-class medical' },
  ],
  recovery: [
    { level: 3, label: '+3% weekly fitness' },
    { level: 5, label: '+5% weekly fitness' },
    { level: 7, label: 'Elite recovery protocols' },
    { level: 10, label: 'World-class recovery' },
  ],
};
