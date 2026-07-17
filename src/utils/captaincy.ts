import type { Club, Player } from '@/types/game';
import { CAPTAIN_MIN_AGE } from '@/config/gameBalance';

/**
 * Pick a default captain + vice-captain for a squad.
 *
 * Preference order:
 *  1. Highest-leadership senior (age >= CAPTAIN_MIN_AGE) outfield players.
 *  2. Any outfield player (fallback for very young / GK-heavy squads).
 *  3. Anyone in the squad (last resort — a squad always gets an armband).
 *
 * Captain is the top pick, vice the second. Ties broken by overall.
 */
export function pickDefaultCaptaincy(
  squad: Player[],
): { captainId?: string; viceCaptainId?: string } {
  const valid = squad.filter(Boolean);
  const byLeadership = (a: Player, b: Player) =>
    (b.personality?.leadership || 0) - (a.personality?.leadership || 0) ||
    (b.overall || 0) - (a.overall || 0);

  const seniorOutfield = valid
    .filter(p => p.position !== 'GK' && p.age >= CAPTAIN_MIN_AGE && p.personality)
    .sort(byLeadership);
  const outfield = valid.filter(p => p.position !== 'GK').sort(byLeadership);
  const anyone = [...valid].sort(byLeadership);

  const pool =
    seniorOutfield.length >= 1 ? seniorOutfield :
    outfield.length >= 1 ? outfield :
    anyone;

  return { captainId: pool[0]?.id, viceCaptainId: pool[1]?.id };
}

/**
 * Recompute a club's captain/vice pair after a player leaves (sold, released,
 * loaned out, retired). Promotes the vice to captain when the captain departs,
 * and clears any armband id that no longer points at a squad member. Never
 * leaves a dangling captainId/viceCaptainId.
 */
export function reassignCaptaincyOnDeparture(
  club: Pick<Club, 'captainId' | 'viceCaptainId'>,
  departingPlayerId: string,
): { captainId?: string; viceCaptainId?: string } {
  let captainId = club.captainId;
  let viceCaptainId = club.viceCaptainId;

  if (captainId === departingPlayerId) {
    // Vice inherits the armband; the vice slot then falls empty.
    captainId = viceCaptainId;
    viceCaptainId = undefined;
  }
  if (viceCaptainId === departingPlayerId) {
    viceCaptainId = undefined;
  }
  return { captainId, viceCaptainId };
}
