/**
 * Economy balance invariants.
 *
 * These lock in the pricing corrections made after an audit found the league
 * pyramid had no financial gradient at all — a League Two club cleared roughly
 * the same weekly profit as Arsenal, and several revenue surfaces were mispriced
 * by one to two orders of magnitude.
 *
 * The assertions are deliberately about RELATIONSHIPS and ORDERS OF MAGNITUDE,
 * not exact figures, so ordinary tuning doesn't churn the file — but a
 * regression that flattens the pyramid or restores a money printer will fail.
 */
import { describe, it, expect } from 'vitest';
import {
  getLeagueRevenueScale,
  getMatchdayIncome,
  getCommercialIncome,
  getWeeklyIncome,
  assessFfp,
} from '@/utils/financeHelpers';
import {
  calculateWeeklyMerchRevenue,
  getPlayerMarketability,
  getSignatureDropBonus,
  getSignatureDropRevenueDelta,
  getDefaultMerchState,
  getEndOfSeasonMinWeek,
} from '@/utils/merchandise';
import { getEstimatedPotential } from '@/utils/scouting';
import { getFreeAgentAcceptChance } from '@/utils/contracts';
import { evaluateSponsorNegotiation } from '@/config/sponsorship';
import {
  LEAGUE_TIER_REVENUE_SCALE,
  MATCHDAY_HOME_FIXTURE_MULTIPLIER,
  FFP_WAGE_RATIO_WARNING,
  FFP_WAGE_RATIO_CRITICAL,
} from '@/config/gameBalance';
import { SIGNATURE_DROP_COST, SIGNATURE_DROP_WEEKS, MARKETABILITY_CONTRIBUTION_CAP } from '@/config/merchandise';
import { LEAGUES } from '@/data/league';
import type { Club, Player, MerchState, ManagerProgression, SponsorNegotiationProposal } from '@/types/game';

const progression: ManagerProgression = { xp: 0, level: 1, unlockedPerks: [], prestigeLevel: 0 };

function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'test-club', name: 'Test FC', shortName: 'TST',
    color: '#000', secondaryColor: '#FFF',
    budget: 10_000_000, reputation: 3, fanBase: 50,
    wageBill: 500_000, formation: '4-3-3',
    facilities: 5, youthRating: 5, boardPatience: 5,
    playerIds: [], lineup: [], subs: [], divisionId: 'eng',
    ...overrides,
  } as Club;
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1', firstName: 'John', lastName: 'Doe',
    age: 24, nationality: 'England', position: 'ST',
    attributes: { pace: 75, shooting: 80, passing: 70, defending: 40, physical: 75, mental: 70 },
    overall: 78, potential: 85, clubId: 'test-club',
    wage: 50_000, value: 10_000_000, contractEnd: 5,
    fitness: 90, morale: 75, form: 70,
    injured: false, injuryWeeks: 0,
    goals: 10, assists: 5, appearances: 20,
    yellowCards: 0, redCards: 0,
    ...overrides,
  } as Player;
}

// ── 1. League pyramid revenue gradient ───────────────────────────────────────

