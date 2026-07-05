import { CUP_PENALTY_GK_QUALITY_FACTOR, CUP_PENALTY_KICKS, PEN_AIM } from '@/config/gameBalance';
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
  // Safety cap: if GK quality + conversion-rate config ever produce a
  // threshold where both teams always score (or always miss), the loop
  // would never terminate and the iOS watchdog would kill the app. 30
  // rounds is far beyond any real shootout (FIFA record is 25 kicks).
  const MAX_SUDDEN_DEATH = 30;
  while (penHome === penAway && sdRound - CUP_PENALTY_KICKS < MAX_SUDDEN_DEATH) {
    sdRound++;
    const hScored = homeScores();
    if (hScored) penHome++;
    kicks.push({ round: sdRound, isHome: true, takerName: homeName, scored: hScored, homeTotal: penHome, awayTotal: penAway });
    const aScored = awayScores();
    if (aScored) penAway++;
    kicks.push({ round: sdRound, isHome: false, takerName: awayName, scored: aScored, homeTotal: penHome, awayTotal: penAway });
    if (hScored !== aScored) break;
  }
  // If we hit the cap with scores still level, force a tiebreaker: home wins.
  // This is a pathological-config safety, not a real shootout outcome.
  if (penHome === penAway) {
    penHome++;
    kicks.push({ round: sdRound + 1, isHome: true, takerName: homeName, scored: true, homeTotal: penHome, awayTotal: penAway });
  }

  return { kicks, homeScore: penHome, awayScore: penAway, winner: penHome > penAway ? 'home' : 'away' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactive (tap-to-aim) shootout — kicks resolve one at a time instead of
// being pre-computed. The turn order / early-termination / sudden-death rules
// below are the SAME rules simulatePenaltyShootout encodes; getShootoutProgress
// is the incremental form used when kicks arrive one by one.
// ─────────────────────────────────────────────────────────────────────────────

export interface ShootoutProgress {
  /** Side to kick next, or null when the shootout is decided. */
  nextIsHome: boolean | null;
  /** Round number the next kick belongs to (1-5 regulation, 6+ sudden death). */
  nextRound: number;
  decided: boolean;
  homeTotal: number;
  awayTotal: number;
}

/** Incremental shootout rules from a partial kick list: whose turn, which
 *  round, and whether it's already decided (regulation early termination once
 *  the trailing side can't catch up; sudden death decided when a completed
 *  extra round splits). */
export function getShootoutProgress(kicks: PenaltyKick[]): ShootoutProgress {
  const homeTaken = kicks.filter(k => k.isHome).length;
  const awayTaken = kicks.length - homeTaken;
  const last = kicks[kicks.length - 1];
  const homeTotal = last?.homeTotal ?? 0;
  const awayTotal = last?.awayTotal ?? 0;

  let decided = false;
  if (homeTaken <= CUP_PENALTY_KICKS && awayTaken <= CUP_PENALTY_KICKS) {
    const homeRemaining = CUP_PENALTY_KICKS - homeTaken;
    const awayRemaining = CUP_PENALTY_KICKS - awayTaken;
    decided = homeTotal - awayTotal > awayRemaining || awayTotal - homeTotal > homeRemaining;
    // Regulation completed level → sudden death continues (not decided).
  }
  if (!decided && homeTaken > CUP_PENALTY_KICKS - 1 && awayTaken > CUP_PENALTY_KICKS - 1) {
    // At or past the end of regulation: decided once both sides have kicked
    // the same number of times and the totals differ.
    if (homeTaken === awayTaken && homeTaken >= CUP_PENALTY_KICKS && homeTotal !== awayTotal) decided = true;
  }

  const nextIsHome = decided ? null : homeTaken === awayTaken;
  const nextRound = (nextIsHome === false ? awayTaken : homeTaken) + 1;
  return { nextIsHome, nextRound, decided, homeTotal, awayTotal };
}

/** Broadcast stakes for the upcoming kick, from the player's perspective:
 *  what a goal or a miss would decide right now. Null when the kick carries
 *  no decisive weight. Pure rules math — copy lives with the UI. */
export type KickStakes = 'score_to_win' | 'miss_to_lose' | 'save_to_win' | 'concede_to_lose';

export function getKickStakes(kicks: PenaltyKick[], playerIsHome: boolean, playerKicking: boolean): KickStakes | null {
  const prog = getShootoutProgress(kicks);
  if (prog.decided || prog.nextIsHome === null) return null;
  const hypothetical = (scored: boolean) => getShootoutProgress([...kicks, {
    round: prog.nextRound, isHome: prog.nextIsHome!, takerName: '', scored,
    homeTotal: prog.homeTotal + (prog.nextIsHome && scored ? 1 : 0),
    awayTotal: prog.awayTotal + (!prog.nextIsHome && scored ? 1 : 0),
  }]);
  const ifScored = hypothetical(true);
  const ifMissed = hypothetical(false);
  const playerWins = (p: ShootoutProgress) =>
    p.decided && (playerIsHome ? p.homeTotal > p.awayTotal : p.awayTotal > p.homeTotal);
  if (playerKicking) {
    if (playerWins(ifScored)) return 'score_to_win';
    if (ifMissed.decided && !playerWins(ifMissed)) return 'miss_to_lose';
  } else {
    if (ifMissed.decided && playerWins(ifMissed)) return 'save_to_win';
    if (ifScored.decided && !playerWins(ifScored)) return 'concede_to_lose';
  }
  return null;
}

/** Penalty-taking quality 0–1: placement (shooting) with a composure (mental)
 *  component. An 80/80 attacker lands 0.8. Keepers take a heavy discount —
 *  generated GKs carry high mental ratings that would otherwise rank them
 *  alongside strikers on the spot. */
export function getPenaltyTakerQuality(p: Player | undefined): number {
  if (!p) return 0.6;
  const raw = (p.attributes.shooting * 0.7 + p.attributes.mental * 0.3) / 100;
  const positionMult = p.position === 'GK' ? PEN_AIM.GK_TAKER_MULT : 1;
  return Math.min(1, Math.max(0, raw * positionMult));
}

export interface AimedKickInput {
  /** Aim in goal-mouth space: x −1..1 (left→right), y 0..1 (ground→bar). */
  aimX: number;
  aimY: number;
  shooterQuality: number;   // 0–1 (getPenaltyTakerQuality)
  keeperQuality: number;    // 0–1 (getClubGKQuality scale)
  /** Shot power 0–1; defaults to PEN_AIM.POWER_NEUTRAL (pre-power behavior). */
  power?: number;
  /** Injectable RNG for tests. */
  rand?: () => number;
}

export interface AimedKickResult {
  outcome: 'goal' | 'saved' | 'off_target';
  scored: boolean;
  /** Where the keeper dove, same space as the aim. */
  diveX: number;
  diveY: number;
}

/** Resolve a single aimed penalty. Model:
 *  1. Off-target roll — grows with aim boldness past the safe zone, damped by
 *     shooter quality. A blasted top corner is a real risk; center never misses.
 *  2. Keeper picks a side (slightly reading the shot with quality), dives.
 *  3. If the keeper chose the shot's side, a reach roll decides the save —
 *     easier on central shots, harder in the corners.
 *  Expected conversion for a decent taker at moderate boldness ≈ 0.76 (the
 *  auto-sim's PENALTY_CONVERSION_RATE), by design. */
export function resolveAimedKick(input: AimedKickInput): AimedKickResult {
  const rand = input.rand ?? Math.random;
  const aimX = Math.max(-1, Math.min(1, input.aimX));
  const aimY = Math.max(0, Math.min(1, input.aimY));
  const q = Math.max(0, Math.min(1, input.shooterQuality));
  const gk = Math.max(0, Math.min(1, input.keeperQuality));
  const power = Math.max(0, Math.min(1, input.power ?? PEN_AIM.POWER_NEUTRAL));
  // Power trades placement for pace, calibrated to be a no-op at NEUTRAL.
  const powerOffTargetMult = Math.max(0.2, 1 + PEN_AIM.POWER_OFF_TARGET_SCALE * (power - PEN_AIM.POWER_NEUTRAL));
  const powerSaveMult = Math.max(0.2, 1 - PEN_AIM.POWER_SAVE_SCALE * (power - PEN_AIM.POWER_NEUTRAL));

  // Boldness 0 (dead center, mid height) → 1 (extreme corner / under the bar).
  const boldness = Math.max(Math.abs(aimX), Math.abs(aimY * 2 - 1));

  // Keeper commits to a side (or stays central for timid shots read early).
  const shotSide = aimX < -0.2 ? -1 : aimX > 0.2 ? 1 : 0;
  const readsSide = rand() < PEN_AIM.SIDE_READ_BASE + PEN_AIM.SIDE_READ_GK * gk;
  const diveSide = readsSide ? shotSide : ([-1, 0, 1].filter(s => s !== shotSide)[rand() < 0.5 ? 0 : 1]);
  const diveX = diveSide * (0.55 + rand() * 0.35);
  const diveY = Math.min(1, Math.max(0.05, aimY * (readsSide ? 0.9 : 0.5) + rand() * 0.25));

  // 1. Off the frame entirely?
  const overSafe = Math.max(0, boldness - PEN_AIM.SAFE_BOLDNESS) / (1 - PEN_AIM.SAFE_BOLDNESS);
  const offTargetChance = (PEN_AIM.OFF_TARGET_BASE + PEN_AIM.OFF_TARGET_EDGE * overSafe * (1 - q * 0.8)) * powerOffTargetMult;
  if (rand() < offTargetChance) {
    return { outcome: 'off_target', scored: false, diveX, diveY };
  }

  // 2/3. Saved only if the keeper went the right way and reaches it.
  if (diveSide === shotSide) {
    const reach =
      (PEN_AIM.SAVE_REACH_BASE + PEN_AIM.SAVE_REACH_GK_SPREAD * (gk - 0.5))
      * (1 - PEN_AIM.SAVE_REACH_BOLDNESS_DECAY * boldness)
      * (1 - PEN_AIM.SAVE_SHOOTER_DAMPEN * q)
      * powerSaveMult;
    if (rand() < Math.max(0.02, reach)) {
      return { outcome: 'saved', scored: false, diveX: shotSide * Math.max(0.4, Math.abs(aimX)), diveY: aimY, };
    }
  }
  return { outcome: 'goal', scored: true, diveX, diveY };
}

/** AI aim: professional distribution — mostly low/mid corners, occasional
 *  center or high risk. Boldness loosely tracks taker quality. */
export function pickAiAim(shooterQuality: number, rand: () => number = Math.random): { aimX: number; aimY: number } {
  const side = rand() < 0.5 ? -1 : 1;
  const roll = rand();
  if (roll < 0.12) return { aimX: side * 0.15 * rand(), aimY: 0.25 + rand() * 0.3 };          // down the middle
  if (roll < 0.75) return { aimX: side * (0.45 + 0.35 * shooterQuality), aimY: 0.15 + rand() * 0.35 }; // low corner
  return { aimX: side * (0.5 + 0.4 * shooterQuality), aimY: 0.6 + rand() * 0.3 };             // high corner
}

/** AI shot power: professionals mostly strike near the calibration point. */
export function pickAiPower(rand: () => number = Math.random): number {
  return Math.max(0.25, Math.min(0.95, PEN_AIM.POWER_NEUTRAL + (rand() - 0.5) * 0.45));
}

/** Continue a partially-taken shootout to completion with auto-resolved kicks
 *  (Skip to Result mid-interactive-shootout). Same per-kick model as the
 *  aimed flow so skipping isn't statistically different from playing. */
export function completeShootout(
  kicks: PenaltyKick[],
  opts: { homeName: string; awayName: string; homeGKQuality: number; awayGKQuality: number },
): PenaltyKick[] {
  const out = [...kicks];
  // Safety cap mirrors simulatePenaltyShootout's watchdog reasoning.
  for (let i = 0; i < 80; i++) {
    const prog = getShootoutProgress(out);
    if (prog.decided) break;
    const isHome = prog.nextIsHome !== false;
    const shooterQ = 0.65;
    const keeperQ = isHome ? opts.awayGKQuality : opts.homeGKQuality;
    const aim = pickAiAim(shooterQ);
    const res = resolveAimedKick({ ...aim, shooterQuality: shooterQ, keeperQuality: keeperQ, power: pickAiPower() });
    out.push({
      round: prog.nextRound,
      isHome,
      takerName: isHome ? opts.homeName : opts.awayName,
      scored: res.scored,
      outcome: res.outcome,
      aimX: aim.aimX,
      aimY: aim.aimY,
      diveX: res.diveX,
      diveY: res.diveY,
      homeTotal: prog.homeTotal + (isHome && res.scored ? 1 : 0),
      awayTotal: prog.awayTotal + (!isHome && res.scored ? 1 : 0),
    });
  }
  // Pathological-config tiebreaker, mirroring simulatePenaltyShootout.
  const final = getShootoutProgress(out);
  if (!final.decided) {
    out.push({
      round: final.nextRound, isHome: true, takerName: opts.homeName, scored: true,
      outcome: 'goal', homeTotal: final.homeTotal + 1, awayTotal: final.awayTotal,
    });
  }
  return out;
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
