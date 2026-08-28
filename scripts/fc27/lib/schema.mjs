/**
 * Normalized FC27 schema + the EA Drop API -> schema mapping.
 *
 * Two rules govern everything in this file:
 *
 *  1. NEVER INVENT A VALUE. If the source does not carry a field, the cell is
 *     empty (null). `potential` is the field this matters most for: EA's
 *     public ratings API does not expose career-mode potential at all, so it
 *     stays null here and must be merged in from a source that has it. It is
 *     never back-computed from `overall`.
 *  2. ANYTHING DERIVED IS LABELLED. Computed columns carry a `derived_`
 *     prefix (`derived_age`) so no consumer can mistake our arithmetic for
 *     EA's data.
 *
 * The EA record shape mapped below (`items[]` with `stats.<key>.value`,
 * `playerAbilities[].type.id`, `gender.label`) is the shape used by published
 * open-source Drop API clients; see docs/fc27-data-investigation.md § B for
 * the citations. Because EA can rename keys between seasons, unmapped
 * `stats` keys are NOT dropped — they pass through as `stat_<key>` columns
 * and are reported by validate_fc27.mjs.
 */

/** Fixed column order for the emitted CSV. Stable across runs. */
export const COLUMNS = [
  // Identity
  'player_id', 'name', 'first_name', 'last_name', 'short_name',
  // Demographics
  'date_of_birth', 'derived_age', 'nationality', 'nationality_id', 'height', 'weight',
  // Club
  'club', 'club_id', 'league', 'league_id',
  // Position
  'position', 'positions', 'alternative_positions', 'position_type', 'preferred_foot',
  // Ratings
  'overall', 'potential',
  // Pace
  'pace', 'acceleration', 'sprint_speed',
  // Shooting
  'shooting', 'finishing', 'shot_power', 'long_shots', 'volleys', 'penalties', 'positioning',
  // Passing
  'passing', 'vision', 'crossing', 'free_kick_accuracy', 'short_passing', 'long_passing', 'curve',
  // Dribbling
  'dribbling', 'agility', 'balance', 'reactions', 'ball_control', 'composure',
  // Defending
  'defending', 'interceptions', 'heading_accuracy', 'defensive_awareness',
  'standing_tackle', 'sliding_tackle',
  // Physical
  'physical', 'jumping', 'stamina', 'strength', 'aggression',
  // Skill
  'weak_foot', 'skill_moves',
  // Goalkeeping
  'gk_diving', 'gk_handling', 'gk_kicking', 'gk_positioning', 'gk_reflexes',
  // Career / market
  'value', 'wage', 'release_clause', 'contract_until',
  // PlayStyles
  'playstyles', 'playstyles_plus',
  // Gender
  'gender', 'gender_id',
  // Provenance
  'source', 'source_player_id', 'source_url', 'overall_source', 'attributes_source',
  'potential_source', 'data_version', 'scraped_at',
];

/**
 * Normalized attribute column <- candidate EA `stats` keys, first present wins.
 * Multiple candidates exist because EA has spelled the face stats differently
 * across seasons (`physicality` vs `physical`) and the GK face stats reuse the
 * outfield slots on the ratings page.
 */
