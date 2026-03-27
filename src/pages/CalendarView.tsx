import { useRef, useEffect, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ArrowLeft, Calendar, Trophy, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRoundName } from '@/data/cup';
import { getDerbyIntensity } from '@/data/league';
import { SUMMER_WINDOW_END, WINTER_WINDOW_START, WINTER_WINDOW_END } from '@/config/transfers';
import { TOTAL_WEEKS } from '@/config/gameBalance';
import type { CupRound, Match, CupTie } from '@/types/game';

interface CalendarEntry {
  week: number;
  type: 'league' | 'cup';
  match: Match | null;
  cupTie: CupTie | null;
}

const CalendarView = () => {
  const { week, season, fixtures, clubs, playerClubId, setScreen, transferWindowOpen, cup, totalWeeks } = useGameStore();
  const currentWeekRef = useRef<HTMLDivElement>(null);

  // Build unified calendar: league + cup merged by week
  const { entries, stats } = useMemo(() => {
    const playerFixtures = fixtures
      .filter(m => m.homeClubId === playerClubId || m.awayClubId === playerClubId);

    const playerCupTies = (cup?.ties || [])
      .filter(t => t.homeClubId === playerClubId || t.awayClubId === playerClubId);

    // Map week -> entries
    const weekMap = new Map<number, CalendarEntry[]>();
    const weekCount = totalWeeks || TOTAL_WEEKS;

    for (const match of playerFixtures) {
      const existing = weekMap.get(match.week) || [];
      existing.push({ week: match.week, type: 'league', match, cupTie: null });
      weekMap.set(match.week, existing);
    }

    for (const tie of playerCupTies) {
      const existing = weekMap.get(tie.week) || [];
      existing.push({ week: tie.week, type: 'cup', match: null, cupTie: tie });
      weekMap.set(tie.week, existing);
    }

    // Build flat list ordered by week, with bye weeks included
    const allEntries: CalendarEntry[] = [];
    for (let w = 1; w <= weekCount; w++) {
      const weekEntries = weekMap.get(w);
      if (weekEntries) {
        allEntries.push(...weekEntries.sort((a, b) => (a.type === 'league' ? 0 : 1) - (b.type === 'league' ? 0 : 1)));
      } else {
        allEntries.push({ week: w, type: 'league', match: null, cupTie: null });
      }
    }

    // Compute season stats from played matches
    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
    for (const m of playerFixtures) {
      if (!m.played) continue;
      const isHome = m.homeClubId === playerClubId;
      const pG = isHome ? m.homeGoals : m.awayGoals;
      const oG = isHome ? m.awayGoals : m.homeGoals;
      goalsFor += pG;
      goalsAgainst += oG;
      if (pG > oG) wins++;
      else if (pG < oG) losses++;
      else draws++;
    }

    return {
      entries: allEntries,
      stats: { wins, draws, losses, goalsFor, goalsAgainst, played: wins + draws + losses },
    };
  }, [fixtures, cup, playerClubId, totalWeeks]);

  // Recent form (last 5 league results)
  const recentForm = useMemo(() => {
    const played = entries
      .filter(e => e.type === 'league' && e.match?.played)
      .slice(-5);
    return played.map(e => {
      const m = e.match!;
      const isHome = m.homeClubId === playerClubId;
      const pG = isHome ? m.homeGoals : m.awayGoals;
      const oG = isHome ? m.awayGoals : m.homeGoals;
      if (pG > oG) return 'W';
      if (pG < oG) return 'L';
      return 'D';
    });
  }, [entries, playerClubId]);

  // Group entries by phase for section headers
  const phases = useMemo(() => {
    const groups: { label: string; startWeek: number; endWeek: number; entries: CalendarEntry[] }[] = [];

    const addPhase = (label: string, start: number, end: number) => {
      const phaseEntries = entries.filter(e => e.week >= start && e.week <= end);
      if (phaseEntries.length > 0) {
        groups.push({ label, startWeek: start, endWeek: end, entries: phaseEntries });
      }
    };

    const weekCount = totalWeeks || TOTAL_WEEKS;

    addPhase('Early Season (Summer Window)', 1, SUMMER_WINDOW_END);
    addPhase('Autumn', SUMMER_WINDOW_END + 1, WINTER_WINDOW_START - 1);
    addPhase('Winter (Transfer Window)', WINTER_WINDOW_START, WINTER_WINDOW_END);
    addPhase('Spring', WINTER_WINDOW_END + 1, 38);
    if (weekCount > 38) {
      addPhase('Season Run-In', 39, weekCount);
    }

    return groups;
  }, [entries, totalWeeks]);

  // Auto-scroll to current week
  useEffect(() => {
    const timer = setTimeout(() => {
      currentWeekRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const cupEliminated = cup?.eliminated;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <button onClick={() => setScreen('dashboard')} className="flex items-center gap-1 text-muted-foreground text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground font-display">Season {season} Schedule</h2>
        <span className="text-xs text-muted-foreground ml-auto">Week {week}</span>
      </div>

      {/* Season Stats Bar */}
      {stats.played > 0 && (
        <GlassPanel className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Season Record</span>
            {recentForm.length > 0 && (
              <div className="flex gap-1 items-center">
                <span className="text-[10px] text-muted-foreground mr-1">Form</span>
                {recentForm.map((r, i) => (
                  <span
                    key={i}
                    className={cn(
                      'w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold',
                      r === 'W' && 'bg-emerald-500/20 text-emerald-400',
                      r === 'D' && 'bg-muted/50 text-muted-foreground',
                      r === 'L' && 'bg-destructive/20 text-destructive',
                    )}
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2 text-center">
            <div>
              <span className="text-lg font-bold text-foreground">{stats.played}</span>
              <p className="text-[10px] text-muted-foreground">P</p>
            </div>
            <div>
              <span className="text-lg font-bold text-emerald-400">{stats.wins}</span>
              <p className="text-[10px] text-muted-foreground">W</p>
            </div>
            <div>
              <span className="text-lg font-bold text-muted-foreground">{stats.draws}</span>
              <p className="text-[10px] text-muted-foreground">D</p>
            </div>
            <div>
              <span className="text-lg font-bold text-destructive">{stats.losses}</span>
              <p className="text-[10px] text-muted-foreground">L</p>
            </div>
            <div>
              <span className="text-lg font-bold text-foreground">{stats.goalsFor}<span className="text-muted-foreground">-</span>{stats.goalsAgainst}</span>
              <p className="text-[10px] text-muted-foreground">GF-GA</p>
            </div>
          </div>
        </GlassPanel>
      )}

      {/* Transfer Window + Cup Status */}
      <div className="grid grid-cols-2 gap-2">
        <GlassPanel className="p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Transfer Window</span>
          <div className="mt-1">
            <span className={cn('text-xs font-bold px-2 py-0.5 rounded', transferWindowOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-destructive/20 text-destructive')}>
              {transferWindowOpen ? 'Open' : 'Closed'}
            </span>
          </div>
        </GlassPanel>
        <GlassPanel className="p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Dynasty Cup</span>
          <div className="mt-1">
            {cupEliminated ? (
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-destructive/20 text-destructive">Eliminated</span>
            ) : cup?.winner === playerClubId ? (
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/20 text-primary">Winners!</span>
            ) : (
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                {cup?.currentRound ? getRoundName(cup.currentRound) : 'Active'}
              </span>
            )}
          </div>
        </GlassPanel>
      </div>

      {/* Unified Calendar by Phase */}
      {phases.map(phase => {
        const hasCurrentWeek = phase.entries.some(e => e.week === week);
        const allPast = phase.entries.every(e => e.week < week);

        return (
          <div key={phase.label}>
            {/* Phase Header */}
            <div className="flex items-center gap-2 mb-2 mt-1">
              <div className={cn(
                'h-px flex-1',
                hasCurrentWeek ? 'bg-primary/40' : 'bg-border/30'
              )} />
              <span className={cn(
                'text-[10px] uppercase tracking-wider font-bold px-2',
                hasCurrentWeek ? 'text-primary' : allPast ? 'text-muted-foreground/50' : 'text-muted-foreground'
              )}>
                {phase.label}
              </span>
              <div className={cn(
                'h-px flex-1',
                hasCurrentWeek ? 'bg-primary/40' : 'bg-border/30'
              )} />
            </div>

            <div className="space-y-1">
              {phase.entries.map((entry) => {
                const isBye = !entry.match && !entry.cupTie;
                const isCurrentWeek = entry.week === week;

                if (isBye) {
                  // Only show bye weeks if they're current or next
                  if (!isCurrentWeek && !(entry.week === week + 1)) return null;
                  return (
                    <div
                      key={`bye-${entry.week}`}
                      ref={isCurrentWeek ? currentWeekRef : undefined}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg',
                        isCurrentWeek ? 'bg-primary/10 border border-primary/30' : 'bg-card/20'
                      )}
                    >
                      <span className={cn('text-xs font-mono w-10 shrink-0', isCurrentWeek ? 'text-primary font-bold' : 'text-muted-foreground/50')}>
                        W{entry.week}
                      </span>
                      <span className="text-xs text-muted-foreground/50 italic">No match</span>
                      {isCurrentWeek && <span className="text-[10px] text-primary font-bold ml-auto">THIS WEEK</span>}
                    </div>
                  );
                }

                // Render match or cup tie
                if (entry.type === 'league' && entry.match) {
                  return renderLeagueMatch(entry.match, isCurrentWeek, currentWeekRef);
                }
                if (entry.type === 'cup' && entry.cupTie) {
                  return renderCupTie(entry.cupTie, isCurrentWeek, currentWeekRef);
                }
                return null;
              })}
            </div>
          </div>
        );
      })}

      {/* Season Progress */}
      <GlassPanel className="p-3 mt-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Season Progress</span>
          <span className="text-xs text-muted-foreground">{week} / {totalWeeks || TOTAL_WEEKS} weeks</span>
        </div>
        <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary/70 rounded-full transition-all"
            style={{ width: `${(week / (totalWeeks || TOTAL_WEEKS)) * 100}%` }}
          />
        </div>
      </GlassPanel>
    </div>
  );

  function renderLeagueMatch(match: Match, isCurrentWeek: boolean, ref: React.RefObject<HTMLDivElement | null>) {
    const isHome = match.homeClubId === playerClubId;
    const opp = clubs[isHome ? match.awayClubId : match.homeClubId];
    const isCurrent = match.week === week && !match.played;
    const isPast = match.played;
    const isDerby = getDerbyIntensity(match.homeClubId, match.awayClubId) > 0;

    let result = '';
    let resultColor = '';
    let resultLabel = '';
    if (isPast) {
      const pGoals = isHome ? match.homeGoals : match.awayGoals;
      const oGoals = isHome ? match.awayGoals : match.homeGoals;
      result = `${pGoals}-${oGoals}`;
      if (pGoals > oGoals) { resultColor = 'text-emerald-400'; resultLabel = 'W'; }
      else if (pGoals < oGoals) { resultColor = 'text-destructive'; resultLabel = 'L'; }
      else { resultColor = 'text-muted-foreground'; resultLabel = 'D'; }
    }

    return (
      <div
        key={match.id}
        ref={isCurrentWeek ? ref : undefined}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
          isCurrent && 'bg-primary/10 border border-primary/30 shadow-sm shadow-primary/10',
          !isCurrent && !isPast && 'bg-card/40',
          isPast && 'bg-card/20 opacity-60',
          isDerby && !isCurrent && 'border-l-2 border-l-amber-500/70'
        )}
      >
        {/* Week number */}
        <span className={cn('text-xs font-mono w-10 shrink-0', isCurrent ? 'text-primary font-bold' : 'text-muted-foreground')}>
          W{match.week}
        </span>

        {/* Home/Away badge */}
        <span className={cn(
          'text-[10px] w-6 shrink-0 font-bold rounded px-1 py-0.5 text-center',
          isHome ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'
        )}>
          {isHome ? 'H' : 'A'}
        </span>

        {/* Opponent */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: opp?.color }} />
          <span className={cn('text-sm truncate', isCurrent ? 'text-foreground font-bold' : 'text-foreground/80')}>
            {opp?.shortName || '?'}
          </span>
          {isDerby && <Flame className="w-3 h-3 text-amber-500 shrink-0" />}
        </div>

        {/* Result / Status */}
        {isPast ? (
          <div className="flex items-center gap-1.5">
            <span className={cn('text-[10px] font-bold rounded px-1 py-0.5',
              resultLabel === 'W' && 'bg-emerald-500/15 text-emerald-400',
              resultLabel === 'D' && 'bg-muted/50 text-muted-foreground',
              resultLabel === 'L' && 'bg-destructive/15 text-destructive',
            )}>{resultLabel}</span>
            <span className={cn('text-sm font-mono font-bold', resultColor)}>{result}</span>
          </div>
        ) : isCurrent ? (
          <span className="text-xs text-primary font-bold animate-pulse">NEXT</span>
        ) : null}
      </div>
    );
  }

  function renderCupTie(tie: CupTie, isCurrentWeek: boolean, ref: React.RefObject<HTMLDivElement | null>) {
    const isHome = tie.homeClubId === playerClubId;
    const opp = clubs[isHome ? tie.awayClubId : tie.homeClubId];
    const isCurrent = tie.week === week && !tie.played;
    const isPast = tie.played;

    let result = '';
    let resultColor = '';
    let resultLabel = '';
    let penaltyNote = '';
    if (isPast) {
      const pGoals = isHome ? tie.homeGoals : tie.awayGoals;
      const oGoals = isHome ? tie.awayGoals : tie.homeGoals;
      result = `${pGoals}-${oGoals}`;
      if (tie.penaltyShootout) {
        const pPens = isHome ? tie.penaltyShootout.home : tie.penaltyShootout.away;
        const oPens = isHome ? tie.penaltyShootout.away : tie.penaltyShootout.home;
        penaltyNote = `(${pPens}-${oPens} pens)`;
        if (pPens > oPens) { resultColor = 'text-emerald-400'; resultLabel = 'W'; }
        else { resultColor = 'text-destructive'; resultLabel = 'L'; }
      } else {
        if (pGoals > oGoals) { resultColor = 'text-emerald-400'; resultLabel = 'W'; }
        else if (pGoals < oGoals) { resultColor = 'text-destructive'; resultLabel = 'L'; }
        else { resultColor = 'text-muted-foreground'; resultLabel = 'D'; }
      }
    }

    return (
      <div
        key={tie.id}
        ref={isCurrentWeek ? ref : undefined}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors border-l-2 border-l-primary/50',
          isCurrent && 'bg-primary/10 border border-primary/30 shadow-sm shadow-primary/10',
          !isCurrent && !isPast && 'bg-card/40',
          isPast && 'bg-card/20 opacity-60',
        )}
      >
        {/* Week number */}
        <span className={cn('text-xs font-mono w-10 shrink-0', isCurrent ? 'text-primary font-bold' : 'text-muted-foreground')}>
          W{tie.week}
        </span>

        {/* Cup round badge */}
        <span className="text-[10px] w-6 shrink-0 font-bold rounded px-1 py-0.5 text-center bg-primary/15 text-primary">
          <Trophy className="w-3 h-3 inline" />
        </span>

        {/* Opponent + round name */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: opp?.color }} />
          <div className="flex flex-col min-w-0">
            <span className={cn('text-sm truncate', isCurrent ? 'text-foreground font-bold' : 'text-foreground/80')}>
              {opp?.shortName || '?'}
            </span>
            <span className="text-[10px] text-primary/70">{getRoundName(tie.round as CupRound)}</span>
          </div>
        </div>

        {/* Result / Status */}
        {isPast ? (
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5">
              <span className={cn('text-[10px] font-bold rounded px-1 py-0.5',
                resultLabel === 'W' && 'bg-emerald-500/15 text-emerald-400',
                resultLabel === 'L' && 'bg-destructive/15 text-destructive',
                resultLabel === 'D' && 'bg-muted/50 text-muted-foreground',
              )}>{resultLabel}</span>
              <span className={cn('text-sm font-mono font-bold', resultColor)}>{result}</span>
            </div>
            {penaltyNote && <span className="text-[9px] text-muted-foreground">{penaltyNote}</span>}
          </div>
        ) : isCurrent ? (
          <span className="text-xs text-primary font-bold animate-pulse">CUP</span>
        ) : null}
      </div>
    );
  }
};

export default CalendarView;
