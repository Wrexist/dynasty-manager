import { Player, Position, PlayerAttributes, FormationType, FORMATION_POSITIONS, canPlayPosition } from '@/types/game';
import { generatePersonality } from '@/utils/personality';
import { pick, clamp } from '@/utils/helpers';
import { generatePlayerAppearance } from '@/config/playerAppearance';
import {
  PLAYER_MIN_AGE, PLAYER_AGE_RANGE, YOUNG_AGE_THRESHOLD, YOUNG_POTENTIAL_GAP, OLD_POTENTIAL_GAP,
  PROFILE_ATTRIBUTE_VARIANCE, POSITION_WEIGHTS as CONFIG_POSITION_WEIGHTS, DEFAULT_POSITION_WEIGHTS,
  calculatePlayerValue, calculatePlayerWage,
  CONTRACT_BASE_YEARS, CONTRACT_RANDOM_YEARS,
  FITNESS_BASE, FITNESS_RANGE, MORALE_BASE, MORALE_RANGE, FORM_BASE, FORM_RANGE,
  SQUAD_TEMPLATE as CONFIG_SQUAD_TEMPLATE, AGE_BUCKETS as CONFIG_AGE_BUCKETS, PEAK_AGE_BUCKET,
  INITIAL_SQUAD_MIN_TARGET,
  SQUAD_QUALITY_VARIANCE, SQUAD_QUALITY_MIN, SQUAD_QUALITY_MAX,
  QUALITY_SCALING_REFERENCE, QUALITY_SCALING_FLOOR, SQUAD_QUALITY_MIN_LOW, VETERAN_MENTAL_BONUS,
  YOUNG_POTENTIAL_BOOST_BASE, YOUNG_POTENTIAL_BOOST_RANGE, YOUNG_POTENTIAL_AGE_THRESHOLD,
  STAR_PLAYER_BOOST_MIN, STAR_PLAYER_BOOST_MAX, VETERAN_BOOST_MIN, VETERAN_BOOST_MAX,
  GENERATED_PLAYER_OVERALL_CAP, GENERATED_PLAYER_POTENTIAL_CAP,
  REAL_FILLER_OVR_FLOOR, REAL_FILLER_OVR_CEIL, REAL_FILLER_OVR_BAND_BELOW, REAL_FILLER_OVR_BAND_ABOVE,
  EFFECTIVE_RATING_OVERALL_WEIGHT, EFFECTIVE_RATING_FORM_WEIGHT, EFFECTIVE_RATING_FITNESS_WEIGHT,
  MAX_SUBS, MIN_TEAM_STRENGTH, TEAM_STRENGTH_BASE, TEAM_STRENGTH_FITNESS_SCALE, TEAM_STRENGTH_MORALE_SCALE,
  NATIONALITY_DISTRIBUTION,
} from '@/config/playerGeneration';
import { NATIONALITY_NAME_POOLS, FALLBACK_FIRST_NAMES, FALLBACK_LAST_NAMES } from '@/config/namePool';
import { CLUB_TEMPLATES, type PlayerTemplate } from '@/data/playerTemplates';
import { resolveSquadKey } from '@/data/clubTemplateAliases';
import { claimRealPlayer, pickUnclaimedRealPlayer, isNationalityAliasOf } from '@/utils/realPlayerPicker';

const ALL_NATIONALITIES = [
  'England', 'Spain', 'France', 'Germany', 'Italy', 'Brazil', 'Argentina', 'Portugal',
  'Netherlands', 'Belgium', 'Colombia', 'Uruguay', 'Croatia', 'Denmark', 'Norway',
  'Sweden', 'Switzerland', 'Nigeria', 'Senegal', 'Morocco', 'Japan', 'South Korea',
  'Scotland', 'Wales', 'Ireland', 'Ghana', 'Ivory Coast', 'Cameroon', 'Poland',
  'Turkey', 'Serbia', 'Czech Republic', 'Austria', 'USA',
  'Egypt', 'Ukraine', 'Jamaica', 'Hungary', 'Ecuador', 'Mexico', 'Mali',
  'Paraguay', 'Algeria', 'Gabon',
];