export const STAT_ALIASES = {
  // Outfield face stats. These deliberately do NOT fall back to goalkeeping
  // stats: a keeper's DIV/HAN/KIC/REF are shown in the same six boxes on EA's
  // card, but they are different quantities, and writing diving into a `pace`
  // column would assert an equivalence the source never makes. A keeper's face
  // stats simply stay empty here, and the gk_* columns below carry the real
  // values. The missing-value table in the quality report shows this clearly.
  // EA abbreviates the six face stats in the payload (`pac`, `sho`, ...) even
  // though the card shows them in full. The long spellings are kept as
  // fallbacks because they are what earlier seasons used.
  pace: ['pac', 'pace'],
  shooting: ['sho', 'shooting'],
  passing: ['pas', 'passing'],
  dribbling: ['dri', 'dribbling'],
  defending: ['def', 'defending'],
  physical: ['phy', 'physicality', 'physical'],

  acceleration: ['acceleration'],
  sprint_speed: ['sprintSpeed'],
  finishing: ['finishing'],
  shot_power: ['shotPower'],
  long_shots: ['longShots'],
  volleys: ['volleys'],
  penalties: ['penalties'],
  positioning: ['attPosition', 'positioning'],
  vision: ['vision'],
  crossing: ['crossing'],
  free_kick_accuracy: ['freeKickAccuracy', 'fkAccuracy'],
  short_passing: ['shortPassing'],
  long_passing: ['longPassing'],
  curve: ['curve'],
  agility: ['agility'],
  balance: ['balance'],
  reactions: ['reactions'],
  ball_control: ['ballControl'],
  composure: ['composure'],
  interceptions: ['interceptions'],
  heading_accuracy: ['headingAccuracy'],
  defensive_awareness: ['defensiveAwareness', 'marking'],
  standing_tackle: ['standingTackle'],
  sliding_tackle: ['slidingTackle'],
  jumping: ['jumping'],
  stamina: ['stamina'],
  strength: ['strength'],
  aggression: ['aggression'],
  gk_diving: ['gkDiving'],
  gk_handling: ['gkHandling'],
  gk_kicking: ['gkKicking'],
  gk_positioning: ['gkPositioning'],
  gk_reflexes: ['gkReflexes'],
};

/** Every EA stats key this file knows how to place. */
export const MAPPED_STAT_KEYS = new Set(Object.values(STAT_ALIASES).flat());

/** Read `stats.<key>` tolerating both `{value: n}` and a bare number. */
function statValue(stats, key) {
  const entry = stats?.[key];
  if (entry === null || entry === undefined) return null;
  if (typeof entry === 'object') {
    const v = entry.value;
    return v === null || v === undefined ? null : v;
  }
  return entry;
}

/** First alias that the payload actually carries, else null. */
function pickStat(stats, aliases) {
  for (const key of aliases) {
    const v = statValue(stats, key);
    if (v !== null) return v;
  }
  return null;
}

/**
 * EA sends preferredFoot as either a label ("Right") or a numeric code.
 * The numeric mapping (1=Right, 2=Left) is the community convention and is
 * re-checked on every run by validate_fc27.mjs, which flags a foot split that
 * is not roughly 3:1 right-footed.
 */
export function normalizeFoot(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'string' && Number.isNaN(Number(raw))) return raw;
  const n = Number(raw);
  if (n === 1) return 'Right';
  if (n === 2) return 'Left';
  return null;
}

/**
 * Whole years between a birthdate and `asOf`. Labelled `derived_age` in the
 * output precisely because EA does not send an age field.
 * @param {string | null} birthdate ISO-ish date string
 * @param {Date} asOf
 * @returns {number | null}
 */
export function deriveAge(birthdate, asOf) {
  if (!birthdate) return null;
  const dob = new Date(birthdate);
  if (Number.isNaN(dob.getTime())) return null;
  let age = asOf.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = asOf.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && asOf.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

/** ISO date portion of whatever date-ish string EA sent. */
function isoDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString().slice(0, 10);
}

const nullIfBlank = (v) => (v === undefined || v === null || v === '' ? null : v);

/**
 * Map one raw EA Drop API player object to a normalized row.
 *
 * @param {Record<string, any>} raw
 * @param {{ source: string, sourceUrlTemplate: string | null, dataVersion: string,
 *           scrapedAt: string, asOf: Date }} meta
 * @returns {Record<string, unknown>}
 */
