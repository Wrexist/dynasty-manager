import { describe, it, expect } from 'vitest';
import { pickAiMatchSquad, stripAiMatchDetail, resolveCatchUpFixture } from '@/store/slices/orchestration/helpers';
import { AI_MIN_MATCH_PLAYERS } from '@/config/aiSimulation';
import type { Club, Match, Player, Position } from '@/types/game';

// These three helpers carry the fixes for the two worst bugs found in the audit
// — 65% of AI league fixtures forfeiting 3-0, and 83.9 MB of AI match events
// held in memory — and neither had any direct coverage. That absence is not
// academic: the player's "honour my saved XI" behaviour was briefly lost during
// the same refactor precisely because nothing asserted it.

function mkPlayer(id: string, position: Position, over: Partial<Player> = {}): Player {
  return {
    id, firstName: id, lastName: id, age: 25, position,
    nationality: 'England', overall: 70, potential: 75, value: 1_000_000, wage: 10_000,
    clubId: 'club-a', contractEnd: 3, goals: 0, assists: 0, appearances: 0,
    fitness: 90, morale: 70, form: 60, injured: false, injuryWeeks: 0,
    yellowCards: 0, redCards: 0,
    attributes: { pace: 65, shooting: 60, passing: 70, defending: 60, physical: 65, mental: 65 },
    ...over,
  } as Player;
}

/** A squad whose FIRST eleven ids contain no goalkeeper — the exact shape that
 *  made a quarter of English clubs forfeit before `pickAiMatchSquad` existed. */
function mkClubWithBuriedKeeper(): { club: Club; players: Record<string, Player> } {
  const shape: Position[] = [
    'CB', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'CDM', 'LW', 'RW', 'ST',
    'GK', 'GK', 'CB', 'CM', 'ST', 'CAM', 'LM', 'RM', 'ST',
  ];
  const players: Record<string, Player> = {};
  shape.forEach((pos, i) => {
    const id = `p${i}`;
    players[id] = mkPlayer(id, pos, { overall: 70 - (i % 5) });
  });
  const club = {
    id: 'club-a', name: 'Club A', shortName: 'CLA', formation: '4-4-2',
    playerIds: Object.keys(players), lineup: [], subs: [],
  } as unknown as Club;
  return { club, players };
}

