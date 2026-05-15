import type { Player } from '@/types/game';
import {
  RELEASE_CLAUSE_PERCENTAGE,
  RELEASE_STAR_OVR_THRESHOLD, RELEASE_STAR_FAN_MOOD_PENALTY, RELEASE_STAR_BOARD_PENALTY,
  RELEASE_LEGEND_SEASONS, RELEASE_LEGEND_FAN_MOOD_PENALTY, RELEASE_LEGEND_BOARD_PENALTY,
  RELEASE_WASTED_POTENTIAL_OVR, RELEASE_WASTED_POTENTIAL_AGE, RELEASE_WASTED_POTENTIAL_FAN_MOOD_PENALTY,
} from '@/config/transfers';
import { TOTAL_WEEKS } from '@/config/gameBalance';

export type ReleaseReasonTag = 'star' | 'legend' | 'wasted_potential';

export interface ReleaseImpact {
  remainingWeeks: number;
  fullSeverance: number;
  clauseCost: number;
  savingsVsFullSeverance: number;
  fanMoodDelta: number;
  boardConfidenceDelta: number;
  reasons: { tag: ReleaseReasonTag; label: string }[];
}

/** Single source of truth for what releasing a player costs and impacts.
 *  Both the slice (which applies the charges) and the confirmation modal
 *  (which previews them) MUST go through this — otherwise the number the
 *  user sees won't match what gets deducted. */
export function calcReleaseImpact(
  player: Player,
  season: number,
  week: number,
  totalWeeks: number = TOTAL_WEEKS,
): ReleaseImpact {
  const tw = totalWeeks || TOTAL_WEEKS;
  const remainingSeasons = Math.max(0, player.contractEnd - season);
  const remainingWeeks = remainingSeasons * tw + Math.max(0, tw - week);
  const fullSeverance = Math.round(player.wage * remainingWeeks);
  const clauseCost = Math.round(fullSeverance * RELEASE_CLAUSE_PERCENTAGE);
  const savingsVsFullSeverance = fullSeverance - clauseCost;

  let fanMoodDelta = 0;
  let boardConfidenceDelta = 0;
  const reasons: ReleaseImpact['reasons'] = [];

  const seasonsServed = player.joinedSeason != null ? Math.max(0, season - player.joinedSeason) : 0;

  if (player.overall >= RELEASE_STAR_OVR_THRESHOLD) {
    fanMoodDelta -= RELEASE_STAR_FAN_MOOD_PENALTY;
    boardConfidenceDelta -= RELEASE_STAR_BOARD_PENALTY;
    reasons.push({ tag: 'star', label: `Fans loved this ${player.overall} OVR star` });
  }
  if (seasonsServed >= RELEASE_LEGEND_SEASONS) {
    fanMoodDelta -= RELEASE_LEGEND_FAN_MOOD_PENALTY;
    boardConfidenceDelta -= RELEASE_LEGEND_BOARD_PENALTY;
    reasons.push({ tag: 'legend', label: `${seasonsServed} seasons of service` });
  }
  if (player.potential >= RELEASE_WASTED_POTENTIAL_OVR && player.age <= RELEASE_WASTED_POTENTIAL_AGE) {
    fanMoodDelta -= RELEASE_WASTED_POTENTIAL_FAN_MOOD_PENALTY;
    reasons.push({ tag: 'wasted_potential', label: `Wasted potential (${player.potential})` });
  }

  return { remainingWeeks, fullSeverance, clauseCost, savingsVsFullSeverance, fanMoodDelta, boardConfidenceDelta, reasons };
}
