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
import { SUNDAY_EVENTS, type SundayEventContext, type SundayEventPerson } from '@/data/sundayEvents';
import { SUNDAY_CHAINS } from '@/config/sundayLeague';
import { assertSundayState, validateSundayState } from '@/utils/sunday/invariants';
import { sundaySeasonWeeks } from '@/utils/sunday/season';
import { pickSundayEvent } from '@/utils/sunday/events';
import { createSundayRng } from '@/utils/sunday/rng';
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

  it('does not let an unchained event be hijacked by a live story', () => {
    // THE BUG THIS REPLACES. A live `wants-out:` flag forced every
    // subject-bearing event in the catalogue to be about the flagged man for as
    // long as the flag lived — up to six weeks in which the goalkeeper, the
    // comedy boots and the ex-pro's lecture were all the same person.
    //
    // Driven through the selector rather than the store so the assertion is
    // about the selection rule and not about which week the draw landed on.
    const people: SundayEventPerson[] = ['a', 'b', 'c'].map((id, i) => ({
      playerId: id, firstName: `P${i}`, lastName: 'X', job: 'sparky',
      archetype: 'journeyman', position: 'CM', age: 27, clubApps: 10, available: true,
      happiness: 50, ego: 10, commitment: 12, temper: 10, influence: 10,
      overall: 45, benchedStreak: 0,
    }));
    const ctx: SundayEventContext = {
      season: 1, week: 8, balance: 300, reputation: 20, teamMorale: 60,
      squadSize: 3, selectableCount: 3, lastResult: 0, winless: 0, winStreak: 0,
      leaguePosition: 4, leagueSize: 8, hasRival: true, rivalHeat: 5, hasSponsor: false,
      hasFixture: true,
      subsOwed: 0, weeksInDebt: 0, cupAlive: false, cupRoundsWon: 0, cupRoundName: null,
      captain: null, subject: null, unhappy: null, flags: {},
      chains: [{
        id: 'rival-defection', step: 2, subjectId: 'a',
        startedWeek: 4, startedSeason: 1, dueWeek: 40,
      }],
      playerStoryLive: true, clubStoryLive: false, chainData: {}, defectorName: null,
      hasNets: false,
    };
    const cooldowns = isolate('wrong-boots');
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const ev = pickSundayEvent({
        rng: createSundayRng(i * 31 + 7, 0), ctx, subjects: people,
        cooldowns, firedOnce: new Set(), week: 8, rivalName: 'them', clubName: 'us',
      });
      if (ev?.playerId) seen.add(ev.playerId);
    }
    expect(seen.size, 'the unchained event only ever named one man').toBeGreaterThan(1);
  });
});

