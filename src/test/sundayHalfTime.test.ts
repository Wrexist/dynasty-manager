/**
 * Half time — the one decision that is really simulated.
 *
 * The mode's strongest guarantee used to be that a Sunday result was settled
 * the moment the manager tapped Kick Off. Splitting the match in two trades
 * some of that for a real tactical decision, so what these tests protect is
 * the price of the trade:
 *
 *   - the two-call path writes exactly what the one-call path writes;
 *   - nothing that is not a person (the weekly advance, the rest of the
 *     division, the cup ties nobody watches) ever takes the split path;
 *   - a match cannot be settled twice, and a reload cannot re-roll either half.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { validateSundayState } from '@/utils/sunday/invariants';
import { __resetSundayHalfTimeSessionForTests } from '@/store/slices/sunday/matchday';
import {
  SUNDAY_TACTICS, SUNDAY_MIN_START, SUNDAY_FULL_XI, SUNDAY_MAX_BENCH,
} from '@/config/sundayLeague';
import type { SundayTacticId } from '@/types/game';

const SEED = 8181;

function check(): string[] {
  const s = useGameStore.getState();
  return validateSundayState({
    sunday: s.sunday!, players: s.players, clubs: s.clubs,
    playerClubId: s.playerClubId, fixtures: s.fixtures, week: s.week,
  }).problems;
}

/** Everything the settlement writes, in one comparable shape. */
function downstream() {
  const s = useGameStore.getState();
  const report = s.sunday!.lastMatch!;
  return {
    played: s.fixtures.filter(m => m.played).length,
    hasReport: !!report,
    ratedPlayers: s.matchPlayerRatings.length,
    playedIds: report.playedIds.length,
    apps: s.sunday!.squad.reduce((n, m) => n + m.clubApps, 0),
    // Squad members among the men who took the field. `apps` must equal this
    // on either path — see the note on the comparison below.
    squadWhoPlayed: report.playedIds.filter(id => s.sunday!.squad.some(m => m.playerId === id)).length,
    appearances: report.playedIds.reduce((n, id) => n + (s.players[id]?.appearances ?? 0), 0),
    memories: s.sunday!.squad.reduce((n, m) => n + m.memories.length, 0),
    narrativeEndsAtFullTime: /^FT \d+-\d+\.$/.test(
      report.narrative.filter(l => /^FT /.test(l))[0] ?? '',
    ),
    tier: report.tier,
    halfTime: s.sunday!.halfTime,
    stats: { ...s.sunday!.seasonStats },
  };
}

/** A tactic that is not the one the club is set up in. */
function otherTactic(): SundayTacticId {
  const current = useGameStore.getState().sunday!.tactic;
  return (SUNDAY_TACTICS.find(t => t.id !== current) ?? SUNDAY_TACTICS[0]).id;
}

beforeEach(async () => {
  __resetSundayHalfTimeSessionForTests();
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
});

