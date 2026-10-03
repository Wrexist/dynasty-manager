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
  /** One-row scoreboard for live play with the pitch on screen: the pitch is
   *  the picture, so the score stops costing ~200px above it. */
  compact?: boolean;
}

/** One score digit in a fixed-width cell. `popLayout` used to let the outgoing
 *  digit collapse the flex row, so the whole scoreline slid sideways at the
 *  exact moment a goal went in — the highest-drama frame in the game.
 *  `w-[1ch]` pins it. The goal flash animates back to `--foreground`, NOT a
 *  raw `hsl(0,0%,95%)`: that literal left the score a permanently different
 *  white from every label around it after the first goal, because
 *  `--foreground` is `220 15% 90%`. */
function ScoreDigit({ value, motionKey }: { value: number; motionKey: string }) {
  return (
    <span className="inline-block w-[1ch] text-center">
      <AnimatePresence mode="popLayout">
        <motion.span
          className="inline-block"
          key={motionKey}
          initial={{ scale: 1.4, color: 'hsl(var(--primary))' }}
          animate={{ scale: 1, color: 'hsl(var(--foreground))' }}
          transition={SPRING_SNAPPY}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
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
  compact = false,
}: ScoreHeaderProps) {
  // Team identity crest: in World Cup mode a bare nation flag (no roundel); in
  // club matches the colour roundel with its short code.
  // Render functions, not components: a component defined in render has a new
  // identity every render, so every clock tick remounted the crests.
  const crest = (club: Club) =>
    worldCup ? (
      <div className="mx-auto mb-1 text-center text-[44px] leading-none drop-shadow">{getFlag(club.id)}</div>
    ) : (
      <ClubCrest club={club} size="lg" className="mx-auto mb-1" />
    );
  // Card counts (+ "men" when reduced) as a compact column placed on the OUTER
  // edge of each side, so the crest–score–crest stays perfectly symmetric.
  const cards = (yellow: number, red: number, men: number) => {
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

  const isHt = phase === 'half_time';
  const homeDigit = <ScoreDigit value={isHt ? htHomeGoals : homeGoals} motionKey={isHt ? `ht-h-${htHomeGoals}` : `h-${homeGoals}`} />;
  const awayDigit = <ScoreDigit value={isHt ? htAwayGoals : awayGoals} motionKey={isHt ? `ht-a-${htAwayGoals}` : `a-${awayGoals}`} />;
  const progress = (currentMin / (phase === 'extra_time' ? 120 : 90)) * 100;

  if (compact) {
    const smallCrest = (club: Club) =>
      worldCup ? <span className="text-2xl leading-none" aria-hidden>{getFlag(club.id)}</span> : <ClubCrest club={club} size="sm" />;
    // Cards inline beside the team name; a reduced side shows its head count.
    const miniCards = (yellow: number, red: number, men: number) => (
      <>
        {yellow > 0 && <span className="inline-flex items-center gap-0.5 text-micro font-semibold text-amber-300"><YellowCardIcon size={9} />{yellow}</span>}
        {red > 0 && <span className="inline-flex items-center gap-0.5 text-micro font-semibold text-red-300"><RedCardIcon size={9} />{men > 0 ? `${men}` : red}</span>}
      </>
    );
    return (
      <GlassPanel className={cn('px-3 py-2 transition-all duration-300', goalFlash && 'border-primary/60 shadow-glow-primary')}>
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
            {miniCards(homeYellowCards, homeRedCards, homePlayersOnPitch)}
            <span className="truncate text-caption font-bold text-foreground">{homeClub.shortName}</span>
            {smallCrest(homeClub)}
          </div>
          <div className="shrink-0 px-1 text-center" aria-live="polite" aria-atomic="true" role="status">
            <p className="flex items-center justify-center gap-0.5 font-display text-2xl font-black leading-none tabular-nums text-foreground">
              {homeDigit}
              <span aria-hidden>-</span>
              {awayDigit}
            </p>
            <p className="mt-0.5 text-micro font-semibold uppercase tracking-wider text-primary tabular-nums">{headerLabel}</p>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {smallCrest(awayClub)}
            <span className="truncate text-caption font-bold text-foreground">{awayClub.shortName}</span>
            {miniCards(awayYellowCards, awayRedCards, awayPlayersOnPitch)}
          </div>
        </div>
        {showProgressBar && (
          <div className="mt-1.5 flex items-center gap-2 text-micro tabular-nums text-muted-foreground/70">
            {showLiveXG && <span aria-label={`${homeClub.shortName} expected goals ${liveHomeXG.toFixed(2)}`}>xG {liveHomeXG.toFixed(2)}</span>}
            <PremiumProgress size="sm" glow animate={false} value={progress} className="flex-1" />
            {showLiveXG && <span aria-label={`${awayClub.shortName} expected goals ${liveAwayXG.toFixed(2)}`}>{liveAwayXG.toFixed(2)}</span>}
          </div>
        )}
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className={cn('p-5 transition-all duration-300', goalFlash && 'border-primary/60 shadow-glow-primary')}>
      <p className="text-micro text-muted-foreground uppercase tracking-wider text-center mb-3 tabular-nums">{headerLabel}</p>
      <div className="flex items-center justify-center gap-4">
        {/* Home cards — outer-left, equal flex width keeps the centre symmetric */}
        <div className="flex-1 flex justify-end">
          {cards(homeYellowCards, homeRedCards, homePlayersOnPitch)}
        </div>
        <div className="text-center">
          {crest(homeClub)}
          <p className="text-caption font-bold text-foreground">{homeClub.shortName}</p>
        </div>
        <div className="text-center" aria-live="polite" aria-atomic="true" role="status">
          <p className="text-4xl font-black text-foreground tabular-nums font-display flex items-center justify-center gap-1">
            {homeDigit}
            <span aria-hidden>-</span>
            {awayDigit}
          </p>
        </div>
        <div className="text-center">
          {crest(awayClub)}
          <p className="text-caption font-bold text-foreground">{awayClub.shortName}</p>
        </div>
        {/* Away cards — outer-right */}
        <div className="flex-1 flex justify-start">
          {cards(awayYellowCards, awayRedCards, awayPlayersOnPitch)}
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
            value={progress}
          />
        </div>
      )}
    </GlassPanel>
  );
}
