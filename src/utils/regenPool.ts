import { Player, Position } from '@/types/game';
import { generatePlayer } from './playerGen';
import { inferDefaultRole } from './playerRoles';
import { pick, clamp } from './helpers';

// Positions that newgens can emerge as — evenly weighted across the pitch
const NEWGEN_POSITIONS: Position[] = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];

// Age distribution for newgens — skewed toward the younger end
const NEWGEN_AGE_MIN = 16;
const NEWGEN_AGE_MAX = 19;

// Quality band — newgens are raw but with significant upside
const NEWGEN_BASE_QUALITY_MIN = 38;
const NEWGEN_BASE_QUALITY_MAX = 62;

// Potential bonus over current overall
const NEWGEN_POTENTIAL_BONUS_MIN = 12;
const NEWGEN_POTENTIAL_BONUS_MAX = 25;
const NEWGEN_POTENTIAL_CAP = 94;

// One-in-N newgens is a wonderkid — boosted potential to high-80s / low-90s
const WONDERKID_CHANCE = 0.04;
const WONDERKID_POTENTIAL_MIN = 85;
const WONDERKID_POTENTIAL_MAX = 93;

// Rookie wages are a fraction of the auto-calculated value
const NEWGEN_WAGE_FACTOR = 0.55;

export interface SeasonalRegenResult {
  players: Player[];
  playerIds: string[];
}

/**
 * Generate a cohort of fresh 16-19 year old free-agent prospects.
 * Called once per season during endSeason to keep the transfer market alive
 * and prevent lower leagues from depleting as years tick by.
 *
 * Nationality of each newgen is drawn from the nationality distribution of a
 * randomly selected division, so the pool reflects the league tapestry.
 */
export function generateSeasonalRegens(
  season: number,
  divisionIds: string[],
  count: number,
): SeasonalRegenResult {
  const players: Player[] = [];
  const playerIds: string[] = [];

  for (let i = 0; i < count; i++) {
    const divisionId = divisionIds.length > 0 ? pick(divisionIds) : undefined;
    const pos = pick(NEWGEN_POSITIONS);
    const quality = NEWGEN_BASE_QUALITY_MIN + Math.floor(Math.random() * (NEWGEN_BASE_QUALITY_MAX - NEWGEN_BASE_QUALITY_MIN));

    const player = generatePlayer(pos, quality, '', season, divisionId);
    player.age = NEWGEN_AGE_MIN + Math.floor(Math.random() * (NEWGEN_AGE_MAX - NEWGEN_AGE_MIN + 1));
    player.clubId = '';
    player.listedForSale = false;
    player.wage = Math.max(200, Math.round(player.wage * NEWGEN_WAGE_FACTOR));

    const isWonderkid = Math.random() < WONDERKID_CHANCE;
    if (isWonderkid) {
      player.potential = WONDERKID_POTENTIAL_MIN + Math.floor(Math.random() * (WONDERKID_POTENTIAL_MAX - WONDERKID_POTENTIAL_MIN + 1));
    } else {
      const bonus = NEWGEN_POTENTIAL_BONUS_MIN + Math.floor(Math.random() * (NEWGEN_POTENTIAL_BONUS_MAX - NEWGEN_POTENTIAL_BONUS_MIN + 1));
      player.potential = clamp(player.overall + bonus, player.overall, NEWGEN_POTENTIAL_CAP);
    }

    // Rookies haven't played enough for seasonal stats
    player.goals = 0;
    player.assists = 0;
    player.appearances = 0;
    player.careerGoals = 0;
    player.careerAssists = 0;
    player.careerAppearances = 0;

    // Re-infer role since age/attribute nudges may have shifted the best fit
    player.role = inferDefaultRole(player);

    players.push(player);
    playerIds.push(player.id);
  }

  return { players, playerIds };
}

/**
 * Merge a regen batch into an existing free-agent pool, respecting a cap.
 * When the pool would exceed the cap, evict weakest existing free agents
 * below 22yr old regens — never displace an existing regen with a new one.
 */
export function mergeRegensIntoFreeAgentPool(
  regens: Player[],
  currentFreeAgentIds: string[],
  allPlayers: Record<string, Player>,
  poolMax: number,
): { freeAgentIds: string[]; evictedIds: string[] } {
  const result = [...currentFreeAgentIds];
  const evicted: string[] = [];

  for (const regen of regens) {
    if (result.length < poolMax) {
      result.push(regen.id);
      continue;
    }

    // Pool full — find the oldest / weakest existing free agent to evict
    let evictIdx = -1;
    let worstScore = Infinity;
    for (let i = 0; i < result.length; i++) {
      const fa = allPlayers[result[i]];
      if (!fa) { evictIdx = i; worstScore = -1; break; }
      // Score: younger and higher-overall = better; weakest pool member gets evicted
      const score = fa.overall - Math.max(0, fa.age - 22) * 3;
      if (score < worstScore) { worstScore = score; evictIdx = i; }
    }

    if (evictIdx >= 0) {
      evicted.push(result[evictIdx]);
      result[evictIdx] = regen.id;
    }
  }

  return { freeAgentIds: result, evictedIds: evicted };
}
