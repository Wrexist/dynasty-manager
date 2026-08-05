/**
 * Regression: the half-time team talk must survive mid-match strength recomputes.
 *
 * `teamTalkModifiers` is folded into `homeStr`/`awayStr` as a MULTIPLIER at the
 * start of the half. Every mid-match event that changes who is on the pitch —
 * red cards, injuries, substitutions — and the AI's tactical reactivity at
 * minutes 60 and 75 recompute those two scalars from scratch.
 *
 * Those recompute sites used to assign the bare `computeStrengths` result,
 * discarding the multiplier. The AI reactivity block runs unconditionally for
 * any club carrying an `aiManagerProfile`, i.e. in effectively every match, so
 * the player's talk was wiped at minute 60 and the last 30 minutes were played
 * as if no talk had been given.
 *
 * The assertion is deliberately mechanism-level rather than "talked teams score
 * more": it compares xG accrued BEFORE minute 60 against xG accrued AFTER, so a
 * regression that only affects the post-60 window cannot hide inside overall
 * match noise.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { simulateHalf, type HalfState } from '@/engine/match';
import { generateSquad, selectBestLineup } from '@/utils/playerGen';
import { resetRealPlayerClaims } from '@/utils/realPlayerPicker';
import type { AIManagerProfile, Club, Player, TacticalInstructions } from '@/types/game';

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const BALANCED: TacticalInstructions = {
  mentality: 'balanced', width: 'normal', tempo: 'normal',
  defensiveLine: 'normal', pressingIntensity: 50,
};

/** An AI profile is what arms the minute-60/75 reactivity block, which is the
 *  recompute that used to wipe the talk. */
const AI_PROFILE: AIManagerProfile = {
  name: 'Test Boss', style: 'balanced', defaultTactics: { ...BALANCED },
  transferAggression: 0.5, youthFocus: 0.5, adaptability: 1,
};

function makeClub(id: string, profile?: AIManagerProfile): Club {
  return {
    id, name: id, shortName: id.slice(0, 3).toUpperCase(),
    color: '#fff', secondaryColor: '#000',
    budget: 50_000_000, wageBill: 200_000,
    reputation: 70, facilities: 5, youthRating: 5, fanBase: 5, boardPatience: 60,
    playerIds: [], formation: '4-3-3', lineup: [], subs: [],
    divisionId: 'eng',
    ...(profile ? { aiManagerProfile: profile } : {}),
  };
}

function setupClub(id: string, profile?: AIManagerProfile) {
  const club = makeClub(id, profile);
  const squad = generateSquad(id, 70, 1);
  squad.forEach(p => club.playerIds.push(p.id));
  const { lineup, subs } = selectBestLineup(squad, '4-3-3');
  club.lineup = lineup.map(p => p.id);
  club.subs = subs.map(p => p.id);
  return { club, lineup, subs };
}

/** Cumulative home xG at the last event strictly before `minute`. Events only
 *  carry xG on shot-ish types, so we scan for the last one that has it. */
function homeXGBefore(events: HalfState['events'], minute: number): number {
  let xg = 0;
  for (const ev of events) {
    if (ev.minute >= minute) break;
    if (typeof ev.homeXG === 'number') xg = ev.homeXG;
  }
  return xg;
}

describe('team talk persistence across mid-match strength recomputes', () => {
  const originalRandom = Math.random;
  afterEach(() => { Math.random = originalRandom; });
  beforeEach(() => { resetRealPlayerClaims(); });

  it('keeps lifting the player side after the minute-60 AI tactical recompute', () => {
    const SEEDS = 40;
    // Deliberately large so the signal clears match noise at a sane sample
    // size. The bug is binary (modifier present vs discarded), not marginal.
    const TALK = { attackMod: 0.5, defenseMod: 0.2, foulMod: 0 };

    let lateWithTalk = 0;
    let lateWithoutTalk = 0;
    let earlyWithTalk = 0;
    let earlyWithoutTalk = 0;

    for (let seed = 0; seed < SEEDS; seed++) {
      // Home is the player's club; away carries the AI profile that arms the
      // minute-60/75 reactivity recompute.
      Math.random = mulberry32(0xC0FFEE + seed);
      const home = setupClub(`home-${seed}`);
      const away = setupClub(`away-${seed}`, AI_PROFILE);

      const runSecondHalf = (talk: typeof TALK | undefined): HalfState => {
        Math.random = mulberry32(0xBEEF_0000 + seed);
        const first = simulateHalf(
          home.club, away.club, home.lineup as Player[], away.lineup as Player[],
          1, 45, BALANCED, BALANCED, undefined, home.club.id, undefined,
          undefined, undefined, 5, 5, 1, undefined,
          home.subs as Player[], away.subs as Player[], undefined, undefined, undefined,
        );
        // Same RNG stream for both arms so the halves are comparable.
        Math.random = mulberry32(0xFEED_0000 + seed);
        return simulateHalf(
          home.club, away.club, home.lineup as Player[], away.lineup as Player[],
          46, 90, BALANCED, BALANCED, undefined, home.club.id,
          structuredClone(first), undefined, undefined, 5, 5, 1, undefined,
          home.subs as Player[], away.subs as Player[], talk, undefined, undefined,
        );
      };

      const withTalk = runSecondHalf(TALK);
      const withoutTalk = runSecondHalf(undefined);

      const wtEarly = homeXGBefore(withTalk.events, 60);
      const wotEarly = homeXGBefore(withoutTalk.events, 60);
      earlyWithTalk += wtEarly;
      earlyWithoutTalk += wotEarly;
      lateWithTalk += withTalk.homeXG - wtEarly;
      lateWithoutTalk += withoutTalk.homeXG - wotEarly;
    }

    // Sanity: the talk works at all before minute 60 (this passed even with
    // the bug present — it is the control, not the regression).
    expect(earlyWithTalk).toBeGreaterThan(earlyWithoutTalk);

    // The regression. Pre-fix the minute-60 recompute discarded the multiplier,
    // so the post-60 window showed no talk effect at all.
    expect(lateWithTalk).toBeGreaterThan(lateWithoutTalk);

    // And the lift must not collapse relative to the pre-60 window. Pre-fix
    // this ratio was ~0; a full-strength talk keeps a clearly positive share.
    const earlyLift = (earlyWithTalk - earlyWithoutTalk) / earlyWithoutTalk;
    const lateLift = (lateWithTalk - lateWithoutTalk) / lateWithoutTalk;
    expect(lateLift).toBeGreaterThan(earlyLift * 0.4);
  });
});
