/**
 * ScoreHeader — extracted from `pages/MatchDay.tsx`.
 *
 * Header strip showing the match score, club crests, card counts, the
 * live xG split, and an in-progress timer bar. Pure presentational —
 * the page owns all timer / phase / event state and passes it down.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/game/GlassPanel';
import { YellowCardIcon, RedCardIcon } from '@/components/game/PlayerAvatar';
import { cn } from '@/lib/utils';
import type { Club } from '@/types/game';

type MatchPhase = 'pre' | 'first_half' | 'half_time' | 'second_half' | 'extra_time' | 'extra_time_break' | 'penalties' | 'full_time';

interface ScoreHeaderProps {
  phase: MatchPhase | string;
  week: number;
  currentMin: number;
  isLive: boolean;
  isCupMatch: boolean;
  homeClub: Club;
  awayClub: Club;
  homeGoals: number;
  awayGoals: number;
  htHomeGoals: number;
  htAwayGoals: number;
  homeYellowCards: number;
  homeRedCards: number;
  awayYellowCards: number;
  awayRedCards: number;
  homePlayersOnPitch: number;
  awayPlayersOnPitch: number;
  liveHomeXG: number;
  liveAwayXG: number;
  goalFlash: boolean;
}

export function ScoreHeader({
  phase,
  week,
  currentMin,
  isLive,
  isCupMatch,
  homeClub,
  awayClub,
  homeGoals,
  awayGoals,
  htHomeGoals,
  htAwayGoals,
  homeYellowCards,
  homeRedCards,
  awayYellowCards,
  awayRedCards,
  homePlayersOnPitch,
  awayPlayersOnPitch,
  liveHomeXG,
  liveAwayXG,
  goalFlash,
}: ScoreHeaderProps) {
  const showLiveXG = (isLive || phase === 'half_time' || phase === 'extra_time_break') && (liveHomeXG > 0 || liveAwayXG > 0);
  const showProgressBar = isLive || phase === 'half_time' || phase === 'extra_time_break';
  const headerLabel =
    phase === 'pre' ? `Week ${week}${isCupMatch ? ' — Cup' : ''}`
    : phase === 'half_time' ? 'Half Time'
    : phase === 'extra_time_break' ? 'Extra Time'
    : phase === 'penalties' ? 'Penalties'
    : isLive ? `${currentMin}'`
    : 'Full Time';

  return (
    <GlassPanel className={cn('p-5 transition-all duration-300', goalFlash && 'border-primary/60 shadow-[0_0_20px_hsl(var(--primary)/0.3)]')}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider text-center mb-3">{headerLabel}</p>
      <div className="flex items-center justify-center gap-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-bold" style={{ backgroundColor: homeClub.color, color: homeClub.secondaryColor }}>{homeClub.shortName}</div>
          <p className="text-xs font-bold text-foreground">{homeClub.shortName}</p>
          {(homeYellowCards > 0 || homeRedCards > 0) && (
            <div className="mt-1 flex items-center justify-center gap-1 text-[9px] font-semibold">
              {homeYellowCards > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/15 px-1.5 py-0.5 text-amber-300">
                  <YellowCardIcon size={10} /> {homeYellowCards}
                </span>
              )}
              {homeRedCards > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-400/50 bg-red-500/20 px-1.5 py-0.5 text-red-300 animate-pulse">
                  <RedCardIcon size={10} /> {homeRedCards}
                </span>
              )}
            </div>
          )}
          {homeRedCards > 0 && (
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-red-300">{homePlayersOnPitch} men</p>
          )}
        </div>
        <div className="text-center" aria-live="polite" aria-atomic="true" role="status">
          <p className="text-4xl font-black text-foreground tabular-nums font-display flex items-center justify-center gap-1">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={phase === 'half_time' ? `ht-h-${htHomeGoals}` : `h-${homeGoals}`}
                initial={{ scale: 1.4, color: 'hsl(160, 84%, 39%)' }}
                animate={{ scale: 1, color: 'hsl(0, 0%, 95%)' }}
                transition={{ duration: 0.4, type: 'spring', stiffness: 300 }}
              >
                {phase === 'half_time' ? htHomeGoals : homeGoals}
              </motion.span>
            </AnimatePresence>
            <span>-</span>
            <AnimatePresence mode="popLayout">
              <motion.span
                key={phase === 'half_time' ? `ht-a-${htAwayGoals}` : `a-${awayGoals}`}
                initial={{ scale: 1.4, color: 'hsl(160, 84%, 39%)' }}
                animate={{ scale: 1, color: 'hsl(0, 0%, 95%)' }}
                transition={{ duration: 0.4, type: 'spring', stiffness: 300 }}
              >
                {phase === 'half_time' ? htAwayGoals : awayGoals}
              </motion.span>
            </AnimatePresence>
          </p>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-bold" style={{ backgroundColor: awayClub.color, color: awayClub.secondaryColor }}>{awayClub.shortName}</div>
          <p className="text-xs font-bold text-foreground">{awayClub.shortName}</p>
          {(awayYellowCards > 0 || awayRedCards > 0) && (
            <div className="mt-1 flex items-center justify-center gap-1 text-[9px] font-semibold">
              {awayYellowCards > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/15 px-1.5 py-0.5 text-amber-300">
                  <YellowCardIcon size={10} /> {awayYellowCards}
                </span>
              )}
              {awayRedCards > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-400/50 bg-red-500/20 px-1.5 py-0.5 text-red-300 animate-pulse">
                  <RedCardIcon size={10} /> {awayRedCards}
                </span>
              )}
            </div>
          )}
          {awayRedCards > 0 && (
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-red-300">{awayPlayersOnPitch} men</p>
          )}
        </div>
      </div>

      {/* Live xG Tracker */}
      {showLiveXG && (
        <div className="flex justify-between mt-2 text-[9px] text-muted-foreground/70 tabular-nums">
          <span>xG: {liveHomeXG.toFixed(2)}</span>
          <span>xG: {liveAwayXG.toFixed(2)}</span>
        </div>
      )}

      {showProgressBar && (
        <div className="mt-2">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${(currentMin / (phase === 'extra_time' ? 120 : 90)) * 100}%` }} />
          </div>
        </div>
      )}
    </GlassPanel>
  );
}
