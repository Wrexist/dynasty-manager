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
