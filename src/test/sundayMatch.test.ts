/**
 * Match day — short sides, guests, forfeits, and the promises the narrative
 * makes.
 *
 * The narrative assertions matter as much as the mechanical ones: the mode
 * generates prose from an event stream, and prose that contradicts the
 * scoreline is a bug the player WILL notice.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { assertSundayState } from '@/utils/sunday/invariants';
import { SUNDAY_MAX_RINGERS, SUNDAY_MIN_START, SUNDAY_FULL_XI } from '@/config/sundayLeague';
import { isSundayRinger } from '@/utils/sunday/generation';
import {
  bestSundayTactic, buildMatchdayTeam, buildSundayNarrative, pitchConditionFor,
  sundayStyleOf, sundayTacticFit,
} from '@/utils/sunday/match';
import {
  SUNDAY_CONCEDED_DERBY_LINES, SUNDAY_CONCEDED_LATE_LINES, SUNDAY_CONCEDED_LINES,
} from '@/data/sundayNames';
import { deriveSundayStakes } from '@/utils/sunday/tier';
import { sundayMilestoneToday, sundayReverseFixtureRecall } from '@/utils/sunday/briefing';
import { sundayCupRoundName } from '@/utils/sunday/season';
import { SUNDAY_CUP_ROUNDS } from '@/config/sundayLeague';
import { createSundayRng } from '@/utils/sunday/rng';
import { SUNDAY_MEMORY_LEGENDARY_WEIGHT, SUNDAY_NARRATIVE_COLOUR_MAX } from '@/config/sundayLeague';
import { captureMatchMemories } from '@/utils/sunday/memories';
import type { LeagueTableEntry, Match, MatchEvent, Player, SundaySquadMember } from '@/types/game';

const SEED = 4242;

/** A throwaway Player, for narrative assertions that only need a name. */
function mkPlayer(id: string, firstName: string, over: Partial<Player> = {}): Player {
  return {
    id, firstName, lastName: 'X', age: 25, nationality: 'England', position: 'ST',
    attributes: { pace: 40, shooting: 40, passing: 40, defending: 40, physical: 40, mental: 40 },
    overall: 40, potential: 40, clubId: 'us', wage: 0, value: 0, contractEnd: 99,
    fitness: 100, morale: 60, form: 60, injured: false, injuryWeeks: 0,
    goals: 0, assists: 0, appearances: 0, careerGoals: 0, careerAssists: 0,
    careerAppearances: 0, yellowCards: 0, redCards: 0,
    ...over,
  };
}

/** Did this rendered line come from that template? Placeholders match anything
 *  that is not a sentence break, so the pool a line came from is identifiable
 *  without exporting the substitution machinery. */
function matchesTemplate(line: string, template: string): boolean {
  const body = line.replace(/^\d+': /, '');
  const pattern = template
    .split(/\{[a-z]+\}/)
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^.!?]*');
  return new RegExp(`^${pattern}$`).test(body);
}

function check() {
  const s = useGameStore.getState();
  assertSundayState({
    sunday: s.sunday!, players: s.players, clubs: s.clubs,
    playerClubId: s.playerClubId, fixtures: s.fixtures, week: s.week,
  });
}

/** Force exactly `keep` squad members available and everyone else out.
 *  Explicit on BOTH sides: keeping members "as they are" left the week's own
 *  availability roll in play, so the count under test was not the count. */
function stripSquadTo(keep: number) {
  const s = useGameStore.getState();
  const sunday = s.sunday!;
  useGameStore.setState({
    sunday: {
      ...sunday,
      teamsheet: [],
      bench: [],
      squad: sunday.squad.map((m, i) => ({
        ...m,
        availability: i < keep
          ? { status: 'available' as const, reason: null, note: null, warned: true, weeksRemaining: 0 }
          : { status: 'out' as const, reason: 'work' as const, note: 'at work', warned: true, weeksRemaining: 0 },
      })),
    },
  });
}

beforeEach(async () => {
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
});

