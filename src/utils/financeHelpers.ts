/**
 * Finance Helper Functions
 * Centralized income/expense calculations used across Dashboard, FinancePage, ClubPage.
 */

import {
  MATCHDAY_INCOME_PER_FAN,
  MATCHDAY_HOME_FIXTURE_MULTIPLIER,
  COMMERCIAL_INCOME_PER_REP,
  COMMERCIAL_INCOME_BASE,
  STADIUM_INCOME_PER_LEVEL,
  POSITION_PRIZE_PER_RANK,
  POSITION_PRIZE_MAX_RANK,
  POSITION_PRIZE_TIER_SCALE,
  LEAGUE_TIER_REVENUE_SCALE,
  SCOUTING_COST_PER_ASSIGNMENT,
  FAN_MOOD_BASE,
  FAN_MOOD_SCALE,
  FFP_WAGE_RATIO_WARNING,
  FFP_WAGE_RATIO_CRITICAL,
} from '@/config/gameBalance';
import { hasPerk } from '@/utils/managerPerks';
import { SPONSOR_SLOTS } from '@/config/sponsorship';
import { calculateWeeklyMerchRevenue, getMerchOperatingCost } from '@/utils/merchandise';
import { getEffectiveStadiumLevel } from '@/utils/facilities';
import { LEAGUES } from '@/data/league';

import type { Club, LeagueTableEntry, FacilitiesState, ManagerProgression, SponsorDeal, MerchState, LeagueId, Player, StaffMember } from '@/types/game';

interface FinanceLineItem {
  label: string;
  amount: number;
}

export interface FinanceBreakdown {
  income: FinanceLineItem[];
  expenses: FinanceLineItem[];
  totalIncome: number;
  totalExpenses: number;
  net: number;
}

/**
 * League-position prize money — single source of truth, used by BOTH the
 * weekAdvance income application (the money actually paid) and the finance
 * breakdown display, so the two can never drift apart again.
 *
 * Max prize rank derives from the actual division size (tableSize + 1) so
 * every position earns ≥1 rank of prize in 18- and 24-team divisions too;
 * POSITION_PRIZE_MAX_RANK (20-team baseline) is only the no-table fallback.
 * The result is scaled by league tier so lower divisions pay proportionally
 * less (unknown tiers use the tier-4 scale).
 */
export function getLeaguePositionPrize(tablePos: number, tableSize: number, tier?: number): number {
  const maxPrizeRank = tableSize > 0 ? tableSize + 1 : POSITION_PRIZE_MAX_RANK;
  const tierScale = POSITION_PRIZE_TIER_SCALE[tier ?? -1] ?? POSITION_PRIZE_TIER_SCALE[4];
  return Math.round(Math.max(0, maxPrizeRank - tablePos) * POSITION_PRIZE_PER_RANK * tierScale);
}

/**
 * Weekly club-revenue scale for a division, keyed on `LeagueInfo.qualityTier`.
 * Single source of truth for the pyramid's financial gradient — used by
 * matchday and commercial income here, and (via the exported helpers below) by
 * `weekAdvance`'s income application so the money paid always matches the
 * money displayed.
 *
 * Unknown/missing league → tier-4 scale, never top-flight money.
 */
export function getLeagueRevenueScale(division?: LeagueId | string): number {
  const qualityTier = LEAGUES.find(l => l.id === division)?.qualityTier;
  return LEAGUE_TIER_REVENUE_SCALE[qualityTier ?? -1] ?? LEAGUE_TIER_REVENUE_SCALE[4];
}

