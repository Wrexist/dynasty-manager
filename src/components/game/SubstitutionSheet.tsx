import { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { usePlayerClub } from '@/hooks/useGameSelectors';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getRatingBadgeClasses } from '@/utils/uiHelpers';
import { POSITION_COMPATIBILITY, type Position } from '@/types/game';
import { hapticMedium } from '@/utils/haptics';
import { getFlag } from '@/utils/nationality';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRightLeft, Check, X, ChevronDown } from 'lucide-react';
import { MAX_SUBSTITUTIONS } from '@/config/matchEngine';

interface SubstitutionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubMade?: () => void;
}

function getPositionFitClass(playerPos: Position, targetPos: Position | null): string {
  if (!targetPos) return 'bg-muted/50 text-muted-foreground';
  if (playerPos === targetPos) return 'bg-emerald-500/20 text-emerald-400';
  const compat = POSITION_COMPATIBILITY[targetPos] || [];
  if (compat.includes(playerPos)) return 'bg-amber-500/20 text-amber-400';
  return 'bg-red-500/20 text-red-400';
}

function getFormLabel(form: number): { text: string; className: string } {
  if (form >= 80) return { text: 'Hot', className: 'text-emerald-400' };
  if (form >= 60) return { text: 'Good', className: 'text-primary' };
  if (form >= 40) return { text: 'Avg', className: 'text-muted-foreground' };
  return { text: 'Poor', className: 'text-destructive' };
}

function getMoraleLabel(morale: number): { text: string; className: string } {
  if (morale >= 80) return { text: 'Happy', className: 'text-emerald-400' };
  if (morale >= 55) return { text: 'OK', className: 'text-muted-foreground' };
  return { text: 'Low', className: 'text-amber-400' };
}

function getKeyAttributes(position: Position, attrs: { pace: number; shooting: number; passing: number; defending: number; physical: number; mental: number }): { label: string; value: number }[] {
  switch (position) {
    case 'GK': return [{ label: 'DEF', value: attrs.defending }, { label: 'MEN', value: attrs.mental }];
    case 'CB': case 'LB': case 'RB': return [{ label: 'DEF', value: attrs.defending }, { label: 'PHY', value: attrs.physical }];
    case 'CDM': case 'CM': return [{ label: 'PAS', value: attrs.passing }, { label: 'DEF', value: attrs.defending }];
    case 'CAM': return [{ label: 'PAS', value: attrs.passing }, { label: 'SHO', value: attrs.shooting }];
    case 'LM': case 'RM': case 'LW': case 'RW': return [{ label: 'PAC', value: attrs.pace }, { label: 'SHO', value: attrs.shooting }];
    case 'ST': return [{ label: 'SHO', value: attrs.shooting }, { label: 'PAC', value: attrs.pace }];
    default: return [{ label: 'PAC', value: attrs.pace }, { label: 'PAS', value: attrs.passing }];
  }
}

