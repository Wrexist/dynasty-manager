import { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { usePlayerClub } from '@/hooks/useGameSelectors';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getRatingBadgeClasses } from '@/utils/uiHelpers';
import { FORMATION_POSITIONS, POSITION_COMPATIBILITY, type Position } from '@/types/game';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { getFlag } from '@/utils/nationality';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRightLeft, Check, AlertCircle, Zap, ArrowRight, Wand2, ArrowUp } from 'lucide-react';
import { MAX_SUBSTITUTIONS } from '@/config/matchEngine';
import { PITCH_COLORS } from '@/config/ui';
import { PlayerCard } from './PlayerCard';
import { YellowCardIcon, RedCardIcon } from './PlayerAvatar';
import { computeSmartSub } from '@/utils/substitutionLogic';
import { optimizeStarterPositions } from '@/utils/autoFillLineup';
import { successToast, infoToast } from '@/utils/gameToast';
import { toast } from 'sonner';

interface SubstitutionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubMade?: () => void;
  matchMinute?: number;
  homeGoals?: number;
  awayGoals?: number;
  homeShortName?: string;
  awayShortName?: string;
  isPlayerHome?: boolean;
  /** Pre-select this player as OUT (e.g. injured player) */
  preSelectedOutId?: string;
  /** When true, sheet cannot be dismissed without explicit action */
  forceMode?: boolean;
  /** Callback for "Continue without sub" in force mode */
  onDismissWithoutSub?: () => void;
  /** IDs of players injured during this match (from match events) */
  injuredPlayerIds?: string[];
  /** Current player goals for match context */
  playerGoals?: number;
  /** Current opponent goals for match context */
  opponentGoals?: number;
  /** Per-player card status from match events */
  playerCardStatus?: Map<string, 'yellow' | 'red'>;
  /** Per-player goals & assists from match events */
  playerMatchStats?: Map<string, { goals: number; assists: number }>;
  /** IDs of players who were subbed on during this match */
  subbedOnPlayerIds?: Set<string>;
}

function getFormLabel(form: number): { text: string; className: string } {
  if (form >= 80) return { text: 'Hot', className: 'text-emerald-400' };
  if (form >= 60) return { text: 'Good', className: 'text-sky-400' };
  if (form >= 40) return { text: 'Avg', className: 'text-muted-foreground' };
  return { text: 'Poor', className: 'text-destructive' };
}

function getCompatibility(playerPos: Position, slotPos: Position): 'natural' | 'compatible' | 'wrong' {
  if (playerPos === slotPos) return 'natural';
  const compat = POSITION_COMPATIBILITY[slotPos] || [];
  if (compat.includes(playerPos)) return 'compatible';
  return 'wrong';
}

// Half-pitch viewBox constants
const VP_Y = 46;
const VP_H = 59;
const VP_W = 68;