/**
 * Matchday gate receipts.
 *
 * `club.fanBase` is a 0-100 popularity index, so the raw product is scaled by
 * the league revenue tier (see `LEAGUE_TIER_REVENUE_SCALE`) — without it a
 * League Two club banked within 50% of Arsenal's matchday.
 *
 * `opts.isHomeFixture` decides the basis, and is deliberately part of THIS
 * function rather than left to the caller: matchday used to be paid every single
 * week, including away games, byes and the post-season. Every league plays
 * exactly half its fixtures at home, so the gate is paid at
 * `MATCHDAY_HOME_FIXTURE_MULTIPLIER` (2x) the weekly average and only on home
 * weeks — the season total is unchanged, but the money is lumpy and tied to
 * actually hosting a match.
 *
 *  - `isHomeFixture: true`  → full gate for a home match week
 *  - `isHomeFixture: false` → 0 (away week, bye, or post-season)
 *  - omitted                → the smoothed weekly average, which is what the
 *                             Finance page should show a player budgeting with
 *
 * `opts.fanMood` / `derby` / `streak` carry the situational multipliers.
 */
export function getMatchdayIncome(
  club: Club,
  division?: LeagueId | string,
  opts: { fanMood?: number; derby?: number; streak?: number; isHomeFixture?: boolean } = {},
): number {
  if (opts.isHomeFixture === false) return 0;
  const fanMoodMult = opts.fanMood ?? 1;
  const derbyMult = opts.derby ?? 1;
  const streakMult = opts.streak ?? 1;
  const fixtureMult = opts.isHomeFixture === true ? MATCHDAY_HOME_FIXTURE_MULTIPLIER : 1;
  const tierScale = getLeagueRevenueScale(division ?? club.divisionId);
  return Math.round(
    club.fanBase * MATCHDAY_INCOME_PER_FAN * tierScale * fanMoodMult * derbyMult * streakMult * fixtureMult,
  );
}

/**
 * Commercial income for one week: a small flat floor plus a reputation-driven,
 * tier-scaled component. The reputation term is scaled because reputation only
 * spans 1-5 — unscaled, a rep-2 fourth-tier club drew £400k/week of commercial
 * revenue, more than its entire wage bill.
 */
export function getCommercialIncome(club: Club, division?: LeagueId | string): number {
  const tierScale = getLeagueRevenueScale(division ?? club.divisionId);
  return Math.round(COMMERCIAL_INCOME_BASE + club.reputation * COMMERCIAL_INCOME_PER_REP * tierScale);
}

/** Simple weekly income estimate (matchday + commercial) */
export function getWeeklyIncome(club: Club, division?: LeagueId | string): number {
  return getMatchdayIncome(club, division) + getCommercialIncome(club, division);
}

/** Net weekly income after wage bill */
export function getNetWeeklyIncome(club: Club, division?: LeagueId | string): number {
  return getWeeklyIncome(club, division) - club.wageBill;
}

export type FfpStatus = 'healthy' | 'warning' | 'critical';

export interface FfpAssessment {
  /** total weekly expenses ÷ total weekly income. 1 when there is no income. */
  ratio: number;
  status: FfpStatus;
  /** True when the club has costs but no revenue at all. */
  noIncome: boolean;
}

/**
 * THE Financial Fair Play measurement. One function, so the board's penalty
 * and the Finance page's gauge can never disagree again.
 *
 * Previously `weekAdvance` compared ALL weekly expenses (player wages + staff
 * wages + scouting + manager salary) against total income, while FinancePage
 * compared `club.wageBill` alone against total income and hardcoded 70/90
 * instead of reading the config. Players read "62% — Healthy" while the board
 * was applying −6 confidence per week.
 *
 * Pass the SAME totals the club is actually charged (i.e. `totalExpenses` and
 * `totalIncome` from `getFinanceBreakdown`).
 */
export function assessFfp(totalExpenses: number, totalIncome: number): FfpAssessment {
  const noIncome = totalIncome <= 0 && totalExpenses > 0;
  const ratio = totalIncome > 0 ? totalExpenses / totalIncome : (totalExpenses > 0 ? 1 : 0);
  const status: FfpStatus = ratio >= FFP_WAGE_RATIO_CRITICAL
    ? 'critical'
    : ratio >= FFP_WAGE_RATIO_WARNING ? 'warning' : 'healthy';
  return { ratio, status, noIncome };
}