describe('playing a match in two halves', () => {
  it('pauses at the break with the half on screen and the choice still open', async () => {
    const { halfTime, report } = await useGameStore.getState().playSundayFirstHalf();
    expect(report).toBeNull();
    expect(halfTime).not.toBeNull();
    // Nothing has been settled: no result, no fixture marked played.
    expect(useGameStore.getState().sunday!.lastMatch).toBeNull();
    expect(useGameStore.getState().fixtures.filter(m => m.played)).toHaveLength(0);
    // The feed stops at the marker and the score agrees with it.
    const last = halfTime!.narrative[halfTime!.narrative.length - 1];
    expect(last).toMatch(/^HT \d+-\d+\.$/);
    expect(halfTime!.narrative.filter(l => /^FT /.test(l))).toHaveLength(0);
    // Every man on the pitch is accounted for, guests included — this is what
    // stops a reload resuming with nine men.
    expect(halfTime!.startingIds.length).toBeGreaterThanOrEqual(7);
    for (const id of halfTime!.startingIds) {
      const known = useGameStore.getState().players[id] || halfTime!.ringers.some(r => r.id === id);
      expect(known, id).toBeTruthy();
    }
    expect(check()).toEqual([]);
  });

  it('writes exactly what the one-call path writes', async () => {
    // Two saves from the same seed: one played whole, one played in halves.
    // The engine is unseeded so the SCORES differ; the SHAPE must not.
    await useGameStore.getState().playSundayMatch();
    const atomic = downstream();

    __resetSundayHalfTimeSessionForTests();
    useGameStore.getState().resetGame();
    await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
    const paused = await useGameStore.getState().playSundayFirstHalf();
    expect(paused.halfTime).not.toBeNull();
    const report = await useGameStore.getState().finishSundayMatch();
    expect(report).not.toBeNull();
    const split = downstream();

    expect(split.played).toBe(atomic.played);
    expect(split.hasReport).toBe(true);
    expect(split.playedIds).toBeGreaterThan(0);
    expect(split.ratedPlayers).toBeGreaterThan(0);
    // APPEARANCES ARE COMPARED WITHIN A PATH, NOT ACROSS THE TWO.
    //
    // The shared engine is unseeded, so how many substitutes it decides to use
    // is a property of the ninety minutes it actually played — two runs of
    // "the same" fixture can field a different number of men. Asserting
    // equality across the two runs passed by luck for as long as the squads
    // were thin enough that the bench was always emptied; it started flaking
    // the moment availability improved. The invariant that is actually load-
    // bearing is that each path books an appearance for exactly the squad
    // members who took the field, and that is checked on both.
    expect(split.apps).toBe(split.squadWhoPlayed);
    expect(atomic.apps).toBe(atomic.squadWhoPlayed);
    expect(split.apps).toBeGreaterThanOrEqual(SUNDAY_MIN_START);
    expect(split.apps).toBeLessThanOrEqual(SUNDAY_FULL_XI + SUNDAY_MAX_BENCH);
    expect(split.appearances).toBeGreaterThan(0);
    expect(split.narrativeEndsAtFullTime).toBe(true);
    expect(split.tier).toBe(atomic.tier);
    expect(split.halfTime).toBeNull();
    expect(split.stats.played).toBe(atomic.stats.played);
    expect(check()).toEqual([]);
  });

  it('carries the first half into the finished report untouched', async () => {
    const { halfTime } = await useGameStore.getState().playSundayFirstHalf();
    const shown = [...halfTime!.narrative];
    const report = (await useGameStore.getState().finishSundayMatch())!;
    // The reveal continues where it paused rather than re-writing the half the
    // manager has already read.
    expect(report.narrative.slice(0, shown.length)).toEqual(shown);
    expect(report.narrative.length).toBeGreaterThan(shown.length);
    // Exactly one full-time marker, and it is the scoreline the report carries.
    const ftLines = report.narrative.filter(l => /^FT /.test(l));
    expect(ftLines).toHaveLength(1);
    expect(ftLines[0]).toBe(`FT ${report.home ? report.goalsFor : report.goalsAgainst}-${report.home ? report.goalsAgainst : report.goalsFor}.`);
  });

  it('plays the second half under the tactic picked at the break', async () => {
    await useGameStore.getState().playSundayFirstHalf();
    const chosen = otherTactic();
    const report = (await useGameStore.getState().finishSundayMatch(chosen))!;
    expect(report).not.toBeNull();
    // The change sticks: it is his tactic from now on, exactly as if he had
    // made it on the Tactics screen.
    expect(useGameStore.getState().sunday!.tactic).toBe(chosen);
    // And the second half really was simulated — there are events past 45.
    const events = useGameStore.getState().currentMatchResult!.events;
    expect(events.some(e => e.minute > 45)).toBe(true);
  });

  it('cannot be settled twice', async () => {
    await useGameStore.getState().playSundayFirstHalf();
    const first = await useGameStore.getState().finishSundayMatch();
    expect(first).not.toBeNull();
    const after = downstream();

    // Every second attempt is a no-op, whichever door it comes through.
    expect(await useGameStore.getState().finishSundayMatch()).toBeNull();
    expect(await useGameStore.getState().playSundayMatch()).toBeNull();
    const second = await useGameStore.getState().playSundayFirstHalf();
    expect(second.halfTime).toBeNull();
    expect(second.report).toBeNull();
    expect(downstream()).toEqual(after);
  });
});

