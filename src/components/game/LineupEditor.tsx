import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { FORMATION_POSITIONS, type Position } from '@/types/game';
import { cn } from '@/lib/utils';
import { calculateChemistryLinks, getChemistryBonus, getChemistryLabel } from '@/utils/chemistry';
import { getChemistryLines, buildChemistryStrengthMap, getChemistryLineColor, getFormationStructureLines } from '@/utils/formationLines';
import { getSquadInsights } from '@/utils/squadInsights';
import { LineupPlayerTile } from './LineupPlayerTile';
import { pitchSlotPoint } from '@/config/ui';
import { positionFit as getCompatibility } from '@/utils/positionFit';
import { PitchBoard } from './PitchBoard';
import { BenchStrip } from './BenchStrip';
import { ChemistryBar } from './ChemistryBar';
import { InsightsPanel } from './InsightsPanel';
import { FlagIcon } from '@/components/game/FlagIcon';
import { getRatingColor, getPlayerTier } from '@/utils/uiHelpers';
import { AnimatePresence, LayoutGroup, motion, type Transition } from 'framer-motion';
import { X } from 'lucide-react';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { infoToast } from '@/utils/gameToast';
import { applyLineupSwap, emptySlotId, type LineupState } from '@/utils/lineupSwap';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';

// The pitch itself, where a slot sits and what a tap target is now live in
// `PitchBoard`. What is left here is the tactics screen's own rules —
// chemistry, positional compatibility, swap semantics, insights — which is all
// this file should ever have been. `pitchSlotPoint` is imported rather than
// re-derived so the chemistry lines and the tiles cannot drift apart.
//
// `getCompatibility` moved to `@/utils/positionFit` unchanged: the Sunday
// teamsheet draws this same board and needs the same three-way answer, and a
// second private copy is how two boards start disagreeing.

// A swap is shown as the two players physically changing places. Every card —
// on the pitch and on the bench — carries a `layoutId` keyed on the PLAYER, not
// the slot, so when the lineup array changes framer-motion sees the same man
// in a new box and flies him there. Before this, slots re-rendered in place and
// a swap was a face silently changing on a tile.
//
// Slightly under-damped so the card lands with a hint of settle rather than a
// linear stop; quick enough that a run of swaps never queues up behind itself.
const SWAP_FLIGHT: Transition = { type: 'spring', stiffness: 520, damping: 38, mass: 0.9 };
const NO_FLIGHT: Transition = { duration: 0 };
const flightId = (playerId: string) => `lineup-card-${playerId}`;

