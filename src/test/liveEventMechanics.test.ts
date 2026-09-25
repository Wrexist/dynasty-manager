/**
 * Live events with their own mechanics.
 *
 * Every event used to be "check in + win" for XP, whatever its name promised:
 * "Deal season", "Chase the goals" and "Derby season" all paid for exactly the
 * same things. Events now declare mechanics in config (like the existing
 * `derbyWinMultiplier`): draws, clean sheets, goals, academy graduates who
 * play, completed signings. These tests pin the maths, the caps, the two game
 * hooks (match processing and signings), and that no tagline promises a
 * mechanic its event does not declare.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import {
  matchPointsFor, applyMatchResult, applySigning, awardFestivalMatchResult, getEventBonuses,
  freshProgress, getActiveLiveEvent, readActiveFestivalProgress,
} from '@/utils/liveEvents';
import {
  SPECIAL_EVENTS, generateMonthlyEvent, MATCH_WIN_POINTS_DAILY_CAP, GOAL_POINTS_MAX_PER_MATCH,
  ACADEMY_APPEARANCES_MAX_PER_MATCH, SIGNING_POINTS_DAILY_CAP, type LiveEvent,
} from '@/config/liveEvents';
import { useGameStore } from '@/store/gameStore';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import { tick } from './helpers/eventLoop';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);
const base: LiveEvent = {
  id: 't', name: 'T', tagline: '', start: '2000-01-01', end: '2100-01-01',
  checkInPoints: 10, matchWinPoints: 5, tiers: [],
};
const loss = { won: false, drawn: false, goalsFor: 0, goalsAgainst: 2 };

describe('match mechanics', () => {
  it('a plain event pays for wins only, as before', () => {
    expect(matchPointsFor(base, { won: true, drawn: false, goalsFor: 3, goalsAgainst: 0, academyAppearances: 3 })).toBe(5);
    expect(matchPointsFor(base, { won: false, drawn: true, goalsFor: 1, goalsAgainst: 1 })).toBe(0);
  });

  it('draws, clean sheets, goals and academy graduates pay only where declared', () => {
    expect(matchPointsFor({ ...base, drawPoints: 2 }, { won: false, drawn: true, goalsFor: 1, goalsAgainst: 1 })).toBe(2);
    expect(matchPointsFor({ ...base, cleanSheetPoints: 3 }, { won: false, drawn: true, goalsFor: 0, goalsAgainst: 0 })).toBe(3);
    expect(matchPointsFor({ ...base, cleanSheetPoints: 3 }, { won: true, drawn: false, goalsFor: 1, goalsAgainst: 0 })).toBe(8);
    expect(matchPointsFor({ ...base, goalPoints: 1 }, { ...loss, goalsFor: 2 })).toBe(2);
    expect(matchPointsFor({ ...base, academyAppearancePoints: 2 }, { ...loss, academyAppearances: 2 })).toBe(4);
  });

  it('caps goals and academy graduates per match', () => {
    expect(matchPointsFor({ ...base, goalPoints: 1 }, { ...loss, goalsFor: 9 })).toBe(GOAL_POINTS_MAX_PER_MATCH);
    expect(matchPointsFor({ ...base, academyAppearancePoints: 2 }, { ...loss, academyAppearances: 8 }))
      .toBe(2 * ACADEMY_APPEARANCES_MAX_PER_MATCH);
  });

  it('the derby multiplier still applies to the win part only', () => {
    const ev = { ...base, derbyWinMultiplier: 2, cleanSheetPoints: 3 };
    expect(matchPointsFor(ev, { won: true, drawn: false, isDerby: true, goalsFor: 1, goalsAgainst: 0 })).toBe(13);
  });

  it('a match that earns nothing does not use one of the day\'s awards', () => {
    const ev = { ...base, drawPoints: 2 };
    let p = freshProgress(ev);
    p = applyMatchResult(p, ev, loss, at(2030, 1, 1));
    expect(p.matchWinCount ?? 0).toBe(0);
    for (let i = 0; i < MATCH_WIN_POINTS_DAILY_CAP + 2; i++) {
      p = applyMatchResult(p, ev, { won: false, drawn: true, goalsFor: 0, goalsAgainst: 0 }, at(2030, 1, 1));
    }
    expect(p.points).toBe(2 * MATCH_WIN_POINTS_DAILY_CAP);
  });
});

describe('signing mechanic', () => {
  it('pays per signing, capped per day, and resets the next day', () => {
    const ev = { ...base, signingPoints: 10 };
    let p = freshProgress(ev);
    for (let i = 0; i < SIGNING_POINTS_DAILY_CAP + 3; i++) p = applySigning(p, ev, at(2030, 1, 1));
    expect(p.points).toBe(10 * SIGNING_POINTS_DAILY_CAP);
    p = applySigning(p, ev, at(2030, 1, 2));
    expect(p.points).toBe(10 * (SIGNING_POINTS_DAILY_CAP + 1));
  });

  it('is a no-op in an event without signing points', () => {
    const p = freshProgress(base);
    expect(applySigning(p, base, at(2030, 1, 1))).toBe(p);
  });
});

describe('event roster', () => {
  const months = Array.from({ length: 12 }, (_, i) => generateMonthlyEvent(new Date(2027, i, 10)));
  const all = [...SPECIAL_EVENTS, ...months];

  /** A tagline that names a mechanic must belong to an event that declares it. */
  const PROMISES: [RegExp, (e: LiveEvent) => boolean][] = [
    [/derby/i, e => (e.derbyWinMultiplier ?? 1) > 1],
    [/\bdraws?\b|unbeaten/i, e => !!e.drawPoints],
    [/clean sheet/i, e => !!e.cleanSheetPoints],
    [/\bgoals?\b/i, e => !!e.goalPoints],
    [/academy/i, e => !!e.academyAppearancePoints],
    [/\bdeal\b|signing/i, e => !!e.signingPoints],
  ];

  it('no tagline promises a mechanic its event does not declare', () => {
    for (const e of all) {
      for (const [re, declares] of PROMISES) {
        if (re.test(e.tagline)) expect(declares(e), `${e.id}: "${e.tagline}"`).toBe(true);
      }
    }
  });

  it('every declared mechanic is named in the tagline and listed in the hub', () => {
    for (const e of all) {
      for (const bonus of getEventBonuses(e)) {
        const re = { derby: /derby/i, draw: /draw|unbeaten/i, cleanSheet: /clean sheet/i, goal: /goal/i, academy: /academy/i, signing: /signing/i }[bonus.kind];
        expect(re.test(e.tagline), `${e.id} declares ${bonus.kind} but its tagline does not say so`).toBe(true);
      }
    }
  });

  it('upcoming events play differently from one another', () => {
    const upcoming = SPECIAL_EVENTS.filter(e => e.start > '2026-09-25');
    const signatures = new Set(upcoming.map(e => getEventBonuses(e).map(b => b.kind).join('+')));
    expect(signatures.size).toBe(upcoming.length);
    const kinds = new Set(all.flatMap(e => getEventBonuses(e).map(b => b.kind)));
    for (const k of ['derby', 'draw', 'cleanSheet', 'goal', 'academy', 'signing']) expect(kinds).toContain(k);
  });
});