describe('pickAiMatchSquad', () => {
  it('fields a goalkeeper even when none is in the first eleven roster slots', () => {
    const { club, players } = mkClubWithBuriedKeeper();
    const { xi } = pickAiMatchSquad(club, players, 5);
    expect(xi).toHaveLength(11);
    expect(xi.some(p => p.position === 'GK'), 'XI contains a GK').toBe(true);
  });

  it('never puts the same player in the XI and on the bench', () => {
    const { club, players } = mkClubWithBuriedKeeper();
    const { xi, bench } = pickAiMatchSquad(club, players, 5);
    const overlap = bench.filter(b => xi.some(s => s.id === b.id));
    expect(overlap.map(p => p.id)).toEqual([]);
  });

  it('excludes injured, suspended and on-loan players while the squad is deep enough', () => {
    const { club, players } = mkClubWithBuriedKeeper();
    players.p0 = { ...players.p0, injured: true, injuryWeeks: 3 };
    players.p1 = { ...players.p1, suspendedUntilWeek: 9 };
    players.p2 = { ...players.p2, onLoan: true };
    const { xi, bench } = pickAiMatchSquad(club, players, 5);
    const ids = [...xi, ...bench].map(p => p.id);
    expect(ids).not.toContain('p0');
    expect(ids).not.toContain('p1');
    expect(ids).not.toContain('p2');
  });

  it('backfills an injury-crisis squad rather than handing out a fabricated 3-0', () => {
    // A thin squad with almost everyone hurt. Forfeiting corrupts the table and
    // the prize money far more than an under-strength side losing on merit.
    const players: Record<string, Player> = {};
    const shape: Position[] = ['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'ST', 'ST'];
    shape.forEach((pos, i) => {
      const id = `q${i}`;
      players[id] = mkPlayer(id, pos, { injured: i >= 4, injuryWeeks: i >= 4 ? 2 : 0 });
    });
    const club = {
      id: 'club-b', name: 'Club B', shortName: 'CLB', formation: '4-4-2',
      playerIds: Object.keys(players), lineup: [], subs: [],
    } as unknown as Club;

    const { xi } = pickAiMatchSquad(club, players, 5);
    expect(xi.length).toBeGreaterThanOrEqual(AI_MIN_MATCH_PLAYERS);
  });

  it('honours the saved XI for the player club, and only for it', () => {
    const { club, players } = mkClubWithBuriedKeeper();
    // A deliberately un-optimal but legal XI: the manager's choice.
    const saved = ['p11', 'p3', 'p4', 'p13', 'p0', 'p6', 'p7', 'p17', 'p18', 'p10', 'p15'];
    const withLineup = { ...club, lineup: saved, subs: ['p12', 'p19', 'p16'] } as Club;

    const honoured = pickAiMatchSquad(withLineup, players, 5, true);
    expect(honoured.xi.map(p => p.id)).toEqual(saved);
    expect(honoured.bench.slice(0, 3).map(p => p.id)).toEqual(['p12', 'p19', 'p16']);

    // Same club, flag off: the optimizer is free to pick differently, and does.
    const optimized = pickAiMatchSquad(withLineup, players, 5, false);
    expect(optimized.xi.map(p => p.id)).not.toEqual(saved);
  });

  it('replaces an unavailable saved starter with cover, keeping the rest of the XI intact', () => {
    const { club, players } = mkClubWithBuriedKeeper();
    const saved = ['p11', 'p3', 'p4', 'p13', 'p0', 'p6', 'p7', 'p17', 'p18', 'p10', 'p15'];
    players.p7 = { ...players.p7, injured: true, injuryWeeks: 2 };
    const withLineup = { ...club, lineup: saved, subs: [] } as Club;

    const { xi } = pickAiMatchSquad(withLineup, players, 5, true);
    expect(xi).toHaveLength(11);
    expect(xi.map(p => p.id)).not.toContain('p7');
    // Every other saved starter still starts.
    for (const id of saved.filter(i => i !== 'p7')) {
      expect(xi.map(p => p.id), `${id} still starts`).toContain(id);
    }
  });

  it('falls back to the optimizer when the saved XI is empty', () => {
    const { club, players } = mkClubWithBuriedKeeper();
    const { xi } = pickAiMatchSquad({ ...club, lineup: [] } as Club, players, 5, true);
    expect(xi).toHaveLength(11);
    expect(xi.some(p => p.position === 'GK')).toBe(true);
  });
});

describe('stripAiMatchDetail', () => {
  const base = {
    id: 'm1', week: 3, season: 1, homeClubId: 'club-a', awayClubId: 'club-b',
    homeGoals: 2, awayGoals: 1, played: true, competition: 'league',
    events: [{ minute: 12, type: 'goal' as const, clubId: 'club-a', description: 'Goal' }],
    stats: { homePossession: 55 },
  } as unknown as Match;

  it('drops events and stats from an AI-vs-AI result but keeps the score', () => {
    const out = stripAiMatchDetail(base, 'club-z');
    expect(out.events).toEqual([]);
    expect((out as Record<string, unknown>).stats).toBeUndefined();
    expect(out.homeGoals).toBe(2);
    expect(out.awayGoals).toBe(1);
    expect(out.played).toBe(true);
  });

  it('keeps everything when the player club is involved — Match Review renders it', () => {
    expect(stripAiMatchDetail(base, 'club-a')).toBe(base);
    expect(stripAiMatchDetail(base, 'club-b')).toBe(base);
  });
});

describe('resolveCatchUpFixture', () => {
  const strong = Array.from({ length: 11 }, (_, i) => mkPlayer(`s${i}`, 'CM', { overall: 85 }));
  const weak = Array.from({ length: 11 }, (_, i) => mkPlayer(`w${i}`, 'CM', { overall: 55 }));
  const fixture = {
    id: 'm2', week: 30, season: 1, homeClubId: 'club-a', awayClubId: 'club-b',
    homeGoals: 0, awayGoals: 0, played: false, competition: 'league',
  } as unknown as Match;

  it('marks the fixture played with finite integer goals and no event log', () => {
    for (let i = 0; i < 50; i++) {
      const out = resolveCatchUpFixture(fixture, strong, weak);
      expect(out.played).toBe(true);
      expect(Number.isInteger(out.homeGoals)).toBe(true);
      expect(Number.isInteger(out.awayGoals)).toBe(true);
      expect(out.homeGoals).toBeGreaterThanOrEqual(0);
      expect(out.awayGoals).toBeGreaterThanOrEqual(0);
      expect(out.events).toEqual([]);
    }
  });

  it('keeps promotion and relegation plausible — the better side wins the run of games', () => {
    // Not per-match: a Poisson draw can go either way. Over a season's worth of
    // catch-up fixtures the stronger side must come out ahead, or fast-forwarding
    // a division would scramble its table.
    let strongPoints = 0;
    let weakPoints = 0;
    for (let i = 0; i < 200; i++) {
      const out = resolveCatchUpFixture(fixture, strong, weak);
      if (out.homeGoals > out.awayGoals) strongPoints += 3;
      else if (out.homeGoals < out.awayGoals) weakPoints += 3;
      else { strongPoints += 1; weakPoints += 1; }
    }
    expect(strongPoints).toBeGreaterThan(weakPoints);
  });

  it('tolerates empty squads instead of producing NaN scores', () => {
    const out = resolveCatchUpFixture(fixture, [], []);
    expect(Number.isNaN(out.homeGoals)).toBe(false);
    expect(Number.isNaN(out.awayGoals)).toBe(false);
  });
});
