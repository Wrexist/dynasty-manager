/**
 * ScoreHeader — extracted from `pages/MatchDay.tsx`.
 *
 * Header strip showing the match score, club crests, card counts, the
 * live xG split, and an in-progress timer bar. Pure presentational —
 * the page owns all timer / phase / event state and passes it down.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ClubCrest } from '@/components/game/ClubCrest';
import { SPRING_SNAPPY } from '@/config/motion';
import { YellowCardIcon, RedCardIcon } from '@/components/game/PlayerAvatar';
import { PremiumProgress } from '@/components/game/PremiumProgress';
import { getFlag } from '@/utils/nationality';
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
  /** World Cup mode: the "clubs" are nations — show each nation's flag as the
   *  crest instead of a flat colour roundel. */
  worldCup?: boolean;
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
  worldCup,
}: ScoreHeaderProps) {
  // Team identity crest: in World Cup mode a bare nation flag (no roundel); in
  // club matches the colour roundel with its short code.
  const Crest = ({ club }: { club: Club }) =>
    worldCup ? (
      <div className="mx-auto mb-1 text-center text-[44px] leading-none drop-shadow">{getFlag(club.id)}</div>
    ) : (
      <ClubCrest club={club} size="lg" className="mx-auto mb-1" />
    );
  // Card counts (+ "men" when reduced) as a compact column placed on the OUTER
  // edge of each side, so the crest–score–crest stays perfectly symmetric.
  const Cards = ({ yellow, red, men }: { yellow: number; red: number; men: number }) => {
    if (yellow <= 0 && red <= 0) return null;
    return (
      <div className="flex flex-col items-center gap-1 text-micro font-semibold">
        {yellow > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/15 px-1.5 py-0.5 text-amber-300">
            <YellowCardIcon size={10} /> {yellow}
          </span>
        )}
        {red > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-400/50 bg-red-500/20 px-1.5 py-0.5 text-red-300 animate-pulse">
            <RedCardIcon size={10} /> {red}
          </span>
        )}
        {red > 0 && men > 0 && (
          <span className="text-micro font-bold uppercase tracking-wide text-red-300">{men} men</span>
        )}
      </div>
    );
  };
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
    <GlassPanel className={cn('p-5 transition-all duration-300', goalFlash && 'border-primary/60 shadow-glow-primary')}>
      <p className="text-micro text-muted-foreground uppercase tracking-wider text-center mb-3 tabular-nums">{headerLabel}</p>
      <div className="flex items-center justify-center gap-4">
        {/* Home cards — outer-left, equal flex width keeps the centre symmetric */}
        <div className="flex-1 flex justify-end">
          <Cards yellow={homeYellowCards} red={homeRedCards} men={homePlayersOnPitch} />
        </div>
        <div className="text-center">
          <Crest club={homeClub} />
          <p className="text-caption font-bold text-foreground">{homeClub.shortName}</p>
        </div>
        <div className="text-center" aria-live="polite" aria-atomic="true" role="status">
          <p className="text-4xl font-black text-foreground tabular-nums font-display flex items-center justify-center gap-1">
            {/* Each digit gets its own fixed-width cell. `popLayout` used to
                let the outgoing digit collapse the flex row, so the whole
                scoreline slid sideways at the exact moment a goal went in —
                the highest-drama frame in the game. `w-[1ch]` pins it.
                The goal flash animates back to `--foreground`, NOT a raw
                `hsl(0,0%,95%)`: that literal left the score a permanently
                different white from every label around it after the first
                goal, because `--foreground` is `220 15% 90%`. */}
            <span className="inline-block w-[1ch] text-center">
              <AnimatePresence mode="popLayout">
                <motion.span
                  className="inline-block"
                  key={phase === 'half_time' ? `ht-h-${htHomeGoals}` : `h-${homeGoals}`}
                  initial={{ scale: 1.4, color: 'hsl(var(--primary))' }}
                  animate={{ scale: 1, color: 'hsl(var(--foreground))' }}
                  transition={SPRING_SNAPPY}
                >
                  {phase === 'half_time' ? htHomeGoals : homeGoals}
                </motion.span>
              </AnimatePresence>
            </span>
            <span aria-hidden>-</span>
            <span className="inline-block w-[1ch] text-center">
              <AnimatePresence mode="popLayout">
                <motion.span
                  className="inline-block"
                  key={phase === 'half_time' ? `ht-a-${htAwayGoals}` : `a-${awayGoals}`}
                  initial={{ scale: 1.4, color: 'hsl(var(--primary))' }}
                  animate={{ scale: 1, color: 'hsl(var(--foreground))' }}
                  transition={SPRING_SNAPPY}
                >
                  {phase === 'half_time' ? htAwayGoals : awayGoals}
                </motion.span>
              </AnimatePresence>
            </span>
          </p>
        </div>
        <div className="text-center">
          <Crest club={awayClub} />
          <p className="text-caption font-bold text-foreground">{awayClub.shortName}</p>
        </div>
        {/* Away cards — outer-right */}
        <div className="flex-1 flex justify-start">
          <Cards yellow={awayYellowCards} red={awayRedCards} men={awayPlayersOnPitch} />
        </div>
      </div>

      {/* Live xG Tracker */}
      {showLiveXG && (
        <div className="flex justify-between mt-2 text-micro text-muted-foreground/70 tabular-nums">
          <span>xG: {liveHomeXG.toFixed(2)}</span>
          <span>xG: {liveAwayXG.toFixed(2)}</span>
        </div>
      )}

      {showProgressBar && (
        <div className="mt-2">
          <PremiumProgress
            size="sm"
            glow
            animate={false}
            value={(currentMin / (phase === 'extra_time' ? 120 : 90)) * 100}
          />
        </div>
      )}
    </GlassPanel>
  );
}