describe('every chain runs end to end', () => {
  /**
   * Drive one chain from its live state to its ending, taking the choice named
   * (or the first) at each beat, and assert it terminates.
   *
   * Deliberately generic: the point is not what any individual beat says, it is
   * that no configured chain can be started and then left hanging — which is
   * exactly what the flag scheme allowed.
   */
  async function runChain(chain: SundayChainState, picks: Record<string, string> = {}) {
    patch({ eventCooldowns: isolate(), chains: [chain] });
    const beats: string[] = [];
    for (let i = 0; i < 8; i++) {
      const st = state();
      if (st.sunday!.seasonComplete || st.sunday!.folded) break;
      if (!st.sunday!.chains.length) break;
      await state().advanceWeek();
      const pending = state().sunday!.pendingEvent;
      if (!pending) continue;
      beats.push(pending.defId);
      const choice = pending.choices.find(c => c.id === picks[pending.defId]) ?? pending.choices[0];
      await state().resolveSundayEvent(choice.id);
    }
    return beats;
  }

  const subjectOf = () => state().sunday!.squad.find(m => m.availability.status !== 'out')!.playerId;

  it('captain-conflict reaches a fallout beat and ends', async () => {
    const s0 = state();
    const id = s0.sunday!.captainId!;
    const beats = await runChain(
      {
        id: 'captain-conflict', step: 2, subjectId: id,
        startedWeek: s0.week, startedSeason: s0.season, dueWeek: s0.week, data: {},
      },
      { 'captain-showdown': 'strip' },
    );
    expect(beats).toContain('captain-showdown');
    expect(beats).toContain('captain-stripped-fallout');
    // The armband actually moved, and it did not vanish.
    expect(state().sunday!.captainId).not.toBe(id);
    expect(state().sunday!.captainId).toBeTruthy();
    expect(state().sunday!.chains).toHaveLength(0);
    check();
  });

  it('star-arc ends at the offer, and what you gave him is remembered', async () => {
    const s0 = state();
    const beats = await runChain(
      {
        id: 'star-arc', step: 2, subjectId: subjectOf(),
        startedWeek: s0.week, startedSeason: s0.season, dueWeek: s0.week, data: { gave: 'nothing' },
      },
      { 'star-demands': 'armband', 'better-offer': 'let-go' },
    );
    expect(beats).toContain('star-demands');
    expect(beats).toContain('better-offer');
    expect(state().sunday!.chains).toHaveLength(0);
    check();
  });

  it('wonderkid ends with the scout, either way', async () => {
    const s0 = state();
    const beats = await runChain(
      {
        id: 'wonderkid', step: 2, subjectId: subjectOf(),
        startedWeek: s0.week, startedSeason: s0.season, dueWeek: s0.week, data: {},
      },
      { 'wonderkid-first-start': 'start', 'wonderkid-scouted': 'keep' },
    );
    expect(beats).toContain('wonderkid-first-start');
    expect(beats).toContain('wonderkid-scouted');
    expect(state().sunday!.chains).toHaveLength(0);
    check();
  });

  it('veteran-farewell writes a heavy memory on the man it was about', async () => {
    const s0 = state();
    const id = subjectOf();
    const beats = await runChain(
      {
        id: 'veteran-farewell', step: 2, subjectId: id,
        startedWeek: s0.week, startedSeason: s0.season, dueWeek: s0.week, data: {},
      },
      { 'veteran-decision': 'again', 'veteran-last-season': 'coach' },
    );
    expect(beats).toContain('veteran-decision');
    expect(beats).toContain('veteran-last-season');
    const member = state().sunday!.squad.find(m => m.playerId === id);
    // He stayed, so the moment is his to carry — the squad screen, the season
    // retrospective and the legend citation all read this list.
    expect(member?.memories.some(mem => mem.text.includes('last season'))).toBe(true);
    expect(state().sunday!.chains).toHaveLength(0);
    check();
  });

  it('financial-crisis pushes the club\'s own fold clock, not a second one', async () => {
    const s0 = state();
    // Deep in the red and staying there, so the verdict beat is the grim one.
    patch({ balance: -120, weeksInDebt: 3 });
    const before = state().sunday!.weeksInDebt;
    const beats = await runChain(
      {
        id: 'financial-crisis', step: 2, subjectId: null,
        startedWeek: s0.week, startedSeason: s0.season, dueWeek: s0.week, data: { standing: 'watched' },
      },
      { 'crisis-sacrifice': 'beg', 'crisis-deepens': 'accept' },
    );
    expect(beats).toContain('crisis-sacrifice');
    // THE STORY ENDS ONE OF TWO WAYS, and both of them are the same clock.
    //
    // Either a verdict beat fires, or the club runs out of weeks and folds —
    // which IS the financial crisis reaching its conclusion, and is exactly
    // what "pushes the club's own fold clock, not a second one" means. The
    // failure this guards against is the third outcome: a live club with the
    // chain still open and no verdict in sight.
    //
    // Asserting the verdict alone was a timing assumption, not an invariant.
    // A chain beat resets its own deadline to `durationWeeks` ahead, so the
    // two Sundays in between are open to the ordinary event draw; when one of
    // them takes the slot the verdict lands a week later than the fold clock
    // does. It held until the wave-5 economy pass shifted the weekly stream
    // (availability decides how many men play, and every player who plays
    // takes a subs draw), and then it flaked one run in three.
    const folded = state().sunday!.folded;
    const verdict = beats.some(b => b === 'crisis-deepens' || b === 'crisis-survived');
    expect(folded || verdict, `beats=${beats.join(',')}`).toBe(true);
    if (beats.includes('crisis-deepens')) {
      expect(state().sunday!.weeksInDebt).toBeGreaterThan(before);
    }
    if (!folded) expect(state().sunday!.chains).toHaveLength(0);
  });

  it('cup-run never tells the club about a tie it is not in', async () => {
    const s0 = state();
    // Out of the cup entirely: every tie played, none of them ours to come.
    patch({
      cup: s0.sunday!.cup
        ? { ...s0.sunday!.cup, eliminated: true }
        : null,
      eventCooldowns: isolate(),
      chains: [{
        id: 'cup-run', step: 2, subjectId: null,
        startedWeek: s0.week, startedSeason: s0.season, dueWeek: s0.week, data: { mood: 'loud' },
      }],
    });
    await state().advanceWeek();
    const pending = state().sunday!.pendingEvent;
    // The pressure beat's premise is false, so the forced pass skips to the
    // aftermath rather than announcing a semi-final that is not happening.
    expect(pending?.defId).not.toBe('cup-pressure');
    expect(pending?.defId).not.toBe('cup-still-standing');
    if (pending) {
      expect(pending.defId).toBe('cup-knocked-out');
      await state().resolveSundayEvent(pending.choices[pending.choices.length - 1].id);
    }
    expect(state().sunday!.chains).toHaveLength(0);
    check();
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
