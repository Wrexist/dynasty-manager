import { YouthProspect, Position } from '@/types/game';
import { generatePlayer } from './playerGen';
import { recomputePlayerValueOnly } from './playerEconomics';
import { pick } from './helpers';
import {
  YOUTH_BASE_QUALITY, YOUTH_RATING_MULTIPLIER, YOUTH_COACH_MULTIPLIER, YOUTH_QUALITY_RANDOM_RANGE,
  YOUTH_QUALITY_MIN, YOUTH_QUALITY_MAX,
  YOUTH_BASE_AGE, YOUTH_AGE_RANGE,
  YOUTH_POTENTIAL_BASE_BONUS, YOUTH_POTENTIAL_MAX,
  YOUTH_CLUB_QUALITY_WEIGHT,
  YOUTH_READY_OVERALL_THRESHOLD, YOUTH_DEV_SCORE_BASE, YOUTH_DEV_SCORE_RANGE,
  INTAKE_PREVIEW_MIN, INTAKE_PREVIEW_RANGE,
  INTAKE_PREVIEW_POTENTIAL_BASE, INTAKE_PREVIEW_POTENTIAL_RANGE,
  ACADEMY_LEVEL_MIN, ACADEMY_LEVEL_MAX, ACADEMY_PROGRESS_PER_LEVEL,
  ACADEMY_GRADUATE_OVR_THRESHOLD, ACADEMY_GRADUATE_APPEARANCE_THRESHOLD,
  ACADEMY_LEVEL_QUALITY_BONUS, ACADEMY_LEVEL_POTENTIAL_BONUS,
  YOUTH_STAR_THRESHOLDS, YOUTH_SCOUT_VERDICTS,
} from '@/config/youth';

const YOUTH_POSITIONS: Position[] = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];

export function generateYouthProspects(
  clubId: string,
  youthRating: number, // 1-10
  youthCoachQuality: number, // 0-10
  season: number,
  count: number = 3,
  clubSquadQuality?: number,
  academyLevel: number = ACADEMY_LEVEL_MIN, // 1-5, boosts quality/potential
): { prospects: YouthProspect[]; players: ReturnType<typeof generatePlayer>[] } {
  const prospects: YouthProspect[] = [];
  const newPlayers: ReturnType<typeof generatePlayer>[] = [];
  // Levels above 1 add a small, sim-neutral bump to intake quality/potential.
  const levelSteps = Math.max(0, Math.min(ACADEMY_LEVEL_MAX, academyLevel) - ACADEMY_LEVEL_MIN);
  const levelQualityBonus = levelSteps * ACADEMY_LEVEL_QUALITY_BONUS;
  const levelPotentialBonus = levelSteps * ACADEMY_LEVEL_POTENTIAL_BONUS;

  for (let i = 0; i < count; i++) {
    const pos = pick(YOUTH_POSITIONS);
    // Youth players are lower quality but with higher potential gap
    let baseQuality = YOUTH_BASE_QUALITY + youthRating * YOUTH_RATING_MULTIPLIER + youthCoachQuality * YOUTH_COACH_MULTIPLIER + levelQualityBonus + Math.floor(Math.random() * YOUTH_QUALITY_RANDOM_RANGE);
    if (clubSquadQuality !== undefined) {
      baseQuality = Math.round(baseQuality * (1 - YOUTH_CLUB_QUALITY_WEIGHT) + clubSquadQuality * YOUTH_CLUB_QUALITY_WEIGHT);
    }
    const quality = Math.min(YOUTH_QUALITY_MAX, Math.max(YOUTH_QUALITY_MIN, Math.round(baseQuality)));

    const player = generatePlayer(pos, quality, clubId, season);
    // Force young age
    player.age = YOUTH_BASE_AGE + Math.floor(Math.random() * YOUTH_AGE_RANGE);
    player.isFromYouthAcademy = true;
    // Ensure decent potential
    player.potential = Math.min(YOUTH_POTENTIAL_MAX, player.overall + YOUTH_POTENTIAL_BASE_BONUS + youthRating + levelPotentialBonus + Math.floor(Math.random() * YOUTH_QUALITY_RANDOM_RANGE));
    // generatePlayer priced the rolled age (17-33); re-price for the forced
    // youth age so prospects don't carry an inflated peak-age market value
    // (mirrors the same recompute in transferMarketGen after age overrides).
    recomputePlayerValueOnly(player);

    const prospect: YouthProspect = {
      playerId: player.id,
      readyToPromote: player.overall >= YOUTH_READY_OVERALL_THRESHOLD,
      developmentScore: Math.floor(Math.random() * YOUTH_DEV_SCORE_RANGE) + YOUTH_DEV_SCORE_BASE,
    };

    prospects.push(prospect);
    newPlayers.push(player);
  }

  return { prospects, players: newPlayers };
}

