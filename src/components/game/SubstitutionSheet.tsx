import * as Sentry from '@sentry/react';
import { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useShallow } from 'zustand/react/shallow';
import { usePlayerClub } from '@/hooks/useGameSelectors';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FORMATION_POSITIONS, canPlayPosition, type Position } from '@/types/game';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, AlertCircle, Zap, ArrowRight, Wand2, ArrowUp } from 'lucide-react';
import { MAX_SUBSTITUTIONS } from '@/config/matchEngine';
import { PITCH_COLORS, SLOT_Y_RANGE, SLOT_Y_BOTTOM } from '@/config/ui';
import { LineupPlayerTile } from './LineupPlayerTile';
import { YellowCardIcon, RedCardIcon } from './PlayerAvatar';
import { computeSmartSub } from '@/utils/substitutionLogic';
import { optimizeStarterPositions } from '@/utils/autoFillLineup';
import { successToast, infoToast } from '@/utils/gameToast';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { SubBenchList, SubSwapCard, type BenchOption } from './match/SubstitutionParts';
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

function getCompatibility(player: { position: Position; alternatePositions?: Position[] }, slotPos: Position): 'natural' | 'compatible' | 'wrong' {
  if (player.position === slotPos) return 'natural';
  // Alternate positions count as natural — same rule as the lineup editor;
  // keeps the color logic consistent between the tactics screen and the
  // in-match substitution sheet.
  if (player.alternatePositions?.includes(slotPos)) return 'natural';
  if (canPlayPosition(player, slotPos)) return 'compatible';
  return 'wrong';
}

// Half-pitch viewBox constants
const VP_Y = 46;
const VP_H = 59;
const VP_W = 68;
/** How long the confirm card plays the swap before the sheet closes (ms). */
const SWAP_ANIM_MS = 750;

