import { Club, HeadToHeadRecord } from '@/types/game';
import { NEMESIS_GRUDGE_THRESHOLD } from '@/config/gameBalance';

/** Escalating grudge heat tiers, keyed off grudgeLevel (0-5). */
export type NemesisHeat = 'Bad Blood' | 'Bitter Rivals' | 'Nemesis';

export interface Nemesis {
  clubId: string;
  club: Club;
  /** Head-to-head record vs this club (W-D-L + grudge). */
  record: HeadToHeadRecord;
  grudgeLevel: number;
  heat: NemesisHeat;
}

/** Map a grudge level onto a heat label. Only meaningful at/above the
 *  NEMESIS_GRUDGE_THRESHOLD — below that there is no nemesis. */
export function getHeatLabel(grudgeLevel: number): NemesisHeat {
  if (grudgeLevel >= 5) return 'Nemesis';
  if (grudgeLevel >= 4) return 'Bitter Rivals';
  return 'Bad Blood';
}

/** The opponent club you hold the deepest grudge against, or null if no
 *  rivalry has crossed the threshold. Highest grudgeLevel wins; ties keep the
 *  first encountered (stable). Clubs with no record in `clubs` (e.g. virtual
 *  continental sides) are skipped since we can't render them. */
export function getNemesis(
  rivalries: Record<string, HeadToHeadRecord> | undefined,
  clubs: Record<string, Club>,
): Nemesis | null {
  if (!rivalries) return null;
  let best: Nemesis | null = null;
  for (const [clubId, record] of Object.entries(rivalries)) {
    if (!record || record.grudgeLevel < NEMESIS_GRUDGE_THRESHOLD) continue;
    const club = clubs[clubId];
    if (!club) continue;
    if (!best || record.grudgeLevel > best.grudgeLevel) {
      best = {
        clubId,
        club,
        record,
        grudgeLevel: record.grudgeLevel,
        heat: getHeatLabel(record.grudgeLevel),
      };
    }
  }
  return best;
}

// One-line barbs, keyed on who won the last meeting. Deterministic per state
// (indexed by total games played) so the copy is stable across re-renders but
// varies between rivalries. `{opp}` is replaced with the opponent short name.
const BARBS_YOU_WON = [
  `You silenced {opp} last time — do it all over again.`,
  `{opp} still haven't gotten over the last one. Rub it in.`,
  `Last meeting went your way. Twist the knife.`,
];
const BARBS_THEY_WON = [
  `{opp} beat you last time. This one's personal.`,
  `Time to make {opp} pay for the last defeat.`,
  `You owe {opp} for the last result. Collect.`,
];
const BARBS_NEUTRAL = [
  `Nothing between you and {opp} last time — settle it here.`,
  `{opp} always bring out the bad blood. No quarter today.`,
  `This one's been building for a while. Make it count against {opp}.`,
];

/** Generate a one-line pre-match barb for a nemesis fixture. `lastResult` is
 *  from the manager's perspective (W = you beat them last). */
export function getNemesisBarb(record: HeadToHeadRecord, oppShortName: string): string {
  const pool =
    record.lastResult === 'W' ? BARBS_YOU_WON :
    record.lastResult === 'L' ? BARBS_THEY_WON :
    BARBS_NEUTRAL;
  const games = record.wins + record.draws + record.losses;
  const barb = pool[games % pool.length];
  return barb.replace('{opp}', oppShortName);
}
