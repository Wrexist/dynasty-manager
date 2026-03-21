import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { FORMATION_POSITIONS, POSITION_COMPATIBILITY, type Position } from '@/types/game';
import { PITCH_COLORS } from '@/config/ui';
import { cn } from '@/lib/utils';
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';

function getFitnessColor(fitness: number): string {
  if (fitness >= 80) return '#22c55e';
  if (fitness >= 60) return '#eab308';
  if (fitness >= 40) return '#f97316';
  return '#ef4444';
}

function getCompatibility(playerPos: Position, slotPos: Position): 'natural' | 'compatible' | 'wrong' {
  if (playerPos === slotPos) return 'natural';
  const compat = POSITION_COMPATIBILITY[slotPos] || [];
  if (compat.includes(playerPos)) return 'compatible';
  return 'wrong';
}

const COMPAT_COLORS = {
  natural: 'ring-2 ring-emerald-400 bg-emerald-400/20',
  compatible: 'ring-2 ring-amber-400 bg-amber-400/20',
  wrong: 'ring-2 ring-destructive bg-destructive/20',
  none: '',
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
  const club = clubs[playerClubId];
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

    // Determine what we're dragging and where
    const activeInLineupIdx = lineup.indexOf(activeId);
    const overInLineupIdx = lineup.indexOf(overId);
    const activeOnBench = subAndBench.includes(activeId);
    const overOnBench = subAndBench.includes(overId);

    // Also handle dropping on a slot (slot-0, slot-1, etc.)
    const overSlotMatch = (overId as string).match(/^slot-(\d+)$/);
    const overSlotIdx = overSlotMatch ? parseInt(overSlotMatch[1]) : -1;

    const newLineup = [...lineup];
    const newSubs = [...subs];

    if (activeInLineupIdx >= 0 && overInLineupIdx >= 0) {
      // Swap two lineup players
      newLineup[activeInLineupIdx] = overId;
      newLineup[overInLineupIdx] = activeId;
    } else if (activeOnBench && overSlotIdx >= 0) {
      // Bench player dropped on empty slot — swap with current occupant
      const displaced = newLineup[overSlotIdx];
      newLineup[overSlotIdx] = activeId;
      // Move displaced to subs
      newSubs = newSubs.filter(id => id !== activeId);
      if (displaced) newSubs.push(displaced);
    } else if (activeOnBench && overInLineupIdx >= 0) {
      // Bench player dropped on a lineup player — swap
      const displaced = newLineup[overInLineupIdx];
      newLineup[overInLineupIdx] = activeId;
      newSubs = newSubs.filter(id => id !== activeId);
      if (displaced) newSubs.push(displaced);
    } else if (activeInLineupIdx >= 0 && overOnBench) {
      // Lineup player dropped on bench player — swap
      newLineup[activeInLineupIdx] = overId;
      newSubs = newSubs.filter(id => id !== overId);
      newSubs.push(activeId);
    } else if (activeOnBench && overOnBench) {
      // Bench-to-bench reorder — swap positions in subs
      const activeSubIdx = newSubs.indexOf(activeId);
      const overSubIdx = newSubs.indexOf(overId);
      if (activeSubIdx >= 0 && overSubIdx >= 0) {
        newSubs[activeSubIdx] = overId;
        newSubs[overSubIdx] = activeId;
      }
    }

    updateLineup(newLineup, newSubs.slice(0, 7));
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Pitch */}
      <div className="relative w-full aspect-[68/105] max-w-sm mx-auto">
        {/* SVG Pitch Background */}
        <svg viewBox="0 0 68 105" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="68" height="105" rx="1.5" fill={PITCH_COLORS.FILL} />
          <rect x="2" y="2" width="64" height="101" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
          <line x1="2" y1="52.5" x2="66" y2="52.5" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
          <circle cx="34" cy="52.5" r="9.15" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
          <circle cx="34" cy="52.5" r="0.5" fill={PITCH_COLORS.LINE} />
          <rect x="13.85" y="2" width="40.3" height="16.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
          <rect x="13.85" y="86.5" width="40.3" height="16.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
          <rect x="24.85" y="2" width="18.3" height="5.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
          <rect x="24.85" y="97.5" width="18.3" height="5.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
          <rect x="29" y="0" width="10" height="2" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
          <rect x="29" y="103" width="10" height="2" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
          <path d="M 26.85 18.5 A 9.15 9.15 0 0 0 41.15 18.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
          <path d="M 26.85 86.5 A 9.15 9.15 0 0 1 41.15 86.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        </svg>

        {/* Player Tokens */}
        {slots.map((slot, i) => {
          const playerId = lineup[i];
          const player = playerId ? players[playerId] : null;
          // Convert SVG coords to percentages
          const left = ((2 + (slot.x / 100) * 64) / 68) * 100;
          const top = ((95 - (slot.y / 100) * 39) / 105) * 100;

          const compat = draggedPlayer ? getCompatibility(draggedPlayer.position as Position, slot.pos as Position) : null;

          return (
            <div key={`slot-${i}`} className="absolute" style={{ left: `${left}%`, top: `${top}%`, transform: 'translate(-50%, -50%)' }}>
              <DroppableSlot id={playerId || `slot-${i}`}>
                {player ? (
                  <DraggablePlayer id={player.id}>
                    <div className={cn(
                      'w-10 h-10 rounded-full flex flex-col items-center justify-center text-white text-[8px] font-bold cursor-grab active:cursor-grabbing',
                      compat ? COMPAT_COLORS[compat] : ''
                    )} style={{ backgroundColor: club.color }}>
                      <span className="leading-none">{player.lastName.slice(0, 4)}</span>
                      <span className="text-[7px] opacity-70">{player.overall}</span>
                    </div>
                    {/* Fitness bar */}
                    <div className="w-8 h-1 mx-auto mt-0.5 bg-white/15 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${player.fitness}%`, backgroundColor: getFitnessColor(player.fitness) }} />
                    </div>
                    {/* Position label */}
                    <p className="text-[7px] text-center text-gray-400 mt-0.5">{slot.pos}</p>
                  </DraggablePlayer>
                ) : (
                  <div className={cn(
                    'w-10 h-10 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center',
                    compat ? COMPAT_COLORS[compat] : ''
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
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 px-1">
          {subAndBench.map(id => {
            const p = players[id];
            if (!p) return null;
            return (
              <DraggablePlayer key={id} id={id}>
                <div className="flex flex-col items-center shrink-0 cursor-grab active:cursor-grabbing">
                  <div className="w-9 h-9 rounded-full flex flex-col items-center justify-center text-white text-[7px] font-bold border border-white/20" style={{ backgroundColor: club.color, opacity: p.injured ? 0.4 : 0.75 }}>
                    <span className="leading-none">{p.lastName.slice(0, 4)}</span>
                    <span className="text-[6px] opacity-70">{p.overall}</span>
                  </div>
                  <div className="w-7 h-0.5 mx-auto mt-0.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${p.fitness}%`, backgroundColor: getFitnessColor(p.fitness) }} />
                  </div>
                  <p className="text-[7px] text-muted-foreground mt-0.5">{p.position}</p>
                </div>
              </DraggablePlayer>
            );
          })}
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {draggedPlayer && (
          <div className="w-11 h-11 rounded-full flex flex-col items-center justify-center text-white text-[8px] font-bold shadow-lg shadow-black/50" style={{ backgroundColor: club.color }}>
            <span className="leading-none">{draggedPlayer.lastName.slice(0, 4)}</span>
            <span className="text-[7px] opacity-70">{draggedPlayer.overall}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
