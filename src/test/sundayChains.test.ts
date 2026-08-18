/**
 * Sunday League — the stories finish.
 *
 * A chain is only worth having if a started arc always reaches an ending. The
 * flag-based version it replaced did not: continuation was a weighted-draw
 * lottery inside a six-week flag life, so roughly a third of the stories the
 * mode began were never paid off, and the player was left holding a set-up.
 *
 * So these tests are about TERMINATION, not about text:
 *   - the opener starts exactly one chain, bound to the right man
 *   - the deadline forces the next beat out even when the draw never picks it
 *   - a beat is never about anybody except the man the chain named
 *   - a subject who leaves closes his story, out loud, in the week log
 *   - a chain survives a save/reload mid-story
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { SUNDAY_EVENTS } from '@/data/sundayEvents';
import { SUNDAY_CHAINS } from '@/config/sundayLeague';
import { assertSundayState, validateSundayState } from '@/utils/sunday/invariants';
import { sundaySeasonWeeks } from '@/utils/sunday/season';
import type { SundayChainId, SundayChainState, SundayState } from '@/types/game';

const SEED = 4242;

function state() {
  return useGameStore.getState();
}

function check() {
  const s = state();
  assertSundayState({
    sunday: s.sunday!, players: s.players, clubs: s.clubs,
    playerClubId: s.playerClubId, fixtures: s.fixtures, week: s.week,
  });
}

/** Patch the Sunday sub-state without going through an action. */
function patch(next: Partial<SundayState>) {
  useGameStore.setState({ sunday: { ...state().sunday!, ...next } });
}

/** Cool every definition down except the ones named, so the weighted draw has
 *  nothing else to offer. Chain beats ignore cooldowns by design. */
function isolate(...keep: string[]) {
  return Object.fromEntries(
    SUNDAY_EVENTS.filter(d => !keep.includes(d.id)).map(d => [d.id, 9999]),
  );
}

function liveChain(id: SundayChainId): SundayChainState | undefined {
  return state().sunday!.chains.find(c => c.id === id);
}

beforeEach(async () => {
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
});

describe('a chain opens', () => {
  it('binds the story to the man the opener was about, and only one story runs', async () => {
    const s0 = state();
    const victim = s0.sunday!.squad.find(m => m.availability.status !== 'out')!;
    patch({
      pendingEvent: {
        defId: 'rival-sniffing', season: s0.season, week: s0.week,
        title: 't', body: 'b', playerId: victim.playerId,
        choices: [{ id: 'ignore', label: 'i', hint: '' }],
        category: 'rivalry',
      },
    });
    await state().resolveSundayEvent('ignore');

    const chain = liveChain('rival-defection')!;
    expect(chain).toBeTruthy();
    expect(chain.subjectId).toBe(victim.playerId);
    expect(chain.step).toBe(2);
    expect(chain.dueWeek).toBeGreaterThan(chain.startedWeek);
    // The name is kept so the arc can be closed out loud after he has gone.
    expect(chain.data?.name).toBe(state().players[victim.playerId].firstName);
    expect(state().sunday!.chains).toHaveLength(1);
    check();
  });

  it('clamps the deadline inside the season it was started in', async () => {
    const s0 = state();
    const total = sundaySeasonWeeks(s0.sunday!.divisionId);
    const victim = s0.sunday!.squad.find(m => m.availability.status !== 'out')!;
    // Start it in the run-in, where the default four-week deadline would land
    // after the last Sunday and the rollover would delete the story unseen.
    useGameStore.setState({ week: total - 1 });
    patch({
      pendingEvent: {
        defId: 'rival-sniffing', season: s0.season, week: total - 1,
        title: 't', body: 'b', playerId: victim.playerId,
        choices: [{ id: 'ignore', label: 'i', hint: '' }],
        category: 'rivalry',
      },
    });
    await state().resolveSundayEvent('ignore');
    const chain = liveChain('rival-defection')!;
    // The last advance that can fire an event is `total - 1`; anything later
    // would be swept by the rollover before the player ever saw it.
    expect(chain.dueWeek).toBeLessThanOrEqual(total - 1);
    expect(chain.dueWeek).toBeLessThan(chain.startedWeek + SUNDAY_CHAINS[0].durationWeeks);
  });
});

