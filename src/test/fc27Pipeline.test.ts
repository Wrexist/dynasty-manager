/**
 * Guards the FC27 data pipeline's contracts.
 *
 * These are the invariants that, if broken, produce a dataset that looks fine
 * and is wrong: a fabricated potential, a mis-split gender, a mangled CSV
 * cell, or a comparison that silently degrades from id matching to name
 * matching. The extractor's network path is not exercised here — it is
 * covered by the fixture run documented in docs/fc27/README.md.
 */
import { describe, it, expect } from 'vitest';
// The pipeline is plain ESM JS by design — it runs under bare `node` with no
// build step, the same as every other script in scripts/.
import { parseCsv, toCsv, csvCell } from '../../scripts/fc27/lib/csv.mjs';
import { normalizeEaPlayer, deriveAge, normalizeFoot, isMale, isFemale } from '../../scripts/fc27/lib/schema.mjs';
import { dedupeById, splitByGender } from '../../scripts/fc27/normalize_fc27.mjs';
import { matchPlayers, normName } from '../../scripts/fc27/compare_fc25.mjs';
import { analyse } from '../../scripts/fc27/validate_fc27.mjs';
import { mergePotential } from '../../scripts/fc27/merge_potential.mjs';
import { toGameRow, buildLeagueMap, GAME_COLUMNS } from '../../scripts/fc27/export_for_game.mjs';

const META = {
  source: 'ea-drop-api',
  sourceUrlTemplate: 'https://example.invalid/{id}',
  dataVersion: 'fc27',
  scrapedAt: '2026-08-27T00:00:00.000Z',
  asOf: new Date('2026-08-27T00:00:00.000Z'),
};

const rawPlayer = (over: Record<string, unknown> = {}) => ({
  id: 1,
  firstName: 'Test',
  lastName: 'Player',
  overallRating: 80,
  birthdate: '2000-01-01',
  preferredFoot: 1,
  gender: { label: 'Male' },
  position: { shortLabel: 'ST' },
  stats: { pace: { value: 70 }, physicality: { value: 75 } },
  ...over,
});

describe('fc27 csv', () => {
  it('round-trips quoted commas, quotes and newlines', () => {
    const rows = [{ a: 'x,y', b: 'he said "hi"', c: 'line1\nline2' }];
    expect(parseCsv(toCsv(['a', 'b', 'c'], rows))).toEqual(rows);
  });

  it('encodes a missing value as empty, never as zero', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(0)).toBe('0');
  });
});

describe('fc27 normalization', () => {
  it('never fabricates potential — EA does not supply it', () => {
    const row = normalizeEaPlayer(rawPlayer(), META);
    expect(row.potential).toBeNull();
    expect(row.potential_source).toBeNull();
    expect(row.overall).toBe(80);
  });

  it('labels computed age as derived and leaves it null without a birthdate', () => {
    expect(deriveAge('2000-06-29', new Date('2026-08-27'))).toBe(26);
    expect(deriveAge('2000-12-29', new Date('2026-08-27'))).toBe(25);
    expect(deriveAge(null, new Date('2026-08-27'))).toBeNull();
    expect(normalizeEaPlayer(rawPlayer({ birthdate: null }), META).derived_age).toBeNull();
  });

  it('preserves EA stat keys the schema has no slot for', () => {
    const row = normalizeEaPlayer(rawPlayer({ stats: { brandNewStat: { value: 42 } } }), META);
    expect(row.stat_brandNewStat).toBe(42);
  });

  it('splits PlayStyles from PlayStyles+', () => {
    const row = normalizeEaPlayer(rawPlayer({
      playerAbilities: [
        { label: 'Technical', type: { id: 'playStyle' } },
        { label: 'Finesse Shot', type: { id: 'playStylePlus' } },
      ],
    }), META);
    expect(row.playstyles).toBe('Technical');
    expect(row.playstyles_plus).toBe('Finesse Shot');
  });

  it('maps the numeric preferred-foot code', () => {
    expect(normalizeFoot(1)).toBe('Right');
    expect(normalizeFoot(2)).toBe('Left');
    expect(normalizeFoot('Left')).toBe('Left');
    expect(normalizeFoot(null)).toBeNull();
  });
});

