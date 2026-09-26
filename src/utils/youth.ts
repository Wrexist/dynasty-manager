import { YouthProspect, Position, Player, YouthAcademyState } from '@/types/game';
import { generatePlayer } from './playerGen';
import { recomputePlayerValueOnly } from './playerEconomics';
import {
  YOUTH_BASE_QUALITY, YOUTH_RATING_MULTIPLIER, YOUTH_COACH_MULTIPLIER, YOUTH_QUALITY_RANDOM_RANGE,
  YOUTH_QUALITY_MIN, YOUTH_QUALITY_MAX,
  YOUTH_BASE_AGE, YOUTH_AGE_RANGE,
  YOUTH_POTENTIAL_BASE_BONUS, YOUTH_POTENTIAL_MAX,
  YOUTH_CLUB_QUALITY_WEIGHT,
  YOUTH_READY_OVERALL_THRESHOLD, YOUTH_DEV_SCORE_BASE, YOUTH_DEV_SCORE_RANGE,
  YOUTH_PREVIEW_DEFAULT_COACH_QUALITY,
  YOUTH_POSITION_TARGET_DEPTH, YOUTH_POSITION_BASE_WEIGHT, YOUTH_POSITION_NEED_WEIGHT,
} from '@/config/youth';
import { SEASON_YOUTH_INTAKE_MIN, SEASON_YOUTH_INTAKE_RANGE } from '@/config/gameBalance';

const YOUTH_POSITIONS: Position[] = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];

type IntakePreviewEntry = YouthAcademyState['nextIntakePreview'][number];

// ── Position need ──

/**
 * Relative chance of each position in a youth intake. Every position keeps
 * YOUTH_POSITION_BASE_WEIGHT; each player the squad is short of the target
 * depth adds YOUTH_POSITION_NEED_WEIGHT. With no squad context the draw is
 * uniform, which is what every intake used to be.
 */
export function youthPositionWeights(squad?: Pick<Player, 'position'>[]): Record<Position, number> {
  const counts = {} as Record<Position, number>;
  for (const pos of YOUTH_POSITIONS) counts[pos] = 0;
  for (const p of squad || []) if (p && counts[p.position] !== undefined) counts[p.position]++;
  const weights = {} as Record<Position, number>;
  for (const pos of YOUTH_POSITIONS) {
    const shortfall = squad && squad.length > 0 ? Math.max(0, YOUTH_POSITION_TARGET_DEPTH[pos] - counts[pos]) : 0;
    weights[pos] = YOUTH_POSITION_BASE_WEIGHT + shortfall * YOUTH_POSITION_NEED_WEIGHT;
  }
  return weights;
}

/** One weighted position draw. `squad` should include academy prospects, who
 *  are the squad's future depth. */
export function pickYouthPosition(squad?: Pick<Player, 'position'>[]): Position {
  const weights = youthPositionWeights(squad);
  const total = YOUTH_POSITIONS.reduce((s, pos) => s + weights[pos], 0);
  let roll = Math.random() * total;
  for (const pos of YOUTH_POSITIONS) {
    roll -= weights[pos];
    if (roll < 0) return pos;
  }
  return YOUTH_POSITIONS[YOUTH_POSITIONS.length - 1];
}

// ── Quality / potential rolls (shared by the preview and the intake) ──

function rollYouthQuality(youthRating: number, youthCoachQuality: number, clubSquadQuality?: number): number {
  let baseQuality = YOUTH_BASE_QUALITY + youthRating * YOUTH_RATING_MULTIPLIER + youthCoachQuality * YOUTH_COACH_MULTIPLIER + Math.floor(Math.random() * YOUTH_QUALITY_RANDOM_RANGE);
  if (clubSquadQuality !== undefined) {
    baseQuality = Math.round(baseQuality * (1 - YOUTH_CLUB_QUALITY_WEIGHT) + clubSquadQuality * YOUTH_CLUB_QUALITY_WEIGHT);
  }
  return Math.min(YOUTH_QUALITY_MAX, Math.max(YOUTH_QUALITY_MIN, Math.round(baseQuality)));
}

function rollYouthPotential(overall: number, youthRating: number): number {
  return Math.min(YOUTH_POTENTIAL_MAX, overall + YOUTH_POTENTIAL_BASE_BONUS + youthRating + Math.floor(Math.random() * YOUTH_QUALITY_RANDOM_RANGE));
}