describe('a chain always finishes', () => {
  it('forces the next beat out once the deadline passes, whatever the draw wants', async () => {
    const s0 = state();
    const victim = s0.sunday!.squad.find(m => m.availability.status !== 'out')!;
    patch({
      // Everything the weighted draw could offer is cooled down, and the
      // deadline is already behind us. Under the old scheme this is precisely
      // the state in which the story quietly died.
      eventCooldowns: isolate(),
      chains: [{
        id: 'rival-defection', step: 2, subjectId: victim.playerId,
        startedWeek: Math.max(1, s0.week - 5), startedSeason: s0.season,
        dueWeek: s0.week, data: { name: state().players[victim.playerId].firstName },
      }],
    });

    await state().advanceWeek();
    const pending = state().sunday!.pendingEvent;
    expect(pending, 'the overdue beat was not served').toBeTruthy();
    expect(pending!.defId).toBe('rival-bid');
    expect(pending!.playerId).toBe(victim.playerId);

    await state().resolveSundayEvent('promise');
    expect(liveChain('rival-defection')).toBeUndefined();
    check();
  });

  it('serves the beat even when the weekly event roll would have said no', async () => {
    // The forced pass runs before the 0.55 roll is consulted, so a chain never
    // waits on a coin flip. Driven over several weeks so the roll must fail at
    // least once.
    const s0 = state();
    const victim = s0.sunday!.squad.find(m => m.availability.status !== 'out')!;
    patch({
      eventCooldowns: isolate(),
      chains: [{
        id: 'rival-defection', step: 2, subjectId: victim.playerId,
        startedWeek: s0.week, startedSeason: s0.season, dueWeek: s0.week + 1, data: {},
      }],
    });
    let served = false;
    for (let i = 0; i < 4 && !served; i++) {
      await state().advanceWeek();
      const pending = state().sunday!.pendingEvent;
      if (pending) {
        expect(pending.defId).toBe('rival-bid');
        served = true;
      }
    }
    expect(served, 'the deadline came and went with no beat').toBe(true);
  });

  it('closes a story whose subject has walked out, and says so', async () => {
    const s0 = state();
    const victim = s0.sunday!.squad.find(m => m.availability.status !== 'out')!;
    const firstName = s0.players[victim.playerId].firstName;
    patch({
      chains: [{
        id: 'rival-defection', step: 2, subjectId: victim.playerId,
        startedWeek: s0.week, startedSeason: s0.season, dueWeek: s0.week + 3,
        data: { name: firstName },
      }],
    });
    const r = await state().releaseSundayPlayer(victim.playerId);
    expect(r.ok).toBe(true);
    expect(state().sunday!.chains).toHaveLength(0);
    expect(state().sunday!.weekLog.join(' ')).toContain(firstName);
    check();
  });

  it('never tells a beat about anybody except the man it named', async () => {
    const s0 = state();
    const [subject, other] = s0.sunday!.squad.filter(m => m.availability.status !== 'out');
    patch({
      eventCooldowns: isolate(),
      chains: [{
        id: 'rival-defection', step: 2, subjectId: subject.playerId,
        startedWeek: s0.week, startedSeason: s0.season, dueWeek: s0.week, data: {},
      }],
    });
    await state().advanceWeek();
    const pending = state().sunday!.pendingEvent!;
    expect(pending.playerId).toBe(subject.playerId);
    expect(pending.playerId).not.toBe(other.playerId);
  });

  it('does not let an unchained event be hijacked by a live story', async () => {
    // The bug this replaces: a live flag forced EVERY subject-bearing event to
    // be about the flagged man for as long as it lived.
    const s0 = state();
    const subject = s0.sunday!.squad.find(m => m.availability.status !== 'out')!;
    patch({
      // Only the wrong-boots comedy event is available, and it is not a beat.
      eventCooldowns: isolate('wrong-boots'),
      chains: [{
        id: 'rival-defection', step: 2, subjectId: subject.playerId,
        startedWeek: s0.week, startedSeason: s0.season, dueWeek: s0.week + 20, data: {},
      }],
    });
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const st = state();
      if (st.sunday!.seasonComplete || st.sunday!.folded) break;
      if (st.sunday!.pendingEvent) {
        if (st.sunday!.pendingEvent.playerId) seen.add(st.sunday!.pendingEvent.playerId);
        await st.resolveSundayEvent(st.sunday!.pendingEvent.choices[0].id);
      }
      await state().advanceWeek();
    }
    // Over eight weeks of a comedy event about a random squad member, the
    // chain's subject must not be the only name that ever comes up.
    expect(seen.size === 0 || !(seen.size === 1 && seen.has(subject.playerId))).toBe(true);
  });
});

describe('a chain survives the save', () => {
  it('reloads mid-story and continues from the same beat', async () => {
    const s0 = state();
    const victim = s0.sunday!.squad.find(m => m.availability.status !== 'out')!;
    patch({
      eventCooldowns: isolate(),
      chains: [{
        id: 'rival-defection', step: 2, subjectId: victim.playerId,
        startedWeek: s0.week, startedSeason: s0.season, dueWeek: s0.week + 1,
        data: { name: s0.players[victim.playerId].firstName },
      }],
    });
    state().saveGame(1);
    state().flushSave();
    useGameStore.setState({ sunday: null, gameMode: 'sandbox' });
    state().loadGame(1);

    const restored = liveChain('rival-defection');
    expect(restored).toBeTruthy();
    expect(restored!.subjectId).toBe(victim.playerId);
    expect(restored!.step).toBe(2);

    await state().advanceWeek();
    const pending = state().sunday!.pendingEvent!;
    expect(pending.defId).toBe('rival-bid');
    await state().resolveSundayEvent('release');
    expect(liveChain('rival-defection')).toBeUndefined();
    // Letting him go to them is the defection: the feud has a face now.
    expect(state().sunday!.rivalry!.defector).toBeTruthy();
    check();
  });

  it('is refused by the validator when it names somebody who is not here', () => {
    const s = state();
    const result = assertOrProblems({
      ...s.sunday!,
      chains: [{
        id: 'rival-defection' as const, step: 2, subjectId: 'sun-p-nobody',
        startedWeek: 1, startedSeason: 1, dueWeek: 4,
      }],
    });
    expect(result.join(' ')).toContain('not in the squad');
  });

  it('is refused by the validator when two stories of a kind are live', () => {
    const s = state();
    const victim = s.sunday!.squad[0].playerId;
    const info = SUNDAY_CHAINS[0];
    const result = assertOrProblems({
      ...s.sunday!,
      chains: [
        { id: info.id, step: 2, subjectId: victim, startedWeek: 1, startedSeason: 1, dueWeek: 4 },
        { id: info.id, step: 2, subjectId: victim, startedWeek: 1, startedSeason: 1, dueWeek: 4 },
      ],
    });
    expect(result.join(' ')).toContain('live twice');
  });
});

function assertOrProblems(sunday: SundayState): string[] {
  const s = state();
  return validateSundayState({
    sunday, players: s.players, clubs: s.clubs,
    playerClubId: s.playerClubId, fixtures: s.fixtures, week: s.week,
  }).problems;
}
