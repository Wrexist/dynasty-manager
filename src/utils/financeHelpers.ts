/**
 * Finance Helper Functions
 * Centralized income/expense calculations used across Dashboard, FinancePage, ClubPage.
 */

import {
  MATCHDAY_INCOME_PER_FAN,
  COMMERCIAL_INCOME_PER_REP,
} from '@/config/gameBalance';

import type { Club } from '@/types/game';

/** Simple weekly income estimate (matchday + commercial) */
export function getWeeklyIncome(club: Club): number {
  return club.fanBase * MATCHDAY_INCOME_PER_FAN + club.reputation * COMMERCIAL_INCOME_PER_REP;
}

/** Net weekly income after wage bill */
export function getNetWeeklyIncome(club: Club): number {
  return getWeeklyIncome(club) - club.wageBill;
}