/** Full weekly income & expense breakdown with all sources */
export function getFinanceBreakdown(opts: {
  club: Club;
  facilities: FacilitiesState;
  staffMembers: StaffMember[];
  scoutingAssignmentCount: number;
  fanMood: number;
  leagueTable: LeagueTableEntry[];
  managerProgression: ManagerProgression;
  sponsorDeals?: SponsorDeal[];
  merchandise?: MerchState;
  players?: Record<string, Player>;
  division?: LeagueId;
  managerSalary?: number;
}): FinanceBreakdown {
  const { club, facilities, staffMembers, scoutingAssignmentCount, fanMood, leagueTable, managerProgression, sponsorDeals, merchandise, players, division, managerSalary } = opts;

  const fanFavMult = hasPerk(managerProgression, 'fan_favourite') ? 1.15 : 1;
  const fanMoodMult = FAN_MOOD_BASE + (fanMood / 100) * FAN_MOOD_SCALE;

  const revenueDivision = division ?? club.divisionId;
  const matchdayIncome = getMatchdayIncome(club, revenueDivision, { fanMood: fanMoodMult });
  const commercialIncome = getCommercialIncome(club, revenueDivision);
  const stadiumIncome = Math.round(getEffectiveStadiumLevel(facilities) * STADIUM_INCOME_PER_LEVEL * fanFavMult);

  const playerTableIdx = leagueTable.findIndex(e => e.clubId === club.id);
  const playerTablePos = playerTableIdx >= 0 ? playerTableIdx + 1 : leagueTable.length;
  const leagueTier = LEAGUES.find(l => l.id === (division ?? club.divisionId))?.tier;
  const positionPrize = getLeaguePositionPrize(playerTablePos, leagueTable.length, leagueTier);

  const sponsorIncome = sponsorDeals ? sponsorDeals.reduce((sum, d) => sum + d.weeklyPayment, 0) : 0;
  const filledSlots = sponsorDeals ? sponsorDeals.length : 0;
  const totalSlots = SPONSOR_SLOTS.length;

  // Merchandise: use strategic system if available, otherwise fallback.
  // calculateWeeklyMerchRevenue returns NET of operating costs (that net is
  // what weekAdvance actually credits), so the breakdown shows gross income
  // (net + ops) on the income side and the ops cost as an expense line —
  // the displayed net stays identical to the money actually applied.
  // This identity only holds because calculateWeeklyMerchRevenue no longer
  // clamps its result at 0: while it did, an operation running at a loss
  // reported a gross that was never earned. Merch CAN now be a net loss.
  const merchandiseNet = merchandise && players && division
    ? calculateWeeklyMerchRevenue(merchandise, club, players, division, managerProgression)
    : 0;
  const merchOperatingCost = merchandise && players && division
    ? getMerchOperatingCost(merchandise.activeProductLines) : 0;
  const merchandiseGross = merchandiseNet + merchOperatingCost;

  const income: FinanceLineItem[] = [
    { label: 'Matchday', amount: matchdayIncome },
    { label: 'Commercial', amount: commercialIncome },
    { label: 'Stadium', amount: stadiumIncome },
    { label: 'League Position', amount: positionPrize },
    { label: `Sponsorship (${filledSlots}/${totalSlots})`, amount: sponsorIncome },
    { label: 'Merchandise', amount: merchandiseGross },
  ];

  const staffWages = staffMembers.reduce((sum, s) => sum + s.wage, 0);
  const scoutingCosts = scoutingAssignmentCount * SCOUTING_COST_PER_ASSIGNMENT;

  const mgrSalary = managerSalary ?? 0;

  const expenses: FinanceLineItem[] = [
    { label: 'Player Wages', amount: club.wageBill },
    { label: 'Staff Wages', amount: staffWages },
    ...(mgrSalary > 0 ? [{ label: 'Manager Salary', amount: mgrSalary }] : []),
    { label: 'Scouting', amount: scoutingCosts },
    ...(merchOperatingCost > 0 ? [{ label: 'Merch Operations', amount: merchOperatingCost }] : []),
  ];

  const totalIncome = income.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  return { income, expenses, totalIncome, totalExpenses, net: totalIncome - totalExpenses };
}