export function SubstitutionSheet({ open, onOpenChange, onSubMade, matchMinute, homeGoals, awayGoals, homeShortName, awayShortName, isPlayerHome, preSelectedOutId, forceMode, onDismissWithoutSub, injuredPlayerIds, playerGoals, opponentGoals, playerCardStatus, playerMatchStats, subbedOnPlayerIds }: SubstitutionSheetProps) {
  const { players, matchSubsUsed, week } = useGameStore(useShallow(s => ({
    players: s.players,
    matchSubsUsed: s.matchSubsUsed,
    week: s.week,
  })));
  const makeMatchSub = useGameStore(s => s.makeMatchSub);
  const updateLineup = useGameStore(s => s.updateLineup);
  const autoFillTeam = useGameStore(s => s.autoFillTeam);
  const playerClub = usePlayerClub();

  const [selectedOutId, setSelectedOutId] = useState<string | null>(null);
  const [selectedInId, setSelectedInId] = useState<string | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);

  // Reset selection state when sheet opens/closes; pre-select if provided
  useEffect(() => {
    if (!open) {
      setSelectedOutId(null);
      setSelectedInId(null);
    } else if (preSelectedOutId) {
      setSelectedOutId(preSelectedOutId);
      setSelectedInId(null);
    }
  }, [open, preSelectedOutId]);

  // Sort bench by position compatibility, then overall, then fitness
  const sortedSubs = useMemo(() => {
    if (!playerClub) return [];
    const subs = playerClub.subs;
    const selectedOutPlayer = selectedOutId ? players[selectedOutId] : null;
    if (!selectedOutPlayer) return subs;
    const outPos = selectedOutPlayer.position as Position;
    const posScore = (playerPos: Position): number => {
      if (playerPos === outPos) return 2;
      const compat = POSITION_COMPATIBILITY[outPos] || [];
      if (compat.includes(playerPos)) return 1;
      return 0;
    };
    return [...subs].sort((a, b) => {
      const pa = players[a];
      const pb = players[b];
      if (!pa || !pb) return 0;
      const psDiff = posScore(pb.position as Position) - posScore(pa.position as Position);
      if (psDiff !== 0) return psDiff;
      if (pb.overall !== pa.overall) return pb.overall - pa.overall;
      return pb.fitness - pa.fitness;
    });
  }, [playerClub, selectedOutId, players]);

  const lineup = useMemo(() => playerClub?.lineup || [], [playerClub?.lineup]);
  const slots = useMemo(() => playerClub ? FORMATION_POSITIONS[playerClub.formation] || [] : [], [playerClub]);

  // Find the formation slot position of the selected out player
  const selectedSlotPos = useMemo(() => {
    if (!selectedOutId) return null;
    const idx = lineup.indexOf(selectedOutId);
    if (idx < 0 || !slots[idx]) return null;
    return slots[idx].pos as Position | undefined;
  }, [selectedOutId, lineup, slots]);

  // Smart Sub recommendation — delegated to utility
  const smartSub = useMemo(() => {
    if (!playerClub) return null;
    return computeSmartSub({
      lineup,
      subs: playerClub.subs,
      slots,
      players,
      week,
      matchMinute,
      playerGoals,
      opponentGoals,
      injuredPlayerIds,
    });
  }, [playerClub, lineup, slots, players, week, matchMinute, playerGoals, opponentGoals, injuredPlayerIds]);

  if (!playerClub) return null;

  const subsRemaining = MAX_SUBSTITUTIONS - matchSubsUsed;

  const selectedOutPlayer = selectedOutId ? players[selectedOutId] : null;
  const selectedInPlayer = selectedInId ? players[selectedInId] : null;

  // Count available bench players (not injured/suspended)
  const availableBenchCount = sortedSubs.filter(id => {
    const p = players[id];
    return p && !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week);
  }).length;

  const hasMatchContext = matchMinute !== undefined && homeGoals !== undefined && awayGoals !== undefined;

  const handleLineupPlayerClick = (playerId: string) => {
    if (!playerId) return;
    hapticLight();
    setSelectedOutId(playerId);
    setSelectedInId(null);
  };

  const handleBenchClick = (playerId: string) => {
    hapticLight();
    setSelectedInId(playerId);
  };

  const handleConfirm = () => {
    if (!selectedOutId || !selectedInId) return;
    makeMatchSub(selectedOutId, selectedInId);
    hapticMedium();
    setSelectedOutId(null);
    setSelectedInId(null);
    onOpenChange(false);
    onSubMade?.();
  };

  const handleCancel = () => {
    if (selectedInId) {
      setSelectedInId(null);
    } else if (selectedOutId) {
      setSelectedOutId(null);
    }
  };

  // Pitch view for States 1 and 2 (select out / select in)
  const renderPitchView = () => (
    <div>
      {/* Half Pitch */}
      <div className="relative w-full mx-auto" style={{ aspectRatio: `${VP_W}/${VP_H}`, maxWidth: '22rem' }}>
        <svg viewBox={`0 ${VP_Y} ${VP_W} ${VP_H}`} className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Pitch background & markings */}
          <rect x="0" y="0" width="68" height="105" rx="1.5" fill={PITCH_COLORS.FILL} />
          <rect x="2" y="2" width="64" height="101" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
          <line x1="2" y1="52.5" x2="66" y2="52.5" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
          <circle cx="34" cy="52.5" r="9.15" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
          <circle cx="34" cy="52.5" r="0.5" fill={PITCH_COLORS.LINE} />
          <rect x="13.85" y="86.5" width="40.3" height="16.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
          <rect x="24.85" y="97.5" width="18.3" height="5.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
          <rect x="29" y="103" width="10" height="2" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
          <path d="M 26.85 86.5 A 9.15 9.15 0 0 1 41.15 86.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        </svg>

        {/* Player tokens as HTML overlays */}
        {slots.map((slot, i) => {
          const playerId = lineup[i];
          const player = playerId ? players[playerId] : null;
          if (!player) return null;
          const cxSvg = 2 + (slot.x / 100) * 64;
          const cySvg = 95 - (slot.y / 100) * 39;
          const left = (cxSvg / VP_W) * 100;
          const top = ((cySvg - VP_Y) / VP_H) * 100;

          const isSelectedOut = selectedOutId === playerId;
          const isInjuredInMatch = injuredPlayerIds?.includes(playerId);
          const cardStatus = playerCardStatus?.get(playerId);
          const matchStats = playerMatchStats?.get(playerId);
          const isSubbedOn = subbedOnPlayerIds?.has(playerId);

          return (
            <div
              key={`slot-${i}`}
              className="absolute"
              style={{ left: `${left}%`, top: `${top}%`, transform: 'translate(-50%, -50%)' }}
            >
              <div className={cn(
                'relative rounded-lg',
                isSelectedOut && 'ring-2 ring-destructive scale-110 shadow-[0_0_12px_rgba(239,68,68,0.4)] animate-pulse',
                isInjuredInMatch && !isSelectedOut && 'ring-2 ring-destructive/70 animate-pulse',
                cardStatus === 'red' && !isSelectedOut && !isInjuredInMatch && 'ring-2 ring-red-600/70',
                cardStatus === 'yellow' && !isSelectedOut && !isInjuredInMatch && 'ring-1 ring-amber-400/50',
              )}>
                {/* Injury badge — top right */}
                {isInjuredInMatch && !isSelectedOut && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full flex items-center justify-center z-10">
                    <span className="text-[6px] text-white font-bold">!</span>
                  </div>
                )}
                {/* Card badge — top left */}
                {cardStatus && (
                  <div className="absolute -top-1.5 -left-1.5 z-10">
                    {cardStatus === 'red' ? <RedCardIcon size={7} /> : <YellowCardIcon size={7} />}
                  </div>
                )}
                {/* Subbed on indicator — small arrow top-right (only if not injured) */}
                {isSubbedOn && !isInjuredInMatch && (
                  <div className="absolute -top-1 -right-1 z-10">
                    <ArrowUp className="w-2.5 h-2.5 text-sky-400" />
                  </div>
                )}
                <PlayerCard
                  player={player}
                  position={slot.pos}
                  variant="starter"
                  isSelected={false}
                  chemistryLinkCount={0}
                  onClick={() => handleLineupPlayerClick(playerId)}
                />
                {/* Goal/assist indicators — bottom */}
                {(matchStats?.goals || matchStats?.assists) ? (
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex gap-px z-10">
                    {matchStats.goals > 0 && Array.from({ length: Math.min(matchStats.goals, 3) }).map((_, gi) => (
                      <div key={`g${gi}`} className="w-2 h-2 rounded-full bg-white border border-gray-600" title="Goal" />
                    ))}
                    {matchStats.assists > 0 && Array.from({ length: Math.min(matchStats.assists, 3) }).map((_, ai) => (
                      <div key={`a${ai}`} className="w-2 h-2 rounded-full bg-primary/80 border border-primary" title="Assist" />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Smart Sub recommendation */}
      {!selectedOutId && smartSub && (
        <button
          type="button"
          onClick={() => {
            hapticMedium();
            setSelectedOutId(smartSub.outId);
            setSelectedInId(smartSub.inId);
          }}
          className="w-full flex items-center gap-2.5 bg-primary/10 border border-primary/30 rounded-xl px-3 py-2.5 mt-2 active:scale-[0.98] transition-all"
        >
          <Zap className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs font-bold text-primary">Smart Sub</p>
            <p className="text-[10px] text-muted-foreground truncate">{smartSub.reason}</p>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
        </button>
      )}

      {/* Optimize Lineup — full optimization: rearrange positions + swap in better bench players (uses subs) */}
      {!selectedOutId && playerClub && (
        <button
          type="button"
          onClick={() => {
            setAutoFilling(true);
            hapticMedium();
            try {
              const oldLineupIds = [...lineup];
              const oldSubs = [...playerClub.subs];
              const subsLeft = MAX_SUBSTITUTIONS - matchSubsUsed;

              // Run full lineup optimizer (computes best XI + bench from entire squad)
              const result = autoFillTeam();

              if (result.undersized) {
                toast.warning(result.undersizedDetail);
                setAutoFilling(false);
                return;
              }

              // Read the new lineup from fresh state (autoFillTeam already updated store)
              const freshState = useGameStore.getState();
              const freshClub = freshState.clubs[freshState.playerClubId];
              if (!freshClub) { setAutoFilling(false); return; }

              const newLineupIds = freshClub.lineup;
              const newSubIds = freshClub.subs;

              // Find which bench players were swapped into the starting XI
              const benchToStarter = newLineupIds.filter(id => oldSubs.includes(id));
              const starterToBench = oldLineupIds.filter(id => newSubIds.includes(id));

              // We need to register each bench→starter swap as a match substitution
              // Limited by remaining subs — if optimizer wants more swaps than we have subs, revert extras
              const allowedSwaps = Math.min(benchToStarter.length, subsLeft);

              if (allowedSwaps < benchToStarter.length) {
                // Revert the autoFill and do a constrained version:
                // First, revert to the old state
                updateLineup(oldLineupIds, oldSubs);

                if (allowedSwaps === 0) {
                  // No subs left — just optimize positions
                  const optimized = optimizeStarterPositions(oldLineupIds, players, playerClub.formation);
                  if (optimized.length === oldLineupIds.length && optimized.every(id => players[id])) {
                    const posChanges = optimized.filter((id, i) => id !== oldLineupIds[i]).length;
                    updateLineup(optimized, oldSubs);
                    if (posChanges > 0) {
                      successToast(`Positions rearranged (no subs left)`, `${posChanges} position${posChanges > 1 ? 's' : ''} optimized`);
                    } else {
                      infoToast('Lineup already optimal');
                    }
                  }
                  setAutoFilling(false);
                  return;
                }

                // Re-run autoFillTeam and only apply the top N swaps
                autoFillTeam();
                const freshState2 = useGameStore.getState();
                const freshClub2 = freshState2.clubs[freshState2.playerClubId];
                if (!freshClub2) { updateLineup(oldLineupIds, oldSubs); setAutoFilling(false); return; }

                // Score each swap by OVR gain (prioritize highest impact swaps)
                const swapPairs: { outId: string; inId: string; gain: number }[] = [];
                for (const inId of benchToStarter) {
                  // Find which starter they replaced
                  const outId = starterToBench.find(sId => {
                    // Check if this outId's slot is now occupied by inId
                    const oldIdx = oldLineupIds.indexOf(sId);
                    return oldIdx >= 0 && freshClub2.lineup.includes(inId);
                  });
                  if (outId) {
                    const inP = players[inId];
                    const outP = players[outId];
                    swapPairs.push({ outId, inId, gain: (inP?.overall || 0) - (outP?.overall || 0) });
                  }
                }
                swapPairs.sort((a, b) => b.gain - a.gain);
                const appliedSwaps = swapPairs.slice(0, allowedSwaps);

                // Revert to old lineup, then apply limited swaps
                updateLineup(oldLineupIds, oldSubs);
                for (const swap of appliedSwaps) {
                  makeMatchSub(swap.outId, swap.inId);
                }

                // Optimize positions of remaining starters
                const state3 = useGameStore.getState();
                const club3 = state3.clubs[state3.playerClubId];
                if (club3) {
                  const optimized = optimizeStarterPositions(club3.lineup, players, playerClub.formation);
                  if (optimized.length === club3.lineup.length && optimized.every(id => players[id])) {
                    updateLineup(optimized, club3.subs);
                  }
                }

                successToast(
                  `${appliedSwaps.length} sub${appliedSwaps.length > 1 ? 's' : ''} made`,
                  `${benchToStarter.length - allowedSwaps} more swap${benchToStarter.length - allowedSwaps > 1 ? 's' : ''} skipped (no subs left)`
                );
                onSubMade?.();
              } else if (benchToStarter.length > 0) {
                // All swaps fit within sub limit — revert autoFill, then apply via makeMatchSub
                updateLineup(oldLineupIds, oldSubs);
                for (let i = 0; i < benchToStarter.length; i++) {
                  makeMatchSub(starterToBench[i], benchToStarter[i]);
                }

                // Optimize positions of the resulting lineup
                const state3 = useGameStore.getState();
                const club3 = state3.clubs[state3.playerClubId];
                if (club3) {
                  const optimized = optimizeStarterPositions(club3.lineup, players, playerClub.formation);
                  if (optimized.length === club3.lineup.length && optimized.every(id => players[id])) {
                    updateLineup(optimized, club3.subs);
                  }
                }

                const oldAvg = Math.round(
                  oldLineupIds.map(id => players[id]).filter(Boolean)
                    .reduce((s, p) => s + p.overall, 0) / Math.max(1, oldLineupIds.filter(id => players[id]).length)
                );
                const finalState = useGameStore.getState();
                const finalClub = finalState.clubs[finalState.playerClubId];
                const newAvg = finalClub
                  ? Math.round(
                      finalClub.lineup.map(id => finalState.players[id]).filter(Boolean)
                        .reduce((s, p) => s + p.overall, 0) / Math.max(1, finalClub.lineup.filter(id => finalState.players[id]).length)
                    )
                  : oldAvg;
                const diff = newAvg - oldAvg;
                const ovrPart = diff !== 0 ? `, ${diff > 0 ? '+' : ''}${diff} OVR` : '';
                successToast(
                  `${benchToStarter.length} sub${benchToStarter.length > 1 ? 's' : ''} made${ovrPart}`,
                  `Chemistry: ${result.chemistryLabel} (+${(result.chemistryBonus * 100).toFixed(1)}%)`
                );
                onSubMade?.();
              } else {
                // No bench swaps needed — just optimize positions (autoFill already rearranged)
                if (result.changes > 0) {
                  successToast(`${result.changes} position${result.changes > 1 ? 's' : ''} rearranged`, 'Players moved to best-fit slots');
                } else {
                  infoToast('Lineup already optimal');
                }
              }
            } catch (err) {
              console.error('[SubstitutionSheet] optimize lineup failed:', err);
              toast.error('Failed to optimize lineup');
            }
            setAutoFilling(false);
          }}
          disabled={autoFilling}
          className={cn(
            'w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 mt-2 transition-all active:scale-[0.98]',
            autoFilling
              ? 'bg-primary/50 text-primary-foreground/70 cursor-not-allowed'
              : 'bg-primary/10 border border-primary/30 hover:bg-primary/20'
          )}
        >
          <Wand2 className={cn('w-4 h-4 text-primary shrink-0', autoFilling && 'animate-spin')} />
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs font-bold text-primary">{autoFilling ? 'Optimizing...' : 'Optimize Lineup'}</p>
            <p className="text-[10px] text-muted-foreground">Best XI from starters & bench (uses subs)</p>
          </div>
        </button>
      )}

      {/* Bench section */}
      <div className="mt-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
          {selectedOutId ? 'Select Replacement' : 'Tap a player on the pitch to sub them out'}
        </p>

        {selectedOutId && availableBenchCount === 0 && (
          <div className="flex items-center gap-2 bg-card/40 border border-border/30 rounded-lg px-3 py-3">
            <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">No available substitutes — all bench players are injured or suspended.</p>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 px-1">
          {sortedSubs.map(id => {
            const p = players[id];
            if (!p) return null;
            const isUnavailable = p.injured || (p.suspendedUntilWeek && p.suspendedUntilWeek > week);
            if (isUnavailable) return null;
            const benchCompat = selectedSlotPos
              ? getCompatibility(p.position as Position, selectedSlotPos)
              : null;
            const formInfo = getFormLabel(p.form);
            const benchCardStatus = playerCardStatus?.get(id);
            return (
              <div
                key={`bench-${id}`}
                className={cn(
                  'flex flex-col items-center shrink-0 relative',
                  !selectedOutId && 'opacity-50 pointer-events-none',
                )}
              >
                {benchCardStatus && (
                  <div className="absolute -top-1 -left-0.5 z-10">
                    {benchCardStatus === 'red' ? <RedCardIcon size={6} /> : <YellowCardIcon size={6} />}
                  </div>
                )}
                <PlayerCard
                  player={p}
                  position={p.position}
                  variant="bench"
                  isSelected={false}
                  chemistryLinkCount={0}
                  compatRing={benchCompat}
                  onClick={() => selectedOutId && handleBenchClick(id)}
                />
                <span className={cn('text-[7px] font-semibold mt-0.5', formInfo.className)}>{formInfo.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Back button when a player is selected */}
      {selectedOutId && !selectedInId && (
        <button
          onClick={handleCancel}
          className="mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" /> Back to full lineup
        </button>
      )}
    </div>
  );

  // Force mode: no subs remaining — show acknowledgment panel
  if (forceMode && subsRemaining <= 0) {
    const injuredPlayer = preSelectedOutId ? players[preSelectedOutId] : null;
    return (
      <Sheet open={open} onOpenChange={() => { /* blocked */ }}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-t border-border/50 px-4 pb-8"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="text-sm font-bold text-foreground">No Substitutions Remaining</p>
            <p className="text-xs text-muted-foreground px-4">
              {injuredPlayer
                ? `${injuredPlayer.lastName} is injured but you have no substitutions left. Your team will continue with 10 players.`
                : 'All 5 substitutions have been used. No more changes can be made.'}
            </p>
            <Button className="w-full max-w-xs" onClick={() => onDismissWithoutSub?.()}>
              Acknowledge
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={forceMode ? () => { /* blocked in force mode */ } : onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-t border-border/50 px-4 pb-8"
        {...(forceMode ? {
          onInteractOutside: (e: Event) => e.preventDefault(),
          onEscapeKeyDown: (e: Event) => e.preventDefault(),
        } : {})}
      >
        <SheetHeader className="pb-2">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-display">Make Substitution</SheetTitle>
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
              {subsRemaining} remaining
            </span>
          </div>
          {/* Match context bar */}
          {hasMatchContext && (
            <div className="flex items-center justify-center gap-2 text-[11px] mt-1">
              <span className={cn('font-semibold', isPlayerHome ? 'text-primary' : 'text-foreground')}>{homeShortName}</span>
              <span className="font-bold text-foreground">{homeGoals} - {awayGoals}</span>
              <span className={cn('font-semibold', !isPlayerHome ? 'text-primary' : 'text-foreground')}>{awayShortName}</span>
              <span className="text-muted-foreground">· {matchMinute}'</span>
            </div>
          )}
        </SheetHeader>

        <AnimatePresence mode="wait">
          {/* States 1 & 2: Pitch view with bench — tap on field to select out, tap bench to select in */}
          {!selectedInId && (
            <motion.div
              key="pitch-select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {renderPitchView()}

              {/* Force mode: "Continue without sub" option */}
              {forceMode && (
                <button
                  onClick={() => onDismissWithoutSub?.()}
                  className="w-full mt-3 py-2.5 rounded-lg bg-muted/20 border border-border/30 text-xs text-muted-foreground hover:bg-muted/40 transition-colors flex items-center justify-center gap-1.5"
                >
                  <AlertCircle className="w-3 h-3" /> Continue without substitution
                </button>
              )}
            </motion.div>
          )}

          {/* State 3: Confirm swap with attribute comparison */}
          {selectedOutId && selectedInId && selectedOutPlayer && selectedInPlayer && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="mt-3 space-y-3"
            >
              {/* Swap summary */}
              <div className="flex items-center gap-3 bg-card/60 border border-border/50 rounded-xl p-3">
                {/* OUT */}
                <div className="flex-1 text-center">
                  <p className="text-[9px] text-destructive uppercase tracking-wider font-semibold mb-1">Out</p>
                  <div className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold mx-auto mb-1',
                    getRatingBadgeClasses(selectedOutPlayer.overall)
                  )}>
                    {selectedOutPlayer.overall}
                  </div>
                  <p className="text-xs font-semibold text-foreground truncate">
                    {getFlag(selectedOutPlayer.nationality)} {selectedOutPlayer.lastName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{selectedOutPlayer.position}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">FIT {Math.round(selectedOutPlayer.fitness)}%</p>
                </div>

                <ArrowRightLeft className="w-5 h-5 text-primary shrink-0" />

                {/* IN */}
                <div className="flex-1 text-center">
                  <p className="text-[9px] text-emerald-400 uppercase tracking-wider font-semibold mb-1">In</p>
                  <div className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold mx-auto mb-1',
                    getRatingBadgeClasses(selectedInPlayer.overall)
                  )}>
                    {selectedInPlayer.overall}
                  </div>
                  <p className="text-xs font-semibold text-foreground truncate">
                    {getFlag(selectedInPlayer.nationality)} {selectedInPlayer.lastName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{selectedInPlayer.position}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">FIT {Math.round(selectedInPlayer.fitness)}%</p>
                </div>
              </div>

              {/* Attribute comparison — side by side bars */}
              <div className="bg-card/40 border border-border/30 rounded-lg px-3 py-2 space-y-1.5">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Key Stats Comparison</p>
                {(['pace', 'shooting', 'passing', 'defending', 'physical', 'mental'] as const).map(attr => {
                  const outVal = selectedOutPlayer.attributes[attr];
                  const inVal = selectedInPlayer.attributes[attr];
                  const diff = inVal - outVal;
                  const maxVal = Math.max(outVal, inVal, 1);
                  return (
                    <div key={attr} className="flex items-center gap-1.5 text-[10px]">
                      <span className="w-7 text-muted-foreground uppercase text-[8px] shrink-0">{attr.slice(0, 3)}</span>
                      <span className="w-5 text-right text-foreground font-semibold shrink-0">{outVal}</span>
                      {/* OUT bar (left, red) */}
                      <div className="flex-1 flex items-center gap-0.5">
                        <div className="flex-1 h-1.5 bg-muted/20 rounded-full overflow-hidden flex justify-end">
                          <div className="bg-destructive/50 rounded-full" style={{ width: `${(outVal / maxVal) * 100}%` }} />
                        </div>
                        <div className="flex-1 h-1.5 bg-muted/20 rounded-full overflow-hidden">
                          <div className="bg-emerald-500/50 rounded-full" style={{ width: `${(inVal / maxVal) * 100}%` }} />
                        </div>
                      </div>
                      <span className="w-5 text-foreground font-semibold shrink-0">{inVal}</span>
                      <span className={cn('w-7 text-[9px] font-bold text-right shrink-0', diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                        {diff > 0 ? `+${diff}` : diff === 0 ? '=' : diff}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Position fit warning */}
              {selectedOutPlayer.position !== selectedInPlayer.position && (
                <p className={cn(
                  'text-[10px] text-center px-2',
                  POSITION_COMPATIBILITY[selectedOutPlayer.position as Position]?.includes(selectedInPlayer.position as Position)
                    ? 'text-amber-400' : 'text-destructive'
                )}>
                  {POSITION_COMPATIBILITY[selectedOutPlayer.position as Position]?.includes(selectedInPlayer.position as Position)
                    ? `${selectedInPlayer.position} is a compatible position for ${selectedOutPlayer.position}`
                    : `${selectedInPlayer.position} is not a natural fit for ${selectedOutPlayer.position}`
                  }
                </p>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleCancel}>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back
                </Button>
                <Button className="flex-1 gap-1.5" onClick={handleConfirm}>
                  <Check className="w-3.5 h-3.5" /> Confirm Sub
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