const sameLineup = (a: LineupState, b: LineupState) =>
  a.lineup.join(',') === b.lineup.join(',') && a.subs.join(',') === b.subs.join(',');

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
  // MotionConfig already stops layout animations under reduced motion; asking
  // the hook as well keeps this correct if that config is ever loosened.
  const reduceMotion = useReducedMotionPref();
  const flight = reduceMotion ? NO_FLIGHT : SWAP_FLIGHT;

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

  // The last swap, kept so the bar under the bench can offer Undo. `after` is
  // what the swap wrote: Undo only restores `before` while the board still
  // reads exactly `after`, so it can never rewind a formation change, an
  // auto-pick or a week advance that happened in between.
  const [lastSwap, setLastSwap] = useState<{ before: LineupState; after: LineupState; label: string } | null>(null);

  const handleSwap = useCallback((activeId: string, targetId: string): boolean => {
    const next = applyLineupSwap({ lineup, subs }, activeId, targetId);
    if (!next) return false;
    const newLineup = next.lineup;

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

    // Written exactly as the exchange left it — deliberately NOT sliced to
    // MAX_SUBS. An exchange never lengthens the bench, so the only way this is
    // over the cap is a bench that already was (an older save), and trimming
    // it here would demote players the swap never touched. Oversized benches
    // are a data problem for auto-pick/migration to normalise, not a side
    // effect of moving two other people.
    const newSubs = next.subs;

    const activeName = players[activeId]?.lastName ?? 'Player';
    const slotMatch = targetId.match(/^slot-(\d+)$/);
    const label = slotMatch
      ? `${activeName} → ${formationSlots[parseInt(slotMatch[1], 10)]?.pos ?? 'slot'}`
      : `${activeName} ⇄ ${players[targetId]?.lastName ?? 'Player'}`;
    setLastSwap({ before: { lineup, subs }, after: { lineup: newLineup, subs: newSubs }, label });

    hapticMedium();
    updateLineup(newLineup, newSubs);
    return true;
  }, [lineup, subs, updateLineup, players, week, club?.formation]);

  const canUndo = !!lastSwap && sameLineup(lastSwap.after, { lineup, subs });

  const handleUndo = useCallback(() => {
    if (!lastSwap || !sameLineup(lastSwap.after, { lineup, subs })) return;
    hapticLight();
    updateLineup(lastSwap.before.lineup, lastSwap.before.subs);
    setLastSwap(null);
    setSelectedId(null);
  }, [lastSwap, lineup, subs, updateLineup]);

  const handleTap = useCallback((tappedId: string) => {
    const isEmptySlot = tappedId.startsWith('slot-');
    if (!selectedId) {
      if (isEmptySlot) return;
      hapticLight();
      setSelectedId(tappedId);
    } else if (selectedId === tappedId) {
      setSelectedId(null);
    } else if (handleSwap(selectedId, tappedId)) {
      setSelectedId(null);
    } else if (!isEmptySlot) {
      // Nothing to exchange (two reserves): move the selection instead of
      // swallowing the tap.
      hapticLight();
      setSelectedId(tappedId);
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
    // Namespaced so these layoutIds can never pair with a card elsewhere in the
    // app that happens to share an id.
    <LayoutGroup id="lineup-editor">
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
        onSlotTap={({ index, occupantId }) => handleTap(occupantId ?? emptySlotId(index))}
        slotLabel={({ slot, occupantId }) => {
          const p = occupantId ? players[occupantId] : null;
          if (p) return `${p.firstName} ${p.lastName}, ${slot.pos}`;
          return `Empty ${slot.pos} slot${selectedId ? ' — place selected player here' : ''}`;
        }}
        slotClassName={({ occupantId, slot }) => {
          // An occupied slot's emphasis comes from the tile's compatibility
          // treatment alone. It used to ALSO fade every non-chemistry-partner,
          // which stacked a second, unrelated signal on the same cards; the
          // chemistry lines already single out the selected man's partners.
          if (occupantId) return undefined;
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
            // Keyed on the player so a new occupant REMOUNTS rather than the
            // old element being handed a new layoutId, which would animate
            // the wrong card.
            <motion.div key={player.id} layoutId={flightId(player.id)} transition={flight}>
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
            </motion.div>
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

      {/* Bench */}
      <div className="mt-3">
        <p className="text-micro text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Bench & Reserves</p>
        {/* `layoutScroll` so a card flying out of (or into) a scrolled bench
            starts from where it is on screen, not from its unscrolled spot.
            pt leaves room for the selected card's lift inside the scroller's
            clip. */}
        <motion.div layoutScroll className="flex gap-1.5 overflow-x-auto scrollbar-hide pt-1.5 pb-1 px-1">
          {subAndBench.map(id => {
            const p = players[id];
            if (!p) return null;
            const isSelected = selectedId === id;
            const benchCompat = selectedSlotPos
              ? getCompatibility(p, selectedSlotPos)
              : null;
            return (
              <motion.div key={`bench-${id}`} layoutId={flightId(id)} transition={flight} className="shrink-0">
                <BenchStrip
                  player={p}
                  position={p.position}
                  isSelected={isSelected}
                  chemistryLinkCount={playerChemCounts.get(p.id) || 0}
                  compatRing={!isSelected ? benchCompat : null}
                  isBestSub={id === bestSubId}
                  week={week}
                  onClick={() => handleTap(id)}
                />
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Swap bar. ONE fixed-height line under the bench that says what the
          board is waiting for — pick someone, pick a partner, or undo what
          you just did. It replaces a pulsing hint that appeared below
          everything, and it sits BELOW the bench on purpose: the player
          detail panel used to open between the pitch and the bench, so
          selecting a starter shoved the bench down exactly as your thumb
          went for it. Nothing above the bench changes height any more. */}
      <div className="mt-2 mx-1 h-11 rounded-xl bg-card/50 border border-border/40 px-3 flex items-center overflow-hidden" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {selectedPlayer ? (
            <motion.div
              key={`sel-${selectedPlayer.id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: reduceMotion ? 0 : 0.14 }}
              className="flex w-full items-center gap-2 min-w-0"
            >
              <span className={cn('text-sm font-bold font-display tabular-nums', getPlayerTier(selectedPlayer.overall).textClass)}>
                {selectedPlayer.overall}
              </span>
              <span className="text-xs font-semibold text-foreground truncate">
                {selectedPlayer.lastName}
                <span className="text-muted-foreground font-normal"> · {selectedSlotPos ?? selectedPlayer.position}</span>
              </span>
              <span className="ml-auto shrink-0 text-xs text-primary">
                {isLineupSelected ? 'Tap a player or bench card' : 'Tap a slot or player'}
              </span>
            </motion.div>
          ) : canUndo ? (
            <motion.div
              key="undo"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: reduceMotion ? 0 : 0.14 }}
              className="flex w-full items-center gap-2 min-w-0"
            >
              <span className="text-xs font-semibold text-foreground truncate">{lastSwap.label}</span>
              <button
                type="button"
                onClick={handleUndo}
                className="ml-auto -mr-2 shrink-0 h-11 px-3 text-xs font-semibold text-primary active:opacity-70"
              >
                Undo
              </button>
            </motion.div>
          ) : (
            <motion.p
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.14 }}
              className="w-full text-center text-xs text-muted-foreground"
            >
              Tap a player, then who they swap with
            </motion.p>
          )}
        </AnimatePresence>
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
                  <span className={cn('text-lg font-bold font-display tabular-nums', getPlayerTier(selectedPlayer.overall).textClass)}>
                    {selectedPlayer.overall}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      <FlagIcon nationality={selectedPlayer.nationality} size={14} /> {selectedPlayer.firstName} {selectedPlayer.lastName}
                    </p>
                    <p className="text-micro text-muted-foreground">
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
                    <span className="text-micro text-muted-foreground capitalize">{attr.slice(0, 3)}</span>
                    <span className={cn('text-micro font-bold tabular-nums', getRatingColor(selectedPlayer.attributes[attr]))}>
                      {selectedPlayer.attributes[attr]}
                    </span>
                  </div>
                ))}
              </div>

              {/* Morale + Form row */}
              <div className="flex items-center gap-3 mb-1.5 text-micro">
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
                  <span className="text-primary text-micro ml-auto">BENCH</span>
                )}
              </div>

              {/* Chemistry links for this player */}
              {selectedPlayerLinks.length > 0 && (
                <div className="border-t border-border/30 pt-1.5">
                  <p className="text-micro text-muted-foreground mb-1">Chemistry Links</p>
                  <div className="space-y-0.5">
                    {selectedPlayerLinks.map((link) => {
                      const partnerId = link.playerIdA === selectedId ? link.playerIdB : link.playerIdA;
                      const partner = players[partnerId];
                      if (!partner) return null;
                      return (
                        <div key={`${link.playerIdA}-${link.playerIdB}-${link.type}`} className="flex items-center gap-1.5 text-micro">
                          <span className={cn(
                            'px-1 py-px rounded text-micro font-medium',
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

      {/* Chemistry Bar */}
      <div className="mt-3">
        <ChemistryBar bonus={chemBonus} label={chemLabel.label} labelColor={chemLabel.color} />
      </div>

      {/* Insights */}
      <InsightsPanel insights={insights} />
    </div>
    </LayoutGroup>
  );
}
