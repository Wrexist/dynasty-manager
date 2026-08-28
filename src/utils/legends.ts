import type { Player, PlayerAttributes, RetiredLegend } from '@/types/game';
import { SEED_LEGENDS } from '@/data/legends';
import { generatePlayer, calculateOverall } from '@/utils/playerGen';
import { clamp } from '@/utils/helpers';
import { recomputeDerivedEconomics } from '@/utils/playerEconomics';
import {
  LEGEND_MIN_PEAK_OVR,
  LEGEND_MIN_PEAK_OVR_WITH_BALLON_DOR,
  LEGEND_ARCHIVE_CAP,
  LEGEND_CARD_AGE,
} from '@/config/gameBalance';
import { PACK_WAGE_FACTOR, LEGEND_OWN_ARCHIVE_BIAS } from '@/config/packs';

/**
 * Hall of Legends — the lifecycle of a retired great.
 *
 * `seasonEnd` used to delete every retiring player, which meant a save
 * generated genuine legends every season and binned them. Now the deletion
 * points call `buildRetiredLegend` + `addLegendToArchive` for the worthy few,
 * and the pack system deals them back as Legend cards (`drawLegend` +
 * `buildPlayerFromLegend`). The authored seed set exists so the pool is never
 * empty in a young save; the archive is what makes it a Dynasty feature — the
 * hall fills with the save's own history, including the manager's own former
 * players and, eventually, the real stars the world started with.
 */

const ATTR_KEYS: (keyof PlayerAttributes)[] = ['pace', 'shooting', 'passing', 'defending', 'physical', 'mental'];

/** The peak this player should be remembered at. `peakOverall` is sampled at
 *  season rollovers, so the live overall can briefly exceed it mid-season —
 *  and a week-10 high that decays by week 38 is never seen at all; rollover
 *  sampling is deliberately coarse. A reigning Ballon d'Or top-10 boost IS
 *  included when the rollover catches it: the peak records the highest rating
 *  the player ever actually played at, boosts and all. */
export function peakOf(p: Pick<Player, 'overall' | 'peakOverall'>): number {
  return Math.max(p.peakOverall ?? 0, p.overall);
}

/** The archive gate. Mirrors the documented `PlayerRarity` 'legend' rungs:
 *  a 93+ peak stands alone; a 90+ peak needs Ballon d'Or top-10 pedigree. */
export function isLegendWorthy(
  p: Pick<Player, 'overall' | 'peakOverall' | 'ballonDorTop10Ever'>,
): boolean {
  const peak = peakOf(p);
  if (peak >= LEGEND_MIN_PEAK_OVR) return true;
  return peak >= LEGEND_MIN_PEAK_OVR_WITH_BALLON_DOR && p.ballonDorTop10Ever === true;
}

/**
 * Freeze a retiring player into an archive record.
 *
 * Attributes are rescaled from his declined final shape back up to his peak
 * NOW, at archive time, so the stored record is card-ready and the dealt
 * card's attributes always agree with its printed rating — the same
 * attributes-must-match-overall contract `rollPackPlayer` maintains, enforced
 * once here instead of on every open.
 */
export function buildRetiredLegend(p: Player, season: number, clubName?: string): RetiredLegend {
  const targetPeak = peakOf(p);
  const attributes = { ...p.attributes };
  // Converge the derived overall onto the peak, not just one blind ratio pass:
  // a deep-declined retiree needs a large ratio, the top attributes saturate
  // at 99, and a single pass then lands well short (measured: peak 94 from a
  // 72 final shape derived at 91). Iterating re-spends the shortfall on the
  // attributes that still have headroom, the same loop shape rollPackPlayer
  // uses for its scale-to-fit fallback.
  let derived = calculateOverall(attributes, p.position);
  for (let i = 0; i < 6 && derived > 0 && derived < targetPeak; i++) {
    const ratio = targetPeak / derived;
    for (const key of ATTR_KEYS) {
      attributes[key] = clamp(Math.round(attributes[key] * ratio));
    }
    const next = calculateOverall(attributes, p.position);
    if (next === derived) break; // fully saturated — no headroom left
    derived = next;
  }
  // Print what the attributes actually support. When saturation stops the
  // climb short of the sampled peak, the RECORD comes down to the card the
  // engine will really play — a hall card whose printed rating outruns its
  // attributes is exactly the desync rollPackPlayer exists to prevent. The
  // eligibility judgement (isLegendWorthy) has already been made on the true
  // sampled peak, which is correct: worthiness is history, the card is maths.
  const peak = Math.min(targetPeak, Math.max(derived, p.overall));
  const debut = typeof p.joinedSeason === 'number' ? p.joinedSeason : null;
  const span = debut !== null && debut < season ? `seasons ${debut}–${season}` : `season ${season}`;
  return {
    id: `legend-${p.id}`,
    firstName: p.firstName,
    lastName: p.lastName,
    nationality: p.nationality,
    position: p.position,
    altPos: p.alternatePositions,
    peakOverall: peak,
    attributes,
    skillMoves: p.skillMoves,
    appearance: p.appearance,
    retiredSeason: season,
    era: clubName ? `${clubName} great, ${span}.` : `A great of the game, ${span}.`,
    careerGoals: (p.careerGoals || 0) + (p.goals || 0),
    careerAssists: (p.careerAssists || 0) + (p.assists || 0),
    careerApps: (p.careerAppearances || 0) + (p.appearances || 0),
    ballonDorTop10: p.ballonDorTop10Ever === true,
    source: 'career',
  };
}