describe('league revenue gradient', () => {
  it('is strictly decreasing from elite to developing leagues', () => {
    const scales = [1, 2, 3, 4].map(t => LEAGUE_TIER_REVENUE_SCALE[t]);
    for (let i = 1; i < scales.length; i++) {
      expect(scales[i]).toBeLessThan(scales[i - 1]);
    }
    expect(scales[0]).toBe(1.0);
  });

  it('keys on qualityTier, so a single-tier minnow league is not paid top-flight money', () => {
    // Cyprus is `tier: 1` (a top division) but `qualityTier: 4`. Keying the
    // scale on `tier` would have paid it Premier League gate money.
    expect(LEAGUES.find(l => l.id === 'cyp')?.tier).toBe(1);
    expect(getLeagueRevenueScale('cyp')).toBeLessThan(getLeagueRevenueScale('eng') / 5);
  });

  it('falls back to the most conservative scale for an unknown division', () => {
    expect(getLeagueRevenueScale('not-a-league')).toBe(LEAGUE_TIER_REVENUE_SCALE[4]);
    expect(getLeagueRevenueScale(undefined)).toBe(LEAGUE_TIER_REVENUE_SCALE[4]);
  });

  it('a fourth-tier club earns a small fraction of a top-flight club with a similar fanBase', () => {
    // fanBase is a 0-100 popularity index spanning only ~2x across the whole
    // pyramid, which is exactly why the flat per-fan rate flattened the economy.
    const top = makeClub({ fanBase: 45, reputation: 2, divisionId: 'eng' });
    const bottom = makeClub({ fanBase: 45, reputation: 2, divisionId: 'eng-4' });
    expect(getWeeklyIncome(bottom)).toBeLessThan(getWeeklyIncome(top) * 0.25);
  });

  it('each English tier earns strictly less than the one above it', () => {
    const income = (divisionId: string) => getWeeklyIncome(makeClub({ fanBase: 45, reputation: 2, divisionId }));
    const tiers = ['eng', 'eng-2', 'eng-3', 'eng-4'].map(income);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i]).toBeLessThan(tiers[i - 1]);
    }
  });
});

// ── 2. Matchday is gate money, not a weekly stipend ──────────────────────────

describe('matchday income', () => {
  const club = makeClub({ fanBase: 85, divisionId: 'eng' });

  it('pays nothing on a week with no home fixture', () => {
    expect(getMatchdayIncome(club, 'eng', { isHomeFixture: false })).toBe(0);
  });

  it('pays the full gate on a home week and preserves the season total', () => {
    const average = getMatchdayIncome(club, 'eng');
    const home = getMatchdayIncome(club, 'eng', { isHomeFixture: true });
    expect(home).toBe(Math.round(average * MATCHDAY_HOME_FIXTURE_MULTIPLIER));
    // Half of all fixtures are home, so 2x on half the weeks == the average.
    expect(MATCHDAY_HOME_FIXTURE_MULTIPLIER).toBe(2);
  });

  it('scales with the league revenue tier', () => {
    const bottom = makeClub({ fanBase: 85, divisionId: 'eng-4' });
    expect(getMatchdayIncome(bottom, 'eng-4')).toBeLessThan(getMatchdayIncome(club, 'eng') * 0.2);
  });
});

describe('commercial income', () => {
  it('scales its reputation component by league tier', () => {
    const top = makeClub({ reputation: 5, divisionId: 'eng' });
    const bottom = makeClub({ reputation: 5, divisionId: 'eng-4' });
    expect(getCommercialIncome(bottom, 'eng-4')).toBeLessThan(getCommercialIncome(top, 'eng') * 0.3);
  });

  it('is no longer the dominant income line for a fourth-tier club', () => {
    const club = makeClub({ fanBase: 40, reputation: 2, divisionId: 'eng-4' });
    // Commercial used to pay £500k/week to a League Two club — more than its
    // entire wage bill, and 25x its league's whole prize pool per season.
    expect(getCommercialIncome(club, 'eng-4')).toBeLessThan(150_000);
  });
});

// ── 3. FFP is measured one way only ──────────────────────────────────────────

