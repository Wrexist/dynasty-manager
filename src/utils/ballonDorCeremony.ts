/**
 * Ballon d'Or Night — pure helpers for the 10→1 reveal.
 *
 * The ranking itself is computed at season end (`calculateBallonDOr`,
 * stored on `SeasonHistory.ballonDOrRanking`); nothing here recomputes or
 * reorders who won. This module decides the ORDER the cards are turned and
 * HOW each one is turned, and remembers — per device — whether a season's
 * ceremony has been watched, so the season summary, the inbox and the page
 * never spoil a winner the player has not revealed yet.
 */
import { BALLON_DOR_TOP10_RANK } from '@/config/gameBalance';
import { BALLON_DOR_CEREMONY } from '@/config/ui';
import { getFlag, setFlag, STORAGE_KEYS } from '@/store/helpers/persistence';
import type { BallonDOrEntry } from '@/types/game';

export type CeremonyRevealStyle = 'quick' | 'podium' | 'winner';

/** The ceremony's cards in the order they are turned: 10th first, winner
 *  last. Only the top {@link BALLON_DOR_TOP10_RANK} are dealt — ranks 11–25
 *  stay on the page's full ranking. Tolerates an unsorted or short ranking. */
export function ceremonyOrder(ranking: readonly BallonDOrEntry[] | undefined | null): BallonDOrEntry[] {
  if (!ranking?.length) return [];
  return ranking
    .filter(e => e.rank >= 1 && e.rank <= BALLON_DOR_TOP10_RANK)
    .slice()
    .sort((a, b) => b.rank - a.rank);
}

/** How a rank is revealed: the winner walks out, the podium slows down,
 *  everyone else flips fast. */
export function revealStyleFor(rank: number): CeremonyRevealStyle {
  if (rank === 1) return 'winner';
  if (rank <= BALLON_DOR_CEREMONY.podiumFrom) return 'podium';
  return 'quick';
}

/** One key per career: a v93+ save has a `careerId`; an older one falls back
 *  to its slot, the same rule the Hall of Managers uses. */
export function ceremonyCareerKey(careerId: string | null | undefined, activeSlot: number | null | undefined): string {
  return careerId || `slot-${activeSlot ?? 1}`;
}

function seenKey(careerKey: string, season: number): string {
  return `${STORAGE_KEYS.BALLON_CEREMONY_PREFIX}${careerKey}-${season}`;
}

export function hasSeenCeremony(careerKey: string, season: number): boolean {
  return getFlag(seenKey(careerKey, season));
}

export function markCeremonySeen(careerKey: string, season: number): void {
  setFlag(seenKey(careerKey, season));
}