export function SubstitutionSheet({ open, onOpenChange, onSubMade, matchMinute, homeGoals, awayGoals, homeShortName, awayShortName, isPlayerHome, preSelectedOutId, forceMode, onDismissWithoutSub, injuredPlayerIds, playerGoals, opponentGoals, playerCardStatus, playerMatchStats, subbedOnPlayerIds }: SubstitutionSheetProps) {
  const { t } = useTranslation();
  const { players, matchSubsUsed, week, halfTimeState } = useGameStore(useShallow(s => ({
    players: s.players,
    matchSubsUsed: s.matchSubsUsed,
    week: s.week,
    halfTimeState: s.halfTimeState,
  })));
  const makeMatchSub = useGameStore(s => s.makeMatchSub);
  const updateLineup = useGameStore(s => s.updateLineup);
  const autoFillTeam = useGameStore(s => s.autoFillTeam);
  const playerClub = usePlayerClub();

  const [selectedOutId, setSelectedOutId] = useState<string | null>(null);
  const [selectedInId, setSelectedInId] = useState<string | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);
  // The sub has been made and the swap is playing; the sheet closes after it.
  const [swapDone, setSwapDone] = useState(false);
  const reducedMotion = !!useReducedMotionPref();

  // Reset selection state when sheet opens/closes; pre-select if provided
  useEffect(() => {
    if (!open) {
      setSelectedOutId(null);
      setSelectedInId(null);
      setSwapDone(false);
    } else if (preSelectedOutId) {
      setSelectedOutId(preSelectedOutId);
      setSelectedInId(null);
    }
  }, [open, preSelectedOutId]);

  const lineup = useMemo(() => playerClub?.lineup || [], [playerClub?.lineup]);
  const slots = useMemo(() => playerClub ? FORMATION_POSITIONS[playerClub.formation] || [] : [], [playerClub]);

  // Find the formation slot position of the selected out player
  const selectedSlotPos = useMemo(() => {
    if (!selectedOutId) return null;
    const idx = lineup.indexOf(selectedOutId);
    if (idx < 0 || !slots[idx]) return null;
    return slots[idx].pos as Position | undefined;
  }, [selectedOutId, lineup, slots]);

  // Sort bench by position compatibility, then overall, then fitness
  const sortedSubs = useMemo(() => {
    if (!playerClub) return [];
    const subs = playerClub.subs;
    if (!selectedOutId) return subs;
    // Use the formation slot position (not the player's natural position)
    // so the sort is consistent with the compatibility rings
    const slotPos = selectedSlotPos || (players[selectedOutId]?.position as Position);
    if (!slotPos) return subs;
    const posScore = (player: { position: Position; alternatePositions?: Position[] }): number => {
      if (player.position === slotPos) return 2;
      if (canPlayPosition(player, slotPos)) return 1;
      return 0;
    };
    return [...subs].sort((a, b) => {
      const pa = players[a];
      const pb = players[b];
      if (!pa || !pb) return 0;
      const psDiff = posScore(pb) - posScore(pa);
      if (psDiff !== 0) return psDiff;
      if (pb.overall !== pa.overall) return pb.overall - pa.overall;
      return pb.fitness - pa.fitness;
    });
  }, [playerClub, selectedOutId, selectedSlotPos, players]);

  // Smart Sub recommendation — delegated to utility. Live in-match fitness
  // and send-offs come from the carried HalfState so recommendations don't
  // run on stale pre-match fitness or suggest replacing a red-carded player.
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
      matchFitness: halfTimeState?.playerFitness,
      sentOffIds: halfTimeState?.sentOff,
    });
  }, [playerClub, lineup, slots, players, week, matchMinute, playerGoals, opponentGoals, injuredPlayerIds, halfTimeState]);

  if (!playerClub) return null;

  const subsRemaining = MAX_SUBSTITUTIONS - matchSubsUsed;

  const selectedOutPlayer = selectedOutId ? players[selectedOutId] : null;
  const selectedInPlayer = selectedInId ? players[selectedInId] : null;

  // Count available bench players (not injured/suspended)
  const availableBenchCount = sortedSubs.filter(id => {
    const p = players[id];
    return p && !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week);
  }).length;

  // The bench, as the clean list shows it. Recommended: the Smart Sub pick
  // when it is for this player, else the best fit (sortedSubs is already
  // ordered by fit, then rating, then energy).
  const benchOptions: BenchOption[] = sortedSubs
    .map(id => players[id])
    .filter(p => p && !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week))
    .map(p => ({
      player: p,
      fit: selectedSlotPos ? getCompatibility(p, selectedSlotPos) : null,
      energy: p.fitness,
      booked: playerCardStatus?.get(p.id) === 'yellow',
    }));
  if (selectedOutId) {
    const smartPick = smartSub && smartSub.outId === selectedOutId ? smartSub.inId : null;
    const rec = benchOptions.find(o => o.player.id === smartPick) ?? benchOptions.find(o => o.fit !== 'wrong');
    if (rec) {
      rec.recommended = true;
      // Recommended leads the list.
      benchOptions.splice(benchOptions.indexOf(rec), 1);
      benchOptions.unshift(rec);
    }
  }

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
    // Read names before the sub mutates lineup/subs state.
    const outP = players[selectedOutId];
    const inP = players[selectedInId];
    const result = makeMatchSub(selectedOutId, selectedInId, matchMinute);
    if (!result.success) {
      // The store rejected the sub (max subs / stale out-player / suspended
      // or re-entering in-player) — surface why instead of a false success.
      toast.error(result.message || 'Substitution could not be made.');
      return;
    }
    hapticMedium();
    // Confirm the sub landed — manual subs were previously the only sub
    // path with no feedback toast (Smart Sub / Optimize both toast).
    if (outP && inP) successToast(`Sub made: ${inP.lastName} on for ${outP.lastName}.`);
    // The sub is made; let the swap play on the card, then close.
    setSwapDone(true);
    window.setTimeout(() => {
      setSelectedOutId(null);
      setSelectedInId(null);
      setSwapDone(false);
      onOpenChange(false);
      onSubMade?.();
    }, reducedMotion ? 0 : SWAP_ANIM_MS);
  };

  const handleCancel = () => {
    hapticLight();
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
          // Shared Y-mapping with LineupEditor (config/ui) so the formation
          // shape in-match matches the tactics screen exactly.
          const cySvg = SLOT_Y_BOTTOM - (slot.y / 100) * SLOT_Y_RANGE;
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
              <motion.div
                className={cn(
                  'relative rounded-lg',
                  isSelectedOut && 'ring-2 ring-red-400 shadow-[0_0_16px_rgba(248,113,113,0.55)]',
                  isInjuredInMatch && !isSelectedOut && 'ring-2 ring-destructive/70',
                  // A sent-off player cannot be replaced — the store rejects it.
                  // Show that here rather than letting the tap fail.
                  cardStatus === 'red' && 'pointer-events-none',
                )}
                // The one coming off lifts; everyone else steps back.
                animate={{
                  scale: isSelectedOut && !reducedMotion ? 1.12 : 1,
                  y: isSelectedOut && !reducedMotion ? -3 : 0,
                  opacity: cardStatus === 'red' ? 0.4 : selectedOutId && !isSelectedOut ? 0.45 : 1,
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              >
                {/* Injury badge — top right */}
                {isInjuredInMatch && !isSelectedOut && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full flex items-center justify-center z-10">
                    <span className="text-[6px] text-white font-bold">!</span>{/* type-floor: graphic — alert glyph inside a 12px dot */}
                  </div>
                )}
                {/* Card badge — top left */}
                {cardStatus && (
                  <div className="absolute -top-2 -left-2 z-20">
                    {cardStatus === 'red' ? <RedCardIcon size={12} /> : <YellowCardIcon size={12} />}
                  </div>
                )}
                {/* Subbed on indicator — small arrow top-right (only if not injured) */}
                {isSubbedOn && !isInjuredInMatch && (
                  <div className="absolute -top-1 -right-1 z-10">
                    <ArrowUp className="w-2.5 h-2.5 text-sky-400" />
                  </div>
                )}
                <LineupPlayerTile
                  player={player}
                  position={slot.pos}
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
              </motion.div>
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
            <p className="text-micro text-muted-foreground truncate">{smartSub.reason}</p>
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

              // autoFillTeam is Pro-gated in the store and returns
              // { changes: 0, proRequired: true } for free users — falling
              // through to the generic branches toasted a factually false
              // "Lineup already optimal" with no upsell.
              if (result.proRequired) {
                toast.info('Optimize Lineup is a Dynasty Pro feature — upgrade from the Shop after the match.');
                setAutoFilling(false);
                return;
              }

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

                // Pick the highest-impact swaps: bring on the best benched players in place of
                // the weakest demoted starters. The old code re-ran the optimizer and matched
                // every incoming player to the *first* outgoing starter (`starterToBench.find`),
                // producing duplicate outIds so all but one makeMatchSub silently no-op'd — the
                // applied subs weren't the top-N by gain. Positions are re-optimized below, so
                // the in↔out pairing only needs distinct valid IDs.
                const promoted = benchToStarter.map(id => players[id]).filter(Boolean).sort((a, b) => b.overall - a.overall);
                const demoted = starterToBench.map(id => players[id]).filter(Boolean).sort((a, b) => a.overall - b.overall);
                const swapPairs: { outId: string; inId: string; gain: number }[] = [];
                for (let i = 0; i < Math.min(promoted.length, demoted.length); i++) {
                  swapPairs.push({ outId: demoted[i].id, inId: promoted[i].id, gain: promoted[i].overall - demoted[i].overall });
                }
                swapPairs.sort((a, b) => b.gain - a.gain);
                const appliedSwaps = swapPairs.slice(0, allowedSwaps);

                // Revert to old lineup, then apply limited swaps
                updateLineup(oldLineupIds, oldSubs);
                for (const swap of appliedSwaps) {
                  makeMatchSub(swap.outId, swap.inId, matchMinute);
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
                  makeMatchSub(starterToBench[i], benchToStarter[i], matchMinute);
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
              Sentry.captureException(err, { tags: { context: 'optimizeLineup' } });
              toast.error('Failed to optimize lineup');
            }
            setAutoFilling(false);
          }}
          disabled={autoFilling}
          className={cn(
            'mx-auto mt-1 flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors',
            autoFilling ? 'text-muted-foreground' : 'text-primary/90 hover:text-primary',
          )}
        >
          <Wand2 className={cn('h-3.5 w-3.5 shrink-0', autoFilling && 'animate-spin')} />
          {autoFilling ? 'Optimizing…' : 'Optimize whole lineup (uses subs)'}
        </button>
      )}

      {/* Bench — step 2: who comes on. A preview until step 1 is done. */}
      <div className="mt-3">
        <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">
          {selectedOutId && selectedOutPlayer
            ? <>Who replaces <span className="text-foreground">{selectedOutPlayer.lastName}</span>{selectedSlotPos ? ` at ${selectedSlotPos}` : ''}?</>
            : 'Your bench'}
        </p>

        {selectedOutId && availableBenchCount === 0 && (
          <div className="flex items-center gap-2 bg-card/40 border border-border/30 rounded-lg px-3 py-3">
            <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">No available substitutes — all bench players are injured or suspended.</p>
          </div>
        )}

        <SubBenchList options={benchOptions} locked={!selectedOutId} onPick={handleBenchClick} reducedMotion={reducedMotion} />
      </div>

      {/* Back button when a player is selected */}
      {selectedOutId && !selectedInId && (
        <button
          onClick={handleCancel}
          className="mt-1 min-h-[44px] text-micro text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
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
          className="max-h-[92vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-t border-border/50 px-4"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <AlertCircle className="w-10 h-10 text-destructive" />
            {/* Title + Description, so Radix has both (it warned on every
                forced-substitution sheet, R19). */}
            <SheetTitle className="text-sm font-bold text-foreground">No Substitutions Remaining</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground px-4">
              {injuredPlayer
                ? `${injuredPlayer.lastName} is injured but you have no substitutions left. Your team will continue with 10 players.`
                : 'All 5 substitutions have been used. No more changes can be made.'}
            </SheetDescription>
            <Button className="w-full max-w-xs" onClick={() => { hapticLight(); onDismissWithoutSub?.(); }}>
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
        className="max-h-[92vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-t border-border/50 px-4"
        {...(forceMode ? {
          onInteractOutside: (e: Event) => e.preventDefault(),
          onEscapeKeyDown: (e: Event) => e.preventDefault(),
        } : {})}
      >
        <SheetHeader className="pb-2">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-display">Make Substitution</SheetTitle>
            <SheetDescription className="sr-only">
              {forceMode ? t('substitutionSheet.forcedDescription') : t('substitutionSheet.description')}
            </SheetDescription>
            {/* mr-8 clears the sheet's absolute close button (top-right). */}
            <span className="mr-8 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
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
                  onClick={() => { hapticLight(); onDismissWithoutSub?.(); }}
                  className="w-full mt-3 min-h-[44px] py-2.5 rounded-lg bg-muted/20 border border-border/30 text-xs text-muted-foreground hover:bg-muted/40 transition-colors flex items-center justify-center gap-1.5"
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
              <SubSwapCard
                out={selectedOutPlayer}
                outEnergy={halfTimeState?.playerFitness?.[selectedOutPlayer.id] ?? selectedOutPlayer.fitness}
                incoming={selectedInPlayer}
                fit={getCompatibility(selectedInPlayer, selectedSlotPos || selectedOutPlayer.position as Position)}
                done={swapDone}
                reducedMotion={reducedMotion}
              />

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleCancel} disabled={swapDone}>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back
                </Button>
                <Button className="flex-1 gap-1.5" onClick={handleConfirm} disabled={subsRemaining <= 0 || swapDone}>
                  <Check className="w-3.5 h-3.5" /> {subsRemaining <= 0 ? 'No Subs Left' : 'Confirm Sub'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
