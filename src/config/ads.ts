/**
 * Rewarded-ad placement and pacing configuration.
 *
 * IMPORTANT: nothing in this file may modify match outcomes, training rates,
 * transfer values or any other simulation parameter. Ad rewards are limited to
 * (a) information the player already owns but has not been shown, and
 * (b) the clamped, proportional budget grants defined in `monetization.ts`.
 * See the header contracts in `config/monetization.ts` and `utils/monetization.ts`.
 *
 * PACING PHILOSOPHY — read before changing a number.
 *
 * Prompt frequency ESCALATES with demonstrated tolerance: a player who watches
 * ads is shown more of them, because they have revealed that the trade is worth
 * it to them. A player who dismisses is not chased.
 *
 * That escalation is bounded at both ends, deliberately:
 *   - A hard daily ceiling no amount of engagement can exceed.
 *   - A minimum gap between prompts, so they never stack or interrupt a beat.
 *   - Dismissals decay the allowance back down, so a player who stops engaging
 *     stops being asked.
 *
 * The ceiling is not squeamishness. D1/D7 retention is an App Store ranking
 * input as of 2026 (see marketing/aso/RESEARCH-2026.md), and an uncapped prompt
 * loop trades a few cents of ad revenue for rank, reviews and subscription LTV
 * — all of which are worth more per user than the impressions. The caps are
 * where the revenue curve actually peaks, not a concession against it.
 */

import type { AdRewardType } from '@/types/game';

/** Every surface that can raise a rewarded-ad offer. */
export type AdPlacementId =
  | 'pack_extra'
  | 'transfer_budget'
  | 'scout_potential'
  | 'youth_preview'
  | 'season_bonus';

export interface AdPlacementDef {
  id: AdPlacementId;
  /** Reward granted on completion. `null` for pack unlocks, which the packs
   *  slice grants directly rather than through the ad-reward ledger. */
  rewardType: AdRewardType | null;
  /** Popup title. */
  title: string;
  /** One line of value, shown under the title. */
  body: string;
  /** Button label for free users (they watch an ad). */
  watchCta: string;
  /** Button label for Pro users (they skip the ad and claim). */
  claimCta: string;
  /** Lower shows first when several are eligible at the same moment. */
  weight: number;
}

export const AD_PLACEMENTS: Record<AdPlacementId, AdPlacementDef> = {
  pack_extra: {
    id: 'pack_extra',
    rewardType: null,
    title: 'One more pack?',
    body: 'Open an extra pack today and keep building your squad.',
    watchCta: 'Watch to open',
    claimCta: 'Open pack',
    weight: 1,
  },
  transfer_budget: {
    id: 'transfer_budget',
    rewardType: 'transfer_budget',
    title: 'Need more in the bank?',
    body: 'Top up your transfer budget before the window closes.',
    watchCta: 'Watch for funds',
    claimCta: 'Claim funds',
    weight: 2,
  },
  scout_potential: {
    id: 'scout_potential',
    rewardType: 'scout_potential',
    title: 'How good can he get?',
    body: 'Reveal the hidden potential on your latest scout report.',
    watchCta: 'Watch to reveal',
    claimCta: 'Reveal',
    weight: 3,
  },
  youth_preview: {
    id: 'youth_preview',
    rewardType: 'youth_preview',
    title: 'Anyone worth a contract?',
    body: 'Get an early look at your next academy intake.',
    watchCta: 'Watch for a look',
    claimCta: 'Take a look',
    weight: 4,
  },
  season_bonus: {
    id: 'season_bonus',
    rewardType: 'season_bonus',
    title: 'Start next season stronger',
    body: 'Add a bonus to the budget you carry into pre-season.',
    watchCta: 'Watch for bonus',
    claimCta: 'Claim bonus',
    weight: 5,
  },
};

export const AD_PACING = {
  /** Prompts per day before any escalation, for a free player. */
  BASE_PROMPTS_PER_DAY: 3,
  /** Hard ceiling for a free player. Engagement can never push past this. */
  MAX_PROMPTS_PER_DAY: 8,
  /** Additional daily prompts earned per ad watched in the trailing window. */
  ESCALATION_PER_WATCH: 0.75,
  /** Each consecutive dismissal removes this much from the daily allowance,
   *  so a disengaged player is asked less rather than more. */
  DECAY_PER_DISMISS: 1,
  /** Floor the decay cannot push the allowance below — one ask per day is
   *  still an offer, not a campaign. */
  MIN_PROMPTS_PER_DAY: 1,

  /** Minimum gap between two prompts for a free player. */
  MIN_GAP_MS: 4 * 60 * 1000,

  // ── Pro ──
  // Pro buys `ad_free`. Pro users are never shown an ad, and they claim the
  // same rewards directly. They still see SOME offers, because the reward is
  // a genuine perk they paid for and hiding it entirely would quietly remove
  // value from the subscription — but far fewer, and never escalating.
  /** Flat daily prompt allowance for Pro. Does not escalate. */
  PRO_PROMPTS_PER_DAY: 2,
  /** Pro waits longer between offers — the pitch is not the product. */
  PRO_MIN_GAP_MS: 20 * 60 * 1000,
} as const;

/**
 * Daily prompt allowance for a player, from their engagement history.
 *
 * Free: base + (watches × escalation) − (consecutive dismissals × decay),
 * clamped to [MIN, MAX].
 * Pro: a flat, non-escalating allowance.
 */
export function dailyPromptAllowance(
  watchedToday: number,
  consecutiveDismissals: number,
  isProUser: boolean,
): number {
  if (isProUser) return AD_PACING.PRO_PROMPTS_PER_DAY;

  const earned = watchedToday * AD_PACING.ESCALATION_PER_WATCH;
  const lost = consecutiveDismissals * AD_PACING.DECAY_PER_DISMISS;
  const raw = AD_PACING.BASE_PROMPTS_PER_DAY + earned - lost;

  return Math.floor(
    Math.min(Math.max(raw, AD_PACING.MIN_PROMPTS_PER_DAY), AD_PACING.MAX_PROMPTS_PER_DAY),
  );
}

/** Minimum milliseconds between prompts for this cohort. */
export function promptGapMs(isProUser: boolean): number {
  return isProUser ? AD_PACING.PRO_MIN_GAP_MS : AD_PACING.MIN_GAP_MS;
}

/**
 * "Low budget" for the contextual transfer-budget offer, measured in weeks of
 * wage bill the club could still cover.
 *
 * Expressed relative to the wage bill rather than as a flat figure because the
 * same absolute number is a crisis for a League Two side and a rounding error
 * for Arsenal — the same reason `AD_REWARD_VALUES` grants a percentage.
 */
export const AD_OFFER_LOW_BUDGET_WAGE_WEEKS = 8;
