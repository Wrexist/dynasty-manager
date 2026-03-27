import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ArrowLeft, Calendar, Trophy, Flame, Globe, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRoundName } from '@/data/cup';
import { getDerbyIntensity } from '@/data/league';
import { SUMMER_WINDOW_END, WINTER_WINDOW_START, WINTER_WINDOW_END } from '@/config/transfers';
import { getKnockoutRoundName } from '@/utils/continental';
import type { CupRound } from '@/types/game';

const CalendarView = () => {
  const { week, season, fixtures, clubs, playerClubId, setScreen, transferWindowOpen, cup, leagueCup, championsCup, shieldCup, virtualClubs, domesticSuperCup, continentalSuperCup } = useGameStore();

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

      {/* League Cup Ties */}
      {(() => {
        const lcTies = (leagueCup?.ties || [])
          .filter(t => t.homeClubId === playerClubId || t.awayClubId === playerClubId)
          .sort((a, b) => a.week - b.week);
        if (lcTies.length === 0) return null;
        return (
          <>
            <div className="flex items-center gap-2 pt-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-foreground font-display">League Cup</h3>
            </div>
            <div className="space-y-1.5">
              {lcTies.map(tie => {
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
                      isCurrent ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-card/40',
                      isPast && 'opacity-70'
                    )}
                  >
                    <span className={cn('text-xs font-mono w-10 shrink-0', isCurrent ? 'text-emerald-400 font-bold' : 'text-muted-foreground')}>
                      W{tie.week}
                    </span>
                    <span className="text-[10px] text-emerald-400/70 w-6 shrink-0">
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
                      <span className="text-xs text-emerald-400 font-bold">LC</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}

      {/* Super Cup Matches */}
      {(() => {
        const superCups = [domesticSuperCup, continentalSuperCup].filter(Boolean);
        const playerSuperCups = superCups.filter(sc => sc && (sc.homeClubId === playerClubId || sc.awayClubId === playerClubId));
        if (playerSuperCups.length === 0) return null;
        return (
          <>
            <div className="flex items-center gap-2 pt-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-foreground font-display">Super Cup</h3>
            </div>
            <div className="space-y-1.5">
              {playerSuperCups.map((sc, i) => {
                if (!sc) return null;
                const isHome = sc.homeClubId === playerClubId;
                const oppId = isHome ? sc.awayClubId : sc.homeClubId;
                const opp = clubs[oppId] || virtualClubs[oppId];
                const isCurrent = sc.week === week && !sc.played;
                const isPast = sc.played;
                let result = '';
                let resultColor = '';
                if (isPast) {
                  const pGoals = isHome ? sc.homeGoals : sc.awayGoals;
                  const oGoals = isHome ? sc.awayGoals : sc.homeGoals;
                  result = `${pGoals}-${oGoals}`;
                  resultColor = pGoals > oGoals ? 'text-emerald-400' : pGoals < oGoals ? 'text-destructive' : 'text-muted-foreground';
                }
                return (
                  <div
                    key={`sc-${i}`}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                      isCurrent ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-card/40',
                      isPast && 'opacity-70'
                    )}
                  >
                    <span className={cn('text-xs font-mono w-10 shrink-0', isCurrent ? 'text-amber-400 font-bold' : 'text-muted-foreground')}>
                      W{sc.week}
                    </span>
                    <span className="text-[10px] text-amber-400/70 w-6 shrink-0">
                      {sc.type === 'domestic' ? 'DS' : 'CS'}
                    </span>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: opp?.color || '#888' }} />
                      <span className={cn('text-sm truncate', isCurrent ? 'text-foreground font-bold' : 'text-foreground/80')}>
                        {opp?.shortName || '?'}
                      </span>
                    </div>
                    {isPast ? (
                      <span className={cn('text-sm font-mono font-bold', resultColor)}>{result}</span>
                    ) : isCurrent ? (
                      <span className="text-xs text-amber-400 font-bold">SC</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}

      {/* Continental Fixtures */}
      {[
        { tournament: championsCup, label: 'Champions Cup', color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/30', icon: Globe },
        { tournament: shieldCup, label: 'Shield Cup', color: 'text-orange-400', bgColor: 'bg-orange-500/10 border-orange-500/30', icon: Shield },
      ].map(({ tournament, label, color, bgColor, icon: Icon }) => {
        if (!tournament || tournament.playerEliminated) return null;
        const allClubs = { ...clubs, ...virtualClubs };

        // Group stage matches
        const playerGroup = tournament.groups.find(g => g.clubIds.includes(playerClubId));
        const groupMatches = playerGroup
          ? playerGroup.matches
              .filter(m => m.homeClubId === playerClubId || m.awayClubId === playerClubId)
              .sort((a, b) => a.week - b.week)
          : [];

        // Knockout ties
        const knockoutTies = tournament.knockoutTies
          .filter(t => t.homeClubId === playerClubId || t.awayClubId === playerClubId)
          .sort((a, b) => a.week1 - b.week1);

        if (groupMatches.length === 0 && knockoutTies.length === 0) return null;

        return (
          <div key={label}>
            <div className="flex items-center gap-2 pt-2">
              <Icon className={cn('w-4 h-4', color)} />
              <h3 className="text-sm font-bold text-foreground font-display">{label}</h3>
            </div>
            <div className="space-y-1.5 mt-1.5">
              {groupMatches.map(match => {
                const isHome = match.homeClubId === playerClubId;
                const oppId = isHome ? match.awayClubId : match.homeClubId;
                const opp = allClubs[oppId];
                const isCurrent = match.week === week && !match.played;
                const isPast = match.played;
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
                      isCurrent ? cn('border', bgColor) : 'bg-card/40',
                      isPast && 'opacity-70'
                    )}
                  >
                    <span className={cn('text-xs font-mono w-10 shrink-0', isCurrent ? cn(color, 'font-bold') : 'text-muted-foreground')}>
                      W{match.week}
                    </span>
                    <span className={cn('text-[10px] w-6 shrink-0', color)}>
                      MD{match.matchday}
                    </span>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: opp?.color || '#888' }} />
                      <span className={cn('text-sm truncate', isCurrent ? 'text-foreground font-bold' : 'text-foreground/80')}>
                        {opp?.shortName || '?'}
                      </span>
                    </div>
                    {isPast ? (
                      <span className={cn('text-sm font-mono font-bold', resultColor)}>{result}</span>
                    ) : isCurrent ? (
                      <span className={cn('text-xs font-bold', color)}>GRP</span>
                    ) : null}
                  </div>
                );
              })}
              {knockoutTies.map(tie => {
                const isHome = tie.homeClubId === playerClubId;
                const oppId = isHome ? tie.awayClubId : tie.homeClubId;
                const opp = allClubs[oppId];
                const roundName = getKnockoutRoundName(tie.round);
                const isCurrent = (tie.week1 === week && !tie.leg1Played) || (tie.week2 === week && !tie.leg2Played);
                const isPast = tie.round === 'F' ? tie.leg1Played : tie.leg2Played;
                return (
                  <div
                    key={tie.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                      isCurrent ? cn('border', bgColor) : 'bg-card/40',
                      isPast && 'opacity-70'
                    )}
                  >
                    <span className={cn('text-xs font-mono w-10 shrink-0', isCurrent ? cn(color, 'font-bold') : 'text-muted-foreground')}>
                      W{tie.week1}
                    </span>
                    <span className={cn('text-[10px] w-6 shrink-0', color)}>
                      {roundName.slice(0, 2)}
                    </span>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: opp?.color || '#888' }} />
                      <span className={cn('text-sm truncate', isCurrent ? 'text-foreground font-bold' : 'text-foreground/80')}>
                        {opp?.shortName || '?'}
                      </span>
                    </div>
                    {isPast && tie.winnerId ? (
                      <span className={cn('text-xs font-bold', tie.winnerId === playerClubId ? 'text-emerald-400' : 'text-destructive')}>
                        {tie.winnerId === playerClubId ? 'W' : 'L'}
                      </span>
                    ) : isCurrent ? (
                      <span className={cn('text-xs font-bold', color)}>KO</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CalendarView;
