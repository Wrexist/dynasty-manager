import { describe, it, expect, beforeEach } from 'vitest';
import { generatePlayer, generateSquad, selectBestLineup, getTeamStrength, calculateOverall, pickNameForNationality } from '@/utils/playerGen';
import { resetRealPlayerClaims } from '@/utils/realPlayerPicker';
import { Position, Player, PlayerAttributes, FormationType } from '@/types/game';
import { SQUAD_TEMPLATE, MAX_SUBS, PLAYER_MIN_AGE, PLAYER_AGE_RANGE } from '@/config/playerGeneration';

// Real-player claims are module-level. Reset before every test so squads
// generated in one case don't poison the next case's random pool.
beforeEach(() => resetRealPlayerClaims());

// ── Helper ──

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: crypto.randomUUID(),
    firstName: 'Test', lastName: 'Player',
    age: 25, nationality: 'England', position: 'CM' as Position,
    attributes: { pace: 70, shooting: 70, passing: 70, defending: 70, physical: 70, mental: 70 },
    overall: 70, potential: 75, clubId: 'test', wage: 10000, value: 5_000_000,
    contractEnd: 3, fitness: 90, morale: 70, form: 70,
    injured: false, injuryWeeks: 0,
    goals: 0, assists: 0, appearances: 0,
    careerGoals: 0, careerAssists: 0, careerAppearances: 0,
    yellowCards: 0, redCards: 0,
    personality: { ambition: 12, professionalism: 12, loyalty: 12, temperament: 12, leadership: 10 },
    joinedSeason: 1,
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────
//  generatePlayer
// ────────────────────────────────────────────────────────────

describe('generatePlayer', () => {
  it('returns a valid player with all required fields', () => {
    const p = generatePlayer('ST', 70, 'club1', 1);
    expect(p.id).toBeTruthy();
    expect(p.firstName).toBeTruthy();
    expect(p.lastName).toBeTruthy();
    expect(p.position).toBe('ST');
    expect(p.clubId).toBe('club1');
    expect(p.overall).toBeGreaterThan(0);
    expect(p.overall).toBeLessThanOrEqual(99);
    expect(p.potential).toBeGreaterThanOrEqual(p.overall);
    expect(p.value).toBeGreaterThan(0);
    expect(p.wage).toBeGreaterThan(0);
    expect(p.fitness).toBeGreaterThan(0);
    expect(p.morale).toBeGreaterThan(0);
    expect(p.form).toBeGreaterThan(0);
    expect(p.injured).toBe(false);
    expect(p.goals).toBe(0);
    expect(p.assists).toBe(0);
    expect(p.appearances).toBe(0);
    expect(p.personality).toBeTruthy();
  });

  it('generates age within valid range', () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePlayer('CM', 65, 'c', 1);
      expect(p.age).toBeGreaterThanOrEqual(PLAYER_MIN_AGE);
      expect(p.age).toBeLessThanOrEqual(PLAYER_MIN_AGE + PLAYER_AGE_RANGE - 1);
    }
  });

  it('generates all 6 attributes', () => {
    const p = generatePlayer('GK', 75, 'c', 1);
    const attrs = p.attributes;
    expect(attrs.pace).toBeDefined();
    expect(attrs.shooting).toBeDefined();
    expect(attrs.passing).toBeDefined();
    expect(attrs.defending).toBeDefined();
    expect(attrs.physical).toBeDefined();
    expect(attrs.mental).toBeDefined();
  });

  it('clamps attributes to 1-99', () => {
    // Generate 100 players at extreme qualities to test clamping
    for (let i = 0; i < 100; i++) {
      const q = i < 50 ? 10 : 95;
      const p = generatePlayer('ST', q, 'c', 1);
      for (const val of Object.values(p.attributes)) {
        expect(val).toBeGreaterThanOrEqual(1);
        expect(val).toBeLessThanOrEqual(99);
      }
    }
  });

  it('generates correct position profiles (GK has high defending, ST has high shooting)', () => {
    // Statistical test: average over many players
    const gkAttrs = Array.from({ length: 100 }, () => generatePlayer('GK', 70, 'c', 1).attributes);
    const stAttrs = Array.from({ length: 100 }, () => generatePlayer('ST', 70, 'c', 1).attributes);

    const avgGkDef = gkAttrs.reduce((s, a) => s + a.defending, 0) / 100;
    const avgGkShoot = gkAttrs.reduce((s, a) => s + a.shooting, 0) / 100;
    expect(avgGkDef).toBeGreaterThan(avgGkShoot); // GKs better at defending than shooting

    const avgStShoot = stAttrs.reduce((s, a) => s + a.shooting, 0) / 100;
    const avgStDef = stAttrs.reduce((s, a) => s + a.defending, 0) / 100;
    expect(avgStShoot).toBeGreaterThan(avgStDef); // Strikers better at shooting than defending
  });

  it('handles all valid positions without error', () => {
    const positions: Position[] = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];
    for (const pos of positions) {
      const p = generatePlayer(pos, 65, 'c', 1);
      expect(p.position).toBe(pos);
      expect(p.overall).toBeGreaterThan(0);
    }
  });

  it('contract end is in the future relative to season', () => {
    const p = generatePlayer('CM', 70, 'c', 5);
    expect(p.contractEnd).toBeGreaterThan(5);
  });

  it('unique IDs across generated players', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const p = generatePlayer('CM', 70, 'c', 1);
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
    }
  });
});

