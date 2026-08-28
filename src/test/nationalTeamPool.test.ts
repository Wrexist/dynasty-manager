import { describe, it, expect } from 'vitest';
import {
  generateNationalTeamPool,
  autoSelectNationalSquad,
  resolveNationalityAliases,
} from '@/utils/international';
import { NATIONAL_PLAYER_POOL } from '@/data/nationalPlayerPool';
import type { Player, Position } from '@/types/game';

/** Minimal England-eligible player. Only the fields autoSelectNationalSquad
 *  reads are meaningful; the rest exist to satisfy the Player shape. */
function mkNatPlayer(id: string, position: Position, overall: number, over: Partial<Player> = {}): Player {
  return {
    id, firstName: id, lastName: id, nationality: 'England', age: 25, position, overall, potential: overall,
    attributes: { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50, mental: 50 },
    clubId: '', wage: 0, value: 0, contractEnd: 2, fitness: 95, morale: 80, form: 70, injured: false, injuryWeeks: 0,
    goals: 0, assists: 0, appearances: 0, careerGoals: 0, careerAssists: 0, careerAppearances: 0, yellowCards: 0, redCards: 0,
    personality: { professionalism: 10, ambition: 10, temperament: 10, loyalty: 10, leadership: 10 },
    appearance: { skinTone: 2, hairStyle: 2, hairColor: 2, height: 1, build: 1, facialHair: 0 },
    skillMoves: 2, joinedSeason: 1,
    ...over,
  } as Player;
}

/** `n` fit, unsuspended players whose positions cover the squad minimums
 *  (2 GK / 5 DEF / 4 MID / 2 FWD) for any n >= 13. */
function mkNatPool(n: number): Record<string, Player> {
  const shape: Position[] = ['GK', 'GK', 'CB', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'CDM', 'CAM', 'ST', 'LW', 'RW', 'ST', 'CB', 'CM', 'GK', 'RB', 'LB', 'CAM', 'RW', 'LW', 'CDM'];
  const out: Record<string, Player> = {};
  for (let i = 0; i < n; i++) {
    const id = `pool${i}`;
    out[id] = mkNatPlayer(id, shape[i % shape.length], 70);
  }
  return out;
}

