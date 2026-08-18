/**
 * World Cup mode — group-draw ceremony. Shown once on `startWorldCup`, before
 * the dashboard: the 12 groups are revealed in a stagger with the player's
 * nation (and its whole group) highlighted in gold. The Continue button drops
 * the player onto the World Cup dashboard to begin the tournament.
 */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, ChevronRight } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { getFlag } from '@/utils/nationality';
import { hapticMedium } from '@/utils/haptics';
import { cn } from '@/lib/utils';
import type { InternationalGroup } from '@/types/game';

/** Stable empty fallback. An inline `?? []` allocates a fresh array on every
 *  render, which changed the `myGroupName` memo's dependency every time and
 *  turned the memo into a no-op. */
const NO_GROUPS: InternationalGroup[] = [];

const WorldCupDraw = () => {
  const { tournament, nation, setScreen } = useGameStore(useShallow(s => ({
    tournament: s.internationalTournament,
    nation: s.playerClubId || s.managerNationality,
    setScreen: s.setScreen,
  })));

  const groups = tournament?.groups ?? NO_GROUPS;

  // Which group contains the player's nation — used to badge it.
  const myGroupName = useMemo(
    () => groups.find(g => g.teams.includes(nation))?.name ?? null,
    [groups, nation],
  );

  const goDashboard = () => { hapticMedium(); setScreen('dashboard'); };

  if (groups.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">The draw isn't ready yet.</p>
        <button type="button" onClick={goDashboard} className="mt-4 text-sm text-primary">Continue</button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      {/* Ceremony header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] border bg-primary/10 border-primary/30 text-primary mb-3">
          <Trophy className="w-3 h-3" /> World Cup 2026
        </div>
        <h1 className="text-3xl font-black font-display leading-tight bg-gradient-to-b from-foreground to-amber-300/80 bg-clip-text text-transparent">
          The Draw
        </h1>
        <p className="text-xs text-muted-foreground mt-1.5">
          {groups.length} groups · 48 nations.{' '}
          {myGroupName ? <span className="text-primary font-semibold">You're in {myGroupName}.</span> : 'Your road begins here.'}
        </p>
      </motion.div>

      {/* Group grid — staggered reveal */}
      <div className="grid grid-cols-2 gap-2.5">
        {groups.map((g, gi) => {
          const isMyGroup = g.name === myGroupName;
          return (
            <motion.div
              key={g.name}
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.08 + gi * 0.05, type: 'spring', stiffness: 240, damping: 20 }}
            >
              <GlassPanel className={cn('p-3 h-full', isMyGroup && 'border-primary/50 ring-1 ring-primary/40')}>
                <p className={cn('text-[10px] font-bold uppercase tracking-[0.16em] mb-2', isMyGroup ? 'text-primary' : 'text-muted-foreground')}>
                  {g.name}
                </p>
                <div className="space-y-1.5">
                  {g.teams.map(team => {
                    const isMe = team === nation;
                    return (
                      <div key={team} className={cn('flex items-center gap-1.5', isMe && 'font-bold')}>
                        <span className="text-base leading-none shrink-0">{getFlag(team)}</span>
                        <span className={cn('text-[11px] truncate', isMe ? 'text-primary' : 'text-foreground/85')}>{team}</span>
                      </div>
                    );
                  })}
                </div>
              </GlassPanel>
            </motion.div>
          );
        })}
      </div>

      {/* Continue */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 + groups.length * 0.05 }}>
        <button
          type="button"
          onClick={goDashboard}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-sm tracking-wide active:scale-[0.98] transition-transform bg-gradient-to-b from-amber-400 to-amber-500 text-amber-950 shadow-[0_4px_16px_-4px_rgba(245,178,5,0.45)]"
        >
          Continue to the Tournament <ChevronRight className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );
};

export default WorldCupDraw;
