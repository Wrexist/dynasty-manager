import { CUP_PENALTY_GK_QUALITY_FACTOR, CUP_PENALTY_KICKS } from '@/config/gameBalance';
import { PENALTY_CONVERSION_RATE } from '@/config/matchEngine';
import type { Club, PenaltyKick, Player } from '@/types/game';

interface ShootoutOpts {
  homeName: string;
  awayName: string;
  homeGKQuality: number;
  awayGKQuality: number;
}

export interface ShootoutResult {
  kicks: PenaltyKick[];
  homeScore: number;
  awayScore: number;
  winner: 'home' | 'away';
}

/** Single source of truth for penalty shootouts. Replaces the two divergent
 *  paths that previously existed:
 *    - matchActions.ts used PENALTY_CONVERSION_RATE + GK quality factor
 *    - data/cup.ts used a flat CUP_PENALTY_WIN_CHANCE coin flip
 *
 *  Also adds early termination: as soon as the trailing team can no longer
 *  catch up (lead > opponent's remaining kicks), regulation stops. Real
 *  shootouts work this way; the previous code always fired all 5+5 kicks
 *  even when 3-0 after 6 had already decided it. */
export function simulatePenaltyShootout(opts: ShootoutOpts): ShootoutResult {
  const { homeName, awayName, homeGKQuality, awayGKQuality } = opts;
  const kicks: PenaltyKick[] = [];
  let penHome = 0;
  let penAway = 0;
  let homeKicksTaken = 0;
  let awayKicksTaken = 0;

  const homeScores = () => Math.random() > awayGKQuality * CUP_PENALTY_GK_QUALITY_FACTOR + (1 - PENALTY_CONVERSION_RATE);
  const awayScores = () => Math.random() > homeGKQuality * CUP_PENALTY_GK_QUALITY_FACTOR + (1 - PENALTY_CONVERSION_RATE);

  for (let kickNum = 1; kickNum <= 2 * CUP_PENALTY_KICKS; kickNum++) {
    const isHome = kickNum % 2 === 1;
    const round = Math.ceil(kickNum / 2);
    if (isHome) {
      const scored = homeScores();
      if (scored) penHome++;
      homeKicksTaken++;
      kicks.push({ round, isHome: true, takerName: homeName, scored, homeTotal: penHome, awayTotal: penAway });
    } else {
      const scored = awayScores();
      if (scored) penAway++;
      awayKicksTaken++;
      kicks.push({ round, isHome: false, takerName: awayName, scored, homeTotal: penHome, awayTotal: penAway });
    }
    const homeRemaining = CUP_PENALTY_KICKS - homeKicksTaken;
    const awayRemaining = CUP_PENALTY_KICKS - awayKicksTaken;
    if (penHome - penAway > awayRemaining || penAway - penHome > homeRemaining) break;
  }

  let sdRound = CUP_PENALTY_KICKS;
  while (penHome === penAway) {
    sdRound++;
    const hScored = homeScores();
    if (hScored) penHome++;
    kicks.push({ round: sdRound, isHome: true, takerName: homeName, scored: hScored, homeTotal: penHome, awayTotal: penAway });
    const aScored = awayScores();
    if (aScored) penAway++;
    kicks.push({ round: sdRound, isHome: false, takerName: awayName, scored: aScored, homeTotal: penHome, awayTotal: penAway });
    if (hScored !== aScored) break;
  }

  return { kicks, homeScore: penHome, awayScore: penAway, winner: penHome > penAway ? 'home' : 'away' };
}

/** Pull a GK quality score (0–1) from a club's lineup or playerIds. Used by
 *  both the user-facing flow (lineup) and the AI cup flow (any GK on the
 *  roster). Falls back to 0.5 when no GK can be found — keeps shootouts
 *  from crashing on shape-corrupt clubs. */
export function getClubGKQuality(club: Club | undefined, players: Record<string, Player>): number {
  if (!club) return 0.5;
  const candidates = (club.lineup?.length ? club.lineup : club.playerIds || [])
    .map(id => players[id])
    .filter((p): p is Player => Boolean(p));
  const gk = candidates.find(p => p.position === 'GK');
  if (!gk) return 0.5;
  return (gk.attributes.defending + gk.attributes.mental) / 200;
}
