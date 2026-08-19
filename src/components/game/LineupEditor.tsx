import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { FORMATION_POSITIONS, canPlayPosition, type Position } from '@/types/game';
import { MAX_SUBS } from '@/config/playerGeneration';
import { cn } from '@/lib/utils';
import { calculateChemistryLinks, getChemistryBonus, getChemistryLabel } from '@/utils/chemistry';
import { getChemistryLines, buildChemistryStrengthMap, getChemistryLineColor, getFormationStructureLines } from '@/utils/formationLines';
import { getSquadInsights } from '@/utils/squadInsights';
import { LineupPlayerTile } from './LineupPlayerTile';
import { pitchSlotPoint } from '@/config/ui';
import { PitchBoard } from './PitchBoard';
import { BenchStrip } from './BenchStrip';
import { ChemistryBar } from './ChemistryBar';
import { InsightsPanel } from './InsightsPanel';
import { FlagIcon } from '@/components/game/FlagIcon';
import { getRatingColor, getPlayerTier } from '@/utils/uiHelpers';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { infoToast } from '@/utils/gameToast';

// The pitch itself, where a slot sits and what a tap target is now live in
// `PitchBoard`. What is left here is the tactics screen's own rules —
// chemistry, positional compatibility, swap semantics, insights — which is all
// this file should ever have been. `pitchSlotPoint` is imported rather than
// re-derived so the chemistry lines and the tiles cannot drift apart.

function getCompatibility(player: { position: Position; alternatePositions?: Position[] }, slotPos: Position): 'natural' | 'compatible' | 'wrong' {
  if (player.position === slotPos) return 'natural';
  // Alternate positions are part of the player's printed card position
  // list (FC26-style "ALT POS"); treating them as natural matches FUT
  // chemistry where ALT POS slots light up green, not amber.
  if (player.alternatePositions?.includes(slotPos)) return 'natural';
  if (canPlayPosition(player, slotPos)) return 'compatible';
  return 'wrong';
}