function pickNationality(leagueId?: string): string {
  // For lower-tier leagues like 'eng-2', fall back to the country's top tier distribution
  const countryId = leagueId?.replace(/-\d+$/, '');
  const pool = (leagueId && NATIONALITY_DISTRIBUTION[leagueId])
    || (countryId && NATIONALITY_DISTRIBUTION[countryId])
    || NATIONALITY_DISTRIBUTION['DEFAULT'];
  if (pool) {
    const totalWeight = pool.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * totalWeight;
    for (const entry of pool) {
      r -= entry.weight;
      if (r <= 0) return entry.nationality;
    }
    return pool[pool.length - 1].nationality;
  }
  return pick(ALL_NATIONALITIES);
}

export function pickNameForNationality(nationality: string): { firstName: string; lastName: string } {
  const pool = NATIONALITY_NAME_POOLS[nationality];
  if (pool) {
    return { firstName: pick(pool.firstNames), lastName: pick(pool.lastNames) };
  }
  return { firstName: pick(FALLBACK_FIRST_NAMES), lastName: pick(FALLBACK_LAST_NAMES) };
}

// Squad templates use "Holland" while NATIONALITY_NAME_POOLS keys on
// "Netherlands"; map a few common aliases so the FC26-derived data
// resolves to a real first-name pool.
const NATIONALITY_POOL_ALIASES: Record<string, string> = {
  Holland: 'Netherlands',
  'Czech Republic': 'Czechia',
  Czechia: 'Czech Republic',
  'South Korea': 'Korea Republic',
  'Korea Republic': 'South Korea',
};

function resolveFirstNamePool(nationality: string): string[] {
  const direct = NATIONALITY_NAME_POOLS[nationality];
  if (direct) return direct.firstNames;
  const alias = NATIONALITY_POOL_ALIASES[nationality];
  if (alias) {
    const aliased = NATIONALITY_NAME_POOLS[alias];
    if (aliased) return aliased.firstNames;
  }
  return FALLBACK_FIRST_NAMES;
}

