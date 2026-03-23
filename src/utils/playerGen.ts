import { Player, Position, PlayerAttributes, FormationType, FORMATION_POSITIONS, POSITION_COMPATIBILITY } from '@/types/game';
import { generatePersonality } from '@/utils/personality';
import { pick, clamp } from '@/utils/helpers';
import {
  PLAYER_MIN_AGE, PLAYER_AGE_RANGE, YOUNG_AGE_THRESHOLD, YOUNG_POTENTIAL_GAP, OLD_POTENTIAL_GAP,
  PROFILE_ATTRIBUTE_VARIANCE, POSITION_WEIGHTS as CONFIG_POSITION_WEIGHTS, DEFAULT_POSITION_WEIGHTS,
  VALUE_OVERALL_MULTIPLIER, VALUE_RANDOM_RANGE, WAGE_DIVISOR,
  CONTRACT_BASE_YEARS, CONTRACT_RANDOM_YEARS,
  FITNESS_BASE, FITNESS_RANGE, MORALE_BASE, MORALE_RANGE, FORM_BASE, FORM_RANGE,
  SQUAD_TEMPLATE as CONFIG_SQUAD_TEMPLATE, AGE_BUCKETS as CONFIG_AGE_BUCKETS, PEAK_AGE_BUCKET,
  SQUAD_QUALITY_VARIANCE, SQUAD_QUALITY_MIN, SQUAD_QUALITY_MAX,
  YOUNG_POTENTIAL_BOOST_BASE, YOUNG_POTENTIAL_BOOST_RANGE, YOUNG_POTENTIAL_AGE_THRESHOLD,
  STAR_PLAYER_BOOST_MIN, STAR_PLAYER_BOOST_MAX, VETERAN_BOOST_MIN, VETERAN_BOOST_MAX,
  EFFECTIVE_RATING_OVERALL_WEIGHT, EFFECTIVE_RATING_FORM_WEIGHT, EFFECTIVE_RATING_FITNESS_WEIGHT,
  MAX_SUBS, MIN_TEAM_STRENGTH, TEAM_STRENGTH_BASE, TEAM_STRENGTH_FITNESS_SCALE, TEAM_STRENGTH_MORALE_SCALE,
} from '@/config/playerGeneration';
import { CLUB_TEMPLATES } from '@/data/playerTemplates';

const FIRST_NAMES = [
  'James', 'Marcus', 'Lucas', 'Gabriel', 'Oliver', 'Noah', 'Ethan', 'Liam', 'Mason', 'Logan',
  'Alexander', 'Sebastian', 'Mateo', 'Daniel', 'Henry', 'Michael', 'Benjamin', 'Samuel', 'David', 'Joseph',
  'Carlos', 'Diego', 'Rafael', 'Antonio', 'Luis', 'Pedro', 'Marco', 'Andrea', 'Luca', 'Giovanni',
  'Pierre', 'Jean', 'Antoine', 'Karim', 'Ousmane', 'Kylian', 'Hugo', 'Florian', 'Adrien', 'Paul',
  'Thomas', 'Felix', 'Kai', 'Leon', 'Timo', 'Joshua', 'Jadon', 'Bukayo', 'Phil', 'Erling',
  'Mohammed', 'Ibrahim', 'Youssef', 'Omar', 'Sadio', 'Victor', 'Bruno', 'Bernardo', 'Ruben', 'Joao',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Martinez', 'Rodriguez', 'Lopez', 'Wilson',
  'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris',
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Costa', 'Fernandes', 'Rodrigues', 'Almeida', 'Lima',
  'Mueller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch',
  'Dupont', 'Bernard', 'Moreau', 'Laurent', 'Lefevre', 'Roux', 'Girard', 'Bonnet', 'Lambert', 'Fontaine',
  'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco',
];

const NATIONALITIES = [
  'England', 'Spain', 'France', 'Germany', 'Italy', 'Brazil', 'Argentina', 'Portugal',
  'Netherlands', 'Belgium', 'Colombia', 'Uruguay', 'Croatia', 'Denmark', 'Norway',
  'Sweden', 'Switzerland', 'Nigeria', 'Senegal', 'Morocco', 'Japan', 'South Korea',
  'Cameroon', 'Ivory Coast', 'Egypt', 'Ghana', 'USA', 'Ukraine', 'Jamaica', 'Ireland',
  'Scotland', 'Wales', 'Czech Republic', 'Hungary', 'Ecuador', 'Mexico', 'Mali',
  'Paraguay', 'Poland', 'Turkey', 'Austria', 'Algeria', 'Gabon', 'Serbia',
];