// ────────────────────────────────────────────────────────────
//  calculateOverall
// ────────────────────────────────────────────────────────────

describe('calculateOverall', () => {
  it('returns a value clamped between 1 and 99', () => {
    const low: PlayerAttributes = { pace: 1, shooting: 1, passing: 1, defending: 1, physical: 1, mental: 1 };
    const high: PlayerAttributes = { pace: 99, shooting: 99, passing: 99, defending: 99, physical: 99, mental: 99 };
    expect(calculateOverall(low, 'CM')).toBeGreaterThanOrEqual(1);
    expect(calculateOverall(high, 'CM')).toBeLessThanOrEqual(99);
  });

  it('position weights affect the calculation (GK values defending more than shooting)', () => {
    const defHeavy: PlayerAttributes = { pace: 50, shooting: 30, passing: 50, defending: 90, physical: 60, mental: 80 };
    const shootHeavy: PlayerAttributes = { pace: 50, shooting: 90, passing: 50, defending: 30, physical: 60, mental: 80 };
    const gkDef = calculateOverall(defHeavy, 'GK');
    const gkShoot = calculateOverall(shootHeavy, 'GK');
    expect(gkDef).toBeGreaterThan(gkShoot); // GK overall should favor defending
  });

  it('returns same value for same inputs', () => {
    const attrs: PlayerAttributes = { pace: 70, shooting: 65, passing: 75, defending: 60, physical: 68, mental: 72 };
    expect(calculateOverall(attrs, 'CM')).toBe(calculateOverall(attrs, 'CM'));
  });
});

// ────────────────────────────────────────────────────────────
//  generateSquad
// ────────────────────────────────────────────────────────────