// Cheap deterministic 32-bit hash (djb2-xor). Used to pick the same
// expansion for the same player every time, so reloading a save shows
// the same name as before.
function hashSeed(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// Detects an abbreviated first name like "E.", "A. Van", "B. van den".
// Capture group 1 is the leading letter, group 2 is the remainder of the
// string (which may itself be a nobiliary particle / second word that we
// preserve verbatim).
// Cover Latin-1 (À-ÿ) + Latin Extended-A (Ā-ſ, U+0100–U+017F) so
// FC26 initials like Š./Ž./Č./Ł./Ś. round-trip correctly.
const ABBREVIATED_FIRST_NAME_RE = /^([A-Za-zÀ-ÖØ-öø-ÿĀ-ſ])\.\s*(.*)$/;

/**
 * Expand a first name that comes through as just an initial (e.g. "E.",
 * "A. Van", "B. van den") into a full name using the player's
 * nationality name pool. Returns the input unchanged when it doesn't
 * match the abbreviated pattern, or when the pool contains no name
 * starting with the given letter.
 *
 * The choice is deterministic in `seed` so the same player always picks
 * the same expansion across reloads.
 */
export function expandAbbreviatedFirstName(
  rawFirstName: string,
  nationality: string,
  seed: string,
): string {
  if (!rawFirstName) return rawFirstName;
  const match = ABBREVIATED_FIRST_NAME_RE.exec(rawFirstName.trim());
  if (!match) return rawFirstName;

  const initial = match[1].toLocaleUpperCase();
  const remainder = match[2].trim();

  const startsWithInitial = (name: string) =>
    name.length > 0 && name[0].toLocaleUpperCase() === initial;

  const localPool = resolveFirstNamePool(nationality).filter(startsWithInitial);
  let candidates = localPool;

  if (candidates.length === 0) {
    // Cast a wider net across every pool + fallback so the player still
    // gets a real-sounding name even if their specific nationality has
    // no entry under this initial.
    const allNames = new Set<string>();
    for (const pool of Object.values(NATIONALITY_NAME_POOLS)) {
      for (const n of pool.firstNames) if (startsWithInitial(n)) allNames.add(n);
    }
    for (const n of FALLBACK_FIRST_NAMES) if (startsWithInitial(n)) allNames.add(n);
    candidates = Array.from(allNames);
  }

  if (candidates.length === 0) return rawFirstName;

  const chosen = candidates[hashSeed(seed) % candidates.length];
  return remainder ? `${chosen} ${remainder}` : chosen;
}

const variance = (range = 15) => Math.floor(Math.random() * range * 2) - range;

function qualityScale(clubQuality: number): number {
  return Math.min(1, Math.max(QUALITY_SCALING_FLOOR, clubQuality / QUALITY_SCALING_REFERENCE));
}

function generateAttributes(position: Position, quality: number): PlayerAttributes {
  const q = quality;
  const v = () => variance(PROFILE_ATTRIBUTE_VARIANCE);
  const profiles: Record<string, () => PlayerAttributes> = {
    'GK': () => ({ pace: clamp(q - 10 + v()), shooting: clamp(q - 20 + v()), passing: clamp(q - 7 + v()), defending: clamp(q + 3 + v()), physical: clamp(q + v()), mental: clamp(q + 3 + v()) }),
    'CB': () => ({ pace: clamp(q - 3 + v()), shooting: clamp(q - 15 + v()), passing: clamp(q - 3 + v()), defending: clamp(q + 7 + v()), physical: clamp(q + 3 + v()), mental: clamp(q + v()) }),
    'LB': () => ({ pace: clamp(q + 3 + v()), shooting: clamp(q - 10 + v()), passing: clamp(q + v()), defending: clamp(q + 3 + v()), physical: clamp(q + v()), mental: clamp(q - 3 + v()) }),
    'RB': () => ({ pace: clamp(q + 3 + v()), shooting: clamp(q - 10 + v()), passing: clamp(q + v()), defending: clamp(q + 3 + v()), physical: clamp(q + v()), mental: clamp(q - 3 + v()) }),
    'CDM': () => ({ pace: clamp(q - 3 + v()), shooting: clamp(q - 7 + v()), passing: clamp(q + 3 + v()), defending: clamp(q + 5 + v()), physical: clamp(q + 3 + v()), mental: clamp(q + 3 + v()) }),
    'CM': () => ({ pace: clamp(q + v()), shooting: clamp(q + v()), passing: clamp(q + 7 + v()), defending: clamp(q + v()), physical: clamp(q + v()), mental: clamp(q + 3 + v()) }),
    'CAM': () => ({ pace: clamp(q + v()), shooting: clamp(q + 3 + v()), passing: clamp(q + 7 + v()), defending: clamp(q - 10 + v()), physical: clamp(q - 3 + v()), mental: clamp(q + 3 + v()) }),
    'LM': () => ({ pace: clamp(q + 5 + v()), shooting: clamp(q + v()), passing: clamp(q + 3 + v()), defending: clamp(q - 3 + v()), physical: clamp(q + v()), mental: clamp(q + v()) }),
    'RM': () => ({ pace: clamp(q + 5 + v()), shooting: clamp(q + v()), passing: clamp(q + 3 + v()), defending: clamp(q - 3 + v()), physical: clamp(q + v()), mental: clamp(q + v()) }),
    'LW': () => ({ pace: clamp(q + 7 + v()), shooting: clamp(q + 3 + v()), passing: clamp(q + 3 + v()), defending: clamp(q - 15 + v()), physical: clamp(q - 3 + v()), mental: clamp(q + v()) }),
    'RW': () => ({ pace: clamp(q + 7 + v()), shooting: clamp(q + 3 + v()), passing: clamp(q + 3 + v()), defending: clamp(q - 15 + v()), physical: clamp(q - 3 + v()), mental: clamp(q + v()) }),
    'ST': () => ({ pace: clamp(q + 3 + v()), shooting: clamp(q + 8 + v()), passing: clamp(q - 3 + v()), defending: clamp(q - 15 + v()), physical: clamp(q + 3 + v()), mental: clamp(q + v()) }),
  };
  return (profiles[position] || profiles['CM'])();
}

const POSITION_WEIGHTS = CONFIG_POSITION_WEIGHTS;

function calculateOverall(attrs: PlayerAttributes, position: Position): number {
  const w = POSITION_WEIGHTS[position] || DEFAULT_POSITION_WEIGHTS;
  const vals = [attrs.pace, attrs.shooting, attrs.passing, attrs.defending, attrs.physical, attrs.mental];
  return clamp(Math.round(vals.reduce((s, v, i) => s + v * w[i], 0)));
}

export { calculateOverall };

export function generatePlayer(position: Position, quality: number, clubId: string, season: number, divisionTier?: number | string): Player {
  const attrs = generateAttributes(position, quality);
  const overall = calculateOverall(attrs, position);
  const age = PLAYER_MIN_AGE + Math.floor(Math.random() * PLAYER_AGE_RANGE);
  const potential = clamp(overall + Math.floor(Math.random() * (age < YOUNG_AGE_THRESHOLD ? YOUNG_POTENTIAL_GAP : OLD_POTENTIAL_GAP)));
  const value = calculatePlayerValue(overall);
  const leagueKey = typeof divisionTier === 'string' ? divisionTier : undefined;
  const nationality = pickNationality(leagueKey);
  const { firstName, lastName } = pickNameForNationality(nationality);
  return {
    id: crypto.randomUUID(),
    firstName,
    lastName,
    age,
    nationality,
    position,
    attributes: attrs,
    overall,
    potential,
    clubId,
    wage: calculatePlayerWage(overall),
    value,
    contractEnd: season + CONTRACT_BASE_YEARS + Math.floor(Math.random() * CONTRACT_RANDOM_YEARS),
    fitness: FITNESS_BASE + Math.floor(Math.random() * FITNESS_RANGE),
    morale: MORALE_BASE + Math.floor(Math.random() * MORALE_RANGE),
    form: FORM_BASE + Math.floor(Math.random() * FORM_RANGE),
    injured: false,
    injuryWeeks: 0,
    goals: 0,
    assists: 0,
    appearances: 0,
    careerGoals: 0,
    careerAssists: 0,
    careerAppearances: 0,
    yellowCards: 0,
    redCards: 0,
    personality: generatePersonality(),
    appearance: generatePlayerAppearance(nationality, position),
    skillMoves: pickWeightedSkillMoves(),
    joinedSeason: season,
  };
}

/** Weighted random skill moves: 1★ 15%, 2★ 40%, 3★ 30%, 4★ 12%, 5★ 3% */
function pickWeightedSkillMoves(): number {
  const r = Math.random();
  if (r < 0.15) return 1;
  if (r < 0.55) return 2;
  if (r < 0.85) return 3;
  if (r < 0.97) return 4;
  return 5;
}

const SQUAD_TEMPLATE = CONFIG_SQUAD_TEMPLATE;

const AGE_BUCKETS = CONFIG_AGE_BUCKETS;

function buildAgeTargets(count: number): { min: number; max: number }[] {
  const ageTargets: { min: number; max: number }[] = [];
  for (const bucket of AGE_BUCKETS) {
    for (let i = 0; i < bucket.count && ageTargets.length < count; i++) {
      ageTargets.push({ min: bucket.min, max: bucket.max });
    }
  }
  while (ageTargets.length < count) {
    ageTargets.push(PEAK_AGE_BUCKET);
  }
  for (let i = ageTargets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ageTargets[i], ageTargets[j]] = [ageTargets[j], ageTargets[i]];
  }
  return ageTargets;
}

