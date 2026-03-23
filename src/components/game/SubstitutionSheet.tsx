import { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { usePlayerClub } from '@/hooks/useGameSelectors';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getRatingBadgeClasses, getFitnessHexColor } from '@/utils/uiHelpers';
import { FORMATION_POSITIONS, POSITION_COMPATIBILITY, type Position } from '@/types/game';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { getFlag } from '@/utils/nationality';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRightLeft, Check, AlertCircle } from 'lucide-react';
import { MAX_SUBSTITUTIONS } from '@/config/matchEngine';
import { PITCH_COLORS } from '@/config/ui';
import { PlayerAvatar } from './PlayerAvatar';

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
}

function getFormLabel(form: number): { text: string; className: string } {
  if (form >= 80) return { text: 'Hot', className: 'text-emerald-400' };
  if (form >= 60) return { text: 'Good', className: 'text-primary' };
  if (form >= 40) return { text: 'Avg', className: 'text-muted-foreground' };
  return { text: 'Poor', className: 'text-destructive' };
}

function getCompatibility(playerPos: Position, slotPos: Position): 'natural' | 'compatible' | 'wrong' {
  if (playerPos === slotPos) return 'natural';
  const compat = POSITION_COMPATIBILITY[slotPos] || [];
  if (compat.includes(playerPos)) return 'compatible';
  return 'wrong';
}

const COMPAT_RING = {
  natural: 'ring-2 ring-emerald-400',
  compatible: 'ring-2 ring-amber-400',
  wrong: 'ring-2 ring-red-500',
};

// Half-pitch viewBox constants
const VP_Y = 46;
const VP_H = 59;
const VP_W = 68;

export function SubstitutionSheet({ open, onOpenChange, onSubMade, matchMinute, homeGoals, awayGoals, homeShortName, awayShortName, isPlayerHome }: SubstitutionSheetProps) {
  const { players, makeMatchSub, matchSubsUsed, week } = useGameStore();
  const playerClub = usePlayerClub();

  const [selectedOutId, setSelectedOutId] = useState<string | null>(null);
  const [selectedInId, setSelectedInId] = useState<string | null>(null);

  // Reset selection state when sheet opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedOutId(null);
      setSelectedInId(null);
    }
  }, [open]);

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
  const slots = useMemo(() => playerClub ? FORMATION_POSITIONS[playerClub.formation] || [] : [], [playerClub, playerClub?.formation]);

  // Find the formation slot position of the selected out player
  const selectedSlotPos = useMemo(() => {
    if (!selectedOutId) return null;
    const idx = lineup.indexOf(selectedOutId);
    if (idx < 0 || !slots[idx]) return null;
    return slots[idx].pos as Position | undefined;
  }, [selectedOutId, lineup, slots]);

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

          return (
            <div
              key={`slot-${i}`}
              className="absolute"
              style={{ left: `${left}%`, top: `${top}%`, transform: 'translate(-50%, -50%)' }}
              onClick={() => handleLineupPlayerClick(playerId)}
            >
              <div className={cn(
                'flex flex-col items-center cursor-pointer p-0.5 rounded-lg transition-all',
                isSelectedOut ? 'ring-2 ring-destructive scale-110' : 'hover:scale-105',
              )}>
                <svg width="26" height="26" viewBox="0 0 26 26" className="pointer-events-none">
                  <PlayerAvatar playerId={player.id} jerseyColor={playerClub.color} size={26} />
                </svg>
                <div
                  className={cn(
                    'rounded px-1 py-px -mt-0.5 text-center min-w-[32px]',
                    isSelectedOut ? 'bg-destructive/80' : 'bg-black/70',
                  )}
                >
                  <span className="text-[7px] text-white font-bold block leading-tight">{player.lastName.slice(0, 3).toUpperCase()}</span>
                  <span className="text-[6px] text-gray-400 block leading-tight">{slot.pos} {player.overall}</span>
                  <div className="w-full h-[2px] mt-0.5 rounded-full overflow-hidden bg-muted/40">
                    <div className="h-full rounded-full" style={{ width: `${player.fitness}%`, backgroundColor: getFitnessHexColor(player.fitness) }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
            return (
              <div
                key={`bench-${id}`}
                className={cn(
                  'flex flex-col items-center shrink-0 cursor-pointer transition-all rounded-lg p-0.5',
                  !selectedOutId ? 'opacity-50 pointer-events-none' : '',
                  benchCompat ? COMPAT_RING[benchCompat] : '',
                )}
                onClick={() => selectedOutId && handleBenchClick(id)}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" className="pointer-events-none">
                  <PlayerAvatar playerId={p.id} jerseyColor={playerClub.color} size={24} />
                </svg>
                <div className="bg-black/60 rounded px-1 py-px -mt-0.5 text-center min-w-[28px]">
                  <span className="text-[7px] text-white font-bold block leading-tight">{p.lastName.slice(0, 3).toUpperCase()}</span>
                  <span className="text-[6px] text-gray-400 block leading-tight">{p.position} {p.overall}</span>
                  <div className="w-full h-[2px] mt-0.5 rounded-full overflow-hidden bg-muted/40">
                    <div className="h-full rounded-full" style={{ width: `${p.fitness}%`, backgroundColor: getFitnessHexColor(p.fitness) }} />
                  </div>
                </div>
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-t border-border/50 px-4 pb-8">
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
