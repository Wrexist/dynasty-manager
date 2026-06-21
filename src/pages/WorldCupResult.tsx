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
import { getFlag } from '@/utils/nationality';
import { hapticMedium } from '@/utils/haptics';
import { cn } from '@/lib/utils';

const ROUND_NAMES: Record<string, string> = {
  R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-Finals', SF: 'Semi-Finals', F: 'the Final',
};

const WorldCupResult = () => {
  const navigate = useNavigate();
  const { tournament, nat, nationalTeam, players } = useGameStore(useShallow(s => ({
    tournament: s.internationalTournament,
    nat: s.managerNationality,
    nationalTeam: s.nationalTeam,
    players: s.players,
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

  // Tournament run summary — record, goals, top scorer — for parity with the
  // club season-summary card.
  const run = useMemo(() => {
    const results = nationalTeam?.results ?? [];
    if (results.length === 0) return null;
    let won = 0, drawn = 0, lost = 0, gf = 0, ga = 0;
    for (const r of results) {
      gf += r.goalsFor; ga += r.goalsAgainst;
      if (r.goalsFor > r.goalsAgainst) won++;
      else if (r.goalsFor < r.goalsAgainst) lost++;
      else drawn++;
    }
    // Top scorer from this tournament's per-player goals.
    const goalsBy = nationalTeam?.internationalGoals ?? {};
    let topId: string | null = null;
    for (const [id, g] of Object.entries(goalsBy)) {
      if (!topId || g > (goalsBy[topId] ?? 0)) topId = id;
    }
    const topScorer = topId && players[topId] && (goalsBy[topId] ?? 0) > 0
      ? { name: players[topId].lastName || players[topId].firstName, goals: goalsBy[topId] }
      : null;
    return { played: results.length, won, drawn, lost, gf, ga, topScorer };
  }, [nationalTeam, players]);

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
              <span className="text-xl leading-none shrink-0">{getFlag(nat)}</span>
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

      {/* Run summary — your road through the tournament */}
      {run && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <GlassPanel className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.18em] font-bold mb-3">Your Road</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xl font-black font-display text-foreground tabular-nums">{run.played}</p>
                <p className="text-[10px] text-muted-foreground">Played</p>
              </div>
              <div>
                <p className="text-xl font-black font-display text-foreground tabular-nums">
                  <span className="text-emerald-400">{run.won}</span>
                  <span className="text-muted-foreground/50 text-base">·</span>
                  <span className="text-muted-foreground">{run.drawn}</span>
                  <span className="text-muted-foreground/50 text-base">·</span>
                  <span className="text-destructive">{run.lost}</span>
                </p>
                <p className="text-[10px] text-muted-foreground">W · D · L</p>
              </div>
              <div>
                <p className="text-xl font-black font-display text-foreground tabular-nums">{run.gf}<span className="text-muted-foreground/50 text-base">:</span>{run.ga}</p>
                <p className="text-[10px] text-muted-foreground">Goals</p>
              </div>
            </div>
            {run.topScorer && (
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Top scorer</span>
                <span className="text-xs font-bold text-foreground">{run.topScorer.name} · {run.topScorer.goals} {run.topScorer.goals === 1 ? 'goal' : 'goals'}</span>
              </div>
            )}
          </GlassPanel>
        </motion.div>
      )}

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
