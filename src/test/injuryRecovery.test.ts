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
import { recoverInjuriesForOthers, stepInjuryRecovery } from '@/utils/injuryRecovery';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import type { InjuryDetails, Player } from '@/types/game';

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

describe('recoverInjuriesForOthers', () => {
  it('heals everyone except the skipped squad, and counts returns', () => {
    const players: Record<string, Player> = {
      mine: injured({ id: 'mine', injuryWeeks: 1 }),
      theirs: injured({ id: 'theirs', injuryWeeks: 1 }),
      slow: injured({ id: 'slow', injuryWeeks: 4 }),
    };
    const recoveries = recoverInjuriesForOthers(players, 7, ['mine']);
    expect(players.mine.injured, 'the skipped squad is handled by its own pass').toBe(true);
    expect(players.theirs.injured).toBe(false);
    expect(players.slow.injuryWeeks).toBe(3);
    expect(recoveries).toBe(1);
  });

  it('accepts a Set as well as an array', () => {
    const players: Record<string, Player> = { a: injured({ id: 'a', injuryWeeks: 1 }) };
    recoverInjuriesForOthers(players, 7, new Set(['a']));
    expect(players.a.injured).toBe(true);
  });
});

describe('injury recovery in the live game loop', () => {
  const tick = () => new Promise<void>(r => setTimeout(r, 0));

  beforeEach(() => {
    __resetAutosaveSchedulerForTests();
    __resetSaveStorageForTests();
    localStorage.clear();
    useGameStore.getState().initGame(CLUB);
  });

  it('aiClubsHeal: an injured AI player recovers as weeks pass', { timeout: 120_000 }, async () => {
    const st = useGameStore.getState();
    const rivalId = (st.divisionClubs[st.playerDivision] || []).find(id => id !== CLUB)!;
    const victimId = st.clubs[rivalId].playerIds[0];
    useGameStore.setState({
      players: {
        ...st.players,
        [victimId]: { ...st.players[victimId], injured: true, injuryWeeks: 3, fitness: 40 },
      },
    });

    for (let w = 0; w < 5; w++) await useGameStore.getState().advanceWeek();

    const after = useGameStore.getState().players[victimId];
    // Pre-fix: injuryWeeks stayed at 3 and `injured` stayed true forever.
    expect(after.injured, 'an AI club player never recovered').toBe(false);
    expect(after.injuryWeeks).toBe(0);
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