describe('playing the fixture', () => {
  it('plays exactly once — a second call is a no-op', async () => {
    const first = await useGameStore.getState().playSundayMatch();
    expect(first).not.toBeNull();
    const goals = first!.goalsFor;
    const second = await useGameStore.getState().playSundayMatch();
    expect(second).toBeNull();
    expect(useGameStore.getState().sunday!.lastMatch!.goalsFor).toBe(goals);
    check();
  });

  it('records the result on the fixture and nowhere else', async () => {
    const report = await useGameStore.getState().playSundayMatch();
    const s = useGameStore.getState();
    const played = s.fixtures.filter(m => m.played);
    expect(played).toHaveLength(1);
    const m = played[0];
    const ourGoals = m.homeClubId === s.playerClubId ? m.homeGoals : m.awayGoals;
    expect(ourGoals).toBe(report!.goalsFor);
  });

  it('drafts guests when the squad cannot raise eleven, and removes them after', async () => {
    stripSquadTo(SUNDAY_MIN_START);
    const report = await useGameStore.getState().playSundayMatch();
    expect(report).not.toBeNull();
    expect(report!.forfeited).toBe(false);
    expect(report!.startedWith).toBeGreaterThanOrEqual(SUNDAY_MIN_START);
    expect(report!.startedWith).toBeLessThanOrEqual(SUNDAY_FULL_XI);
    // No ringer may survive into the persisted players map.
    expect(Object.keys(useGameStore.getState().players).some(isSundayRinger)).toBe(false);
    check();
  });

  it('caps the guests it will find', async () => {
    stripSquadTo(2);
    const report = await useGameStore.getState().playSundayMatch();
    expect(report!.ringersUsed).toBeLessThanOrEqual(SUNDAY_MAX_RINGERS);
  });

  it('forfeits — and says so — when even the guests cannot make seven', async () => {
    // 3 available + at most SUNDAY_MAX_RINGERS guests is still short of seven.
    stripSquadTo(3);
    const report = await useGameStore.getState().playSundayMatch();
    expect(report!.forfeited).toBe(true);
    expect(report!.goalsFor).toBe(0);
    expect(report!.goalsAgainst).toBe(3);
    expect(report!.narrative.join(' ')).toContain('could not raise');
    check();
  });

  it('credits nobody with a game they did not play when the fixture is forfeited', async () => {
    stripSquadTo(3);
    const s0 = useGameStore.getState();
    const before = new Map(s0.sunday!.squad.map(m => [m.playerId, {
      apps: s0.players[m.playerId].appearances,
      careerApps: s0.players[m.playerId].careerAppearances,
      minutes: s0.players[m.playerId].minutesPlayed ?? 0,
      fitness: s0.players[m.playerId].fitness,
      clubApps: m.clubApps,
      benched: m.benchedStreak,
      started: m.startedStreak,
    }]));

    const report = (await useGameStore.getState().playSundayMatch())!;
    expect(report.forfeited).toBe(true);
    // Nobody took the field, so the ledger has nobody to charge subs to.
    expect(report.playedIds).toEqual([]);

    const after = useGameStore.getState();
    for (const m of after.sunday!.squad) {
      const b = before.get(m.playerId)!;
      const p = after.players[m.playerId];
      expect(p.appearances, m.playerId).toBe(b.apps);
      expect(p.careerAppearances, m.playerId).toBe(b.careerApps);
      expect(p.minutesPlayed ?? 0, m.playerId).toBe(b.minutes);
      expect(p.fitness, m.playerId).toBe(b.fitness);
      expect(m.clubApps, m.playerId).toBe(b.clubApps);
      expect(m.benchedStreak, m.playerId).toBe(b.benched);
      expect(m.startedStreak, m.playerId).toBe(b.started);
    }
    check();
  });

  it('does not judge a promise on a fixture that was never played', async () => {
    stripSquadTo(3);
    const s0 = useGameStore.getState();
    // Promise a man who is one of the three still standing, and make it due now.
    const target = s0.sunday!.squad.find(m => m.availability.status !== 'out')!;
    const promise = { kind: 'start' as const, madeSeason: s0.season, madeWeek: s0.week - 2, dueWeek: s0.week };
    useGameStore.setState({
      sunday: {
        ...s0.sunday!,
        squad: s0.sunday!.squad.map(m => (m.playerId === target.playerId ? { ...m, promise } : m)),
      },
    });

    const report = (await useGameStore.getState().playSundayMatch())!;
    expect(report.forfeited).toBe(true);
    const after = useGameStore.getState().sunday!.squad.find(m => m.playerId === target.playerId)!;
    // Still owed a start — and not punished for one he was never given.
    expect(after.promise).toEqual(promise);
    expect(after.memories.some(m => m.kind === 'promise-broken')).toBe(false);
    expect(report.consequences.join(' ')).not.toContain('Promise');
    check();
  });

  it('never fields a player who is unavailable', async () => {
    const s0 = useGameStore.getState();
    const banned = s0.sunday!.squad[0].playerId;
    useGameStore.setState({
      sunday: {
        ...s0.sunday!,
        squad: s0.sunday!.squad.map(m => (m.playerId === banned ? {
          ...m,
          availability: { status: 'out' as const, reason: 'suspended' as const, note: null, warned: true, weeksRemaining: 1 },
        } : m)),
      },
    });
    const report = await useGameStore.getState().playSundayMatch();
    expect(report!.playedIds).not.toContain(banned);
  });

  it('snapshots the man of the match by name, so a guest cannot vanish from his own report', async () => {
    // Ringers are wiped from `players` the moment the whistle goes. A guest who
    // was man of the match therefore left `motmPlayerId` dangling and the hero
    // panel silently blank.
    // Five available forces two guests just to reach the legal minimum.
    stripSquadTo(SUNDAY_MIN_START - 2);
    const report = (await useGameStore.getState().playSundayMatch())!;
    expect(report.forfeited).toBe(false);
    expect(report.ringersUsed).toBeGreaterThan(0);
    if (report.motmPlayerId) {
      expect(report.motmName, 'motm id with no name').toBeTruthy();
      expect(report.motmName!.length).toBeGreaterThan(2);
    }
    if (report.lowlightPlayerId) {
      expect(report.lowlightName, 'lowlight id with no name').toBeTruthy();
    }
    // The proof it matters: at least one of the two can point at somebody who
    // is no longer in the players map, and the name still reads.
    const players = useGameStore.getState().players;
    for (const id of [report.motmPlayerId, report.lowlightPlayerId]) {
      if (!id || players[id]) continue;
      const name = id === report.motmPlayerId ? report.motmName : report.lowlightName;
      expect(name, `${id} is gone and unnamed`).toBeTruthy();
    }
  });

  it('records the discipline and injuries the settlement will bill for', async () => {
    const report = (await useGameStore.getState().playSundayMatch())!;
    const s = useGameStore.getState();
    const events = s.currentMatchResult!.events;
    const reds = events.filter(e => e.type === 'red_card' && e.clubId === s.playerClubId).length;
    const knocks = events.filter(e => e.type === 'injury' && e.clubId === s.playerClubId).length;
    expect(report.redCards).toBe(reds);
    expect(report.injuries).toBe(knocks);
  });

  it('credits goals, appearances and cards to real players only', async () => {
    await useGameStore.getState().playSundayMatch();
    const s = useGameStore.getState();
    const squadIds = new Set(s.sunday!.squad.map(m => m.playerId));
    for (const id of s.sunday!.lastMatch!.playedIds) {
      expect(squadIds.has(id)).toBe(true);
      const p = s.players[id];
      expect(p.appearances).toBeGreaterThan(0);
      expect(Number.isFinite(p.minutesPlayed ?? 0)).toBe(true);
      expect(p.goals).toBeGreaterThanOrEqual(0);
    }
  });

  it('a red card produces a suspension that blocks selection next week', async () => {
    // Play weeks until someone is sent off; the engine's card rate makes this
    // very likely inside a season, and the assertion is skipped if it is not.
    let suspended: string | null = null;
    for (let i = 0; i < 14 && !suspended; i++) {
      const s = useGameStore.getState();
      if (s.sunday!.pendingEvent) await s.resolveSundayEvent(s.sunday!.pendingEvent.choices[0].id);
      await useGameStore.getState().advanceWeek();
      const after = useGameStore.getState();
      suspended = Object.values(after.players).find(p =>
        p.clubId === after.playerClubId && (p.suspendedUntilWeek ?? 0) > after.week)?.id ?? null;
      if (after.sunday!.seasonComplete) break;
    }
    if (!suspended) return;
    const s = useGameStore.getState();
    const member = s.sunday!.squad.find(m => m.playerId === suspended)!;
    expect(member.availability.status).toBe('out');
    expect(member.availability.reason).toBe('suspended');
    check();
  });
});