describe('game hooks', () => {
  beforeAll(async () => {
    __resetAutosaveSchedulerForTests();
    __resetSaveStorageForTests();
    localStorage.clear();
    await useGameStore.getState().initGame('manchester-city');
  }, 60_000);
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('awardFestivalMatchResult credits the live event (Run-In clean sheet)', () => {
    const now = at(2027, 4, 20);
    const ev = getActiveLiveEvent(now);
    expect(ev.id).toBe('run-in-2027');
    awardFestivalMatchResult({ won: false, drawn: true, goalsFor: 0, goalsAgainst: 0 }, now);
    expect(readActiveFestivalProgress(ev).points).toBe(ev.cleanSheetPoints);
  });

  it('a played match pays the Golden Boot goal bonus', { timeout: 60_000 }, async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at(2026, 10, 5));
    const ev = getActiveLiveEvent();
    expect(ev.goalPoints).toBeGreaterThan(0);
    for (let w = 0; w < 6; w++) {
      localStorage.clear();
      await useGameStore.getState().advanceWeek();
      const match = useGameStore.getState().playCurrentMatch();
      await tick();
      if (!match) continue;
      const me = useGameStore.getState().playerClubId;
      const home = match.homeClubId === me;
      const goalsFor = home ? match.homeGoals : match.awayGoals;
      const goalsAgainst = home ? match.awayGoals : match.homeGoals;
      const expected = matchPointsFor(ev, {
        won: goalsFor > goalsAgainst, drawn: goalsFor === goalsAgainst, goalsFor, goalsAgainst,
      });
      expect(readActiveFestivalProgress(ev).points).toBe(expected);
      if (goalsFor > 0) return; // the goal bonus was exercised
    }
    throw new Error('no goal scored in six matches — widen the loop');
  });

  it('completing a free-agent signing pays in a signing event', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at(2027, 1, 25));
    const ev = getActiveLiveEvent();
    expect(ev.id).toBe('winter-window-2027');
    const st = useGameStore.getState();
    const club = st.clubs[st.playerClubId];
    // Make room and money, then sign the cheapest free agent at his asking wage.
    useGameStore.setState({ clubs: { ...st.clubs, [club.id]: { ...club, budget: 1e9, playerIds: club.playerIds.slice(0, 20) } } });
    const agentId = [...st.freeAgents].sort((a, b) => st.players[a].overall - st.players[b].overall)[0];
    vi.spyOn(Math, 'random').mockReturnValue(0); // accept the terms
    const res = useGameStore.getState().signFreeAgent(agentId, st.players[agentId].wage * 2, 2);
    expect(res.success).toBe(true);
    expect(readActiveFestivalProgress(ev).points).toBe(ev.signingPoints);
  });
});