/**
 * Build a Player from a PlayerTemplate (real-world roster data).
 * Seeds a procedurally-generated player then overrides identity and
 * FC26-derived attributes from the template.
 *
 * @param nationalityOverride Optional canonical nationality (e.g. "Netherlands")
 *   used when the template carries an alias label ("Holland"); ensures the
 *   player's saved nationality and generated appearance both use the canonical
 *   name so UI filters/flags render correctly.
 */
export function buildPlayerFromTemplate(
  t: PlayerTemplate,
  clubId: string,
  season: number,
  nationalityOverride?: string,
): Player {
  const nationality = nationalityOverride ?? t.nat;
  const player = generatePlayer(t.pos, t.ovr, clubId, season);
  // Community-pack templates (auto-derived from FC26 short_name) often
  // ship as `"E."` / `"A. Van"`; expand to a full first name so cards
  // and lists don't render a bare initial.
  const expansionSeed = t.fcId ?? `${t.fn}|${t.ln}|${nationality}|${t.pos}`;
  player.firstName = expandAbbreviatedFirstName(t.fn, nationality, expansionSeed);
  player.lastName = t.ln;
  player.age = t.age;
  player.nationality = nationality;
  if (t.pot !== undefined) {
    player.potential = t.pot;
  } else if (t.age >= 30) {
    player.potential = player.overall;
  } else if (t.age <= YOUNG_POTENTIAL_AGE_THRESHOLD) {
    player.potential = clamp(player.overall + YOUNG_POTENTIAL_BOOST_BASE + Math.floor(Math.random() * YOUNG_POTENTIAL_BOOST_RANGE));
  }
  if (t.pace !== undefined) {
    player.attributes = {
      pace: clamp(t.pace),
      shooting: clamp(t.shooting ?? player.attributes.shooting),
      passing: clamp(t.passing ?? player.attributes.passing),
      defending: clamp(t.defending ?? player.attributes.defending),
      physical: clamp(t.physical ?? player.attributes.physical),
      mental: clamp(t.mental ?? player.attributes.mental),
    };
    if (t.source !== 'real') {
      // Procedural / test templates: derive overall from the new attrs.
      player.overall = calculateOverall(player.attributes, player.position);
    }
  }
  // Real FC26 templates carry their own author-curated overall.
  // Recomputing via POSITION_WEIGHTS underestimates GKs by 3–6 points
  // (gk_kicking gets double-counted across shooting+passing, and the
  // 6-axis blend can't reproduce EA's GK-specific formula). Preserve
  // t.ovr verbatim — independent of the pace-gated attribute branch
  // so a future real template that ships without `pace` still wins.
  if (t.source === 'real' && typeof t.ovr === 'number') {
    player.overall = clamp(t.ovr);
  }
  if (t.altPos?.length) player.alternatePositions = t.altPos;
  if (t.skillMoves) player.skillMoves = t.skillMoves;
  if (t.source) player.source = t.source;
  if (t.fcId) player.fcId = t.fcId;
  if (t.heightCm) player.heightCm = t.heightCm;
  if (t.weightKg) player.weightKg = t.weightKg;
  player.appearance = generatePlayerAppearance(
    player.nationality,
    player.position,
    player.heightCm,
    player.weightKg,
  );
  player.value = calculatePlayerValue(player.overall);
  player.wage = calculatePlayerWage(player.overall);
  return player;
}