describe('narrative', () => {
  it('tracks the scoreline exactly as the engine recorded it', () => {
    const players: Record<string, Player> = {};
    const mk = (id: string, firstName: string): Player => ({
      id, firstName, lastName: 'X', age: 25, nationality: 'England', position: 'ST',
      attributes: { pace: 40, shooting: 40, passing: 40, defending: 40, physical: 40, mental: 40 },
      overall: 40, potential: 40, clubId: 'us', wage: 0, value: 0, contractEnd: 99,
      fitness: 100, morale: 60, form: 60, injured: false, injuryWeeks: 0,
      goals: 0, assists: 0, appearances: 0, careerGoals: 0, careerAssists: 0,
      careerAppearances: 0, yellowCards: 0, redCards: 0,
    });
    players.a = mk('a', 'Dave');
    players.b = mk('b', 'Kev');

    const events: MatchEvent[] = [
      { minute: 10, type: 'goal', clubId: 'us', playerId: 'a', description: '' },
      { minute: 20, type: 'goal', clubId: 'them', playerId: 'b', description: '' },
      { minute: 70, type: 'goal', clubId: 'us', playerId: 'a', description: '' },
      // An own goal credited to us, scored by one of theirs.
      { minute: 80, type: 'own_goal', clubId: 'us', playerId: 'b', description: '' },
    ];
    const lines = buildSundayNarrative({
      rng: createSundayRng(1, 0), events, clubId: 'us', players, isDerby: false,
      noShowNames: [], ringerNames: [], startedWith: 11,
      homeGoals: 3, awayGoals: 1, isHome: true,
    });
    // The last goal line must read 3-1 — the final score.
    const goalLines = lines.filter(l => /\d+-\d+/.test(l));
    expect(goalLines[goalLines.length - 1]).toContain('3-1');
  });

  it('never narrates a goal against you in the celebratory voice', () => {
    // The bug: both sides' goals were drawn from GOAL_LINES, so the opposition
    // going 1-0 up read "…and the man on the touchline with the dog applauds".
    const players: Record<string, Player> = { a: mkPlayer('a', 'Dave'), b: mkPlayer('b', 'Kev') };
    const types = Object.keys(SUNDAY_CONCEDED_LINES);
    const events: MatchEvent[] = types.map((type, i) => ({
      minute: 5 + i * 4, type, clubId: 'them', playerId: 'b', description: '',
    })) as MatchEvent[];
    // Own goals credited to THEM name one of OURS, which is the only case where
    // the conceded pool talks about a player on this side.
    const lines = buildSundayNarrative({
      rng: createSundayRng(9, 0), events, clubId: 'us', players, isDerby: false,
      noShowNames: [], ringerNames: [], startedWith: 11,
      homeGoals: 0, awayGoals: types.length, isHome: true,
    });
    const goalLines = lines.filter(l => /^\d+': /.test(l));
    expect(goalLines).toHaveLength(types.length);
    const conceded = Object.values(SUNDAY_CONCEDED_LINES).flat();
    for (const line of goalLines) {
      expect(conceded.some(tpl => matchesTemplate(line, tpl)), line).toBe(true);
    }

    // The other direction, which is what makes the first assertion mean
    // something: OUR goals must never come out of the conceded pools.
    const oursLines = buildSundayNarrative({
      rng: createSundayRng(10, 0), clubId: 'us', players, isDerby: false,
      events: types.map((type, i) => ({
        minute: 5 + i * 4, type, clubId: 'us', playerId: 'a', description: '',
      })) as MatchEvent[],
      noShowNames: [], ringerNames: [], startedWith: 11,
      homeGoals: types.length, awayGoals: 0, isHome: true,
    }).filter(l => /^\d+': /.test(l));
    for (const line of oursLines) {
      expect(conceded.some(tpl => matchesTemplate(line, tpl)), line).toBe(false);
    }
  });

  it('gives a late goal against you its own sting, and a derby one too', () => {
    const players: Record<string, Player> = { b: mkPlayer('b', 'Kev') };
    const late = buildSundayNarrative({
      rng: createSundayRng(11, 0), clubId: 'us', players, isDerby: false,
      events: [{ minute: 89, type: 'goal', clubId: 'them', playerId: 'b', description: '' }],
      noShowNames: [], ringerNames: [], startedWith: 11,
      homeGoals: 0, awayGoals: 1, isHome: true,
    }).filter(l => /^\d+': /.test(l));
    expect(late).toHaveLength(1);
    expect(SUNDAY_CONCEDED_LATE_LINES.some(tpl => matchesTemplate(late[0], tpl)), late[0]).toBe(true);

    const derby = buildSundayNarrative({
      rng: createSundayRng(12, 0), clubId: 'us', players, isDerby: true,
      events: [{ minute: 30, type: 'goal', clubId: 'them', playerId: 'b', description: '' }],
      noShowNames: [], ringerNames: [], startedWith: 11,
      homeGoals: 0, awayGoals: 1, isHome: true,
    }).filter(l => /^\d+': /.test(l));
    expect(derby).toHaveLength(1);
    expect(SUNDAY_CONCEDED_DERBY_LINES.some(tpl => matchesTemplate(derby[0], tpl)), derby[0]).toBe(true);
  });

  it('keeps the half-time and full-time markers exact', () => {
    const players: Record<string, Player> = { a: mkPlayer('a', 'Dave'), b: mkPlayer('b', 'Kev') };
    const lines = buildSundayNarrative({
      rng: createSundayRng(13, 0), clubId: 'us', players, isDerby: false,
      events: [
        { minute: 10, type: 'goal', clubId: 'us', playerId: 'a', description: '' },
        { minute: 44, type: 'goal', clubId: 'them', playerId: 'b', description: '' },
        { minute: 70, type: 'goal', clubId: 'us', playerId: 'a', description: '' },
      ],
      noShowNames: [], ringerNames: [], startedWith: 11,
      homeGoals: 2, awayGoals: 1, isHome: true,
    });
    expect(lines).toContain('HT 1-1.');
    expect(lines).toContain('FT 2-1.');
  });

  it('marks an appearance milestone, and only a real one', () => {
    const players: Record<string, Player> = { a: mkPlayer('a', 'Ben') };
    const member = (clubApps: number) => ([{ playerId: 'a', clubApps, job: 'roofer' }] as unknown as SundaySquadMember[]);
    const base = {
      clubId: 'us', players, isDerby: false, events: [] as MatchEvent[],
      noShowNames: [], ringerNames: [], startedWith: 11,
      homeGoals: 0, awayGoals: 0, isHome: true, startedIds: ['a'],
    };
    // 49 played + today = his 50th.
    const hit = buildSundayNarrative({ ...base, rng: createSundayRng(3, 0), squad: member(49) });
    expect(hit.join(' ')).toContain('50');
    expect(hit.join(' ')).toContain('Ben');
    // 48 + today = 49, which is not a milestone and gets no line.
    const miss = buildSundayNarrative({ ...base, rng: createSundayRng(3, 0), squad: member(48) });
    expect(miss.join(' ')).not.toContain('Ben');
  });

  it('says what the scorer does on weekdays, but not more than twice', () => {
    const players: Record<string, Player> = {
      a: mkPlayer('a', 'Dave'), b: mkPlayer('b', 'Kev'), c: mkPlayer('c', 'Baz'),
    };
    const squad = [
      { playerId: 'a', clubApps: 5, job: 'scaffolder' },
      { playerId: 'b', clubApps: 5, job: 'postie' },
      { playerId: 'c', clubApps: 5, job: 'chef' },
    ] as unknown as SundaySquadMember[];
    const events: MatchEvent[] = ['a', 'b', 'c', 'a', 'b'].map((pid, i) => ({
      minute: 10 + i * 10, type: 'goal', clubId: 'us', playerId: pid, description: '',
    })) as MatchEvent[];
    const lines = buildSundayNarrative({
      rng: createSundayRng(7, 0), events, clubId: 'us', players, isDerby: false,
      noShowNames: [], ringerNames: [], startedWith: 11,
      homeGoals: 5, awayGoals: 0, isHome: true, squad, startedIds: ['a', 'b', 'c'],
    });
    const jobs = lines.filter(l => /scaffolder|postie|chef/.test(l));
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.length).toBeLessThanOrEqual(SUNDAY_NARRATIVE_COLOUR_MAX);
  });

  it('never puts the defector on the pitch — he is not in their squad', () => {
    // He is deleted when he leaves, so the only honest place to mention him is
    // the build-up. Anything in-match would be an invented fact.
    const players: Record<string, Player> = { b: mkPlayer('b', 'Kev') };
    const lines = buildSundayNarrative({
      rng: createSundayRng(8, 0), clubId: 'us', players, isDerby: true,
      events: [{ minute: 30, type: 'goal', clubId: 'them', playerId: 'b', description: '' }],
      noShowNames: [], ringerNames: [], startedWith: 11,
      homeGoals: 0, awayGoals: 1, isHome: true, defectorName: 'Danny Vaughan',
    });
    const mentions = lines.filter(l => l.includes('Danny'));
    expect(mentions).toHaveLength(1);
    // And it is a build-up line, not a minute'd one.
    expect(mentions[0]).not.toMatch(/^\d+': /);
  });

  it('names the no-shows and the guests', () => {
    const lines = buildSundayNarrative({
      rng: createSundayRng(2, 0), events: [], clubId: 'us', players: {}, isDerby: false,
      noShowNames: ['Gary', 'Baz'], ringerNames: ['Trev'], startedWith: 9,
      homeGoals: 0, awayGoals: 0, isHome: true,
    });
    const text = lines.join(' ');
    expect(text).toContain('Gary');
    expect(text).toContain('Baz');
    expect(text).toContain('Trev');
    expect(text).toContain('9');
  });
});

describe('pitch and fit', () => {
  it('maps pitch quality monotonically', () => {
    expect(pitchConditionFor(5)).toBe('waterlogged');
    expect(pitchConditionFor(20)).toBe('poor');
    expect(pitchConditionFor(40)).toBe('good');
    expect(pitchConditionFor(80)).toBe('excellent');
  });

  it('measures tactical fit against the squad, not against an absolute scale', () => {
    const mk = (over: Partial<Player['attributes']>): Player => ({
      id: Math.random().toString(36), firstName: 'A', lastName: 'B', age: 25, nationality: 'England',
      position: 'CM',
      attributes: { pace: 40, shooting: 40, passing: 40, defending: 40, physical: 40, mental: 40, ...over },
      overall: 40, potential: 40, clubId: 'c', wage: 0, value: 0, contractEnd: 99,
      fitness: 100, morale: 60, form: 60, injured: false, injuryWeeks: 0,
      goals: 0, assists: 0, appearances: 0, careerGoals: 0, careerAssists: 0,
      careerAppearances: 0, yellowCards: 0, redCards: 0,
    });
    const passers = Array.from({ length: 10 }, () => mk({ passing: 60, mental: 55 }));
    const bruisers = Array.from({ length: 10 }, () => mk({ physical: 60, shooting: 50 }));
    expect(sundayTacticFit('proper-football', passers)).toBeGreaterThan(sundayTacticFit('proper-football', bruisers));
    expect(sundayTacticFit('route-one', bruisers)).toBeGreaterThan(sundayTacticFit('route-one', passers));
    // Doubling everyone's ability must NOT change fit — it is a shape metric.
    const better = passers.map(p => ({ ...p, attributes: Object.fromEntries(Object.entries(p.attributes).map(([k, v]) => [k, v + 15])) as Player['attributes'] }));
    expect(Math.abs(sundayTacticFit('proper-football', better) - sundayTacticFit('proper-football', passers))).toBeLessThan(0.001);
  });

  it('carries the fit into the overall the engine actually reads', () => {
    // The whole point of SUNDAY_FIT_OVERALL_PER_POINT: `computeStrengths` reads
    // `overall`, so a fit that only moved attributes could never move
    // possession. Same XI, two tactics, opposite fits — the copies handed to
    // the engine must differ in `overall`, and the stored players must not.
    const mk = (over: Partial<Player['attributes']>): Player => ({
      id: `p${Object.values(over).join('-')}${Math.random()}`, firstName: 'A', lastName: 'B',
      age: 25, nationality: 'England', position: 'CM',
      attributes: { pace: 40, shooting: 40, passing: 40, defending: 40, physical: 40, mental: 40, ...over },
      overall: 45, potential: 45, clubId: 'c', wage: 0, value: 0, contractEnd: 99,
      fitness: 100, morale: 60, form: 60, injured: false, injuryWeeks: 0,
      goals: 0, assists: 0, appearances: 0, careerGoals: 0, careerAssists: 0,
      careerAppearances: 0, yellowCards: 0, redCards: 0,
    });
    const bruisers = Array.from({ length: 11 }, () => mk({ physical: 62, shooting: 50 }));
    const base = {
      squad: [], pitchQuality: 50, ballsLevel: 0, glovesLevel: 0, coachLevel: 0,
      teamMorale: 55, isPlayerClub: true,
    };
    const suited = buildMatchdayTeam({ ...base, xi: bruisers, tacticId: 'route-one' });
    const wrong = buildMatchdayTeam({ ...base, xi: bruisers, tacticId: 'proper-football' });
    expect(suited.fit).toBeGreaterThan(wrong.fit);
    expect(suited.players[0].overall).toBeGreaterThan(wrong.players[0].overall);
    // The stored Player is untouched — the copies are thrown away after the
    // whistle and must never bake a tactic into a squad.
    expect(bruisers[0].overall).toBe(45);
  });

  it('spends the fit delta in proportion to what the tactic wants', () => {
    // Route One wants physical 4, shooting 2, pace 1. A perfect fit must move
    // physicality furthest, not move all three the same distance.
    const mk = (): Player => ({
      id: Math.random().toString(36), firstName: 'A', lastName: 'B', age: 25, nationality: 'England',
      position: 'CM',
      attributes: { pace: 40, shooting: 50, passing: 30, defending: 30, physical: 70, mental: 30 },
      overall: 45, potential: 45, clubId: 'c', wage: 0, value: 0, contractEnd: 99,
      fitness: 100, morale: 60, form: 60, injured: false, injuryWeeks: 0,
      goals: 0, assists: 0, appearances: 0, careerGoals: 0, careerAssists: 0,
      careerAppearances: 0, yellowCards: 0, redCards: 0,
    });
    const xi = Array.from({ length: 11 }, mk);
    const team = buildMatchdayTeam({
      xi, squad: [], tacticId: 'route-one', pitchQuality: 50, ballsLevel: 0,
      glovesLevel: 0, coachLevel: 0, teamMorale: 55, isPlayerClub: true,
    });
    const before = xi[0].attributes;
    const after = team.players[0].attributes;
    const physicalGain = after.physical - before.physical;
    const paceGain = after.pace - before.pace;
    expect(team.fit).toBeGreaterThan(0.9);
    expect(physicalGain).toBeGreaterThan(paceGain);
  });

  it('gives every AI club the tactic its own squad suits, and keeps it', async () => {
    const s = useGameStore.getState();
    const sunday = s.sunday!;
    const aiIds = sunday.divisionClubIds.filter(id => id !== s.playerClubId);
    expect(aiIds.length).toBeGreaterThan(0);
    for (const id of aiIds) {
      const style = sunday.divisionStyles[id];
      expect(style, `${id} has no style`).toBeTruthy();
      const xi = s.clubs[id].lineup.map(pid => s.players[pid]).filter(Boolean);
      expect(style).toBe(bestSundayTactic(xi));
      // The read path agrees with the stored map, and agrees with itself when
      // the map is empty — which is what an old save gets.
      expect(sundayStyleOf(sunday.divisionStyles, id, s.clubs, s.players)).toBe(style);
      expect(sundayStyleOf({}, id, s.clubs, s.players)).toBe(style);
    }
    // The division must not be one tactic wearing eight shirts — that was the
    // hardcoded-Route-One bug this replaced.
    const distinct = new Set(aiIds.map(id => sunday.divisionStyles[id]));
    expect(distinct.size).toBeGreaterThan(1);

    // A style is for the season: playing a match cannot change it.
    await useGameStore.getState().playSundayMatch();
    expect(useGameStore.getState().sunday!.divisionStyles).toEqual(sunday.divisionStyles);
  });
});

describe('match importance', () => {
  /** A scripted division: one unplayed fixture per club, points as given. */
  function scriptedTable(points: Record<string, number>, remainingEach: number) {
    const clubIds = Object.keys(points);
    const table: LeagueTableEntry[] = clubIds
      .map(clubId => ({
        clubId, played: 10, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: points[clubId], form: [], cleanSheets: 0,
      }))
      .sort((a, b) => b.points - a.points);
    const fixtures: Match[] = [];
    // Pair the clubs up so every one of them has `remainingEach` left.
    for (let r = 0; r < remainingEach; r++) {
      for (let i = 0; i < clubIds.length; i += 2) {
        fixtures.push({
          id: `f${r}-${i}`, week: 20 + r, homeClubId: clubIds[i], awayClubId: clubIds[i + 1],
          played: false, homeGoals: 0, awayGoals: 0, events: [],
        });
      }
    }
    return { clubIds, table, fixtures };
  }

  it('calls the last-day promotion shootout a decider', () => {
    // us v a on the final afternoon. Winning puts promotion out of reach of
    // everyone but `a`, which is one club for two spots; losing leaves three
    // clubs able to pass us.
    const { clubIds, table, fixtures } = scriptedTable(
      { us: 20, a: 24, b: 19, c: 19, d: 10, e: 8 }, 1,
    );
    const stakes = deriveSundayStakes({
      divisionId: 'sun-4', clubId: 'us', opponentClubId: 'a',
      fixtures, divisionClubIds: clubIds, table, rivalClubId: null, cupRound: null,
    });
    expect(stakes.tier).toBe('decider');
    expect(stakes.line).toBe('Win and you are up.');
  });

  it('calls the last-day survival match a decider', () => {
    const { clubIds, table, fixtures } = scriptedTable(
      { us: 15, a: 30, b: 28, c: 26, d: 14, e: 13 }, 1,
    );
    const stakes = deriveSundayStakes({
      divisionId: 'sun-3', clubId: 'us', opponentClubId: 'a',
      fixtures, divisionClubIds: clubIds, table, rivalClubId: null, cupRound: null,
    });
    expect(stakes.tier).toBe('decider');
    expect(stakes.line).toBe('Win and you are safe.');
  });

  it('refuses to call a mid-season fixture a decider, however tight the table', () => {
    // The same table, six matches from the end. Nothing is settled by anything
    // today, so nothing is claimed — this is the conservative half of the rule.
    const { clubIds, table, fixtures } = scriptedTable(
      { us: 20, a: 24, b: 19, c: 19, d: 10, e: 8 }, 6,
    );
    const stakes = deriveSundayStakes({
      divisionId: 'sun-4', clubId: 'us', opponentClubId: 'a',
      fixtures, divisionClubIds: clubIds, table, rivalClubId: null, cupRound: null,
    });
    expect(stakes.tier).toBe('routine');
    expect(stakes.line).toBeNull();
  });

  it('keeps the derby a derby when it decides nothing', () => {
    const { clubIds, table, fixtures } = scriptedTable(
      { us: 20, a: 24, b: 19, c: 19, d: 10, e: 8 }, 6,
    );
    const stakes = deriveSundayStakes({
      divisionId: 'sun-4', clubId: 'us', opponentClubId: 'a',
      fixtures, divisionClubIds: clubIds, table, rivalClubId: 'a', cupRound: null,
    });
    expect(stakes.tier).toBe('derby');
  });

  it('reads the cup off the round, final included', () => {
    const { clubIds, table, fixtures } = scriptedTable({ us: 20, a: 24 }, 4);
    const base = {
      divisionId: 'sun-4' as const, clubId: 'us', opponentClubId: 'a',
      fixtures, divisionClubIds: clubIds, table, rivalClubId: 'a',
    };
    expect(deriveSundayStakes({ ...base, cupRound: 1 }).tier).toBe('cup');
    expect(deriveSundayStakes({ ...base, cupRound: 1 }).line).toContain(sundayCupRoundName(2));
    expect(deriveSundayStakes({ ...base, cupRound: SUNDAY_CUP_ROUNDS }).tier).toBe('cup-final');
  });

  it('stamps the tier onto the report the manager was shown', async () => {
    const report = (await useGameStore.getState().playSundayMatch())!;
    expect(['routine', 'derby', 'cup', 'cup-final', 'decider']).toContain(report.tier);
    // And it survives a round trip through the store.
    expect(useGameStore.getState().sunday!.lastMatch!.tier).toBe(report.tier);
  });
});

describe('the briefing remembers', () => {
  const players: Record<string, Player> = { a: mkPlayer('a', 'Dave'), b: mkPlayer('b', 'Kev') };
  const played = (over: Partial<Match>): Match => ({
    id: 'r1', week: 6, homeClubId: 'them', awayClubId: 'us',
    played: true, homeGoals: 2, awayGoals: 1, events: [], ...over,
  });

  it('recalls the reverse fixture with the score and who settled it', () => {
    const match = played({
      events: [
        { minute: 20, type: 'goal', clubId: 'us', playerId: 'a', description: '' },
        { minute: 55, type: 'goal', clubId: 'them', playerId: 'b', description: '' },
        { minute: 89, type: 'goal', clubId: 'them', playerId: 'b', description: '' },
      ] as MatchEvent[],
    });
    const line = sundayReverseFixtureRecall([match], 'us', 'them', players)!;
    expect(line).toContain('Lost 2-1 over there in week 6.');
    expect(line).toContain('89th');
  });

  it('names our man when we won it by one', () => {
    const match = played({
      homeClubId: 'us', awayClubId: 'them', homeGoals: 2, awayGoals: 1, week: 3,
      events: [
        { minute: 10, type: 'goal', clubId: 'them', playerId: 'b', description: '' },
        { minute: 30, type: 'goal', clubId: 'us', playerId: 'a', description: '' },
        { minute: 77, type: 'goal', clubId: 'us', playerId: 'a', description: '' },
      ] as MatchEvent[],
    });
    const line = sundayReverseFixtureRecall([match], 'us', 'them', players)!;
    expect(line).toContain('Won 2-1 at home in week 3.');
    expect(line).toContain('Dave settled it in the 77th.');
  });

  it('says nothing at all when they have not met', () => {
    const unplayed = played({ played: false });
    expect(sundayReverseFixtureRecall([unplayed], 'us', 'them', players)).toBeNull();
    expect(sundayReverseFixtureRecall([], 'us', 'them', players)).toBeNull();
  });

  it('invents no decisive goal in a match that was not close', () => {
    const match = played({ homeGoals: 4, awayGoals: 0 });
    const line = sundayReverseFixtureRecall([match], 'us', 'them', players)!;
    expect(line).toBe('Lost 4-0 over there in week 6.');
  });

  it('flags a milestone only for a named man who actually reaches one', () => {
    const squad = [
      { playerId: 'a', clubApps: 99 },
      { playerId: 'b', clubApps: 48 },
    ] as unknown as SundaySquadMember[];
    expect(sundayMilestoneToday(squad, players, ['a', 'b'])).toBe('Dave would hit 100 appearances for the club today.');
    // Not named, not mentioned.
    expect(sundayMilestoneToday(squad, players, ['b'])).toBeNull();
  });
});

describe('the aftermath', () => {
  it('carries the breakdown that explains the result', async () => {
    const report = (await useGameStore.getState().playSundayMatch())!;
    expect(report.adjustments.length).toBeGreaterThan(0);
    for (const row of report.adjustments) {
      expect(typeof row.label).toBe('string');
      expect(row.label.length).toBeGreaterThan(2);
      expect(Number.isFinite(row.delta)).toBe(true);
    }
    // The pitch and the tactic are always in there — they apply to every side
    // in every fixture.
    expect(report.adjustments.some(a => /Pitch/.test(a.label))).toBe(true);
  });

  it('keeps the guests in the ratings they earned', async () => {
    stripSquadTo(SUNDAY_MIN_START - 2);
    const report = (await useGameStore.getState().playSundayMatch())!;
    expect(report.ringersUsed).toBeGreaterThan(0);
    expect(report.guestRatings).toHaveLength(report.ringersUsed);
    for (const g of report.guestRatings) {
      expect(g.name.length).toBeGreaterThan(2);
      expect(g.rating).toBeGreaterThan(0);
    }
    // And they are gone from the players map, which is the whole problem.
    expect(Object.keys(useGameStore.getState().players).some(isSundayRinger)).toBe(false);
  });

  it('writes an unlikely hero only when one of the worst men wins it', () => {
    const base = {
      rating: undefined, isDerby: false, isCup: false, cupRound: null,
      motm: false, played: true, sentOff: false, injuryWeeks: 0, prevApps: 10, prevGoals: 2,
      report: { goalsFor: 1, goalsAgainst: 0, opponentName: 'Dog & Duck', season: 1, week: 4 },
    };
    const ordinary = captureMatchMemories({ ...base, winnerMinute: 70 });
    expect(ordinary.some(m => m.kind === 'winner')).toBe(true);
    expect(ordinary.some(m => m.kind === 'unlikely-hero')).toBe(false);

    const unlikely = captureMatchMemories({ ...base, winnerMinute: 70, unlikelyHero: true });
    expect(unlikely.some(m => m.kind === 'unlikely-hero')).toBe(true);
    // One goal, one memory: the two versions of it never both fire.
    expect(unlikely.some(m => m.kind === 'winner')).toBe(false);
    // And it is heavy enough to be one for the clubhouse wall.
    expect(unlikely.find(m => m.kind === 'unlikely-hero')!.weight)
      .toBeGreaterThanOrEqual(SUNDAY_MEMORY_LEGENDARY_WEIGHT);
  });
});
