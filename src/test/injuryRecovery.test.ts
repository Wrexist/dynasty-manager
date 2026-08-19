/**
 * Injury recovery — regression cover for the worst defect found in the audit.
 *
 * THE BUG. `advanceWeek`'s injury clock lived inside
 * `playerClub.playerIds.forEach(...)`, so `injuryWeeks` was only ever
 * decremented for the player's OWN squad. Every other club in the world picked
 * up injuries from its simulated matches (`processAIMatchEvents` sets
 * `injured: true` with a medical-level-scaled `weeksRemaining`) and then never
 * healed. `injured` stayed true for the rest of the save.
 *
 * Measured across the 20 clubs of the player's division, injured / squad:
 *
 *     S1 kickoff    0 / 525
 *     S1 end      206 / 518
 *     S2 end      411 / 671
 *     S3 end      539 / 667      = 81% of the division unavailable
 *
 * The damage was not confined to the injury list. With opponents unable to
 * field eleven fit players, `playCurrentMatchImpl`'s
 * `hp.length < 7 || ap.length < 7` guard returned null for the PLAYER's own
 * fixture — no match, no message, and no auto-sim (that only fires when the
 * player played something else that week). League games played by the player's
 * club against the rest of the division:
 *
 *                 before        after
 *     S1          36 / 38       38 / 38
 *     S2          32 / 38       38 / 38
 *     S3          25 / 38       38 / 38
 *     S4          10 / 38       38 / 38
 *
 * The table, prize money, promotion and relegation were all computed off that
 * half-played season.
 *
 * No gate could see it: `stateValidator` and the longevity suites count players
 * who EXIST, not players who can play. A workaround was already in the tree —
 * `pickAiMatchSquad`'s "Emergency XI" comment records "measured mid-season, the
 * worst club had 6 available" and papers over the symptom.
 *
 * `aiClubsHeal` and `divisionStaysAvailable` are the tests that fail against
 * the pre-fix code.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { aiFitnessCeiling, aiWeeklyFitnessGain, applyWorldWeeklyUpkeep, stepInjuryRecovery } from '@/utils/injuryRecovery';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import { FITNESS_RECOVERY_BASE, INTENSITY_FITNESS_COST } from '@/config/training';
import { AI_FITNESS_CEILING_BASE, AI_FITNESS_CEILING_PER_RECOVERY_LEVEL, RECOVERY_FITNESS_BONUS_PER_LEVEL, clubRecoveryLevel } from '@/config/gameBalance';
import type { Club, InjuryDetails, Player } from '@/types/game';

const CLUB = 'manchester-city';

function details(over: Partial<InjuryDetails> = {}): InjuryDetails {
  return {
    type: 'Hamstring Strain', severity: 'moderate', weeksRemaining: 3, totalWeeks: 3,
    reinjuryRisk: 0.2, reinjuryWeeksRemaining: 4, fitnessOnReturn: 65, ...over,
  } as InjuryDetails;
}

function injured(over: Partial<Player> = {}): Player {
  return {
    id: 'p1', lastName: 'Test', injured: true, injuryWeeks: 3, fitness: 40,
    injuryDetails: details(), ...over,
  } as Player;
}

describe('stepInjuryRecovery', () => {
  it('takes a week off the clock', () => {
    const { player, recovered } = stepInjuryRecovery(injured(), 5);
    expect(player.injuryWeeks).toBe(2);
    expect(player.injured).toBe(true);
    expect(player.injuryDetails!.weeksRemaining).toBe(2);
    expect(recovered).toBe(false);
  });

  it('returns the player to fitness on the last week', () => {
    const { player, recovered } = stepInjuryRecovery(injured({ injuryWeeks: 1 }), 5);
    expect(player.injured).toBe(false);
    expect(player.injuryWeeks).toBe(0);
    expect(player.fitness).toBe(65); // fitnessOnReturn
    expect(recovered).toBe(true);
  });

  it('honours the physio boost without ever going negative', () => {
    const { player, recovered } = stepInjuryRecovery(injured({ injuryWeeks: 1 }), 5, 1);
    expect(player.injuryWeeks).toBe(0);
    expect(recovered).toBe(true);
    const long = stepInjuryRecovery(injured({ injuryWeeks: 6 }), 5, 1);
    expect(long.player.injuryWeeks).toBe(4);
  });

  it('keeps the re-injury window open on return, then closes it', () => {
    let p = stepInjuryRecovery(injured({ injuryWeeks: 1, injuryDetails: details({ reinjuryWeeksRemaining: 2 }) }), 5).player;
    expect(p.injuryDetails!.reinjuryWeeksRemaining).toBe(1);
    p = stepInjuryRecovery(p, 6).player;
    expect(p.injuryDetails).toBeUndefined();
  });

  it('clears a suspension once its week has passed', () => {
    const p = stepInjuryRecovery({ ...injured({ injured: false, injuryDetails: undefined }), suspendedUntilWeek: 4 } as Player, 4).player;
    expect(p.suspendedUntilWeek).toBeUndefined();
  });

  it('leaves a still-serving suspension alone', () => {
    const p = stepInjuryRecovery({ ...injured({ injured: false, injuryDetails: undefined }), suspendedUntilWeek: 9 } as Player, 4).player;
    expect(p.suspendedUntilWeek).toBe(9);
  });

  it('returns the very same object for a fit player — the scan must stay cheap', () => {
    const fit = { id: 'p2', lastName: 'Fit', injured: false, injuryWeeks: 0, fitness: 100 } as Player;
    const { player, recovered } = stepInjuryRecovery(fit, 12);
    expect(player).toBe(fit);
    expect(recovered).toBe(false);
  });

  it('survives an injured player with no injuryDetails', () => {
    const { player } = stepInjuryRecovery({ id: 'p3', lastName: 'X', injured: true, injuryWeeks: 1 } as Player, 3);
    expect(player.injured).toBe(false);
  });
});

const CLUBS: Record<string, Club> = { rival: { id: 'rival', facilities: 5 } as Club };

describe('aiFitnessCeiling', () => {
  it('brackets the ~87 every club starts at', () => {
    expect(aiFitnessCeiling(2)).toBeGreaterThanOrEqual(85);
    expect(aiFitnessCeiling(10)).toBeLessThan(100);
    expect(aiFitnessCeiling(10)).toBeGreaterThan(aiFitnessCeiling(2));
  });

  it('is the configured base plus the club\'s recovery level', () => {
    expect(aiFitnessCeiling(5)).toBe(
      AI_FITNESS_CEILING_BASE + clubRecoveryLevel(5) * AI_FITNESS_CEILING_PER_RECOVERY_LEVEL,
    );
  });
});

describe('aiWeeklyFitnessGain', () => {
  it('is the neutral schedule plus the club\'s recovery facilities', () => {
    expect(aiWeeklyFitnessGain(5)).toBe(
      FITNESS_RECOVERY_BASE + INTENSITY_FITNESS_COST.medium + clubRecoveryLevel(5) * RECOVERY_FITNESS_BONUS_PER_LEVEL,
    );
  });

  it('rewards better facilities, and never goes backwards', () => {
    const weak = aiWeeklyFitnessGain(2);
    const strong = aiWeeklyFitnessGain(10);
    expect(strong).toBeGreaterThan(weak);
    expect(weak).toBeGreaterThan(0);
  });

  it('falls back to the median rating for a club with no facilities figure', () => {
    expect(aiWeeklyFitnessGain(NaN)).toBe(aiWeeklyFitnessGain(5));
  });
});

describe('applyWorldWeeklyUpkeep', () => {
  it('heals everyone except the skipped squad, and counts returns', () => {
    const players: Record<string, Player> = {
      mine: injured({ id: 'mine', injuryWeeks: 1, clubId: 'rival' }),
      theirs: injured({ id: 'theirs', injuryWeeks: 1, clubId: 'rival' }),
      slow: injured({ id: 'slow', injuryWeeks: 4, clubId: 'rival' }),
    };
    const recoveries = applyWorldWeeklyUpkeep(players, CLUBS, 7, ['mine']);
    expect(players.mine.injured, 'the skipped squad is handled by its own pass').toBe(true);
    expect(players.theirs.injured).toBe(false);
    expect(players.slow.injuryWeeks).toBe(3);
    expect(recoveries).toBe(1);
  });

  it('accepts a Set as well as an array', () => {
    const players: Record<string, Player> = { a: injured({ id: 'a', injuryWeeks: 1, clubId: 'rival' }) };
    applyWorldWeeklyUpkeep(players, CLUBS, 7, new Set(['a']));
    expect(players.a.injured).toBe(true);
  });

  it('rests a tired AI player back toward the club ceiling', () => {
    const players: Record<string, Player> = {
      tired: { id: 'tired', lastName: 'T', clubId: 'rival', injured: false, injuryWeeks: 0, fitness: 60 } as Player,
    };
    applyWorldWeeklyUpkeep(players, CLUBS, 7, []);
    expect(players.tired.fitness).toBe(Math.min(aiFitnessCeiling(5), 60 + aiWeeklyFitnessGain(5)));
  });

  it('stops at the ceiling instead of pinning the world at 100', () => {
    // A flat gain with no ceiling was tried first and drove the AI squad
    // average to 99.7 against the player's 85 — the original decay bug with
    // the sign flipped.
    const players: Record<string, Player> = {
      near: { id: 'near', lastName: 'N', clubId: 'rival', injured: false, injuryWeeks: 0, fitness: 86 } as Player,
    };
    for (let w = 0; w < 10; w++) applyWorldWeeklyUpkeep(players, CLUBS, 7 + w, []);
    expect(players.near.fitness).toBe(aiFitnessCeiling(5));
    expect(players.near.fitness).toBeLessThan(100);
  });

  it('never drags a player who is already above the ceiling back down', () => {
    const players: Record<string, Player> = {
      flying: { id: 'flying', lastName: 'F', clubId: 'rival', injured: false, injuryWeeks: 0, fitness: 100 } as Player,
    };
    applyWorldWeeklyUpkeep(players, CLUBS, 7, []);
    expect(players.flying.fitness).toBe(100);
  });

  it('does not train an injured player back to fitness', () => {
    const players: Record<string, Player> = { hurt: injured({ id: 'hurt', clubId: 'rival', injuryWeeks: 3, fitness: 40 }) };
    applyWorldWeeklyUpkeep(players, CLUBS, 7, []);
    expect(players.hurt.injured).toBe(true);
    expect(players.hurt.fitness).toBe(40);
  });

  it('leaves fitnessOnReturn intact on the week a player comes back', () => {
    const players: Record<string, Player> = { back: injured({ id: 'back', clubId: 'rival', injuryWeeks: 1, fitness: 40 }) };
    applyWorldWeeklyUpkeep(players, CLUBS, 7, []);
    expect(players.back.injured).toBe(false);
    expect(players.back.fitness, 'the return-week gain overwrote fitnessOnReturn').toBe(65);
  });

  it('skips a player with no club — free agents do not train', () => {
    const players: Record<string, Player> = {
      fa: { id: 'fa', lastName: 'A', clubId: '', injured: false, injuryWeeks: 0, fitness: 55 } as Player,
    };
    applyWorldWeeklyUpkeep(players, CLUBS, 7, []);
    expect(players.fa.fitness).toBe(55);
  });
});

describe('injury recovery in the live game loop', () => {
  const tick = () => new Promise<void>(r => setTimeout(r, 0));

  beforeEach(async () => {
    __resetAutosaveSchedulerForTests();
    __resetSaveStorageForTests();
    localStorage.clear();
    // AWAITED. `initGame` is async (it may dynamic-import the community pack),
    // so a synchronous `beforeEach` let the first assertions of a case race the
    // world being built.
    await useGameStore.getState().initGame(CLUB);
  });

  it('aiClubsHeal: an injured AI player recovers as weeks pass', { timeout: 120_000 }, async () => {
    const st = useGameStore.getState();
    const rivalId = (st.divisionClubs[st.playerDivision] || []).find(id => id !== CLUB)!;
    const victimId = st.clubs[rivalId].playerIds[0];
    // A type string the injury generator cannot produce, so a NEW injury is
    // always distinguishable from this one.
    const MARKER = '__test-marker__';
    useGameStore.setState({
      players: {
        ...st.players,
        [victimId]: {
          ...st.players[victimId], injured: true, injuryWeeks: 3, fitness: 40,
          injuryDetails: { ...details(), type: MARKER, weeksRemaining: 3, totalWeeks: 3 },
        },
      },
    });

    /**
     * WATCH THE CLOCK, not the boolean.
     *
     * This case flaked roughly one run in six, on the pre-wave tree as well as
     * this one. The cause was not the fix under test: it advanced FIVE weeks
     * for a THREE-week injury, so the victim healed on week three, became
     * selectable again, and could pick up a fresh knock in week four or five —
     * at which point `injured` was true again and the case failed for the
     * opposite reason to the bug it exists for.
     *
     * Weeks one and two are confound-free by construction: an injured player is
     * never selected, so nothing can re-injure him, and the clock reading is
     * exact. Pre-fix those two readings are [3, 3]; post-fix they are [2, 1].
     * That is the whole regression, asserted deterministically.
     */
    const clock: number[] = [];
    for (let w = 0; w < 3; w++) {
      await useGameStore.getState().advanceWeek();
      clock.push(useGameStore.getState().players[victimId].injuryWeeks);
    }
    expect(clock.slice(0, 2), 'an AI club\'s injury clock did not tick down').toEqual([2, 1]);

    // And the injury itself is over. A knock picked up on the way back is a
    // different event and is explicitly allowed — what may not happen is THIS
    // one still running.
    const after = useGameStore.getState().players[victimId];
    const stillTheSameInjury = after.injured && after.injuryDetails?.type === MARKER;
    expect(stillTheSameInjury, 'an AI club player never recovered').toBe(false);
  });

  it('divisionStaysAvailable: the division does not silt up with injuries', { timeout: 300_000 }, async () => {
    for (let w = 0; w < 46; w++) {
      for (let k = 0; k < 5; k++) if (!useGameStore.getState().playCurrentMatch()) break;
      await useGameStore.getState().advanceWeek();
      if (w % 10 === 9) await tick();
    }

    const st = useGameStore.getState();
    const ids = st.divisionClubs[st.playerDivision] || [];
    let squad = 0, hurt = 0;
    const thin: string[] = [];
    for (const cid of ids) {
      const club = st.clubs[cid];
      const fit = (club?.playerIds || [])
        .map(id => st.players[id])
        .filter(p => p && !p.injured && !p.onLoan && !(p.suspendedUntilWeek && p.suspendedUntilWeek > st.week));
      squad += (club?.playerIds || []).length;
      hurt += (club?.playerIds || []).filter(id => st.players[id]?.injured).length;
      if (fit.length < 11) thin.push(`${cid}:${fit.length}`);
    }

    const rate = hurt / squad;
    // Pre-fix this reached 40% after one season and 81% by season three.
    expect(rate, `${Math.round(rate * 100)}% of the division is injured`).toBeLessThan(0.15);
    expect(thin, `clubs that cannot field an XI: ${thin.join(', ')}`).toEqual([]);

    // And the player's own season is complete rather than half-played.
    const mine = (st.divisionTables?.[st.playerDivision] || []).find(e => e.clubId === CLUB);
    const others = (st.divisionTables?.[st.playerDivision] || []).filter(e => e.clubId !== CLUB).map(e => e.played);
    expect(mine!.played, 'player club played fewer league games than the division')
      .toBeGreaterThanOrEqual(Math.min(...others));
  });
});
