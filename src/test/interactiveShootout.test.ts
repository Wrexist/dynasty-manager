/**
 * Interactive (tap-to-aim) penalty shootout.
 *
 * Covers the three layers:
 *   1. Pure rules — getShootoutProgress turn order / early termination /
 *      sudden death, resolveAimedKick outcome model, completeShootout.
 *   2. Store actions — takeAimedPenalty / revealOpponentPenalty turn
 *      enforcement, taker rotation, kick bookkeeping.
 *   3. End-to-end — a full aimed shootout through skipPenaltyShootout
 *      finalizes the World Cup final exactly like the legacy flow did.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import {
  getShootoutProgress, resolveAimedKick, completeShootout, getPenaltyTakerQuality, pickAiAim,
} from '@/utils/penaltyShootout';
import type { PenaltyKick } from '@/types/game';

const kick = (round: number, isHome: boolean, scored: boolean, homeTotal: number, awayTotal: number): PenaltyKick =>
  ({ round, isHome, takerName: 'T', scored, homeTotal, awayTotal });

describe('getShootoutProgress — rules', () => {
  it('starts with the home side, round 1', () => {
    const p = getShootoutProgress([]);
    expect(p).toMatchObject({ nextIsHome: true, nextRound: 1, decided: false, homeTotal: 0, awayTotal: 0 });
  });

  it('alternates home → away within a round', () => {
    const p = getShootoutProgress([kick(1, true, true, 1, 0)]);
    expect(p.nextIsHome).toBe(false);
    expect(p.nextRound).toBe(1);
  });

  it('terminates regulation early when the trailing side cannot catch up', () => {
    // Home 3-0 up after away's 3rd kick: away has 2 kicks left, gap is 3.
    const kicks = [
      kick(1, true, true, 1, 0), kick(1, false, false, 1, 0),
      kick(2, true, true, 2, 0), kick(2, false, false, 2, 0),
      kick(3, true, true, 3, 0), kick(3, false, false, 3, 0),
    ];
    expect(getShootoutProgress(kicks).decided).toBe(true);
  });

  it('level after 5 rounds each goes to sudden death, not decided', () => {
    const kicks: PenaltyKick[] = [];
    for (let r = 1; r <= 5; r++) {
      kicks.push(kick(r, true, true, r, r - 1));
      kicks.push(kick(r, false, true, r, r));
    }
    const p = getShootoutProgress(kicks);
    expect(p.decided).toBe(false);
    expect(p.nextIsHome).toBe(true);
    expect(p.nextRound).toBe(6);
  });

  it('sudden death decides only after a completed split round', () => {
    const base: PenaltyKick[] = [];
    for (let r = 1; r <= 5; r++) {
      base.push(kick(r, true, true, r, r - 1));
      base.push(kick(r, false, true, r, r));
    }
    // Home scores SD kick — not decided until away replies.
    const midSD = [...base, kick(6, true, true, 6, 5)];
    expect(getShootoutProgress(midSD).decided).toBe(false);
    expect(getShootoutProgress(midSD).nextIsHome).toBe(false);
    // Away misses — decided.
    const doneSD = [...midSD, kick(6, false, false, 6, 5)];
    expect(getShootoutProgress(doneSD).decided).toBe(true);
    expect(getShootoutProgress(doneSD).nextIsHome).toBeNull();
  });
});

describe('resolveAimedKick — outcome model', () => {
  it('is deterministic with an injected RNG', () => {
    const seq = [0.9, 0.9, 0.9, 0.9]; // never off target, keeper reads wrong, no save
    let i = 0;
    const res = resolveAimedKick({ aimX: 0.7, aimY: 0.2, shooterQuality: 0.7, keeperQuality: 0.6, rand: () => seq[i++ % seq.length] });
    expect(res.outcome).toBe('goal');
    expect(res.scored).toBe(true);
  });

  it('a wildly bold shot can go off target; a centered one basically cannot', () => {
    // rand()=0 forces the off-target roll to succeed only if chance > 0.
    const bold = resolveAimedKick({ aimX: 1, aimY: 1, shooterQuality: 0, keeperQuality: 0.5, rand: () => 0 });
    expect(bold.outcome).toBe('off_target');
    // Center shot: every roll at 0.5 clears the 2% base off-target chance.
    const safe = resolveAimedKick({ aimX: 0, aimY: 0.4, shooterQuality: 0.5, keeperQuality: 0.5, rand: () => 0.5 });
    expect(safe.outcome).not.toBe('off_target');
  });

  it('converts around the auto-sim rate for a sensible corner shot', () => {
    let goals = 0;
    const N = 4000;
    for (let n = 0; n < N; n++) {
      const res = resolveAimedKick({ aimX: 0.7, aimY: 0.3, shooterQuality: 0.7, keeperQuality: 0.6 });
      if (res.scored) goals++;
    }
    const rate = goals / N;
    // PENALTY_CONVERSION_RATE is 0.76; allow a generous statistical band.
    expect(rate).toBeGreaterThan(0.64);
    expect(rate).toBeLessThan(0.88);
  });

  it('AI aim stays inside the frame space', () => {
    for (let n = 0; n < 200; n++) {
      const aim = pickAiAim(Math.random());
      expect(Math.abs(aim.aimX)).toBeLessThanOrEqual(1);
      expect(aim.aimY).toBeGreaterThanOrEqual(0);
      expect(aim.aimY).toBeLessThanOrEqual(1);
    }
  });
});

describe('completeShootout', () => {
  it('always produces a decided shootout with consistent totals', () => {
    for (let n = 0; n < 25; n++) {
      const kicks = completeShootout([], { homeName: 'H', awayName: 'A', homeGKQuality: 0.6, awayGKQuality: 0.6 });
      const p = getShootoutProgress(kicks);
      expect(p.decided).toBe(true);
      // Totals must be monotonically consistent with the scored flags.
      let h = 0, a = 0;
      for (const k of kicks) {
        if (k.scored) { if (k.isHome) h++; else a++; }
        expect(k.homeTotal).toBe(h);
        expect(k.awayTotal).toBe(a);
      }
    }
  });

  it('continues from a partial kick list instead of restarting', () => {
    const partial = [kick(1, true, true, 1, 0), kick(1, false, false, 1, 0)];
    const done = completeShootout(partial, { homeName: 'H', awayName: 'A', homeGKQuality: 0.6, awayGKQuality: 0.6 });
    expect(done.slice(0, 2)).toEqual(partial);
    expect(getShootoutProgress(done).decided).toBe(true);
  });
});

describe('store actions — aimed shootout end to end (World Cup final)', () => {
  beforeEach(() => {
    useGameStore.getState().clearActiveSession();
    const ok = useGameStore.getState().startCaptureScenario('goat-final');
    expect(ok).toBe(true);
    const res = useGameStore.getState().playWorldCupPenalties();
    expect(res).not.toBeNull();
  });

  it('opens the interactive context instead of pre-computing kicks', () => {
    const s = useGameStore.getState();
    expect(s.penaltyShootoutCtx).not.toBeNull();
    expect(s.penaltyShootoutCtx!.playerIsHome).toBe(true); // Argentina staged as home
    expect(s.penaltyShootoutKicks).toHaveLength(0);
    expect(s.penaltyShootoutCtx!.homeGKId).toBeTruthy();
    expect(s.penaltyShootoutCtx!.awayGKId).toBeTruthy();
  });

  it('enforces turn order and records aim/dive data on kicks', () => {
    const s = useGameStore.getState();
    // Opponent can't kick first (player is home).
    expect(s.revealOpponentPenalty()).toBeNull();

    const takerId = useGameStore.getState().clubs['Argentina'].lineup[3];
    const kick1 = s.takeAimedPenalty(takerId, 0.6, 0.3);
    expect(kick1).not.toBeNull();
    expect(kick1!.isHome).toBe(true);
    expect(kick1!.takerId).toBe(takerId);
    expect(kick1!.aimX).toBeCloseTo(0.6);
    expect(typeof kick1!.diveX).toBe('number');
    expect(['goal', 'saved', 'off_target']).toContain(kick1!.outcome);

    // Player can't kick twice in a row.
    expect(useGameStore.getState().takeAimedPenalty(takerId, 0.5, 0.5)).toBeNull();

    const opp = useGameStore.getState().revealOpponentPenalty();
    expect(opp).not.toBeNull();
    expect(opp!.isHome).toBe(false);
    expect(opp!.takerName).toBeTruthy();
    expect(useGameStore.getState().penaltyShootoutKicks).toHaveLength(2);
  });

  it('tracks used takers so nobody repeats until the XI is exhausted', () => {
    const st = useGameStore.getState();
    const lineup = st.clubs['Argentina'].lineup;
    st.takeAimedPenalty(lineup[0], 0.4, 0.3);
    st.revealOpponentPenalty();
    const used = useGameStore.getState().penaltyShootoutCtx!.usedTakerIds;
    expect(used).toContain(lineup[0]);
  });

  it('plays a full aimed shootout to a finalized World Cup', () => {
    // Alternate aimed kicks and opponent replies until decided.
    for (let i = 0; i < 60; i++) {
      const st = useGameStore.getState();
      const prog = getShootoutProgress(st.penaltyShootoutKicks);
      if (prog.decided) break;
      if (prog.nextIsHome) {
        const pool = st.clubs['Argentina'].lineup
          .filter(id => !st.penaltyShootoutCtx!.usedTakerIds.includes(id));
        const taker = pool[0] ?? st.clubs['Argentina'].lineup[0];
        expect(st.takeAimedPenalty(taker, Math.random() * 1.4 - 0.7, Math.random() * 0.7)).not.toBeNull();
      } else {
        expect(st.revealOpponentPenalty()).not.toBeNull();
      }
    }
    expect(getShootoutProgress(useGameStore.getState().penaltyShootoutKicks).decided).toBe(true);

    // Continue → finalize (same path the UI's Continue button uses).
    useGameStore.getState().skipPenaltyShootout();
    const s = useGameStore.getState();
    expect(s.internationalTournament!.phase).toBe('complete');
    expect(s.internationalTournament!.winner).toBeTruthy();
    expect(s.currentMatchResult!.penaltyShootout).toBeTruthy();
    expect(s.penaltyShootoutCtx).toBeNull();
    expect(s.currentScreen).toBe('world-cup-result');
  });

  it('Skip to Result mid-shootout auto-completes and finalizes', () => {
    const st = useGameStore.getState();
    st.takeAimedPenalty(st.clubs['Argentina'].lineup[0], 0.5, 0.2);
    useGameStore.getState().skipPenaltyShootout();
    const s = useGameStore.getState();
    expect(s.internationalTournament!.phase).toBe('complete');
    expect(s.currentMatchResult!.penaltyShootout).toBeTruthy();
  });

  it('high power raises off-target risk and lowers save chance (deterministic)', () => {
    // Keeper reads the side (rand #1 low) and the reach roll (last rand) sits
    // where a soft shot is saved but a blasted one beats the dive.
    const seq = [0.0, 0.5, 0.5, 0.99, 0.42];
    const run = (power: number) => {
      let i = 0;
      return resolveAimedKick({ aimX: 0.5, aimY: 0.3, shooterQuality: 0.6, keeperQuality: 0.6, power, rand: () => seq[i++ % seq.length] });
    };
    expect(run(0.15).outcome).toBe('saved');
    expect(run(0.95).outcome).toBe('goal');
  });

  it('a rattled kick resolves through the same contract', () => {
    const st = useGameStore.getState();
    const takerId = st.clubs['Argentina'].lineup[0];
    const kick = st.takeAimedPenalty(takerId, 0.6, 0.3, { rattled: true, power: 0.85 });
    expect(kick).not.toBeNull();
    expect(['goal', 'saved', 'off_target']).toContain(kick!.outcome);
  });

  it('penalty taker quality helper is sane', () => {
    const st = useGameStore.getState();
    const anyPlayer = st.players[st.clubs['Argentina'].lineup[0]];
    const q = getPenaltyTakerQuality(anyPlayer);
    expect(q).toBeGreaterThan(0);
    expect(q).toBeLessThanOrEqual(1);
  });
});