/**
 * Admit a legend to the archive. Idempotent on id (a player retires once, but
 * re-running a season end must not double-archive), and capped: when the hall
 * is full, the newcomer displaces the lowest peak only if he beats it. The
 * hall keeps its best, not its latest.
 */
export function addLegendToArchive(archive: RetiredLegend[], legend: RetiredLegend): RetiredLegend[] {
  if (archive.some(l => l.id === legend.id)) return archive;
  if (archive.length < LEGEND_ARCHIVE_CAP) return [...archive, legend];
  let worstIdx = 0;
  for (let i = 1; i < archive.length; i++) {
    if (archive[i].peakOverall < archive[worstIdx].peakOverall) worstIdx = i;
  }
  if (archive[worstIdx].peakOverall >= legend.peakOverall) return archive;
  const next = [...archive];
  next[worstIdx] = legend;
  return next;
}

/**
 * Pick the legend a pack deals. The save's own archive gets
 * `LEGEND_OWN_ARCHIVE_BIAS` of the draws once it holds anyone — pulling a
 * great the manager actually watched retire is the feature's whole payload,
 * and an unweighted draw would bury a one-man archive under the seed set.
 *
 * `rand` is injectable for tests; production callers omit it.
 */
export function drawLegend(
  archive: RetiredLegend[] = [],
  rand: () => number = Math.random,
): RetiredLegend {
  const fromArchive = archive.length > 0 && rand() < LEGEND_OWN_ARCHIVE_BIAS;
  const pool = fromArchive ? archive : SEED_LEGENDS;
  return pool[Math.floor(rand() * pool.length)] ?? SEED_LEGENDS[0];
}

/**
 * Resolve a card's `legendId` back to its hall record — seed set first, then
 * the save's archive. Null for an unknown id, per the degrade contract on
 * `Player.legendId`: a retired or missing record simply stops badging, it
 * never breaks a card. Shared by every surface that shows provenance (the
 * walkout, PlayerDetail, the hall list), so the lookup order can never drift
 * between them.
 */
export function resolveLegend(
  legendId: string | null | undefined,
  archive: RetiredLegend[] = [],
): RetiredLegend | null {
  if (!legendId) return null;
  return SEED_LEGENDS.find(l => l.id === legendId)
    ?? archive.find(l => l.id === legendId)
    ?? null;
}

/**
 * Mint the playable card. Issued at the legend's own peak with NO version
 * boost — the legend IS the version (a +4 on a 95 peak would out-rate
 * everything the living game can produce). Age is `LEGEND_CARD_AGE`, not the
 * retirement age: a card dealt at 40 would be force-retired — deleted — at
 * the very next season end. Wage rides the pack discount like every other
 * pull; the card's stats start at zero because they are the CARD's, not the
 * career's — the career lives in the archive record.
 */
export function buildPlayerFromLegend(legend: RetiredLegend, season: number): Player {
  const player = generatePlayer(legend.position, legend.peakOverall, '', season);
  player.firstName = legend.firstName;
  player.lastName = legend.lastName;
  player.nationality = legend.nationality;
  player.age = LEGEND_CARD_AGE;
  player.attributes = { ...legend.attributes };
  player.overall = legend.peakOverall;
  player.potential = legend.peakOverall;
  if (legend.altPos?.length) player.alternatePositions = [...legend.altPos];
  if (legend.skillMoves !== undefined) player.skillMoves = legend.skillMoves;
  if (legend.appearance) player.appearance = { ...legend.appearance };
  player.legendId = legend.id;
  // Every Legend card wears the Legends frame whatever pack dealt it — the
  // frame is the claim "this is a hall card", not "this came from tier X".
  // Always above every tier's floor gate (peaks are 88+), so the claim holds.
  player.packFrame = 'legends';
  player.wageFactor = PACK_WAGE_FACTOR;
  recomputeDerivedEconomics(player);
  return player;
}