export function LineupEditor() {
  const { playerClubId, clubs, players, week, season, pairFamiliarity } = useGameStore(useShallow(s => ({
    playerClubId: s.playerClubId,
    clubs: s.clubs,
    players: s.players,
    week: s.week,
    season: s.season,
    pairFamiliarity: s.pairFamiliarity,
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

  // Chemistry links (memoized). Holes (deleted-player IDs) are kept as null —
  // compacting with filter(Boolean) would shift players onto wrong slots.
  const chemLinks = useMemo(() => {
    if (!club) return [];
    const lineupPlayers = club.lineup.map(id => players[id] ?? null);
    return calculateChemistryLinks(lineupPlayers, club.formation, season);
  }, [club, players, season]);

  // Structural formation lines — the faint "skeleton" connecting nearby
  // positions (defence → midfield → attack) so the pitch always shows the
  // formation shape, even before any chemistry has been built between pairs.
  const structureFormation = club?.formation;
  const structureLines = useMemo(
    () => getFormationStructureLines(structureFormation ? FORMATION_POSITIONS[structureFormation] || [] : []),
    [structureFormation],
  );

  // Chemistry connection lines for SVG rendering
  const chemLineData = useMemo(() => {
    if (!club) return [];
    const slotList = FORMATION_POSITIONS[club.formation] || [];
    const lineIndices = getChemistryLines(slotList, chemLinks, club.lineup);
    const strengthMap = buildChemistryStrengthMap(chemLinks, pairFamiliarity);
    return lineIndices.map(([a, b]) => {
      const idA = club.lineup[a];
      const idB = club.lineup[b];
      const key = idA < idB ? `${idA}-${idB}` : `${idB}-${idA}`;
      const strength = strengthMap.get(key) || 1;
      return { a, b, color: getChemistryLineColor(strength), strength };
    });
  }, [club, chemLinks, pairFamiliarity]);

  // Chemistry bonus and label (null holes kept for slot alignment)
  const { chemBonus, chemLabel } = useMemo(() => {
    if (!club) return { chemBonus: 0, chemLabel: getChemistryLabel(0) };
    const lp = club.lineup.map(id => players[id] ?? null);
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

  // Insights (null holes kept so warnings/unit averages stay slot-aligned)
  const insights = useMemo(() => {
    if (!club) return [];
    const lineupPlayers = club.lineup.map(id => players[id] ?? null);
    const slots = FORMATION_POSITIONS[club.formation] || [];
    return getSquadInsights(lineupPlayers, club.formation, slots, chemLinks, chemBonus);
  }, [club, players, chemLinks, chemBonus]);

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
    } else if (activeInLineupIdx >= 0 && overSlotIdx >= 0) {
      // Starter → empty formation slot: move them into the hole, vacating
      // their old slot. Previously this case fell through every branch —
      // haptics fired but nothing changed, so a hole couldn't be filled
      // with a starter.
      newLineup[overSlotIdx] = activeId;
      newLineup[activeInLineupIdx] = '';
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

    // M6 — warn (don't block) when an injured/suspended player lands in the
    // XI: the `subs` array isn't availability-filtered, so it can hold
    // players the match engine will refuse to field.
    const enteredXI = newLineup.filter(id => id && !lineup.includes(id));
    for (const id of enteredXI) {
      const p = players[id];
      if (!p) continue;
      if (p.injured) {
        infoToast(`${p.lastName} is injured`, 'They cannot play until recovered.');
      } else if (p.suspendedUntilWeek && p.suspendedUntilWeek > week) {
        infoToast(`${p.lastName} is suspended`, 'They cannot play this week.');
      }
    }

    // M6 — warn when the swap leaves no goalkeeper in goal.
    const formationSlots = FORMATION_POSITIONS[club?.formation] || [];
    const gkIdx = formationSlots.findIndex(s => s.pos === 'GK');
    if (gkIdx >= 0) {
      const gk = newLineup[gkIdx] ? players[newLineup[gkIdx]] : null;
      const hadGk = lineup[gkIdx] ? players[lineup[gkIdx]] : null;
      const isGkCapable = (p: typeof gk) => !!p && (p.position === 'GK' || p.alternatePositions?.includes('GK'));
      if (!isGkCapable(gk) && isGkCapable(hadGk)) {
        infoToast('No goalkeeper in goal', 'Your lineup has no keeper between the posts.');
      }
    }

    // M1 — a full bench silently dropped the displaced starter to reserves
    // (slice truncation). Keep the truncation (MAX_SUBS is a hard cap) but
    // tell the player who got bumped.
    const trimmedSubs = newSubs.slice(0, MAX_SUBS);
    if (newSubs.length > MAX_SUBS) {
      const bumped = newSubs.slice(MAX_SUBS).map(id => players[id]).filter(Boolean);
      if (bumped.length > 0) {
        infoToast('Bench full', `${bumped.map(p => p.lastName).join(', ')} moved to reserves.`);
      }
    }

    hapticMedium();
    updateLineup(newLineup, trimmedSubs);
  }, [lineup, subs, subAndBench, updateLineup, players, week, club?.formation]);

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
      {/* The board. Everything about WHERE a slot is and what a tap target
          looks like now lives in PitchBoard; what stays here is what this
          screen knows and the board does not — chemistry, compatibility and
          the swap rules. */}
      <PitchBoard
        slots={slots}
        occupants={lineup}
        selectedId={selectedId}
        ariaLabel="Formation"
        onSlotTap={({ index, occupantId }) => handleTap(occupantId ?? `slot-${index}`)}
        slotLabel={({ slot, occupantId }) => {
          const p = occupantId ? players[occupantId] : null;
          if (p) return `${p.firstName} ${p.lastName}, ${slot.pos}`;
          return `Empty ${slot.pos} slot${selectedId ? ' — place selected player here' : ''}`;
        }}
        slotClassName={({ occupantId, isSelected, slot }) => {
          // An occupied slot fades when someone else is selected and shares no
          // chemistry with the man standing here.
          if (occupantId) {
            return selectedId && !isSelected && !selectedChemPartners.has(occupantId)
              ? 'opacity-40'
              : undefined;
          }
          // An empty slot wears the compatibility ring for whoever is selected,
          // which is how you can see where a bench player is allowed to go.
          const compat = selectedPlayer ? getCompatibility(selectedPlayer, slot.pos as Position) : null;
          if (!compat) return undefined;
          return cn(
            'rounded-[7px]',
            compat === 'natural' ? 'ring-2 ring-emerald-400'
              : compat === 'compatible' ? 'ring-2 ring-amber-400'
                : 'ring-2 ring-red-500',
          );
        }}
        renderToken={({ occupantId, slot, isSelected }) => {
          const player = players[occupantId];
          if (!player) return null;
          const compat = selectedPlayer ? getCompatibility(selectedPlayer, slot.pos as Position) : null;
          return (
            <LineupPlayerTile
              player={player}
              position={slot.pos}
              isSelected={isSelected}
              chemistryLinkCount={playerChemCounts.get(player.id) || 0}
              compatRing={!isSelected ? compat : null}
              positionTone={getCompatibility(player, slot.pos as Position)}
              week={week}
              // PitchBoard owns the button; a tile with its own role="button"
              // inside one would be two tab stops for a single action.
              interactive={false}
            />
          );
        }}
        underlay={
          <>
            {/* Structural formation lines (faint skeleton, under chemistry) */}
            {structureLines.map(([a, b]) => {
              const slotA = slots[a];
              const slotB = slots[b];
              if (!slotA || !slotB) return null;
              // Only connect slots that actually have a player in them, so the
              // pitch reads as your fielded XI rather than an abstract diagram.
              if (!lineup[a] || !lineup[b]) return null;
              const p1 = pitchSlotPoint(slotA);
              const p2 = pitchSlotPoint(slotB);
              return (
                <line
                  key={`struct-${a}-${b}`}
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth={0.25}
                  strokeOpacity={0.14}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Chemistry connection lines */}
            {chemLineData.map(({ a, b, color, strength }) => {
              const slotA = slots[a];
              const slotB = slots[b];
              if (!slotA || !slotB) return null;
              const idA = lineup[a];
              const idB = lineup[b];
              if (!idA || !idB) return null;
              const p1 = pitchSlotPoint(slotA);
              const p2 = pitchSlotPoint(slotB);
              // Fade lines not connected to the selected player.
              const isRelevant = !selectedId || idA === selectedId || idB === selectedId;
              return (
                <line
                  key={`chem-${a}-${b}`}
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke={color}
                  strokeWidth={strength >= 3 ? 0.7 : strength >= 2 ? 0.5 : 0.4}
                  strokeOpacity={isRelevant ? 0.7 : 0.12}
                  strokeLinecap="round"
                  strokeDasharray={strength === 1 ? '0.8 0.8' : undefined}
                />
              );
            })}
          </>
        }
      />

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
                  <span className={cn('text-lg font-bold font-display tabular-nums', getPlayerTier(selectedPlayer.overall).textClass)}>
                    {selectedPlayer.overall}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      <FlagIcon nationality={selectedPlayer.nationality} size={14} /> {selectedPlayer.firstName} {selectedPlayer.lastName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {selectedPlayer.position} · Age {selectedPlayer.age} · Fitness {selectedPlayer.fitness}%
                      {selectedPlayer.injured && ' · Injured'}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedId(null)} aria-label="Close player details" className="p-2 -mr-1 rounded hover:bg-muted/30 transition-colors">
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
                    {selectedPlayerLinks.map((link) => {
                      const partnerId = link.playerIdA === selectedId ? link.playerIdB : link.playerIdA;
                      const partner = players[partnerId];
                      if (!partner) return null;
                      return (
                        <div key={`${link.playerIdA}-${link.playerIdB}-${link.type}`} className="flex items-center gap-1.5 text-[9px]">
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
              ? getCompatibility(p, selectedSlotPos)
              : null;
            return (
              <BenchStrip
                key={`bench-${id}`}
                player={p}
                position={p.position}
                isSelected={isSelected}
                chemistryLinkCount={playerChemCounts.get(p.id) || 0}
                compatRing={!isSelected ? benchCompat : null}
                isBestSub={id === bestSubId}
                week={week}
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
