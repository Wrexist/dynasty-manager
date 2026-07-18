/**
 * Opposition Game Plans.
 *
 * A pre-match game plan (chosen in Match Prep) flows into the match sim through
 * the SAME modifier path team talks use. Unlike the pre-match team talk (a
 * first-half one-shot), the game plan is a whole-match decision: it applies to
 * both halves + extra time and is only cleared when the result is dismissed
 * (clearMatchResult) or the week advances. It is transient — never persisted —
 * so there is no save-migration step.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import {
  gamePlanModifiers,
  mergeGamePlanMods,
  gamePlanDebriefLine,
  GAME_PLANS,
} from '@/config/gamePlan';
import { teamTalkModifiers } from '@/config/teamTalk';

const CLUB_ID = 'manchester-city';

describe('gamePlanModifiers', () => {
  it('returns undefined for no plan', () => {
    expect(gamePlanModifiers('none')).toBeUndefined();
  });

  it('man_mark damps the opponent (defenseMod up) at a small own-attack cost', () => {
    const m = gamePlanModifiers('man_mark')!;
    expect(m.defenseMod).toBeGreaterThan(0);
    expect(m.attackMod).toBeLessThan(0);
  });

  it('target_flank boosts own attack while conceding defensive solidity', () => {
    const m = gamePlanModifiers('target_flank')!;
    expect(m.attackMod).toBeGreaterThan(0);
    expect(m.defenseMod).toBeLessThan(0);
  });

  it('sit_deep boosts defence while blunting own attack', () => {
    const m = gamePlanModifiers('sit_deep')!;
    expect(m.defenseMod).toBeGreaterThan(0);
    expect(m.attackMod).toBeLessThan(0);
  });

  it('keeps magnitudes in the same small band as team-talk mods', () => {
    const talkMax = Math.max(
      Math.abs(teamTalkModifiers('demand')!.attackMod),
      Math.abs(teamTalkModifiers('calm')!.defenseMod),
    );
    for (const plan of GAME_PLANS) {
      const m = gamePlanModifiers(plan.id)!;
      expect(Math.abs(m.attackMod)).toBeLessThanOrEqual(talkMax);
      expect(Math.abs(m.defenseMod)).toBeLessThanOrEqual(talkMax);
    }
  });
});

describe('mergeGamePlanMods — folds a plan into combinedMods', () => {
  it('with no base, returns the plan mods directly', () => {
    const merged = mergeGamePlanMods(undefined, 'sit_deep');
    expect(merged).toEqual(gamePlanModifiers('sit_deep'));
  });

  it('with a base (team talk + shouts), sums attack/defense/foul and keeps base fitness drain', () => {
    const base = { attackMod: 0.1, defenseMod: -0.02, foulMod: 0.05, fitnessDrainMult: 1.3 };
    const gp = gamePlanModifiers('sit_deep')!;
    const merged = mergeGamePlanMods(base, 'sit_deep')!;
    expect(merged.attackMod).toBeCloseTo(base.attackMod + gp.attackMod, 6);
    expect(merged.defenseMod).toBeCloseTo(base.defenseMod + gp.defenseMod, 6);
    expect(merged.foulMod).toBeCloseTo(base.foulMod + gp.foulMod, 6);
    // Game plans never touch fatigue — base's drain multiplier wins.
    expect(merged.fitnessDrainMult).toBe(base.fitnessDrainMult);
  });

  it('plan "none" is a no-op passthrough of the base', () => {
    const base = { attackMod: 0.1, defenseMod: 0, foulMod: 0, fitnessDrainMult: 1 };
    expect(mergeGamePlanMods(base, 'none')).toBe(base);
    expect(mergeGamePlanMods(undefined, 'none')).toBeUndefined();
  });
});

describe('gamePlanDebriefLine', () => {
  it('reports goals conceded for defensive plans', () => {
    expect(gamePlanDebriefLine('sit_deep', 1, 0)).toMatch(/conceded 0/);
    expect(gamePlanDebriefLine('man_mark', 2, 1)).toMatch(/conceded 1/);
  });
  it('reports goals scored for the attacking plan', () => {
    expect(gamePlanDebriefLine('target_flank', 3, 1)).toMatch(/scored 3/);
  });
  it('returns undefined when no plan is set', () => {
    expect(gamePlanDebriefLine('none', 1, 0)).toBeUndefined();
  });
});

describe('game plan lifecycle in the store', () => {
  beforeEach(() => {
    useGameStore.getState().initGame(CLUB_ID);
  });

  it('defaults to none on a fresh game', () => {
    expect(useGameStore.getState().matchGamePlan).toBe('none');
  });

  it('setGamePlan updates the store field', () => {
    useGameStore.getState().setGamePlan('sit_deep');
    expect(useGameStore.getState().matchGamePlan).toBe('sit_deep');
  });

  it('survives the first half (unlike the pre-match team talk, which clears)', () => {
    useGameStore.setState({ matchGamePlan: 'sit_deep', matchTeamTalk: 'motivate' });
    const result = useGameStore.getState().playFirstHalf();
    expect(result).not.toBeNull();

    const s = useGameStore.getState();
    expect(s.matchPhase).toBe('half_time');
    // The pre-match team talk is a first-half one-shot → cleared.
    expect(s.matchTeamTalk).toBe('none');
    // The game plan is a whole-match decision → still active for the 2nd half.
    expect(s.matchGamePlan).toBe('sit_deep');
  });

  it('runs a full interactive match with a plan set, then clears on result dismissal', () => {
    useGameStore.setState({ matchGamePlan: 'man_mark' });
    expect(useGameStore.getState().playFirstHalf()).not.toBeNull();
    // Plan still applies through the second half.
    expect(useGameStore.getState().matchGamePlan).toBe('man_mark');
    const full = useGameStore.getState().playSecondHalf();
    expect(full).not.toBeNull();

    // Dismissing the post-match result clears the plan.
    useGameStore.getState().clearMatchResult();
    expect(useGameStore.getState().matchGamePlan).toBe('none');
  });
});
