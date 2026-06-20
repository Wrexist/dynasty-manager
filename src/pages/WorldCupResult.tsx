/**
 * World Cup mode — final result screen. The end of a standalone World Cup run:
 * champion, runners-up, or eliminated in a given round. Shown when the
 * tournament completes (routed from `weekAdvance` in world-cup mode).
 */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Trophy, Medal, Home, RotateCcw } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { FlagIcon } from '@/components/game/FlagIcon';
import { hapticMedium } from '@/utils/haptics';
import { cn } from '@/lib/utils';

const ROUND_NAMES: Record<string, string> = {
  R16: 'Round of 16', QF: 'Quarter-Finals', SF: 'Semi-Finals', F: 'the Final',
};

const WorldCupResult = () => {
  const navigate = useNavigate();
  const { tournament, nat } = useGameStore(useShallow(s => ({
    tournament: s.internationalTournament,
    nat: s.managerNationality,
  })));

  const result = useMemo(() => {
    if (!tournament || !nat) return null;
    const isChampion = tournament.winner === nat;
    const myTies = tournament.knockoutTies.filter(t => t.homeNation === nat || t.awayNation === nat);
    const lastTie = myTies[myTies.length - 1];
    const lostRound = !isChampion && lastTie && lastTie.winnerId && lastTie.winnerId !== nat ? lastTie.round : null;

    let headline: string;
    let tier: 'champion' | 'final' | 'knockout' | 'group';
    if (isChampion) { headline = 'World Champions!'; tier = 'champion'; }
    else if (lostRound === 'F') { headline = 'Runners-Up'; tier = 'final'; }
    else if (lostRound) { headline = `Eliminated in ${ROUND_NAMES[lostRound] ?? 'the knockouts'}`; tier = 'knockout'; }
    else { headline = 'Group Stage Exit'; tier = 'group'; }
    return { isChampion, headline, tier, champion: tournament.winner };
  }, [tournament, nat]);

  if (!result || !nat) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">No tournament result to show.</p>
        <button type="button" onClick={() => navigate('/')} className="mt-4 text-sm text-primary">Back to menu</button>
      </div>
    );
  }

  const isGold = result.tier === 'champion';

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-5 min-h-screen flex flex-col justify-center">
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 22 }}>
        <GlassPanel className="relative overflow-hidden p-7 text-center">
          {isGold && (
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-80"
              style={{ background: 'radial-gradient(120% 90% at 50% 0%, hsl(43 96% 46% / 0.28) 0%, hsl(43 96% 46% / 0.05) 45%, transparent 72%)' }} />
          )}
          <div className="relative">
            <div className={cn(
              'mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.3)]',
              isGold ? 'bg-gradient-to-b from-amber-400/40 to-amber-500/15 text-amber-300' : 'bg-white/[0.06] text-foreground/70',
            )}>
              {isGold ? <Trophy className="w-10 h-10" /> : <Medal className="w-10 h-10" />}
            </div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <FlagIcon nationality={nat} size={24} className="rounded-sm" />
              <span className="text-sm font-semibold text-foreground/80">{nat}</span>
            </div>
            <h1 className={cn('text-3xl font-black font-display leading-tight', isGold ? 'text-amber-300' : 'text-foreground')}>
              {result.headline}
            </h1>
            {!result.isChampion && result.champion && (
              <p className="text-xs text-muted-foreground mt-2">
                {result.champion} lifted the trophy.
              </p>
            )}
            {result.isChampion && (
              <p className="text-xs text-amber-200/70 mt-2">You conquered the world. A tournament for the ages.</p>
            )}
          </div>
        </GlassPanel>
      </motion.div>

      <div className="space-y-2.5">
        <button
          type="button"
          onClick={() => { hapticMedium(); navigate('/'); }}
          className={cn(
            'w-full flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-sm tracking-wide active:scale-[0.98] transition-transform',
            'bg-gradient-to-b from-amber-400 to-amber-500 text-amber-950 shadow-[0_4px_16px_-4px_rgba(245,178,5,0.45)]',
          )}
        >
          <RotateCcw className="w-4 h-4" /> Play Another World Cup
        </button>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-sm text-foreground bg-white/[0.06] border border-white/[0.08] active:scale-[0.98] transition-transform"
        >
          <Home className="w-4 h-4" /> Main Menu
        </button>
      </div>
    </div>
  );
};

export default WorldCupResult;
