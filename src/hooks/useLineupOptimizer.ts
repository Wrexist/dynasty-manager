import { useState, useMemo, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { infoToast, successToast } from '@/utils/gameToast';
import { toast } from 'sonner';

/**
 * Shared hook for the "Optimize Lineup" button used by MatchPrep and TacticsPage.
 * Encapsulates potential-gain calculation, loading state, and unified toast feedback.
 */
export function useLineupOptimizer() {
  const { playerClubId, clubs, players, week } = useGameStore(useShallow(s => ({
    playerClubId: s.playerClubId,
    clubs: s.clubs,
    players: s.players,
    week: s.week,
  })));
  const autoFillTeam = useGameStore(s => s.autoFillTeam);
  const club = clubs[playerClubId];
  const [autoFilling, setAutoFilling] = useState(false);

  const lineupPlayers = useMemo(() => {
    if (!club) return [];
    return club.lineup.map(id => players[id]).filter(Boolean);
  }, [club, players]);

  const potentialGain = useMemo(() => {
    if (!club) return 0;
    const lineupAvg = lineupPlayers.length > 0
      ? lineupPlayers.reduce((s, p) => s + p.overall, 0) / lineupPlayers.length
      : 0;
    const allAvailable = club.playerIds.map(id => players[id]).filter(p =>
      p && !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week)
    );
    allAvailable.sort((a, b) => b.overall - a.overall);
    const bestXI = allAvailable.slice(0, 11);
    if (bestXI.length === 0) return 0;
    const bestAvg = bestXI.reduce((s, p) => s + p.overall, 0) / bestXI.length;
    return Math.max(0, Math.round(bestAvg - lineupAvg));
  }, [club, players, week, lineupPlayers]);

  const optimizeLineup = useCallback(() => {
    if (!club) return;
    setAutoFilling(true);
    try {
      const oldLineup = [...club.lineup];
      const oldAvg = Math.round(
        oldLineup.map(id => players[id]).filter(Boolean)
          .reduce((s, p) => s + p.overall, 0) / Math.max(1, oldLineup.filter(id => players[id]).length)
      );

      const result = autoFillTeam();

      if (result.undersized) {
        toast.warning(result.undersizedDetail);
        return;
      }

      // Compute OVR diff from fresh state
      const freshState = useGameStore.getState();
      const freshClub = freshState.clubs[playerClubId];
      const newAvg = freshClub
        ? Math.round(
            freshClub.lineup.map(id => freshState.players[id]).filter(Boolean)
              .reduce((s, p) => s + p.overall, 0) / Math.max(1, freshClub.lineup.filter(id => freshState.players[id]).length)
          )
        : oldAvg;
      const diff = newAvg - oldAvg;

      if (result.changes > 0) {
        const ovrPart = diff !== 0 ? `, ${diff > 0 ? '+' : ''}${diff} OVR` : '';
        successToast(`${result.changes} change${result.changes > 1 ? 's' : ''} made${ovrPart}`, `Chemistry: ${result.chemistryLabel} (+${(result.chemistryBonus * 100).toFixed(1)}%)`);
      } else {
        infoToast('Lineup already optimal');
      }
    } catch (err) {
      console.error('[useLineupOptimizer] autoFillTeam failed:', err);
      toast.error('Failed to optimize lineup');
    } finally {
      setAutoFilling(false);
    }
  }, [club, players, autoFillTeam, playerClubId]);

  return { potentialGain, autoFilling, optimizeLineup };
}