export function SubstitutionSheet({ open, onOpenChange, onSubMade }: SubstitutionSheetProps) {
  const { players, makeMatchSub, matchSubsUsed, week } = useGameStore();
  const playerClub = usePlayerClub();

  const [selectedOutId, setSelectedOutId] = useState<string | null>(null);
  const [selectedInId, setSelectedInId] = useState<string | null>(null);
  const [showLineup, setShowLineup] = useState(false);

  // Reset selection state when sheet opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedOutId(null);
      setSelectedInId(null);
      setShowLineup(false);
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

  if (!playerClub) return null;

  const lineup = playerClub.lineup;
  const subsRemaining = MAX_SUBSTITUTIONS - matchSubsUsed;

  const selectedOutPlayer = selectedOutId ? players[selectedOutId] : null;
  const selectedInPlayer = selectedInId ? players[selectedInId] : null;
  const outPos = selectedOutPlayer ? (selectedOutPlayer.position as Position) : null;

  const handleLineupPlayerClick = (playerId: string) => {
    if (!playerId) return;
    setSelectedOutId(playerId);
    setSelectedInId(null);
  };

  const handleBenchClick = (playerId: string) => {
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
        </SheetHeader>

        <AnimatePresence mode="wait">
          {/* State 1: Select player to sub out — show compact lineup grid */}
          {!selectedOutId && (
            <motion.div
              key="lineup-select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                Select Player to Substitute
              </p>

              {/* Compact lineup grid */}
              <div className="space-y-1">
                {lineup.map((id) => {
                  const p = players[id];
                  if (!p) return null;
                  const formInfo = getFormLabel(p.form);
                  return (
                    <button
                      key={id}
                      onClick={() => handleLineupPlayerClick(id)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border bg-card/40 border-border/30 hover:bg-destructive/10 hover:border-destructive/30 transition-all text-left active:scale-[0.98]"
                    >
                      <div className={cn(
                        'w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0',
                        getRatingBadgeClasses(p.overall)
                      )}>
                        {p.overall}
                      </div>
                      <div className="w-8 text-center">
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {p.position}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {getFlag(p.nationality)} {p.firstName[0]}. {p.lastName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn('text-[9px] font-semibold', formInfo.className)}>{formInfo.text}</span>
                        <div className="flex items-center gap-1">
                          <div className="w-8 h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full', p.fitness >= 80 ? 'bg-emerald-500' : p.fitness >= 60 ? 'bg-amber-500' : 'bg-destructive')}
                              style={{ width: `${p.fitness}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-muted-foreground w-7 text-right">{Math.round(p.fitness)}%</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* State 2: Player selected — show bench replacements */}
          {selectedOutId && !selectedInId && selectedOutPlayer && (
            <motion.div
              key="bench"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              {/* Selected player bar */}
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                <ArrowRightLeft className="w-3.5 h-3.5 text-destructive shrink-0" />
                <div className={cn(
                  'w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold shrink-0',
                  getRatingBadgeClasses(selectedOutPlayer.overall)
                )}>
                  {selectedOutPlayer.overall}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {getFlag(selectedOutPlayer.nationality)} {selectedOutPlayer.firstName[0]}. {selectedOutPlayer.lastName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{selectedOutPlayer.position} · FIT {Math.round(selectedOutPlayer.fitness)}%</p>
                </div>
                <button onClick={handleCancel} className="text-muted-foreground hover:text-foreground p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Bench list */}
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Select Replacement</p>
              <div className="space-y-1.5">
                {(() => { let bestShown = false; return sortedSubs.map((id) => {
                  const p = players[id];
                  if (!p || p.injured || (p.suspendedUntilWeek && p.suspendedUntilWeek > week)) return null;
                  const isFirst = !bestShown;
                  if (isFirst) bestShown = true;
                  const formInfo = getFormLabel(p.form);
                  const moraleInfo = getMoraleLabel(p.morale);
                  const keyAttrs = getKeyAttributes(p.position as Position, p.attributes);
                  const posFitClass = getPositionFitClass(p.position as Position, outPos);
                  return (
                    <button
                      key={id}
                      onClick={() => handleBenchClick(id)}
                      className={cn(
                        'w-full flex flex-col gap-1.5 px-3 py-2.5 rounded-lg border transition-all text-left active:scale-[0.98]',
                        isFirst ? 'bg-primary/10 border-primary/30' : 'bg-card/40 border-border/30 hover:bg-primary/10 hover:border-primary/30'
                      )}
                    >
                      {/* Top row: rating, name, position, best badge */}
                      <div className="flex items-center gap-2 w-full">
                        <div className={cn(
                          'w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0',
                          getRatingBadgeClasses(p.overall)
                        )}>
                          {p.overall}
                        </div>
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0', posFitClass)}>
                          {p.position}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {getFlag(p.nationality)} {p.firstName[0]}. {p.lastName}
                            </p>
                            {isFirst && (
                              <span className="text-[8px] font-bold text-primary bg-primary/15 px-1.5 py-0.5 rounded-full shrink-0">Best</span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">Age {p.age}</span>
                      </div>

                      {/* Bottom row: key attrs, form, morale, fitness */}
                      <div className="flex items-center gap-2 w-full pl-9">
                        {/* Key attributes */}
                        {keyAttrs.map(attr => (
                          <div key={attr.label} className="flex items-center gap-0.5">
                            <span className="text-[8px] text-muted-foreground">{attr.label}</span>
                            <span className={cn('text-[9px] font-bold', attr.value >= 75 ? 'text-emerald-400' : attr.value >= 60 ? 'text-foreground' : 'text-muted-foreground')}>
                              {attr.value}
                            </span>
                          </div>
                        ))}

                        <span className="text-[8px] text-border">·</span>

                        {/* Form */}
                        <span className={cn('text-[9px] font-semibold', formInfo.className)}>{formInfo.text}</span>

                        <span className="text-[8px] text-border">·</span>

                        {/* Morale */}
                        <span className={cn('text-[9px]', moraleInfo.className)}>{moraleInfo.text}</span>

                        {/* Season stats for attackers */}
                        {(p.goals > 0 || p.assists > 0) && (
                          <>
                            <span className="text-[8px] text-border">·</span>
                            <span className="text-[9px] text-muted-foreground">
                              {p.goals > 0 ? `${p.goals}G` : ''}{p.goals > 0 && p.assists > 0 ? ' ' : ''}{p.assists > 0 ? `${p.assists}A` : ''}
                            </span>
                          </>
                        )}

                        <div className="flex-1" />

                        {/* Fitness */}
                        <div className="flex items-center gap-1 shrink-0">
                          <div className="w-10 h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full', p.fitness >= 80 ? 'bg-emerald-500' : p.fitness >= 60 ? 'bg-amber-500' : 'bg-destructive')}
                              style={{ width: `${p.fitness}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-muted-foreground w-7 text-right">{Math.round(p.fitness)}%</span>
                        </div>
                      </div>
                    </button>
                  );
                }); })()}
              </div>

              {/* Collapsible lineup view */}
              <button
                onClick={() => setShowLineup(!showLineup)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-1"
              >
                <ChevronDown className={cn('w-3 h-3 transition-transform', showLineup && 'rotate-180')} />
                {showLineup ? 'Hide' : 'Show'} Current Lineup
              </button>
              {showLineup && (
                <div className="grid grid-cols-2 gap-1 mt-1">
                  {lineup.map((id) => {
                    const p = players[id];
                    if (!p) return null;
                    const isSelected = id === selectedOutId;
                    return (
                      <div
                        key={id}
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px]',
                          isSelected ? 'bg-destructive/15 border border-destructive/30' : 'bg-card/30'
                        )}
                      >
                        <span className="font-bold text-primary">{p.position}</span>
                        <span className="text-foreground truncate">{p.lastName}</span>
                        <span className="text-muted-foreground ml-auto">{p.overall}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* State 3: Confirm swap */}
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
                  <p className="text-xs font-semibold text-foreground truncate">{selectedOutPlayer.lastName}</p>
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
                  <p className="text-xs font-semibold text-foreground truncate">{selectedInPlayer.lastName}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedInPlayer.position}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">FIT {Math.round(selectedInPlayer.fitness)}%</p>
                </div>
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
                    : `⚠ ${selectedInPlayer.position} is not a natural fit for ${selectedOutPlayer.position}`
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