export function generateSquad(clubId: string, quality: number, season: number, divisionTier?: number | string, isInitialSeason: boolean = false): Player[] {
  const scale = qualityScale(quality);
  const templates = CLUB_TEMPLATES[resolveSquadKey(clubId)] || [];
  // Claim template names up-front so the real-player picker doesn't hand
  // the same person to another club as a filler later in the init loop.
  for (const t of templates) claimRealPlayer(t);
  const templatePlayers: Player[] = templates.map(t => buildPlayerFromTemplate(t, clubId, season));

  // ── Step 2: Determine remaining positions to fill ──
  const positionsFilled: Record<string, number> = {};
  for (const t of templates) {
    positionsFilled[t.pos] = (positionsFilled[t.pos] || 0) + 1;
  }
  const remainingPositions: Position[] = [];
  const tempCounts = { ...positionsFilled };
  for (const pos of SQUAD_TEMPLATE) {
    if ((tempCounts[pos] || 0) > 0) {
      tempCounts[pos]--;
    } else {
      remainingPositions.push(pos);
    }
  }

  // At game start, only top up clubs that are below a minimum playable size
  // (so every club can field a starting XI + bench). Clubs with rich template
  // coverage get no extra filler — the world still grows via weekly signings,
  // youth intake, and free agents. Filler slots are taken in SQUAD_TEMPLATE
  // order, so critical positions (GK first) are covered before depth roles.
  const fillerPositions = isInitialSeason
    ? remainingPositions.slice(0, Math.max(0, INITIAL_SQUAD_MIN_TARGET - templatePlayers.length))
    : remainingPositions;

  // ── Step 3: Fill remaining slots with real FC26 players first, then ──
  // procedural fallbacks. Real-template fillers carry their actual name,
  // ratings, attributes, height/weight and skill moves — only the clubId
  // is overridden in buildPlayerFromTemplate. Procedural fallbacks keep
  // the existing age-bucket / potential-boost behaviour.
  const ageTargets = buildAgeTargets(fillerPositions.length);
  const leagueKeyForNationality = typeof divisionTier === 'string' ? divisionTier : undefined;
  const realFillerIds = new Set<string>();
  const fillerPlayers = fillerPositions.map((pos, idx) => {
    const nationality = pickNationality(leagueKeyForNationality);
    // Bias the real-player pick toward the club's quality tier so a
    // 4th-division side doesn't accidentally sign Mbappé as a filler.
    const realTemplate = pickUnclaimedRealPlayer(nationality, pos, {
      minOvr: Math.max(REAL_FILLER_OVR_FLOOR, quality - REAL_FILLER_OVR_BAND_BELOW),
      maxOvr: Math.min(REAL_FILLER_OVR_CEIL, quality + REAL_FILLER_OVR_BAND_ABOVE),
    });
    if (realTemplate) {
      // Only canonicalise nationality when the picker's choice is an
      // alias of the preferred nation (e.g. Holland ↔ Netherlands). On
      // a global-pool fallback the chosen template belongs to a
      // different nation, so keep its real nationality + flag.
      const overrideNat = isNationalityAliasOf(realTemplate.nat, nationality)
        ? nationality
        : undefined;
      const real = buildPlayerFromTemplate(realTemplate, clubId, season, overrideNat);
      realFillerIds.add(real.id);
      return real;
    }

    const scaledVariance = Math.round(SQUAD_QUALITY_VARIANCE * scale);
    const effectiveMin = Math.round(SQUAD_QUALITY_MIN_LOW + (SQUAD_QUALITY_MIN - SQUAD_QUALITY_MIN_LOW) * scale);
    const q = clamp(quality + variance(scaledVariance), effectiveMin, SQUAD_QUALITY_MAX);
    const player = generatePlayer(pos, q, clubId, season, divisionTier);
    const ageBucket = ageTargets[idx];
    player.age = ageBucket.min + Math.floor(Math.random() * (ageBucket.max - ageBucket.min + 1));
    if (player.age <= YOUNG_POTENTIAL_AGE_THRESHOLD) {
      player.potential = clamp(player.overall + YOUNG_POTENTIAL_BOOST_BASE + Math.floor(Math.random() * YOUNG_POTENTIAL_BOOST_RANGE));
    }
    return player;
  });

  const squad = [...templatePlayers, ...fillerPlayers];

  // ── Step 4: Star/veteran boosts — only for procedural fillers. ──
  // Real-template fillers already carry their FC26 attributes and must
  // not be inflated, otherwise their ratings stop matching the player.
  const proceduralFillers = fillerPlayers.filter(p => !realFillerIds.has(p.id));
  if (proceduralFillers.length > 0) {
    const starIdx = proceduralFillers.reduce((best, p, i) => p.overall > proceduralFillers[best].overall ? i : best, 0);
    const star = proceduralFillers[starIdx];
    const starBoost = Math.round((STAR_PLAYER_BOOST_MIN + Math.floor(Math.random() * (STAR_PLAYER_BOOST_MAX - STAR_PLAYER_BOOST_MIN + 1))) * scale);
    const starAttrs = { ...star.attributes };
    for (const key of Object.keys(starAttrs) as (keyof PlayerAttributes)[]) {
      starAttrs[key] = clamp(starAttrs[key] + starBoost, 1, 99);
    }
    star.attributes = starAttrs;
    star.overall = calculateOverall(starAttrs, star.position);
    // Cap star overall so generated players don't start unrealistically high.
    // Use floor (not round) to guarantee convergence, with iteration limit as safeguard.
    for (let i = 0; i < 10 && star.overall > GENERATED_PLAYER_OVERALL_CAP; i++) {
      const reductionRatio = (GENERATED_PLAYER_OVERALL_CAP - 0.5) / star.overall;
      for (const key of Object.keys(starAttrs) as (keyof PlayerAttributes)[]) {
        starAttrs[key] = clamp(Math.floor(starAttrs[key] * reductionRatio));
      }
      star.attributes = starAttrs;
      star.overall = calculateOverall(starAttrs, star.position);
    }
    const starPotGap = Math.round((3 + Math.floor(Math.random() * 5)) * scale);
    star.potential = clamp(Math.max(star.overall + starPotGap, star.potential), 1, GENERATED_PLAYER_POTENTIAL_CAP);
    star.value = calculatePlayerValue(star.overall);

    const veterans = proceduralFillers.filter(p => p.age >= 30 && p !== star);
    if (veterans.length > 0) {
      const vet = veterans[Math.floor(Math.random() * veterans.length)];
      const vetBoost = Math.round((VETERAN_BOOST_MIN + Math.floor(Math.random() * (VETERAN_BOOST_MAX - VETERAN_BOOST_MIN + 1))) * scale);
      const vetAttrs = { ...vet.attributes };
      for (const key of Object.keys(vetAttrs) as (keyof PlayerAttributes)[]) {
        vetAttrs[key] = clamp(vetAttrs[key] + vetBoost, 1, 99);
      }
      vetAttrs.mental = clamp(vetAttrs.mental + Math.round(VETERAN_MENTAL_BONUS * scale), 1, 99);
      vet.attributes = vetAttrs;
      vet.overall = calculateOverall(vetAttrs, vet.position);
      // Cap veteran overall (floor + iteration limit to guarantee convergence)
      for (let i = 0; i < 10 && vet.overall > GENERATED_PLAYER_OVERALL_CAP; i++) {
        const reductionRatio = (GENERATED_PLAYER_OVERALL_CAP - 0.5) / vet.overall;
        for (const key of Object.keys(vetAttrs) as (keyof PlayerAttributes)[]) {
          vetAttrs[key] = clamp(Math.floor(vetAttrs[key] * reductionRatio));
        }
        vet.attributes = vetAttrs;
        vet.overall = calculateOverall(vetAttrs, vet.position);
      }
      vet.potential = vet.overall;
      vet.value = calculatePlayerValue(vet.overall);
      if (vet.personality) vet.personality.leadership = Math.max(vet.personality.leadership, 16);
    }
  }

  return squad;
}