describe('assessFfp', () => {
  it('uses the config thresholds, not hardcoded 70/90', () => {
    expect(assessFfp(FFP_WAGE_RATIO_WARNING * 1_000_000, 1_000_000).status).toBe('warning');
    expect(assessFfp(FFP_WAGE_RATIO_CRITICAL * 1_000_000, 1_000_000).status).toBe('critical');
    expect(assessFfp((FFP_WAGE_RATIO_WARNING - 0.01) * 1_000_000, 1_000_000).status).toBe('healthy');
  });

  it('treats costs with no revenue as critical', () => {
    const ffp = assessFfp(100_000, 0);
    expect(ffp.noIncome).toBe(true);
    expect(ffp.status).toBe('critical');
    expect(ffp.ratio).toBe(1);
  });

  it('is healthy at zero cost and zero revenue', () => {
    expect(assessFfp(0, 0).status).toBe('healthy');
  });

  it('measures TOTAL expenses, so staff and scouting count toward the ratio', () => {
    // The Finance page used to compare player wages alone against total income
    // while the board charged confidence on the full cost base — so the page
    // read "healthy" while the board was applying a weekly penalty.
    const playerWages = 600_000;
    const otherCosts = 200_000;
    const income = 1_000_000;
    expect(assessFfp(playerWages, income).status).toBe('healthy');
    expect(assessFfp(playerWages + otherCosts, income).status).toBe('warning');
  });
});

// ── 4. Merchandise ───────────────────────────────────────────────────────────

describe('merchandise pricing', () => {
  it('caps the goals+assists term in marketability', () => {
    const modest = makePlayer({ goals: 10, assists: 10, appearances: 30 });
    const absurd = makePlayer({ goals: 80, assists: 60, appearances: 30 });
    // Uncapped, this bought £6,000 of permanent weekly revenue per goal.
    expect(getPlayerMarketability(absurd) - getPlayerMarketability(modest))
      .toBeLessThanOrEqual(MARKETABILITY_CONTRIBUTION_CAP);
  });

  it('marketability stays in a sane band for a world-class season', () => {
    const star = makePlayer({ overall: 92, goals: 40, assists: 20, appearances: 38, age: 24 });
    expect(getPlayerMarketability(star)).toBeLessThan(120);
  });

  it('star-player revenue respects the league tier scale', () => {
    // The star bonus used to be added AFTER the whole multiplicative chain, so
    // it ignored the tier scale, product lines, pricing and campaigns entirely.
    const players = {
      p1: makePlayer({ id: 'p1', overall: 90, goals: 30, appearances: 35 }),
      p2: makePlayer({ id: 'p2', overall: 86, goals: 20, appearances: 35 }),
      p3: makePlayer({ id: 'p3', overall: 84, goals: 15, appearances: 35 }),
    };
    const merch = getDefaultMerchState();
    const top = calculateWeeklyMerchRevenue(merch, makeClub({ playerIds: ['p1', 'p2', 'p3'] }), players, 'eng', progression);
    const bottom = calculateWeeklyMerchRevenue(merch, makeClub({ playerIds: ['p1', 'p2', 'p3'] }), players, 'eng-4', progression);
    expect(bottom).toBeLessThan(top);
  });

  it('star-player revenue respects the active product lines', () => {
    const players = { p1: makePlayer({ id: 'p1', overall: 90, goals: 30, appearances: 35 }) };
    const club = makeClub({ playerIds: ['p1'], reputation: 5 });
    const oneLine: MerchState = { ...getDefaultMerchState(), activeProductLines: ['matchday_essentials'] };
    const manyLines: MerchState = {
      ...getDefaultMerchState(),
      activeProductLines: ['matchday_essentials', 'replica_kits', 'lifestyle_apparel', 'memorabilia'],
    };
    expect(calculateWeeklyMerchRevenue(manyLines, club, players, 'eng', progression))
      .toBeGreaterThan(calculateWeeklyMerchRevenue(oneLine, club, players, 'eng', progression));
  });

  it('three star players cannot out-earn a mid-table wage bill', () => {
    const players = {
      p1: makePlayer({ id: 'p1', overall: 84, goals: 30, assists: 15, appearances: 38, age: 23 }),
      p2: makePlayer({ id: 'p2', overall: 82, goals: 25, assists: 12, appearances: 38, age: 24 }),
      p3: makePlayer({ id: 'p3', overall: 80, goals: 20, assists: 20, appearances: 38, age: 22 }),
    };
    const club = makeClub({ playerIds: ['p1', 'p2', 'p3'], wageBill: 600_000, divisionId: 'eng-2' });
    const revenue = calculateWeeklyMerchRevenue(getDefaultMerchState(), club, players, 'eng-2', progression);
    // Was £723k/week against a £608k wage bill — 119% of the whole payroll.
    expect(revenue).toBeLessThan(club.wageBill);
  });

  it('can be a net loss when operating costs exceed revenue', () => {
    // The old Math.max(0, …) made merchandising a risk-free bet and desynced
    // the finance breakdown's reported gross from the money actually applied.
    const tinyClub = makeClub({ fanBase: 5, reputation: 5, divisionId: 'eng-4' });
    const allLines: MerchState = {
      ...getDefaultMerchState(),
      activeProductLines: ['matchday_essentials', 'replica_kits', 'lifestyle_apparel', 'memorabilia', 'digital_global'],
    };
    expect(calculateWeeklyMerchRevenue(allLines, tinyClub, {}, 'eng-4', progression)).toBeLessThan(0);
  });
});

