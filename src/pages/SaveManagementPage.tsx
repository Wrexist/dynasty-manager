import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Trash2, Play, Plus, ChevronLeft, Trophy, Calendar, Users, AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSlotSummaries, removeSaveSlot } from '@/store/helpers/persistence';
import type { SlotSummary } from '@/types/game';
import { successToast, errorToast, infoToast } from '@/utils/gameToast';
import { hapticLight, hapticMedium, hapticHeavy } from '@/utils/haptics';

const SLOT_COUNT = 3;

export function SaveManagementPage() {
  const { activeSlot, gameStarted, playerClubId, clubs, season, week } = useGameStore(s => ({
    activeSlot: s.activeSlot,
    gameStarted: s.gameStarted,
    playerClubId: s.playerClubId,
    clubs: s.clubs,
    season: s.season,
    week: s.week,
  }));
  const setScreen = useGameStore(s => s.setScreen);
  const saveGame = useGameStore(s => s.saveGame);
  const loadGame = useGameStore(s => s.loadGame);
  const resetGame = useGameStore(s => s.resetGame);

  const [summaries, setSummaries] = useState<SlotSummary[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [confirmNewGame, setConfirmNewGame] = useState<number | null>(null);
  const [justSaved, setJustSaved] = useState<number | null>(null);

  const refresh = () => setSummaries(getSlotSummaries());
  useEffect(() => { refresh(); }, []);

  const handleSaveToSlot = (slot: number) => {
    hapticMedium();
    saveGame(slot);
    setJustSaved(slot);
    refresh();
    setTimeout(() => setJustSaved(null), 2000);
    successToast('Game Saved', `Saved to slot ${slot}`);
  };

  const handleLoad = (slot: number) => {
    hapticLight();
    const ok = loadGame(slot);
    if (ok) {
      successToast('Game Loaded', `Slot ${slot} loaded`);
      setScreen('dashboard');
    } else {
      errorToast('Load Failed', 'Could not read save data');
    }
  };

  const handleDelete = (slot: number) => {
    hapticHeavy();
    removeSaveSlot(slot);
    if (activeSlot === slot) resetGame(slot);
    refresh();
    setConfirmDelete(null);
    infoToast('Save Deleted', `Slot ${slot} cleared`);
  };

  const handleNewGame = (slot: number) => {
    hapticMedium();
    resetGame(slot);
    saveGame(slot);
    refresh();
    setConfirmNewGame(null);
    setScreen('dashboard');
  };

  const currentClub = clubs[playerClubId];

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setScreen('settings')}
          className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center hover:bg-muted/50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-display font-bold text-foreground">Save Management</h1>
          <p className="text-xs text-muted-foreground">3 save slots available</p>
        </div>
      </div>

      {/* Current game save shortcut */}
      {gameStarted && currentClub && (
        <GlassPanel className="p-4 border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">Current Game — Slot {activeSlot}</p>
              <p className="text-sm font-bold text-foreground">{currentClub.name}</p>
              <p className="text-xs text-muted-foreground">Season {season} · Week {week}</p>
            </div>
            <Button
              size="sm"
              onClick={() => handleSaveToSlot(activeSlot)}
              className={cn(
                'gap-2 transition-all',
                justSaved === activeSlot ? 'bg-emerald-600 text-white' : ''
              )}
            >
              {justSaved === activeSlot ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {justSaved === activeSlot ? 'Saved!' : 'Save'}
            </Button>
          </div>
        </GlassPanel>
      )}

      {/* Slot list */}
      <div className="space-y-3">
        {Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).map(slot => {
          const summary = summaries.find(s => s.slot === slot);
          const isCurrent = slot === activeSlot && gameStarted;
          const isEmpty = !summary?.exists;

          return (
            <motion.div
              key={slot}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (slot - 1) * 0.06 }}
            >
              <GlassPanel className={cn(
                'p-4',
                isCurrent && 'border-primary/30',
              )}>
                {/* Slot header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                      isCurrent ? 'bg-primary/20 text-primary' : 'bg-muted/50 text-muted-foreground'
                    )}>
                      {slot}
                    </div>
                    <p className={cn('text-sm font-semibold', isCurrent ? 'text-primary' : 'text-foreground')}>
                      Slot {slot} {isCurrent && <span className="text-[10px] ml-1 text-primary/70">(active)</span>}
                    </p>
                  </div>
                  {!isEmpty && (
                    <span className="text-[10px] text-muted-foreground/60">
                      {summary.gameMode === 'career' ? 'Career' : 'Sandbox'}
                    </span>
                  )}
                </div>

                {/* Save content */}
                {isEmpty ? (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-xs text-muted-foreground/60">Empty slot</p>
                    {gameStarted && !isCurrent && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-2"
                        onClick={() => handleSaveToSlot(slot)}
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save current game here
                      </Button>
                    )}
                    {(!gameStarted || isCurrent) && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-2"
                        onClick={() => setScreen('dashboard')}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Start a new career
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Save info */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-muted/20 rounded-lg p-2 text-center">
                        <Trophy className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
                        <p className="text-[11px] font-semibold text-foreground truncate">{summary.clubName || '?'}</p>
                        <p className="text-[9px] text-muted-foreground">Club</p>
                      </div>
                      <div className="bg-muted/20 rounded-lg p-2 text-center">
                        <Calendar className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
                        <p className="text-[11px] font-semibold text-foreground">S{summary.season ?? '?'}</p>
                        <p className="text-[9px] text-muted-foreground">Season</p>
                      </div>
                      <div className="bg-muted/20 rounded-lg p-2 text-center">
                        <Users className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
                        <p className="text-[11px] font-semibold text-foreground">{summary.position ?? '?'}{summary.position ? 'th' : ''}</p>
                        <p className="text-[9px] text-muted-foreground">Position</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {!isCurrent && (
                        <Button
                          size="sm"
                          className="flex-1 gap-1.5"
                          onClick={() => handleLoad(slot)}
                        >
                          <Play className="w-3.5 h-3.5" />
                          Load
                        </Button>
                      )}
                      {isCurrent && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className={cn('flex-1 gap-1.5', justSaved === slot ? 'bg-emerald-600/20 text-emerald-400' : '')}
                          onClick={() => handleSaveToSlot(slot)}
                        >
                          {justSaved === slot ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                          {justSaved === slot ? 'Saved!' : 'Save'}
                        </Button>
                      )}
                      {!isCurrent && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-1.5"
                          onClick={() => handleSaveToSlot(slot)}
                        >
                          <Save className="w-3.5 h-3.5" />
                          Overwrite
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmDelete(slot)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* New game in slot (for non-current slots) */}
                    {!isCurrent && (
                      <button
                        className="w-full text-[11px] text-muted-foreground/50 hover:text-muted-foreground text-center py-1 transition-colors"
                        onClick={() => setConfirmNewGame(slot)}
                      >
                        Start fresh in this slot
                      </button>
                    )}
                  </div>
                )}
              </GlassPanel>
            </motion.div>
          );
        })}
      </div>

      {/* Delete confirmation */}
      <AnimatePresence>
        {confirmDelete !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-8 safe-area-bottom"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-card border border-border/50 rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Delete Slot {confirmDelete}?</p>
                  <p className="text-xs text-muted-foreground">This cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                <Button variant="destructive" className="flex-1" onClick={() => handleDelete(confirmDelete!)}>Delete</Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {confirmNewGame !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-8 safe-area-bottom"
            onClick={() => setConfirmNewGame(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-card border border-border/50 rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">New Game in Slot {confirmNewGame}?</p>
                  <p className="text-xs text-muted-foreground">Existing save in this slot will be replaced.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setConfirmNewGame(null)}>Cancel</Button>
                <Button className="flex-1" onClick={() => handleNewGame(confirmNewGame!)}>Start Fresh</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
