/**
 * Finance Helper Functions
 * Centralized income/expense calculations used across Dashboard, FinancePage, ClubPage.
 */

import {
  MATCHDAY_INCOME_PER_FAN,
  COMMERCIAL_INCOME_PER_REP,
  STADIUM_INCOME_PER_LEVEL,
  POSITION_PRIZE_PER_RANK,
  POSITION_PRIZE_MAX_RANK,
  SCOUTING_COST_PER_ASSIGNMENT,
  FAN_MOOD_BASE,
  FAN_MOOD_SCALE,
} from '@/config/gameBalance';
import { hasPerk } from '@/utils/managerPerks';
import { SPONSOR_SLOTS } from '@/config/sponsorship';
import { calculateWeeklyMerchRevenue, getMerchOperatingCost } from '@/utils/merchandise';

import type { Club, LeagueTableEntry, FacilitiesState, ManagerProgression, SponsorDeal, MerchState, DivisionId, Player, StaffMember } from '@/types/game';

export interface FinanceLineItem {
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

/** Simple weekly income estimate (matchday + commercial) */
export function getWeeklyIncome(club: Club): number {
  return club.fanBase * MATCHDAY_INCOME_PER_FAN + club.reputation * COMMERCIAL_INCOME_PER_REP;
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
  division?: DivisionId;
}): FinanceBreakdown {
  const { club, facilities, staffMembers, scoutingAssignmentCount, fanMood, leagueTable, managerProgression, sponsorDeals, merchandise, players, division } = opts;

  const fanFavMult = hasPerk(managerProgression, 'fan_favourite') ? 1.15 : 1;
  const fanMoodMult = FAN_MOOD_BASE + (fanMood / 100) * FAN_MOOD_SCALE;

  const matchdayIncome = Math.round(club.fanBase * MATCHDAY_INCOME_PER_FAN * fanMoodMult);
  const commercialIncome = Math.round(club.reputation * COMMERCIAL_INCOME_PER_REP);
  const stadiumIncome = Math.round(facilities.stadiumLevel * STADIUM_INCOME_PER_LEVEL * fanFavMult);

  const playerTableIdx = leagueTable.findIndex(e => e.clubId === club.id);
  const playerTablePos = playerTableIdx >= 0 ? playerTableIdx + 1 : leagueTable.length;
  const positionPrize = Math.max(0, (POSITION_PRIZE_MAX_RANK - playerTablePos)) * POSITION_PRIZE_PER_RANK;

  const sponsorIncome = sponsorDeals ? sponsorDeals.reduce((sum, d) => sum + d.weeklyPayment, 0) : 0;
  const filledSlots = sponsorDeals ? sponsorDeals.length : 0;
  const totalSlots = SPONSOR_SLOTS.length;

  // Merchandise: use strategic system if available, otherwise fallback
  const merchandiseIncome = merchandise && players && division
    ? calculateWeeklyMerchRevenue(merchandise, club, players, division, managerProgression)
    : 0;
  const merchOperatingCost = merchandise ? getMerchOperatingCost(merchandise.activeProductLines) : 0;

  const income: FinanceLineItem[] = [
    { label: 'Matchday', amount: matchdayIncome },
    { label: 'Commercial', amount: commercialIncome },
    { label: 'Stadium', amount: stadiumIncome },
    { label: 'League Position', amount: positionPrize },
    { label: `Sponsorship (${filledSlots}/${totalSlots})`, amount: sponsorIncome },
    { label: 'Merchandise', amount: merchandiseIncome },
  ];

  const staffWages = staffMembers.reduce((sum, s) => sum + s.wage, 0);
  const scoutingCosts = scoutingAssignmentCount * SCOUTING_COST_PER_ASSIGNMENT;

  const expenses: FinanceLineItem[] = [
    { label: 'Player Wages', amount: club.wageBill },
    { label: 'Staff Wages', amount: staffWages },
    { label: 'Scouting', amount: scoutingCosts },
    ...(merchOperatingCost > 0 ? [{ label: 'Merch Operations', amount: merchOperatingCost }] : []),
  ];

  const totalIncome = income.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  return { income, expenses, totalIncome, totalExpenses, net: totalIncome - totalExpenses };
}
