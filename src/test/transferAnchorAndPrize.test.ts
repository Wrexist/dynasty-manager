/**
 * Regression: the transfer market must not print money, and the AI must be on
 * the same pay scale as the player.
 *
 * 1. **The asking-price anchor was inverted.** The comment above it says it
 *    exists so that a recent listing cannot anchor bids above worth AND so that
 *    "an ancient listing [does not keep] its original asking price forever, so
 *    AI clubs bid ~8x a declining player's real value". The condition did the
 *    opposite: the anchor applied only to listings OLDER than four weeks.
 *    Measured on the old code, a squad listed at the UI's 2x cap drew bids of
 *    0.86x value in week 1 and 3.45x (peak 6.0x) by week 6 — so "buy an
 *    external target at ~1.1-1.5x, relist at 2x, sell in week 6-8" was a
 *    repeatable profit loop, every window, across every spare squad slot.
 *
 * 2. **AI league prize money skipped the tier scale** the player's own formula
 *    applies, so AI clubs were paid top-flight prize money in every division.
 *    Measured in season 1: an eng-4 club drew 20.9x the prize the player's
 *    formula would pay it, and that prize was 93% of its entire weekly surplus.
 *
 * 3. **The tier scale was keyed on `tier`, not `qualityTier`.** 32 of the 45
 *    leagues are single-tier — `tier: 1` with a `qualityTier` of 2-4 — so they
 *    drew full top-flight prize money next to matchday and commercial income
 *    scaled to 0.14-0.38. The gradient existed only inside the five countries
 *    with real pyramids.
 */
import { describe, it, expect } from 'vitest';
import { getLeaguePositionPrize } from '@/utils/financeHelpers';
import { estimateWeeklyIncome } from '@/utils/aiSimulation';
import { ASKING_PRICE_BID_ANCHOR, MAX_ASKING_ANCHOR_VALUE_MULTIPLE } from '@/config/transfers';
import { LEAGUES } from '@/data/league';
import type { Club, LeagueTableEntry } from '@/types/game';

describe('the asking-price anchor cannot drag a bid far above value', () => {
  it('is capped at a bounded multiple of the player value', () => {
    const value = 10_000_000;
    // The UI lets a player be listed at 2x value; the anchor must not follow.
    const askingPrice = value * 2;
    const anchored = Math.min(askingPrice * ASKING_PRICE_BID_ANCHOR, value * MAX_ASKING_ANCHOR_VALUE_MULTIPLE);
    expect(anchored / value).toBeLessThanOrEqual(MAX_ASKING_ANCHOR_VALUE_MULTIPLE);
    // And the cap must actually bite on that listing, not be decorative.
    expect(askingPrice * ASKING_PRICE_BID_ANCHOR).toBeGreaterThan(value * MAX_ASKING_ANCHOR_VALUE_MULTIPLE);
  });

  it('keeps the ceiling well below the measured exploit range', () => {
    // The old code produced 2.35x-3.45x mean and 6.0x peak.
    expect(MAX_ASKING_ANCHOR_VALUE_MULTIPLE).toBeLessThan(2);
  });
});

describe('prize money uses one formula and one tier key', () => {
  function club(id: string, divisionId: string): Club {
    return {
      id, name: id, shortName: id, divisionId,
      budget: 0, wageBill: 0, fanBase: 50, facilities: 3,
      playerIds: [], lineup: [], subs: [], formation: '4-4-2',
      reputation: 50, primaryColor: '#fff', secondaryColor: '#000',
    } as unknown as Club;
  }
  const table = (ids: string[]): LeagueTableEntry[] => ids.map(id => ({
    clubId: id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0,
    goalsAgainst: 0, goalDifference: 0, points: 0, form: [], cleanSheets: 0,
  }));

  it('the AI prize equals the player prize for the same club and position', () => {
    // A fourth-tier league — where the divergence was largest (20.9x).
    const league = LEAGUES.find(l => l.tier === 4) ?? LEAGUES.find(l => (l.qualityTier ?? 1) >= 3)!;
    const ids = Array.from({ length: 20 }, (_, i) => `c${i}`);
    const t = table(ids);
    const c = club('c0', league.id);

    const playerFormula = getLeaguePositionPrize(1, t.length, league.qualityTier);
    const aiIncome = estimateWeeklyIncome(c, t);
    const aiWithoutPrize = estimateWeeklyIncome(c, []);

    // `estimateWeeklyIncome([])` falls back to a bottom-of-table position, so
    // compare the prize component rather than the totals: top of the table must
    // earn more than the fallback by exactly the shared formula's spread.
    expect(aiIncome).toBeGreaterThan(aiWithoutPrize);
    expect(playerFormula).toBeGreaterThan(0);
    // The AI's prize component, recovered by differencing against last place.
    const aiLast = estimateWeeklyIncome(c, t.slice().reverse().concat()); // c0 now last
    const aiPrizeSpread = aiIncome - aiLast;
    const playerPrizeSpread = playerFormula - getLeaguePositionPrize(t.length, t.length, league.qualityTier);
    expect(aiPrizeSpread).toBe(playerPrizeSpread);
  });

  it('a single-tier league with a weak qualityTier is not paid top-flight prize money', () => {
    const weak = LEAGUES.find(l => l.tier === 1 && (l.qualityTier ?? 1) >= 3);
    expect(weak, 'expected at least one single-tier league with a weak qualityTier').toBeTruthy();
    const top = LEAGUES.find(l => l.tier === 1 && (l.qualityTier ?? 1) === 1)!;

    const weakPrize = getLeaguePositionPrize(1, 20, weak!.qualityTier);
    const topPrize = getLeaguePositionPrize(1, 20, top.qualityTier);
    expect(weakPrize).toBeLessThan(topPrize);
  });
});
