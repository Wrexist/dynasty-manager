import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { usePlayerClub } from '@/hooks/useGameSelectors';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PitchView } from '@/components/game/PitchView';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getRatingBadgeClasses } from '@/utils/uiHelpers';
import { hapticMedium } from '@/utils/haptics';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRightLeft, Check, X } from 'lucide-react';

interface SubstitutionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubMade?: () => void;
}

export function SubstitutionSheet({ open, onOpenChange, onSubMade }: SubstitutionSheetProps) {
  const { players, makeMatchSub, matchSubsUsed } = useGameStore();
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

  if (!playerClub) return null;

  const lineup = playerClub.lineup;
  const subs = playerClub.subs;
  const subsRemaining = 3 - matchSubsUsed;

  const selectedOutPlayer = selectedOutId ? players[selectedOutId] : null;
  const selectedInPlayer = selectedInId ? players[selectedInId] : null;

  const highlightIndex = selectedOutId ? lineup.indexOf(selectedOutId) : undefined;

  const handleSlotClick = (index: number) => {
    const playerId = lineup[index];
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

  const lineupLabels = lineup.map(id => {
    const p = players[id];
    return p ? p.lastName.slice(0, 3).toUpperCase() : '';
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-t border-border/50 px-4 pb-8">
        <SheetHeader className="pb-2">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-display">Make Substitution</SheetTitle>
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
              {subsRemaining} remaining
            </span>
          </div>
        </SheetHeader>

        {/* Pitch — tap a player to select them */}
        <div className="max-w-[280px] mx-auto">
          <PitchView
            formation={playerClub.formation}
            homeColor={playerClub.color}
            homeLabels={lineupLabels}
            highlightIndex={highlightIndex}
            onSlotClick={handleSlotClick}
          />
        </div>

        {/* Instruction / Selection state */}
        <AnimatePresence mode="wait">
          {!selectedOutId && (
            <motion.p
              key="instruction"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-muted-foreground text-center mt-2"
            >
              Tap a player on the pitch to substitute them
            </motion.p>
          )}

          {selectedOutId && !selectedInId && selectedOutPlayer && (
            <motion.div
              key="bench"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="mt-3 space-y-2"
            >
              {/* Selected player bar */}
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                <ArrowRightLeft className="w-3.5 h-3.5 text-destructive shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {selectedOutPlayer.firstName[0]}. {selectedOutPlayer.lastName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{selectedOutPlayer.position} · OVR {selectedOutPlayer.overall}</p>
                </div>
                <button onClick={handleCancel} className="text-muted-foreground hover:text-foreground p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Bench list */}
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Select Replacement</p>
              <div className="space-y-1 max-h-[28vh] overflow-y-auto">
                {subs.map(id => {
                  const p = players[id];
                  if (!p) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => handleBenchClick(id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-card/40 border border-border/30 hover:bg-primary/10 hover:border-primary/30 transition-all text-left active:scale-[0.98]"
                    >
                      <div className={cn(
                        'w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0',
                        getRatingBadgeClasses(p.overall)
                      )}>
                        {p.overall}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{p.firstName[0]}. {p.lastName}</p>
                        <p className="text-[10px] text-muted-foreground">{p.position}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1">
                          <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full', p.fitness >= 70 ? 'bg-emerald-500' : p.fitness >= 50 ? 'bg-amber-500' : 'bg-destructive')}
                              style={{ width: `${p.fitness}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-muted-foreground w-7 text-right">{p.fitness}%</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

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
                </div>
              </div>

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
