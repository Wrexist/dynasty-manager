/**
 * Sunday League — boot and the weekly loop.
 *
 * These are the load-bearing assertions: a new save is valid, a week can be
 * advanced without producing an impossible state, and a full season reaches its
 * end and rolls over. Everything else in the mode is built on top of this.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { assertSundayState, validateSundayState } from '@/utils/sunday/invariants';
import { sundaySeasonWeeks } from '@/utils/sunday/season';
import { SUNDAY_MEMORIES_MAX, SUNDAY_MIN_START } from '@/config/sundayLeague';

const SEED = 12345;

function check() {
  const s = useGameStore.getState();
  assertSundayState({
    sunday: s.sunday!,
    players: s.players,
    clubs: s.clubs,
    playerClubId: s.playerClubId,
    fixtures: s.fixtures,
    week: s.week,
  });
}

beforeEach(async () => {
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
});

describe('startSundayLeague', () => {
  it('boots a complete, valid save', () => {
    const s = useGameStore.getState();
    expect(s.gameMode).toBe('sunday');
    expect(s.gameStarted).toBe(true);
    expect(s.season).toBe(1);
    expect(s.week).toBe(1);
    expect(s.sunday).toBeTruthy();
    expect(s.clubs[s.playerClubId]).toBeTruthy();
    expect(s.sunday!.squad.length).toBeGreaterThanOrEqual(12);
    expect(s.currentScreen).toBe('sunday-hub');
    check();
  });

  it('puts the player in the bottom division with a full fixture list', () => {
    const s = useGameStore.getState();
    expect(s.sunday!.divisionId).toBe('sun-4');
    expect(s.sunday!.divisionClubIds).toHaveLength(8);
    // Double round-robin: every club plays every other twice.
    expect(s.fixtures).toHaveLength(8 * 7);
    const mine = s.fixtures.filter(m => m.homeClubId === s.playerClubId || m.awayClubId === s.playerClubId);
    expect(mine).toHaveLength(14);
  });

  it('draws an eight-club cup with the player in it', () => {
    const cup = useGameStore.getState().sunday!.cup!;
    expect(cup.entrants).toHaveLength(8);
    expect(cup.entrants).toContain(useGameStore.getState().playerClubId);
    expect(cup.ties.filter(t => t.round === 1)).toHaveLength(4);
  });

  it('is reproducible from its seed', async () => {
    const a = useGameStore.getState().sunday!;
    const namesA = a.squad.map(m => useGameStore.getState().players[m.playerId].lastName).join(',');
    useGameStore.getState().resetGame();
    await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
    const b = useGameStore.getState().sunday!;
    const namesB = b.squad.map(m => useGameStore.getState().players[m.playerId].lastName).join(',');
    expect(namesB).toBe(namesA);
    expect(b.identity.name).toBe(a.identity.name);
  });

  it('produces different worlds from different seeds', async () => {
    const snapshot = () => {
      const s = useGameStore.getState();
      return {
        identity: s.sunday!.identity.name,
        squad: s.sunday!.squad
          .map(m => `${s.players[m.playerId].firstName} ${s.players[m.playerId].lastName}`)
          .join(','),
        opponents: s.sunday!.divisionClubIds.map(id => s.clubs[id].name).join(','),
      };
    };
    const a = snapshot();
    useGameStore.getState().resetGame();
    await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED + 1 });
    const b = snapshot();
    // Any single field could collide by chance; a whole squad and a whole
    // division cannot. The old version of this test asserted `typeof` on two
    // strings and passed no matter what the generator did.
    expect(b.squad).not.toBe(a.squad);
    expect(b.opponents).not.toBe(a.opponents);
    expect(b.identity).not.toBe(a.identity);
  });
});

describe('the weekly loop', () => {
  it('advances a week and leaves a valid state', async () => {
    const before = useGameStore.getState().week;
    await useGameStore.getState().advanceWeek();
    expect(useGameStore.getState().week).toBe(before + 1);
    check();
  });

  it('plays the fixture when the manager does not', async () => {
    await useGameStore.getState().advanceWeek();
    const s = useGameStore.getState();
    const played = s.fixtures.filter(m => m.week === 1 && m.played);
    expect(played.length).toBeGreaterThan(0);
    expect(s.sunday!.lastMatch).toBeTruthy();
    expect(s.sunday!.lastMatch!.week).toBe(1);
  });

  it('never fields fewer than the legal minimum', async () => {
    for (let i = 0; i < 14; i++) {
      const s = useGameStore.getState();
      if (s.sunday!.pendingEvent) await s.resolveSundayEvent(s.sunday!.pendingEvent.choices[0].id);
      await useGameStore.getState().advanceWeek();
      const report = useGameStore.getState().sunday!.lastMatch;
      if (report && !report.forfeited) {
        expect(report.startedWith).toBeGreaterThanOrEqual(SUNDAY_MIN_START);
      }
      check();
    }
  });

  it('reaches the end of the season and can roll over', async () => {
    const total = sundaySeasonWeeks('sun-4');
    for (let i = 0; i < total + 2; i++) {
      const s = useGameStore.getState();
      if (s.sunday!.pendingEvent) await s.resolveSundayEvent(s.sunday!.pendingEvent.choices[0].id);
      if (s.sunday!.seasonComplete || s.sunday!.folded) break;
      await useGameStore.getState().advanceWeek();
    }
    const s = useGameStore.getState();
    if (s.sunday!.folded) return; // a folded club is a legitimate outcome
    expect(s.sunday!.seasonComplete).toBe(true);
    // Every league fixture must have been played.
    expect(s.fixtures.every(m => m.played)).toBe(true);

    await useGameStore.getState().endSundaySeason();
    const after = useGameStore.getState();
    expect(after.season).toBe(2);
    expect(after.week).toBe(1);
    expect(after.sunday!.history).toHaveLength(1);
    expect(after.sunday!.seasonComplete).toBe(false);
    expect(after.fixtures.every(m => !m.played)).toBe(true);
    check();
  });

  it('blocks the week while an event is unanswered', async () => {
    // Force a pending event by advancing until one appears.
    for (let i = 0; i < 12; i++) {
      if (useGameStore.getState().sunday!.pendingEvent) break;
      await useGameStore.getState().advanceWeek();
    }
    const s = useGameStore.getState();
    if (!s.sunday!.pendingEvent) return; // no event fired in 12 weeks; nothing to assert
    const weekBefore = s.week;
    await useGameStore.getState().advanceWeek();
    expect(useGameStore.getState().week).toBe(weekBefore);
    await useGameStore.getState().resolveSundayEvent(s.sunday!.pendingEvent!.choices[0].id);
    expect(useGameStore.getState().sunday!.pendingEvent).toBeNull();
    await useGameStore.getState().advanceWeek();
    expect(useGameStore.getState().week).toBe(weekBefore + 1);
  });
});

describe('validateSundayState', () => {
  it('catches a player who is on two teams', () => {
    const s = useGameStore.getState();
    const id = s.sunday!.squad[0].playerId;
    const result = validateSundayState({
      sunday: s.sunday!,
      players: { ...s.players, [id]: { ...s.players[id], clubId: 'somewhere-else' } },
      clubs: s.clubs,
      playerClubId: s.playerClubId,
      fixtures: s.fixtures,
      week: s.week,
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toContain('clubId');
  });

  it('catches a memory list over the real cap, not a guessed one', () => {
    // The check said `> 20` while `rememberMoment` trims at
    // SUNDAY_MEMORIES_MAX (12), so eight units of overflow were invisible to
    // the one thing that looks. A hardcoded balance value at a call site, and
    // a validator with slack in it.
    const s = useGameStore.getState();
    const member = s.sunday!.squad[0];
    const overflowing = Array.from({ length: SUNDAY_MEMORIES_MAX + 1 }, (_, i) => ({
      season: 1, week: i + 1, kind: 'motm' as const, text: `memory ${i}`, weight: 5,
    }));
    const result = validateSundayState({
      sunday: {
        ...s.sunday!,
        squad: s.sunday!.squad.map(m =>
          (m.playerId === member.playerId ? { ...m, memories: overflowing } : m)),
      },
      players: s.players,
      clubs: s.clubs,
      playerClubId: s.playerClubId,
      fixtures: s.fixtures,
      week: s.week,
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toContain('memories unbounded');
  });

  it('catches two results for one fixture pairing in a week', () => {
    const s = useGameStore.getState();
    const first = s.fixtures[0];
    const result = validateSundayState({
      sunday: s.sunday!,
      players: s.players,
      clubs: s.clubs,
      playerClubId: s.playerClubId,
      fixtures: [...s.fixtures, { ...first, id: `${first.id}-dupe` }],
      week: s.week,
    });
    expect(result.ok).toBe(false);
  });
});