describe('generateSquad', () => {
  it('generates a squad matching SQUAD_TEMPLATE size', () => {
    const squad = generateSquad('test-club', 65, 1);
    expect(squad.length).toBe(SQUAD_TEMPLATE.length);
  });

  it('all players have the correct clubId', () => {
    const squad = generateSquad('my-club', 70, 1);
    for (const p of squad) {
      expect(p.clubId).toBe('my-club');
    }
  });

  it('covers all required positions from SQUAD_TEMPLATE', () => {
    const squad = generateSquad('c', 70, 1);
    const posCounts: Record<string, number> = {};
    for (const p of squad) {
      posCounts[p.position] = (posCounts[p.position] || 0) + 1;
    }
    // At minimum, should have GKs, defenders, midfielders, and forwards
    expect(posCounts['GK']).toBeGreaterThanOrEqual(2);
    expect((posCounts['CB'] || 0) + (posCounts['LB'] || 0) + (posCounts['RB'] || 0)).toBeGreaterThanOrEqual(4);
    expect((posCounts['ST'] || 0) + (posCounts['LW'] || 0) + (posCounts['RW'] || 0)).toBeGreaterThanOrEqual(3);
  });

  it('unique player IDs within a squad', () => {
    const squad = generateSquad('c', 70, 1);
    const ids = squad.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('higher quality produces higher average overall', () => {
    // Average across several seeds — fillers now pull from the real-player
    // pool with a quality-banded filter, so any single squad can drift if
    // a position is starved within the band.
    const avgFor = (quality: number): number => {
      let total = 0;
      const SAMPLES = 4;
      for (let i = 0; i < SAMPLES; i++) {
        resetRealPlayerClaims();
        const squad = generateSquad(`c-${quality}-${i}`, quality, 1);
        total += squad.reduce((s, p) => s + p.overall, 0) / squad.length;
      }
      return total / SAMPLES;
    };
    expect(avgFor(80)).toBeGreaterThan(avgFor(45));
  });

  it('has a star player boost (at least one filler above base quality)', () => {
    // Over several generations, the star player should be notably above the base quality
    let starFound = false;
    for (let i = 0; i < 10; i++) {
      const squad = generateSquad('no-template-club', 60, 1);
      const maxOvr = Math.max(...squad.map(p => p.overall));
      if (maxOvr >= 68) { starFound = true; break; } // 60 + 8 min star boost
    }
    expect(starFound).toBe(true);
  });

  it('generates valid ages for all players', () => {
    const squad = generateSquad('c', 70, 1);
    for (const p of squad) {
      // Procedural fillers stay within the age buckets (≤34), but real
      // FC26 players can be active into their early 40s — accept either.
      expect(p.age).toBeGreaterThanOrEqual(17);
      expect(p.age).toBeLessThanOrEqual(44);
    }
  });
});

// ────────────────────────────────────────────────────────────
//  selectBestLineup
// ────────────────────────────────────────────────────────────

describe('selectBestLineup', () => {
  it('selects 11 starters for a 4-3-3 formation', () => {
    const squad = generateSquad('c', 70, 1);
    const { lineup } = selectBestLineup(squad, '4-3-3');
    expect(lineup.length).toBe(11);
  });

  it('selects correct number of subs (up to MAX_SUBS)', () => {
    const squad = generateSquad('c', 70, 1);
    const { subs } = selectBestLineup(squad, '4-3-3');
    expect(subs.length).toBeLessThanOrEqual(MAX_SUBS);
    expect(subs.length).toBeGreaterThan(0);
  });

  it('lineup and subs have no duplicate players', () => {
    const squad = generateSquad('c', 70, 1);
    const { lineup, subs } = selectBestLineup(squad, '4-3-3');
    const allIds = [...lineup.map(p => p.id), ...subs.map(p => p.id)];
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('excludes injured players from lineup', () => {
    const squad = generateSquad('c', 70, 1);
    // Injure first 3 outfield players
    squad.filter(p => p.position !== 'GK').slice(0, 3).forEach(p => { p.injured = true; });
    const { lineup } = selectBestLineup(squad, '4-3-3');
    for (const p of lineup) {
      expect(p.injured).toBe(false);
    }
  });

  it('excludes suspended players when currentWeek is provided', () => {
    const squad = generateSquad('c', 70, 1);
    const outfield = squad.filter(p => p.position !== 'GK');
    outfield[0].suspendedUntilWeek = 10;
    const { lineup } = selectBestLineup(squad, '4-3-3', 5);
    expect(lineup.find(p => p.id === outfield[0].id)).toBeUndefined();
  });

  it('works for all 7 formations', () => {
    const formations: FormationType[] = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1', '4-1-4-1', '3-4-3', '5-3-2'];
    const squad = generateSquad('c', 70, 1);
    for (const f of formations) {
      const { lineup } = selectBestLineup(squad, f);
      expect(lineup.length).toBe(11);
    }
  });

  it('prefers higher-rated players', () => {
    const squad = generateSquad('c', 70, 1);
    const { lineup, subs } = selectBestLineup(squad, '4-3-3');
    const lineupAvg = lineup.reduce((s, p) => s + p.overall, 0) / lineup.length;
    const subAvg = subs.reduce((s, p) => s + p.overall, 0) / subs.length;
    // selectBestLineup uses effective rating (overall × 0.6 + form/100 × 10
    // + fitness/100 × 5), so a sub with great form/fitness can occasionally
    // outrank a slightly-better-overall starter at the same position.
    // Allow 1 OVR drift to absorb that stochastic edge case without losing
    // the broader "lineup beats bench on average" invariant.
    expect(lineupAvg).toBeGreaterThanOrEqual(subAvg - 1);
  });

  it('handles empty squad without crash', () => {
    const { lineup, subs } = selectBestLineup([], '4-3-3');
    expect(lineup.length).toBe(0);
    expect(subs.length).toBe(0);
  });

  it('handles very small squad (fewer than 11)', () => {
    const smallSquad = Array.from({ length: 5 }, (_, i) =>
      makePlayer({ id: `p${i}`, position: i === 0 ? 'GK' : 'CM' as Position })
    );
    const { lineup } = selectBestLineup(smallSquad, '4-3-3');
    expect(lineup.length).toBeLessThanOrEqual(5);
    expect(lineup.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
//  getTeamStrength
// ────────────────────────────────────────────────────────────

describe('getTeamStrength', () => {
  it('returns minimum for empty array', () => {
    expect(getTeamStrength([])).toBe(30); // MIN_TEAM_STRENGTH
  });

  it('higher rated squad has higher strength', () => {
    const weakSquad = Array.from({ length: 11 }, () => makePlayer({ overall: 50, fitness: 80, morale: 70 }));
    const strongSquad = Array.from({ length: 11 }, () => makePlayer({ overall: 85, fitness: 80, morale: 70 }));
    expect(getTeamStrength(strongSquad)).toBeGreaterThan(getTeamStrength(weakSquad));
  });

  it('fitness affects team strength', () => {
    const fitSquad = Array.from({ length: 11 }, () => makePlayer({ overall: 70, fitness: 100, morale: 70 }));
    const tiredSquad = Array.from({ length: 11 }, () => makePlayer({ overall: 70, fitness: 40, morale: 70 }));
    expect(getTeamStrength(fitSquad)).toBeGreaterThan(getTeamStrength(tiredSquad));
  });

  it('morale affects team strength', () => {
    const happySquad = Array.from({ length: 11 }, () => makePlayer({ overall: 70, fitness: 80, morale: 100 }));
    const sadSquad = Array.from({ length: 11 }, () => makePlayer({ overall: 70, fitness: 80, morale: 20 }));
    expect(getTeamStrength(happySquad)).toBeGreaterThan(getTeamStrength(sadSquad));
  });

  it('returns a positive number for valid squads', () => {
    const squad = generateSquad('c', 70, 1);
    const { lineup } = selectBestLineup(squad, '4-3-3');
    expect(getTeamStrength(lineup)).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
//  pickNameForNationality
// ────────────────────────────────────────────────────────────

describe('pickNameForNationality', () => {
  it('returns a name for known nationalities', () => {
    const { firstName, lastName } = pickNameForNationality('England');
    expect(firstName).toBeTruthy();
    expect(lastName).toBeTruthy();
  });

  it('returns a fallback name for unknown nationality', () => {
    const { firstName, lastName } = pickNameForNationality('Narnia');
    expect(firstName).toBeTruthy();
    expect(lastName).toBeTruthy();
  });
});
