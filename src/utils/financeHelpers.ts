/**
 * Finance Helper Functions
 * Centralized income/expense calculations used across Dashboard, FinancePage, ClubPage.
 */

import {
  MATCHDAY_INCOME_PER_FAN,
  COMMERCIAL_INCOME_PER_REP,
  COMMERCIAL_INCOME_BASE,
  STADIUM_INCOME_PER_LEVEL,
  POSITION_PRIZE_PER_RANK,
  POSITION_PRIZE_MAX_RANK,
  POSITION_PRIZE_TIER_SCALE,
  SCOUTING_COST_PER_ASSIGNMENT,
  FAN_MOOD_BASE,
  FAN_MOOD_SCALE,
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

/** Simple weekly income estimate (matchday + commercial) */
export function getWeeklyIncome(club: Club): number {
  return club.fanBase * MATCHDAY_INCOME_PER_FAN + COMMERCIAL_INCOME_BASE + club.reputation * COMMERCIAL_INCOME_PER_REP;
}

/** Net weekly income after wage bill */
export function getNetWeeklyIncome(club: Club): number {
  return getWeeklyIncome(club) - club.wageBill;
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

  const matchdayIncome = Math.round(club.fanBase * MATCHDAY_INCOME_PER_FAN * fanMoodMult);
  const commercialIncome = Math.round(COMMERCIAL_INCOME_BASE + club.reputation * COMMERCIAL_INCOME_PER_REP);
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
