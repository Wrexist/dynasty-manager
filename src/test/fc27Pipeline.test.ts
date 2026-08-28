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
import { normalizeEaPlayer, deriveAge, normalizeFoot, isMale, isFemale, classifyGender } from '../../scripts/fc27/lib/schema.mjs';
import { dedupeById, splitByGender } from '../../scripts/fc27/normalize_fc27.mjs';
import { matchPlayers, normName, readComparable } from '../../scripts/fc27/lib/players.mjs';
import { parseArgs } from '../../scripts/fc27/lib/args.mjs';
import { sidecarFor } from '../../scripts/fc27/lib/paths.mjs';
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

describe('fc27 cli arguments', () => {
  it('accepts --flag value and --flag=value alike', () => {
    expect(parseArgs(['--limit', '50']).limit).toBe(50);
    expect(parseArgs(['--limit=50']).limit).toBe(50);
    expect(parseArgs(['--fresh']).fresh).toBe(true);
    expect(parseArgs(['--out-dir', '/tmp/x']).outDir).toBe('/tmp/x');
  });

  it('rejects an unknown flag instead of silently ignoring it', () => {
    // A typo'd --merge-potentials must not quietly skip the merge.
    expect(() => parseArgs(['--merge-potentials', 'x.csv'])).toThrow(/Unknown flag/);
  });

  it('rejects a numeric flag given a non-number', () => {
    expect(() => parseArgs(['--limit', 'lots'])).toThrow(/needs a number/);
  });
});

describe('fc27 artifact paths', () => {
  it('writes to the repo locations for a real build', () => {
    const paths = sidecarFor(undefined);
    expect(paths.redirected).toBe(false);
    expect(paths.qualityReport).toMatch(/docs\/fc27-data-quality\.md$/);
  });

  it('moves every artifact next to the dataset when a run is redirected', () => {
    // This is the guard on the bug where a fixture run overwrote the repo's
    // committed comparison and quality reports.
    const paths = sidecarFor('/tmp/run');
    expect(paths.redirected).toBe(true);
    expect(paths.qualityReport).toBe('/tmp/run/fc27-data-quality.md');
    expect(paths.comparisonReport).toBe('/tmp/run/fc25-vs-fc27.md');
    expect(paths.comparisonDir).toBe('/tmp/run/comparison');
    expect(paths.runReport).toBe('/tmp/run/last-run.json');
    expect(paths.gameInput).toBe('/tmp/run/FC27_community_pack_input.csv');
  });
});

describe('fc27 schema shape detection', () => {
  it('reads all three dataset schemas into one comparable shape', () => {
    const sofifa = readComparable('player_id,short_name,long_name,club_name,league_name,player_positions,overall,potential,dob\n1,S. Name,Some Name,Club,League,"ST, CF",80,88,2000-01-01\n');
    expect(sofifa[0]).toMatchObject({ id: '1', club: 'Club', position: 'ST', overall: 80, potential: 88 });

    const eaRatings = readComparable('Name,OVR,Position,Team,League,url\nA Player,77,CM,Club,League,https://www.ea.com/x/a-player/231747\n');
    expect(eaRatings[0]).toMatchObject({ id: '231747', overall: 77, potential: null });

    const normalized = readComparable('player_id,name,first_name,last_name,date_of_birth,club,league,position,overall,potential\n9,N Player,N,Player,1999-02-03,Club,League,GK,70,\n');
    expect(normalized[0]).toMatchObject({ id: '9', position: 'GK', overall: 70, potential: null });
  });
});

describe('fc27 goalkeeper stats', () => {
  it('does not write goalkeeping values into outfield face-stat columns', () => {
    // EA shows a keeper's DIV/HAN/KIC/REF in the same six card boxes, but they
    // are different quantities. Asserting that equivalence would be invention.
    const row = normalizeEaPlayer({
      id: 7, overallRating: 85, gender: { label: 'Male' },
      position: { shortLabel: 'GK' },
      stats: { gkDiving: { value: 86 }, gkHandling: { value: 84 }, gkReflexes: { value: 88 } },
    }, META);
    expect(row.gk_diving).toBe(86);
    expect(row.gk_reflexes).toBe(88);
    expect(row.pace).toBeNull();
    expect(row.shooting).toBeNull();
    expect(row.dribbling).toBeNull();
  });
});

describe('fc27 against the shapes the live EA API actually sends', () => {
  // Every case here was found by running against the real endpoint. The
  // original fixture encoded assumptions instead, so it validated a normalizer
  // that produced null face stats and zero male players on real data.
  const live = (over: Record<string, unknown> = {}) => normalizeEaPlayer({
    id: 209331,
    firstName: 'Mohamed',
    lastName: 'Salah',
    commonName: null,
    overallRating: 91,
    birthdate: '6/15/1992 12:00:00 AM',
    preferredFoot: 2,
    height: 175,
    weight: 72,
    gender: { id: 0, label: "Men's Football" },
    position: { id: '12', shortLabel: 'RM', positionType: { id: 'midfielder', name: 'Midfielder' } },
    alternatePositions: [{ id: '23', shortLabel: 'RW' }],
    team: { id: 9, label: 'Liverpool' },
    nationality: { id: 111, label: 'Egypt' },
    leagueName: 'Premier League',
    // EA abbreviates the face stats in the payload.
    stats: { pac: { value: 89, diff: 0 }, sho: { value: 88 }, pas: { value: 86 }, dri: { value: 90 }, def: { value: 45 }, phy: { value: 76 } },
    playerAbilities: [{ id: 'trait1_64', label: 'Low Driven Shot', type: { id: 'playStyle', label: 'Play Style' } }],
    ...over,
  }, META);

  it('reads the abbreviated face stats EA sends', () => {
    const row = live();
    expect(row.pace).toBe(89);
    expect(row.shooting).toBe(88);
    expect(row.passing).toBe(86);
    expect(row.dribbling).toBe(90);
    expect(row.defending).toBe(45);
    expect(row.physical).toBe(76);
  });

  it("classifies EA's \"Men's Football\" / \"Women's Football\" labels", () => {
    expect(isMale(live())).toBe(true);
    expect(isFemale(live({ gender: { id: 1, label: "Women's Football" } }))).toBe(true);
  });

  it('does not file a women\'s player as a man because "women" contains "men"', () => {
    // The label alone, with no id to fall back on.
    expect(classifyGender({ gender: "Women's Football" })).toBe('female');
    expect(classifyGender({ gender: "Men's Football" })).toBe('male');
  });

  it('trusts the numeric gender id over the label wording', () => {
    // A locale change can reword the label; the id cannot.
    expect(classifyGender({ gender_id: 1, gender: 'Fútbol femenino' })).toBe('female');
    expect(classifyGender({ gender_id: 0, gender: 'anything at all' })).toBe('male');
  });

  it('never assumes male when gender is missing or unrecognised', () => {
    expect(classifyGender({})).toBe('unknown');
    expect(classifyGender({ gender: 'Mixed' })).toBe('unknown');
  });

  it("parses EA's US-format birthdate with its time component", () => {
    expect(live().date_of_birth).toBe('1992-06-15');
  });

  it('maps preferredFoot 2 to Left, as Salah is', () => {
    expect(live().preferred_foot).toBe('Left');
  });
});