export function normalizeEaPlayer(raw, meta) {
  const stats = raw.stats ?? {};
  const abilities = raw.playerAbilities ?? [];

  const playstyles = [];
  const playstylesPlus = [];
  for (const ability of abilities) {
    const label = ability?.label ?? '';
    if (!label) continue;
    // Unknown ability types fall through to the plain PlayStyles bucket
    // rather than being dropped — losing a real PlayStyle is worse than
    // mis-filing one, and validate_fc27.mjs reports the type histogram.
    if (ability?.type?.id === 'playStylePlus') playstylesPlus.push(label);
    else playstyles.push(label);
  }

  const firstName = nullIfBlank(raw.firstName);
  const lastName = nullIfBlank(raw.lastName);
  const commonName = nullIfBlank(raw.commonName);
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || null;

  const primaryPosition = nullIfBlank(raw.position?.shortLabel ?? raw.position?.label);
  const altPositions = (raw.alternatePositions ?? [])
    .map((p) => p?.shortLabel ?? p?.label)
    .filter(Boolean);

  const row = {
    player_id: nullIfBlank(raw.id),
    name: commonName ?? fullName,
    first_name: firstName,
    last_name: lastName,
    short_name: commonName,

    date_of_birth: isoDate(raw.birthdate),
    derived_age: deriveAge(raw.birthdate, meta.asOf),
    nationality: nullIfBlank(raw.nationality?.label),
    nationality_id: nullIfBlank(raw.nationality?.id),
    height: nullIfBlank(raw.height),
    weight: nullIfBlank(raw.weight),

    club: nullIfBlank(raw.team?.label),
    club_id: nullIfBlank(raw.team?.id),
    league: nullIfBlank(raw.leagueName ?? raw.league?.label),
    league_id: nullIfBlank(raw.league?.id),

    position: primaryPosition,
    positions: [primaryPosition, ...altPositions].filter(Boolean).join(', ') || null,
    alternative_positions: altPositions.join(', ') || null,
    position_type: nullIfBlank(raw.position?.positionType?.name),
    preferred_foot: normalizeFoot(raw.preferredFoot),

    overall: nullIfBlank(raw.overallRating),
    // EA's public ratings API carries no career-mode potential. Left null on
    // purpose; merge_potential.mjs is the only thing allowed to fill it.
    potential: null,

    weak_foot: nullIfBlank(raw.weakFootAbility ?? raw.weakFoot),
    skill_moves: nullIfBlank(raw.skillMoves),

    // Not present in the EA ratings payload — these are Ultimate Team / career
    // economy fields that live in other sources.
    value: null,
    wage: null,
    release_clause: null,
    contract_until: null,

    playstyles: playstyles.join(', ') || null,
    playstyles_plus: playstylesPlus.join(', ') || null,

    // Raw label kept verbatim; the id is what classifyGender() trusts.
    gender: nullIfBlank(raw.gender?.label ?? raw.gender),
    gender_id: raw.gender?.id ?? null,

    source: meta.source,
    source_player_id: nullIfBlank(raw.id),
    source_url: meta.sourceUrlTemplate && raw.id
      ? meta.sourceUrlTemplate.replace('{id}', String(raw.id))
      : null,
    overall_source: meta.source,
    attributes_source: meta.source,
    potential_source: null,
    data_version: meta.dataVersion,
    scraped_at: meta.scrapedAt,
  };

  for (const [column, aliases] of Object.entries(STAT_ALIASES)) {
    row[column] = pickStat(stats, aliases);
  }

  // Preserve anything EA sends that this schema has no slot for, rather than
  // silently discarding a stat EA renamed or added this season.
  for (const key of Object.keys(stats)) {
    if (MAPPED_STAT_KEYS.has(key)) continue;
    row[`stat_${key}`] = statValue(stats, key);
  }

  return row;
}

/** Columns actually present across a row set, in COLUMNS order then extras. */
export function resolveColumns(rows) {
  const extras = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!COLUMNS.includes(key)) extras.add(key);
    }
  }
  return [...COLUMNS, ...[...extras].sort()];
}

/**
 * Classify a record's gender.
 *
 * EA sends `gender: { id, label }` where the label is "Men's Football" /
 * "Women's Football" — NOT "Male" / "Female". The numeric id (0 men, 1 women)
 * is the primary signal because it cannot be reworded by a locale change.
 *
 * The label fallback tests for women FIRST, deliberately: "women" contains
 * "men", so a naive substring check files every women's player as a man.
 *
 * Anything unrecognised is `unknown`, never defaulted to male.
 *
 * @returns {'male' | 'female' | 'unknown'}
 */
export function classifyGender(row) {
  const id = row?.gender_id;
  if (id === 0 || id === '0') return 'male';
  if (id === 1 || id === '1') return 'female';

  const label = String(row?.gender ?? '').toLowerCase().trim();
  if (!label) return 'unknown';
  if (/wom[ae]n|female|\bw\b/.test(label)) return 'female';
  if (/\bmen\b|\bmale\b|\bm\b/.test(label)) return 'male';
  return 'unknown';
}

export const isMale = (row) => classifyGender(row) === 'male';
export const isFemale = (row) => classifyGender(row) === 'female';
