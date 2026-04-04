import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { FORMATION_POSITIONS, POSITION_COMPATIBILITY, type Position } from '@/types/game';
import { MAX_SUBS } from '@/config/playerGeneration';
import { PITCH_COLORS } from '@/config/ui';
import { cn } from '@/lib/utils';
import { calculateChemistryLinks, getChemistryBonus, getChemistryLabel } from '@/utils/chemistry';
import { getSquadInsights } from '@/utils/squadInsights';
import { PlayerCard } from './PlayerCard';
import { ChemistryBar } from './ChemistryBar';
import { InsightsPanel } from './InsightsPanel';
import { getFlag } from '@/utils/nationality';
import { getRatingColor } from '@/utils/uiHelpers';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { hapticLight, hapticMedium } from '@/utils/haptics';

// Half-pitch viewBox constants (bottom half only — your team)
const VP_Y = 46;
const VP_H = 59;
const VP_W = 68;

function getCompatibility(playerPos: Position, slotPos: Position): 'natural' | 'compatible' | 'wrong' {
  if (playerPos === slotPos) return 'natural';
  const compat = POSITION_COMPATIBILITY[slotPos] || [];
  if (compat.includes(playerPos)) return 'compatible';
  return 'wrong';
}

export function LineupEditor() {
  const { playerClubId, clubs, players, week, season } = useGameStore(useShallow(s => ({
    playerClubId: s.playerClubId,
    clubs: s.clubs,
    players: s.players,
    week: s.week,
    season: s.season,
  })));
  const updateLineup = useGameStore(s => s.updateLineup);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const club = clubs[playerClubId];

  // Clear selection when formation or lineup changes
  const prevFormation = useRef(club?.formation);
  const prevLineupKey = useRef(club?.lineup?.join(','));
  useEffect(() => {
    const currentFormation = club?.formation;
    const currentLineupKey = club?.lineup?.join(',');
    if (prevFormation.current !== currentFormation || prevLineupKey.current !== currentLineupKey) {
      setSelectedId(null);
    }
    prevFormation.current = currentFormation;
    prevLineupKey.current = currentLineupKey;
  }, [club?.formation, club?.lineup]);

  // Chemistry links (memoized)
  const chemLinks = useMemo(() => {
    if (!club) return [];
    const lineupPlayers = club.lineup.map(id => players[id]).filter(Boolean);
    return calculateChemistryLinks(lineupPlayers, club.formation, season);
  }, [club, players, season]);

  // Chemistry bonus and label
  const { chemBonus, chemLabel } = useMemo(() => {
    if (!club) return { chemBonus: 0, chemLabel: getChemistryLabel(0) };
    const lp = club.lineup.map(id => players[id]).filter(Boolean);
    const chemBonus = getChemistryBonus(lp, club.formation, season);
    const chemLabel = getChemistryLabel(chemBonus);
    return { chemBonus, chemLabel };
  }, [club, players, season]);

  // Per-player chemistry link count
  const playerChemCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const link of chemLinks) {
      counts.set(link.playerIdA, (counts.get(link.playerIdA) || 0) + 1);
      counts.set(link.playerIdB, (counts.get(link.playerIdB) || 0) + 1);
    }
    return counts;
  }, [chemLinks]);

  // Set of player IDs that share a chemistry link with selected player
  const selectedChemPartners = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const partners = new Set<string>();
    for (const link of chemLinks) {
      if (link.playerIdA === selectedId) partners.add(link.playerIdB);
      if (link.playerIdB === selectedId) partners.add(link.playerIdA);
    }
    return partners;
  }, [selectedId, chemLinks]);

  const lineup = useMemo(() => club?.lineup || [], [club?.lineup]);
  const subs = useMemo(() => club?.subs || [], [club?.subs]);
  const allSquad = useMemo(() => club?.playerIds || [], [club?.playerIds]);

  const subAndBench = useMemo(() => {
    const benchIds = allSquad.filter(id =>
      !lineup.includes(id) && !subs.includes(id) && players[id]
      && !players[id].injured
      && !(players[id].suspendedUntilWeek && players[id].suspendedUntilWeek > week)
    );
    return [...subs, ...benchIds];
  }, [allSquad, lineup, subs, players, week]);

  // Best sub suggestion: bench player with highest overall who can improve the lineup
  const bestSubId = useMemo(() => {
    if (subAndBench.length === 0) return null;
    const lineupPlayers = lineup.map(id => players[id]).filter(Boolean);
    const lowestStarter = lineupPlayers.reduce((low, p) => {
      if (!low || p.overall < low.overall || (p.overall === low.overall && p.fitness < low.fitness)) return p;
      return low;
    }, null as typeof lineupPlayers[0] | null);
    if (!lowestStarter) return null;

    let bestId: string | null = null;
    let bestScore = 0;
    for (const id of subAndBench) {
      const p = players[id];
      if (!p || p.injured) continue;
      const advantage = p.overall - lowestStarter.overall;
      const fitnessBonus = (p.fitness - lowestStarter.fitness) / 100;
      const score = advantage + fitnessBonus;
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    }
    return bestScore > 0 ? bestId : null;
  }, [subAndBench, lineup, players]);

  // Insights
  const insights = useMemo(() => {
    if (!club) return [];
    const lineupPlayers = club.lineup.map(id => players[id]).filter(Boolean);
    const slots = FORMATION_POSITIONS[club.formation] || [];
    return getSquadInsights(lineupPlayers, club.formation, slots, chemLinks);
  }, [club, players, chemLinks]);

  // Selected player's chemistry links for detail panel
  const selectedPlayerLinks = useMemo(() => {
    if (!selectedId) return [];
    return chemLinks.filter(l => l.playerIdA === selectedId || l.playerIdB === selectedId);
  }, [selectedId, chemLinks]);

  const handleSwap = useCallback((activeId: string, targetId: string) => {
    const activeInLineupIdx = lineup.indexOf(activeId);
    const overInLineupIdx = lineup.indexOf(targetId);
    const activeOnBench = subAndBench.includes(activeId);
    const overOnBench = subAndBench.includes(targetId);

    const overSlotMatch = targetId.match(/^slot-(\d+)$/);
    const overSlotIdx = overSlotMatch ? parseInt(overSlotMatch[1]) : -1;

    const newLineup = [...lineup];
    let newSubs = [...subs];

    const removeFromSubs = (id: string) => {
      newSubs = newSubs.filter(sid => sid !== id);
    };
    const addToSubs = (id: string) => {
      if (!newSubs.includes(id)) newSubs.push(id);
    };

    if (activeInLineupIdx >= 0 && overInLineupIdx >= 0) {
      newLineup[activeInLineupIdx] = targetId;
      newLineup[overInLineupIdx] = activeId;
    } else if (activeOnBench && overSlotIdx >= 0) {
      const displaced = newLineup[overSlotIdx];
      newLineup[overSlotIdx] = activeId;
      removeFromSubs(activeId);
      if (displaced) addToSubs(displaced);
    } else if (activeOnBench && overInLineupIdx >= 0) {
      const displaced = newLineup[overInLineupIdx];
      newLineup[overInLineupIdx] = activeId;
      removeFromSubs(activeId);
      if (displaced) addToSubs(displaced);
    } else if (activeInLineupIdx >= 0 && overOnBench) {
      newLineup[activeInLineupIdx] = targetId;
      removeFromSubs(targetId);
      addToSubs(activeId);
    } else if (activeOnBench && overOnBench) {
      const activeInSubs = newSubs.indexOf(activeId);
      const overInSubs = newSubs.indexOf(targetId);
      if (activeInSubs >= 0 && overInSubs >= 0) {
        newSubs[activeInSubs] = targetId;
        newSubs[overInSubs] = activeId;
      } else if (activeInSubs >= 0) {
        newSubs[activeInSubs] = targetId;
      } else if (overInSubs >= 0) {
        newSubs[overInSubs] = activeId;
      }
    }

    hapticMedium();
    updateLineup(newLineup, newSubs.slice(0, MAX_SUBS));
  }, [lineup, subs, subAndBench, updateLineup]);

  const handleTap = useCallback((tappedId: string) => {
    const isEmptySlot = tappedId.startsWith('slot-');
    if (!selectedId) {
      if (isEmptySlot) return;
      hapticLight();
      setSelectedId(tappedId);
    } else if (selectedId === tappedId) {
      setSelectedId(null);
    } else {
      handleSwap(selectedId, tappedId);
      setSelectedId(null);
    }
  }, [selectedId, handleSwap]);

  const formation = club?.formation;
  const slots = useMemo(() => formation ? FORMATION_POSITIONS[formation] : [], [formation]);

  const selectedSlotPos = useMemo(() => {
    if (!selectedId) return null;
    const idx = lineup.indexOf(selectedId);
    if (idx < 0) return null;
    return slots[idx]?.pos as Position | undefined;
  }, [selectedId, lineup, slots]);

  if (!club) return null;

  const selectedPlayer = selectedId ? players[selectedId] : null;
  const isLineupSelected = selectedId ? lineup.includes(selectedId) : false;

  return (
    <div>
      {/* Half Pitch (bottom half only) */}
      <div className="relative w-full mx-auto" style={{ aspectRatio: `${VP_W}/${VP_H}`, maxWidth: 'min(24rem, 100%)' }}>
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

        {/* Player Cards (HTML overlays) */}
        {slots.map((slot, i) => {
          const playerId = lineup[i];
          const player = playerId ? players[playerId] : null;
          const cxSvg = 2 + (slot.x / 100) * 64;
          const cySvg = 95 - (slot.y / 100) * 39;
          const left = (cxSvg / VP_W) * 100;
          const top = ((cySvg - VP_Y) / VP_H) * 100;

          const isSelected = selectedId === playerId;
          const compat = selectedPlayer ? getCompatibility(selectedPlayer.position as Position, slot.pos as Position) : null;

          // Fade non-selected, non-chemistry-linked players when someone is selected
          const isFaded = selectedId && !isSelected && playerId && !selectedChemPartners.has(playerId);

          return (
            <div
              key={`slot-${i}`}
              className={cn('absolute transition-opacity duration-200', isFaded && 'opacity-40')}
              style={{ left: `${left}%`, top: `${top}%`, transform: 'translate(-50%, -50%)' }}
            >
              {player ? (
                <PlayerCard
                  player={player}
                  position={slot.pos}
                  variant="starter"
                  isSelected={isSelected}
                  chemistryLinkCount={playerChemCounts.get(player.id) || 0}
                  compatRing={!isSelected ? compat : null}
                  onClick={() => handleTap(playerId)}
                />
              ) : (
                <div
                  className={cn(
                    'w-10 h-10 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center',
                    selectedId ? 'cursor-pointer' : '',
                    compat ? (compat === 'natural' ? 'ring-2 ring-emerald-400' : compat === 'compatible' ? 'ring-2 ring-amber-400' : 'ring-2 ring-red-500') : ''
                  )}
                  onClick={() => handleTap(`slot-${i}`)}
                >
                  <span className="text-[8px] text-white/40">{slot.pos}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Player Detail Panel */}
      <AnimatePresence>
        {selectedPlayer && (
          <motion.div
            key="detail-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-1 mt-2 bg-card/80 backdrop-blur-xl border border-border/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn('text-lg font-bold font-display tabular-nums', getRatingColor(selectedPlayer.overall))}>
                    {selectedPlayer.overall}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {getFlag(selectedPlayer.nationality)} {selectedPlayer.firstName} {selectedPlayer.lastName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {selectedPlayer.position} · Age {selectedPlayer.age} · Fitness {selectedPlayer.fitness}%
                      {selectedPlayer.injured && ' · Injured'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedId(null)} className="p-1 rounded hover:bg-muted/30 transition-colors">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>

              {/* Attributes */}
              <div className="grid grid-cols-3 gap-x-3 gap-y-1 mb-2">
                {(['pace', 'shooting', 'passing', 'defending', 'physical', 'mental'] as const).map(attr => (
                  <div key={attr} className="flex items-center justify-between">
                    <span className="text-[9px] text-muted-foreground capitalize">{attr.slice(0, 3)}</span>
                    <span className={cn('text-[10px] font-bold tabular-nums', getRatingColor(selectedPlayer.attributes[attr]))}>
                      {selectedPlayer.attributes[attr]}
                    </span>
                  </div>
                ))}
              </div>

              {/* Morale + Form row */}
              <div className="flex items-center gap-3 mb-1.5 text-[9px]">
                <span className="text-muted-foreground">
                  Morale: <span className={cn('font-bold',
                    selectedPlayer.morale >= 60 ? 'text-emerald-400' :
                    selectedPlayer.morale >= 35 ? 'text-amber-400' : 'text-red-400'
                  )}>{selectedPlayer.morale}</span>
                </span>
                <span className="text-muted-foreground">
                  Form: <span className={cn('font-bold',
                    selectedPlayer.form >= 60 ? 'text-emerald-400' :
                    selectedPlayer.form >= 35 ? 'text-amber-400' : 'text-red-400'
                  )}>{selectedPlayer.form}</span>
                </span>
                {!isLineupSelected && (
                  <span className="text-primary text-[8px] ml-auto">BENCH</span>
                )}
              </div>

              {/* Chemistry links for this player */}
              {selectedPlayerLinks.length > 0 && (
                <div className="border-t border-border/30 pt-1.5">
                  <p className="text-[9px] text-muted-foreground mb-1">Chemistry Links</p>
                  <div className="space-y-0.5">
                    {selectedPlayerLinks.map((link, i) => {
                      const partnerId = link.playerIdA === selectedId ? link.playerIdB : link.playerIdA;
                      const partner = players[partnerId];
                      if (!partner) return null;
                      return (
                        <div key={i} className="flex items-center gap-1.5 text-[9px]">
                          <span className={cn(
                            'px-1 py-px rounded text-[8px] font-medium',
                            link.type === 'nationality' ? 'bg-primary/15 text-primary' :
                            link.type === 'mentor' ? 'bg-emerald-400/15 text-emerald-400' :
                            link.type === 'partnership' ? 'bg-amber-400/15 text-amber-400' :
                            'bg-sky-400/15 text-sky-400'
                          )}>
                            {link.type}
                          </span>
                          <span className="text-foreground">{partner.lastName}</span>
                          <span className="text-muted-foreground ml-auto">+{link.strength}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bench */}
      <div className="mt-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Bench & Reserves</p>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 px-1">
          {subAndBench.map(id => {
            const p = players[id];
            if (!p) return null;
            const isSelected = selectedId === id;
            const benchCompat = selectedSlotPos
              ? getCompatibility(p.position as Position, selectedSlotPos)
              : null;
            return (
              <PlayerCard
                key={`bench-${id}`}
                player={p}
                position={p.position}
                variant="bench"
                isSelected={isSelected}
                chemistryLinkCount={playerChemCounts.get(p.id) || 0}
                compatRing={!isSelected ? benchCompat : null}
                isBestSub={id === bestSubId}
                onClick={() => handleTap(id)}
              />
            );
          })}
        </div>
      </div>

      {/* Selection hint */}
      {selectedId && (
        <div className="mt-2 text-center">
          <p className="text-[10px] text-primary animate-pulse">
            Tap another player to swap, or tap again to deselect
          </p>
        </div>
      )}

      {/* Chemistry Bar */}
      <div className="mt-3">
        <ChemistryBar bonus={chemBonus} label={chemLabel.label} labelColor={chemLabel.color} />
      </div>

      {/* Insights */}
      <InsightsPanel insights={insights} />
    </div>
  );
}
