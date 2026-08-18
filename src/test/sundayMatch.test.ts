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
import { createSundayRng } from '@/utils/sunday/rng';
import type { MatchEvent, Player } from '@/types/game';

const SEED = 4242;

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