export interface YouthIntakeOptions {
  /** The persisted `nextIntakePreview`. When non-empty it IS the intake: one
   *  prospect per entry, at that position and that potential, and `count` is
   *  ignored. */
  preview?: IntakePreviewEntry[];
  /** First team + academy, for need-weighted positions when no preview drives them. */
  squad?: Pick<Player, 'position'>[];
}

export function generateYouthProspects(
  clubId: string,
  youthRating: number, // 1-10
  youthCoachQuality: number, // 0-10
  season: number,
  count: number = 3,
  clubSquadQuality?: number,
  opts: YouthIntakeOptions = {},
): { prospects: YouthProspect[]; players: ReturnType<typeof generatePlayer>[] } {
  const prospects: YouthProspect[] = [];
  const newPlayers: ReturnType<typeof generatePlayer>[] = [];
  const plan = opts.preview && opts.preview.length > 0 ? opts.preview : null;
  const total = plan ? plan.length : count;
  // Each pick joins the squad for the next pick's need (see generateIntakePreview).
  const squad: Pick<Player, 'position'>[] | undefined = opts.squad ? [...opts.squad] : undefined;

  for (let i = 0; i < total; i++) {
    const entry = plan ? plan[i] : null;
    const pos = entry?.position ?? pickYouthPosition(squad);
    squad?.push({ position: pos });
    // Current ability is rolled now, with today's coach and squad; a promised
    // potential caps it so the prospect keeps at least the usual growth gap.
    let quality = rollYouthQuality(youthRating, youthCoachQuality, clubSquadQuality);
    if (entry) quality = Math.max(YOUTH_QUALITY_MIN, Math.min(quality, entry.estimatedPotential - YOUTH_POTENTIAL_BASE_BONUS));

    const player = generatePlayer(pos, quality, clubId, season);
    // Force young age
    player.age = YOUTH_BASE_AGE + Math.floor(Math.random() * YOUTH_AGE_RANGE);
    player.isFromYouthAcademy = true;
    // The previewed potential is what arrives; without a preview, roll it.
    player.potential = entry
      ? Math.min(YOUTH_POTENTIAL_MAX, Math.max(player.overall, entry.estimatedPotential))
      : rollYouthPotential(player.overall, youthRating);
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

export interface IntakePreviewOptions {
  youthCoachQuality?: number;
  clubSquadQuality?: number;
  /** First team + academy, for need-weighted positions. */
  squad?: Pick<Player, 'position'>[];
  /** Override the intake size (defaults to the season intake roll). */
  count?: number;
}

/**
 * Next season's youth intake, decided now.
 *
 * This used to be a separate roll (2-3 entries, its own potential formula) with
 * no link to who arrived — the real intake re-rolled count, positions and
 * potential at season end. Now the preview is persisted in
 * `youthAcademy.nextIntakePreview` and `generateYouthProspects({ preview })`
 * turns each entry into exactly that prospect. Size and potential use the
 * intake's own rules (SEASON_YOUTH_INTAKE_MIN/RANGE, rollYouthPotential), so
 * the balance of what arrives is unchanged. Manager perks (Wonder Coach,
 * Golden Generation, Prodigy Factory) still apply on arrival, on top.
 */
export function generateIntakePreview(youthRating: number, opts: IntakePreviewOptions = {}): IntakePreviewEntry[] {
  const count = opts.count ?? SEASON_YOUTH_INTAKE_MIN + Math.floor(Math.random() * SEASON_YOUTH_INTAKE_RANGE);
  const coach = opts.youthCoachQuality ?? YOUTH_PREVIEW_DEFAULT_COACH_QUALITY;
  // Each pick joins the squad for the next pick's need, so one gap does not
  // pull the whole intake to the same position.
  // No squad context = the old uniform draw.
  const squad: Pick<Player, 'position'>[] | undefined = opts.squad ? [...opts.squad] : undefined;
  const previews: IntakePreviewEntry[] = [];
  for (let i = 0; i < count; i++) {
    const position = pickYouthPosition(squad);
    squad?.push({ position });
    const quality = rollYouthQuality(youthRating, coach, opts.clubSquadQuality);
    previews.push({ position, estimatedPotential: rollYouthPotential(quality, youthRating) });
  }
  return previews;
}