describe('fc27 gender split', () => {
  it('uses the explicit gender field and never assumes male', () => {
    const rows = [
      normalizeEaPlayer(rawPlayer({ id: 1 }), META),
      normalizeEaPlayer(rawPlayer({ id: 2, gender: { label: 'Female' } }), META),
      normalizeEaPlayer(rawPlayer({ id: 3, gender: null }), META),
    ];
    const split = splitByGender(rows);
    expect(split.male.map((r: { player_id: number }) => r.player_id)).toEqual([1]);
    expect(split.female.map((r: { player_id: number }) => r.player_id)).toEqual([2]);
    // The gender-less record is quarantined, not silently counted as a man.
    expect(split.unknown.map((r: { player_id: number }) => r.player_id)).toEqual([3]);
    expect(isMale(rows[0])).toBe(true);
    expect(isFemale(rows[1])).toBe(true);
  });
});

describe('fc27 dedupe', () => {
  it('collapses repeated ids from overlapping pages and reports them', () => {
    const rows = [{ player_id: 1 }, { player_id: 1 }, { player_id: 2 }];
    const { rows: deduped, duplicates } = dedupeById(rows);
    expect(deduped).toHaveLength(2);
    expect(duplicates).toEqual([{ player_id: 1, count: 2 }]);
  });
});

describe('fc27 comparison matching', () => {
  it('prefers the id tier and reports which tier each pair used', () => {
    const base = [{ id: '10', name: 'A Player', dob: '2000-01-01', club: 'X', position: 'ST', overall: 80, potential: 85 }];
    const current = [{ id: '10', name: 'A Player', dob: '2000-01-01', club: 'X', position: 'ST', overall: 82, potential: 85 }];
    const result = matchPlayers(current, base);
    expect(result.tiers).toEqual({ id: 1 });
    expect(result.newPlayers).toHaveLength(0);
  });

  it('refuses to match an ambiguous name when ids are absent', () => {
    const base = [
      { id: '', name: 'Same Name', dob: '', club: 'X', position: 'ST', overall: 70, potential: null },
      { id: '', name: 'Same Name', dob: '', club: 'X', position: 'ST', overall: 60, potential: null },
    ];
    const current = [{ id: '', name: 'Same Name', dob: '', club: 'X', position: 'ST', overall: 71, potential: null }];
    // Both baseline rows share the name+club key, so the key is dropped rather
    // than resolved by coin flip: the player is reported as new instead.
    expect(matchPlayers(current, base).newPlayers).toHaveLength(1);
  });

  it('folds accents so the same player matches across sources', () => {
    expect(normName('Nicolò Barella')).toBe(normName('Nicolo Barella'));
  });
});

describe('fc27 validation', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    player_id: '1', name: 'A', overall: '80', position: 'ST', potential: '',
    derived_age: '25', preferred_foot: 'Right', club: 'X', league: 'L',
    nationality: 'N', date_of_birth: '2000-01-01', ...over,
  });

  it('fails a truncated extraction rather than calling it a small database', () => {
    const result = analyse([row()], { minExpected: 15000 });
    expect(result.hard.join(' ')).toMatch(/Only 1 players/);
  });

  it('fails duplicate ids and out-of-range overalls', () => {
    const result = analyse([row(), row(), row({ player_id: '2', overall: '140' })], { minExpected: 1 });
    expect(result.hard.join(' ')).toMatch(/duplicate player_id/);
    expect(result.hard.join(' ')).toMatch(/overall outside/);
  });

  it('treats an all-null potential column as advisory, not a failure', () => {
    const result = analyse([row()], { minExpected: 1 });
    expect(result.hard).toHaveLength(0);
    expect(result.soft.join(' ')).toMatch(/No potential values present/);
  });
});