describe('signature drops', () => {
  const star = makePlayer({ overall: 88, goals: 30, assists: 12, appearances: 35, age: 24 });

  it('is not a 30x money printer', () => {
    // Was £6.44M/week gross on a £75k outlay (86x), ~5 times a season.
    const perWeek = getSignatureDropRevenueDelta(
      getDefaultMerchState(),
      makeClub({ fanBase: 85, reputation: 5 }),
      { [star.id]: star },
      'eng',
      progression,
      star,
    );
    const totalReturn = perWeek * SIGNATURE_DROP_WEEKS;
    expect(totalReturn).toBeLessThan(SIGNATURE_DROP_COST * 8);
  });

  it('the raw bonus is a revenue-base addend, well above the effective delta', () => {
    const raw = getSignatureDropBonus(star);
    const effective = getSignatureDropRevenueDelta(
      getDefaultMerchState(), makeClub({ fanBase: 85 }), { [star.id]: star }, 'eng', progression, star,
    );
    expect(raw).toBeGreaterThan(effective);
    expect(effective).toBeGreaterThan(0);
  });

  it('is worth more when more product lines are running', () => {
    const club = makeClub({ fanBase: 85, reputation: 5 });
    const oneLine = getDefaultMerchState();
    const manyLines: MerchState = {
      ...oneLine,
      activeProductLines: ['matchday_essentials', 'replica_kits', 'lifestyle_apparel'],
    };
    const a = getSignatureDropRevenueDelta(oneLine, club, { [star.id]: star }, 'eng', progression, star);
    const b = getSignatureDropRevenueDelta(manyLines, club, { [star.id]: star }, 'eng', progression, star);
    expect(b).toBeGreaterThan(a);
  });
});

describe('end of season sale window', () => {
  it('is reachable in short seasons', () => {
    // Hardcoded week 38 was past the final week in 33 of the 45 leagues.
    for (const totalWeeks of [30, 34, 38, 46]) {
      expect(getEndOfSeasonMinWeek(totalWeeks)).toBeLessThan(totalWeeks);
    }
  });

  it('scales with season length and still leaves room for the campaign', () => {
    expect(getEndOfSeasonMinWeek(46)).toBe(38);
    expect(getEndOfSeasonMinWeek(34)).toBeLessThan(getEndOfSeasonMinWeek(46));
  });

  it('falls back to the absolute baseline when season length is unknown', () => {
    expect(getEndOfSeasonMinWeek(undefined)).toBe(38);
    expect(getEndOfSeasonMinWeek(0)).toBe(38);
  });
});

// ── 5. Sponsor negotiation ───────────────────────────────────────────────────

