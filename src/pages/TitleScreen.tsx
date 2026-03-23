import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { getSlotSummaries } from '@/store/slices/orchestrationSlice';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Play, Settings, RotateCcw, Trash2, Save, Info, Swords } from 'lucide-react';
import { getSuffix } from '@/utils/helpers';
import { signalReady } from '@/main';

interface FloatingCircle {
  id: number;
  size: number;
  x: number;
  y: number;
  opacity: number;
  color: string;
  duration: number;
  driftX: number;
  driftY: number;
}

const TitleScreen = () => {
  const navigate = useNavigate();
  const { loadGame, resetGame } = useGameStore();
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Signal to main.tsx that the first screen is mounted (hides splash)
  useEffect(() => { signalReady?.(); }, []);

  // Prefetch the Dashboard chunk while the user reads the title screen
  useEffect(() => {
    const timer = setTimeout(() => {
      import('./Dashboard').catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const slots = useMemo(() => getSlotSummaries(), [refreshKey]);
  const handleContinue = (slot: number) => {
    if (loadGame(slot)) navigate('/game');
  };

  const handleNewGame = (slot: number) => {
    navigate('/select-club', { state: { slot } });
  };

  const handleDelete = (slot: number) => {
    resetGame(slot);
    setConfirmDelete(null);
    setRefreshKey(k => k + 1);
  };

  // Generate floating circle definitions once
  const floatingCircles = useMemo<FloatingCircle[]>(() => [
    { id: 0, size: 280, x: 15, y: 10, opacity: 0.04, color: 'hsl(43 96% 46%)', duration: 22, driftX: 60, driftY: 40 },
    { id: 1, size: 180, x: 75, y: 70, opacity: 0.03, color: 'hsl(215 60% 50%)', duration: 18, driftX: -50, driftY: 35 },
    { id: 2, size: 350, x: 50, y: 40, opacity: 0.025, color: 'hsl(43 96% 46%)', duration: 25, driftX: 45, driftY: -55 },
    { id: 3, size: 120, x: 20, y: 75, opacity: 0.05, color: 'hsl(215 60% 50%)', duration: 16, driftX: -40, driftY: -30 },
    { id: 4, size: 220, x: 80, y: 20, opacity: 0.03, color: 'hsl(43 96% 46%)', duration: 20, driftX: -55, driftY: 50 },
    { id: 5, size: 160, x: 40, y: 85, opacity: 0.04, color: 'hsl(215 60% 50%)', duration: 19, driftX: 35, driftY: -45 },
  ], []);

  const buttonVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.5 + i * 0.1, duration: 0.5, ease: 'easeOut' as const },
    }),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 overflow-hidden relative safe-area-top safe-area-bottom">
      {/* Floating background circles — pure CSS animation for GPU efficiency */}
      {floatingCircles.map((circle) => (
        <div
          key={circle.id}
          className="absolute rounded-full blur-2xl pointer-events-none will-change-transform"
          style={{
            width: circle.size,
            height: circle.size,
            left: `${circle.x}%`,
            top: `${circle.y}%`,
            backgroundColor: circle.color,
            opacity: circle.opacity,
            '--drift-x': `${circle.driftX}px`,
            '--drift-y': `${circle.driftY}px`,
            animation: `floatDrift ${circle.duration}s ease-in-out infinite`,
          } as React.CSSProperties}
        />
      ))}

      {/* Title section */}
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        className="text-center relative z-10"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <img src="/logo.png" alt="Dynasty Manager" className="w-32 h-32 mx-auto mb-6 drop-shadow-[0_0_20px_hsl(var(--primary)/0.4)]" />
        </motion.div>
        <h1 className="text-5xl font-black text-foreground tracking-tight font-display">DYNASTY</h1>
        <p className="text-xl text-primary font-bold tracking-[0.35em] mt-1 font-display">MANAGER</p>
        <p className="text-xs text-muted-foreground mt-3 tracking-wider uppercase">Football Edition</p>
      </motion.div>

      {/* Save Slots */}
      <div className="mt-12 flex flex-col gap-3 w-full max-w-xs relative z-10">
        <motion.p
          custom={0}
          variants={buttonVariants}
          initial="hidden"
          animate="visible"
          className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1"
        >
          Save Slots
        </motion.p>

        {slots.map((slot, idx) => (
          <motion.div key={slot.slot} custom={idx + 1} variants={buttonVariants} initial="hidden" animate="visible">
            {slot.exists ? (
              <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Save className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{slot.clubName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Season {slot.season} — Week {slot.week}
                      {slot.position && ` — ${slot.position}${getSuffix(Number(slot.position))} place`}
                    </p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    className="flex-1 h-9 text-xs font-bold gap-1.5"
                    onClick={() => handleContinue(slot.slot)}
                  >
                    <RotateCcw className="w-3 h-3" /> Continue
                  </Button>
                  {confirmDelete === slot.slot ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="destructive" className="h-9 text-xs px-3" onClick={() => handleDelete(slot.slot)}>
                        Confirm
                      </Button>
                      <Button size="sm" variant="ghost" className="h-9 text-xs px-2" onClick={() => setConfirmDelete(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 px-2 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmDelete(slot.slot)}
                      aria-label={`Delete save slot ${slot.slot}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <Button
                size="lg"
                variant="outline"
                className="w-full h-14 text-base gap-3 border-dashed border-border/50"
                onClick={() => handleNewGame(slot.slot)}
              >
                <Play className="h-4 w-4" /> New Game — Slot {slot.slot}
              </Button>
            )}
          </motion.div>
        ))}

        {/* Challenge Mode button */}
        <motion.div custom={slots.length + 1} variants={buttonVariants} initial="hidden" animate="visible">
          <Button
            size="lg"
            variant="outline"
            className="w-full h-12 gap-3 border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => navigate('/challenge')}
          >
            <Swords className="h-4 w-4" /> Challenge Mode
          </Button>
        </motion.div>

        <motion.div custom={slots.length + 2} variants={buttonVariants} initial="hidden" animate="visible">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="lg" variant="ghost" className="w-full h-12 text-muted-foreground gap-3">
                <Settings className="h-4 w-4" /> Settings
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="bg-background border-border/50 rounded-t-2xl max-h-[60vh]">
              <SheetHeader>
                <SheetTitle className="text-foreground">Settings</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 py-4">
                <div className="bg-card/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Info className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Dynasty Manager</p>
                      <p className="text-xs text-muted-foreground">v0.2 Alpha — Football Edition</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A football management simulation. Pick a club, manage your squad, set tactics,
                    handle transfers, and lead your team to glory across multiple seasons.
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground/50 text-center">
                  Game data is saved locally in your browser.
                </p>
              </div>
            </SheetContent>
          </Sheet>
        </motion.div>
      </div>

      <p className="absolute bottom-6 text-[10px] text-muted-foreground/50 tracking-wider">v0.2 ALPHA</p>
    </div>
  );
};

export default TitleScreen;