describe('fc27 potential merge', () => {
  const provider = [
    { id: '10', name: 'A Player', dob: '2000-01-01', club: 'X', league: 'L', position: 'ST', overall: 80, potential: 88 },
    { id: '11', name: 'B Player', dob: '2001-01-01', club: 'Y', league: 'L', position: 'CM', overall: 70, potential: null },
  ];
  const row = (over: Record<string, unknown> = {}) => ({
    player_id: '10', name: 'A Player', first_name: 'A', last_name: 'Player',
    date_of_birth: '2000-01-01', club: 'X', league: 'L', position: 'ST',
    overall: '80', potential: '', potential_source: '', ...over,
  });

  it('fills potential and stamps where it came from', () => {
    const rows = [row()];
    const result = mergePotential(rows, provider, { label: 'fc26-carryover' });
    expect(rows[0].potential).toBe(88);
    expect(rows[0].potential_source).toBe('fc26-carryover');
    expect(result.filled).toBe(1);
  });

  it('never overwrites a potential that is already present', () => {
    const rows = [row({ potential: '91', potential_source: 'cmtracker' })];
    const result = mergePotential(rows, provider, { label: 'fc26-carryover' });
    expect(rows[0].potential).toBe('91');
    expect(rows[0].potential_source).toBe('cmtracker');
    expect(result.alreadyPresent).toBe(1);
  });

  it('leaves potential empty when the provider has none for that player', () => {
    const rows = [row({ player_id: '11', name: 'B Player', date_of_birth: '2001-01-01', club: 'Y', overall: '70' })];
    const result = mergePotential(rows, provider, { label: 'fc26-carryover' });
    expect(rows[0].potential).toBe('');
    expect(result.filled).toBe(0);
    expect(result.matchedWithoutPotential).toBe(1);
  });

  it('leaves unmatched players untouched rather than guessing', () => {
    const rows = [row({ player_id: '999', name: 'Unknown', date_of_birth: '1999-09-09', club: 'Z' })];
    mergePotential(rows, provider, { label: 'fc26-carryover' });
    expect(rows[0].potential).toBe('');
    expect(rows[0].potential_source).toBe('');
  });

  it('only clamps potential below overall when asked, and says so in the stamp', () => {
    const low = [{ ...provider[0], potential: 75 }];
    const off = [row()];
    mergePotential(off, low, { label: 'p' });
    expect(off[0].potential).toBe(75);
    expect(off[0].potential_source).toBe('p');

    const on = [row()];
    const result = mergePotential(on, low, { label: 'p', clamp: true });
    expect(on[0].potential).toBe(80);
    expect(on[0].potential_source).toBe('p+clamped-to-overall');
    expect(result.clamped).toBe(1);
  });
});

describe('fc27 game export', () => {
  const leagueMap = buildLeagueMap('league_id,league_name\n53,La Liga\n13,Premier League\n');

  it('emits every column processFC26.mjs reads', () => {
    const required = [
      'player_id', 'short_name', 'long_name', 'player_positions', 'overall', 'potential',
      'age', 'nationality_name', 'height_cm', 'weight_kg', 'skill_moves', 'club_name',
      'league_id', 'league_name', 'pace', 'shooting', 'passing', 'dribbling', 'defending',
      'physic', 'goalkeeping_diving', 'goalkeeping_handling', 'goalkeeping_kicking',
      'goalkeeping_positioning', 'goalkeeping_reflexes', 'mentality_composure',
      'movement_reactions', 'mentality_vision',
    ];
    for (const column of required) expect(GAME_COLUMNS).toContain(column);
  });

  it('renames physical to the physic column the game expects', () => {
    expect(toGameRow({ physical: '85', league: 'La Liga' }, leagueMap).physic).toBe('85');
  });

  it('resolves league_id by name and leaves it empty when unknown', () => {
    expect(toGameRow({ league: 'La Liga' }, leagueMap).league_id).toBe('53');
    expect(toGameRow({ league: 'Some Other League' }, leagueMap).league_id).toBe('');
    expect(toGameRow({ league: '' }, leagueMap).league_id).toBe('');
  });

  it('carries derived_age across without inventing one', () => {
    expect(toGameRow({ derived_age: '26' }, leagueMap).age).toBe('26');
    expect(toGameRow({}, leagueMap).age).toBe('');
  });

  it('leaves goalkeeping_speed empty because EA does not publish it', () => {
    expect(toGameRow({ gk_diving: '80' }, leagueMap).goalkeeping_speed).toBe('');
  });
});

describe('fc27 merge on in-memory normalizer rows', () => {
  it('fills a null potential, not just an empty-string one', () => {
    // Rows straight from the normalizer carry null; rows parsed back from CSV
    // carry ''. Both mean "not supplied" and both must be fillable.
    const rows = [{
      player_id: '10', name: 'A Player', first_name: 'A', last_name: 'Player',
      date_of_birth: '2000-01-01', club: 'X', league: 'L', position: 'ST',
      overall: 80, potential: null, potential_source: null,
    }];
    const provider = [{ id: '10', name: 'A Player', dob: '2000-01-01', club: 'X', league: 'L', position: 'ST', overall: 80, potential: 88 }];
    const result = mergePotential(rows, provider, { label: 'p' });
    expect(rows[0].potential).toBe(88);
    expect(result.filled).toBe(1);
    expect(result.alreadyPresent).toBe(0);
  });
});