describe('National Team Real-Player Pool', () => {
  it('resolves Ivory Coast to Côte d\'Ivoire', () => {
    const aliases = resolveNationalityAliases('Ivory Coast');
    expect(aliases).toContain('Ivory Coast');
    expect(aliases).toContain("Côte d'Ivoire");
  });

  it('resolves Netherlands to Holland', () => {
    expect(resolveNationalityAliases('Netherlands')).toContain('Holland');
  });

  it('resolves USA to United States, South Korea to Korea Republic, Ireland to Republic of Ireland', () => {
    expect(resolveNationalityAliases('USA')).toContain('United States');
    expect(resolveNationalityAliases('South Korea')).toContain('Korea Republic');
    expect(resolveNationalityAliases('Ireland')).toContain('Republic of Ireland');
  });

  it('generates a pool containing real FC26 players for France', () => {
    const pool = generateNationalTeamPool('France', {}, 1);
    const names = Object.values(pool).map(p => `${p.firstName} ${p.lastName}`);
    // Mbappé, Griezmann are the top France players in the FC26 pool
    expect(names.some(n => n.includes('Mbappé'))).toBe(true);
    expect(names.some(n => n.includes('Griezmann'))).toBe(true);
    // All players should be tagged with the canonical game nationality
    Object.values(pool).forEach(p => expect(p.nationality).toBe('France'));
  });

  it('generates real players for Ivory Coast (alias to Côte d\'Ivoire)', () => {
    const pool = generateNationalTeamPool('Ivory Coast', {}, 1);
    expect(Object.keys(pool).length).toBeGreaterThan(0);
    // All new players should be normalized to the canonical name
    Object.values(pool).forEach(p => expect(p.nationality).toBe('Ivory Coast'));
    // Should contain real Ivorian stars. Which KEY the data sits under is not
    // part of the contract — the source CSV may label the nation either way, and
    // only `resolveNationalityAliases` is allowed to know that. Merge across the
    // aliases exactly as `getRealPoolForNationality` does, or this test starts
    // failing the day the dataset switches to the canonical label (it did: the
    // FC27 export writes "Ivory Coast", so the "Côte d'Ivoire" key is absent).
    const names = Object.values(pool).map(p => p.lastName);
    const realPool = resolveNationalityAliases('Ivory Coast')
      .flatMap(n => NATIONAL_PLAYER_POOL[n] ?? []);
    expect(realPool.length).toBeGreaterThan(0);
    expect(names).toContain(realPool[0].ln);
  });

  it('skips pool entries that duplicate existing in-game players', () => {
    // Seed with a fake Mbappé already in a club
    const existing: Record<string, Player> = {
      mbappe: {
        id: 'mbappe',
        firstName: 'Kylian',
        lastName: 'Mbappé',
        nationality: 'France',
        age: 25,
        position: 'ST',
        overall: 91,
        potential: 93,
        attributes: { pace: 97, shooting: 90, passing: 80, defending: 36, physical: 78, mental: 88 },
        clubId: 'some-club',
        wage: 500_000,
        value: 180_000_000,
        contractEnd: 3,
        fitness: 100,
        morale: 80,
        form: 70,
        injured: false,
        injuryWeeks: 0,
        goals: 0, assists: 0, appearances: 0,
        careerGoals: 0, careerAssists: 0, careerAppearances: 0,
        yellowCards: 0, redCards: 0,
        personality: { professionalism: 10, ambition: 10, temperament: 10, loyalty: 10, leadership: 10 },
        appearance: { skinTone: 2, hairStyle: 2, hairColor: 2, height: 1, build: 1, facialHair: 0 },
        skillMoves: 5,
        joinedSeason: 1,
      },
    };
    const pool = generateNationalTeamPool('France', existing, 1);
    const mbappeInPool = Object.values(pool).filter(p => p.lastName === 'Mbappé');
    expect(mbappeInPool.length).toBe(0); // dedup worked
  });

  it('falls back to procedural generation when a nation has no FC26 pool entry', () => {
    // Pick an obviously-missing nation name
    const pool = generateNationalTeamPool('Atlantis', {}, 1);
    // Still produces a full candidate roster (procedural)
    expect(Object.keys(pool).length).toBeGreaterThan(20);
    Object.values(pool).forEach(p => expect(p.nationality).toBe('Atlantis'));
  });

  it('does not generate procedural fillers that share a surname with a real-pool entry', () => {
    // Repeat with English pool (rich in colliding surnames: James, White, Pope)
    // and verify that the only "James"/"White"/"Pope" entries are the actual
    // real FC26 players, not similarly-named procedurals like "Ryan James"
    // or "Ben White" or "Nathan Pope".
    const realJames = NATIONAL_PLAYER_POOL['England']
      .filter(t => t.ln === 'James')
      .map(t => `${t.fn} ${t.ln}`);
    const realWhite = NATIONAL_PLAYER_POOL['England']
      .filter(t => t.ln === 'White')
      .map(t => `${t.fn} ${t.ln}`);
    const realPope = NATIONAL_PLAYER_POOL['England']
      .filter(t => t.ln === 'Pope')
      .map(t => `${t.fn} ${t.ln}`);

    // Run multiple times to reduce flake from random procedural names
    for (let run = 0; run < 8; run++) {
      const pool = generateNationalTeamPool('England', {}, 1);
      const players = Object.values(pool);

      const jamesPlayers = players
        .filter(p => p.lastName === 'James')
        .map(p => `${p.firstName} ${p.lastName}`);
      const whitePlayers = players
        .filter(p => p.lastName === 'White')
        .map(p => `${p.firstName} ${p.lastName}`);
      const popePlayers = players
        .filter(p => p.lastName === 'Pope')
        .map(p => `${p.firstName} ${p.lastName}`);

      jamesPlayers.forEach(name => expect(realJames).toContain(name));
      whitePlayers.forEach(name => expect(realWhite).toContain(name));
      popePlayers.forEach(name => expect(realPope).toContain(name));
    }
  });

  it('keeps homonymous real players when their fcIds differ', () => {
    // Regression for codex review on PR #500: the old name-based dedup inside
    // the real-pool loop dropped any second template sharing fn|ln, even
    // when fcIds differed. Verify that for any nationality whose pool has a
    // duplicate display name, both fcIds still appear in the produced pool.
    let tested = 0;
    for (const [nationality, templates] of Object.entries(NATIONAL_PLAYER_POOL)) {
      const seen = new Map<string, string[]>(); // nameKey -> fcIds
      for (const t of templates) {
        if (!t.fcId) continue;
        const key = `${t.fn.toLowerCase()}|${t.ln.toLowerCase()}`;
        const list = seen.get(key) ?? [];
        list.push(t.fcId);
        seen.set(key, list);
      }
      const homonyms = [...seen.entries()].filter(([, ids]) => ids.length > 1);
      if (homonyms.length === 0) continue;

      const pool = generateNationalTeamPool(nationality, {}, 1, { communityPackEnabled: true });
      // We can't directly look up by fcId in the produced pool (player IDs
      // are random UUIDs), so check that the count of pool entries with
      // the homonymous display name matches the number of distinct real
      // templates with that name.
      for (const [nameKey, fcIds] of homonyms) {
        const [fn, ln] = nameKey.split('|');
        // Mononym templates (fn === ln) are normalised to firstName: '' at
        // ingestion so they render as "Isco" instead of "Isco Isco" — match
        // either form for those.
        const matches = Object.values(pool).filter(
          p => p.lastName.toLowerCase() === ln
            && (p.firstName.toLowerCase() === fn || (fn === ln && p.firstName === '')),
        );
        expect(matches.length).toBeGreaterThanOrEqual(fcIds.length);
        tested++;
      }
      if (tested >= 3) break; // a few nationalities is enough proof
    }
    // Sanity: we must have actually exercised the homonym path somewhere.
    expect(tested).toBeGreaterThan(0);
  });

  it('with community pack enabled, contains every real player and no procedural fillers', () => {
    const pool = generateNationalTeamPool('England', {}, 1, { communityPackEnabled: true });
    const realPool = NATIONAL_PLAYER_POOL['England'];

    // The pool should contain at least one entry per real-pool player (no cap at 50).
    expect(Object.keys(pool).length).toBeGreaterThanOrEqual(realPool.length);

    // Every real-pool surname should appear in the produced pool.
    const realSurnames = new Set(realPool.map(t => t.ln.toLowerCase()));
    const poolSurnames = new Set(Object.values(pool).map(p => p.lastName.toLowerCase()));
    let matched = 0;
    realSurnames.forEach(ln => { if (poolSurnames.has(ln)) matched++; });
    expect(matched / realSurnames.size).toBeGreaterThan(0.95);
  });

  it('with community pack disabled, caps real players and may add procedural fillers', () => {
    // Off mode: should still respect the legacy 50-target ceiling for real players,
    // and may add procedural fillers up to NT_CANDIDATE_POOL_TARGET total.
    const pool = generateNationalTeamPool('England', {}, 1, { communityPackEnabled: false });
    expect(Object.keys(pool).length).toBeGreaterThan(0);
    // English pool has way more than 50 reals — without the cap we'd see all ~200+;
    // confirm we stayed near the legacy target rather than dumping the full pool.
    expect(Object.keys(pool).length).toBeLessThanOrEqual(60);
  });

  it('autoSelectNationalSquad picks players matching any alias nationality', () => {
    // Two players labeled with different alias forms
    const players: Record<string, Player> = {
      p1: { id: 'p1', firstName: 'A', lastName: 'One', nationality: 'Netherlands', age: 25, position: 'GK', overall: 82, potential: 82, attributes: { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50, mental: 50 }, clubId: '', wage: 0, value: 0, contractEnd: 2, fitness: 100, morale: 80, form: 70, injured: false, injuryWeeks: 0, goals: 0, assists: 0, appearances: 0, careerGoals: 0, careerAssists: 0, careerAppearances: 0, yellowCards: 0, redCards: 0, personality: { professionalism: 10, ambition: 10, temperament: 10, loyalty: 10, leadership: 10 }, appearance: { skinTone: 2, hairStyle: 2, hairColor: 2, height: 1, build: 1, facialHair: 0 }, skillMoves: 2, joinedSeason: 1 },
      p2: { id: 'p2', firstName: 'B', lastName: 'Two', nationality: 'Holland', age: 25, position: 'CB', overall: 80, potential: 80, attributes: { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50, mental: 50 }, clubId: '', wage: 0, value: 0, contractEnd: 2, fitness: 100, morale: 80, form: 70, injured: false, injuryWeeks: 0, goals: 0, assists: 0, appearances: 0, careerGoals: 0, careerAssists: 0, careerAppearances: 0, yellowCards: 0, redCards: 0, personality: { professionalism: 10, ambition: 10, temperament: 10, loyalty: 10, leadership: 10 }, appearance: { skinTone: 2, hairStyle: 2, hairColor: 2, height: 1, build: 1, facialHair: 0 }, skillMoves: 2, joinedSeason: 1 },
    };
    const squad = autoSelectNationalSquad('Netherlands', players);
    expect(squad).toContain('p1');
    expect(squad).toContain('p2'); // "Holland" matches via alias
  });

  it('autoSelectNationalSquad excludes suspended and exhausted players', () => {
    // A top-rated suspended player and a top-rated exhausted player, against a
    // pool deep enough to fill all 23 shirts without them. The lower-rated
    // fresh backup must be picked ahead of both.
    const players: Record<string, Player> = {
      suspended: mkNatPlayer('suspended', 'ST', 90, { fitness: 100, suspendedUntilWeek: 50 }),
      exhausted: mkNatPlayer('exhausted', 'ST', 89, { fitness: 30 }),
      backup: mkNatPlayer('backup', 'ST', 75, { fitness: 95 }),
      ...mkNatPool(23),
    };

    const squad = autoSelectNationalSquad('England', players, 30);
    expect(squad).toHaveLength(23);
    expect(squad).toContain('backup');
    expect(squad).not.toContain('suspended');
    expect(squad).not.toContain('exhausted');
  });

  it('autoSelectNationalSquad relaxes fitness before suspension when the pool cannot fill 23', () => {
    // The squad picker's Confirm requires exactly 23, so a starved pool must
    // still return 23 rather than stranding the player on the screen. The
    // relaxation order matters: a tired player is available to actually play,
    // a suspended one is not, so fitness gives way first.
    const players: Record<string, Player> = {
      suspended: mkNatPlayer('suspended', 'ST', 90, { fitness: 100, suspendedUntilWeek: 50 }),
      exhausted: mkNatPlayer('exhausted', 'ST', 60, { fitness: 30 }),
      ...mkNatPool(22),
    };

    const squad = autoSelectNationalSquad('England', players, 30);
    expect(squad).toHaveLength(23);
    // 22 fresh + the tired one; the suspended 90 stays out despite being best.
    expect(squad).toContain('exhausted');
    expect(squad).not.toContain('suspended');

    // Drop to a pool that cannot reach 23 even with tired players and the
    // suspension filter gives way too — a suspended 23rd man beats a dead save.
    const thin: Record<string, Player> = {
      suspended: mkNatPlayer('suspended', 'ST', 90, { fitness: 100, suspendedUntilWeek: 50 }),
      ...mkNatPool(10),
    };
    expect(autoSelectNationalSquad('England', thin, 30)).toContain('suspended');
  });

  it('autoSelectNationalSquad still picks suspended players when currentWeek is omitted', () => {
    // Backwards-compat: legacy callers (and test cases) without a week
    // hand should ignore the suspension filter rather than throw.
    const players: Record<string, Player> = {
      suspended: mkNatPlayer('suspended', 'ST', 90, { fitness: 100, suspendedUntilWeek: 50 }),
    };
    const squad = autoSelectNationalSquad('England', players);
    expect(squad).toContain('suspended');
  });
});