const variance = (range = 15) => Math.floor(Math.random() * range * 2) - range;

function generateAttributes(position: Position, quality: number): PlayerAttributes {
  const q = quality;
  const v = () => variance(PROFILE_ATTRIBUTE_VARIANCE);
  const profiles: Record<string, () => PlayerAttributes> = {
    'GK': () => ({ pace: clamp(q - 15 + v()), shooting: clamp(q - 30 + v()), passing: clamp(q - 10 + v()), defending: clamp(q + 5 + v()), physical: clamp(q + v()), mental: clamp(q + 5 + v()) }),
    'CB': () => ({ pace: clamp(q - 5 + v()), shooting: clamp(q - 20 + v()), passing: clamp(q - 5 + v()), defending: clamp(q + 10 + v()), physical: clamp(q + 5 + v()), mental: clamp(q + v()) }),
    'LB': () => ({ pace: clamp(q + 5 + v()), shooting: clamp(q - 15 + v()), passing: clamp(q + v()), defending: clamp(q + 5 + v()), physical: clamp(q + v()), mental: clamp(q - 5 + v()) }),
    'RB': () => ({ pace: clamp(q + 5 + v()), shooting: clamp(q - 15 + v()), passing: clamp(q + v()), defending: clamp(q + 5 + v()), physical: clamp(q + v()), mental: clamp(q - 5 + v()) }),
    'CDM': () => ({ pace: clamp(q - 5 + v()), shooting: clamp(q - 10 + v()), passing: clamp(q + 5 + v()), defending: clamp(q + 8 + v()), physical: clamp(q + 5 + v()), mental: clamp(q + 5 + v()) }),
    'CM': () => ({ pace: clamp(q + v()), shooting: clamp(q + v()), passing: clamp(q + 10 + v()), defending: clamp(q + v()), physical: clamp(q + v()), mental: clamp(q + 5 + v()) }),
    'CAM': () => ({ pace: clamp(q + v()), shooting: clamp(q + 5 + v()), passing: clamp(q + 10 + v()), defending: clamp(q - 15 + v()), physical: clamp(q - 5 + v()), mental: clamp(q + 5 + v()) }),
    'LM': () => ({ pace: clamp(q + 8 + v()), shooting: clamp(q + v()), passing: clamp(q + 5 + v()), defending: clamp(q - 5 + v()), physical: clamp(q + v()), mental: clamp(q + v()) }),
    'RM': () => ({ pace: clamp(q + 8 + v()), shooting: clamp(q + v()), passing: clamp(q + 5 + v()), defending: clamp(q - 5 + v()), physical: clamp(q + v()), mental: clamp(q + v()) }),
    'LW': () => ({ pace: clamp(q + 10 + v()), shooting: clamp(q + 5 + v()), passing: clamp(q + 5 + v()), defending: clamp(q - 20 + v()), physical: clamp(q - 5 + v()), mental: clamp(q + v()) }),
    'RW': () => ({ pace: clamp(q + 10 + v()), shooting: clamp(q + 5 + v()), passing: clamp(q + 5 + v()), defending: clamp(q - 20 + v()), physical: clamp(q - 5 + v()), mental: clamp(q + v()) }),
    'ST': () => ({ pace: clamp(q + 5 + v()), shooting: clamp(q + 12 + v()), passing: clamp(q - 5 + v()), defending: clamp(q - 20 + v()), physical: clamp(q + 5 + v()), mental: clamp(q + v()) }),
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

export function generatePlayer(position: Position, quality: number, clubId: string, season: number): Player {
  const attrs = generateAttributes(position, quality);
  const overall = calculateOverall(attrs, position);
  const age = PLAYER_MIN_AGE + Math.floor(Math.random() * PLAYER_AGE_RANGE);
  const potential = clamp(overall + Math.floor(Math.random() * (age < YOUNG_AGE_THRESHOLD ? YOUNG_POTENTIAL_GAP : OLD_POTENTIAL_GAP)));
  const value = Math.round(overall * overall * VALUE_OVERALL_MULTIPLIER + Math.random() * VALUE_RANDOM_RANGE);
  return {
    id: crypto.randomUUID(),
    firstName: pick(FIRST_NAMES),
    lastName: pick(LAST_NAMES),
    age,
    nationality: pick(NATIONALITIES),
    position,
    attributes: attrs,
    overall,
    potential,
    clubId,
    wage: Math.round(value / WAGE_DIVISOR),
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
    yellowCards: 0,
    redCards: 0,
    personality: generatePersonality(),
    joinedSeason: season,
  };
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

export function generateSquad(clubId: string, quality: number, season: number): Player[] {
  const templates = CLUB_TEMPLATES[clubId] || [];
  const templatePlayers: Player[] = [];

  // ── Step 1: Generate template players with recognizable names ──
  for (const t of templates) {
    const player = generatePlayer(t.pos, t.ovr, clubId, season);
    player.firstName = t.fn;
    player.lastName = t.ln;
    player.age = t.age;
    player.nationality = t.nat;
    if (t.pot !== undefined) {
      player.potential = t.pot;
    } else if (t.age >= 30) {
      player.potential = player.overall;
    } else if (t.age <= YOUNG_POTENTIAL_AGE_THRESHOLD) {
      player.potential = clamp(player.overall + YOUNG_POTENTIAL_BOOST_BASE + Math.floor(Math.random() * YOUNG_POTENTIAL_BOOST_RANGE));
    }
    player.value = Math.round(player.overall * player.overall * VALUE_OVERALL_MULTIPLIER + Math.random() * VALUE_RANDOM_RANGE);
    player.wage = Math.round(player.value / WAGE_DIVISOR);
    templatePlayers.push(player);
  }

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

  // ── Step 3: Generate random filler players for remaining slots ──
  const ageTargets = buildAgeTargets(remainingPositions.length);
  const fillerPlayers = remainingPositions.map((pos, idx) => {
    const q = clamp(quality + variance(SQUAD_QUALITY_VARIANCE), SQUAD_QUALITY_MIN, SQUAD_QUALITY_MAX);
    const player = generatePlayer(pos, q, clubId, season);
    const ageBucket = ageTargets[idx];
    player.age = ageBucket.min + Math.floor(Math.random() * (ageBucket.max - ageBucket.min + 1));
    if (player.age <= YOUNG_POTENTIAL_AGE_THRESHOLD) {
      player.potential = clamp(player.overall + YOUNG_POTENTIAL_BOOST_BASE + Math.floor(Math.random() * YOUNG_POTENTIAL_BOOST_RANGE));
    }
    return player;
  });

  const squad = [...templatePlayers, ...fillerPlayers];

  // ── Step 4: Star/veteran boosts — only for non-template filler players ──
  if (fillerPlayers.length > 0) {
    const starIdx = fillerPlayers.reduce((best, p, i) => p.overall > fillerPlayers[best].overall ? i : best, 0);
    const star = fillerPlayers[starIdx];
    const starBoost = STAR_PLAYER_BOOST_MIN + Math.floor(Math.random() * (STAR_PLAYER_BOOST_MAX - STAR_PLAYER_BOOST_MIN + 1));
    const starAttrs = { ...star.attributes };
    for (const key of Object.keys(starAttrs) as (keyof PlayerAttributes)[]) {
      starAttrs[key] = clamp(starAttrs[key] + starBoost, 1, 99);
    }
    star.attributes = starAttrs;
    star.overall = calculateOverall(starAttrs, star.position);
    star.potential = clamp(star.overall + 3 + Math.floor(Math.random() * 3));
    star.value = star.overall * star.overall * VALUE_OVERALL_MULTIPLIER + Math.floor(Math.random() * VALUE_RANDOM_RANGE);

    const veterans = fillerPlayers.filter(p => p.age >= 30 && p !== star);
    if (veterans.length > 0) {
      const vet = veterans[Math.floor(Math.random() * veterans.length)];
      const vetBoost = VETERAN_BOOST_MIN + Math.floor(Math.random() * (VETERAN_BOOST_MAX - VETERAN_BOOST_MIN + 1));
      const vetAttrs = { ...vet.attributes };
      for (const key of Object.keys(vetAttrs) as (keyof PlayerAttributes)[]) {
        vetAttrs[key] = clamp(vetAttrs[key] + vetBoost, 1, 99);
      }
      vetAttrs.mental = clamp(vetAttrs.mental + 10, 1, 99);
      vet.attributes = vetAttrs;
      vet.overall = calculateOverall(vetAttrs, vet.position);
      vet.potential = vet.overall;
      vet.value = vet.overall * vet.overall * VALUE_OVERALL_MULTIPLIER + Math.floor(Math.random() * VALUE_RANDOM_RANGE);
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
    const compat = POSITION_COMPATIBILITY[slot.pos] || [slot.pos];
    const best = players
      .filter(p => !used.has(p.id) && compat.includes(p.position) && isAvailable(p))
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
