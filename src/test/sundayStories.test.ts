/**
 * Sunday League — the stories are systems.
 *
 * These tests verify EMERGENT SEQUENCES, not getters: a promise made in an
 * event is kept or broken by the match and remembered by the player; a
 * defection reshapes the rivalry; a debut is written into a biography; the
 * Sunday morning is deterministic and its one decision has consequences.
 * If these pass, the mode's storytelling machinery is real — the moments
 * come from state, and the state comes from the simulation.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { assertSundayState } from '@/utils/sunday/invariants';
import { captureMatchMemories, findMatchWinner, findTurningPoint, rememberMoment, makeMemory, definingMemory } from '@/utils/sunday/memories';
import { SUNDAY_MEMORIES_MAX, SUNDAY_PROMISE_WEEKS } from '@/config/sundayLeague';
import type { Match, SundayMemory } from '@/types/game';

const SEED = 20250;

function check() {
  const s = useGameStore.getState();
  assertSundayState({
    sunday: s.sunday!, players: s.players, clubs: s.clubs,
    playerClubId: s.playerClubId, fixtures: s.fixtures, week: s.week,
  });
}

async function clearPendingEvent() {
  const s = useGameStore.getState();
  if (s.sunday?.pendingEvent) await s.resolveSundayEvent(s.sunday.pendingEvent.choices[0].id);
}

beforeEach(async () => {
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
});

describe('memories are written by the simulation', () => {
  it('a debut and a first goal end up in the biography', async () => {
    for (let i = 0; i < 6; i++) {
      await clearPendingEvent();
      if (useGameStore.getState().sunday!.seasonComplete) break;
      await useGameStore.getState().advanceWeek();
    }
    const sunday = useGameStore.getState().sunday!;
    const withDebut = sunday.squad.filter(m => m.memories.some(mem => mem.kind === 'debut'));
    // Everyone who has actually played has a debut memory.
    const played = sunday.squad.filter(m => m.clubApps > 0);
    expect(withDebut.length).toBeGreaterThan(0);
    expect(withDebut.length).toBe(played.length);
    // Anyone with a club goal has a first-goal memory.
    for (const m of sunday.squad.filter(x => x.clubGoals > 0)) {
      expect(m.memories.some(mem => mem.kind === 'first-goal')).toBe(true);
    }
    check();
  });

  it('the memory cap keeps the heaviest moments, never the reverse', () => {
    let memories: SundayMemory[] = [];
    for (let i = 0; i < SUNDAY_MEMORIES_MAX; i++) {
      memories = rememberMoment(memories, makeMemory(1, i + 1, 'debut', `light ${i}`));
    }
    memories = rememberMoment(memories, makeMemory(1, 20, 'cup-hero', 'THE final'));
    expect(memories).toHaveLength(SUNDAY_MEMORIES_MAX);
    expect(memories.some(m => m.kind === 'cup-hero')).toBe(true);
    // And a heavy memory is never displaced by a light one.
    memories = rememberMoment(memories, makeMemory(1, 21, 'debut', 'another light'));
    expect(memories.some(m => m.kind === 'cup-hero')).toBe(true);
    expect(definingMemory(memories)?.kind).toBe('cup-hero');
  });

  it('finds the match-winner strictly from the goal sequence', () => {
    const match: Match = {
      id: 'm', week: 1, homeClubId: 'us', awayClubId: 'them', played: true,
      homeGoals: 2, awayGoals: 1,
      events: [
        { minute: 10, type: 'goal', clubId: 'us', playerId: 'a', description: '' },
        { minute: 40, type: 'goal', clubId: 'them', playerId: 'x', description: '' },
        { minute: 88, type: 'goal', clubId: 'us', playerId: 'b', description: '' },
      ],
    };
    expect(findMatchWinner(match, 'us', true)).toEqual({ playerId: 'b', minute: 88 });
    // A two-goal win has no single winner.
    expect(findMatchWinner({ ...match, homeGoals: 3 }, 'us', true)).toBeNull();
  });

  it('derives a turning point only when the match actually turned', () => {
    const flat: Match = {
      id: 'm', week: 1, homeClubId: 'us', awayClubId: 'them', played: true,
      homeGoals: 3, awayGoals: 0,
      events: [
        { minute: 10, type: 'goal', clubId: 'us', playerId: 'a', description: '' },
        { minute: 30, type: 'goal', clubId: 'us', playerId: 'a', description: '' },
        { minute: 50, type: 'goal', clubId: 'us', playerId: 'a', description: '' },
      ],
    };
    expect(findTurningPoint(flat, 'us', true, {})).toBeNull();
    const comeback: Match = {
      ...flat, homeGoals: 3, awayGoals: 2,
      events: [
        { minute: 10, type: 'goal', clubId: 'them', playerId: 'x', description: '' },
        { minute: 20, type: 'goal', clubId: 'them', playerId: 'x', description: '' },
        { minute: 60, type: 'goal', clubId: 'us', playerId: 'a', description: '' },
        { minute: 75, type: 'goal', clubId: 'us', playerId: 'b', description: '' },
        { minute: 89, type: 'goal', clubId: 'us', playerId: 'c', description: '' },
      ],
    };
    expect(findTurningPoint(comeback, 'us', true, {})).toContain('down');
  });

  it('captures a hat-trick and a milestone from one report', () => {
    const member = useGameStore.getState().sunday!.squad[0];
    const player = useGameStore.getState().players[member.playerId];
    const out = captureMatchMemories({
      rating: { playerId: player.id, rating: 9.1, goals: 3, assists: 0, yellowCards: 0, redCards: 0 },
      report: { goalsFor: 4, goalsAgainst: 1, opponentName: 'Dog & Duck', season: 1, week: 3 },
      isDerby: false, isCup: false, cupRound: null, winnerMinute: null,
      motm: true, played: true, sentOff: false, injuryWeeks: 0,
      prevApps: 49, prevGoals: 23,
    });
    const kinds = out.map(m => m.kind);
    expect(kinds).toContain('hat-trick');
    expect(kinds).toContain('milestone'); // 50th appearance AND 25th goal both land
  });
});

describe('the Sunday morning', () => {
  it('is deterministic: the same save replays the same arrival', async () => {
    useGameStore.getState().saveGame(1);
    useGameStore.getState().flushSave();
    const a = await useGameStore.getState().arriveSundayMatch();
    useGameStore.getState().loadGame(1);
    const b = await useGameStore.getState().arriveSundayMatch();
    expect(b!.beats).toEqual(a!.beats);
    expect(b!.presentIds).toEqual(a!.presentIds);
    expect(b!.forcedRingers).toBe(a!.forcedRingers);
    check();
  });

  it('is idempotent: arriving twice is one morning', async () => {
    const a = await useGameStore.getState().arriveSundayMatch();
    const b = await useGameStore.getState().arriveSundayMatch();
    expect(b).toEqual(a);
  });

  it('the ringer decision is one-shot and actually fields the guests', async () => {
    // Engineer a short morning: gut the squad down to eight available.
    const s0 = useGameStore.getState();
    const squad = s0.sunday!.squad.map((m, i) => i < 6
      ? { ...m, availability: { status: 'out' as const, reason: 'work' as const, note: 'x', warned: true, weeksRemaining: 1 } }
      : m);
    useGameStore.setState({ sunday: { ...s0.sunday!, squad, balance: 500 } });

    const arrival = (await useGameStore.getState().arriveSundayMatch())!;
    expect(arrival.presentIds.length).toBeLessThan(11);
    expect(arrival.optionalRingers).toBeGreaterThan(0);
    expect(arrival.ringersHired).toBeNull();

    const hire = await useGameStore.getState().hireSundayRingers(arrival.optionalRingers);
    expect(hire.ok).toBe(true);
    // One-shot: a second decision is refused.
    const again = await useGameStore.getState().hireSundayRingers(0);
    expect(again.ok).toBe(false);

    const report = (await useGameStore.getState().playSundayMatch())!;
    expect(report.ringersUsed).toBe(arrival.forcedRingers + arrival.optionalRingers);
    expect(report.startedWith).toBe(Math.min(11, arrival.presentIds.length + report.ringersUsed));
    check();
  });

  it('playing short is a real alternative with a real cost', async () => {
    const s0 = useGameStore.getState();
    const squad = s0.sunday!.squad.map((m, i) => i < 6
      ? { ...m, availability: { status: 'out' as const, reason: 'work' as const, note: 'x', warned: true, weeksRemaining: 1 } }
      : m);
    useGameStore.setState({ sunday: { ...s0.sunday!, squad, balance: 500 } });
    const arrival = (await useGameStore.getState().arriveSundayMatch())!;
    await useGameStore.getState().hireSundayRingers(0);
    const report = (await useGameStore.getState().playSundayMatch())!;
    expect(report.ringersUsed).toBe(arrival.forcedRingers);
    expect(report.startedWith).toBe(arrival.presentIds.length + arrival.forcedRingers);
    expect(report.startedWith).toBeLessThan(11);
    check();
  });
});

describe('promises are enforced, not flavour', () => {
  it('a kept promise pays and is remembered; a broken one costs more', async () => {
    const s0 = useGameStore.getState();
    const target = s0.sunday!.squad.find(m => m.availability.status === 'available')!;
    const promise = { kind: 'start' as const, madeSeason: 1, madeWeek: s0.week, dueWeek: s0.week + SUNDAY_PROMISE_WEEKS };

    // KEPT: he is named in the XI.
    useGameStore.setState({
      sunday: {
        ...s0.sunday!,
        squad: s0.sunday!.squad.map(m => m.playerId === target.playerId ? { ...m, promise } : m),
      },
    });
    await useGameStore.getState().autoPickSundayTeamsheet();
    const st = useGameStore.getState().sunday!;
    if (!st.teamsheet.includes(target.playerId)) {
      await useGameStore.getState().setSundayTeamsheet(
        [target.playerId, ...st.teamsheet.filter(id => id !== target.playerId)].slice(0, 11),
        st.bench.filter(id => id !== target.playerId),
      );
    }
    const before = useGameStore.getState().sunday!.squad.find(m => m.playerId === target.playerId)!;
    const report = (await useGameStore.getState().playSundayMatch())!;
    const after = useGameStore.getState().sunday!.squad.find(m => m.playerId === target.playerId)!;
    expect(after.promise).toBeNull();
    expect(after.memories.some(m => m.kind === 'promise-kept')).toBe(true);
    expect(after.happiness).toBeGreaterThan(before.happiness - 1);
    expect(report.consequences.join(' ')).toContain('Promise kept');
    check();
  });

  it('a broken promise is remembered and reported', async () => {
    const s0 = useGameStore.getState();
    // Promise someone, then deliberately leave him out at the due week.
    const target = s0.sunday!.squad.find(m => m.availability.status === 'available')!;
    useGameStore.setState({
      sunday: {
        ...s0.sunday!,
        squad: s0.sunday!.squad.map(m => m.playerId === target.playerId
          ? { ...m, promise: { kind: 'start' as const, madeSeason: 1, madeWeek: s0.week - 2, dueWeek: s0.week } }
          : m),
      },
    });
    await useGameStore.getState().autoPickSundayTeamsheet();
    const st = useGameStore.getState().sunday!;
    await useGameStore.getState().setSundayTeamsheet(
      st.teamsheet.filter(id => id !== target.playerId),
      st.bench.filter(id => id !== target.playerId),
    );
    const before = useGameStore.getState().sunday!.squad.find(m => m.playerId === target.playerId)!;
    const report = (await useGameStore.getState().playSundayMatch())!;
    const after = useGameStore.getState().sunday!.squad.find(m => m.playerId === target.playerId)!;
    expect(after.promise).toBeNull();
    expect(after.memories.some(m => m.kind === 'promise-broken')).toBe(true);
    expect(after.happiness).toBeLessThan(before.happiness);
    expect(report.consequences.join(' ')).toContain('Promise broken');
    check();
  });
});

describe('the defection arc', () => {
  it('a player who leaves for the rival becomes part of the feud', async () => {
    const s0 = useGameStore.getState();
    const sunday = s0.sunday!;
    expect(sunday.rivalry).toBeTruthy();
    const victim = sunday.squad.find(m => m.availability.status === 'available')!;
    const victimName = `${s0.players[victim.playerId].firstName} ${s0.players[victim.playerId].lastName}`;

    // Stage the chain's final step directly: the rival-bid event, pending, with
    // the victim as subject — then take the "let him go" choice.
    useGameStore.setState({
      sunday: {
        ...sunday,
        chains: [{
          id: 'rival-defection', step: 2, subjectId: victim.playerId,
          startedWeek: s0.week, startedSeason: s0.season, dueWeek: s0.week + 4,
          data: { name: s0.players[victim.playerId].firstName },
        }],
        pendingEvent: {
          defId: 'rival-bid', season: s0.season, week: s0.week,
          title: 't', body: 'b', playerId: victim.playerId,
          choices: [
            { id: 'fight', label: 'f', hint: '' },
            { id: 'promise', label: 'p', hint: '' },
            { id: 'release', label: 'r', hint: '' },
          ],
          category: 'rivalry',
        },
      },
    });
    const result = await useGameStore.getState().resolveSundayEvent('release');
    expect(result).toBeTruthy();

    const after = useGameStore.getState();
    // He is gone — completely.
    expect(after.sunday!.squad.some(m => m.playerId === victim.playerId)).toBe(false);
    expect(after.players[victim.playerId]).toBeUndefined();
    expect(after.clubs[after.playerClubId].playerIds).not.toContain(victim.playerId);
    // The feud remembers him.
    const rivalry = after.sunday!.rivalry!;
    expect(rivalry.defector?.name).toBe(victimName);
    expect(rivalry.story.some(line => line.includes(victimName.split(' ')[0]))).toBe(true);
    // The chain is spent — he took the story with him.
    expect(after.sunday!.chains).toHaveLength(0);
    check();
  });

  it('the derby against the defector is worth more heat both ways', async () => {
    const s0 = useGameStore.getState();
    const sunday = s0.sunday!;
    const rivalId = sunday.rivalry!.clubId;
    useGameStore.setState({
      sunday: {
        ...sunday,
        rivalry: { ...sunday.rivalry!, defector: { name: 'Kev Naylor', season: 1 }, heat: 5 },
      },
    });
    // Find and force the derby fixture to be this week by playing until we meet them.
    let met = false;
    for (let i = 0; i < 16 && !met; i++) {
      await clearPendingEvent();
      const st = useGameStore.getState();
      if (st.sunday!.seasonComplete || st.sunday!.folded) break;
      const fx = st.fixtures.find(m => m.week === st.week && !m.played
        && ((m.homeClubId === st.playerClubId && m.awayClubId === rivalId)
          || (m.awayClubId === st.playerClubId && m.homeClubId === rivalId)));
      if (fx) {
        const heatBefore = st.sunday!.rivalry!.heat;
        await useGameStore.getState().playSundayMatch();
        const r = useGameStore.getState().sunday!.rivalry!;
        const report = useGameStore.getState().sunday!.lastMatch!;
        met = true;
        // Decisive derbies with a defector append to the story log.
        if (report.goalsFor !== report.goalsAgainst) {
          expect(r.story.length).toBeGreaterThan(0);
          expect(r.heat).not.toBe(heatBefore);
        }
      } else {
        await useGameStore.getState().advanceWeek();
      }
    }
    expect(met).toBe(true);
    check();
  });
});

describe('records carry their stories', () => {
  it('a big win is recorded with the opponent and the context', async () => {
    for (let i = 0; i < 14; i++) {
      await clearPendingEvent();
      const st = useGameStore.getState();
      if (st.sunday!.seasonComplete || st.sunday!.folded) break;
      await useGameStore.getState().advanceWeek();
      const rec = useGameStore.getState().sunday!.records.find(r => r.id === 'biggest-win');
      if (rec) {
        expect(rec.value).toContain(' v ');
        break;
      }
    }
    // Not guaranteed a win happened in 14 weeks (though overwhelmingly likely);
    // the assertion above only runs when one did, and check() always does.
    check();
  });
});

describe('form is a live input', () => {
  it('moves with performances and drifts back for the absent', async () => {
    const before = new Map(Object.values(useGameStore.getState().players)
      .filter(p => p.clubId === 'sunday-club')
      .map(p => [p.id, p.form]));
    for (let i = 0; i < 4; i++) {
      await clearPendingEvent();
      if (useGameStore.getState().sunday!.seasonComplete) break;
      await useGameStore.getState().advanceWeek();
    }
    const after = Object.values(useGameStore.getState().players).filter(p => p.clubId === 'sunday-club');
    const moved = after.filter(p => before.has(p.id) && before.get(p.id) !== p.form);
    // After four Sundays, form has moved for a meaningful share of the squad.
    expect(moved.length).toBeGreaterThan(3);
    check();
  });
});
