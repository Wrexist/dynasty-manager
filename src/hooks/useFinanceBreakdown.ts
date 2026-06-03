import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { getFinanceBreakdown } from '@/utils/financeHelpers';
import type { FinanceBreakdown } from '@/utils/financeHelpers';
import type { Club } from '@/types/game';

/**
 * Single source of truth for the player's weekly finance breakdown.
 *
 * Used by both the Finance page headline tiles and the Finance breakdown sheet (and the
 * Dashboard/Club net-income figures) so the numbers can never disagree. Previously these
 * surfaces used the simplified `getWeeklyIncome`/`getNetWeeklyIncome` (matchday + commercial
 * only, wage bill only) while the breakdown sheet used the full picture — so the headline
 * and the sheet showed different figures.
 */
export function useFinanceBreakdown(): { club: Club | undefined; breakdown: FinanceBreakdown | null } {
  const {
    clubs, playerClubId, facilities, staff, scouting, fanMood, leagueTable,
    managerProgression, sponsorDeals, merchandise, players, playerDivision, careerManager,
  } = useGameStore(
    useShallow(s => ({
      clubs: s.clubs,
      playerClubId: s.playerClubId,
      facilities: s.facilities,
      staff: s.staff,
      scouting: s.scouting,
      fanMood: s.fanMood,
      leagueTable: s.leagueTable,
      managerProgression: s.managerProgression,
      sponsorDeals: s.sponsorDeals,
      merchandise: s.merchandise,
      players: s.players,
      playerDivision: s.playerDivision,
      careerManager: s.careerManager,
    }))
  );

  const club = clubs[playerClubId];
  if (!club) return { club: undefined, breakdown: null };

  const breakdown = getFinanceBreakdown({
    club,
    facilities,
    staffMembers: staff.members,
    scoutingAssignmentCount: scouting.assignments.length,
    fanMood,
    leagueTable,
    managerProgression,
    sponsorDeals: sponsorDeals || [],
    merchandise,
    players,
    division: playerDivision,
    managerSalary: careerManager?.contract?.salary ?? 0,
  });

  return { club, breakdown };
}