export function generateIntakePreview(youthRating: number): { position: Position; estimatedPotential: number }[] {
  const count = INTAKE_PREVIEW_MIN + Math.floor(Math.random() * INTAKE_PREVIEW_RANGE);
  const previews: { position: Position; estimatedPotential: number }[] = [];
  for (let i = 0; i < count; i++) {
    previews.push({
      position: pick(YOUTH_POSITIONS),
      estimatedPotential: INTAKE_PREVIEW_POTENTIAL_BASE + youthRating * YOUTH_RATING_MULTIPLIER + Math.floor(Math.random() * INTAKE_PREVIEW_POTENTIAL_RANGE),
    });
  }
  return previews;
}

// ── Intake Day reveal helpers (pure, view-facing) ──

/** Potential → 1-5 star band for the reveal card. */
export function getPotentialStars(potential: number): number {
  for (let i = 0; i < YOUTH_STAR_THRESHOLDS.length; i++) {
    if (potential >= YOUTH_STAR_THRESHOLDS[i]) return 5 - i;
  }
  return 1;
}

function verdictBand(potential: number): keyof typeof YOUTH_SCOUT_VERDICTS {
  const stars = getPotentialStars(potential);
  if (stars >= 5) return 'elite';
  if (stars >= 4) return 'high';
  if (stars >= 3) return 'decent';
  return 'raw';
}

/**
 * One-line scout verdict, chosen deterministically from the banded pool so the
 * same prospect always reads the same line. `seed` is the player id.
 */
export function getScoutVerdict(potential: number, seed: string): string {
  const pool = YOUTH_SCOUT_VERDICTS[verdictBand(potential)];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return pool[Math.abs(hash) % pool.length];
}

// ── Academy level progression ──

export interface AcademyGraduate {
  id: string;
  overall: number;
  careerAppearances: number;
  isFromYouthAcademy?: boolean;
}

export interface AcademyProgressResult {
  level: number;
  progress: number;
  credited: string[];
  newlyCredited: string[];
  levelsGained: number;
}

/**
 * Advance academy level/progress from this season's squad. A youth-academy
 * graduate "proves the academy" once (either OVR or career-appearance bar),
 * awarding one progress point; every ACADEMY_PROGRESS_PER_LEVEL points lifts
 * the level by one, capped at ACADEMY_LEVEL_MAX. Already-credited graduates
 * never count twice — `credited` is the persisted set of proven ids.
 *
 * Pure: no store access, no mutation of inputs. `credited` is returned pruned
 * to the ids still present in `squad` to prevent unbounded save growth.
 */
export function computeAcademyProgress(
  level: number,
  progress: number,
  credited: string[],
  squad: AcademyGraduate[],
): AcademyProgressResult {
  const creditedSet = new Set(credited);
  const newlyCredited: string[] = [];
  for (const p of squad) {
    if (!p.isFromYouthAcademy) continue;
    if (creditedSet.has(p.id)) continue;
    const proven = p.overall >= ACADEMY_GRADUATE_OVR_THRESHOLD
      || (p.careerAppearances || 0) >= ACADEMY_GRADUATE_APPEARANCE_THRESHOLD;
    if (proven) {
      creditedSet.add(p.id);
      newlyCredited.push(p.id);
    }
  }

  let newLevel = Math.max(ACADEMY_LEVEL_MIN, Math.min(ACADEMY_LEVEL_MAX, level || ACADEMY_LEVEL_MIN));
  let newProgress = Math.max(0, progress || 0) + newlyCredited.length;
  let levelsGained = 0;
  while (newLevel < ACADEMY_LEVEL_MAX && newProgress >= ACADEMY_PROGRESS_PER_LEVEL) {
    newProgress -= ACADEMY_PROGRESS_PER_LEVEL;
    newLevel += 1;
    levelsGained += 1;
  }
  // At max level, park progress at the cap so the UI bar reads "full".
  if (newLevel >= ACADEMY_LEVEL_MAX) newProgress = Math.min(newProgress, ACADEMY_PROGRESS_PER_LEVEL);

  // Prune credited to ids still in the squad snapshot (bounds save size).
  const squadIds = new Set(squad.map(p => p.id));
  const prunedCredited = [...creditedSet].filter(id => squadIds.has(id));

  return { level: newLevel, progress: newProgress, credited: prunedCredited, newlyCredited, levelsGained };
}