export function selectBestLineup(players: Player[], formation: FormationType, currentWeek?: number): { lineup: Player[]; subs: Player[] } {
  const isAvailable = (p: Player) => !p.injured && !p.onLoan && !(p.suspendedUntilWeek && currentWeek !== undefined && p.suspendedUntilWeek > currentWeek);
  const slots = FORMATION_POSITIONS[formation];
  const selected: Player[] = [];
  const used = new Set<string>();

  // Effective rating: overall weighted with form and fitness for smarter selection
  const effectiveRating = (p: Player) => p.overall * EFFECTIVE_RATING_OVERALL_WEIGHT + (p.form / 100) * EFFECTIVE_RATING_FORM_WEIGHT + (p.fitness / 100) * EFFECTIVE_RATING_FITNESS_WEIGHT;

  for (const slot of slots) {
    const best = players
      .filter(p => !used.has(p.id) && canPlayPosition(p, slot.pos) && isAvailable(p))
      .sort((a, b) => effectiveRating(b) - effectiveRating(a))[0];
    if (best) {
      selected.push(best);
      used.add(best.id);
    }
  }

  const subs = players
    .filter(p => !used.has(p.id) && isAvailable(p))
    .sort((a, b) => effectiveRating(b) - effectiveRating(a))
    .slice(0, MAX_SUBS);

  return { lineup: selected, subs };
}

export function getTeamStrength(players: Player[]): number {
  if (players.length === 0) return MIN_TEAM_STRENGTH;
  const avg = players.reduce((s, p) => s + p.overall, 0) / players.length;
  const fitnessModifier = players.reduce((s, p) => s + p.fitness, 0) / players.length / 100;
  const moraleModifier = players.reduce((s, p) => s + p.morale, 0) / players.length / 100;
  return avg * (TEAM_STRENGTH_BASE + fitnessModifier * TEAM_STRENGTH_FITNESS_SCALE + moraleModifier * TEAM_STRENGTH_MORALE_SCALE);
}