describe('a restart at half time', () => {
  it('pins the first half and refuses to hand the decision back', async () => {
    const { halfTime } = await useGameStore.getState().playSundayFirstHalf();
    const shown = [...halfTime!.narrative];
    const scoreAtBreak = { f: halfTime!.goalsFor, a: halfTime!.goalsAgainst };
    const kickOffTactic = halfTime!.tactic;

    // The app is killed and reopened: same state, no live session.
    __resetSundayHalfTimeSessionForTests();

    const report = (await useGameStore.getState().finishSundayMatch(otherTactic()))!;
    expect(report).not.toBeNull();
    // The choice is gone — the requested change is ignored, so reloading is
    // strictly worse than playing on and there is nothing to farm.
    expect(useGameStore.getState().sunday!.tactic).toBe(kickOffTactic);
    // The first half itself cannot be re-rolled: it is on the pause, and the
    // finished report opens with exactly those lines.
    expect(report.narrative.slice(0, shown.length)).toEqual(shown);
    const htLine = shown.find(l => /^HT /.test(l))!;
    expect(htLine).toBe(
      `HT ${report.home ? scoreAtBreak.f : scoreAtBreak.a}-${report.home ? scoreAtBreak.a : scoreAtBreak.f}.`,
    );
    expect(check()).toEqual([]);
  });

  it('survives a save and load with the match still in flight', async () => {
    const { halfTime } = await useGameStore.getState().playSundayFirstHalf();
    const shown = [...halfTime!.narrative];
    useGameStore.getState().saveGame(1);
    useGameStore.getState().flushSave();

    useGameStore.getState().resetGame(2);
    expect(useGameStore.getState().loadGame(1)).toBe(true);
    __resetSundayHalfTimeSessionForTests();

    const loaded = useGameStore.getState().sunday!.halfTime!;
    expect(loaded).toBeTruthy();
    expect(loaded.narrative).toEqual(shown);
    expect(loaded.ringers.length).toBe(halfTime!.ringers.length);
    expect(loaded.engineState.events.length).toBe(halfTime!.engineState.events.length);

    const report = (await useGameStore.getState().finishSundayMatch())!;
    expect(report.narrative.slice(0, shown.length)).toEqual(shown);
    expect(useGameStore.getState().sunday!.halfTime).toBeNull();
    expect(check()).toEqual([]);
  });
});

describe('everything that is not a person', () => {
  it('advances the week atomically and leaves nothing paused', async () => {
    await useGameStore.getState().advanceWeek();
    const s = useGameStore.getState();
    expect(s.sunday!.halfTime).toBeNull();
    expect(s.sunday!.lastMatch).not.toBeNull();
    // The rest of the division never touches the engine — cheap model, no
    // events — and the split path has not changed that.
    const week1 = s.fixtures.filter(m => m.week === 1);
    const others = week1.filter(m => m.homeClubId !== s.playerClubId && m.awayClubId !== s.playerClubId);
    expect(others.length).toBeGreaterThan(0);
    for (const m of others) {
      expect(m.played, m.id).toBe(true);
      expect(m.events, m.id).toEqual([]);
    }
  });

  it('finishes a match left paused rather than advancing over it', async () => {
    const { halfTime } = await useGameStore.getState().playSundayFirstHalf();
    const kickOffTactic = halfTime!.tactic;
    await useGameStore.getState().advanceWeek();
    const s = useGameStore.getState();
    expect(s.sunday!.halfTime).toBeNull();
    expect(s.sunday!.lastMatch).not.toBeNull();
    expect(s.sunday!.lastMatch!.week).toBe(1);
    // The advance is not a person and does not make his decision for him.
    expect(s.sunday!.tactic).toBe(kickOffTactic);
    // Exactly one fixture of ours was played.
    const ours = s.fixtures.filter(m => m.played && (m.homeClubId === s.playerClubId || m.awayClubId === s.playerClubId));
    expect(ours).toHaveLength(1);
    expect(check()).toEqual([]);
  });
});
