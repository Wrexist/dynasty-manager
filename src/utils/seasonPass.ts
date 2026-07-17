/**
 * Pure Dynasty Pass logic — point accrual, track status, and idempotent claims.
 *
 * Storage-free and side-effect-free: every function takes the current
 * `SeasonPassState` and returns a new one (or a derived view). The slice owns
 * persistence (it lives on the save) and the XP payout; these helpers own the
 * maths so they're trivially unit-testable.
 */
import type { SeasonPassState } from '@/types/game';
import { SEASON_PASS_POINTS, SEASON_PASS_TIERS, SEASON_PASS_MAX_POINTS, type SeasonPassTier } from '@/config/seasonPass';

/** A fresh, empty pass — the season-start / new-save default. */
export function defaultSeasonPass(): SeasonPassState {
  return { points: 0, claimedTiers: [] };
}

/** Add `amount` points (>= 0). Returns the SAME reference when nothing changes,
 *  so callers can cheaply skip a no-op state write. */
export function addSeasonPassPoints(pass: SeasonPassState | undefined | null, amount: number): SeasonPassState {
  const base = pass ?? defaultSeasonPass();
  if (!amount || amount <= 0) return base;
  return { points: base.points + amount, claimedTiers: base.claimedTiers };
}

/** Points a single finished match earns: always `matchPlayed`, plus `win` on a
 *  win. Draws and losses earn the participation points only. */
export function matchPassPoints(won: boolean): number {
  return SEASON_PASS_POINTS.matchPlayed + (won ? SEASON_PASS_POINTS.win : 0);
}

export interface SeasonPassTierStatus {
  tier: SeasonPassTier;
  /** Points threshold reached. */
  unlocked: boolean;
  /** Already collected. */
  claimed: boolean;
  /** Unlocked and not yet collected. */
  claimable: boolean;
}

/** Per-tier status for the reward track, ascending by points. */
export function getSeasonPassStatus(pass: SeasonPassState): SeasonPassTierStatus[] {
  const claimed = new Set(pass.claimedTiers);
  return SEASON_PASS_TIERS.map(tier => {
    const unlocked = pass.points >= tier.points;
    const isClaimed = claimed.has(tier.tier);
    return { tier, unlocked, claimed: isClaimed, claimable: unlocked && !isClaimed };
  });
}

/** How many tiers are unlocked but not yet claimed — powers the "NEW" badge. */
export function claimableTierCount(pass: SeasonPassState): number {
  const claimed = new Set(pass.claimedTiers);
  return SEASON_PASS_TIERS.reduce(
    (n, t) => n + (pass.points >= t.points && !claimed.has(t.tier) ? 1 : 0),
    0,
  );
}

/** Progress toward completing the whole track, 0–100. */
export function seasonPassProgressPct(pass: SeasonPassState): number {
  return Math.min(100, Math.round((pass.points / SEASON_PASS_MAX_POINTS) * 100));
}

/** The next locked tier (or null once every tier is unlocked). */
export function nextLockedTier(pass: SeasonPassState): SeasonPassTier | null {
  return SEASON_PASS_TIERS.find(t => pass.points < t.points) ?? null;
}

export interface ClaimResult {
  pass: SeasonPassState;
  /** XP that was granted (0 if the claim was a no-op). */
  xp: number;
  /** True when the tier was newly claimed. */
  claimed: boolean;
}

/** Idempotent claim. A no-op (claimed:false, xp:0, same pass ref) when the tier
 *  is unknown, still locked, or already claimed. Otherwise adds the tier to
 *  `claimedTiers` and reports the XP the caller should grant. */
export function claimSeasonPassTier(pass: SeasonPassState, tier: number): ClaimResult {
  const def = SEASON_PASS_TIERS.find(t => t.tier === tier);
  if (!def) return { pass, xp: 0, claimed: false };
  if (pass.points < def.points || pass.claimedTiers.includes(tier)) {
    return { pass, xp: 0, claimed: false };
  }
  return {
    pass: { points: pass.points, claimedTiers: [...pass.claimedTiers, tier] },
    xp: def.xp,
    claimed: true,
  };
}
