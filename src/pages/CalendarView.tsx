import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ArrowLeft, Calendar, Trophy, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRoundName } from '@/data/cup';
import { getDerbyIntensity } from '@/data/league';
import { SUMMER_WINDOW_END, WINTER_WINDOW_START, WINTER_WINDOW_END } from '@/config/transfers';
import type { CupRound } from '@/types/game';

const CalendarView = () => {
  const { week, season, fixtures, clubs, playerClubId, setScreen, transferWindowOpen, cup } = useGameStore();

  const playerFixtures = fixtures
    .filter(m => m.homeClubId === playerClubId || m.awayClubId === playerClubId)
    .sort((a, b) => a.week - b.week);

  // Cup ties involving the player
  const playerCupTies = (cup?.ties || [])
    .filter(t => t.homeClubId === playerClubId || t.awayClubId === playerClubId)
    .sort((a, b) => a.week - b.week);

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <button onClick={() => setScreen('dashboard')} className="flex items-center gap-1 text-muted-foreground text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground font-display">Season {season} Schedule</h2>
      </div>

      {/* Transfer window indicator */}
      <GlassPanel className="p-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Transfer Window</span>
        <span className={cn('text-xs font-bold px-2 py-0.5 rounded', transferWindowOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-destructive/20 text-destructive')}>
          {transferWindowOpen ? 'Open' : 'Closed'}
        </span>
      </GlassPanel>

      <GlassPanel className="p-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Window Periods</p>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span className="bg-muted/50 px-2 py-1 rounded">Summer: Wk 1-{SUMMER_WINDOW_END}</span>
          <span className="bg-muted/50 px-2 py-1 rounded">Winter: Wk {WINTER_WINDOW_START}-{WINTER_WINDOW_END}</span>
        </div>
      </GlassPanel>

      {/* Fixture list */}
      <div className="space-y-1.5">
        {playerFixtures.map(match => {
          const isHome = match.homeClubId === playerClubId;
          const opp = clubs[isHome ? match.awayClubId : match.homeClubId];
          const isCurrent = match.week === week && !match.played;
          const isPast = match.played;
          const isDerby = getDerbyIntensity(match.homeClubId, match.awayClubId) > 0;

          let result = '';
          let resultColor = '';
          if (isPast) {
            const pGoals = isHome ? match.homeGoals : match.awayGoals;
            const oGoals = isHome ? match.awayGoals : match.homeGoals;
            result = `${pGoals}-${oGoals}`;
            resultColor = pGoals > oGoals ? 'text-emerald-400' : pGoals < oGoals ? 'text-destructive' : 'text-muted-foreground';
          }

          return (
            <div
              key={match.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                isCurrent ? 'bg-primary/10 border border-primary/30' : 'bg-card/40',
                isPast && 'opacity-60',
                isDerby && !isCurrent && 'border-l-2 border-l-amber-500/70'
              )}
            >
              <span className={cn('text-xs font-mono w-10 shrink-0', isCurrent ? 'text-primary font-bold' : 'text-muted-foreground')}>
                W{match.week}
              </span>
              <span className="text-[10px] text-muted-foreground w-6 shrink-0">
                {isHome ? 'H' : 'A'}
              </span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: opp?.color }} />
                <span className={cn('text-sm truncate', isCurrent ? 'text-foreground font-bold' : 'text-foreground/80')}>
                  {opp?.shortName || '?'}
                </span>
                {isDerby && <Flame className="w-3 h-3 text-amber-500 shrink-0" />}
              </div>
              {isPast ? (
                <span className={cn('text-sm font-mono font-bold', resultColor)}>{result}</span>
              ) : isCurrent ? (
                <span className="text-xs text-primary font-bold">NEXT</span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Cup Ties */}
      {playerCupTies.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-2">
            <Trophy className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground font-display">Dynasty Cup</h3>
          </div>
          <div className="space-y-1.5">
            {playerCupTies.map(tie => {
              const isHome = tie.homeClubId === playerClubId;
              const opp = clubs[isHome ? tie.awayClubId : tie.homeClubId];
              const isCurrent = tie.week === week && !tie.played;
              const isPast = tie.played;
              let result = '';
              let resultColor = '';
              if (isPast) {
                const pGoals = isHome ? tie.homeGoals : tie.awayGoals;
                const oGoals = isHome ? tie.awayGoals : tie.homeGoals;
                result = `${pGoals}-${oGoals}`;
                resultColor = pGoals > oGoals ? 'text-emerald-400' : pGoals < oGoals ? 'text-destructive' : 'text-muted-foreground';
              }
              return (
                <div
                  key={tie.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                    isCurrent ? 'bg-primary/10 border border-primary/30' : 'bg-card/40',
                    isPast && 'opacity-70'
                  )}
                >
                  <span className={cn('text-xs font-mono w-10 shrink-0', isCurrent ? 'text-primary font-bold' : 'text-muted-foreground')}>
                    W{tie.week}
                  </span>
                  <span className="text-[10px] text-primary/70 w-6 shrink-0">
                    {getRoundName(tie.round as CupRound).slice(0, 2)}
                  </span>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: opp?.color }} />
                    <span className={cn('text-sm truncate', isCurrent ? 'text-foreground font-bold' : 'text-foreground/80')}>
                      {opp?.shortName || '?'}
                    </span>
                  </div>
                  {isPast ? (
                    <span className={cn('text-sm font-mono font-bold', resultColor)}>{result}</span>
                  ) : isCurrent ? (
                    <span className="text-xs text-primary font-bold">CUP</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default CalendarView;
