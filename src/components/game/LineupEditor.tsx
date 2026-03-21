import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { FORMATION_POSITIONS, POSITION_COMPATIBILITY, type Position } from '@/types/game';
import { MAX_SUBS } from '@/config/playerGeneration';
import { PITCH_COLORS } from '@/config/ui';
import { getFitnessHexColor } from '@/utils/uiHelpers';
import { cn } from '@/lib/utils';
import { DndContext, DragOverlay, useDraggable, useDroppable, useSensor, useSensors, MouseSensor, TouchSensor, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { calculateChemistryLinks } from '@/utils/chemistry';
import { PlayerAvatar } from './PlayerAvatar';

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

function getChemistryLineColor(strength: number): string {
  if (strength >= 3) return '#22c55e';
  if (strength >= 2) return '#eab308';
  return '#ef4444';
}

const COMPAT_RING = {
  natural: 'ring-2 ring-emerald-400',
  compatible: 'ring-2 ring-amber-400',
  wrong: 'ring-2 ring-red-500',
};

function DraggablePlayer({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn('touch-none', isDragging && 'opacity-30')}>
      {children}
    </div>
  );
}

function DroppableSlot({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && 'scale-110 transition-transform')}>
      {children}
    </div>
  );
}

export function LineupEditor() {
  const { playerClubId, clubs, players, updateLineup } = useGameStore();
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Sensors must be declared before any early returns (hooks rules)
  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 5 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } });
  const sensors = useSensors(mouseSensor, touchSensor);

  const club = clubs[playerClubId];

  // Chemistry links for SVG lines (memoized — only recalculate when lineup changes)
  const chemLinks = useMemo(() => {
    if (!club) return [];
    const lineupPlayers = club.lineup.map(id => players[id]).filter(Boolean);
    return calculateChemistryLinks(lineupPlayers);
  }, [club, players]);

  if (!club) return null;

  const slots = FORMATION_POSITIONS[club.formation];
  const lineup = club.lineup;
  const subs = club.subs;
  const allSquad = club.playerIds;
  const benchIds = allSquad.filter(id => !lineup.includes(id) && !subs.includes(id) && players[id] && !players[id].injured);
  const subAndBench = [...subs, ...benchIds];

  const draggedPlayer = draggedId ? players[draggedId] : null;

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeInLineupIdx = lineup.indexOf(activeId);
    const overInLineupIdx = lineup.indexOf(overId);
    const activeOnBench = subAndBench.includes(activeId);
    const overOnBench = subAndBench.includes(overId);

    const overSlotMatch = (overId as string).match(/^slot-(\d+)$/);
    const overSlotIdx = overSlotMatch ? parseInt(overSlotMatch[1]) : -1;

    const newLineup = [...lineup];
    let newSubs = [...subs];

    if (activeInLineupIdx >= 0 && overInLineupIdx >= 0) {
      newLineup[activeInLineupIdx] = overId;
      newLineup[overInLineupIdx] = activeId;
    } else if (activeOnBench && overSlotIdx >= 0) {
      const displaced = newLineup[overSlotIdx];
      newLineup[overSlotIdx] = activeId;
      newSubs = newSubs.filter(id => id !== activeId);
      if (displaced) newSubs.push(displaced);
    } else if (activeOnBench && overInLineupIdx >= 0) {
      const displaced = newLineup[overInLineupIdx];
      newLineup[overInLineupIdx] = activeId;
      newSubs = newSubs.filter(id => id !== activeId);
      if (displaced) newSubs.push(displaced);
    } else if (activeInLineupIdx >= 0 && overOnBench) {
      newLineup[activeInLineupIdx] = overId;
      newSubs = newSubs.filter(id => id !== overId);
      newSubs.push(activeId);
    } else if (activeOnBench && overOnBench) {
      const activeSubIdx = newSubs.indexOf(activeId);
      const overSubIdx = newSubs.indexOf(overId);
      if (activeSubIdx >= 0 && overSubIdx >= 0) {
        newSubs[activeSubIdx] = overId;
        newSubs[overSubIdx] = activeId;
      }
    }

    updateLineup(newLineup, newSubs.slice(0, MAX_SUBS));
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Half Pitch (bottom half only — your team) */}
      <div className="relative w-full mx-auto" style={{ aspectRatio: `${VP_W}/${VP_H}`, maxWidth: '24rem' }}>
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

          {/* Chemistry Lines */}
          {chemLinks.map((link, idx) => {
            const idxA = lineup.indexOf(link.playerIdA);
            const idxB = lineup.indexOf(link.playerIdB);
            if (idxA < 0 || idxB < 0) return null;
            const slotA = slots[idxA];
            const slotB = slots[idxB];
            const x1 = 2 + (slotA.x / 100) * 64;
            const y1 = 95 - (slotA.y / 100) * 39;
            const x2 = 2 + (slotB.x / 100) * 64;
            const y2 = 95 - (slotB.y / 100) * 39;
            return (
              <line
                key={`chem-${idx}`}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={getChemistryLineColor(link.strength)}
                strokeWidth="0.45"
                opacity="0.5"
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* Player Tokens (HTML overlays for drag-and-drop) */}
        {slots.map((slot, i) => {
          const playerId = lineup[i];
          const player = playerId ? players[playerId] : null;
          const cxSvg = 2 + (slot.x / 100) * 64;
          const cySvg = 95 - (slot.y / 100) * 39;
          const left = (cxSvg / VP_W) * 100;
          const top = ((cySvg - VP_Y) / VP_H) * 100;

          const compat = draggedPlayer ? getCompatibility(draggedPlayer.position as Position, slot.pos as Position) : null;

          return (
            <div key={`slot-${i}`} className="absolute" style={{ left: `${left}%`, top: `${top}%`, transform: 'translate(-50%, -50%)' }}>
              <DroppableSlot id={playerId || `slot-${i}`}>
                {player ? (
                  <DraggablePlayer id={player.id}>
                    <div className={cn(
                      'flex flex-col items-center cursor-grab active:cursor-grabbing p-0.5 rounded-lg',
                      compat ? COMPAT_RING[compat] : ''
                    )}>
                      <svg width="28" height="28" viewBox="0 0 28 28" className="pointer-events-none">
                        <PlayerAvatar playerId={player.id} jerseyColor={club.color} size={28} />
                      </svg>
                      <div
                        className="bg-black/70 rounded px-1 py-px -mt-0.5 text-center min-w-[34px]"
                        style={{ borderBottom: `2px solid ${getFitnessHexColor(player.fitness)}` }}
                      >
                        <span className="text-[7px] text-white font-bold block leading-tight">{player.lastName.slice(0, 3).toUpperCase()}</span>
                        <span className="text-[6px] text-gray-400 block leading-tight">{slot.pos} {player.overall}</span>
                      </div>
                    </div>
                  </DraggablePlayer>
                ) : (
                  <div className={cn(
                    'w-10 h-10 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center',
                    compat ? COMPAT_RING[compat] : ''
                  )}>
                    <span className="text-[8px] text-white/40">{slot.pos}</span>
                  </div>
                )}
              </DroppableSlot>
            </div>
          );
        })}
      </div>

      {/* Bench */}
      <div className="mt-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Bench & Reserves</p>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 px-1">
          {subAndBench.map(id => {
            const p = players[id];
            if (!p) return null;
            return (
              <DroppableSlot key={`drop-${id}`} id={id}>
                <DraggablePlayer id={id}>
                  <div className="flex flex-col items-center shrink-0 cursor-grab active:cursor-grabbing" style={{ opacity: p.injured ? 0.4 : 1 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" className="pointer-events-none">
                      <PlayerAvatar playerId={p.id} jerseyColor={club.color} size={24} />
                    </svg>
                    <div
                      className="bg-black/60 rounded px-1 py-px -mt-0.5 text-center min-w-[28px]"
                      style={{ borderBottom: `1.5px solid ${getFitnessHexColor(p.fitness)}` }}
                    >
                      <span className="text-[6px] text-white font-bold block leading-tight">{p.lastName.slice(0, 3).toUpperCase()}</span>
                      <span className="text-[5px] text-gray-400 block leading-tight">{p.position} {p.overall}</span>
                    </div>
                  </div>
                </DraggablePlayer>
              </DroppableSlot>
            );
          })}
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {draggedPlayer && (
          <div className="flex flex-col items-center pointer-events-none">
            <svg width="32" height="32" viewBox="0 0 32 32" className="drop-shadow-lg">
              <PlayerAvatar playerId={draggedPlayer.id} jerseyColor={club.color} size={32} />
            </svg>
            <div className="bg-black/80 rounded px-1.5 py-0.5 -mt-0.5 text-center shadow-lg">
              <span className="text-[8px] text-white font-bold block leading-tight">{draggedPlayer.lastName.slice(0, 3).toUpperCase()}</span>
              <span className="text-[7px] text-gray-300 block leading-tight">{draggedPlayer.position} {draggedPlayer.overall}</span>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
