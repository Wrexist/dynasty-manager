import * as Sentry from '@sentry/react';
import { useState, useMemo, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { LINEUP_SIZE } from '@/config/gameBalance';
import { toast } from 'sonner';
import { positionalOverall } from '@/utils/autoFillLineup';
import type { OptimizeResult } from '@/components/game/OptimizeResultModal';

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
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const dismissResult = useCallback(() => setResult(null), []);

  const lineupPlayers = useMemo(() => {
    if (!club) return [];
    return club.lineup.map(id => players[id]).filter(Boolean);
  }, [club, players]);

  const potentialGain = useMemo(() => {
    if (!club) return 0;
    // Use positional-OVR consistently for both the current XI and the
    // hypothetical bestXI so the diff is self-coherent. Mixing raw
    // overall (previous behavior) with positional-OVR sort produced
    // "+N OVR" chips that didn't match what Optimize actually did.
    const effective = (p: { attributes: typeof lineupPlayers[number]['attributes']; position: typeof lineupPlayers[number]['position'] }) =>
      positionalOverall(p.attributes, p.position);
    const lineupAvg = lineupPlayers.length > 0
      ? lineupPlayers.reduce((s, p) => s + effective(p), 0) / lineupPlayers.length
      : 0;
    const allAvailable = club.playerIds.map(id => players[id]).filter(p =>
      p && !p.injured && !p.onLoan && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week)
    );
    allAvailable.sort((a, b) => effective(b) - effective(a));
    const bestXI = allAvailable.slice(0, LINEUP_SIZE);
    if (bestXI.length === 0) return 0;
    const bestAvg = bestXI.reduce((s, p) => s + effective(p), 0) / bestXI.length;
    return Math.max(0, Math.round(bestAvg - lineupAvg));
  }, [club, players, week, lineupPlayers]);

  const optimizeLineup = useCallback(() => {
    if (!club) return;
    setAutoFilling(true);
    try {
      const fillOutcome = autoFillTeam();

      if (fillOutcome.proRequired) {
        toast.warning('Smart Optimizer is a Dynasty Pro feature.');
        return;
      }

      if (fillOutcome.undersized) {
        toast.warning(fillOutcome.undersizedDetail);
        return;
      }

      const oldLineup = [...club.lineup];
      const oldAvg = Math.round(
        oldLineup.map(id => players[id]).filter(Boolean)
          .reduce((s, p) => s + p.overall, 0) / Math.max(1, oldLineup.filter(id => players[id]).length)
      );
      const freshState = useGameStore.getState();
      const freshClub = freshState.clubs[playerClubId];
      const newAvg = freshClub
        ? Math.round(
            freshClub.lineup.map(id => freshState.players[id]).filter(Boolean)
              .reduce((s, p) => s + p.overall, 0) / Math.max(1, freshClub.lineup.filter(id => freshState.players[id]).length)
          )
        : oldAvg;
      const diff = newAvg - oldAvg;

      setResult({
        changes: fillOutcome.changes,
        ovrDiff: diff,
        chemistryLabel: fillOutcome.chemistryLabel,
        chemistryBonus: fillOutcome.chemistryBonus,
      });
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'autoFillLineup' } });
      toast.error('Failed to optimize lineup');
    } finally {
      setAutoFilling(false);
    }
  }, [club, players, autoFillTeam, playerClubId]);

  return { potentialGain, autoFilling, optimizeLineup, result, dismissResult };
}