describe('sponsor negotiation', () => {
  const original: SponsorNegotiationProposal = {
    weeklyPayment: 500_000,
    performanceBonus: 1_000_000,
    seasonDuration: 3,
  };

  it('shortening the deal does not pay for a fee increase', () => {
    // durationDemand was signed, so cutting seasons credited demand budget: a
    // rep-5 club took £580k/wk → £879k/wk accepted on round 1, deterministically.
    const greedy: SponsorNegotiationProposal = {
      weeklyPayment: 875_000,
      performanceBonus: original.performanceBonus,
      seasonDuration: 1,
    };
    expect(evaluateSponsorNegotiation(original, greedy, 5, 0).outcome).not.toBe('accepted');
  });

  it('shortening alone is still free (never a credit, never a cost)', () => {
    const shorter: SponsorNegotiationProposal = { ...original, seasonDuration: 1 };
    expect(evaluateSponsorNegotiation(original, shorter, 5, 0).outcome).toBe('accepted');
  });

  it('asking for a longer deal still costs demand budget', () => {
    const longerAndRicher: SponsorNegotiationProposal = {
      weeklyPayment: Math.round(original.weeklyPayment * 1.5),
      performanceBonus: original.performanceBonus,
      seasonDuration: 4,
    };
    const justRicher: SponsorNegotiationProposal = {
      weeklyPayment: Math.round(original.weeklyPayment * 1.5),
      performanceBonus: original.performanceBonus,
      seasonDuration: original.seasonDuration,
    };
    const a = evaluateSponsorNegotiation(original, longerAndRicher, 3, 0);
    const b = evaluateSponsorNegotiation(original, justRicher, 3, 0);
    // Adding duration on top of the same fee ask can only make the sponsor less
    // willing, never more.
    const rank = { accepted: 0, countered: 1, withdrawn: 2 } as Record<string, number>;
    expect(rank[a.outcome] ?? 1).toBeGreaterThanOrEqual(rank[b.outcome] ?? 1);
  });
});

// ── 6. Free agents can refuse ────────────────────────────────────────────────

describe('free agent acceptance', () => {
  const player = makePlayer({ wage: 100_000, overall: 74, morale: 60, form: 60 });

  it('accepts outright when the offer meets his expected wage', () => {
    expect(getFreeAgentAcceptChance(player, 100_000, 3)).toBe(1);
    expect(getFreeAgentAcceptChance(player, 150_000, 3)).toBe(1);
  });

  it('is a real gamble at the UI floor, not a guaranteed 30% discount', () => {
    const chance = getFreeAgentAcceptChance(player, 70_000, 3);
    expect(chance).toBeGreaterThan(0);
    expect(chance).toBeLessThan(0.8);
  });

  it('improves monotonically as the offer improves', () => {
    const low = getFreeAgentAcceptChance(player, 72_000, 3);
    const mid = getFreeAgentAcceptChance(player, 85_000, 3);
    const high = getFreeAgentAcceptChance(player, 97_000, 3);
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
  });

  it('never returns a probability outside [0, 1]', () => {
    for (const wage of [0, 1_000, 50_000, 99_999, 100_000, 1_000_000]) {
      const c = getFreeAgentAcceptChance(player, wage, 3);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });
});

// ── 7. Scouting fog is recoverable, not discarded ────────────────────────────

describe('scout report potential estimate', () => {
  it('applies the same error to potential as the report applied to overall', () => {
    const player = { overall: 70, potential: 85 };
    expect(getEstimatedPotential(player, { estimatedOverall: 76 })).toBe(91);
    expect(getEstimatedPotential(player, { estimatedOverall: 64 })).toBe(79);
  });

  it('is exact when the scout had full knowledge', () => {
    const player = { overall: 70, potential: 85 };
    expect(getEstimatedPotential(player, { estimatedOverall: 70 })).toBe(85);
  });

  it('stays inside the 30-99 display range', () => {
    expect(getEstimatedPotential({ overall: 40, potential: 45 }, { estimatedOverall: 20 })).toBeGreaterThanOrEqual(30);
    expect(getEstimatedPotential({ overall: 90, potential: 95 }, { estimatedOverall: 99 })).toBeLessThanOrEqual(99);
  });
});
